import { expect, test, type Page } from "@playwright/test"

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

const headerLinks = (page: Page) => page.getByRole("navigation", { name: "Main" }).getByRole("link")
const boxes = async (page: Page) => Promise.all((await headerLinks(page).all()).map((link) => link.boundingBox()))

// 768px is the narrowest the links show at, and no page's button may push them onto two lines there.
for (const path of ["/", "/about"]) {
  test(`at 768px the header's links on ${path} are on one line`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 })
    await page.goto(path)
    await expect(headerLinks(page)).toHaveCount(3)
    expect(new Set((await boxes(page)).map((box) => box!.height)).size).toBe(1)
  })
}

// The home page's button is wider than the others', which mustn't move the links. Below lg,
// wider system fonts can leave the header no room to spare, and they may move a pixel there.
for (const width of [1024, 1440]) {
  test(`at ${width}px the header's links are where they are on every page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/about")
    await expect(headerLinks(page)).toHaveCount(3)
    const elsewhere = await boxes(page)
    await page.goto("/")
    await expect(headerLinks(page)).toHaveCount(3)
    expect(await boxes(page)).toEqual(elsewhere)
  })
}
