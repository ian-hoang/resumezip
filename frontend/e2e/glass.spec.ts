import { expect, test, type Locator, type Page } from "./test"
import { textPdf } from "../src/lib/import/testFiles"
import { newResume, openFile } from "./helpers"
import { FROM_ELSEWHERE } from "./resumes"

/** How many elements, with their ::before and ::after, draw a backdrop filter. */
const blurred = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter((element) =>
        [null, "::before", "::after"].some((pseudo) => {
          const style = getComputedStyle(element, pseudo)
          const filter = style.getPropertyValue("backdrop-filter") || style.getPropertyValue("-webkit-backdrop-filter")
          return filter !== "" && filter !== "none"
        }),
      ).length,
  )

// e2e/test.ts: the blur makes CI's WebKit slow to draw. Chromium's count shows the page still has glass to check.
test("WebKit's tests draw the glass without its blur, in a context a test opens too, and Chromium's with it", async ({
  page,
  browser,
  browserName,
}) => {
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  for (const tab of [page, other]) {
    await tab.goto("/templates")
    await expect(tab.getByRole("searchbox", { name: "Search templates" })).toBeVisible()
    if (browserName === "webkit") expect(await blurred(tab)).toBe(0)
    else expect(await blurred(tab)).toBeGreaterThan(0)
  }
  await elsewhere.close()
})

/** The animations running from `main` down to this element, as it and each block it's in has one (page-in in globals.css). */
const fadesFromMain = (locator: Locator) =>
  locator.evaluate((element) => {
    const names: string[] = []
    for (let at: Element | null = element; at && at.tagName !== "MAIN"; at = at.parentElement) {
      const name = getComputedStyle(at).animationName
      if (name !== "none") names.push(name)
    }
    return names
  })

// Glass can't blur what's behind it while a block it's in is fading, so the
// search bar showed only its own fill as the page faded in, then changed color
// in one frame as the fade ended.
test("the search bar on the templates and the dashboard is in no block that fades in, and the templates still fade", async ({ page }) => {
  await page.goto("/templates")
  const search = page.getByRole("searchbox", { name: "Search templates" })
  await expect(search).toBeVisible()
  expect(await fadesFromMain(search)).toEqual([])
  expect(
    await fadesFromMain(
      page
        .getByRole("main")
        .getByRole("link", { name: / template/ })
        .first(),
    ),
  ).toContain("page-in")

  await page.goto("/create/dashboard")
  const resumes = page.getByRole("combobox", { name: "Search your resumes" })
  await expect(resumes).toBeVisible()
  expect(await fadesFromMain(resumes)).toEqual([])
})

/** What in `main` draws a backdrop filter inside a block that fades in (page-in in globals.css), by its words. */
const frostedInAFade = (page: Page) =>
  page.getByRole("main").evaluate((main) =>
    [...main.querySelectorAll("*")]
      .filter((element) =>
        [null, "::before", "::after"].some((pseudo) => {
          const style = getComputedStyle(element, pseudo)
          const filter = style.getPropertyValue("backdrop-filter") || style.getPropertyValue("-webkit-backdrop-filter")
          return filter !== "" && filter !== "none"
        }),
      )
      .filter((element) => {
        for (let at: Element | null = element; at && at !== main; at = at.parentElement) {
          if (getComputedStyle(at).animationName !== "none") return true
        }
        return false
      })
      .map((element) => element.textContent?.trim() ?? ""),
  )

// The review page's frosted sheet and fog were in the block that fades in, so
// the sky showed through them sharp and bright as the page opened, then
// frosted over in one frame as the fade ended.
test("the review page's frosted sheet and fog are in no block that fades in, and its words still fade", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit's tests draw no blur (e2e/test.ts)")
  await page.goto("/review")
  const headline = page.getByRole("heading", { level: 1 })
  await expect(headline).toBeVisible()
  expect(await fadesFromMain(headline)).toContain("page-in")
  // Its button is solid white glass, with nothing behind it showing through.
  expect(await frostedInAFade(page)).toEqual(["Review my resume"])
})

/** What a frame of frosted glass draws under its rim, on its ::before. */
const frostOf = (frame: Locator) =>
  frame.evaluate((element) => {
    const { backgroundColor, backdropFilter } = getComputedStyle(element, "::before")
    return { backgroundColor, backdropFilter }
  })

// Asked for less transparency, glass turns solid white, which would leave Download PDF's white words on white.
test("asked for less transparency, Download PDF's glass in the editor is solid blue", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright can't ask a browser for less transparency; Chromium's DevTools protocol can")
  const session = await page.context().newCDPSession(page)
  await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] })

  await newResume(page)
  // The pill's glass lies under its two halves, just before Download PDF.
  const glass = page.getByRole("button", { name: "Download PDF" }).locator("xpath=preceding-sibling::span[1]")
  await expect(glass).toHaveClass(/glass-blue/)
  const fill = await glass.evaluate((element) => {
    const style = getComputedStyle(element, "::before")
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage }
  })
  expect(fill).toEqual({ backgroundColor: "rgb(46, 91, 230)", backgroundImage: "none" })
})

test("asked for less transparency, the review page's frame is as solid as the dashboard's", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright can't ask a browser for less transparency; Chromium's DevTools protocol can")
  const session = await page.context().newCDPSession(page)
  await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] })

  await page.goto("/create/dashboard")
  const sheet = await frostOf(page.getByRole("main").locator("xpath=.."))
  expect(sheet).toEqual({ backgroundColor: "rgba(255, 255, 255, 0.78)", backdropFilter: "none" })

  // With the AI's notes, so the frame's head has its switch to find it by.
  await page.route("**/api/review", (route) => route.fulfill({ json: { notes: [] } }))
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), {
    name: "Mara Lin.pdf",
    mimeType: "application/pdf",
    buffer: textPdf([FROM_ELSEWHERE]),
  })
  const frame = page.getByRole("group", { name: "Notes on the page" }).locator("xpath=../..")
  await expect(frame).toBeVisible({ timeout: 90_000 })
  expect(await frostOf(frame)).toEqual(sheet)
})
