import { expect, test, type Locator, type Page } from "./test"
import { WIDE_SCREEN } from "../src/components/editor/layout"
import { editorHeading, newResume, pageErrors, preview, previewShown, saveResumes, settled } from "./helpers"

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
const BULLETS = "Description"
const LONG_BULLETS = [
  "Built a service that cut page load time by 30% for twelve million monthly visitors across four regions",
  "Led the migration of the billing system from a monolith to event-driven services with zero downtime",
  "Mentored three new engineers and wrote the onboarding guide the team still uses today",
].join("\n")

/** Starts a resume in a `width` × `height` window, with one Experience entry filled in. */
async function writeExperience(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await newResume(page)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await experience(page).click()
  await page.getByRole("button", { name: "Add experience" }).click()
  // A new entry puts the cursor in its first field once it has slid open.
  // Typing before then could land in the wrong field.
  await expect(page.getByLabel("Company", { exact: true })).toBeFocused()
  for (const [label, value] of Object.entries(ENTRY)) await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByLabel(BULLETS).fill(LONG_BULLETS)
}

const experience = (page: Page) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^Experience$/ })
const views = (page: Page) => page.getByRole("group", { name: "View" })
/** Whether the page's own check for a wide screen passes, which some scrolling depends on. */
const wideByScript = (page: Page) => page.evaluate((query) => matchMedia(query).matches, WIDE_SCREEN)
/** How many pixels of the bullets don't show; the box should grow to show them all. */
const bulletsHidden = (page: Page) => page.getByLabel(BULLETS).evaluate((box) => box.scrollHeight - box.clientHeight)

/**
 * How wide a box's text is, drawn in the box's own font and letter-spacing,
 * and how wide the box is inside its padding. A text box's scrollWidth doesn't
 * reliably show a clipped value, so the text is measured instead.
 */
const textFit = (input: Locator) =>
  input.evaluate((box: HTMLInputElement) => {
    const style = getComputedStyle(box)
    const context = document.createElement("canvas").getContext("2d")!
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    // "normal" is no extra space; otherwise it's after every letter.
    const spacing = (parseFloat(style.letterSpacing) || 0) * [...box.value].length
    return {
      needed: Math.ceil(context.measureText(box.value).width + spacing),
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
    await expect(editorHeading(page, "Experience")).toBeHidden()
    await views(page).getByRole("button", { name: "Edit" }).click()
    await expect(editorHeading(page, "Experience")).toBeVisible()
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
  await newResume(page)
  await experience(page).click()
  await page.getByRole("button", { name: "Add experience" }).click()
  // Into Role straight away, before the entry has finished sliding open.
  const role = page.getByLabel("Role", { exact: true })
  await role.focus()
  // Past the slide, when a new entry puts the cursor in its first field.
  await settled(role)
  await expect(role).toBeFocused()
  await page.keyboard.type("Analyst")
  await expect(role).toHaveValue("Analyst")
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue("")
  expect(errors).toEqual([])
})

test("on a wide screen, the rail's tip names the section and says how many entries it has", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await newResume(page)
  // The number isn't part of the button's name, as the form lists the entries.
  await expect(experience(page)).toHaveText(/^Experience$/)

  await experience(page).click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Role", { exact: true }).fill("Analyst")
  await page.getByRole("button", { name: "Add experience" }).click()
  await experience(page).hover()
  await expect(page.getByText(/^Experience\s*2$/)).toBeVisible()
  // Sections with nothing in them have no number.
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Projects$/ })
    .hover()
  // Its name is in the tip, and in its button for screen readers.
  await expect(page.getByText(/^Projects$/)).toHaveCount(2)
  await expect(page.getByText(/^Projects\s*\d+$/)).toHaveCount(0)
  await expect(page.getByText(/^Experience\s*2$/)).toBeHidden()
  await expect(preview(page).getByText("Analyst").first()).toBeVisible()
  expect(errors).toEqual([])
})

test("on a wide screen, the form can be hidden for a bigger page, and choosing a section brings it back", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await newResume(page)
  await previewShown(page)
  const pageWidth = async () => (await preview(page).locator(".react-pdf__Page__canvas").first().boundingBox())!.width
  const before = await pageWidth()
  const name = page.getByLabel("Full name", { exact: true })
  await expect(name).toBeVisible()

  await page.getByRole("button", { name: "Hide the form" }).click()
  await expect(name).toBeHidden()
  await expect(page.getByRole("button", { name: "Show the form" })).toHaveAttribute("aria-expanded", "false")
  await expect.poll(pageWidth).toBeGreaterThan(before + 100)

  await page.getByRole("button", { name: "Show the form" }).click()
  await expect(name).toBeVisible()
  await page.getByRole("button", { name: "Hide the form" }).click()
  await experience(page).click()
  await expect(editorHeading(page, "Experience", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Hide the form" })).toHaveAttribute("aria-expanded", "true")
  expect(errors).toEqual([])
})

test("on a wide screen, the form slides away and back, and the page grows and shrinks with it, rather than at once", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await newResume(page)
  await previewShown(page)
  const region = preview(page)

  /**
   * The preview's and its page's widths, each frame from just before the click until a while after it: a
   * window of time rather than a count of frames, as WebKit in CI draws few frames a second, and its click
   * can take longer than the slide.
   */
  const widthsWhile = async (click: () => Promise<void>) => {
    const recording = await region.evaluateHandle((region) => {
      const frames: { panel: number; page: number }[] = []
      const state = { until: Infinity, done: Promise.resolve(frames) }
      state.done = new Promise((resolve) => {
        const record = (now: number) => {
          const canvas = region.querySelector("canvas")
          frames.push({ panel: region.getBoundingClientRect().width, page: canvas?.getBoundingClientRect().width ?? 0 })
          if (now < state.until) requestAnimationFrame(record)
          else resolve(frames)
        }
        requestAnimationFrame(record)
      })
      return state
    })
    await click()
    // The slide takes 300ms (useFold), and the page settles 150ms after it.
    const frames = await recording.evaluate((state) => {
      state.until = performance.now() + 800
      return state.done
    })
    await recording.dispose()
    return frames
  }
  /**
   * How many frames were part way between the first and the last. One is enough to show it didn't change at
   * once: CI's machines draw few frames while the form slides, as few as one of the 300ms.
   */
  const between = (values: number[]) => {
    const [low, high] = [Math.min(values[0], values.at(-1)!), Math.max(values[0], values.at(-1)!)]
    return values.filter((value) => value > low + 2 && value < high - 2).length
  }

  const hiding = await widthsWhile(() => page.getByRole("button", { name: "Hide the form" }).click())
  expect(hiding.at(-1)!.panel).toBeGreaterThan(hiding[0].panel + 300)
  expect(between(hiding.map((frame) => frame.panel))).toBeGreaterThanOrEqual(1)
  expect(between(hiding.map((frame) => frame.page))).toBeGreaterThanOrEqual(1)

  const showing = await widthsWhile(() => experience(page).click())
  expect(showing.at(-1)!.panel).toBeLessThan(showing[0].panel - 300)
  expect(between(showing.map((frame) => frame.panel))).toBeGreaterThanOrEqual(1)
  expect(between(showing.map((frame) => frame.page))).toBeGreaterThanOrEqual(1)
  await expect(editorHeading(page, "Experience", { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test("a folded entry with a long name stays as wide as the form, its name cut short", async ({ page }) => {
  const errors = pageErrors(page)
  // The form is too narrow for these names on one line.
  await page.setViewportSize({ width: 1440, height: 900 })
  const paper = (id: number, publicationTitle: string, publicationVenue: string) => ({ id, publicationTitle, publicationVenue })
  await saveResumes(page, [
    {
      id: "long-names",
      resumeTitle: "Long names",
      updatedAt: "2026-10-20T12:00:00.000Z",
      selectedTemplate: "jake",
      profileSection: { fullName: "Ada Lovelace" },
      publicationsSection: [
        paper(
          1,
          "Integrating Safe Exam Browser with Canvas LMS for proctored programming exams",
          "Computer Science Capstone Project Report",
        ),
        paper(2, "Rethinking pedagogy in the AI age: what students actually do with chat assistants", "B.S. honors thesis"),
      ],
    },
  ])
  await page.goto("/create/new/long-names")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Publications$/ })
    .click()
  await expect(editorHeading(page, "Publications")).toBeVisible()

  // Each card, open or folded, ends where the Add button under the list does, so its buttons stay in view.
  const add = await page.getByRole("button", { name: "Add publication" }).boundingBox()
  const toggles = page.getByRole("button", { name: /^(Edit|Done editing) entry \d$/ })
  await expect(toggles).toHaveCount(2)
  for (const toggle of await toggles.all()) {
    const box = await toggle.boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(add!.x + add!.width)
  }
  expect(errors).toEqual([])
})
