import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "./variant"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { boxText, cursorInBox, editorTitle, pageErrors, selectInBox, seriousAccessibilityProblems } from "./helpers"

// Entries and bullets can be moved, and left out of the PDF without being
// deleted, to tailor one resume to a job.

const BULLETS = "What you did"
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

const preview = (page: Page) => page.getByRole("region", { name: "Live preview" })

/**
 * The text of the preview's pages, in the order it's printed, or "" while a
 * page's text is still being laid out (it ends with an "endOfContent" mark),
 * so that what isn't printed is never missing just because it isn't there yet.
 */
const printed = (page: Page) =>
  preview(page)
    .locator(".react-pdf__Page__textContent")
    .evaluateAll((layers) =>
      layers.every((layer) => layer.querySelector(".endOfContent")) ? layers.map((layer) => layer.textContent ?? "").join(" ") : "",
    )

/** Which of `names` the preview prints, in the order it prints them. */
const printedOrder = async (page: Page, names: string[]) => {
  const text = await printed(page)
  return names.filter((name) => text.includes(name)).sort((a, b) => text.indexOf(a) - text.indexOf(b))
}

/** The text of a downloaded PDF. */
async function pdfText(file: string): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), isEvalSupported: false }).promise
  try {
    const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, index) => doc.getPage(index + 1)))
    const contents = await Promise.all(pages.map((page) => page.getTextContent()))
    return contents.flatMap((content) => content.items.map((item) => ("str" in item ? item.str : ""))).join(" ")
  } finally {
    await doc.destroy()
  }
}

/** The resume as saved in this browser. */
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), `resume:${RESUME.id}`)

// Waits for the preview, so the PDF compiler's download isn't cut off by a reload, which Safari logs as an error.
const previewShown = (page: Page) => expect(preview(page).locator(".react-pdf__Page__canvas").first()).toBeVisible()

async function openSection(page: Page, section: string, resume: { id: string } & Record<string, unknown> = RESUME) {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: `resume:${resume.id}`, value: JSON.stringify(resume) },
  )
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
  // Open, its name is typed in where it's shown, before its company.
  await expect(page.getByRole("textbox", { name: "Role" })).toHaveValue("Engineer")
  await expect(page.getByText("· Google", { exact: true })).toBeVisible()

  // Its bullets show two at a time until the box is used, which then shows them all. (The folded
  // cards' boxes are on the page too, out of reach, ready to slide open.)
  const more = page.getByText("+ 1 more", { exact: true })
  const box = page.getByLabel(BULLETS).first()
  await expect(more).toBeVisible()
  await box.click()
  await expect(more).toBeHidden()
  await expect.poll(() => boxText(box)).toBe("• Built the search index\n• Cut serving costs by 30%\n• Mentored four interns")

  await done.click()
  await expect(done).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Edit entry 1" })).toBeVisible()

  // Folded, it shows its name, its company and how many bullets it has, and a click on it opens it again,
  // with its bullets two at a time again.
  await expect(page.getByText("3 bullets", { exact: true })).toBeVisible()
  await page.getByText("Engineer · Google", { exact: true }).click()
  await expect(done).toBeVisible()
  await expect(more).toBeVisible()

  expect(errors).toEqual([])
})

test("a folded card shows its dates in a few words, and the note under the title says when the newest is first", async ({ page }) => {
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
  await expect(page.getByText("Sep – Dec 2024 · 1 bullet", { exact: true })).toBeVisible()
  // The open card's long bullet is cut short at a word.
  await expect(page.getByText("• Built a service that cut page load time by 30% for twelve million…", { exact: true })).toBeVisible()

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
  await expect(page.getByText("Intern · Initech · Left out", { exact: true })).toBeVisible()
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
  await other.locator('input[type="file"]').setInputFiles(pdf)
  await expect(other).toHaveURL(/\/create\/new\/tailored$/)
  await previewShown(other)
  const restored = await other.evaluate(() => JSON.parse(localStorage.getItem("resume:tailored") ?? "{}"))
  expect(restored.workExperienceSection.map((entry: { companyName: string }) => entry.companyName)).toEqual(["Google", "Hooli"])
  expect(JSON.stringify(restored)).not.toContain("Initech")
  await elsewhere.close()

  // Changed here since, and with something left out, the resume has what the PDF doesn't, so opening the PDF here says so.
  await page.getByRole("checkbox", { name: "Include entry 3 in the PDF" }).uncheck()
  await expect.poll(async () => (await saved(page)).workExperienceSection[2].leftOut).toBe(true)
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(pdf)
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

test("bullets are moved and left out from the Arrange list, or moved with Alt and the arrow keys", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  // The first entry is open; its bullets are in its first bullets field.
  const field = page.locator('[data-field="workDescription"]').first()

  await field.getByRole("button", { name: "Arrange bullets" }).click()
  const list = field.getByRole("list", { name: BULLETS })
  await expect(list.getByRole("listitem")).toHaveText([/Built the search index/, /Cut serving costs/, /Mentored four interns/])
  await list.getByRole("button", { name: "Move bullet 1 down" }).focus()
  await page.keyboard.press("Enter")
  await expect(list.getByRole("button", { name: "Move bullet 2 down" })).toBeFocused()
  await expect(list.getByRole("listitem")).toHaveText([/Cut serving costs/, /Built the search index/, /Mentored four interns/])

  await list.getByRole("checkbox", { name: "Include bullet 3 in the PDF" }).uncheck()
  await expect(list.getByRole("listitem").nth(2)).toContainText("Left out")
  await expect
    .poll(() => printedOrder(page, ["Cut serving costs", "Built the search index", "Mentored four interns", "Initech"]))
    .toEqual(["Cut serving costs", "Built the search index", "Initech"])
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // Back in the text box, the left-out bullet starts with ○, and Alt+↓ moves the line the cursor is on.
  await field.getByRole("button", { name: "Done arranging bullets" }).click()
  const box = field.getByLabel(BULLETS)
  await expect.poll(() => boxText(box)).toBe("• Cut serving costs by 30%\n• Built the search index\n○ Mentored four interns")
  await box.focus()
  await selectInBox(box, 0)
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(() => boxText(box)).toBe("• Built the search index\n• Cut serving costs by 30%\n○ Mentored four interns")
  await expect
    .poll(async () => (await saved(page)).workExperienceSection[0].workDescription)
    .toBe("• Built the search index\n• Cut serving costs by 30%\n○ Mentored four interns")

  // Enter in a left-out bullet: the words moved to the new line stay left out.
  const split = "• Built the search index\n• Cut serving costs by 30%\n○ Mentored four".length
  await selectInBox(box, split)
  await page.keyboard.press("Enter")
  await expect.poll(() => boxText(box)).toBe("• Built the search index\n• Cut serving costs by 30%\n○ Mentored four\n○ interns")
  expect(await cursorInBox(box)).toBe(split + 3)

  expect(errors).toEqual([])
})

test("the Arrange list shows bold and italic words as they print, without their marks", async ({ page }) => {
  const errors = pageErrors(page)
  const [job, ...rest] = RESUME.workExperienceSection
  await openSection(page, "Experience", {
    ...RESUME,
    id: "tailored-marks",
    workExperienceSection: [{ ...job, workDescription: "• Built the **search** index\n• Cut costs by *30%*" }, ...rest],
  })
  const field = page.locator('[data-field="workDescription"]').first()
  await field.getByRole("button", { name: "Arrange bullets" }).click()
  const list = field.getByRole("list", { name: BULLETS })
  await expect(list.getByRole("listitem")).toHaveText(["Built the search index", "Cut costs by 30%"])
  await expect(list.getByRole("strong")).toHaveText("search")
  await expect(list.getByRole("emphasis")).toHaveText("30%")

  expect(errors).toEqual([])
})

test("a section with every entry left out isn't printed, title and all", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Skills")
  await expect.poll(() => printed(page)).toContain("Python, Rust")

  // Its eye is on its card, folded.
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
  await expect.poll(async () => (await saved(page)).sectionOrder.slice(0, 2)).toEqual(["Skills", "Work"])

  expect(errors).toEqual([])
})

const companies = async (page: Page) => (await saved(page)).workExperienceSection.map((entry: { companyName: string }) => entry.companyName)

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

test("a bullet keeps the focus as it moves, even past one with the same words", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  const field = page.locator('[data-field="workDescription"]').first()
  await field.getByLabel(BULLETS).fill("• Led the team\n○ Led the team\n• Wrote the docs")
  await field.getByRole("button", { name: "Arrange bullets" }).click()
  const rows = field.getByRole("list", { name: BULLETS }).getByRole("listitem")

  // The printed one moves down past the left-out copy, and the focus goes with it, so it can be moved again.
  await rows.nth(0).getByRole("button", { name: "Move bullet 1 down" }).focus()
  await page.keyboard.press("Enter")
  await expect(rows.nth(1).getByRole("button", { name: "Move bullet 2 down" })).toBeFocused()
  await expect(rows.nth(1).getByRole("checkbox")).toBeChecked()
  await page.keyboard.press("Enter")
  await expect(rows.nth(2).getByRole("button", { name: "Move bullet 3 down" })).toBeFocused()
  await expect
    .poll(async () => (await saved(page)).workExperienceSection[0].workDescription)
    .toBe("○ Led the team\n• Wrote the docs\n• Led the team")

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
  const field = page.locator('[data-field="workDescription"]').nth(1)
  const box = field.getByLabel(BULLETS)
  const selected = () => page.evaluate(() => String(getSelection()))
  await expect(box).toBeFocused()
  await expect.poll(selected).toBe("Responsible for the search index")

  // Arranging the bullets while the finding shows: the list stays open as the checker looks again.
  await field.getByRole("button", { name: "Arrange bullets" }).click()
  await field.getByRole("checkbox", { name: "Include bullet 2 in the PDF" }).uncheck()
  await expect.poll(() => printedOrder(page, ["search index", "serving costs"])).toEqual(["search index"])
  await expect(field.getByRole("list", { name: BULLETS })).toBeVisible()
  // And as Write mode hides the finding, and Check shows it again.
  const modes = page.getByRole("tablist", { name: "Write, check or style" })
  await modes.getByRole("tab", { name: "Write" }).click()
  await modes.getByRole("tab", { name: /^Check/ }).click()
  await expect(panel.getByRole("button", { name: weak("Google") })).toBeVisible()
  await expect(field.getByRole("list", { name: BULLETS })).toBeVisible()

  // Choosing the finding again goes back to the text, at its bullet.
  await panel.getByRole("button", { name: weak("Google") }).click()
  await expect(box).toBeFocused()
  await expect.poll(selected).toBe("Responsible for the search index")

  expect(errors).toEqual([])
})

test("the text box shows every bullet after arranging, and a deleted entry's mode isn't passed on", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  const field = page.locator('[data-field="workDescription"]').first()
  const box = field.getByLabel(BULLETS)
  await box.fill(Array.from({ length: 7 }, (_, index) => `• Shipped feature ${index + 1}`).join("\n"))
  await field.getByRole("button", { name: "Arrange bullets" }).click()
  await field.getByRole("button", { name: "Done arranging bullets" }).click()
  await expect.poll(() => box.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true)

  // The entry is deleted while its bullets are being arranged; the next one still opens with its text box.
  await field.getByRole("button", { name: "Arrange bullets" }).click()
  await page.getByRole("button", { name: "Delete entry 1" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByRole("button", { name: "Edit entry 3" })).toHaveCount(0)
  await page.getByRole("button", { name: "Edit entry 1" }).click()
  await expect(page.locator('[data-field="workDescription"]').first().getByRole("textbox", { name: BULLETS })).toHaveText(
    "• Filed the reports",
  )

  expect(errors).toEqual([])
})

test("asked whether to delete an entry, it shows its name and its fields fade, and Keep backs out", async ({ page }) => {
  const errors = pageErrors(page)
  await openSection(page, "Experience")
  await page.getByRole("button", { name: "Edit entry 2" }).click()
  await page.getByRole("button", { name: "Delete entry 2" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Delete it?" })).toBeVisible()
  // Its name stays, so it's clear which would go.
  const role = page.getByRole("textbox", { name: "Role" })
  await expect(role).toHaveValue("Intern")
  await expect(page.getByText("· Initech", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Keep" })).toBeFocused()
  // Its fields can't be typed in meanwhile, its name included (inert, which Playwright doesn't count as hidden).
  const company = page.getByRole("textbox", { name: "Company" }).nth(1)
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
  const before = (await saved(page)).workExperienceSection
  // The open entry's Role box, its name, typed in where it's shown.
  const role = page.getByRole("textbox", { name: "Role" })
  const deleteEntry2 = async () => {
    await page.getByRole("button", { name: "Delete entry 2" }).click()
    await page.getByRole("button", { name: "Delete", exact: true }).click()
    await expect(page.getByRole("button", { name: "Edit entry 3" })).toHaveCount(0)
  }

  // Deleted, it's said aloud and Undo has the focus. Undo puts it back as it
  // was, in its place, open with the cursor in it.
  await page.getByRole("button", { name: "Edit entry 2" }).click()
  await deleteEntry2()
  await expect(page.getByRole("status").filter({ hasText: "deleted" })).toHaveText("“Intern, Initech” deleted")
  const undo = page.getByRole("button", { name: "Undo" })
  await expect(undo).toBeFocused()
  await expect(undo).toHaveAttribute("aria-keyshortcuts", /^(Meta|Control)\+Z$/)
  await undo.click()
  await expect(page.getByRole("status").filter({ hasText: "back" })).toHaveText("“Intern, Initech” is back")
  await expect(role).toBeFocused()
  await expect(role).toHaveValue("Intern")
  await expect.poll(async () => (await saved(page)).workExperienceSection).toEqual(before)

  // In a field, the shortcut takes back typing and leaves the entry deleted.
  // Time stands still from the delete to the last shortcut, so Undo is still
  // on offer then: on a busy CI runner the steps between can take longer than
  // its 6 seconds (UNDO_MS).
  await deleteEntry2()
  await page.clock.pauseAt(Date.now() + 1_000)
  await page.getByRole("button", { name: "Edit entry 1" }).click()
  await role.focus()
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
  await expect.poll(async () => (await saved(page)).workExperienceSection).toEqual(before)
  expect(errors).toEqual([])
})
