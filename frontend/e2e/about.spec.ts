import { type Locator, type Page, expect, test } from "./variant"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// The About page is a story the scroll plays (src/components/about): the first screen, our own
// resume rising in its folder with what resumezip promises marked on it, then the editor and the
// way in. Its pictures are drawn as the page scrolls, so these scroll the way a person does.

const PHONE = { width: 390, height: 844 }

/** Our resume's folder, by what's written on it. */
const folderHeadline = (page: Page) => page.getByText("Here’s our resume.", { exact: true })

/**
 * Scrolls the story to `v`, in screens of scrolling times 100 (STORY_LENGTH, 960, is its end): the
 * story starts at the top of the page, a screen of it to each screen scrolled.
 */
async function playStoryTo(page: Page, v: number) {
  await expect
    .poll(async () => {
      if (await page.evaluate((v) => window.scrollY >= (v / 100) * window.innerHeight, v)) return true
      await page.mouse.wheel(0, 400)
      return false
    })
    .toBe(true)
}

/** Scrolls down a screen at a time until `target` shows. */
async function scrollUntilVisible(page: Page, target: Locator) {
  await expect
    .poll(async () => {
      if (await target.isVisible()) return true
      await page.mouse.wheel(0, 400)
      return false
    })
    .toBe(true)
}

test("the About page says what resumezip is, then its story leads down to Start writing", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/about")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("resumezip")
  await expect(page.getByText("A free, open-source resume builder that runs in your browser")).toBeVisible()
  await expect(page.getByRole("link", { name: /Microsoft for Startups/ })).toBeVisible()

  await page.mouse.move(400, 400)
  await scrollUntilVisible(page, folderHeadline(page))
  const start = page.getByRole("link", { name: "Start writing" })
  await playStoryTo(page, 940)
  // It only takes a click once it has arrived.
  await start.click({ trial: true })
  await expect(start).toHaveAttribute("href", "/create/dashboard")
  expect(errors).toEqual([])
})

// The story shows our resume and its promises as pictures; a screen reader is told them in words.
test("a screen reader is told what our resume says and what it promises", async ({ page }) => {
  await page.goto("/about")
  await expect(page.getByRole("heading", { name: "Here’s our resume" })).toBeAttached()
  const promises = page.getByRole("listitem")
  await expect(promises.filter({ hasText: /^Free:/ })).toBeAttached()
  await expect(promises.filter({ hasText: /^Private:/ })).toBeAttached()
  await expect(promises.filter({ hasText: /^Open source:/ })).toBeAttached()
})

// The folder is wider than the page, so it covers the page's sides and the blank paper under its
// last line, and its words are written on it. While the story was made, a folder wider than a
// phone's screen was capped at it, as pictures are by default, and the page stood out under it.
test("on a phone, the folder hides the page under its written part, and its words are on the folder", async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto("/about")
  await page.mouse.move(200, 400)
  const headline = folderHeadline(page)
  await scrollUntilVisible(page, headline)
  // Once it has risen, what's behind the middle of its words is the folder. The story's pictures
  // let clicks through; made to take them for a moment, the browser says which is under the words.
  await expect
    .poll(() =>
      headline.evaluate((words) => {
        const folder = words.parentElement!
        folder.style.pointerEvents = "auto"
        const box = words.getBoundingClientRect()
        const behind = document
          .elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)
          .find((element) => !words.contains(element))
        folder.style.pointerEvents = ""
        return behind instanceof HTMLImageElement ? new URL(behind.src).pathname : behind?.tagName
      }),
    )
    .toBe("/about/manila-folder.webp")
})

test("with less motion, the story is told in still pictures, every promise already marked", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" })
  const page = await context.newPage()
  const errors = pageErrors(page)
  await page.goto("/about")
  const headline = folderHeadline(page)
  await headline.scrollIntoViewIfNeeded()
  await expect(headline).toBeVisible()
  await expect(page.getByText("every template, free")).toBeVisible()
  await expect(page.getByText("MIT, all on GitHub")).toBeVisible()
  await expect(page.getByRole("link", { name: "Start writing" })).toBeVisible()
  // Its box was only rounded on the moving story's stage, and had square corners here.
  await expect(page.getByRole("region", { name: "Your resume, on your own computer." })).toHaveCSS("border-radius", "28px")
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  expect(errors).toEqual([])
  await context.close()
})

// The way in is kept wholly on screen by its height. Its text can reflow after it's first placed,
// as when its fonts arrive late; it used to keep the height it had at first, and run off a short
// window's foot.
test("Start writing stays on screen when the box's words reflow taller", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 })
  await page.goto("/about")
  await page.mouse.move(400, 300)
  const start = page.getByRole("link", { name: "Start writing" })
  await playStoryTo(page, 940)
  await start.click({ trial: true })
  await expect.poll(async () => (await start.boundingBox())!.y + (await start.boundingBox())!.height).toBeLessThanOrEqual(620)

  await page.getByRole("heading", { name: "Your resume, on your own computer." }).evaluate((heading) => (heading.style.fontSize = "96px"))
  await expect.poll(async () => (await start.boundingBox())!.y + (await start.boundingBox())!.height).toBeLessThanOrEqual(620)
})

// The footer's Contact and the old /contact land here: the story's last screen, where the way in has
// the address to write to.
test("Contact lands on the story's last screen, with the address and Start writing", async ({ page }) => {
  await page.goto("/about#contact")
  // The story is all the main part holds, so on its last screen their foot is the window's. Checked
  // before the click, which would scroll to Start writing itself if it had to; the box is on the
  // story's stage, in view, wherever the story is.
  await expect
    .poll(() => page.getByRole("main").evaluate((main) => Math.abs(main.getBoundingClientRect().bottom - window.innerHeight)))
    .toBeLessThan(1.5)
  await page.getByRole("link", { name: "Start writing" }).click({ trial: true })
  await expect(page.getByRole("link", { name: "hello@tryresumezip.com", exact: true })).toBeInViewport()
})

// The page ends with the story, then the footer. A pane of sections used to slide up over its last
// screen, covering Start writing as the page scrolled on, where a short window has it low.
test("nothing covers Start writing as the page scrolls on past the story", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 })
  await page.goto("/about")
  await page.mouse.move(400, 400)
  await playStoryTo(page, 960)
  await page.mouse.wheel(0, 150)
  await expect.poll(() => page.evaluate(() => window.scrollY >= 9.6 * window.innerHeight + 130)).toBe(true)
  // What's under the middle of the button is the button: asked of the browser where the page is,
  // as a click there would land, without scrolling to find a spot that's clear.
  const start = page.getByRole("link", { name: "Start writing" })
  await expect
    .poll(() =>
      start.evaluate((link) => {
        const box = link.getBoundingClientRect()
        return link.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
      }),
    )
    .toBe(true)
})

// The story ends on grass, and the strip over the footer carries that grass on, then darkens. It
// used to draw the picture again at another size and place, with a line where the two met.
for (const [screen, size] of [
  ["a wide screen", { width: 1440, height: 900 }],
  ["a phone", PHONE],
] as const) {
  test(`the story's grass runs on into the footer without a line, on ${screen}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto("/about")
    await page.mouse.move(size.width / 2, 300)
    await playStoryTo(page, 960)
    await page.mouse.wheel(0, 150)
    // How far the footer's picture of the grass is from the stage's, in pixels: across, down, and in width.
    const apart = () =>
      page.getByRole("contentinfo").evaluate((footer) => {
        const layers = (list: string) => {
          const out = [""]
          let depth = 0
          for (const c of list) {
            if (c === "(") depth++
            if (c === ")") depth--
            if (c === "," && depth === 0) out.push("")
            else out[out.length - 1] += c
          }
          return out.map((layer) => layer.trim())
        }
        const strip = footer.previousElementSibling!
        const style = getComputedStyle(strip)
        const at = layers(style.backgroundImage).findIndex((image) => image.includes("/about/grass.webp"))
        const box = strip.getBoundingClientRect()
        const drawn = {
          left: box.left + parseFloat(layers(style.backgroundPositionX)[at]),
          top: box.top + parseFloat(layers(style.backgroundPositionY)[at]),
          width: parseFloat(layers(style.backgroundSize)[at]),
        }
        // The stage's grass sways by skewing its picture, so it's measured by the box it stands in.
        const picture = [...document.images].find((image) => new URL(image.src).pathname === "/about/grass.webp")!
        const grass = picture.parentElement!.getBoundingClientRect()
        return [drawn.left - grass.left, drawn.top - grass.top, drawn.width - grass.width].map((gap) => Math.round(Math.abs(gap)))
      })
    await expect.poll(apart).toEqual([0, 0, 0])
  })
}
