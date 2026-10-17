import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "./test"
import { countThumbSlides, pageErrors, seriousAccessibilityProblems, settled, thumbCovers } from "./helpers"

const resume = (id: string, resumeTitle: string, more: { resumeTag?: string; selectedTemplate?: string; updatedAt?: string } = {}) => ({
  id,
  resumeTitle,
  resumeTag: "professional",
  updatedAt: "2026-10-06T12:00:00.000Z",
  selectedTemplate: "jake",
  profileSection: { fullName: "Ada Lovelace" },
  ...more,
})

/**
 * Opens the dashboard with these resumes saved in the browser, as an earlier
 * visit would have. Saved once a tab, so one deleted stays deleted.
 */
async function dashboardWith(page: Page, resumes: (ReturnType<typeof resume> & Record<string, unknown>)[]) {
  await page.addInitScript((resumes) => {
    if (sessionStorage.getItem("seeded")) return
    sessionStorage.setItem("seeded", "yes")
    for (const resume of resumes) {
      const key = `resume:${resume.id}`
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(resume))
    }
  }, resumes)
  await page.goto("/create/dashboard")
}

/** The resumes as pages, as the dashboard first shows them. */
const pages = (page: Page) => page.getByRole("list", { name: "Resumes" })

/** A resume's page, by its name. */
const tile = (page: Page, name: string) =>
  pages(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) })

/** What a resume's saved as in this browser, as text; null once it's gone. */
const saved = (page: Page, id: string) => page.evaluate((id) => localStorage.getItem(`resume:${id}`), id)

/** Whether an element's text is cut short, across or down. Layout is in fractions of a pixel, so allow one. */
const cutShort = (element: Locator) =>
  element.evaluate((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)

/** What `watchTransitions` keeps on the page's window. */
interface Watched {
  started: number
  /** Each animation of the first view transition, by the part of it that moves, once it's under way. */
  running: Promise<{ part: string; ms: number }[]>
  /** Whether something on the page itself was fading in, as opposed to a picture of it, once the first was under way. */
  fadingIn: boolean
}

/** Counts the view transitions the page starts from here on, and keeps the first's animations. */
async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const watched = window as unknown as Watched
    const start = document.startViewTransition.bind(document)
    watched.started = 0
    watched.running = new Promise((resolve, reject) => {
      document.startViewTransition = (update) => {
        watched.started++
        const transition = start(update)
        // Ready once the browser has pictured both views and is animating between them; it fails if
        // the transition can't run, as when two parts of the page have the same name.
        transition.ready.then(() => {
          watched.fadingIn = document
            .getAnimations()
            .some(
              (animation) =>
                (animation as CSSTransition).transitionProperty === "opacity" && !(animation.effect as KeyframeEffect).pseudoElement,
            )
          resolve(
            document.getAnimations().map((animation) => ({
              part: (animation.effect as KeyframeEffect).pseudoElement ?? "",
              ms: Number(animation.effect!.getComputedTiming().duration),
            })),
          )
        }, reject)
        return transition
      }
    })
  })
}

test("a long resume name wraps in the table, and every resume's buttons stay on screen", async ({ page }) => {
  const errors = pageErrors(page)
  // Names far too long for the table, with and without spaces.
  const unbroken = `Software_Engineer_Resume_${Array.from({ length: 110 }, (_, index) => index).join("_")}`
  const spaced = Array.from({ length: 12 }, (_, index) => `Senior Staff Engineer ${index}`).join(" ")
  expect(unbroken.length).toBeGreaterThan(300)
  await page.setViewportSize({ width: 1280, height: 800 })
  await dashboardWith(page, [resume("a", unbroken), resume("b", spaced), resume("c", "Short one")])
  await page.getByRole("button", { name: "List" }).click()

  const table = page.getByRole("table")
  await expect(table.getByRole("row")).toHaveCount(4)
  // The table fits in its scroll box, so nothing's off to the side, and every
  // row's last button ends inside it (allowing a pixel, as above).
  const box = await table.evaluate((element) => {
    const parent = element.parentElement!
    return { fits: parent.scrollWidth <= parent.clientWidth, right: parent.getBoundingClientRect().right }
  })
  expect(box.fits).toBe(true)
  for (const button of await table.getByRole("button", { name: "Delete" }).all()) {
    const shown = (await button.boundingBox())!
    expect(shown.x + shown.width).toBeLessThanOrEqual(box.right + 1)
  }

  // Each long name is cut short after two lines. Its link still has it in
  // full, for screen readers, and shows it on hover.
  for (const name of [unbroken, spaced]) {
    const link = table.getByRole("link", { name, exact: true })
    await expect(link).toHaveAttribute("title", name)
    expect(await cutShort(link)).toBe(true)
  }
  expect(await cutShort(table.getByRole("link", { name: "Short one" }))).toBe(false)

  // Deleted, it's said aloud in full, and the message at the foot of the
  // screen is cut short to fit, with its Undo on screen.
  const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: unbroken, exact: true }) })
  await row.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("status").filter({ hasText: "deleted" })).toHaveText(`“${unbroken}” deleted`)
  const undo = page.getByRole("button", { name: "Undo" })
  await expect(undo).toBeVisible()
  const shown = (await undo.boundingBox())!
  expect(shown.x + shown.width).toBeLessThanOrEqual(1280)
  expect(errors).toEqual([])
})

test("in the list, each resume's small page has its edge on all four sides", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await dashboardWith(page, [resume("a", "Ada")])
  await page.getByRole("button", { name: "List" }).click()
  const row = page
    .getByRole("table")
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "Ada", exact: true }) })
  // The page is hidden from screen readers (its name's link opens the same resume), so it's found by
  // the attribute the view switch moves it by. It sits right at the left edge of the table's scroll box.
  const picture = row.locator("[data-resume-page]")
  await expect(picture).toBeVisible()
  // Until the switch to the list ends, what shows is its picture moving into the row, and the list fading in.
  await settled(picture)
  const box = (await picture.boundingBox())!

  // Its left-most column of pixels, halfway down, as drawn: the grey edge, not the white page inside.
  const shot = await page.screenshot({ clip: { x: Math.round(box.x), y: Math.round(box.y + box.height / 2) - 4, width: 1, height: 8 } })
  const pixels = await page.evaluate(async (png) => {
    const image = new Image()
    image.src = `data:image/png;base64,${png}`
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext("2d")!
    context.drawImage(image, 0, 0)
    return Array.from(context.getImageData(0, 0, image.width, image.height).data)
  }, shot.toString("base64"))
  // Red, green and blue of each pixel; white would be the page, with its edge cut off.
  const reds = pixels.filter((_, index) => index % 4 === 0)
  expect(Math.max(...reds)).toBeLessThan(240)
})

test("on a tablet, two resumes whose names differ only by a number both show it", async ({ page }) => {
  const errors = pageErrors(page)
  // Giving a resume a name that's taken adds a number, as "… 2", which only tells them apart if it shows.
  const name = "Product Manager Resume – Stripe"
  await page.setViewportSize({ width: 834, height: 1112 })
  await dashboardWith(page, [resume("a", name), resume("b", `${name} 2`)])
  await page.getByRole("button", { name: "List" }).click()

  const table = page.getByRole("table")
  for (const title of [name, `${name} 2`]) expect(await cutShort(table.getByRole("link", { name: title, exact: true }))).toBe(false)
  expect(errors).toEqual([])
})

test("closing a dialog puts focus back on what opened it, however it's closed", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Short one")])
  const newResume = page.getByRole("main").getByRole("button", { name: "New resume" }).first()
  const dialog = page.getByRole("dialog", { name: "New resume" })

  await newResume.press("Enter")
  await expect(dialog.getByLabel("Name")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(newResume).toBeFocused()

  await newResume.press("Enter")
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  await expect(newResume).toBeFocused()

  // A click outside it too, where the browser would otherwise move focus to the page.
  await newResume.press("Enter")
  await page.mouse.click(4, 4)
  await expect(dialog).toBeHidden()
  await expect(newResume).toBeFocused()
  expect(errors).toEqual([])
})

test("New resume starts one blank in the template and paper chosen, copies one here, or opens a file", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada")])
  const newResume = page.getByRole("main").getByRole("button", { name: "New resume" }).first()
  const dialog = page.getByRole("dialog", { name: "New resume" })
  // The resume the editor has open, as saved.
  const opened = () => page.evaluate(() => JSON.parse(localStorage.getItem(`resume:${location.pathname.split("/").pop()}`) ?? "null"))

  // Blank, in Harvard, on A4 rather than its own Letter.
  await newResume.click()
  await dialog.getByLabel("Name").fill("For Kestrel")
  await dialog.getByRole("button", { name: "Template Jake's" }).click()
  await dialog.getByRole("menu", { name: "Template" }).getByRole("menuitemradio", { name: "Harvard" }).click()
  await dialog.getByRole("button", { name: "Paper Letter" }).click()
  await dialog.getByRole("menu", { name: "Paper" }).getByRole("menuitemradio", { name: "A4" }).click()
  await dialog.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect.poll(opened).toMatchObject({ resumeTitle: "For Kestrel", selectedTemplate: "resumeworded", tune: { paper: "a4" } })

  // A copy of Ada's, which starts in Ada's template, put in Compact.
  await page.goto("/create/dashboard")
  await newResume.click()
  await dialog.getByRole("tab", { name: "Copy one" }).click()
  await dialog.getByText("Ada", { exact: true }).click()
  await expect(dialog.getByRole("radio", { name: /^Ada/ })).toBeChecked()
  await dialog.getByRole("button", { name: "Template Jake's" }).click()
  await dialog.getByRole("menu", { name: "Template" }).getByRole("menuitemradio", { name: "Compact" }).click()
  await dialog.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect
    .poll(opened)
    .toMatchObject({ resumeTitle: "Ada copy", selectedTemplate: "referme", profileSection: { fullName: "Ada Lovelace" } })

  // Or a file.
  await page.goto("/create/dashboard")
  await newResume.click()
  await dialog.getByRole("tab", { name: "Open a file" }).click()
  const choosing = page.waitForEvent("filechooser")
  await dialog.getByRole("button", { name: "Choose a file" }).click()
  await choosing
  expect(errors).toEqual([])
})

test("New resume's template menu opens on the chosen one, scrolls inside its glass, and Escape closes only it", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada")])
  await page.getByRole("main").getByRole("button", { name: "New resume" }).first().click()
  const dialog = page.getByRole("dialog", { name: "New resume" })
  const template = dialog.getByRole("button", { name: /^Template/ })
  const menu = dialog.getByRole("menu", { name: "Template" })
  await template.click()
  await menu.getByRole("menuitemradio", { name: "Accent" }).click()
  await template.click()

  // Opened again, the one chosen, far down the list, is in view, with the keyboard on it.
  const accent = menu.getByRole("menuitemradio", { name: "Accent" })
  await expect(accent).toBeFocused()
  await expect(accent).toBeInViewport()
  // Its list scrolls inside the glass, not the glass itself, whose frost would scroll away and leave it see-through.
  expect(await menu.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(0)
  expect(await accent.evaluate((item) => item.parentElement!.scrollTop)).toBeGreaterThan(0)

  // Escape closes the menu, back on its button, and only then the dialog.
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  await expect(dialog).toBeVisible()
  await expect(template).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  // With nothing to copy, there's no template or paper to choose for a copy.
  await dashboardWith(page, [])
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole("main").getByRole("button", { name: "New resume" }).first().click()
  await dialog.getByRole("tab", { name: "Copy one" }).click()
  await expect(dialog.getByText("No resumes to copy yet.")).toBeVisible()
  await expect(template).toHaveCount(0)
  expect(errors).toEqual([])
})

test("the page greets by the time of day, with the first name on the resume edited last", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.setFixedTime(new Date("2026-10-13T15:30:00"))
  await dashboardWith(page, [
    resume("a", "Ada", { updatedAt: "2026-10-08T12:00:00.000Z" }),
    { ...resume("b", "Grace", { updatedAt: "2026-10-09T12:00:00.000Z" }), profileSection: { fullName: "Dr. Grace Hopper" } },
  ])
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Good afternoon, Grace")
  await expect(page.getByText("Pick up where you left off, or start a new one.")).toBeVisible()
  expect(errors).toEqual([])
})

test("Tab stays inside an open dialog, going round from its last control to its first", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Short one")])
  await page.getByRole("main").getByRole("button", { name: "New resume" }).first().click()
  const dialog = page.getByRole("dialog", { name: "New resume" })
  const name = dialog.getByLabel("Name")
  await expect(name).toBeFocused()

  // Back past the tabs and the close button, and round to the last control.
  await page.keyboard.press("Shift+Tab")
  await expect(dialog.getByRole("tab", { name: "Start blank" })).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(dialog.getByRole("button", { name: "Create" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused()
  // Through the tab chosen, the name, the type's choices (one stop), Your own, the template, the paper, Cancel and Create.
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await expect(name).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(dialog.getByRole("radio", { name: "Professional" })).toBeFocused()
  for (const control of [
    dialog.getByRole("button", { name: "Your own" }),
    dialog.getByRole("button", { name: /^Template/ }),
    dialog.getByRole("button", { name: /^Paper/ }),
    dialog.getByRole("button", { name: "Cancel" }),
    dialog.getByRole("button", { name: "Create" }),
    dialog.getByRole("button", { name: "Close" }),
  ]) {
    await page.keyboard.press("Tab")
    await expect(control).toBeFocused()
  }
  expect(errors).toEqual([])
})

test("the Sort menu puts the resumes in order by name, from the keyboard", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [
    resume("a", "Grace", { updatedAt: "2026-10-08T12:00:00.000Z" }),
    resume("b", "Ada", { updatedAt: "2026-10-01T12:00:00.000Z" }),
    resume("c", "Kestrel", { updatedAt: "2026-10-05T12:00:00.000Z" }),
  ])
  await expect(pages(page).getByRole("link")).toHaveText(["Grace", "Kestrel", "Ada"])

  // It opens on the order chosen; the arrow keys go to the other.
  const sort = page.getByRole("button", { name: "Sort Last edited" })
  await sort.press("Enter")
  const menu = page.getByRole("menu", { name: "Sort by" })
  await expect(menu.getByRole("menuitemradio", { name: "Last edited" })).toBeFocused()
  await expect(menu.getByRole("menuitemradio", { name: "Last edited" })).toHaveAttribute("aria-checked", "true")
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(menu).toHaveCount(0)
  await expect(pages(page).getByRole("link")).toHaveText(["Ada", "Grace", "Kestrel"])
  await expect(page.getByRole("button", { name: "Sort Name" })).toBeFocused()

  // Escape closes it without changing anything.
  await page.keyboard.press("Enter")
  await expect(menu.getByRole("menuitemradio", { name: "Name" })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Sort Name" })).toBeFocused()
  await expect(pages(page).getByRole("link")).toHaveText(["Ada", "Grace", "Kestrel"])
  expect(errors).toEqual([])
})

for (const [layout, width] of [
  ["phone", 390],
  ["wide screen", 1280],
] as const) {
  test(`on a ${layout}, a resume can be duplicated and renamed from the list`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.setViewportSize({ width, height: 900 })
    await dashboardWith(page, [{ ...resume("a", "Ada"), headings: { skillsSection: "Toolbox" } }, resume("b", "Grace")])
    await page.getByRole("button", { name: "List" }).click()
    // The switch comes a frame later, as a view transition does, and the pages are a list too.
    await expect(page.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true")
    // The cards or the table, whichever shows at this width.
    const list = width < 768 ? page.getByRole("list").filter({ has: page.getByRole("link", { name: "Ada" }) }) : page.getByRole("table")
    const row = (name: string) => list.locator("li, tr").filter({ has: page.getByRole("link", { name, exact: true }) })

    // A copy has everything, under its own id, and gets focus.
    await row("Ada").getByRole("button", { name: "Duplicate" }).click()
    const copy = list.getByRole("link", { name: "Ada copy", exact: true })
    await expect(copy).toBeFocused()
    const id = (await copy.getAttribute("href"))!.split("/").pop()!
    expect(id).not.toBe("a")
    const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem(`resume:${id}`)!), id)
    expect(saved).toMatchObject({ resumeTitle: "Ada copy", selectedTemplate: "jake", headings: { skillsSection: "Toolbox" } })

    // Escape keeps the old name.
    await row("Ada copy").getByRole("button", { name: "Rename" }).click()
    const box = list.getByRole("textbox", { name: "Resume name" })
    await expect(box).toBeFocused()
    await box.fill("Something else")
    await box.press("Escape")
    await expect(copy).toBeVisible()
    await expect(row("Ada copy").getByRole("button", { name: "Rename" })).toBeFocused()

    // Enter saves it, numbered when another resume has it.
    await row("Ada copy").getByRole("button", { name: "Rename" }).click()
    await box.fill("Grace")
    await box.press("Enter")
    await expect(list.getByRole("link", { name: "Grace 2", exact: true })).toBeVisible()

    // A blank name is "Untitled resume".
    await row("Grace 2").getByRole("button", { name: "Rename" }).click()
    await box.fill("  ")
    await box.press("Enter")
    await expect(list.getByRole("link", { name: "Untitled resume", exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test("resumes show as their pages, and the list is a click away, remembered after a reload", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
  const view = page.getByRole("group", { name: "View" })

  await expect(pages(page).getByRole("link")).toHaveText(["Ada", "Grace"])
  await expect(view.getByRole("button", { name: "Pages" })).toHaveAttribute("aria-pressed", "true")
  await view.getByRole("button", { name: "List" }).click()
  await expect(page.getByRole("table").getByRole("link", { name: "Ada", exact: true })).toBeVisible()
  await expect(pages(page)).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole("table").getByRole("link", { name: "Ada", exact: true })).toBeVisible()
  await expect(view.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true")
  await view.getByRole("button", { name: "Pages" }).click()
  await page.reload()
  await expect(pages(page).getByRole("link", { name: "Ada", exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test("the switch's white pill slides to the view picked", async ({ page }) => {
  await dashboardWith(page, [resume("a", "Ada")])
  const view = page.getByRole("group", { name: "View" })
  await expect(view.getByRole("button", { name: "Pages" })).toHaveAttribute("aria-pressed", "true")
  // It used to be drawn by the pressed button, so it jumped. Listened for rather than looked for once:
  // the view changes when the browser's view transition gets to it, which WebKit can take a while to.
  await view.evaluate((group) =>
    group.addEventListener("transitionrun", (event) => {
      if (event instanceof TransitionEvent) group.dataset.sliding = `${group.dataset.sliding ?? ""} ${event.propertyName}`
    }),
  )
  await view.getByRole("button", { name: "List" }).click()
  await expect(view).toHaveAttribute("data-sliding", /\btranslate\b/)
})

test("switching to the list moves each resume's page and name to its row, with focus kept on the switch", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
  await expect(pages(page).getByRole("link")).toHaveText(["Ada", "Grace"])
  await watchTransitions(page)

  const list = page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" })
  await list.press("Enter")
  await expect.poll(() => page.evaluate(() => (window as unknown as Watched).started)).toBe(1)
  const moving = (await page.evaluate(() => (window as unknown as Watched).running)).filter(({ part }) =>
    part.startsWith("::view-transition"),
  )
  // The two resumes' pages and names each move on their own, in a little under half a second. The rest
  // of the page isn't pictured: Safari shows such a picture of the whole page in slightly different
  // colors, so the page would change shade until it ended. It stays live, and the new view fades in.
  const parts = moving.map(({ part }) => part)
  expect(parts.filter((part) => part.endsWith("(root)"))).toEqual([])
  expect(new Set(parts.filter((part) => part.startsWith("::view-transition-group("))).size).toBe(4)
  expect(await page.evaluate(() => (window as unknown as Watched).fadingIn)).toBe(true)
  for (const { ms } of moving) {
    expect(ms).toBeGreaterThanOrEqual(380)
    expect(ms).toBeLessThanOrEqual(460)
  }

  await expect(page.getByRole("table").getByRole("link", { name: "Ada", exact: true })).toBeVisible()
  await expect(list).toHaveAttribute("aria-pressed", "true")
  await expect(list).toBeFocused()
  expect(errors).toEqual([])
})

for (const [layout, width] of [
  ["phone", 390],
  ["wide screen", 1280],
] as const) {
  test(`on a ${layout}, a resume can be copied, renamed and deleted from its page, and Undo puts it back as it was`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.setViewportSize({ width, height: 900 })
    await dashboardWith(page, [{ ...resume("a", "Ada"), headings: { skillsSection: "Toolbox" } }, resume("b", "Grace")])

    // A copy gets focus.
    await tile(page, "Ada").getByRole("button", { name: "Duplicate" }).click()
    await expect(pages(page).getByRole("link", { name: "Ada copy", exact: true })).toBeFocused()

    // Renaming is in More, and focus goes back there.
    await tile(page, "Ada copy").getByRole("button", { name: "More for “Ada copy”" }).click()
    await page.getByRole("menu").getByRole("menuitem", { name: "Rename" }).click()
    const box = pages(page).getByRole("textbox", { name: "Resume name" })
    await expect(box).toBeFocused()
    await box.fill("Lovelace")
    await box.press("Enter")
    await expect(tile(page, "Lovelace").getByRole("button", { name: "More for “Lovelace”" })).toBeFocused()

    // Deleted, it's gone from the page, with a moment to undo it. Undo puts it
    // back exactly as it was saved, and focus on it.
    const before = await saved(page, "a")
    await tile(page, "Ada").getByRole("button", { name: "More for “Ada”" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await expect(pages(page).getByRole("link", { name: "Ada", exact: true })).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "deleted" })).toHaveText("“Ada” deleted")
    await expect(page.getByText(/^\d+ resumes?\W+saved in this browser$/i)).toHaveText(/^2 resumes/i)
    await page.getByRole("button", { name: "Undo" }).click()
    await expect(pages(page).getByRole("link", { name: "Ada", exact: true })).toBeFocused()
    expect(await saved(page, "a")).toBe(before)

    // Once its time is up, it's deleted from the browser. (Pointed at, the
    // Undo waits; the pointer leaves it, as it may land on it after Delete.)
    await tile(page, "Ada").getByRole("button", { name: "More for “Ada”" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.mouse.move(0, 0)
    await expect(page.getByRole("button", { name: "Undo" })).toBeHidden({ timeout: 15_000 })
    expect(await saved(page, "a")).toBeNull()

    // Leaving the page deletes one straight away.
    await tile(page, "Grace").getByRole("button", { name: "More for “Grace”" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible()
    await page.reload()
    await expect(pages(page).getByRole("link", { name: "Lovelace", exact: true })).toBeVisible()
    expect(await saved(page, "b")).toBeNull()
    expect(errors).toEqual([])
  })
}

test("⌘Z (Ctrl+Z) puts back the resume just deleted, except in the search, where it's the search's own", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
  const before = await saved(page, "a")
  await tile(page, "Ada").getByRole("button", { name: "More for “Ada”" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(pages(page).getByRole("link", { name: "Ada", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("aria-keyshortcuts", /^(Meta|Control)\+Z$/)

  const search = page.getByRole("combobox", { name: "Search your resumes" })
  await search.focus()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible()
  await expect(pages(page).getByRole("link", { name: "Ada", exact: true })).toHaveCount(0)

  await search.blur()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(pages(page).getByRole("link", { name: "Ada", exact: true })).toBeFocused()
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0)
  expect(await saved(page, "a")).toBe(before)
  expect(errors).toEqual([])
})

test("on a phone, a page's More menu opens on screen, in front of the page beside it", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
  // Two pages to a row: Ada's on the left, with little room left of its More button.
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ["Ada", "Grace"]) {
      await tile(page, name)
        .getByRole("button", { name: `More for “${name}”` })
        .click()
      const menu = page.getByRole("menu", { name: `More for “${name}”` })
      await expect(menu).toBeVisible()
      await settled(menu)
      const shown = (await menu.boundingBox())!
      expect(shown.x, `${name}'s menu at ${width}px`).toBeGreaterThanOrEqual(0)
      expect(shown.x + shown.width, `${name}'s menu at ${width}px`).toBeLessThanOrEqual(width)
      // Each item is what's there to tap, not the page beside it drawn over it.
      for (const item of await menu.getByRole("menuitem").all()) {
        const tapped = await item.evaluate((element) => {
          const box = element.getBoundingClientRect()
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
        })
        expect(tapped, `${await item.textContent()} in ${name}'s menu at ${width}px`).toBe(true)
      }
      await page.keyboard.press("Escape")
      await expect(menu).toBeHidden()
    }
  }
  expect(errors).toEqual([])
})

test("the search finds resumes by name or template, and opens one from the keyboard", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [
    resume("a", "Ada", { updatedAt: "2026-10-08T12:00:00.000Z" }),
    resume("b", "Grace", { selectedTemplate: "resumeworded" }),
    resume("c", "For Kestrel Health", { selectedTemplate: "levelsfyi", updatedAt: "2026-10-07T12:00:00.000Z" }),
  ])
  const search = page.getByRole("combobox", { name: "Search your resumes" })

  // "/" goes to it from anywhere on the page, without typing itself.
  await expect(pages(page).getByRole("link")).toHaveCount(3)
  await page.keyboard.press("/")
  await expect(search).toBeFocused()
  await expect(search).toHaveValue("")

  // By name: only it's left on the page, and listed under the search, ready to open.
  await search.fill("kest")
  await expect(pages(page).getByRole("link")).toHaveText(["For Kestrel Health"])
  await expect(page.getByRole("status").filter({ hasText: "match" })).toHaveText("1 resume matches “kest”")
  await expect(page.getByRole("listbox", { name: "Matching resumes" }).getByRole("option", { selected: true })).toContainText(
    "For Kestrel Health",
  )
  expect(await seriousAccessibilityProblems(page)).toEqual([])

  // By template, Harvard; the arrow keys pick another, and Escape starts again.
  await search.fill("harv")
  await expect(pages(page).getByRole("link")).toHaveText(["Grace"])
  await search.fill("a")
  const options = page.getByRole("listbox", { name: "Matching resumes" }).getByRole("option")
  await expect(options).toHaveCount(3)
  await search.press("ArrowDown")
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true")
  await search.press("Escape")
  await expect(search).toHaveValue("")
  await expect(search).toHaveAttribute("aria-expanded", "false")
  await expect(pages(page).getByRole("link")).toHaveCount(3)

  // Enter opens the one picked.
  await search.fill("kest")
  await search.press("Enter")
  await expect(page).toHaveURL(/\/create\/new\/c$/)
  await expect(page.getByLabel("Resume name")).toHaveValue("For Kestrel Health")
  // Let the preview finish, so the compiler's download isn't cut off as the page closes.
  await expect(page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()
  expect(errors).toEqual([])
})

test("in use, the search lifts into the middle of the screen, and Escape or a press on the page puts it back", async ({
  page,
  browserName,
}) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1280, height: 1200 })
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
  const search = page.getByRole("combobox", { name: "Search your resumes" })
  // Whether it's in the middle of the screen, rather than at the start of the toolbar.
  const middle = async () => {
    const box = (await search.boundingBox())!
    return Math.abs(box.x + box.width / 2 - 640) < 40
  }
  await expect(search).toBeVisible()
  expect(await middle()).toBe(false)

  await search.click()
  await expect.poll(middle).toBe(true)
  // The header, a pill the same shape, tucks away above the screen meanwhile.
  await expect(page.getByRole("banner")).not.toBeInViewport()
  await search.fill("ada")
  await expect(page.getByRole("listbox", { name: "Matching resumes" })).toBeVisible()

  // With nothing to list, it says so; and the softened page covers the whole screen.
  await search.fill("zzz")
  // The panel's line and the screen readers' status say the same.
  await expect(page.getByText("No resume matches “zzz”").filter({ visible: true })).toHaveCount(2)
  // Playwright's WebKit on Linux draws no backdrop-filter at all (no glass blurs there, the
  // search field's own included), so the blur is only measured where it's drawn.
  if (browserName !== "webkit") {
    // Once the veil's faded in, the foot of the screen is blurred too: no sharp edges
    // (as the sheet's sides have against the sky), only small steps from one pixel to the next.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    )
    const shot = await page.screenshot({ clip: { x: 0, y: 1000, width: 1280, height: 200 } })
    const sharpest = await page.evaluate(async (png) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext("2d")!
      context.drawImage(image, 0, 0)
      const { data, width, height } = context.getImageData(0, 0, image.width, image.height)
      // Chromium leaves a hard edge (steps of 70 or more) in the first and last few pixels of a
      // clipped screenshot, where the backdrop blur meets the crop. It moves with the clip, so it's
      // from taking the picture, not in the page: those pixels are left out.
      const edge = 16
      let most = 0
      for (let y = 0; y < height; y++)
        for (let x = edge; x < width - edge; x++) most = Math.max(most, Math.abs(data[(y * width + x) * 4] - data[(y * width + x - 1) * 4]))
      return most
    }, shot.toString("base64"))
    expect(sharpest).toBeLessThan(60)
  }

  // Escape starts again first, then puts it back and lets go of it; "/" lifts it again.
  await search.press("Escape")
  await expect(search).toHaveValue("")
  expect(await middle()).toBe(true)
  await search.press("Escape")
  await expect.poll(middle).toBe(false)
  await expect(search).not.toBeFocused()
  await expect(page.getByRole("banner")).toBeInViewport()
  await page.keyboard.press("/")
  await expect(search).toBeFocused()
  await expect.poll(middle).toBe(true)
  await page.keyboard.type("g")

  // A press on the softened page puts it back, keeping what was typed.
  await page.mouse.click(1200, 700)
  await expect.poll(middle).toBe(false)
  await expect(search).toHaveValue("g")
  expect(errors).toEqual([])
})

test("on a phone, the search stays in the toolbar, with its matches under it, and big enough text that Safari doesn't zoom in", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
  const search = page.getByRole("combobox", { name: "Search your resumes" })
  await expect(search).toBeVisible()
  const before = (await search.boundingBox())!

  await search.click()
  await search.fill("ada")
  const listbox = page.getByRole("listbox", { name: "Matching resumes" })
  await expect(listbox).toBeVisible()
  // Nothing lifted, nothing softened, the header still there.
  expect(await search.boundingBox()).toMatchObject({ x: before.x, y: before.y })
  await expect(page.locator("html")).not.toHaveAttribute("data-spotlight")
  await expect(page.getByRole("banner")).toBeInViewport()
  expect((await listbox.boundingBox())!.y).toBeGreaterThan(before.y + before.height)
  // The matches' panel lines up with the search field, edge to edge.
  const field = (await search.locator("..").boundingBox())!
  // Polled, as the panel grows in from its corner.
  await expect
    .poll(async () => {
      const panel = (await listbox.locator("..").boundingBox())!
      return [panel.x, panel.width]
    })
    .toEqual([field.x, field.width])
  // iOS zooms in to a focused field with text under 16px.
  expect(await search.evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16)

  // A press on the page closes the matches and keeps what was typed.
  await page.getByRole("banner").click({ position: { x: 5, y: 5 } })
  await expect(listbox).toBeHidden()
  await expect(search).toHaveValue("ada")
  expect(errors).toEqual([])
})

test("each card says its resume's type over its name, and one without a type keeps the line", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [
    resume("a", "Ada"),
    resume("b", "Grace", { resumeTag: "personal" }),
    resume("c", "Kestrel", { resumeTag: "" }),
  ])
  await expect(tile(page, "Ada").getByText("Professional", { exact: true })).toBeVisible()
  await expect(tile(page, "Grace").getByText("Personal", { exact: true })).toBeVisible()
  // The names in a row line up, with a type over them or not.
  const top = async (name: string) => (await page.getByRole("link", { name, exact: true }).boundingBox())!.y
  expect(Math.abs((await top("Ada")) - (await top("Kestrel")))).toBeLessThan(1)
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  expect(errors).toEqual([])
})

test("the header's Dashboard opens the dashboard, which the tab calls Dashboard", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/terms")
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click()
  await expect(page).toHaveURL(/\/create\/dashboard$/)
  await expect(page).toHaveTitle(/^Dashboard/)
  expect(errors).toEqual([])
})

test("the tags show their resumes, with how many each has", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace", { resumeTag: "personal" }), resume("c", "Kestrel")])
  const tags = page.getByRole("group", { name: "Show" }).getByRole("button")
  await expect(tags).toHaveText(["All 3", "Personal 1", "Professional 2"])
  await tags.filter({ hasText: "Professional" }).click()
  await expect(tags.filter({ hasText: "Professional" })).toHaveAttribute("aria-pressed", "true")
  await expect(pages(page).getByRole("link")).toHaveText(["Ada", "Kestrel"])
  expect(errors).toEqual([])
})

test("the picked tag's white pill slides across to the next one picked, and stays with it as the tags change", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace", { resumeTag: "personal" }), resume("c", "Kestrel")])
  const row = page.getByRole("group", { name: "Show" })
  const tags = row.getByRole("button")
  await expect(tags).toHaveText(["All 3", "Personal 1", "Professional 2"])
  await expect.poll(() => thumbCovers(row, tags.filter({ hasText: "All" }))).toBe(true)
  const slides = await countThumbSlides(row)

  const professional = tags.filter({ hasText: "Professional" })
  await professional.click()
  await expect.poll(() => thumbCovers(row, professional)).toBe(true)
  expect(await slides()).toBe(1)

  // Searching for one with no Personal resume takes that tag away, which moves Professional over, and
  // clearing the search brings it back. The pill goes with Professional, without sliding.
  const search = page.getByRole("combobox", { name: "Search your resumes" })
  await search.fill("Kestrel")
  await expect(tags).toHaveText(["All 1", "Professional 1"])
  await expect.poll(() => thumbCovers(row, professional)).toBe(true)
  await search.fill("")
  await expect(tags).toHaveText(["All 3", "Personal 1", "Professional 2"])
  await expect.poll(() => thumbCovers(row, professional)).toBe(true)
  expect(await slides()).toBe(1)
  expect(errors).toEqual([])
})

test("a type of your own named all is a tag of its own, apart from All", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada", { resumeTag: "all" }), resume("b", "Grace")])
  const tags = page.getByRole("group", { name: "Show" }).getByRole("button")
  await expect(tags).toHaveText(["All 2", "Professional 1", "all 1"])
  await tags.filter({ hasText: /^all/ }).click()
  await expect(pages(page).getByRole("link")).toHaveText(["Ada"])
  expect(errors).toEqual([])
})

test("typing a type of your own that runs on past one already in use keeps every letter", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada", { resumeTag: "Data roles" })])
  await page.getByRole("main").getByRole("button", { name: "New resume" }).first().click()
  const dialog = page.getByRole("dialog", { name: "New resume" })
  await dialog.getByRole("button", { name: "Your own" }).click()
  const own = dialog.getByLabel("Your own type")
  await expect(own).toBeFocused()
  await own.pressSequentially("Data roles 2")
  await expect(own).toHaveValue("Data roles 2")
  expect(errors).toEqual([])
})

test("a deleted resume leaves the tags' counts at once, while its page flies away", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace", { resumeTag: "personal" }), resume("c", "Kestrel")])
  const tags = page.getByRole("group", { name: "Show" }).getByRole("button")
  await expect(tags).toHaveText(["All 3", "Personal 1", "Professional 2"])
  // Time stands still from here, so the resume that's deleted still keeps its place when the tags are read.
  await page.clock.pauseAt(Date.now() + 2_000)
  await tile(page, "Ada").getByRole("button", { name: "More for “Ada”" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible()
  await expect(tags).toHaveText(["All 2", "Personal 1", "Professional 1"])
  expect(errors).toEqual([])
})

/** Keeps the parts of the list that slide (flight.ts's glideFrom), by what they are, as they start to. */
async function watchGlides(page: Page) {
  await page.evaluate(() => {
    const watched = window as unknown as { glided: string[] }
    watched.glided = []
    const animate = Element.prototype.animate
    Element.prototype.animate = function (this: Element, keyframes, options) {
      const glide = this instanceof HTMLElement ? this.dataset.glide : undefined
      if (glide) watched.glided.push(glide)
      return animate.call(this, keyframes, options)
    }
  })
}
const glided = (page: Page) => page.evaluate(() => (window as unknown as { glided: string[] }).glided.splice(0))

/**
 * Where the copy of a page in flight ends up (flight.ts), and where `to` is:
 * every animation on the page is taken to its end, which lands the copy.
 */
const flightEnd = (page: Page, to: "message" | string) =>
  page.evaluate((to) => {
    const copy = document.querySelector<HTMLElement>("[data-flying-page]")
    if (!copy) return null
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish()
    }
    const target =
      to === "message"
        ? document.querySelector("[data-toast-page]")
        : [...document.querySelectorAll(`[data-glide="${to}"] [data-resume-page]`)].find((page) => page.getClientRects().length > 0)
    const box = (element: Element | null | undefined) => {
      const { left, top, width, height } = element!.getBoundingClientRect()
      return [left, top, width, height].map(Math.round)
    }
    return { copy: box(copy), target: box(target) }
  }, to)

/** How far apart two boxes are, at the most, along any edge, in pixels. */
const apart = (one: number[], other: number[]) => Math.max(...one.map((value, index) => Math.abs(value - other[index])))

for (const view of ["pages", "list"] as const) {
  test(`in the ${view}, a deleted resume's page flies into the Undo message, and Undo flies it back to its place`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace"), resume("c", "Kestrel")])
    if (view === "list") await page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" }).click()
    const ada =
      view === "pages"
        ? pages(page).getByRole("link", { name: "Ada", exact: true })
        : page.getByRole("table").getByRole("link", { name: "Ada", exact: true })
    await expect(ada).toBeVisible()
    await watchGlides(page)

    if (view === "pages") {
      await tile(page, "Ada").getByRole("button", { name: "More for “Ada”" }).click()
      await page.getByRole("menuitem", { name: "Delete" }).click()
    } else {
      await page
        .getByRole("row")
        .filter({ has: page.getByRole("link", { name: "Ada", exact: true }) })
        .getByRole("button", { name: "Delete" })
        .click()
    }
    // It lands on the message's small picture of the resume's page, ...
    const out = await flightEnd(page, "message")
    expect(out).not.toBeNull()
    expect(apart(out!.copy, out!.target)).toBeLessThanOrEqual(1)
    // ... and the resumes after it slide into its place, rather than jump there.
    await expect(ada).toHaveCount(0)
    await expect.poll(() => glided(page)).toEqual(expect.arrayContaining(["b", "c"]))

    // Undo flies it back out of the message to its place, as the others make room, and it has the focus.
    await page.getByRole("button", { name: "Undo" }).click()
    const back = await flightEnd(page, "a")
    expect(back).not.toBeNull()
    expect(apart(back!.copy, back!.target)).toBeLessThanOrEqual(1)
    expect(await glided(page)).toEqual(expect.arrayContaining(["b", "c"]))
    await expect(ada).toBeFocused()
    await expect.poll(() => page.evaluate(() => document.querySelector("[data-flying-page]"))).toBeNull()
    expect(errors).toEqual([])
  })
}

test("a page shows the resume itself, with nothing stamped over it, even one the checker finds nothing to fix in", async ({ page }) => {
  const errors = pageErrors(page)
  const sample = JSON.parse(readFileSync("src/lib/typst/preview-samples/jake.json", "utf8"))
  await dashboardWith(page, [{ ...sample, id: "ready", resumeTitle: "Finished" }])
  await expect(tile(page, "Finished")).toBeVisible()
  // A fixed wait: proving nothing lands on it once the page has settled.
  await page.waitForTimeout(3_000)
  await expect(tile(page, "Finished").getByText(/^Ready/)).toHaveCount(0)
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  expect(errors).toEqual([])
})

test("with no resumes, the page keeps its toolbar and buttons, and the empty pages start one or open a file", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  await expect(page.getByText("No resumes yet.")).toBeVisible()
  // The same page as with resumes, so it doesn't change shape when the first arrives.
  await expect(page.getByRole("combobox", { name: "Search your resumes" })).toBeVisible()
  await expect(page.getByRole("group", { name: "View" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open a file" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Download all" })).toBeDisabled()

  const choosing = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Drop a PDF, Word or JSON file Choose a file" }).click()
  await choosing
  await page.getByRole("button", { name: "New resume" }).first().click()
  await expect(page.getByRole("dialog", { name: "New resume" })).toBeVisible()
  expect(errors).toEqual([])
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("a deleted resume goes at once, and comes back at once", async ({ page }) => {
    const errors = pageErrors(page)
    await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
    await tile(page, "Ada").getByRole("button", { name: "More for “Ada”" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    // Gone at once: nothing flies.
    expect(await pages(page).getByRole("link", { name: "Ada", exact: true }).count()).toBe(0)
    await page.getByRole("button", { name: "Undo" }).click()
    expect(await pages(page).getByRole("link", { name: "Ada", exact: true }).count()).toBe(1)
    expect(errors).toEqual([])
  })

  test("switching to the list shows it at once, with nothing moving", async ({ page }) => {
    const errors = pageErrors(page)
    await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
    await expect(pages(page).getByRole("link")).toHaveText(["Ada", "Grace"])
    await watchTransitions(page)
    const list = page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" })
    await list.press("Enter")
    expect(await page.getByRole("table").getByRole("link", { name: "Ada", exact: true }).count()).toBe(1)
    expect(await page.evaluate(() => (window as unknown as Watched).started)).toBe(0)
    await expect(list).toBeFocused()
    expect(errors).toEqual([])
  })
})
