import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "./test"
import {
  editorHeading,
  holdablePreviews,
  holdPreviews,
  newResume,
  pageErrors,
  preview,
  previewShown,
  saveResumes,
  seriousAccessibilityProblems,
} from "./helpers"

// The editor's left bar switches between the sections (Write), what the
// checker found (Check) and Fine-tune (Style), and remembers which for the visit.
// On wide screens, as here unless a test says otherwise, Check's two lists each
// have a tab in the rail, ATS checks and AI review, and take the form's place.

/** A new resume with a name and an entry, so there's something to check, and its preview on screen. */
async function resumeToCheck(page: Page) {
  await newResume(page)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await previewShown(page)
}

/** The Jake template's sample resume, which passes every check, saved with these changes to its profile and sections, and opened. */
async function openSample(page: Page, id: string, profile: Record<string, string> = {}, changes: Record<string, unknown> = {}) {
  const sample = JSON.parse(readFileSync("src/lib/typst/preview-samples/jake.json", "utf8"))
  const resume = { ...sample, ...changes, id, resumeTitle: "Marcus", profileSection: { ...sample.profileSection, ...profile } }
  await saveResumes(page, [resume])
  await page.goto(`/create/new/${id}`)
}

/** Whether a perfect score's scale shows, filled with a gradient rather than ink (.score-fill in styles/editor.css). */
const perfectScaleShown = (score: Locator) =>
  score.evaluate((element) =>
    [...element.querySelectorAll("div")].some((div) => getComputedStyle(div).backgroundImage.startsWith("linear-gradient")),
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

test("the left bar switches between writing and checking, and remembers which", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const modes = page.getByRole("tablist", { name: /check or style$/i })
  const check = modes.getByRole("tab", { name: "ATS checks" })
  const sections = page.getByRole("navigation", { name: "Sections" })
  // Writing, with no tab chosen: the rail's sections are the form.
  const writing = async (tab = check) => {
    await expect(tab).toHaveAttribute("aria-selected", "false")
    await expect(sections).toBeVisible()
  }

  // It opens on writing.
  await writing()
  // A name and an entry, so there's something to check: a resume with nothing
  // to check yet always opens on Write.
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await sections.getByRole("button", { name: /^Experience$/ }).click()
  await expect(editorHeading(page, "Experience")).toBeVisible()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Role").fill("Analyst")

  // The ATS checks take the form's place, with the sections still in the rail; choosing them again brings the form back.
  await check.click()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await expect(sections).toBeVisible()
  await expect(page.getByRole("tabpanel", { name: "ATS checks" })).toBeVisible()
  await expect(editorHeading(page, "Experience")).toBeHidden()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // Arrow keys, Home and End move between the rail's tabs, up and down, as in any set of tabs.
  const style = modes.getByRole("tab", { name: "Style" })
  const ai = modes.getByRole("tab", { name: "AI review" })
  await check.focus()
  for (const [key, tab] of [
    ["ArrowDown", ai],
    ["End", style],
    ["ArrowUp", ai],
    ["Home", check],
  ] as const) {
    await page.keyboard.press(key)
    await expect(tab).toBeFocused()
    await expect(tab).toHaveAttribute("aria-selected", "true")
  }

  // The mode stays after a reload, until it's switched back. Each reload
  // waits for the preview, so the PDF compiler's download isn't cut off,
  // which Safari logs as an error, and in Check for the score, so the
  // checker's reader isn't either.
  const score = page.getByRole("tabpanel", { name: "ATS checks" }).getByRole("region", { name: "ATS score" }).locator("[aria-live=polite]")
  const checked = () => expect(score).toContainText(/^\d+\s*\/ 100\s*out of 100$/)
  await previewShown(page)
  await checked()
  await page.reload()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await checked()
  await check.click()
  await previewShown(page)
  await page.reload()
  await writing()

  // It's remembered for the visit, not for good: a new tab opens on Write.
  await check.click()
  await checked()
  const later = await page.context().newPage()
  await later.goto(page.url())
  await expect(later.getByRole("tab", { name: "ATS checks" })).toHaveAttribute("aria-selected", "false")
  await previewShown(later)
  await later.close()

  // In this tab Check is still remembered, so the resume opens on Check from
  // a freshly loaded dashboard too, but a new resume, with nothing to check
  // yet, opens on Write.
  await page.goto("/create/dashboard")
  await page.getByRole("list", { name: "Resumes" }).getByRole("link").first().click()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await previewShown(page)
  await checked()
  await page.getByRole("link", { name: "Dashboard" }).click()
  await page.getByRole("button", { name: "New resume" }).first().click()
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await writing()
  await previewShown(page)

  expect(errors).toEqual([])
})

test("the checker asks for a name and an entry first, then scores the resume and lists what to fix by category", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const check = page.getByRole("tab", { name: "ATS checks" })
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  const score = panel.getByRole("region", { name: "ATS score" })

  await check.click()
  const waiting = panel.getByText("Add your name and some section content to check this resume.")
  await expect(waiting).toBeVisible()
  await expect(score).toContainText("Not scored yet")

  // Choosing them again brings the form back, in the checks' place, to type the name in.
  await check.click()
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await check.click()
  await expect(waiting).toBeHidden()
  await expect(score.getByText(/^\d+$/)).toBeVisible()
  // Screen readers are told the score as it changes.
  await expect(score.locator("[aria-live=polite]")).toContainText(/^\d+\s*\/ 100\s*out of 100$/)

  // A category with something to fix is open, lists it, and folds from the
  // keyboard.
  const contact = panel.getByRole("button", { name: /^Contact & personal details, 1 to fix/ })
  await expect(contact).toHaveAttribute("aria-expanded", "true")
  const email = panel.getByRole("button", { name: /Add your email address/ })
  await expect(email).toBeVisible()
  // Its findings come must-fixes first, each saying its tier; optional advice
  // (here, a phone number) is its own tier.
  await expect(email).toHaveAccessibleDescription("Must fix")
  await expect(panel.getByRole("button", { name: /^Profile → Phone Consider adding a phone number$/ })).toHaveAccessibleDescription(
    "Optional",
  )
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
  // Once everything's checked, every category is listed, numbered: one with
  // nothing to fix says it passed, with its points, and doesn't open. The
  // checks it passed aren't listed.
  await expect(panel.getByRole("status")).toBeHidden()
  const checks = panel.getByRole("region", { name: "Checks" })
  await expect(checks).toContainText(/\d of 8 clear/)
  await expect(checks.getByRole("listitem").filter({ hasText: /^02Readable by hiring software/ })).toContainText(
    /Passed, \d+ of \d+ points$/,
  )
  await expect(panel.getByRole("button", { name: /^Readable by hiring software/ })).toHaveCount(0)
  await expect(panel.getByText("No Social Security number")).toHaveCount(0)

  // A word says how the score reads, and a line that the must-fixes hold it down.
  await expect(score).toContainText("Needs work")
  await expect(score).toContainText("Capped at 74 until you fix 6 items.")
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  expect(errors).toEqual([])
})

test("the score goes up as a problem is fixed", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email", { exact: true }).fill("ada@example")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await page
    .getByRole("tablist", { name: /check or style$/i })
    .getByRole("tab", { name: "ATS checks" })
    .click()

  // The contact category is open, as it has something to fix, and lists it.
  const contact = panel.getByRole("button", { name: /^Contact & personal details, 1 to fix/ })
  await expect(contact).toHaveAttribute("aria-expanded", "true")
  const email = panel.getByRole("button", { name: /Not a whole email address/ })
  await expect(email).toBeVisible()

  const number = panel.getByRole("region", { name: "ATS score" }).getByText(/^\d+$/)
  await expect(panel.getByRole("status")).toBeHidden()
  const before = Number(await number.textContent())
  // It opens in the form, in the checks' place, and the way back shows the score gone up.
  await email.click()
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com")
  await page.getByRole("tab", { name: "ATS Checks" }).click()
  await expect.poll(async () => Number(await number.textContent())).toBeGreaterThan(before)
  await expect(panel.getByRole("button", { name: /^Contact & personal details/ })).not.toHaveAccessibleName(/to fix/)

  expect(errors).toEqual([])
})

test("the resume is checked again once typing pauses, not at every key, and a dismissal shows at once", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await resumeToCheck(page)
  const check = page.getByRole("tab", { name: "ATS checks" })
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  await check.click()
  await expect(panel.getByRole("status")).toBeHidden()
  const missing = panel.getByRole("button", { name: /Add your email address/ })
  await missing.click()
  const email = page.getByLabel("Email", { exact: true })
  await expect(email).toBeFocused()

  // With the page's clock stopped, typing never pauses. What the person
  // tells the checker still shows at once.
  await page.clock.pauseAt(Date.now() + 1_000)
  await page.getByRole("tab", { name: "ATS Checks" }).click()
  const advice = panel.getByRole("button", { name: /Profile → LinkedIn Consider adding a LinkedIn profile/ })
  await panel.getByRole("button", { name: "Dismiss: Consider adding a LinkedIn profile" }).click()
  await expect(advice).toBeHidden()

  await missing.click()
  await email.pressSequentially("ada@example.com")
  // A fixed wait: proving what's typed isn't checked yet.
  await page.waitForTimeout(1_000)
  await page.getByRole("tab", { name: "ATS Checks" }).click()
  await expect(missing).toBeVisible()

  // Once typing pauses, it is.
  await page.clock.resume()
  await expect(missing).toBeHidden()
  await expect(panel.getByRole("status")).toBeHidden()

  expect(errors).toEqual([])
})

test("the score moves while it's worked out: dots bounce in its place, the number comes in, and it pulses while checked again", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await holdablePreviews(page)
  await resumeToCheck(page)
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  const score = panel.getByRole("region", { name: "ATS score" })

  // A change the preview hasn't caught up with keeps the checks on the PDF
  // waiting, and the score with them. Meanwhile three dots bounce in its place.
  await holdPreviews(page, true)
  await page.getByLabel("Role").fill("Analyst")
  await page.getByRole("tab", { name: "ATS checks" }).click()
  await expect(score).toContainText("Checking")
  await expect.poll(() => animationNamesIn(score)).toContain("score-dot")

  // Once the score is in, it shows, and nothing keeps moving.
  await holdPreviews(page, false)
  await expect(score.getByText(/^\d+$/)).toBeVisible()
  await expect(panel.getByRole("status")).toBeHidden()
  await expect.poll(() => animationsIn(score)).toBe(0)

  // Checked again after a change, the score stays and pulses until it's done.
  await holdPreviews(page, true)
  await page.getByRole("tab", { name: "ATS checks" }).click()
  await page.getByLabel("Role").fill("Lead analyst")
  await page.getByRole("tab", { name: "ATS checks" }).click()
  await expect(panel.getByRole("status")).toContainText("Checking the PDF…")
  await expect(score.getByText(/^\d+$/)).toBeVisible()
  await expect.poll(() => animationsIn(score)).toBeGreaterThan(0)
  await holdPreviews(page, false)
  await expect(panel.getByRole("status")).toBeHidden()
  await expect.poll(() => animationsIn(score)).toBe(0)

  expect(errors).toEqual([])
})

test("the score's word says how it reads, and a perfect score's scale turns to a gradient a light sweeps along once", async ({ page }) => {
  const errors = pageErrors(page)
  await resumeToCheck(page)
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  const score = panel.getByRole("region", { name: "ATS score" })
  await page.getByRole("tab", { name: "ATS checks" }).click()
  await expect(panel.getByRole("status")).toBeHidden()
  await expect(score).toContainText("Needs work")
  expect(await perfectScaleShown(score)).toBe(false)

  // A good resume, held at 89 by a missing email (Check stays open for the visit).
  await openSample(page, "no-email", { email: "" })
  await expect(panel.getByRole("status")).toBeHidden()
  await expect(score).toContainText("Good")

  // With the email added, every check passes: the scale turns to a gradient
  // that a light sweeps along once.
  await panel.getByRole("button", { name: /Add your email address/ }).click()
  await page.getByLabel("Email", { exact: true }).fill("marcus.bell@example.com")
  await page.getByRole("tab", { name: "ATS Checks" }).click()
  await expect(score.getByText(/^\d+$/)).toHaveText("100")
  await expect(score).toContainText("Perfect")
  await expect.poll(() => perfectScaleShown(score)).toBe(true)
  await expect.poll(() => animationNamesIn(score)).toContain("score-glint")
  await expect.poll(() => animationsIn(score)).toBe(0)
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  expect(errors).toEqual([])
})

test("a line under the score says how much weak bullets take off it", async ({ page }) => {
  const errors = pageErrors(page)
  // Every role's bullets say what was done, but none what it came to.
  const sample = JSON.parse(readFileSync("src/lib/typst/preview-samples/jake.json", "utf8"))
  const describe = (entries: Record<string, unknown>[], field: string, bullets: string[][]) =>
    entries.map((entry, index) => ({ ...entry, [field]: bullets[index].map((bullet) => `• ${bullet}`).join("\n") }))
  await openSample(
    page,
    "no-results",
    {},
    {
      workExperienceSection: describe(sample.workExperienceSection, "workDescription", [
        ["Built a Go service for Google Maps that merges edits to business hours", "Added tracing to the edit pipeline"],
        ["Built a React dashboard that tracks over-the-air software updates", "Wrote Python checks for vehicle telemetry records"],
        ["Led lab sections on pointers, graphs and recursion in C++", "Wrote autograder tests for hash table assignments"],
      ]),
      leadershipExperienceSection: describe(sample.leadershipExperienceSection, "leadershipDescription", [
        ["Run a monthly workshop series on Git, web APIs and Docker"],
      ]),
    },
  )
  await page.getByRole("tab", { name: "ATS checks" }).click()
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  const score = panel.getByRole("region", { name: "ATS score" })
  await expect(panel.getByRole("status")).toBeHidden()
  await expect(score).toContainText(/Your bullets take \d+ off until they earn 75% of their points\./)

  // The sample's own bullets say what they achieved, so nothing's taken off (Check stays open for the visit).
  await openSample(page, "with-results")
  await expect(score.getByText(/^\d+$/)).toHaveText("100")
  await expect(score).not.toContainText("Your bullets take")

  expect(errors).toEqual([])
})

test("choosing a finding opens its field, where it shows while Check is open, fixing it clears it, and a suggestion can be dismissed", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await newResume(page)
  const modes = page.getByRole("tablist", { name: /check or style$/i })
  const check = modes.getByRole("tab", { name: "ATS checks" })
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })

  // The tab says only ATS checks: what it found is in the panel.
  await expect(check).toHaveAccessibleName("ATS Checks")
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email", { exact: true }).fill("ada@example")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await expect(check).toHaveAccessibleName("ATS Checks")

  // The email's finding opens the profile, with the cursor in the field. Why it matters is
  // marked on the preview, not written under the field, which says it to a screen reader.
  await check.click()
  const email = panel.getByRole("button", { name: /Not a whole email address/ })
  await email.click()
  const field = page.getByLabel("Email", { exact: true })
  await expect(field).toBeFocused()
  await expect(field).toHaveAttribute("aria-invalid", "true")
  const why = /Recruiters reply by email, and application forms ask for it, so it has to work\./
  await expect(field).toHaveAccessibleDescription(why)
  // Read out, but not shown: it's in a screen reader's one-pixel box.
  const hidden = await page
    .getByText("Recruiters reply by email, and application forms ask for it, so it has to work.")
    .evaluate((element) => element.closest(".sr-only")?.getBoundingClientRect().height)
  expect(hidden).toBeLessThanOrEqual(1)

  // Choosing the checks again and leaving them puts the finding down, and the field is left plain, until the
  // finding is opened again.
  await check.click()
  await check.click()
  await expect(field).not.toHaveAccessibleDescription(why)
  await expect(field).not.toHaveAttribute("aria-invalid")
  await check.click()
  await email.click()
  await expect(field).toHaveAccessibleDescription(why)
  await expect(field).toHaveAttribute("aria-invalid", "true")
  await field.fill("ada@example.com")
  await expect(field).not.toHaveAttribute("aria-invalid")
  await page.getByRole("tab", { name: "ATS Checks" }).click()
  await expect(email).toBeHidden()

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

test("choosing a finding far down a long list opens its field without pushing the sheet up", async ({ page }) => {
  // Seven jobs with the same bullets: a list of findings taller than the window, and fields
  // low in the form, where centering one needs more room than the form's own scroll has.
  const bullets = [
    "• Designed and built a payments service that many teams across the company relied on every day",
    "• Cut deploy time from two hours to ten minutes for forty engineers",
  ].join("\n")
  const jobs = Array.from({ length: 7 }, (_, at) => ({
    id: at + 1,
    workRole: "Engineer",
    companyName: `Company ${at + 1}`,
    workStartDate: "Jun 2020",
    workEndDate: "Present",
    workDescription: bullets,
  }))
  await saveResumes(page, [
    {
      id: "long-check",
      resumeTitle: "Long check",
      selectedTemplate: "jake",
      sectionOrder: ["Work", "Education", "Skills"],
      sectionsChosen: true,
      profileSection: { fullName: "Ada Lovelace", email: "ada@example.com" },
      workExperienceSection: jobs,
    },
  ])
  // Without motion the form scrolls at once, so the bar's place can be read straight after.
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/create/new/long-check")
  await page
    .getByRole("tablist", { name: /check or style$/i })
    .getByRole("tab", { name: "ATS checks" })
    .click()
  const back = page.getByRole("link", { name: "Dashboard" })
  const top = (await back.boundingBox())!.y

  // The last entry opens on its first finding. The second is then chosen in an open entry: in
  // Safari, with motion reduced, a finding that opens its entry can lose its place (a bug of its own).
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  await panel.getByRole("button", { name: /Experience → Company 7 · bullet 1/ }).click()
  await expect(page.getByRole("button", { name: "Done editing entry 7" })).toBeVisible()
  await page.getByRole("tab", { name: "ATS Checks" }).click()
  await panel.getByRole("button", { name: /Experience → Company 7 · bullet 2/ }).click()
  // Its field is marked with the finding, and scrolled to: it started below the form's foot.
  const field = page.getByRole("textbox", { name: "Description" }).last()
  await expect(field).toHaveAccessibleDescription(/Same as another bullet/)
  await expect(field).toBeInViewport()
  // The top bar stays where it was: nothing scrolled the frame it's in, which no wheel scrolls back.
  expect((await back.boundingBox())!.y).toBe(top)
})

test("with Check open, the PDF is read too: a bullet that runs three lines is flagged and opens", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const check = page.getByRole("tablist", { name: /check or style$/i }).getByRole("tab", { name: "ATS checks" })
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })

  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  const bullets = page.getByLabel(/^Description/)
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

test("a name in a script no font has is a must-fix that says it doesn't print, not that hiring software can't find it", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await openSample(page, "unprinted-name", { fullName: "王小明" })
  await page
    .getByRole("tablist", { name: /check or style$/i })
    .getByRole("tab", { name: "ATS checks" })
    .click()
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })

  const finding = panel.getByRole("button", { name: /“王小明” doesn't print$/ })
  await expect(finding).toBeVisible()
  // Once the PDF's been read, it's the only thing to fix: the rest of the sample reads as typed.
  await expect(panel.getByText("Checking the PDF…")).toBeHidden()
  const fixing = panel.getByRole("button", { name: / to fix\b/ })
  await expect(fixing).toHaveCount(1)
  await expect(fixing).toHaveAccessibleName(/, 1 to fix(,|$)/)
  await expect(panel.getByText(/Hiring software can't find your name/)).toHaveCount(0)

  // Choosing it opens the name, and says it's the fonts, not the typing.
  await finding.click()
  await expect(page.getByLabel("Full name")).toBeFocused()
  await expect(page.getByText("Your typing is fine. For now, write it in Latin letters.")).toBeVisible()

  expect(errors).toEqual([])
})

test("each finding's mark on the preview is drawn in its dot's color: must fix red, worth a look yellow, optional blue", async ({
  page,
}) => {
  const errors = pageErrors(page)
  // The sample with a typo (must fix), a vague word (worth a look), and a job
  // that has ended written in the present tense (optional advice).
  const sample = JSON.parse(readFileSync("src/lib/typst/preview-samples/jake.json", "utf8"))
  const [google, ford] = sample.workExperienceSection
  google.workDescription += "\n• Helped teh team with various tasks"
  ford.workDescription += "\n• Builds a nightly report of failed sensor checks for the release team"
  const id = "marks-in-tier-colors"
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: `resume:${id}`, value: JSON.stringify({ ...sample, id, resumeTitle: "Marcus" }) },
  )
  await page.goto(`/create/new/${id}`)
  await page
    .getByRole("tablist", { name: /check or style$/i })
    .getByRole("tab", { name: "ATS checks" })
    .click()
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  const preview = page.getByRole("region", { name: "Live preview" })

  for (const [tier, message] of [
    ["Must fix", "“teh” may be misspelled"],
    ["Worth a look", "“various” is vague"],
    ["Optional", "“Builds” is present tense, but this has ended"],
  ]) {
    const finding = panel.getByRole("button", { name: new RegExp(`^Experience → .*${message}$`) })
    await expect(finding).toHaveAccessibleDescription(tier)
    // The mark, found by the button laid over it, which is named for the finding.
    const mark = preview.getByRole("button", { name: new RegExp(`^(${tier}: )?${message}$`) })
    await expect(mark).toBeVisible()
    const note = await mark.getAttribute("data-note")
    const pen = await preview.locator(`[data-scribble="${note}"]`).evaluate((scribble) => getComputedStyle(scribble).color)
    const dot = await finding
      .locator("[aria-hidden=true]")
      .first()
      .evaluate((span) => getComputedStyle(span).backgroundColor)
    expect(pen, tier).toBe(dot)
  }

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
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")

  await page
    .getByRole("tablist", { name: /check or style$/i })
    .getByRole("tab", { name: "ATS checks" })
    .click()
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  await expect(panel.getByRole("status")).toContainText("The preview couldn't be built, so the checks on the PDF are left out.")
  expect(errors).toEqual([])
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("the score stays still: no dots bounce, it shows at once, and it doesn't pulse", async ({ page }) => {
    const errors = pageErrors(page)
    await holdablePreviews(page)
    await resumeToCheck(page)
    const panel = page.getByRole("tabpanel", { name: "ATS checks" })
    const score = panel.getByRole("region", { name: "ATS score" })

    await holdPreviews(page, true)
    await page.getByLabel("Role").fill("Analyst")
    await page.getByRole("tab", { name: "ATS checks" }).click()
    await expect(score).toContainText("Checking")
    expect(await animationsIn(score)).toBe(0)

    await holdPreviews(page, false)
    await expect(score.getByText(/^\d+$/)).toBeVisible()
    await expect(panel.getByRole("status")).toBeHidden()

    await holdPreviews(page, true)
    await page.getByRole("tab", { name: "ATS checks" }).click()
    await page.getByLabel("Role").fill("Lead analyst")
    await page.getByRole("tab", { name: "ATS checks" }).click()
    await expect(panel.getByRole("status")).toContainText("Checking the PDF…")
    expect(await animationsIn(score)).toBe(0)
    await holdPreviews(page, false)
    await expect(panel.getByRole("status")).toBeHidden()

    expect(errors).toEqual([])
  })

  test("a perfect score's scale shows its gradient at once, with no light sweeping along it", async ({ page }) => {
    const errors = pageErrors(page)
    await openSample(page, "perfect")
    await page.getByRole("tab", { name: "ATS checks" }).click()
    const panel = page.getByRole("tabpanel", { name: "ATS checks" })
    const score = panel.getByRole("region", { name: "ATS score" })
    await expect(score.getByText(/^\d+$/)).toHaveText("100")
    await expect(score).toContainText("Perfect")
    expect(await perfectScaleShown(score)).toBe(true)
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
    const modes = page.getByRole("tablist", { name: /check or style$/i })
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
    await expect(preview(page)).toBeVisible()
    await expect(modes).toBeHidden()
    await page.getByRole("button", { name: "Edit", exact: true }).tap()
    await expect(check).toHaveAttribute("aria-selected", "true")
    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
    expect(errors).toEqual([])
  })

  test("tapping Check far down the form goes back up to what was found", async ({ page }) => {
    const errors = pageErrors(page)
    await newResume(page)
    const check = page.getByRole("tablist", { name: /check or style$/i }).getByRole("tab", { name: /^Check/ })

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

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  const tabs = (page: Page) => page.getByRole("tablist", { name: /check or style$/i })

  test("the ATS checks take the form's place, and a finding opens in the form, with the way back and on to the next", async ({ page }) => {
    const errors = pageErrors(page)
    const sample = JSON.parse(readFileSync("src/lib/typst/preview-samples/jake.json", "utf8"))
    const work = sample.workExperienceSection.map((job: { workDescription: string }, index: number) =>
      index === 0 ? { ...job, workDescription: job.workDescription.replace(/^• \S+/, "• Responsible for") } : job,
    )
    await openSample(page, "wide-check", { email: "marcus.bell@" }, { workExperienceSection: work })
    await previewShown(page)
    const ats = tabs(page).getByRole("tab", { name: "ATS checks" })
    const name = page.getByLabel("Full name")
    await expect(name).toBeVisible()

    await ats.click()
    const panel = page.getByRole("tabpanel", { name: "ATS checks" })
    await expect(panel.getByRole("region", { name: "ATS score" })).toBeVisible()
    await expect(name).toBeHidden()
    // The tab says how many must be fixed, in its tip.
    await ats.hover()
    await expect(page.getByText(/^ATS Checks · \d+ to fix$/)).toBeVisible()

    // A finding opens its field in the form, in the list's place, with no chip over the form: the rail's tab
    // goes back to the list.
    await panel.getByRole("button", { name: /Not a whole email address/ }).click()
    await expect(page.getByLabel("Email")).toBeFocused()
    await expect(panel).toBeHidden()
    await expect(ats).toHaveAttribute("aria-selected", "false")
    await expect(page.getByRole("button", { name: /^Back to/ })).toHaveCount(0)
    await ats.click()
    await expect(ats).toHaveAttribute("aria-selected", "true")
    await expect(panel).toBeVisible()

    // Choosing the tab again goes back to writing, in the section the finding opened.
    await ats.click()
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })

  test("AI review takes the form's place too, with the rail's tabs for its switch", async ({ page }) => {
    const errors = pageErrors(page)
    await openSample(page, "wide-ai")
    await previewShown(page)
    const ai = tabs(page).getByRole("tab", { name: "AI review" })
    await ai.click()
    await expect(page.getByRole("tabpanel", { name: "AI review" }).getByRole("button", { name: "Get AI notes" })).toBeVisible()
    await expect(page.getByLabel("Full name")).toBeHidden()
    await expect(page.getByRole("group", { name: "Notes on the page" })).toBeHidden()
    await ai.click()
    await expect(page.getByLabel("Full name")).toBeVisible()
    expect(errors).toEqual([])
  })
})
