import { expect, test } from "@playwright/test"

const REPO_URL = "https://github.com/ian-hoang/resumezip"

// The home page's header is inside its first section, so it isn't a banner
// landmark there: these look it up by the header's own links instead.

test("the home page's header asks for a star on GitHub, and other pages' headers start a resume", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Star on GitHub" })).toHaveAttribute("href", REPO_URL)

  await page.goto("/templates")
  const banner = page.getByRole("banner")
  await expect(banner.getByRole("link", { name: "Start writing" })).toBeVisible()
  await expect(banner.getByRole("link", { name: "Star on GitHub" })).toHaveCount(0)
})

test("on a phone, the home page's menu asks for the star", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Star on GitHub" })).toHaveAttribute(
    "href",
    REPO_URL,
  )
})

// The home page's button is wider than the others', which mustn't push the links aside or onto two lines.
for (const width of [768, 1440]) {
  test(`at ${width}px the header's links are on one line, where they are on every page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const links = page.getByRole("navigation", { name: "Main" }).getByRole("link")
    const boxes = async () => Promise.all((await links.all()).map((link) => link.boundingBox()))

    await page.goto("/about")
    await expect(links).toHaveCount(3)
    const elsewhere = await boxes()
    await page.goto("/")
    await expect(links).toHaveCount(3)
    const home = await boxes()
    expect(home).toEqual(elsewhere)
    expect(new Set(home.map((box) => box!.height)).size).toBe(1)
  })
}
