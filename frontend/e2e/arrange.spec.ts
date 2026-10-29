import { expect, test, type Locator, type Page } from "./test"
import {
  cursorInBox,
  editorTitle,
  expectText,
  openFile,
  pageErrors,
  pdfText,
  previewShown,
  printed,
  saveResumes,
  savedResume,
  selectInBox,
  seriousAccessibilityProblems,
} from "./helpers"

// Entries and bullets can be moved, and left out of the PDF without being
// deleted, to tailor one resume to a job.

const BULLETS = "Description"
const RESUME = {
  id: "tailored",
  resumeTitle: "Tailored",
  resumeTag: "professional",
  updatedAt: "2026-10-07T12:00:00.000Z",
  selectedTemplate: "jake",
  sectionOrder: ["Work", "Skills", "Education", "Projects", "Publications", "Volunteership", "Leadership", "Awards"],
  headings: {},
  profileSection: { fullName: "Ada Lovelace" },
  educationSection: [],
  workExperienceSection: [
    {
      id: 1,
      workRole: "Engineer",
      companyName: "Google",
      workDescription: "• Built the search index\n• Cut serving costs by 30%\n• Mentored four interns",
    },
    { id: 2, workRole: "Intern", companyName: "Initech", workDescription: "• Filed the reports" },
    { id: 3, workRole: "Analyst", companyName: "Hooli", workDescription: "" },
  ],
  projectsSection: [],
  publicationsSection: [],
  skillsSection: [{ id: 1, skillName: "Languages", skillDetails: "Python, Rust" }],
  volunteerExperienceSection: [],
  leadershipExperienceSection: [],
  awardsSection: [],
}

/** Which of `names` the preview prints, in the order it prints them. */
const printedOrder = async (page: Page, names: string[]) => {
  const text = await printed(page)
  return names.filter((name) => text.includes(name)).sort((a, b) => text.indexOf(a) - text.indexOf(b))
}

async function openSection(page: Page, section: string, resume: { id: string } & Record<string, unknown> = RESUME) {
  await saveResumes(page, [resume])
  await page.goto(`/create/new/${resume.id}`)
  await previewShown(page)
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: new RegExp(`^${section}$`) })
    .click()
}

test("an entry is a card, folded to its name and what's in it, opened with a click and folded with its chevron", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  const done = page.getByRole("button", { name: "Done editing entry 1" })
  await expect(done).toBeVisible()
  // The entries have no dates to put in order by, so the note under the title says how to.
  await expect(page.getByText("3 entries · drag to reorder", { exact: true })).toBeVisible()
  // Open, its name, the company alone, is typed in where it's shown.
  await expect(page.getByRole("textbox", { name: "Company" }).first()).toHaveValue("Google")
  // Its card is its name alone, as folded; its fields are under the card, not in it.
  const openCard = page.locator("[data-card]").first()
  await expect(openCard.getByRole("textbox", { name: "Company" })).toBeVisible()
  await expect(openCard.getByRole("textbox", { name: "Role" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Role" }).first()).toHaveValue("Engineer")
  await expect(page.getByText("· Engineer", { exact: true })).toHaveCount(0)

  // Its bullets all show in full, without a click. (The folded cards' boxes are on the page too,
  // out of reach, ready to slide open.)
  const box = page.getByLabel(BULLETS).first()
  await expect(box).toBeVisible()
  await expectText(box, "• Built the search index\n• Cut serving costs by 30%\n• Mentored four interns")
  await expect(page.getByText("+ 1 more", { exact: true })).toHaveCount(0)
  // Its box is named Description, with no line of keys under it: the buttons over selected words show them.
  await expect(box).toHaveAccessibleName("Description")
  await expect(page.getByText(/One bullet per line/)).toHaveCount(0)

  await done.click()
  await expect(done).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Edit entry 1" })).toBeVisible()

  // Folded, it shows its name, not how many bullets it has, and a click on it opens it again.
  const card = page.locator("[data-card]").first()
  await expect(card).not.toContainText("bullets")
  await expect(card.getByText("Google", { exact: true })).toBeVisible()
  await expect(card).not.toContainText("Engineer")
  await card.getByText("Google", { exact: true }).click()
  await expect(done).toBeVisible()
  await expect(box).toBeVisible()

  expect(errors).toEqual([])
})

test("an entry's card has room round it for its shadow, open or folded", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  await expect(page.getByRole("button", { name: "Done editing entry 1" })).toBeVisible()
  // What's between each card and the form that scrolls clips nothing near it: an open card's
  // shadow (--shadow-card-open) falls 44px below it and 28px to its sides, and a box clipped
  // closer round it would cut it off in a hard line.
  const clipped = await page.locator("[data-card]").evaluateAll((cards) =>
    cards.flatMap((card) => {
      const edge = card.getBoundingClientRect()
      const found: string[] = []
      for (let box = card.parentElement; box && !["auto", "scroll"].includes(getComputedStyle(box).overflowY); box = box.parentElement) {
        const style = getComputedStyle(box)
        const around = box.getBoundingClientRect()
        const close = around.bottom - edge.bottom < 44 || edge.left - around.left < 28 || around.right - edge.right < 28
        if ((style.overflowX !== "visible" || style.overflowY !== "visible") && close)
          found.push(`${box.tagName} round ${card.textContent?.slice(0, 20)}`)
      }
      return found
    }),
  )
  expect(clipped).toEqual([])
  expect(errors).toEqual([])
})

test("a project's card is named by the project alone, without its tech stack", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Projects", {
    ...RESUME,
    id: "projects",
    projectsSection: [
      { id: 1, projectName: "Gitlytics", techStack: "Next.js, TypeScript" },
      { id: 2, projectName: "Loom", techStack: "Rust, WebAssembly" },
    ],
  })
  // Open, the tech stack is a field under the name, not part of it.
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Gitlytics")
  await expect(page.getByLabel("Tech stack").first()).toHaveValue("Next.js, TypeScript")
  const folded = page.locator("[data-card]").nth(1)
  await expect(folded.getByText("Loom", { exact: true })).toBeVisible()
  await expect(folded).not.toContainText("Rust")
  expect(errors).toEqual([])
})

test("a school's card is named by the school alone, and volunteering's and leadership's by the organization", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Education", {
    ...RESUME,
    id: "named",
    educationSection: [
      { id: 1, schoolName: "Stanford University", degree: "B.S. in Computer Science" },
      { id: 2, schoolName: "De Anza College", degree: "A.S. in Mathematics" },
    ],
    volunteerExperienceSection: [
      { id: 1, volunteerRole: "Tutor", volunteerOrg: "Code Club" },
      { id: 2, volunteerRole: "Driver", volunteerOrg: "Meals on Wheels" },
    ],
    leadershipExperienceSection: [
      { id: 1, leadershipRole: "President", leadershipOrg: "Chess Club" },
      { id: 2, leadershipRole: "Captain", leadershipOrg: "Rowing Team" },
    ],
  })
  // Open, the degree or the role is a field under the name, not part of it.
  const sections = [
    { section: "Education", name: "School", first: "Stanford University", field: "Degree", value: "B.S. in Computer Science" },
    { section: "Volunteer", name: "Organization", first: "Code Club", field: "Role", value: "Tutor" },
    { section: "Leadership", name: "Organization", first: "Chess Club", field: "Role", value: "President" },
  ]
  const folded = {
    Education: ["De Anza College", "A.S."],
    Volunteer: ["Meals on Wheels", "Driver"],
    Leadership: ["Rowing Team", "Captain"],
  }
  for (const { section, name, first, field, value } of sections) {
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: section, exact: true }).click()
    await expect(page.getByRole("textbox", { name, exact: true })).toHaveValue(first)
    await expect(page.getByLabel(field, { exact: true }).first()).toHaveValue(value)
    const [named, left] = folded[section as keyof typeof folded]
    const card = page.locator("[data-card]").nth(1)
    await expect(card.getByText(named, { exact: true })).toBeVisible()
    await expect(card).not.toContainText(left)
  }
  expect(errors).toEqual([])
})

test("a card shows its name alone, no dates, and the note under the title says when the newest is first", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience", {
    ...RESUME,
    id: "dated",
    workExperienceSection: [
      {
        id: 1,
        workRole: "Engineer",
        companyName: "Google",
        workStartDate: "May 2025",
        workEndDate: "Aug 2025",
        workDescription: "• Built a service that cut page load time by 30% for twelve million monthly visitors\n• Ran it",
      },
      {
        id: 2,
        workRole: "Intern",
        companyName: "Initech",
        workStartDate: "Sep 2024",
        workEndDate: "Dec 2024",
        workDescription: "• Filed the reports",
      },
    ],
  })
  await expect(page.getByText("2 entries · newest first", { exact: true })).toBeVisible()
  const folded = page.locator("[data-card]").nth(1)
  await expect(folded.getByText("Initech", { exact: true })).toBeVisible()
  await expect(folded).not.toContainText("2024")
  // The open card's long bullet shows in full.
  await expectText(
    page.getByLabel(BULLETS).first(),
    "• Built a service that cut page load time by 30% for twelve million monthly visitors\n• Ran it",
  )

  // Moved above the newer one, it isn't newest first any more.
  await page.getByRole("button", { name: "Reorder entry 2" }).focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("Space")
  await expect(page.getByText("2 entries · drag to reorder", { exact: true })).toBeVisible()

  expect(errors).toEqual([])
})

test("an entry left out isn't printed, or in the PDF's copy of the resume, and comes back when it's put back", async ({
  page,
  browser,
}, testInfo) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")

  await page.getByRole("checkbox", { name: "Include entry 2 in the PDF" }).uncheck()
  await expect(page.getByText("Initech · Left out", { exact: true })).toBeVisible()
  await expect.poll(() => printedOrder(page, ["Google", "Initech", "Hooli"])).toEqual(["Google", "Hooli"])

  // Whoever gets the PDF can't read it: opened again, the PDF brings back only what was printed.
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download PDF" }).click()
  const pdf = testInfo.outputPath("tailored.pdf")
  await (await downloading).saveAs(pdf)
  const text = await pdfText(pdf)
  expect(text).toContain("Google")
  expect(text).not.toContain("Initech")
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await openFile(other.getByRole("button", { name: "Open a file" }).first(), pdf)
  await expect(other).toHaveURL(/\/create\/new\/tailored$/)
  await previewShown(other)
  const restored = await savedResume(other, RESUME.id)
  expect(restored.workExperienceSection.map((entry: { companyName: string }) => entry.companyName)).toEqual(["Google", "Hooli"])
  expect(JSON.stringify(restored)).not.toContain("Initech")
  await elsewhere.close()

  // Changed here since, and with something left out, the resume has what the PDF doesn't, so opening the PDF here says so.
  await page.getByRole("checkbox", { name: "Include entry 3 in the PDF" }).uncheck()
  await expect.poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection[2].leftOut).toBe(true)
  await page.goto("/create/dashboard")
  await openFile(page.getByRole("button", { name: "Open a file" }).first(), pdf)
  const conflict = page.getByRole("dialog", { name: "You already have this resume" })
  await expect(conflict).toContainText("What you left out of the PDF isn't in the file, so replacing deletes it.")
  await conflict.getByRole("button", { name: "Cancel" }).click()

  // Here it's kept, left out, and put back with a tick.
  await page.goto(`/create/new/${RESUME.id}`)
  await previewShown(page)
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  const include = page.getByRole("checkbox", { name: "Include entry 2 in the PDF" })
  await expect(include).not.toBeChecked()
  await include.check()
  await page.getByRole("checkbox", { name: "Include entry 3 in the PDF" }).check()
  await expect.poll(() => printedOrder(page, ["Google", "Initech", "Hooli"])).toEqual(["Google", "Initech", "Hooli"])

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("a bullet starting with ○ is left out, and Alt and the arrow keys move a line", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  // The first entry is open; its bullets are in the first box.
  const box = page.getByLabel(BULLETS).first()

  await box.fill("• Cut serving costs by 30%\n• Built the search index\n○ Mentored four interns")
  await expect(page.getByText("Lines starting with ○ are left out of the PDF.")).toBeVisible()
  await expect(box).toHaveAccessibleDescription(/Lines starting with ○ are left out of the PDF\./)
  await expect
    .poll(() => printedOrder(page, ["Cut serving costs", "Built the search index", "Mentored four interns", "Initech"]))
    .toEqual(["Cut serving costs", "Built the search index", "Initech"])
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // Alt+↓ moves the line the cursor is on.
  await box.focus()
  await selectInBox(box, 0)
  await page.keyboard.press("Alt+ArrowDown")
  await expectText(box, "• Built the search index\n• Cut serving costs by 30%\n○ Mentored four interns")
  await expect
    .poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection[0].workDescription)
    .toBe("• Built the search index\n• Cut serving costs by 30%\n○ Mentored four interns")

  // Enter in a left-out bullet: the words moved to the new line stay left out.
  const split = "• Built the search index\n• Cut serving costs by 30%\n○ Mentored four".length
  await selectInBox(box, split)
  await page.keyboard.press("Enter")
  await expectText(box, "• Built the search index\n• Cut serving costs by 30%\n○ Mentored four\n○ interns")
  expect(await cursorInBox(box)).toBe(split + 3)

  expect(errors).toEqual([])
})

test("a section with every entry left out isn't printed, title and all", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Skills")
  await expect.poll(() => printed(page)).toContain("Python, Rust")

  await page.getByRole("button", { name: "Done editing entry 1" }).click()
  await page.getByRole("checkbox", { name: "Include entry 1 in the PDF" }).uncheck()
  await expect
    .poll(async () => {
      const text = await printed(page)
      return text.includes("Hooli") && !/skills|python/i.test(text)
    })
    .toBe(true)

  expect(errors).toEqual([])
})

test("a section is dragged to a new place from the keyboard, and printed and saved there", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  await expect.poll(() => printedOrder(page, ["Google", "Python"])).toEqual(["Google", "Python"])

  const sections = page.getByRole("navigation", { name: "Sections" })
  await sections.getByRole("button", { name: "Reorder Experience" }).focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Space")
  // Each section's button, after Profile's: not the handles, or Add section.
  const order = sections.getByRole("button", { name: /^(?!Reorder |Add )/ })
  await expect(order.nth(1)).toHaveAccessibleName("Skills")
  await expect(order.nth(2)).toHaveAccessibleName("Experience")
  await expect.poll(() => printedOrder(page, ["Google", "Python"])).toEqual(["Python", "Google"])
  await expect.poll(async () => (await savedResume(page, RESUME.id)).sectionOrder.slice(0, 2)).toEqual(["Skills", "Work"])

  expect(errors).toEqual([])
})

const companies = async (page: Page) =>
  (await savedResume(page, RESUME.id)).workExperienceSection.map((entry: { companyName: string }) => entry.companyName)

/** Waits for what `control` is in to light up: the app's own animation on it, paused at its start, puts it on white. */
const lightsUp = (control: Locator) =>
  expect
    .poll(() =>
      control.evaluate((element) => {
        const animation = document.getAnimations().find((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target
          return !("transitionProperty" in animation) && !!target?.contains(element)
        })
        if (!animation) return ""
        animation.pause()
        animation.currentTime = 0
        const background = getComputedStyle((animation.effect as KeyframeEffect).target!).backgroundColor
        animation.finish()
        return background
      }),
    )
    .toBe("rgb(255, 255, 255)")

test("an entry is dragged to a new place from the keyboard, and printed and saved there", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")

  await page.getByRole("button", { name: "Reorder entry 3" }).focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("Space")
  // It keeps the focus in its new place, and lights up there.
  const moved = page.getByRole("button", { name: "Reorder entry 1" })
  await expect(moved).toBeFocused()
  await lightsUp(moved)
  await expect.poll(() => printedOrder(page, ["Google", "Initech", "Hooli"])).toEqual(["Hooli", "Google", "Initech"])
  await expect.poll(() => companies(page)).toEqual(["Hooli", "Google", "Initech"])

  expect(errors).toEqual([])
})

test("an open entry is dragged with the mouse, under the pointer all the way, and dropped still open", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")

  // The first entry is open, and the tallest: it's dragged down past the two closed ones.
  const dragged = page.getByRole("button", { name: "Reorder entry 1" })
  const from = (await dragged.boundingBox())!
  const second = (await page.getByRole("button", { name: "Reorder entry 2" }).boundingBox())!
  const third = (await page.getByRole("button", { name: "Reorder entry 3" }).boundingBox())!
  const x = from.x + from.width / 2
  const start = from.y + from.height / 2
  const to = start + 2 * (third.y - second.y) + 20
  await page.mouse.move(x, start)
  await page.mouse.down()
  // Past the few pixels a click can move, so it's a drag.
  await page.mouse.move(x, start + 10, { steps: 5 })
  await page.mouse.move(x, to, { steps: 20 })
  // It trails the pointer by those few pixels, and no more.
  await expect
    .poll(async () => {
      const box = (await dragged.boundingBox())!
      return Math.hypot(box.x + box.width / 2 - x, box.y + box.height / 2 - to)
    })
    .toBeLessThan(12)
  await page.mouse.up()

  await lightsUp(page.getByRole("button", { name: "Reorder entry 3" }))
  await expect.poll(() => companies(page)).toEqual(["Initech", "Hooli", "Google"])
  // It's still open, in its new place.
  await expect(page.getByRole("button", { name: "Done editing entry 3" })).toBeVisible()

  expect(errors).toEqual([])
})

test("the checker skips what's left out, and opens the right entry after it", async ({ page }) => {
  const errors = pageErrors(page)
  const weak = (company: string) => new RegExp(`${company} · bullet 1 .*weak start`)
  await openSection(page, "Experience", {
    ...RESUME,
    id: "tailored-check",
    workExperienceSection: [
      { id: 1, workRole: "Intern", companyName: "Initech", workDescription: "• Responsible for the reports", leftOut: true },
      {
        id: 2,
        workRole: "Engineer",
        companyName: "Google",
        workDescription: "• Responsible for the search index\n• Cut serving costs by 30%",
      },
    ],
  })

  await page
    .getByRole("tablist", { name: "Write, check or style" })
    .getByRole("tab", { name: /^Check/ })
    .click()
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  await expect(panel.getByRole("button", { name: weak("Google") })).toBeVisible()
  await expect(panel.getByRole("button", { name: /Initech/ })).toHaveCount(0)

  // The left-out entry is the first in the editor, so the finding is about the second.
  await panel.getByRole("button", { name: weak("Google") }).click()
  await expect(page.getByRole("button", { name: "Done editing entry 2" })).toBeVisible()
  const box = page.getByLabel(BULLETS).nth(1)
  const selected = () => page.evaluate(() => String(getSelection()))
  await expect(box).toBeFocused()
  await expect.poll(selected).toBe("Responsible for the search index")

  // Write mode hides the finding, and Check shows it again.
  const modes = page.getByRole("tablist", { name: "Write, check or style" })
  await modes.getByRole("tab", { name: "Write" }).click()
  await modes.getByRole("tab", { name: /^Check/ }).click()
  await expect(panel.getByRole("button", { name: weak("Google") })).toBeVisible()

  // Choosing the finding again goes back to the text, at its bullet.
  await panel.getByRole("button", { name: weak("Google") }).click()
  await expect(box).toBeFocused()
  await expect.poll(selected).toBe("Responsible for the search index")

  expect(errors).toEqual([])
})

test("every section's cards have their eye and Delete next to the chevron, open and folded", async ({ page }) => {
  const errors = pageErrors(page)
  const one = <T extends Record<string, string>>(entry: T) => [{ id: 1, ...entry }]
  const resume = {
    ...RESUME,
    id: "every-section",
    educationSection: one({ schoolName: "Stanford University" }),
    projectsSection: one({ projectName: "Gitlytics" }),
    publicationsSection: one({ publicationTitle: "Sparse Attention" }),
    volunteerExperienceSection: one({ volunteerOrg: "Food Bank" }),
    leadershipExperienceSection: one({ leadershipOrg: "Student Council" }),
    awardsSection: one({ awardName: "AWS Certified" }),
  }
  await openSection(page, "Experience", resume)
  for (const section of [
    "Experience",
    "Skills",
    "Education",
    "Projects",
    "Publications",
    "Volunteer",
    "Leadership",
    "Awards & Certifications",
  ]) {
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("button", { name: new RegExp(`^${section}$`) })
      .click()
    await expect(editorTitle(page)).toHaveText(new RegExp(section))
    for (const state of ["Done editing entry 1", "Edit entry 1"]) {
      if (state === "Edit entry 1") await page.getByRole("button", { name: "Done editing entry 1" }).click()
      await expect(page.getByRole("button", { name: state })).toBeVisible()
      await expect(page.getByRole("checkbox", { name: "Include entry 1 in the PDF" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Delete entry 1" })).toBeVisible()
    }
  }
  expect(errors).toEqual([])
})

test("a folded card is deleted from its own bin, asked first, and an open one left out with its eye", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")

  // Open, its eye leaves it out, and puts it back.
  const include = page.getByRole("checkbox", { name: "Include entry 1 in the PDF" })
  await expect(page.getByRole("button", { name: "Done editing entry 1" })).toBeVisible()
  await include.uncheck()
  await expect(page.getByText("Left out of the PDF, and of the copy of the resume inside it.", { exact: false })).toBeVisible()
  await expect.poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection[0].leftOut).toBe(true)
  await include.check()
  await expect.poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection[0].leftOut).toBeUndefined()

  // Folded, its bin asks first; Keep backs out to the bin, and Delete deletes it, with Undo.
  await expect(page.getByRole("button", { name: "Edit entry 2" })).toBeVisible()
  await page.getByRole("button", { name: "Delete entry 2" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Delete it?" })).toBeVisible()
  await page.getByRole("button", { name: "Keep" }).click()
  await expect(page.getByRole("button", { name: "Delete entry 2" })).toBeFocused()
  await page.getByRole("button", { name: "Delete entry 2" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByRole("status").filter({ hasText: "deleted" })).toHaveText("“Initech” deleted")
  await expect
    .poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection.map((entry: { companyName: string }) => entry.companyName))
    .toEqual(["Google", "Hooli"])
  await page.getByRole("button", { name: "Undo" }).click()
  await expect
    .poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection.map((entry: { companyName: string }) => entry.companyName))
    .toEqual(["Google", "Initech", "Hooli"])
  expect(errors).toEqual([])
})

test("asked whether to delete an entry, it shows its name and its fields fade, and Keep backs out", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  await page.getByRole("button", { name: "Edit entry 2" }).click()
  await page.getByRole("button", { name: "Delete entry 2" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Delete it?" })).toBeVisible()
  // Its name stays, so it's clear which would go.
  const company = page.getByRole("textbox", { name: "Company" })
  await expect(company).toHaveValue("Initech")
  await expect(page.getByRole("button", { name: "Keep" })).toBeFocused()
  // Its fields can't be typed in meanwhile, its name included (inert, which Playwright doesn't count as hidden).
  const role = page.getByRole("textbox", { name: "Role" }).nth(1)
  for (const box of [role, company]) expect(await box.evaluate((box) => box.closest("[inert]") !== null)).toBe(true)

  await page.getByRole("button", { name: "Keep" }).click()
  await expect(page.getByRole("button", { name: "Delete entry 2" })).toBeFocused()
  await expect(page.getByRole("status").filter({ hasText: "Delete it?" })).toHaveCount(0)
  for (const box of [role, company]) expect(await box.evaluate((box) => box.closest("[inert]") !== null)).toBe(false)
  expect(errors).toEqual([])
})

test("a deleted entry comes back with Undo, or ⌘Z (Ctrl+Z) outside a field, in its place and open", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await openSection(page, "Experience")
  const before = (await savedResume(page, RESUME.id)).workExperienceSection
  // The open entry's Company box, its name, typed in where it's shown.
  const company = page.getByRole("textbox", { name: "Company" })
  const deleteEntry2 = async () => {
    await page.getByRole("button", { name: "Delete entry 2" }).click()
    await page.getByRole("button", { name: "Delete", exact: true }).click()
    await expect(page.getByRole("button", { name: "Edit entry 3" })).toHaveCount(0)
  }

  // Deleted, it's said aloud and Undo has the focus. Undo puts it back as it
  // was, in its place, open with the cursor in it.
  await page.getByRole("button", { name: "Edit entry 2" }).click()
  await deleteEntry2()
  await expect(page.getByRole("status").filter({ hasText: "deleted" })).toHaveText("“Initech” deleted")
  const undo = page.getByRole("button", { name: "Undo" })
  await expect(undo).toBeFocused()
  await expect(undo).toHaveAttribute("aria-keyshortcuts", /^(Meta|Control)\+Z$/)
  await undo.click()
  await expect(page.getByRole("status").filter({ hasText: "back" })).toHaveText("“Initech” is back")
  await expect(company).toBeFocused()
  await expect(company).toHaveValue("Initech")
  await expect.poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection).toEqual(before)

  // In a field, the shortcut takes back typing and leaves the entry deleted.
  // Time stands still from the delete to the last shortcut, so Undo is still
  // on offer then: on a busy CI runner the steps between can take longer than
  // its 6 seconds (UNDO_MS).
  await deleteEntry2()
  await page.clock.pauseAt(Date.now() + 1_000)
  await page.getByRole("button", { name: "Edit entry 1" }).click()
  await company.focus()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(undo).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit entry 3" })).toHaveCount(0)

  // From another section, the shortcut brings the entry back in its own.
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Skills$/ })
    .click()
  await expect(editorTitle(page)).toHaveText(/Skills/)
  await expect(undo).toBeVisible()
  await page.keyboard.press("ControlOrMeta+z")
  // The entry slides open and is saved on the page's clock.
  await page.clock.resume()
  await expect(editorTitle(page)).toHaveText(/Experience/)
  await expect(page.getByRole("button", { name: "Done editing entry 2" })).toBeVisible()
  await expect(undo).toHaveCount(0)
  await expect.poll(async () => (await savedResume(page, RESUME.id)).workExperienceSection).toEqual(before)
  expect(errors).toEqual([])
})
