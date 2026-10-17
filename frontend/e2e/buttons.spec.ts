import { expect, test, type Locator } from "./test"
import { settled } from "./helpers"

// The header's main button, Star on GitHub, is ink glass on a light page
// (ink-glass in globals.css), with a gold star. Under the pointer it gets
// lighter: its glass is a gradient, so it brightens rather than changing color.

/** How bright the button is drawn, from its computed filter: 1 unless it's brightened or dimmed. */
async function brightness(button: Locator) {
  await settled(button)
  return button.evaluate((element) => {
    const match = /brightness\(([\d.]+)\)/.exec(getComputedStyle(element).filter)
    return match ? Number(match[1]) : 1
  })
}

test("the header's Star on GitHub is ink glass with a gold star, and gets lighter under the pointer", async ({ page }) => {
  await page.goto("/templates")
  const button = page.getByRole("banner").getByRole("link", { name: "Star on GitHub" })
  await expect(button.locator("svg")).toHaveCSS("fill", "rgb(250, 204, 21)")
  await page.mouse.move(0, 400)
  const resting = await brightness(button)
  await button.hover()
  expect(await brightness(button)).toBeGreaterThan(resting)
})

// A page's main button is ink on the pages about resumezip, and blue glass on
// the app's white sheet (blue-button in styles/sheet.css).
const INK = "rgb(17, 19, 24)"
// blue-button's gradient, lighter at its top, starts from this blue.
const GLASS_BLUE = /^linear-gradient\(rgb\(91, 151, 251\)/

async function background(button: Locator) {
  await settled(button)
  return button.evaluate((element) => {
    const style = getComputedStyle(element)
    return { color: style.backgroundColor, image: style.backgroundImage }
  })
}

test("a main button is ink on the pages about resumezip, and blue glass in the app", async ({ page }) => {
  await page.goto("/")
  // The hero's: Start writing is a button there too, not words beside a blue square.
  expect(await background(page.getByRole("link", { name: "Start writing", exact: true }).first())).toEqual({ color: INK, image: "none" })
  await page.goto("/does-not-exist")
  expect(await background(page.getByRole("link", { name: "Back to home" }))).toEqual({ color: INK, image: "none" })

  await page.goto("/templates")
  expect((await background(page.getByRole("link", { name: "Start blank" }))).image).toMatch(GLASS_BLUE)
  // The Use on a card, which shows as the card is pointed at, is blue too, not ink.
  const use = page.getByRole("link", { name: "Use Jake's", exact: true }).getByText("Use", { exact: true })
  expect((await background(use)).image).toMatch(GLASS_BLUE)
  await page.goto("/create/dashboard")
  expect((await background(page.getByRole("button", { name: "New resume" }).first())).image).toMatch(GLASS_BLUE)
})

// With nothing to point with, a card's Use is a button under its name instead of the plate: blue glass too.
test.describe("on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("a template card's Use is blue glass", async ({ page }) => {
    await page.goto("/templates")
    expect((await background(page.getByRole("link", { name: "Use Jake's", exact: true }))).image).toMatch(GLASS_BLUE)
  })
})
