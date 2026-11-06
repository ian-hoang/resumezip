import { expect, test, type Page } from "./test"
import { newResume, pageErrors, settled, templateShown } from "./helpers"
import { TEMPLATES } from "../src/lib/templates"

/**
 * Starts a new resume with a name in it, then makes the window `width` × `height`.
 * Narrower than 1280px the Template button is at the top of Style, which it opens.
 */
async function startWriting(page: Page, width?: number, height?: number) {
  await newResume(page, { name: "Ada Lovelace" })
  if (width && height) await page.setViewportSize({ width, height })
  await templateShown(page)
}

const picker = (page: Page) => page.getByRole("button", { name: /^Template/ })
const gallery = (page: Page) => page.getByRole("dialog", { name: "Choose a template" })
/** How far the page scrolls sideways; nothing should make it wider than the window. */
const pageWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth)

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 1024],
  // Wide enough for a panel under a button, but the button is in Style, down the page: it's the dialog still.
  [1024, 768],
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
    for (const { name } of TEMPLATES) {
      const template = dialog.getByRole("button", { name, exact: true })
      await template.scrollIntoViewIfNeeded()
      // Layout is in fractions of a pixel and scrolling in whole ones, so allow one.
      const shown = (await template.boundingBox())!
      expect(shown.y).toBeGreaterThanOrEqual(box.y - 1)
      expect(shown.y + shown.height).toBeLessThanOrEqual(box.y + box.height + 1)
    }
    expect(await pageWidth(page)).toBeLessThanOrEqual(width)

    // Choosing the template with the longest name closes the gallery, keeps
    // what's written, and the header still fits.
    const chosen = (await dialog.getByRole("button", { pressed: true }).textContent())?.trim()
    const longest = TEMPLATES.map(({ name }) => name)
      .filter((name) => name !== chosen)
      .reduce((a, b) => (b.length > a.length ? b : a))
    await dialog.getByRole("button", { name: longest, exact: true }).click()
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
  const current = dialog.getByRole("button", { pressed: true })
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

test("on a wide screen the gallery opens under the header's Template button, and a click elsewhere closes it", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1280, 768)
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
