import { expect, test, type Page } from "./test"
import { pageErrors } from "./helpers"

// The home page's background video (components/home/HeroVideo.tsx). Chromium
// here can't play H.264, so the test that needs it playing is given a VP9
// stand-in, 2 seconds of an earlier clip at 64×36:
//   ffmpeg -i clip.mp4 -t 2 -an -vf scale=64:36 -r 12 -c:v libvpx-vp9 -b:v 0 -crf 50 e2e/files/clip-vp9.mp4

const CLIP = /\/video\/[\w-]+\.mp4$/

/** The clips the page asks for, by file name, in order. */
function clipsRequested(page: Page): string[] {
  const names: string[] = []
  page.on("request", (request) => {
    if (CLIP.test(request.url())) names.push(request.url().split("/").pop()!)
  })
  return names
}

// Decorative, so neither has a role or a name.
const video = (page: Page) => page.locator("video")
const poster = (page: Page) => page.locator("img[src*='interview-poster']")

const opacity = (page: Page) => video(page).evaluate((element) => getComputedStyle(element).opacity)
const paused = (page: Page) => video(page).evaluate((element: HTMLVideoElement) => element.paused)

test("the video downloads once the rest of the page has loaded", async ({ page }) => {
  const clips = clipsRequested(page)
  // The poster holds up the page's load event while it's held back.
  let releasePoster = () => {}
  const posterHeld = new Promise<void>((resolve) => (releasePoster = resolve))
  await page.route(/interview-poster/, async (route) => {
    await posterHeld
    await route.continue()
  })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("link", { name: "Start writing" }).first()).toBeVisible()
  await page.waitForTimeout(1_500)
  expect(clips).toEqual([])

  releasePoster()
  await expect.poll(() => clips[0]).toBe("interview.mp4")
})

test("the poster shows while the video loads", async ({ page }) => {
  // Never answered, as on a very slow connection.
  await page.route(CLIP, () => {})
  await page.goto("/")
  await expect(poster(page)).toBeVisible()
  await expect.poll(() => poster(page).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  expect(await opacity(page)).toBe("0")
})

test("the video fades in over the poster, dips to it around the loop, and stops while scrolled away", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The stand-in clip is VP9, which Chromium plays")
  const errors = pageErrors(page)
  await page.route(CLIP, (route) => route.fulfill({ path: "e2e/files/clip-vp9.mp4" }))
  await page.goto("/")
  // Looked at often: the stand-in is only shown for about a second of each loop.
  const often = { intervals: [50] }
  await expect.poll(() => opacity(page), often).toBe("1")
  await expect.poll(() => opacity(page), often).toBe("0")
  await expect.poll(() => opacity(page), often).toBe("1")

  await page.getByRole("contentinfo").scrollIntoViewIfNeeded()
  await expect.poll(() => paused(page)).toBe(true)
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded()
  await expect.poll(() => paused(page)).toBe(false)
  expect(errors).toEqual([])
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("the video doesn't download, and the poster stays", async ({ page }) => {
    const clips = clipsRequested(page)
    await page.goto("/")
    await expect(poster(page)).toBeVisible()
    await page.waitForTimeout(1_500)
    expect(clips).toEqual([])
  })
})

test("visitors saving data don't download the video", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true, effectiveType: "4g" } })
  })
  const clips = clipsRequested(page)
  await page.goto("/")
  await expect(poster(page)).toBeVisible()
  await page.waitForTimeout(1_500)
  expect(clips).toEqual([])
})
