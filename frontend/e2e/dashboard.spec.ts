import { expect, test, type Locator, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const resume = (id: string, resumeTitle: string) => ({
  id,
  resumeTitle,
  resumeTag: "professional",
  updatedAt: "2026-10-06T12:00:00.000Z",
  selectedTemplate: "jake",
  profileSection: { fullName: "Ada Lovelace" },
})

/** Opens the dashboard with these resumes saved in the browser, as an earlier visit would have. */
async function dashboardWith(page: Page, resumes: (ReturnType<typeof resume> & { headings?: object })[]) {
  await page.addInitScript((resumes) => {
    for (const resume of resumes) {
      const key = `resume:${resume.id}`
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(resume))
    }
  }, resumes)
  await page.goto("/create/dashboard")
}

/** Whether an element's text is cut short, across or down. Layout is in fractions of a pixel, so allow one. */
const cutShort = (element: Locator) =>
  element.evaluate((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)

/** The dashboard's cards, one per resume. */
const cards = (page: Page) => page.getByRole("list", { name: "Resumes" })
/** The card of the resume with this name. */
const card = (page: Page, name: string) =>
  cards(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) })

test("a long resume name is cut short on its card, and every card's buttons stay on screen", async ({ page }) => {
  const errors = pageErrors(page)
  // Names far too long for a card, with and without spaces.
  const unbroken = `Software_Engineer_Resume_${Array.from({ length: 110 }, (_, index) => index).join("_")}`
  const spaced = Array.from({ length: 12 }, (_, index) => `Senior Staff Engineer ${index}`).join(" ")
  expect(unbroken.length).toBeGreaterThan(300)
  await page.setViewportSize({ width: 1280, height: 800 })
  await dashboardWith(page, [resume("a", unbroken), resume("b", spaced), resume("c", "Short one")])

  await expect(cards(page).getByRole("listitem")).toHaveCount(3)
  // Nothing's off to the side, and every card's last button ends inside its
  // card (allowing a pixel, as layout is in fractions of one).
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  for (const item of await cards(page).getByRole("listitem").all()) {
    const shown = (await item.getByRole("button", { name: "Delete" }).boundingBox())!
    const box = (await item.boundingBox())!
    expect(shown.x + shown.width).toBeLessThanOrEqual(box.x + box.width + 1)
  }

  // Each long name is cut short after two lines. Its link still has it in
  // full, for screen readers, and shows it on hover.
  for (const name of [unbroken, spaced]) {
    const link = cards(page).getByRole("link", { name, exact: true })
    await expect(link).toHaveAttribute("title", name)
    expect(await cutShort(link)).toBe(true)
  }
  expect(await cutShort(cards(page).getByRole("link", { name: "Short one" }))).toBe(false)

  // Asked whether to delete it, the whole name fits the dialog.
  await card(page, unbroken).getByRole("button", { name: "Delete" }).click()
  const dialog = page.getByRole("dialog", { name: "Delete this resume?" })
  await expect(dialog).toContainText(unbroken)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("on a tablet, two resumes whose names differ only by a number both show it", async ({ page }) => {
  const errors = pageErrors(page)
  // Giving a resume a name that's taken adds a number, as "… 2", which only tells them apart if it shows.
  const name = "Product Manager Resume – Stripe"
  await page.setViewportSize({ width: 834, height: 1112 })
  await dashboardWith(page, [resume("a", name), resume("b", `${name} 2`)])

  for (const title of [name, `${name} 2`]) expect(await cutShort(cards(page).getByRole("link", { name: title, exact: true }))).toBe(false)
  expect(errors).toEqual([])
})

test("each card shows its resume's first page, drawn in the browser", async ({ page }) => {
  const errors = pageErrors(page)
  await dashboardWith(page, [resume("a", "Ada")])
  // A picture made here from the resume, rather than the template's sample.
  await expect(card(page, "Ada").locator("[data-page] img")).toHaveAttribute("src", /^blob:/)
  expect(errors).toEqual([])
})

test("the cards pass accessibility checks", async ({ page }) => {
  await dashboardWith(page, [resume("a", "Ada"), resume("b", "Grace")])
  await expect(card(page, "Grace").locator("[data-page] img")).toHaveAttribute("src", /^blob:/)
  expect(await seriousAccessibilityProblems(page)).toEqual([])
})

test("for visitors saving data, a card shows its template's sample instead of drawing the resume", async ({ page }) => {
  const errors = pageErrors(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true, effectiveType: "4g" } })
  })
  await dashboardWith(page, [resume("a", "Ada")])
  await expect(card(page, "Ada").locator("[data-page] img")).toHaveAttribute("src", /previews%2Fjake/)
  expect(errors).toEqual([])
})

test("an empty dashboard has a blank page to start a resume, and one to open a file", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  await expect(page.getByText("No resumes yet.")).toBeVisible()

  const newResume = page.getByRole("main").getByRole("button", { name: /^New resume/ })
  await newResume.click()
  const dialog = page.getByRole("dialog", { name: "New resume" })
  await expect(dialog.getByLabel("Name")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(newResume).toBeFocused()

  const choosing = page.waitForEvent("filechooser")
  await page
    .getByRole("main")
    .getByRole("button", { name: /^Open a file/ })
    .click()
  expect((await choosing).isMultiple()).toBe(false)
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

for (const [layout, width] of [
  ["phone", 390],
  ["wide screen", 1280],
] as const) {
  test(`on a ${layout}, a resume can be duplicated and renamed from the list`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.setViewportSize({ width, height: 900 })
    await dashboardWith(page, [{ ...resume("a", "Ada"), headings: { skillsSection: "Toolbox" } }, resume("b", "Grace")])
    const list = cards(page)
    const row = (name: string) => card(page, name)

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
