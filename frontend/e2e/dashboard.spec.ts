import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

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

test("Start writing on the dashboard opens the New resume dialog", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Short one")])

  const startWriting = page.getByRole("banner").getByRole("button", { name: "Start writing" })
  const dialog = page.getByRole("dialog", { name: "New resume" })
  await startWriting.press("Enter")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel("Name")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  // The same from the phone's menu, which shuts as the dialog opens, and gets
  // the focus back once it closes. It starts a resume as the dashboard's own New resume does.
  await page.setViewportSize({ width: 390, height: 844 })
  const menuButton = page.getByRole("button", { name: "Open menu" })
  await menuButton.press("Enter")
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Start writing" }).press("Enter")
  await expect(dialog).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(menuButton).toBeFocused()
  await menuButton.press("Enter")
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Start writing" }).press("Enter")
  await dialog.getByLabel("Name").fill("From the header")
  await dialog.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  expect(errors).toEqual([])
})

test("closing a dialog puts focus back on what opened it, however it's closed", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Short one")])
  const newResume = page.getByRole("main").getByRole("button", { name: "New resume" })
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

test("Tab stays inside an open dialog, going round from its last control to its first", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Short one")])
  await page.getByRole("main").getByRole("button", { name: "New resume" }).click()
  const dialog = page.getByRole("dialog", { name: "New resume" })
  const name = dialog.getByLabel("Name")
  await expect(name).toBeFocused()

  await page.keyboard.press("Shift+Tab")
  await expect(dialog.getByRole("button", { name: "Create" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(name).toBeFocused()
  // Through the type's choices and Cancel, and round again.
  await page.keyboard.press("Tab")
  await expect(dialog.getByRole("radio", { name: "Personal" })).toBeFocused()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await expect(name).toBeFocused()
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
    await expect(page.getByText(/^\d+ resumes?\W+stored in this browser$/i)).toHaveText(/^2 resumes/i)
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

test("a deleted resume leaves the tags' counts at once, while its page crumples away", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace", { resumeTag: "personal" }), resume("c", "Kestrel")])
  const tags = page.getByRole("group", { name: "Show" }).getByRole("button")
  await expect(tags).toHaveText(["All 3", "Personal 1", "Professional 2"])
  // Time stands still from here, so the page that's deleted is still crumpling when the tags are read.
  await page.clock.pauseAt(Date.now() + 2_000)
  await tile(page, "Ada").getByRole("button", { name: "More for “Ada”" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible()
  await expect(tags).toHaveText(["All 2", "Personal 1", "Professional 1"])
  expect(errors).toEqual([])
})

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

test("with no resumes, the empty pages start one or open a file", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  await expect(page.getByText("No resumes yet.")).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Search your resumes" })).toHaveCount(0)

  const choosing = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Drop a PDF or Docx file Choose a file" }).click()
  await choosing
  await page.getByRole("button", { name: "New resume" }).click()
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
    // Gone at once: nothing is left on the page to crumple.
    expect(await pages(page).getByRole("link", { name: "Ada", exact: true }).count()).toBe(0)
    await page.getByRole("button", { name: "Undo" }).click()
    expect(await pages(page).getByRole("link", { name: "Ada", exact: true }).count()).toBe(1)
    expect(errors).toEqual([])
  })
})
