import { expect, test, type Locator, type Page } from "./test"
import { chooseTemplate, newResume, pageErrors, preview, seriousAccessibilityProblems, templateShown } from "./helpers"

// From 1280px wide the editor is three columns on one sheet, under a top bar
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
  await newResume(page, { name: "Ada Lovelace" })
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
const modes = (page: Page) => page.getByRole("tablist", { name: /check or style$/i })
const styleTab = (page: Page) => modes(page).getByRole("tab", { name: "Style" })

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`at ${width}px wide, the top bar, the three panels and the zoom each have their own place`, async ({ page }) => {
    const errors = pageErrors(page)
    await startWriting(page, width, height)

    const top = await boxOf(page.getByRole("banner"))
    const left = await boxOf(page.getByRole("complementary"))
    const form = await boxOf(page.getByRole("main").locator("xpath=.."))
    const right = await boxOf(preview(page))
    const parts: Record<string, Box> = {
      "the top bar": top,
      "the left panel": left,
      "the form": form,
      "the page": await pageShown(preview(page)),
      "the zoom pill": await boxOf(preview(page).getByRole("button", { name: "Fit" }).locator("xpath=..")),
    }
    // The zoom pill floats over the foot of the page, so only it may be over another part.
    const names = Object.keys(parts)
    for (const [index, a] of names.entries()) {
      for (const b of names.slice(index + 1)) {
        if (a === "the page" && b === "the zoom pill") continue
        expect(overlap(parts[a], parts[b]), `${a} and ${b} overlap`).toBe(false)
      }
    }
    const pill = parts["the zoom pill"]
    expect(overlap(pill, right), "the zoom pill is on the preview").toBe(true)
    expect(right.y + right.height - (pill.y + pill.height)).toBeLessThan(40)

    // Download PDF is at the right of the top bar.
    const button = await boxOf(download(page))
    expect(button.y).toBeGreaterThanOrEqual(top.y)
    expect(button.y + button.height).toBeLessThanOrEqual(top.y + top.height)
    expect(button.x).toBeGreaterThan(top.x + top.width / 2)

    // Three columns side by side, from left to right, as tall as each other under the top bar,
    // each starting where the one before it ends: they're divided by lines, not gaps.
    for (const column of [form, right]) {
      expect(Math.abs(column.y - left.y)).toBeLessThan(1)
      expect(Math.abs(column.y + column.height - (left.y + left.height))).toBeLessThan(1)
    }
    for (const gap of [left.y - (top.y + top.height), form.x - (left.x + left.width), right.x - (form.x + form.width)]) {
      expect(Math.abs(gap)).toBeLessThan(1)
    }
    // The form has room to write in.
    expect(form.width).toBeGreaterThanOrEqual(440)

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

test("on a wide screen Style takes the form's place, beside the rail, and the header's Template button picks the template", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  const style = page.getByRole("region", { name: "Style" })
  const sections = page.getByRole("navigation", { name: "Sections" })
  const name = page.getByLabel("Full name")
  await expect(style).toBeHidden()

  await styleTab(page).click()
  await expect(styleTab(page)).toHaveAttribute("aria-selected", "true")
  // Titled, as the rail names it only in a tip.
  await expect(page.getByRole("tabpanel", { name: "Style" }).getByRole("heading", { name: "Style", exact: true })).toBeVisible()
  // In the form's place, and the rail's sections stay at hand.
  await expect(name).toBeHidden()
  await expect(sections).toBeVisible()
  // Fine-tune uses the panel's whole width.
  expect((await boxOf(style.getByRole("slider", { name: /Text size/ }))).width).toBeGreaterThan((await boxOf(style)).width - 40)

  await chooseTemplate(page, "Harvard")
  // Harvard prints the name in capitals.
  await expect(preview(page).getByText("ADA LOVELACE", { exact: true })).toBeAttached()
  await expect(templateShown(page)).toContainText("Harvard")

  // The arrow keys go round the rail's tabs, up and down.
  await styleTab(page).focus()
  await page.keyboard.press("ArrowDown")
  await expect(modes(page).getByRole("tab", { name: "ATS checks" })).toBeFocused()
  await expect(style).toBeHidden()
  await page.keyboard.press("ArrowUp")
  await expect(styleTab(page)).toBeFocused()
  await expect(style).toBeVisible()
  // Choosing Style again goes back to writing.
  await styleTab(page).click()
  await expect(styleTab(page)).toHaveAttribute("aria-selected", "false")
  await expect(name).toBeVisible()

  expect(errors).toEqual([])
})

test("each Fine-tune slider has a mark for the template's own setting, which puts back only that slider", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  await styleTab(page).click()
  const margins = page.getByRole("slider", { name: "Margins" })
  const gap = page.getByRole("slider", { name: "Space between sections" })
  const resetMargins = page.getByRole("button", { name: /^Reset margins/ })
  const resetGap = page.getByRole("button", { name: /^Reset space between sections/ })
  // Nothing to put back yet.
  await expect(resetMargins).toBeDisabled()
  await expect(resetGap).toBeDisabled()

  await margins.focus()
  await page.keyboard.press("ArrowRight")
  await gap.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(resetMargins).toBeEnabled()
  await expect(resetGap).toBeEnabled()

  await resetMargins.click()
  await expect(resetMargins).toBeDisabled()
  await expect(margins).toHaveJSProperty("value", "1")
  // The other one is as it was set.
  await expect(resetGap).toBeEnabled()
  await expect(gap).toHaveJSProperty("value", "0.95")

  expect(errors).toEqual([])
})

test("Keep it to one page moves the sliders it tightens, and says which", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  const words = "Built and shipped distributed systems that moved millions of events a day while mentoring four engineers. "
  await page.getByLabel("Summary").fill(words.repeat(60))
  await expect(preview(page).locator(".react-pdf__Page")).toHaveCount(2)

  await styleTab(page).click()
  const size = page.getByRole("slider", { name: "Text size" })
  const switchOn = page.getByRole("switch", { name: "Keep it to one page" })
  await expect(size).toHaveJSProperty("value", "1")
  await switchOn.click()
  await expect(preview(page).locator(".react-pdf__Page")).toHaveCount(1)
  await expect(page.getByRole("status").filter({ hasText: /^Tightened / })).toBeVisible()
  // What it tightened shows on the sliders, and the saved settings aren't changed.
  await expect(page.getByRole("slider", { name: "Space between sections" })).not.toHaveJSProperty("value", "1")
  await expect(page.getByRole("button", { name: /^Reset space between sections/ })).toBeDisabled()

  await switchOn.click()
  await expect(page.getByRole("slider", { name: "Space between sections" })).toHaveJSProperty("value", "1")
  await expect(size).toHaveJSProperty("value", "1")

  expect(errors).toEqual([])
})

test("A4, chosen in the Style tab, prints the page on A4, and Download PDF still says only what it does", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  const button = download(page)
  // The first page's height over its width: 11 / 8.5 on Letter, 297 / 210 on A4. A drawing
  // replaced as it's read, as the page is drawn again, has no box: NaN, and the poll reads again.
  const shape = async () => {
    const box = await preview(page).locator(".react-pdf__Page__canvas").first().boundingBox()
    return box ? box.height / box.width : NaN
  }
  await expect.poll(shape).toBeCloseTo(11 / 8.5, 1)
  await expect(button).toHaveText("Download PDF")

  await styleTab(page).click()
  await page.getByRole("region", { name: "Style" }).getByText("A4", { exact: true }).click()
  await expect.poll(shape).toBeCloseTo(297 / 210, 1)
  await expect(button).toHaveText("Download PDF")

  expect(errors).toEqual([])
})

// On a short, wide window the whole page needs less than the 50% the zoom buttons stop at.
for (const height of [800, 400]) {
  test(`Fit shows the whole page, from its top, ${height}px tall`, async ({ page }) => {
    const errors = pageErrors(page)
    // Wide enough for the page to be taller than the room for it at first.
    await startWriting(page, 1440, height)
    // At first the page fills the canvas's width, taller than what shows of it.
    const panel = preview(page).locator("[tabindex='0']").first()
    // The first page on screen: a new drawing of it waits out of sight until it's ready.
    const firstPage = () =>
      preview(page).evaluate((region) => {
        const canvas = [...region.querySelectorAll("canvas")].find((canvas) => getComputedStyle(canvas).visibility === "visible")
        return canvas ? canvas.getBoundingClientRect().toJSON() : null
      })
    expect((await firstPage())!.height).toBeGreaterThan((await boxOf(panel)).height)

    await preview(page).getByRole("button", { name: "Fit" }).click()
    const zoom = preview(page).getByRole("button", { name: /^\d+%$/ })
    await expect(zoom).not.toHaveText("100%")
    await expect
      .poll(async () => {
        const [shown, room] = [await firstPage(), await boxOf(panel)]
        return !!shown && shown.y >= room.y && shown.y + shown.height <= room.y + room.height
      })
      .toBe(true)

    if (height === 400) {
      // Below the buttons' least, where Zoom out has nothing further to go.
      expect(parseInt((await zoom.textContent())!)).toBeLessThan(50)
      await expect(preview(page).getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-disabled", "true")
    }

    expect(errors).toEqual([])
  })
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("Style takes the form's place, the Template button still picks the template, and Write brings the form back", async ({ page }) => {
    const errors = pageErrors(page)
    await newResume(page)
    await page.getByLabel("Full name").fill("Ada Lovelace")
    const style = page.getByRole("region", { name: "Style" })

    await styleTab(page).tap()
    await expect(style).toBeVisible()
    await expect(page.getByLabel("Full name")).toBeHidden()
    await page.getByRole("button", { name: /^Template/ }).tap()
    await page.getByRole("dialog", { name: "Choose a template" }).getByRole("button", { name: "Harvard", exact: true }).tap()
    await expect(page.getByRole("button", { name: /^Template/ })).toContainText("Harvard")
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await modes(page).getByRole("tab", { name: "Write" }).tap()
    await expect(style).toBeHidden()
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")

    // Let the preview finish, so the compiler's download isn't cut off as the page closes.
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Preview" }).tap()
    await expect(preview(page).getByText("ADA LOVELACE", { exact: true })).toBeAttached()
    expect(errors).toEqual([])
  })

  test("the Edit / Preview switch steps aside while the keyboard is up, in the summary's box too", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Checked in Chromium, whose touch emulation gives the page a phone's coarse pointer")
    const errors = pageErrors(page)
    await newResume(page)
    const view = page.getByRole("group", { name: "View" })
    const name = page.getByLabel("Full name")
    const summary = page.getByRole("textbox", { name: "Summary", exact: true })
    await expect(view).toBeInViewport()
    await name.focus()
    await expect(view).not.toBeInViewport()
    await name.blur()
    await expect(view).toBeInViewport()
    // The summary is typed in a box that shows bold and italic words, not a text box: a keyboard comes up for it all the same.
    await summary.focus()
    await expect(view).not.toBeInViewport()
    await summary.blur()
    await expect(view).toBeInViewport()
    expect(errors).toEqual([])
  })
})
