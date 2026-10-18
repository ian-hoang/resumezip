import { expect, test, type Locator, type Page } from "./test"

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
