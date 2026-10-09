import { expect, test, type Locator, type Page } from "@playwright/test"
import { pageErrors } from "./helpers"

declare global {
  interface Window {
    /** How many resumes the page has sent to the compiler, counted by a test. */
    compiles?: number
    /** How many pdf.js workers the page has started, counted by a test. */
    pdfWorkers?: number
    /** Frames since a test started counting them, and how many showed no finished page. */
    painted?: { frames: number; blank: number }
  }
}

// The preview is drawn on a canvas, with an invisible copy of its text laid
// over it so it can be selected (components/editor/PdfPreview.tsx).

/** Selects the preview's text from its first line through `last`. */
async function selectThrough(last: Locator) {
  await last.evaluate((span) => {
    const spans = span.closest(".textLayer")!.querySelectorAll("span[role=presentation]")
    const range = document.createRange()
    range.setStartBefore(spans[0])
    range.setEndAfter(span)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
  })
}

const alpha = (color: string) => {
  const parts = color.match(/[\d.]+/g)?.map(Number) ?? []
  return parts.length === 4 ? parts[3] : 1
}

test("selecting and copying text in the preview", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Location").fill("Effingham, Illinois")
  await page.getByLabel("Email").fill("ada@example.com")

  const preview = page.getByRole("region", { name: "Live preview" })
  const email = preview.locator(".textLayer span[role=presentation]", { hasText: "ada@example.com" })
  await expect(email).toBeVisible()
  await selectThrough(email)

  // Selected text stays invisible and the highlight lets the page show
  // through, so it keeps the resume's own font instead of the plain one.
  const selection = await email.evaluate((span) => {
    const style = getComputedStyle(span, "::selection")
    return { color: style.color, background: style.backgroundColor }
  })
  expect(alpha(selection.color)).toBe(0)
  expect(alpha(selection.background)).toBeLessThan(1)

  // Copying gives plain text only, spelled as typed.
  const copied = await email.evaluate((span) => {
    const clipboardData = new DataTransfer()
    const event = new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true })
    span.dispatchEvent(event)
    return { types: [...clipboardData.types], text: clipboardData.getData("text/plain"), handled: event.defaultPrevented }
  })
  expect(copied.handled).toBe(true)
  expect(copied.types).toEqual(["text/plain"])
  expect(copied.text).toMatch(/Ada Lovelace/i)
  expect(copied.text).toContain("Effingham, Illinois")
  expect(copied.text).toContain("ada@example.com")

  expect(errors).toEqual([])
})

test("renaming doesn't rebuild the preview, and fast typing ends on the latest text", async ({ page }) => {
  const errors = pageErrors(page)
  await page.addInitScript(() => {
    window.compiles = 0
    const send = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message: any, options?: any) {
      if (message?.template !== undefined) window.compiles = (window.compiles ?? 0) + 1
      return send.call(this, message, options)
    }
  })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByText(/Ada Lovelace/i).first()).toBeVisible()

  // The resume's name isn't printed, so renaming compiles nothing.
  const compiles = await page.evaluate(() => window.compiles)
  await page.getByLabel("Resume name").fill("Ada's resume")
  await page.waitForTimeout(1_000)
  expect(await page.evaluate(() => window.compiles)).toBe(compiles)

  // Typing quickly ends on what was typed last.
  await page.getByLabel("Email").pressSequentially("ada@example.com", { delay: 20 })
  await expect(preview.getByText("ada@example.com").first()).toBeVisible()

  expect(errors).toEqual([])
})

test("what a change prints lights up on the preview for a moment", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Location").fill("Effingham, Illinois")
  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByText("Effingham, Illinois").first()).toBeVisible()

  await page.getByLabel("Location").fill("London, England")
  const changed = preview.getByText("London, England").first()
  const lit = async () => alpha(await changed.evaluate((span) => getComputedStyle(span).backgroundColor))
  await expect(changed).toHaveAttribute("data-changed")
  expect(await lit()).toBeGreaterThan(0)
  // The rest of the page doesn't.
  await expect(preview.getByText(/Ada Lovelace/i).first()).not.toHaveAttribute("data-changed")
  // It fades away.
  await expect.poll(lit).toBe(0)

  // A new template restyles the page rather than changing what it says, so
  // nothing lights up, though Harvard prints the name in capitals.
  await preview
    .locator(".textLayer")
    .first()
    .evaluate((layer) => (layer.dataset.replaced = ""))
  await page.getByRole("button", { name: /^Template/ }).click()
  await page.getByRole("dialog", { name: "Choose a template" }).getByRole("button", { name: "Harvard" }).click()
  // Its text, drawn in full: react-pdf ends a text layer with .endOfContent.
  await expect(preview.locator(".textLayer:not([data-replaced]) > .endOfContent")).toBeAttached()
  await expect(preview.getByText("ADA LOVELACE", { exact: true })).toBeAttached()
  await expect(preview.locator("[data-changed]")).toHaveCount(0)

  expect(errors).toEqual([])
})

test("the preview starts pdf.js's worker once, not for each new PDF", async ({ page }) => {
  const errors = pageErrors(page)
  // Each one loads a 1.3 MB script as it starts.
  await page.addInitScript(() => {
    window.pdfWorkers = 0
    const RealWorker = window.Worker
    window.Worker = class extends RealWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        if (String(url).includes("pdf.worker")) window.pdfWorkers = (window.pdfWorkers ?? 0) + 1
      }
    }
  })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  const preview = page.getByRole("region", { name: "Live preview" })
  // Each name is a new PDF, on screen once its text is.
  for (const name of ["Ada Lovelace", "Grace Hopper", "Mary Somerville"]) {
    await page.getByLabel("Full name").fill(name)
    await expect(preview.getByText(new RegExp(name, "i")).first()).toBeVisible()
  }
  expect(await page.evaluate(() => window.pdfWorkers)).toBe(1)
  expect(errors).toEqual([])
})

/** Starts a resume with a name and email, and waits for the email in the preview. */
async function startResume(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email").fill("ada@example.com")
  const preview = page.getByRole("region", { name: "Live preview" })
  // Narrower than 1280px, the preview is behind the Edit / Preview switch.
  const toPreview = page.getByRole("group", { name: "View" }).getByRole("button", { name: "Preview" })
  if (await toPreview.isVisible()) await toPreview.click()
  const email = preview.locator(".textLayer span[role=presentation]", { hasText: "ada@example.com" })
  await expect(email).toBeVisible()
  return { preview, email }
}

/** The middle of an element on screen, or null while it isn't there, as while the text layer is redrawn. */
async function middleOf(locator: Locator) {
  const box = await locator.boundingBox({ timeout: 1_000 }).catch(() => null)
  return box && { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const apart = (a: { x: number; y: number } | null, b: { x: number; y: number }) => (a ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity)

// Beside the form the panel scrolls up and down; on its own, the page does.
for (const { width, layout } of [
  { width: 1280, layout: "beside the form" },
  { width: 1024, layout: "on its own" },
]) {
  test(`zooming with Ctrl + scroll keeps what's under the cursor there, with the preview ${layout}`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.setViewportSize({ width, height: 720 })
    const { preview, email } = await startResume(page)

    // All the way in, a step at a time. Each step scrolls by whole pixels, and
    // the rounding mustn't add up.
    const cursor = (await middleOf(email))!
    await page.mouse.move(cursor.x, cursor.y)
    await page.keyboard.down("Control")
    for (let i = 0; i < 15; i++) await page.mouse.wheel(0, -100)
    await page.keyboard.up("Control")
    await expect(preview.getByRole("button", { name: "250%" })).toBeVisible()
    await expect.poll(async () => apart(await middleOf(email), cursor), { message: "the email is still under the cursor" }).toBeLessThan(3)

    // And back out again: 250% ÷ 1.1¹⁰.
    await page.keyboard.down("Control")
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 100)
    await page.keyboard.up("Control")
    await expect(preview.getByRole("button", { name: "96%" })).toBeVisible()
    await expect.poll(async () => apart(await middleOf(email), cursor), { message: "the email is still under the cursor" }).toBeLessThan(3)

    expect(errors).toEqual([])
  })
}

test("the zoom buttons keep what's in the middle of the preview there", async ({ page }) => {
  const errors = pageErrors(page)
  // Beside the form, where no pinned bar covers the panel.
  await page.setViewportSize({ width: 1280, height: 720 })
  const { preview, email } = await startResume(page)

  // The middle of what shows of the panel the pages scroll in.
  const middle = await email.evaluate((span) => {
    const panel = span.closest<HTMLElement>("[tabindex='0']")!
    const box = panel.getBoundingClientRect()
    return { x: box.left + panel.clientWidth / 2, y: box.top + Math.min(panel.clientHeight, innerHeight - box.top) / 2 }
  })
  const before = (await middleOf(email))!
  await preview.getByRole("button", { name: "Zoom in" }).click()
  await expect(preview.getByRole("button", { name: "110%" })).toBeVisible()

  // Everything spreads out from the middle, which stays where it is.
  const expected = { x: middle.x + (before.x - middle.x) * 1.1, y: middle.y + (before.y - middle.y) * 1.1 }
  await expect
    .poll(async () => apart(await middleOf(email), expected), { message: "the email is where zooming around the middle puts it" })
    .toBeLessThan(3)

  expect(errors).toEqual([])
})

/**
 * Counts the frames from now on, and those with no finished page in the
 * preview: none there, one hidden while it's drawn, or a new canvas that
 * isn't sized yet (300 × 150, wider than a page).
 */
async function countBlankFrames(preview: Locator) {
  await preview.evaluate((region) => {
    const painted = (window.painted = { frames: 0, blank: 0 })
    const count = () => {
      painted.frames++
      const shown = [...region.querySelectorAll("canvas")].some((canvas) => {
        const box = canvas.getBoundingClientRect()
        return getComputedStyle(canvas).visibility === "visible" && box.height > box.width
      })
      if (!shown) painted.blank++
      requestAnimationFrame(count)
    }
    requestAnimationFrame(count)
  })
}

/** How wide the page on screen is, and how wide it's drawn: they differ while it's stretched to a new zoom. */
const pageWidths = (preview: Locator) =>
  preview.evaluate((region) => {
    const canvas = [...region.querySelectorAll("canvas")].find((canvas) => getComputedStyle(canvas).visibility === "visible")
    return canvas && { shown: canvas.getBoundingClientRect().width, drawn: canvas.width / devicePixelRatio }
  })

test("zooming keeps the page on screen, and draws it sharp at the new size", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1280, height: 720 })
  const { preview } = await startResume(page)
  const fullSize = (await pageWidths(preview))!.shown
  const drawnAt = (zoom: number) =>
    expect
      .poll(
        async () => {
          const widths = await pageWidths(preview)
          return !!widths && Math.abs(widths.shown - fullSize * zoom) < 2 && Math.abs(widths.drawn - widths.shown) < 2
        },
        { message: `the page is drawn sharp at ${zoom * 100}%` },
      )
      .toBe(true)
  await countBlankFrames(preview)

  // Two quick steps in, then back.
  const zoomIn = preview.getByRole("button", { name: "Zoom in" })
  await zoomIn.click()
  await zoomIn.click()
  await expect(preview.getByRole("button", { name: "120%" })).toBeVisible()
  await drawnAt(1.2)
  await preview.getByRole("button", { name: "120%" }).click()
  await drawnAt(1)

  const painted = (await page.evaluate(() => window.painted))!
  expect(painted.frames).toBeGreaterThan(10)
  expect(painted.blank).toBe(0)
  expect(errors).toEqual([])
})

test("a pinch zooms as far as the fingers move, and a mouse wheel's notch a tenth", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1280, height: 720 })
  const { preview, email } = await startResume(page)
  const cursor = (await middleOf(email))!
  await page.mouse.move(cursor.x, cursor.y)
  await countBlankFrames(preview)

  // Chrome and Firefox send a pinch as a run of small Ctrl + scrolls, each of
  // -100 × ln(scale) pixels. These make e^0.36, or 143%.
  await page.keyboard.down("Control")
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -3)
  await page.keyboard.up("Control")
  await expect(preview.getByRole("button", { name: "143%" })).toBeVisible()

  // A notch scrolls 100 pixels at once: 143% × 1.1.
  await page.keyboard.down("Control")
  await page.mouse.wheel(0, -100)
  await page.keyboard.up("Control")
  await expect(preview.getByRole("button", { name: "158%" })).toBeVisible()

  // The buttons go to the next tenth either way.
  await preview.getByRole("button", { name: "Zoom out" }).click()
  await expect(preview.getByRole("button", { name: "150%" })).toBeVisible()
  await preview.getByRole("button", { name: "Zoom in" }).click()
  await expect(preview.getByRole("button", { name: "160%" })).toBeVisible()

  expect((await page.evaluate(() => window.painted))!.blank).toBe(0)
  expect(errors).toEqual([])
})
