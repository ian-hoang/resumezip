import { expect, test, type Page } from "@playwright/test"
import { pageErrors } from "./helpers"

// The home page's parts that move with the scroll, and its news and questions.

const news = (page: Page) => page.getByRole("complementary", { name: "News" })
const floatingStart = (page: Page) => page.getByRole("link", { name: "Start writing. It’s free." })

/** Scrolls by this much, a step at a time, as a wheel does, so the page sees which way it goes. */
async function scrollBy(page: Page, pixels: number) {
  const steps = 8
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, pixels / steps)
    await page.waitForTimeout(40)
  }
}

test("the news links to what's new, and once closed stays closed", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/")
  await expect(news(page).getByRole("link", { name: /^New:/ })).toHaveAttribute("href", "/create/dashboard")

  await news(page).getByRole("button", { name: "Close the news" }).click()
  await expect(news(page)).toHaveCount(0)
  // The keyboard carries on in the header, rather than from the top of the page.
  await expect(page.getByRole("banner").getByRole("link", { name: "resumezip" })).toBeFocused()
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  // A fixed wait: proving the news doesn't come back.
  await page.waitForTimeout(500)
  await expect(news(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test("closing the news leaves the header and the heading where they were", async ({ page }) => {
  await page.goto("/")
  await expect(news(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // The bar slides in from above the screen. Part-way, its button is partly
  // off the top, and the click scrolls the page to reach it.
  await news(page).evaluate((bar) => Promise.all(bar.getAnimations().map((animation) => animation.finished)))
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox()
  const header = await page.getByRole("banner").boundingBox()
  await news(page).getByRole("button", { name: "Close the news" }).click()
  await expect(news(page)).toHaveCount(0)
  expect(await page.getByRole("heading", { level: 1 }).boundingBox()).toEqual(heading)
  expect(await page.getByRole("banner").boundingBox()).toEqual(header)
})

test("without storage, the news still shows and closes for the page", async ({ page }) => {
  const errors = pageErrors(page)
  // As in Chrome set to "Don't allow sites to save data on your device".
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Access is denied for this document.", "SecurityError")
      },
    })
  })
  await page.goto("/")
  await news(page).getByRole("button", { name: "Close the news" }).click()
  await expect(news(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test("one answer is open at a time, and each question says whether it's open", async ({ page }) => {
  await page.goto("/")
  const questions = page.getByRole("region", { name: "Questions" })
  const free = questions.getByRole("button", { name: "Is it really free?" })
  const keep = questions.getByRole("button", { name: "Do you keep my resume?" })
  await expect(keep).toHaveAttribute("aria-expanded", "true")
  await expect(questions.getByText("It’s saved in this browser")).toBeVisible()

  await free.click()
  await expect(free).toHaveAttribute("aria-expanded", "true")
  await expect(keep).toHaveAttribute("aria-expanded", "false")
  await expect(questions.getByText("No ads, no trial, no watermark.")).toBeVisible()
  await expect(questions.getByText("It’s saved in this browser")).toBeHidden()
  // A closed answer's link is out of the keyboard's way.
  await free.focus()
  await page.keyboard.press("Tab")
  await expect(questions.getByRole("button", { name: "Do you keep my resume?" })).toBeFocused()

  await free.press("Enter")
  await expect(free).toHaveAttribute("aria-expanded", "false")
  await expect(questions.getByText("No ads, no trial, no watermark.")).toBeHidden()
})

test("the small Start writing shows past the hero and keeps out of the footer's way", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  // A fixed wait: proving it doesn't show over the hero, which has its own.
  await page.waitForTimeout(500)
  await expect(floatingStart(page)).toBeHidden()

  await page.getByRole("region", { name: "Questions" }).scrollIntoViewIfNeeded()
  await expect(floatingStart(page)).toBeVisible()
  await expect(floatingStart(page)).toHaveAttribute("href", "/create/dashboard")

  await page.getByRole("contentinfo").scrollIntoViewIfNeeded()
  await expect(floatingStart(page)).toBeHidden()
})

test("the header slides away as the page scrolls down, and comes back up with it or with the keyboard", async ({ page }) => {
  await page.goto("/")
  const header = page.getByRole("banner")
  await expect(header).toBeInViewport()

  await scrollBy(page, 1600)
  await expect(header).not.toBeInViewport()
  await scrollBy(page, -300)
  await expect(header).toBeInViewport()

  await scrollBy(page, 600)
  await expect(header).not.toBeInViewport()
  await header.getByRole("link", { name: "Templates" }).focus()
  await expect(header).toBeInViewport()
})

// Screen readers get the line whole, ahead of its words drawn one by one, which they don't see.
const keepIt = (page: Page) => page.getByText("You keep it. We don’t.", { exact: true }).first()

/** How blurred the last word of "You keep it. We don't." is drawn, in px, or 0. */
const lastWordBlur = (page: Page) =>
  keepIt(page)
    .locator("xpath=..")
    .evaluate((line) => {
      const words = line.querySelectorAll("[aria-hidden] span")
      const filter = getComputedStyle(words[words.length - 1]).filter
      return filter === "none" ? 0 : parseFloat(filter.replace("blur(", ""))
    })

test("the words come into focus as they scroll up the page, and screen readers get them whole", async ({ page }) => {
  await page.goto("/")
  await expect(keepIt(page)).toBeAttached()
  expect(await keepIt(page).evaluate((element) => element.closest("[aria-hidden]"))).toBeNull()
  await expect.poll(() => lastWordBlur(page)).toBeGreaterThan(1)

  await page.getByText("No account, and no copy on our side.", { exact: false }).first().scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2))
  await expect.poll(() => lastWordBlur(page)).toBe(0)
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("the words are sharp from the start", async ({ page }) => {
    await page.goto("/")
    await expect(keepIt(page)).toBeAttached()
    await expect.poll(() => lastWordBlur(page)).toBe(0)
  })
})
