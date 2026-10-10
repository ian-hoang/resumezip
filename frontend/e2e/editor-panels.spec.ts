import { expect, test, type Locator, type Page } from "@playwright/test"
import { chooseTemplate, pageErrors, seriousAccessibilityProblems, templateShown } from "./helpers"

// From 1280px wide the editor is three panels under a top bar
// (app/create/editor/page.tsx): the sections, Check or Style on the left, the
// form in the middle, and the page on the right with its zoom under it.
// Download PDF is in the top bar.

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
const modes = (page: Page) => page.getByRole("tablist", { name: "Write, check or style" })
const styleTab = (page: Page) => modes(page).getByRole("tab", { name: "Style" })

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`at ${width}px wide, the top bar, the three panels and the zoom each have their own place`, async ({ page }) => {
    const errors = pageErrors(page)
    const preview = await startWriting(page, width, height)

    const top = await boxOf(page.getByRole("banner"))
    const left = await boxOf(page.getByRole("complementary"))
    const form = await boxOf(page.getByRole("main").locator("xpath=.."))
    const right = await boxOf(preview)
    const parts: Record<string, Box> = {
      "the top bar": top,
      "the left panel": left,
      "the form": form,
      "the page": await pageShown(preview),
      "the zoom pill": await boxOf(preview.getByRole("button", { name: "Fit" }).locator("xpath=..")),
    }
    const names = Object.keys(parts)
    for (const [index, a] of names.entries()) {
      for (const b of names.slice(index + 1)) expect(overlap(parts[a], parts[b]), `${a} and ${b} overlap`).toBe(false)
    }

    // Download PDF is at the right of the top bar.
    const button = await boxOf(download(page))
    expect(button.y).toBeGreaterThanOrEqual(top.y)
    expect(button.y + button.height).toBeLessThanOrEqual(top.y + top.height)
    expect(button.x).toBeGreaterThan(top.x + top.width / 2)

    // Three columns side by side, from left to right, as tall as each other under the top bar,
    // with even gaps between them.
    for (const column of [form, right]) {
      expect(Math.abs(column.y - left.y)).toBeLessThan(1)
      expect(Math.abs(column.y + column.height - (left.y + left.height))).toBeLessThan(1)
    }
    const gaps = [left.y - (top.y + top.height), form.x - (left.x + left.width), right.x - (form.x + form.width)]
    expect(gaps[0]).toBeGreaterThan(0)
    for (const gap of gaps) expect(Math.abs(gap - gaps[0])).toBeLessThan(1)
    // The form has room to write in.
    expect(form.width).toBeGreaterThanOrEqual(520)

    // All of it in the window, which doesn't scroll either way.
    for (const [name, box] of Object.entries(parts)) {
      expect(box.x, `${name} is in the window`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width, `${name} is in the window`).toBeLessThanOrEqual(width)
      expect(box.y + box.height, `${name} is in the window`).toBeLessThanOrEqual(height)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height)
    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

    expect(errors).toEqual([])
  })
}

test("the Style tab lists the templates and Fine-tune, beside the form", async ({ page }) => {
  const errors = pageErrors(page)
  const preview = await startWriting(page, 1440, 900)
  const style = page.getByRole("region", { name: "Style" })
  const sections = page.getByRole("navigation", { name: "Sections" })
  // The header's template picker is for narrower screens.
  await expect(page.getByRole("button", { name: /^Template/ })).toBeHidden()
  await expect(style).toBeHidden()

  await styleTab(page).click()
  await expect(styleTab(page)).toHaveAttribute("aria-selected", "true")
  await expect(sections).toBeHidden()
  await expect(style.getByRole("button", { pressed: true })).toHaveText(/^Jake's/)
  await expect(style.getByRole("heading", { name: "Fine-tune" })).toBeVisible()
  // The templates and Fine-tune use the panel's whole width, as the section list does.
  const panel = await boxOf(style)
  for (const part of [style.getByRole("button", { pressed: true }), style.getByRole("slider", { name: /Text size/ })]) {
    expect((await boxOf(part)).width).toBeGreaterThan(panel.width - 40)
  }
  await style.getByRole("button", { name: "Harvard", exact: true }).click()
  await expect(style.getByRole("button", { pressed: true })).toHaveText(/^Harvard/)
  // Harvard prints the name in capitals.
  await expect(preview.getByText("ADA LOVELACE", { exact: true })).toBeAttached()
  await expect(templateShown(page)).toContainText("Harvard")

  // The form stays beside it, to keep writing in.
  await page.getByLabel("Full name").fill("Ada King")
  await expect(preview.getByText("ADA KING", { exact: true })).toBeAttached()

  // It stays as the window narrows to 1280px.
  await page.setViewportSize({ width: 1280, height: 800 })
  await chooseTemplate(page, "Blueprint")
  await expect(style.getByRole("button", { pressed: true })).toHaveText(/^Blueprint/)

  // The arrow keys go round the three tabs.
  await styleTab(page).focus()
  await page.keyboard.press("ArrowRight")
  await expect(modes(page).getByRole("tab", { name: "Write" })).toBeFocused()
  await expect(sections).toBeVisible()
  await expect(style).toBeHidden()
  await page.keyboard.press("ArrowLeft")
  await expect(styleTab(page)).toBeFocused()
  await expect(style).toBeVisible()

  expect(errors).toEqual([])
})

test("Download PDF reads back the paper and how many pages the PDF has", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  const button = download(page)
  await expect(button).toContainText(/Letter · 1 page/i)
  await expect(button).toHaveAccessibleDescription("US Letter, 1 page")

  // A4, from Fine-tune.
  await styleTab(page).click()
  await page.getByRole("region", { name: "Style" }).getByText("A4", { exact: true }).click()
  await expect(button).toContainText(/A4 · 1 page/i)
  await expect(button).toHaveAccessibleDescription("A4, 1 page")

  expect(errors).toEqual([])
})

test("Fit shows the whole page, from its top", async ({ page }) => {
  const errors = pageErrors(page)
  // Wide enough for the page to be taller than the room for it at first.
  const preview = await startWriting(page, 1440, 800)
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

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("Style takes the form's place, and Write brings the form back", async ({ page }) => {
    const errors = pageErrors(page)
    await page.goto("/")
    await page.getByRole("link", { name: "Start writing" }).first().click()
    await page.getByLabel("Full name").fill("Ada Lovelace")
    const style = page.getByRole("region", { name: "Style" })

    await styleTab(page).tap()
    await expect(style).toBeVisible()
    await expect(page.getByLabel("Full name")).toBeHidden()
    await style.getByRole("button", { name: "Harvard", exact: true }).tap()
    // The header's picker says so too.
    await expect(page.getByRole("button", { name: /^Template/ })).toContainText("Harvard")
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await modes(page).getByRole("tab", { name: "Write" }).tap()
    await expect(style).toBeHidden()
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")

    // Let the preview finish, so the compiler's download isn't cut off as the page closes.
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Preview" }).tap()
    await expect(page.getByRole("region", { name: "Live preview" }).getByText("ADA LOVELACE", { exact: true })).toBeAttached()
    expect(errors).toEqual([])
  })
})
