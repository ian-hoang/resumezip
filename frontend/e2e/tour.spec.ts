import { expect, test, type Page } from "@playwright/test"
import { TOUR_SEEN_KEY } from "../src/components/editor/tourSeen"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// The editor's first visit opens a short tour (components/editor/Tour.tsx).
// The other tests' browsers have seen it (playwright.config.ts); these start
// as a new visitor's.
test.use({ storageState: { cookies: [], origins: [] } })

async function startWriting(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
}

/**
 * The preview, waited for before a test ends, so the PDF compiler's download
 * isn't cut off. On phones it's drawn behind the Edit / Preview switch.
 */
const previewShown = (page: Page) =>
  expect(page.getByRole("region", { name: "Live preview", includeHidden: true }).locator(".react-pdf__Page__canvas").first()).toBeAttached()

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test(`at ${width}px wide, the first visit opens a tour of four steps, and only the first`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.setViewportSize({ width, height })
    await startWriting(page)
    const tour = page.getByRole("dialog")
    // Its steps go across the editor as it reads, left to right.
    await expect(tour).toHaveAccessibleName("Write, check, then style.")
    await expect(tour).toContainText("Write, Check, Style · 1 of 4")
    // The keyboard starts on the way on.
    await expect(tour.getByRole("button", { name: "Next: saving" })).toBeFocused()
    const box = (await tour.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.y + box.height).toBeLessThanOrEqual(height)
    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

    // On with its button or the arrow, and back.
    await tour.getByRole("button", { name: "Next: saving" }).click()
    await expect(tour).toHaveAccessibleName("It saves as you type, in this browser.")
    await tour.getByRole("button", { name: "Next step" }).click()
    await expect(tour).toHaveAccessibleName("The page is the real PDF.")
    await tour.getByRole("button", { name: "Previous step" }).click()
    await expect(tour).toHaveAccessibleName("It saves as you type, in this browser.")
    await tour.getByRole("button", { name: "Next step" }).click()
    await tour.getByRole("button", { name: "Next: your save file" }).click()
    await expect(tour).toHaveAccessibleName("The PDF is your save file.")
    await expect(tour).toContainText("Your save file · 4 of 4")

    // The last step's button closes it, and the editor is there to use.
    await tour.getByRole("button", { name: "Start writing" }).click()
    await expect(tour).toBeHidden()
    await page.getByLabel("Full name").fill("Ada Lovelace")
    await previewShown(page)

    // It doesn't come back. A fixed wait, to show nothing opens.
    await page.reload()
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")
    await page.waitForTimeout(1_000)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await previewShown(page)
    expect(errors).toEqual([])
  })
}

test("the tour keeps its size from step to step, however long a step's words are", async ({ page }) => {
  const errors = pageErrors(page)
  // Narrow, where the words wrap the most.
  await page.setViewportSize({ width: 390, height: 844 })
  await startWriting(page)
  const tour = page.getByRole("dialog")
  await expect(tour).toBeVisible()
  const heights: number[] = []
  for (let step = 0; step < 4; step++) {
    await expect(tour).toContainText(`${step + 1} of 4`)
    // Its laid-out height, which the opening grow doesn't change.
    heights.push(await tour.evaluate((dialog) => (dialog as HTMLElement).offsetHeight))
    if (step < 3) await tour.getByRole("button", { name: "Next step" }).click()
  }
  expect(new Set(heights).size).toBe(1)
  await previewShown(page)
  expect(errors).toEqual([])
})

test("Escape closes the tour, and so does Close, for good", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  const tour = page.getByRole("dialog")
  await expect(tour).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(tour).toBeHidden()
  await previewShown(page)
  await page.reload()
  await expect(page.getByLabel("Full name")).toBeVisible()
  await page.waitForTimeout(1_000)
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // In a browser that hasn't seen it, Close works the same.
  await page.evaluate((key) => localStorage.removeItem(key), TOUR_SEEN_KEY)
  await page.reload()
  await expect(tour).toBeVisible()
  await tour.getByRole("button", { name: "Close the tour" }).click()
  await expect(tour).toBeHidden()
  await previewShown(page)
  expect(errors).toEqual([])
})

test("Take the tour, in the editor's header, opens it again after it's been seen", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  const tour = page.getByRole("dialog")
  await page.keyboard.press("Escape")
  await expect(tour).toBeHidden()

  await page.getByRole("button", { name: "Take the tour" }).click()
  await expect(tour).toBeVisible()
  await expect(tour.getByRole("button", { name: "Close the tour" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(tour).toBeHidden()
  await previewShown(page)
  expect(errors).toEqual([])
})

test("a tour left open, by a reload or a step away, doesn't show again on the next visit", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  await expect(page.getByRole("dialog")).toBeVisible()
  await previewShown(page)
  await page.reload()
  await expect(page.getByLabel("Full name")).toBeVisible()
  // A fixed wait: proving nothing opens.
  await page.waitForTimeout(1_000)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await previewShown(page)
  expect(errors).toEqual([])
})

test("where the browser won't let the site save, the tour doesn't show, as it would on every visit", async ({ page }) => {
  const errors = pageErrors(page)
  // As in Chrome set to "Don't allow sites to save data on your device".
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Access is denied for this document.", "SecurityError")
      },
    })
  })
  await startWriting(page)
  await expect(page.getByLabel("Full name")).toBeVisible()
  // A fixed wait, to show nothing opens.
  await page.waitForTimeout(1_000)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await previewShown(page)
  expect(errors).toEqual([])
})
