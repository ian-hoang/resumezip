import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { chooseTemplate, holdablePreviews, holdPreviews, pageErrors, seriousAccessibilityProblems, settled } from "./helpers"

// The editor's left bar switches between the sections (Write) and what the
// checker found (Check), and remembers which for the visit.

async function newResume(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
}

/** A new resume with a name and an entry, so there's something to check, and its preview on screen. */
async function resumeToCheck(page: Page) {
  await newResume(page)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^\d+ Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await expect(page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()
}

/** The Jake template's sample resume, which passes every check, saved with these changes to its profile, and opened. */
async function openSample(page: Page, id: string, profile: Record<string, string> = {}) {
  const sample = JSON.parse(readFileSync("src/lib/typst/preview-samples/jake.json", "utf8"))
  const resume = { ...sample, id, resumeTitle: "Marcus", profileSection: { ...sample.profileSection, ...profile } }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: `resume:${id}`, value: JSON.stringify(resume) },
  )
  await page.goto(`/create/new/${id}`)
}

// The score's colors (SCORE_COLORS, styles/editor.css), as computed.
const RED = "rgb(180, 35, 24)"
const GREEN = "rgb(6, 118, 71)"
const VIOLET = "rgb(89, 37, 220)"

/** Waits for the score's number, its word and its ring's arc to be drawn in a color, once any fade is done. */
async function scoreIn(score: Locator, word: string, color: string) {
  await expect(score.getByText(/^\d+$/)).toHaveCSS("color", color)
  await expect(score.getByText(word, { exact: true })).toHaveCSS("color", color)
  // The ring's track, then its arc.
  await expect(score.locator("circle").nth(1)).toHaveCSS("stroke", color)
}

/** Whether the ring a perfect score has, in a gradient over the arc, shows. */
const perfectRingShown = (score: Locator) =>
  score.evaluate((element) =>
    [...element.querySelectorAll("span")].some((span) => {
      const style = getComputedStyle(span)
      return style.backgroundImage.startsWith("conic-gradient") && style.opacity === "1"
    }),
  )

/** The names of the CSS animations in an element, running or done. */
const animationNamesIn = (locator: Locator) =>
  locator.evaluate((element) =>
    document
      .getAnimations()
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return "animationName" in animation && !!target && element.contains(target)
      })
      .map((animation) => (animation as CSSAnimation).animationName),
  )

/** How many CSS animations, as a spinner's, are running in an element. Transitions don't count. */
const animationsIn = (locator: Locator) =>
  locator.evaluate(
    (element) =>
      document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return "animationName" in animation && animation.playState === "running" && !!target && element.contains(target)
      }).length,
  )

/**
 * Notes how much of each arc added to the score ring is drawn the moment it's
 * added, in percent, until the returned function is called.
 */
async function watchArcs(score: Locator): Promise<() => Promise<number[]>> {
  const watching = await score.evaluateHandle((element) => {
    const drawn: number[] = []
    const observer = new MutationObserver((records) => {
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        if (!(node instanceof SVGCircleElement)) continue
        // Read before it's painted: a transition that's just started is still where it starts from.
        const style = getComputedStyle(node)
        drawn.push(Math.round(100 * (1 - parseFloat(style.strokeDashoffset) / parseFloat(style.strokeDasharray))))
      }
    })
    observer.observe(element, { childList: true, subtree: true })
    return { drawn, stop: () => observer.disconnect() }
  })
  return async () => {
    const drawn = await watching.evaluate(({ drawn, stop }) => {
      stop()
      return drawn
    })
    await watching.dispose()
    return drawn
  }
}

test("the left bar switches between writing and checking, and remembers which", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const modes = page.getByRole("tablist", { name: "Write, check or style" })
  const write = modes.getByRole("tab", { name: "Write" })
  const check = modes.getByRole("tab", { name: /^Check/ })
  const sections = page.getByRole("navigation", { name: "Sections" })

  // It opens on Write, with the section list as it's always been.
  await expect(write).toHaveAttribute("aria-selected", "true")
  // A name and an entry, so there's something to check: a resume with nothing
  // to check yet always opens on Write.
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await sections.getByRole("button", { name: /^\d+ Experience$/ }).click()
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Role").fill("Analyst")

  // Check puts the checker where the section list was, and leaves the form as it was.
  await check.click()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await expect(sections).toBeHidden()
  await expect(page.getByRole("tabpanel", { name: /^Check/ })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // Arrow keys, Home and End move between the three, as in any set of tabs.
  const style = modes.getByRole("tab", { name: "Style" })
  await check.focus()
  for (const [key, tab] of [
    ["ArrowLeft", write],
    ["End", style],
    ["Home", write],
    ["ArrowRight", check],
  ] as const) {
    await page.keyboard.press(key)
    await expect(tab).toBeFocused()
    await expect(tab).toHaveAttribute("aria-selected", "true")
  }

  // The mode stays after a reload, until it's switched back. Each reload
  // waits for the preview, so the PDF compiler's download isn't cut off,
  // which Safari logs as an error, and in Check for the score, so the
  // checker's reader isn't either.
  const preview = page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()
  const score = page
    .getByRole("tabpanel", { name: /^Check/ })
    .getByRole("region", { name: "Resume score" })
    .locator("[aria-live=polite]")
  const checked = () => expect(score).toContainText(/^\d+\s*\/ 100\s*out of 100$/)
  await expect(preview).toBeVisible()
  await checked()
  await page.reload()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await checked()
  await write.click()
  await expect(preview).toBeVisible()
  await page.reload()
  await expect(write).toHaveAttribute("aria-selected", "true")
  await expect(sections).toBeVisible()

  // It's remembered for the visit, not for good: a new tab opens on Write.
  await check.click()
  await checked()
  const later = await page.context().newPage()
  await later.goto(page.url())
  await expect(later.getByRole("tab", { name: "Write" })).toHaveAttribute("aria-selected", "true")
  await expect(later.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()
  await later.close()

  // In this tab Check is still remembered, so the resume opens on Check from
  // a freshly loaded dashboard too, but a new resume, with nothing to check
  // yet, opens on Write.
  await page.goto("/create/dashboard")
  await page.getByRole("list", { name: "Resumes" }).getByRole("link").first().click()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await expect(preview).toBeVisible()
  await checked()
  await page.getByRole("link", { name: "Your resumes" }).click()
  await page.getByRole("button", { name: "New resume" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(write).toHaveAttribute("aria-selected", "true")
  await expect(preview).toBeVisible()

  expect(errors).toEqual([])
})

test("the checker asks for a name and an entry first, then scores the resume and lists what to fix by category", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const write = page.getByRole("tab", { name: "Write" })
  const check = page.getByRole("tab", { name: /^Check/ })
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  const score = panel.getByRole("region", { name: "Resume score" })

  await check.click()
  const waiting = panel.getByText("Add your name and some section content to check this resume.")
  await expect(waiting).toBeVisible()
  await expect(score).toContainText("Not scored yet")

  // The form stays beside the checker, so the name can be typed straight in.
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await write.click()
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^\d+ Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await check.click()
  await expect(waiting).toBeHidden()
  await expect(score.getByText(/^\d+$/)).toBeVisible()
  // Screen readers are told the score as it changes.
  await expect(score.locator("[aria-live=polite]")).toContainText(/^\d+\s*\/ 100\s*out of 100$/)

  // A category with something to fix is open, lists it, and folds from the
  // keyboard. What passed isn't listed.
  const contact = panel.getByRole("button", { name: /^Contact & personal details, 1 to fix/ })
  await expect(contact).toHaveAttribute("aria-expanded", "true")
  const email = panel.getByRole("button", { name: /Add your email address/ })
  await expect(email).toBeVisible()
  await contact.focus()
  await page.keyboard.press("Enter")
  await expect(contact).toHaveAttribute("aria-expanded", "false")
  // What's folding away can't be reached with Tab, even while it slides shut:
  // checked at once, as it loses the focus anyway once it's shut.
  await page.keyboard.press("Tab")
  const folding = panel.getByRole("button", { name: /Add your email address/, includeHidden: true })
  expect(await folding.evaluate((button) => button === document.activeElement)).toBe(false)
  await expect(email).toBeHidden()
  await contact.focus()
  await page.keyboard.press("Space")
  await expect(contact).toHaveAttribute("aria-expanded", "true")
  // Once everything's checked: not the checks it passed, in Contact or anywhere,
  // nor a category with nothing to fix, nor what the templates guarantee.
  await expect(panel.getByRole("status")).toBeHidden()
  await expect(panel.getByText("No Social Security number")).toHaveCount(0)
  await expect(panel.getByText(/^Passed/)).toHaveCount(0)
  await expect(panel.getByRole("button", { name: /^Readable by hiring software/ })).toHaveCount(0)
  await expect(panel.getByText("Real text that can be selected and copied")).toHaveCount(0)

  // A word says how the score reads, a line what it measures, and another
  // that the must-fixes hold it down.
  await expect(score).toContainText("Needs work")
  await expect(score).toContainText("How well this resume follows the checks below.")
  await expect(score).toContainText("Capped at 89 until you fix 4 items.")
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  expect(errors).toEqual([])
})

test("the score goes up as a problem is fixed", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email").fill("ada@example")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^\d+ Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await page
    .getByRole("tablist", { name: "Write, check or style" })
    .getByRole("tab", { name: /^Check/ })
    .click()

  // The contact category is open, as it has something to fix, and lists it.
  const contact = panel.getByRole("button", { name: /^Contact & personal details, 1 to fix/ })
  await expect(contact).toHaveAttribute("aria-expanded", "true")
  const email = panel.getByRole("button", { name: /Not a whole email address/ })
  await expect(email).toBeVisible()

  const number = panel.getByRole("region", { name: "Resume score" }).getByText(/^\d+$/)
  await expect(panel.getByRole("status")).toBeHidden()
  const before = Number(await number.textContent())
  await email.click()
  await page.getByLabel("Email").fill("ada@example.com")
  await expect.poll(async () => Number(await number.textContent())).toBeGreaterThan(before)
  await expect(panel.getByRole("button", { name: /^Contact & personal details/ })).not.toHaveAccessibleName(/to fix/)

  expect(errors).toEqual([])
})

test("the resume is checked again once typing pauses, not at every key, and a dismissal shows at once", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await resumeToCheck(page)
  const check = page.getByRole("tab", { name: /^Check/ })
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  await check.click()
  await expect(panel.getByRole("status")).toBeHidden()
  const missing = panel.getByRole("button", { name: /Add your email address/ })
  await missing.click()
  const email = page.getByLabel("Email")
  await expect(email).toBeFocused()
  const count = Number((await check.getAttribute("aria-label"))?.match(/^Check, (\d+) to look at$/)?.[1])
  expect(count).toBeGreaterThan(2)

  // With the page's clock stopped, typing never pauses. What the person
  // tells the checker still shows at once.
  await page.clock.pauseAt(Date.now() + 1_000)
  const advice = panel.getByRole("button", { name: /Profile → LinkedIn Consider adding a LinkedIn profile/ })
  await panel.getByRole("button", { name: "Dismiss: Consider adding a LinkedIn profile" }).click()
  await expect(advice).toBeHidden()
  await expect(check).toHaveAccessibleName(`Check, ${count - 1} to look at`)

  // What's typed isn't checked yet: a fixed wait, to show nothing changes.
  await email.pressSequentially("ada@example.com")
  await page.waitForTimeout(1_000)
  await expect(missing).toBeVisible()
  await expect(check).toHaveAccessibleName(`Check, ${count - 1} to look at`)

  // Once typing pauses, it is.
  await page.clock.resume()
  await expect(missing).toBeHidden()
  await expect(panel.getByRole("status")).toBeHidden()
  await expect(check).toHaveAccessibleName(`Check, ${count - 2} to look at`)

  expect(errors).toEqual([])
})

test("the score ring moves while the score is worked out: an arc runs round it, it fills up to the score, and it pulses while checked again", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await holdablePreviews(page)
  await resumeToCheck(page)
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  const score = panel.getByRole("region", { name: "Resume score" })

  // A change the preview hasn't caught up with keeps the checks on the PDF
  // waiting, and the score with them. Meanwhile an arc runs round the ring.
  await holdPreviews(page, true)
  await page.getByLabel("Role").fill("Analyst")
  await page.getByRole("tab", { name: /^Check/ }).click()
  await expect(score).toContainText("Checking")
  await expect.poll(() => animationsIn(score)).toBeGreaterThan(0)

  // Once the score is in, the ring fills up to it from empty, then stops moving.
  const arcs = await watchArcs(score)
  await holdPreviews(page, false)
  await expect(score.getByText(/^\d+$/)).toBeVisible()
  expect(await arcs()).toEqual([0])
  await expect(panel.getByRole("status")).toBeHidden()
  await expect.poll(() => animationsIn(score)).toBe(0)

  // Checked again after a change, the ring keeps the score and pulses until it's done.
  await holdPreviews(page, true)
  await page.getByLabel("Role").fill("Lead analyst")
  await expect(panel.getByRole("status")).toContainText("Checking the PDF…")
  await expect(score.getByText(/^\d+$/)).toBeVisible()
  await expect.poll(() => animationsIn(score)).toBeGreaterThan(0)
  await holdPreviews(page, false)
  await expect(panel.getByRole("status")).toBeHidden()
  await expect.poll(() => animationsIn(score)).toBe(0)

  expect(errors).toEqual([])
})

test("the score's color says how it reads: red when it needs work, green when it's good, and a perfect score shines once", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await resumeToCheck(page)
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  const score = panel.getByRole("region", { name: "Resume score" })
  await page.getByRole("tab", { name: /^Check/ }).click()
  await expect(panel.getByRole("status")).toBeHidden()
  await scoreIn(score, "Needs work", RED)
  expect(await perfectRingShown(score)).toBe(false)

  // A good resume, held at 89 by a missing email (Check stays open for the visit).
  await openSample(page, "no-email", { email: "" })
  await expect(panel.getByRole("status")).toBeHidden()
  await scoreIn(score, "Good", GREEN)

  // With the email added, every check passes: the ring turns to a gradient
  // that a light sweeps round once, and the number glows.
  await panel.getByRole("button", { name: /Add your email address/ }).click()
  await page.getByLabel("Email").fill("marcus.bell@example.com")
  await expect(score.getByText(/^\d+$/)).toHaveText("100")
  await scoreIn(score, "Perfect", VIOLET)
  await expect.poll(() => perfectRingShown(score)).toBe(true)
  await expect.poll(() => animationNamesIn(score)).toContain("score-sweep")
  await expect.poll(() => animationsIn(score)).toBe(0)
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  expect(errors).toEqual([])
})

test("the Check tab's count stays put while a new template's PDF is read, rather than counting the form's rules alone", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await holdablePreviews(page)
  await resumeToCheck(page)
  const checkTab = page.getByRole("tab", { name: /^Check/ })
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  await checkTab.click()
  await expect(panel.getByRole("region", { name: "Resume score" }).getByText(/^\d+$/)).toBeVisible()
  await expect(panel.getByRole("status")).toBeHidden()
  const before = await checkTab.textContent()

  // The new template's preview waits on its way to the compiler, so its PDF can't be read yet.
  await holdPreviews(page, true)
  await chooseTemplate(page, "Harvard")
  await checkTab.click()
  await expect(panel.getByRole("status")).toContainText("Checking the PDF…")
  await expect(checkTab).toHaveText(before!)

  await holdPreviews(page, false)
  await expect(panel.getByRole("status")).toBeHidden()
  expect(errors).toEqual([])
})

test("choosing a finding opens its field, where it shows while Check is open, fixing it clears it, and a suggestion can be dismissed", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await newResume(page)
  const modes = page.getByRole("tablist", { name: "Write, check or style" })
  const check = modes.getByRole("tab", { name: /^Check/ })
  const panel = page.getByRole("tabpanel", { name: /^Check/ })

  // No count until there's a name and an entry to check.
  await expect(check).toHaveAccessibleName("Check")
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email").fill("ada@example")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^\d+ Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await expect(check).toHaveAccessibleName(/^Check, \d+ to look at$/)

  // The email's finding opens the profile, with the cursor in the field and why it matters under it.
  await check.click()
  const email = panel.getByRole("button", { name: /Not a whole email address/ })
  await email.click()
  const field = page.getByLabel("Email")
  await expect(field).toBeFocused()
  await expect(field).toHaveAttribute("aria-invalid", "true")
  const why = page.getByText("Recruiters reply by email, and application forms ask for it, so it has to work.")
  await expect(why).toBeVisible()

  // Back in Write mode the field is left plain, until Check is open again.
  await modes.getByRole("tab", { name: "Write" }).click()
  await expect(why).toBeHidden()
  await expect(field).not.toHaveAttribute("aria-invalid")
  await check.click()
  await expect(why).toBeVisible()
  await expect(field).toHaveAttribute("aria-invalid", "true")
  await field.fill("ada@example.com")
  await expect(email).toBeHidden()
  await expect(field).not.toHaveAttribute("aria-invalid")

  // Missing work identity is a fix; optional LinkedIn advice can be dismissed.
  const role = panel.getByRole("button", { name: /^Experience → .* No role$/ })
  await expect(role).toBeVisible()
  await expect(panel.getByRole("button", { name: "Dismiss: No role" })).toHaveCount(0)
  const advice = panel.getByRole("button", { name: /Profile → LinkedIn Consider adding a LinkedIn profile/ })
  await expect(advice).toBeVisible()
  await panel.getByRole("button", { name: "Dismiss: Consider adding a LinkedIn profile" }).click()
  await expect(advice).toBeHidden()
  await panel.getByText("Dismissed · 1").click()
  await panel.getByRole("button", { name: "Bring back: Consider adding a LinkedIn profile" }).click()
  await expect(advice).toBeVisible()

  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  expect(errors).toEqual([])
})

/** How wide each line a paragraph wraps onto is. */
const lineWidths = (paragraph: Locator) =>
  paragraph.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const lines = new Map<number, number>()
    for (const rect of range.getClientRects()) lines.set(Math.round(rect.top), (lines.get(Math.round(rect.top)) ?? 0) + rect.width)
    return [...lines.values()]
  })

test("the note under a field doesn't leave a word or two on a line of their own, and sets its sentences apart", async ({ page }) => {
  const errors = pageErrors(page)
  // At this width the email's reason runs a word or two past one line.
  await page.setViewportSize({ width: 480, height: 900 })
  await newResume(page)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email").fill("ada@example")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^\d+ Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await page
    .getByRole("tablist", { name: "Write, check or style" })
    .getByRole("tab", { name: /^Check/ })
    .click()
  await page
    .getByRole("tabpanel", { name: /^Check/ })
    .getByRole("button", { name: /Not a whole email address/ })
    .click()

  const why = page.getByText("Recruiters reply by email, and application forms ask for it, so it has to work.")
  const suggestion = page.getByText("Check the email spelling and domain, like jake@gmail.com.")
  await expect(why).toBeVisible()
  // Measured once the section has faded in, as it grows into place.
  await settled(why)
  const widths = await lineWidths(why)
  expect(widths).toHaveLength(2)
  expect(Math.min(...widths)).toBeGreaterThan(Math.max(...widths) / 2)
  // Both measured at once: the form is still scrolling smoothly to the field, so two
  // measurements a moment apart could each be taken at a different place.
  const gap = await why.evaluate(
    (element, other) => other!.getBoundingClientRect().top - element.getBoundingClientRect().bottom,
    await suggestion.elementHandle(),
  )
  expect(gap).toBeGreaterThanOrEqual(8)

  expect(errors).toEqual([])
})

test("with Check open, the PDF is read too: a bullet that runs three lines is flagged and opens", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const check = page.getByRole("tablist", { name: "Write, check or style" }).getByRole("tab", { name: /^Check/ })
  const panel = page.getByRole("tabpanel", { name: /^Check/ })

  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^\d+ Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  const bullets = page.getByLabel(/^What you did/)
  await bullets.fill(
    "Wrote the first published algorithm for the Analytical Engine, a method for computing Bernoulli numbers that ran to " +
      "twenty-five steps, and explained in seven long notes how the engine could act on symbols as well as numbers, " +
      "which later readers took as the first description of a general-purpose computer and of programming itself",
  )

  // The layout rules read the preview once Check is open, and point at the bullet.
  await check.click()
  const long = panel.getByRole("button", { name: /^Experience → .* Runs \d+ lines$/ })
  await expect(long).toBeVisible()
  await expect(panel.getByText("Checking the PDF…")).toBeHidden()
  await long.click()
  await expect(bullets).toBeFocused()

  expect(errors).toEqual([])
})

test("when the preview can't be built, the checker says its PDF checks are left out", async ({ page }) => {
  const errors = pageErrors(page)
  // The compiler's worker fails each resume it's given, as in download.spec.ts.
  await page.addInitScript(() => {
    const RealWorker = window.Worker
    window.Worker = class extends RealWorker {
      postMessage(message: any, options?: any) {
        if (message?.template === undefined) return super.postMessage(message, options)
        setTimeout(() => this.onerror?.call(this, new ErrorEvent("error", { message: "Typst crashed" })))
      }
    }
  })
  await newResume(page)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^\d+ Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")

  await page
    .getByRole("tablist", { name: "Write, check or style" })
    .getByRole("tab", { name: /^Check/ })
    .click()
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  await expect(panel.getByRole("status")).toContainText("The preview couldn't be built, so the checks on the PDF are left out.")
  expect(errors).toEqual([])
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("the score ring stays still: nothing runs round it, it shows the score at once, and it doesn't pulse", async ({ page }) => {
    const errors = pageErrors(page)
    await holdablePreviews(page)
    await resumeToCheck(page)
    const panel = page.getByRole("tabpanel", { name: /^Check/ })
    const score = panel.getByRole("region", { name: "Resume score" })

    await holdPreviews(page, true)
    await page.getByLabel("Role").fill("Analyst")
    await page.getByRole("tab", { name: /^Check/ }).click()
    await expect(score).toContainText("Checking")
    expect(await animationsIn(score)).toBe(0)

    const arcs = await watchArcs(score)
    await holdPreviews(page, false)
    await expect(score.getByText(/^\d+$/)).toBeVisible()
    const [drawn] = await arcs()
    expect(drawn).toBeGreaterThan(0)
    await expect(panel.getByRole("status")).toBeHidden()

    await holdPreviews(page, true)
    await page.getByLabel("Role").fill("Lead analyst")
    await expect(panel.getByRole("status")).toContainText("Checking the PDF…")
    expect(await animationsIn(score)).toBe(0)
    await holdPreviews(page, false)
    await expect(panel.getByRole("status")).toBeHidden()

    expect(errors).toEqual([])
  })

  test("a perfect score's ring shows its gradient at once, with no light sweeping round it", async ({ page }) => {
    const errors = pageErrors(page)
    await openSample(page, "perfect")
    await page.getByRole("tab", { name: /^Check/ }).click()
    const panel = page.getByRole("tabpanel", { name: /^Check/ })
    const score = panel.getByRole("region", { name: "Resume score" })
    await expect(score.getByText(/^\d+$/)).toHaveText("100")
    await expect(score).toContainText("Perfect")
    expect(await perfectRingShown(score)).toBe(true)
    expect(await animationNamesIn(score)).toEqual([])
    await expect(panel.getByRole("status")).toBeHidden()

    expect(errors).toEqual([])
  })
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the switch sits above the section tabs, and works with the Edit and Preview switch", async ({ page }) => {
    const errors = pageErrors(page)
    await newResume(page)
    const modes = page.getByRole("tablist", { name: "Write, check or style" })
    const check = modes.getByRole("tab", { name: /^Check/ })
    const sections = page.getByRole("navigation", { name: "Sections" })

    const switchBox = await modes.boundingBox()
    const tabsBox = await sections.boundingBox()
    expect(switchBox!.y + switchBox!.height).toBeLessThanOrEqual(tabsBox!.y + 1)

    await check.tap()
    await expect(check).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("tabpanel", { name: /^Check/ })).toBeVisible()
    await expect(sections).toBeHidden()

    // Preview hides the left bar, and Edit brings it back as it was.
    await page.getByRole("button", { name: "Preview", exact: true }).tap()
    await expect(page.getByRole("region", { name: "Live preview" })).toBeVisible()
    await expect(modes).toBeHidden()
    await page.getByRole("button", { name: "Edit", exact: true }).tap()
    await expect(check).toHaveAttribute("aria-selected", "true")

    // Measure the final colors, after the Edit/Preview buttons finish their
    // color transition. Safari can otherwise capture its intermediate frame.
    await page
      .getByRole("group", { name: "View" })
      .evaluate((group) => Promise.all(group.getAnimations({ subtree: true }).map((animation) => animation.finished)))
    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
    expect(errors).toEqual([])
  })

  test("tapping Check far down the form goes back up to what was found", async ({ page }) => {
    const errors = pageErrors(page)
    await newResume(page)
    const check = page.getByRole("tablist", { name: "Write, check or style" }).getByRole("tab", { name: /^Check/ })

    // The switch stays pinned while the form scrolls under it.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    await expect(check).toBeInViewport()

    await check.tap()
    await expect(page.getByRole("tabpanel", { name: /^Check/ })).toBeInViewport()
    await expect(check).toBeInViewport()
    expect(errors).toEqual([])
  })
})
