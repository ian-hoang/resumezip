import { expect, test, type Locator } from "@playwright/test"
import { settled } from "./helpers"

// The header's ink button, Star on GitHub, answers the pointer: lighter and
// lifted under it, as ink-button and lift-button in globals.css have it, and
// its star turns yellow. Ink to a slightly blacker black was too small a change to feel.

/** How light a color is, 0 to 1, from its computed rgb(). */
const lightness = (color: string) => {
  const [r, g, b] = color.match(/\d+(\.\d+)?/g)!.map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** The button's background and how far it has moved, once its transitions are done. */
async function look(button: Locator) {
  await settled(button)
  return button.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    translate: getComputedStyle(element).translate,
  }))
}

test("the header's Star on GitHub gets lighter and lifts under the pointer, and its star turns yellow", async ({ page }) => {
  await page.goto("/templates")
  const button = page.getByRole("banner").getByRole("link", { name: "Star on GitHub" })
  await page.mouse.move(0, 400)
  const resting = await look(button)
  await button.hover()
  const hovered = await look(button)
  expect(lightness(hovered.background)).toBeGreaterThan(lightness(resting.background))
  expect(hovered.translate).toBe("0px -1px")
  await expect(button.locator("svg")).toHaveCSS("fill", "rgb(250, 204, 21)")
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("it still gets lighter under the pointer, but doesn't move", async ({ page }) => {
    await page.goto("/templates")
    const button = page.getByRole("banner").getByRole("link", { name: "Star on GitHub" })
    await page.mouse.move(0, 400)
    const resting = await look(button)
    await button.hover()
    const hovered = await look(button)
    expect(lightness(hovered.background)).toBeGreaterThan(lightness(resting.background))
    expect(hovered.translate).toBe("none")
  })
})
