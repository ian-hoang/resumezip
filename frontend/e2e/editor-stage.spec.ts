import { expect, test, type Locator, type Page } from "@playwright/test"
import { chooseTemplate, pageErrors, seriousAccessibilityProblems, templateShown } from "./helpers"

// From 1280px wide the editor is a stage (app/create/editor/page.tsx): the
// live page in the middle, the writing panel and the Style panel floating
// either side of it, a zoom bar under the page, and Download PDF in the corner.

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Starts a resume with a name, in a `width` × `height` window, and waits for its preview. */
async function startWriting(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByText(/Ada Lovelace/i).first()).toBeVisible()
  return preview
}

const boxOf = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!

/** The part of the first page that shows: its canvas, cut to the panel it scrolls in. */
async function pageShown(preview: Locator): Promise<Box> {
  const page = await boxOf(preview.locator(".react-pdf__Page__canvas").first())
  const panel = await boxOf(preview.locator("[tabindex='0']").first())
  const x = Math.max(page.x, panel.x)
  const y = Math.max(page.y, panel.y)
  return {
    x,
    y,
    width: Math.min(page.x + page.width, panel.x + panel.width) - x,
    height: Math.min(page.y + page.height, panel.y + panel.height) - y,
  }
}

const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

const download = (page: Page) => page.getByRole("button", { name: "Download PDF" })

for (const [width, height, folded] of [
  [1440, 900, false],
  [1280, 800, true],
] as const) {
  test(`at ${width}px wide, the page, the panels, the zoom and Download PDF each have their own place`, async ({ page }) => {
    const errors = pageErrors(page)
    const preview = await startWriting(page, width, height)

    // Below 1440px the Style panel folds behind a button, so the page keeps its room.
    const style = folded ? page.getByRole("button", { name: /^Style/ }) : page.getByRole("region", { name: "Style" })
    await expect(style).toBeVisible()
    const parts: Record<string, Box> = {
      "the writing panel": await boxOf(page.getByRole("main").locator("xpath=..")),
      "the page": await pageShown(preview),
      "the zoom bar": await boxOf(preview.getByRole("button", { name: "Fit" }).locator("xpath=..")),
      "Download PDF": await boxOf(download(page).locator("xpath=..")),
      [folded ? "the Style button" : "the Style panel"]: await boxOf(style),
    }
    const names = Object.keys(parts)
    for (const [index, a] of names.entries()) {
      for (const b of names.slice(index + 1)) expect(overlap(parts[a], parts[b]), `${a} and ${b} overlap`).toBe(false)
    }
    // All of it in the window, which doesn't scroll sideways.
    for (const [name, box] of Object.entries(parts)) {
      expect(box.x, `${name} is in the window`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width, `${name} is in the window`).toBeLessThanOrEqual(width)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

    expect(errors).toEqual([])
  })
}

test("the Style panel lists the templates, and below 1440px opens from its button and folds away again", async ({ page }) => {
  const errors = pageErrors(page)
  const preview = await startWriting(page, 1440, 900)
  const style = page.getByRole("region", { name: "Style" })
  await expect(style.getByRole("button", { pressed: true })).toHaveText(/^Jake's/)
  await style.getByRole("button", { name: "Harvard", exact: true }).click()
  await expect(style.getByRole("button", { pressed: true })).toHaveText(/^Harvard/)
  // Harvard prints the name in capitals.
  await expect(preview.getByText("ADA LOVELACE", { exact: true })).toBeAttached()

  await page.setViewportSize({ width: 1280, height: 800 })
  const fold = page.getByRole("button", { name: /^Style/ })
  await expect(style).toBeHidden()
  await expect(fold).toHaveAttribute("aria-expanded", "false")
  await expect(templateShown(page)).toContainText("Harvard")
  await fold.click()
  await expect(style).toBeVisible()
  await chooseTemplate(page, "Blueprint")
  await expect(style.getByRole("button", { pressed: true })).toHaveText(/^Blueprint/)
  // Escape folds it, back on its button; so does a click elsewhere.
  await page.keyboard.press("Escape")
  await expect(style).toBeHidden()
  await expect(fold).toBeFocused()
  await fold.click()
  await expect(style).toBeVisible()
  await page.getByLabel("Full name").click()
  await expect(style).toBeHidden()
  await expect(page.getByLabel("Full name")).toBeFocused()

  expect(errors).toEqual([])
})

test("Download PDF reads back the paper and how many pages the PDF has", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  const button = download(page)
  await expect(button).toContainText(/Letter · 1 page/i)
  await expect(button).toHaveAccessibleDescription("US Letter, 1 page")

  // A4, from Fine-tune.
  await page.getByRole("region", { name: "Style" }).getByText("A4", { exact: true }).click()
  await expect(button).toContainText(/A4 · 1 page/i)
  await expect(button).toHaveAccessibleDescription("A4, 1 page")

  expect(errors).toEqual([])
})

test("Fit shows the whole page, from its top", async ({ page }) => {
  const errors = pageErrors(page)
  const preview = await startWriting(page, 1280, 720)
  // At first the page fills the canvas's width, taller than what shows of it.
  const panel = preview.locator("[tabindex='0']").first()
  // The first page on screen: a new drawing of it waits out of sight until it's ready.
  const firstPage = () =>
    preview.evaluate((region) => {
      const canvas = [...region.querySelectorAll("canvas")].find((canvas) => getComputedStyle(canvas).visibility === "visible")
      return canvas ? canvas.getBoundingClientRect().toJSON() : null
    })
  expect((await firstPage())!.height).toBeGreaterThan((await boxOf(panel)).height)

  await preview.getByRole("button", { name: "Fit" }).click()
  await expect(preview.getByRole("button", { name: /^\d+%$/ })).not.toHaveText("100%")
  await expect
    .poll(async () => {
      const [shown, room] = [await firstPage(), await boxOf(panel)]
      return !!shown && shown.y >= room.y && shown.y + shown.height <= room.y + room.height
    })
    .toBe(true)

  expect(errors).toEqual([])
})
