import { expect, test, type Page } from "@playwright/test"
import { pageErrors, settled } from "./helpers"

/** Starts a new resume with a name in it, then makes the window `width` × `height`. */
async function startWriting(page: Page, width?: number, height?: number) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  if (width && height) await page.setViewportSize({ width, height })
}

const picker = (page: Page) => page.getByRole("button", { name: /^Template/ })
const gallery = (page: Page) => page.getByRole("dialog", { name: "Choose a template" })
/** How far the page scrolls sideways; nothing should make it wider than the window. */
const pageWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth)

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  test(`at ${width}px wide, every template can be seen and chosen`, async ({ page }) => {
    const errors = pageErrors(page)
    await startWriting(page, width, height)
    await picker(page).click()

    // The gallery fits in the window, and scrolls inside itself if it has to.
    const dialog = gallery(page)
    await expect(dialog).toBeVisible()
    // Compare each template with the gallery's final size, once it has grown
    // into place: a size read part-way is too small for the templates.
    await settled(dialog)
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.y + box.height).toBeLessThanOrEqual(height)
    const templates = dialog.locator("button[aria-pressed]")
    for (const template of await templates.all()) {
      await template.scrollIntoViewIfNeeded()
      // Layout is in fractions of a pixel and scrolling in whole ones, so allow one.
      const shown = (await template.boundingBox())!
      expect(shown.y).toBeGreaterThanOrEqual(box.y - 1)
      expect(shown.y + shown.height).toBeLessThanOrEqual(box.y + box.height + 1)
    }
    expect(await pageWidth(page)).toBeLessThanOrEqual(width)

    // Choosing the template with the longest name closes the gallery, keeps
    // what's written, and the header still fits.
    const names = await templates.evaluateAll((buttons) =>
      buttons.filter((button) => button.getAttribute("aria-pressed") === "false").map((button) => button.textContent!.trim()),
    )
    const longest = names.reduce((a, b) => (b.length > a.length ? b : a))
    await templates.filter({ has: page.getByText(longest, { exact: true }) }).click()
    await expect(dialog).toBeHidden()
    await expect(picker(page)).toContainText(longest)
    await expect(picker(page)).toBeFocused()
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")
    expect(await pageWidth(page)).toBeLessThanOrEqual(width)

    expect(errors).toEqual([])
  })
}

test("the template gallery works from the keyboard, and closes every way", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 390, 844)
  const dialog = gallery(page)

  // It opens on the current template, and Tab stays inside it.
  await picker(page).focus()
  await page.keyboard.press("Enter")
  const current = dialog.locator('button[aria-pressed="true"]')
  await expect(current).toBeFocused()
  const buttons = await dialog.getByRole("button").count()
  for (let press = 0; press < buttons; press++) await page.keyboard.press("Tab")
  await expect(current).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused()

  // Escape, Close and a tap beside it each close it, back on the button.
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(picker(page)).toBeFocused()
  await picker(page).click()
  await dialog.getByRole("button", { name: "Close" }).click()
  await expect(dialog).toBeHidden()
  await expect(picker(page)).toBeFocused()
  await picker(page).click()
  await page.mouse.click(5, 5)
  await expect(dialog).toBeHidden()
  await expect(picker(page)).toBeFocused()

  expect(errors).toEqual([])
})

// From 1280px the editor's Style panel lists the templates instead (e2e/editor-stage.spec.ts).
test("on a wider screen the gallery opens under its button, and a click elsewhere closes it", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1024, 768)
  await picker(page).click()
  const dialog = gallery(page)
  await expect(dialog).toBeVisible()
  await settled(dialog)
  const button = (await picker(page).boundingBox())!
  const box = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.y).toBeGreaterThanOrEqual(button.y + button.height)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)

  // What was clicked keeps the focus. (The resume's name is beside the gallery, not under it.)
  await page.getByLabel("Resume name").click()
  await expect(dialog).toBeHidden()
  await expect(page.getByLabel("Resume name")).toBeFocused()

  expect(errors).toEqual([])
})
