import { expect, test, type Locator } from "./variant"
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
