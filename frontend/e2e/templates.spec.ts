import { expect, test, type Locator, type Page } from "./test"
import { countThumbSlides, instantScrolling, pageErrors, seriousAccessibilityProblems, templateChosen, thumbCovers } from "./helpers"
import { TEMPLATES } from "../src/lib/templates"

// The templates page's search and style chips. Each card's picture leads to its template's page.

const cards = (page: Page) => page.getByRole("main").getByRole("link", { name: / template/ })

test("/ goes to the search, which finds templates by name, font or style", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/templates")
  const search = page.getByRole("searchbox", { name: "Search templates" })
  await expect(cards(page).first()).toBeVisible()
  const every = await cards(page).count()

  // The cards are in the page's HTML, so they show before its script runs, and "/" does nothing
  // until it has. Pressed again until it goes to the search, which then holds no "/".
  await expect(async () => {
    await page.keyboard.press("/")
    await expect(search).toBeFocused({ timeout: 1_000 })
  }).toPass()
  await expect(search).toHaveValue("")

  await page.keyboard.type("garamond")
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page)).toHaveAccessibleName(/^Harvard resume template/)

  await search.fill("serif")
  await expect(cards(page)).toHaveCount(4)
  await expect(cards(page).first()).toHaveAccessibleName(/^Jake's resume template/)

  // Escape clears it.
  await search.press("Escape")
  await expect(search).toHaveValue("")
  await expect(cards(page)).toHaveCount(every)
  expect(errors).toEqual([])
})

test("a chip shows the templates with that style, and says it's picked", async ({ page }) => {
  await page.goto("/templates")
  const chips = page.getByRole("group", { name: "Filter by style" })
  const all = chips.getByRole("button", { name: "All" })
  await expect(all).toHaveAttribute("aria-pressed", "true")
  const every = await cards(page).count()

  await chips.getByRole("button", { name: "Color headings" }).click()
  await expect(chips.getByRole("button", { name: "Color headings" })).toHaveAttribute("aria-pressed", "true")
  await expect(all).toHaveAttribute("aria-pressed", "false")
  await expect(cards(page)).toHaveCount(3)
  await expect(page.getByRole("status")).toHaveText("Showing Blueprint, Ian's, and Accent.")

  await all.click()
  await expect(cards(page)).toHaveCount(every)
})

test("the picked chip's white pill slides across to the next one picked, or jumps there with less motion", async ({ page }) => {
  await page.goto("/templates")
  const chips = page.getByRole("group", { name: "Filter by style" })
  await expect.poll(() => thumbCovers(chips, chips.getByRole("button", { name: "All" }))).toBe(true)
  const slides = await countThumbSlides(chips)

  const latex = chips.getByRole("button", { name: "LaTeX look" })
  await latex.click()
  await expect.poll(() => thumbCovers(chips, latex)).toBe(true)
  expect(await slides()).toBe(1)

  // It's there as soon as it's picked, so there was nothing to slide.
  await page.emulateMedia({ reducedMotion: "reduce" })
  const serif = chips.getByRole("button", { name: "Serif", exact: true })
  await serif.click()
  await expect.poll(() => thumbCovers(chips, serif)).toBe(true)
  expect(await slides()).toBe(1)
})

test("the page is the dashboard's sheet: a title on the left, the search and styles in one bar, and Start blank", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/templates")
  const main = page.getByRole("main")
  const title = page.getByRole("heading", { level: 1 })
  await expect(title).toHaveText("Pick a template.")
  // On the left of the sheet, not centred: as far left as the bar below it.
  const bar = page.getByRole("searchbox", { name: "Search templates" })
  expect(Math.abs((await title.boundingBox())!.x - (await main.boundingBox())!.x - 36)).toBeLessThan(2)
  expect((await bar.boundingBox())!.y).toBeGreaterThan((await title.boundingBox())!.y)
  // The styles beside the search, on one line; no sort, and no Pages or List.
  const chips = page.getByRole("group", { name: "Filter by style" })
  const middle = async (locator: Locator) => {
    const box = (await locator.boundingBox())!
    return box.y + box.height / 2
  }
  expect(Math.abs((await middle(chips)) - (await middle(bar)))).toBeLessThan(3)
  await expect(main.getByRole("group", { name: "View" })).toHaveCount(0)
  expect(await seriousAccessibilityProblems(page)).toEqual([])

  // Start blank starts a resume in the template every resume starts in.
  await main.getByRole("link", { name: "Start blank" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(await templateChosen(page)).toContainText("Jake's")
  expect(errors).toEqual([])
})

test("when nothing matches, it says so, and one click shows every template again", async ({ page }) => {
  await page.goto("/templates")
  const every = await cards(page).count()
  await page.getByRole("searchbox", { name: "Search templates" }).fill("zebra")
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByText("No template matches that.")).toBeVisible()
  await expect(page.getByRole("status")).toHaveText("No template matches.")

  await page.getByRole("button", { name: "Show every template" }).click()
  await expect(cards(page)).toHaveCount(every)
  await expect(page.getByRole("searchbox", { name: "Search templates" })).toBeFocused()
})

test("what's typed in the search before the page's script has run still searches", async ({ page }) => {
  const errors = pageErrors(page)
  // The script held back until it's typed, as on a slow connection.
  let typed!: () => void
  const held = new Promise<void>((done) => (typed = done))
  await page.route("**/_next/static/chunks/**", async (route) => {
    await held
    await route.continue()
  })
  await page.goto("/templates", { waitUntil: "domcontentloaded" })
  await page.getByRole("searchbox", { name: "Search templates" }).fill("zebra")
  typed()
  await expect(page.getByText("No template matches that.")).toBeVisible()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByRole("searchbox", { name: "Search templates" })).toHaveValue("zebra")
  expect(errors).toEqual([])
})

test("/ typed in the search is part of the search", async ({ page }) => {
  await page.goto("/templates")
  const search = page.getByRole("searchbox", { name: "Search templates" })
  await search.click()
  await page.keyboard.type("a/b")
  await expect(search).toHaveValue("a/b")
})

test("at most one template is marked new", async ({ page }) => {
  await page.goto("/templates")
  await expect(cards(page).first()).toBeVisible()
  expect(await page.getByRole("main").getByText("New", { exact: true }).count()).toBeLessThanOrEqual(1)
})

test("pointed at, a card's Use plate whitens gradually, and its Use stays lit with the pointer on it", async ({ page }) => {
  await page.goto("/templates")
  await instantScrolling(page)
  await page.getByRole("link", { name: /^Jake's resume template/ }).hover()
  const plate = page.getByRole("link", { name: "Use Jake's", exact: true })
  const use = plate.getByText("Use", { exact: true })

  // Its fade, stopped halfway as it starts. The fill used to snap, and passed in as --search-fill,
  // Chrome painted the fallback fill during the fade.
  await plate.evaluate((el) =>
    el.addEventListener("transitionrun", (event) => {
      if (!(event instanceof TransitionEvent) || event.propertyName !== "--plate-top") return
      const fade = el.getAnimations().find((a): a is CSSTransition => a instanceof CSSTransition && a.transitionProperty === "--plate-top")
      if (!fade) return
      fade.pause()
      fade.currentTime = 100
      el.dataset.halfway = getComputedStyle(el, "::before").backgroundImage
      fade.finish()
    }),
  )
  // Pointed at once it has come up: hidden under the page, it would be missed, and looked for with a scroll.
  await expect(plate).toBeInViewport({ ratio: 1 })
  await plate.hover({ position: { x: 30, y: 30 } })
  await expect(plate).toHaveAttribute("data-halfway", /linear-gradient/)
  const top = Number(
    (await plate.getAttribute("data-halfway"))?.match(/linear-gradient\((?:180deg, )?rgba\(255, 255, 255, ([\d.]+)\)/)?.[1],
  )
  expect(top).toBeGreaterThan(0.66)
  expect(top).toBeLessThan(0.9)

  // Lit as the plate's pointed at, Use stays as lit with the pointer on it: the pointer is still on the plate.
  await expect(use).toHaveCSS("filter", "brightness(1.06)")
  const box = (await use.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(400)
  await expect(use).toHaveCSS("filter", "brightness(1.06)")

  // The pointer passes through Use to the plate, which is the link.
  await page.mouse.down()
  await page.mouse.up()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(await templateChosen(page)).toContainText("Jake's")
})

test("a card's picture leads to its template's page, whose Use starts a resume with it", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/templates")
  await page.getByRole("link", { name: /^Harvard resume template/ }).click()
  await expect(page).toHaveURL(/\/templates\/harvard$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harvard resume template")
  await expect(page.getByRole("img", { name: "Harvard resume template: a sample one-page resume" })).toBeVisible()
  // Back to every template, from the top of the page.
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Templates" })).toHaveAttribute(
    "href",
    "/templates",
  )

  // One Use at the top, and one under what the template's like.
  await expect(page.getByRole("link", { name: "Use Harvard" })).toHaveCount(2)
  await page.getByRole("link", { name: "Use Harvard" }).last().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(await templateChosen(page)).toContainText("Harvard")
  expect(errors).toEqual([])
})

test("each template's page links to the others, and only those first made in LaTeX say it isn't needed", async ({ page }) => {
  await page.goto("/templates/jakes")
  await expect(page.getByText("You don’t need LaTeX or Overleaf")).toBeVisible()
  const others = page.getByRole("navigation", { name: "Other templates" })
  await expect(others.getByRole("link", { name: "Jake's", exact: true })).toHaveCount(0)
  await others.getByRole("link", { name: "Blueprint" }).click()

  await expect(page).toHaveURL(/\/templates\/blueprint$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Blueprint resume template")
  await expect(page.getByText("You don’t need LaTeX or Overleaf")).toHaveCount(0)
})

test("a template's page is at its name, not its id", async ({ request }) => {
  expect((await request.get("/templates/blueprint")).status()).toBe(200)
  expect((await request.get("/templates/levelsfyi")).status()).toBe(404)
})

test("how each template reads: every template's checks, and why where one doesn't read as typed", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/templates/margin")
  await page.getByRole("link", { name: "4 of 5 checks" }).click()
  await expect(page).toHaveURL(/\/templates\/how-they-read$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How each template reads")

  const table = page.getByRole("table", { name: /whether it reads as typed/ })
  await expect(table.getByRole("rowheader")).toHaveText(TEMPLATES.map((template) => template.name))
  const jake = table.getByRole("row", { name: /^Jake's/ })
  await expect(jake.getByText("Reads as typed")).toHaveCount(5)

  // Margin's miss leads to what the test read of it.
  await table
    .getByRole("row", { name: /^Margin/ })
    .getByRole("link", { name: /see why below/ })
    .click()
  await expect(page).toHaveURL(/#margin$/)
  await expect(page.getByRole("heading", { name: "Margin", level: 3 })).toBeInViewport()
  await expect(page.getByText(/heading "Experience" shares a line/)).toBeVisible()
  expect(errors).toEqual([])
})

test("on a phone, how each template reads is a line for each template", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/templates/how-they-read")
  await expect(page.getByRole("table")).toBeHidden()
  await expect(page.getByRole("link", { name: "4 of 5: not Headings" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
})

test.describe("on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("there's nothing to point with, so each card's Use is a button under its name, and its page shows in full", async ({ page }) => {
    const errors = pageErrors(page)
    await page.goto("/templates")
    const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^Compact resume template/ }) })
    // One Use for each card, under the name, with the plate over the page gone.
    const use = card.getByRole("link", { name: "Use Compact" })
    await expect(use).toHaveCount(1)
    await expect(use).toBeVisible()
    const picture = (await card.getByRole("link", { name: /^Compact resume template/ }).boundingBox())!
    expect((await use.boundingBox())!.y).toBeGreaterThan(picture.y + picture.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)

    await use.tap()
    await expect(page).toHaveURL(/\/create\/new\//)
    await expect(await templateChosen(page)).toContainText("Compact")
    expect(errors).toEqual([])
  })
})
