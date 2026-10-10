import { expect, test, type Page } from "@playwright/test"

// The home page's parts that move with the scroll, and its questions.

const floatingStart = (page: Page) => page.getByRole("link", { name: "Start writing. It’s free." })

/** Scrolls by this much, a step at a time, as a wheel does, so the page sees which way it goes. */
async function scrollBy(page: Page, pixels: number) {
  const steps = 8
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, pixels / steps)
    await page.waitForTimeout(40)
  }
}

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

test("each stage of Checked as you write lasts more than a screen of scrolling, so a flick doesn't skip it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  const check = page.getByRole("region", { name: "Checked as you write" })
  await expect(check).toBeVisible()

  // Scrolls down through the section a little at a time, noting where the stage counter turns to 2 / 3 and to 3 / 3.
  const turns = await check.evaluate(async (section) => {
    const counter = Array.from(section.querySelectorAll("span")).find((span) => /^\d \/ 3$/.test(span.textContent ?? ""))!
    const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    const top = section.getBoundingClientRect().top + window.scrollY
    const found: Record<string, number> = {}
    for (let y = top; y < top + section.getBoundingClientRect().height; y += 40) {
      // At once: the page scrolls smoothly otherwise (scroll-smooth), and would still be on its way.
      window.scrollTo({ top: y, behavior: "instant" })
      await frames()
      found[counter.textContent!] ??= y
    }
    return { second: found["2 / 3"], third: found["3 / 3"], screen: window.innerHeight }
  })
  expect(turns.third - turns.second).toBeGreaterThan(turns.screen)
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("the words are sharp from the start", async ({ page }) => {
    await page.goto("/")
    await expect(keepIt(page)).toBeAttached()
    await expect.poll(() => lastWordBlur(page)).toBe(0)
  })
})
