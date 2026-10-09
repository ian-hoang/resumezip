import { expect, test, type Locator, type Page } from "@playwright/test"
import { WIDE_SCREEN } from "../src/components/editor/layout"
import { pageErrors } from "./helpers"

// The editor puts the form beside the preview only where both have room
// (components/editor/layout.ts). Narrower, an Edit / Preview switch shows one
// at a time, and the form's fields fit the form's own width.

const ENTRY = {
  Role: "Software Engineer",
  Company: "Example Company",
  Location: "Mountain View, CA",
  Start: "Jan 2024",
  End: "Present",
}
const BULLETS = "What you did · one bullet per line"
const LONG_BULLETS = [
  "Built a service that cut page load time by 30% for twelve million monthly visitors across four regions",
  "Led the migration of the billing system from a monolith to event-driven services with zero downtime",
  "Mentored three new engineers and wrote the onboarding guide the team still uses today",
].join("\n")

/** Starts a resume in a `width` × `height` window, with one Experience entry filled in. */
async function writeExperience(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await experience(page).click()
  await page.getByRole("button", { name: "Add experience" }).click()
  // A new entry puts the cursor in its first field once it has slid open.
  // Typing before then could land in the wrong field.
  await expect(page.getByLabel("Role", { exact: true })).toBeFocused()
  for (const [label, value] of Object.entries(ENTRY)) await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByLabel(BULLETS).fill(LONG_BULLETS)
}

const experience = (page: Page) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^\d+ Experience$/ })
const preview = (page: Page) => page.getByRole("region", { name: "Live preview" })
const views = (page: Page) => page.getByRole("group", { name: "View" })
/** Whether the page's own check for a wide screen passes, which some scrolling depends on. */
const wideByScript = (page: Page) => page.evaluate((query) => matchMedia(query).matches, WIDE_SCREEN)
/** How many pixels of the bullets don't show; the box should grow to show them all. */
const bulletsHidden = (page: Page) => page.getByLabel(BULLETS).evaluate((box) => box.scrollHeight - box.clientHeight)

/**
 * How wide a box's text is, drawn in the box's own font, and how wide the box
 * is inside its padding. A text box's scrollWidth doesn't reliably show a
 * clipped value, so the text is measured instead.
 */
const textFit = (input: Locator) =>
  input.evaluate((box: HTMLInputElement) => {
    const style = getComputedStyle(box)
    const context = document.createElement("canvas").getContext("2d")!
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    return {
      needed: Math.ceil(context.measureText(box.value).width),
      shown: box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    }
  })

/** Whether the form and the preview sit side by side, on one row, rather than one above the other. */
async function sideBySide(page: Page) {
  const form = (await page.getByRole("main").boundingBox())!
  const shown = (await preview(page).boundingBox())!
  return shown.x >= form.x + form.width - 1 && shown.y < form.y + form.height && form.y < shown.y + shown.height
}

/**
 * How far the Location box sits below the top of what shows of the form: its
 * own pane on wide screens, below the pinned bars on narrower ones.
 */
const locationFromTop = (page: Page) =>
  page.getByLabel("Location", { exact: true }).evaluate((input) => {
    const form = input.closest("main")!
    const bar = document.querySelector("aside[data-covers=top]")!
    const wide = getComputedStyle(form).overflowY === "auto"
    const top = wide ? form.getBoundingClientRect().top : Math.max(0, bar.getBoundingClientRect().bottom)
    return input.getBoundingClientRect().top - top
  })

for (const [width, height, split] of [
  [390, 844, false],
  [1024, 768, false],
  [1280, 800, true],
  [1440, 900, true],
] as const) {
  test(`at ${width}px wide, a filled-in entry is easy to read`, async ({ page }) => {
    const errors = pageErrors(page)
    await writeExperience(page, width, height)

    // Every value shows in full, in a box wide enough to edit it.
    for (const [label, value] of Object.entries(ENTRY)) {
      const input = page.getByLabel(label, { exact: true })
      await expect(input).toHaveValue(value)
      const { shown, needed } = await textFit(input)
      expect(needed, `all of "${value}" shows`).toBeLessThanOrEqual(shown)
      expect(shown, `the ${label} box is wide enough to edit`).toBeGreaterThanOrEqual(120)
    }
    await expect.poll(() => bulletsHidden(page)).toBeLessThanOrEqual(0)

    // The preview sits beside the form only where there's room for both;
    // otherwise the switch shows one at a time.
    if (split) {
      await expect(preview(page)).toBeVisible()
      expect(await sideBySide(page)).toBe(true)
      await expect(views(page)).toBeHidden()
    } else {
      await expect(preview(page)).toBeHidden()
      await expect(views(page)).toBeVisible()
    }
    expect(await wideByScript(page)).toBe(split)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

    expect(errors).toEqual([])
  })
}

test("resizing keeps the section, what's typed and the controls, and the bullets stay whole", async ({ page }) => {
  const errors = pageErrors(page)
  await writeExperience(page, 1440, 900)

  // Across the line where the preview moves beside the form (1279 → 1280), and back.
  for (const [width, height, split] of [
    [1280, 800, true],
    [1279, 800, false],
    [1024, 768, false],
    [390, 844, false],
    [1440, 900, true],
  ] as const) {
    await page.setViewportSize({ width, height })

    // Still on Experience, with everything typed in it.
    await expect(experience(page)).toHaveAttribute("aria-current", "true")
    for (const [label, value] of Object.entries(ENTRY)) await expect(page.getByLabel(label, { exact: true })).toHaveValue(value)
    // A narrower box wraps onto more lines, and grows to show them.
    await expect.poll(() => bulletsHidden(page), { message: `bullets show in full at ${width}px` }).toBeLessThanOrEqual(0)

    // The layout and the page's script agree, right at the edge too.
    expect(await wideByScript(page), `the script's check at ${width}px`).toBe(split)
    if (split) {
      await expect(preview(page)).toBeVisible()
      expect(await sideBySide(page), `the preview is beside the form at ${width}px`).toBe(true)
      continue
    }
    // Where the preview can't sit beside the form, the switch shows it and
    // comes back. With a mouse it works even while a field has focus.
    await page.getByLabel("Role", { exact: true }).focus()
    await views(page).getByRole("button", { name: "Preview" }).click()
    await expect(preview(page)).toBeVisible()
    await expect(page.getByRole("heading", { name: "Experience" })).toBeHidden()
    await views(page).getByRole("button", { name: "Edit" }).click()
    await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible()
  }

  expect(errors).toEqual([])
})

test("crossing 1280px keeps the form where it was scrolled to", async ({ page }) => {
  const errors = pageErrors(page)
  // A short window, so the form has room to scroll.
  await writeExperience(page, 1440, 450)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const location = page.getByLabel("Location", { exact: true })
  // The page notes where the form is scrolled to when the scroll event
  // arrives, with the next frame, so Location has to still be at the top
  // then. The new entry may still be scrolling smoothly into view, and WebKit
  // can carry on with that after this scroll, so it's scrolled again until it
  // stays.
  await expect
    .poll(
      async () => {
        await location.evaluate((input) => input.scrollIntoView({ block: "start", behavior: "instant" }))
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
        return Math.abs(await locationFromTop(page))
      },
      { message: "Location stays at the top before the window is resized" },
    )
    .toBeLessThan(2)

  // The form scrolls with the page below 1280px and in its own pane above,
  // and Location stays at the top of it either way.
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 450 })
    await expect
      .poll(async () => Math.abs(await locationFromTop(page)), { message: `Location stays at the top at ${width}px` })
      .toBeLessThan(2)
  }

  expect(errors).toEqual([])
})

test("a field chosen while a new entry slides open keeps the cursor", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await experience(page).click()
  await page.getByRole("button", { name: "Add experience" }).click()
  // Into Company straight away, before the entry has finished sliding open.
  const company = page.getByLabel("Company", { exact: true })
  await company.focus()
  // Past the slide, when a new entry puts the cursor in its first field.
  await page.waitForTimeout(600)
  await expect(company).toBeFocused()
  await page.keyboard.type("Analytical Engines")
  await expect(company).toHaveValue("Analytical Engines")
  await expect(page.getByLabel("Role", { exact: true })).toHaveValue("")
  expect(errors).toEqual([])
})

test("on a wide screen, the section list says how many entries each section has", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  // The number isn't part of the button's name, as the form lists the entries.
  await expect(experience(page)).toHaveText(/Experience$/)

  await experience(page).click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Role", { exact: true }).fill("Analyst")
  await expect(experience(page)).toHaveText(/Experience\s*1$/)
  await page.getByRole("button", { name: "Add experience" }).click()
  await expect(experience(page)).toHaveText(/Experience\s*2$/)
  // Sections with nothing in them have no number.
  await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^\d+ Projects$/ })).toHaveText(/Projects$/)
  await expect(preview(page).getByText("Analyst").first()).toBeVisible()
  expect(errors).toEqual([])
})
