import { expect, test, type Page } from "@playwright/test"

const REPO_URL = "https://github.com/ian-hoang/resumezip"

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

// The home page's header is a glass pill floating over the video, in the middle whatever its button says.
for (const width of [1024, 1440]) {
  test(`at ${width}px the home page's header is in the middle of the page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/")
    await expect(headerLinks(page)).toHaveCount(3)
    const pill = (await page.getByRole("banner").boundingBox())!
    expect(Math.abs(pill.x + pill.width / 2 - width / 2)).toBeLessThanOrEqual(1)
    expect(new Set((await boxes(page)).map((box) => box!.y)).size).toBe(1)
  })
}

// Over the video the pill is dark glass; over the page's paper it turns light, to stay readable.
test("the home page's header turns light once it's over the page rather than the video", async ({ page }) => {
  await page.goto("/")
  const logo = page.getByRole("banner").getByRole("link", { name: "resumezip" })
  const color = () => logo.evaluate((element) => getComputedStyle(element).color)
  await expect.poll(color).toBe("rgb(255, 255, 255)")
  await page.getByRole("heading", { name: "How it works" }).scrollIntoViewIfNeeded()
  // Scrolled up a little, which brings the header back.
  await page.mouse.wheel(0, -200)
  await expect(page.getByRole("banner")).toBeInViewport()
  await expect.poll(color).not.toBe("rgb(255, 255, 255)")
})
