import { readFileSync } from "node:fs"
import { expect, test, type Page } from "./test"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import {
  editorHeading,
  editorTitle,
  openFile,
  pageErrors,
  pdfText,
  preview,
  previewShown,
  saveResumes,
  savedResume,
  seriousAccessibilityProblems,
} from "./helpers"

const initial = {
  id: "flexible",
  resumeTitle: "Flexible",
  selectedTemplate: "jake",
  profileSection: { fullName: "Ada Lovelace" },
  workExperienceSection: [{ id: 1, workRole: "Engineer", companyName: "Computing", workDescription: "• Built the analytical engine" }],
}
const nav = (page: Page) => page.getByRole("navigation", { name: "Sections" })
async function open(page: Page) {
  await saveResumes(page, [initial])
  await page.goto("/create/new/flexible")
}
const menu = (page: Page) => page.getByRole("menu", { name: "Add section" })
/** Adds a section from the Add section menu: an optional one, or a custom Text or Bullet list. */
async function add(page: Page, kind: string) {
  await nav(page).getByRole("button", { name: "Add section", exact: true }).click()
  if (kind === "Text" || kind === "Bullet list") await menu(page).getByRole("menuitem", { name: "Custom section" }).click()
  await menu(page).getByRole("menuitem", { name: kind, exact: true }).click()
  await expect(menu(page)).toBeHidden()
}
async function rename(page: Page, heading: string) {
  await page.getByRole("button", { name: "Rename section", exact: true }).click()
  await page.getByRole("textbox", { name: "Section title" }).fill(heading)
  await page.getByRole("textbox", { name: "Section title" }).press("Enter")
}

test("two added sections called Experience are told apart, print, and open again from the PDF without a left-out line, and one can be deleted", async ({
  page,
  browser,
}, info) => {
  const errors = pageErrors(page)
  await open(page)
  await previewShown(page)
  // The summary is the profile's, which the editor opens on.
  await page.getByRole("textbox", { name: "Summary", exact: true }).fill("A precise summary.\n\n○ Literal prose.")
  await add(page, "Text")
  await rename(page, "Experience")
  await page.getByRole("textbox", { name: "Text", exact: true }).fill("Community projects and interests.")
  await add(page, "Bullet list")
  await rename(page, "Experience")
  await page
    .getByRole("textbox", { name: "Bullet points", exact: true })
    .fill("• **Public** list item\n○ PRIVATE_SENTINEL\n• Final list item")
  await expect(nav(page).getByRole("button", { name: /^Experience, section \d+$/ })).toHaveCount(3)
  await expect.poll(async () => Object.keys((await savedResume(page, "flexible")).extraSections ?? {})).toHaveLength(2)
  await nav(page)
    .getByRole("button", { name: /Profile$/ })
    .click()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download PDF", exact: true }).click()
  const file = info.outputPath("flexible.pdf")
  await (await downloading).saveAs(file)
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), isEvalSupported: false }).promise
  try {
    const attachment = (await doc.getAttachments())["resumezip.json"]
    const json = new TextDecoder().decode(attachment.content)
    expect(JSON.parse(json).version).toBe(2)
    expect(json).not.toContain("PRIVATE")
  } finally {
    await doc.destroy()
  }
  const text = await pdfText(file)
  expect(text).toContain("Community projects and interests")
  expect(text).toContain("Literal prose")
  expect(text).not.toContain("PRIVATE")
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  await other.goto("/create/dashboard")
  await openFile(other.getByRole("button", { name: "Open a file" }).first(), file)
  await expect(other).toHaveURL(/\/create\/new\/flexible$/)
  await previewShown(other)
  const reopened = await savedResume(other, "flexible")
  expect(Object.keys(reopened.extraSections)).toHaveLength(2)
  expect(reopened.profileSection.summary).toBe("A precise summary.\n\n○ Literal prose.")
  expect(JSON.stringify(reopened)).not.toContain("PRIVATE")
  await elsewhere.close()
  await page.reload()
  await previewShown(page)
  // The last section is one of the two added.
  await nav(page)
    .getByRole("button", { name: /^Experience, section \d+$/ })
    .last()
    .click()
  // The bin asks without a word in the form: armed, its name says what would go, what's under the title fades out
  // of reach, and on the page the pen strikes through this section's lines alone (its title and two bullets; its
  // left-out line isn't printed), not those of the other two called Experience. Escape backs out, and the pen lifts.
  const bin = page.getByRole("button", { name: "Delete section", exact: true })
  const armed = page.getByRole("button", { name: "Delete Experience", exact: true })
  // The pen's lines are drawn on the page, unseen by a screen reader, which hears the question instead.
  const struck = preview(page).locator(".pen-strike path")
  await bin.click()
  await expect(armed).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "Press again to delete Experience." })).toBeAttached()
  expect(await page.getByRole("checkbox", { name: "Include section in the PDF" }).evaluate((box) => box.closest("[inert]") !== null)).toBe(
    true,
  )
  await expect(struck).toHaveCount(3)
  await armed.press("Escape")
  await expect(bin).toBeFocused()
  await expect(struck).toHaveCount(0)
  // A double-click arms it, but its second click doesn't delete, and a click anywhere else backs out.
  await bin.dblclick()
  await expect(armed).toBeVisible()
  await page.getByRole("heading", { level: 1 }).click()
  await expect(bin).toBeVisible()
  await expect.poll(async () => Object.keys((await savedResume(page, "flexible")).extraSections)).toHaveLength(2)
  // Its second click deletes.
  await bin.click()
  await armed.click()
  // The section before it shows, with the focus on its title.
  await expect(editorTitle(page)).toBeFocused()
  await expect.poll(async () => Object.keys((await savedResume(page, "flexible")).extraSections)).toHaveLength(1)
  expect(errors).toEqual([])
})

test("a resume starts with four sections, and the optional ones are added and deleted from the list", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page)
  await previewShown(page)
  await expect(nav(page).getByRole("button", { name: /^(Education|Experience|Skills|Projects)$/ })).toHaveCount(4)
  await expect(nav(page).getByRole("button", { name: /^Awards & Certifications$/ })).toHaveCount(0)
  await add(page, "Awards & Certifications")
  await expect(editorHeading(page, "Awards & Certifications", { exact: true })).toBeVisible()
  await expect.poll(async () => (await savedResume(page, "flexible")).sectionOrder).toContain("Awards")
  // Added once, it's no longer offered. The menu opens over the page, and
  // Escape closes it, back on its button.
  const awards = nav(page).getByRole("button", { name: "Awards & Certifications", exact: true })
  const before = await awards.boundingBox()
  await nav(page).getByRole("button", { name: "Add section", exact: true }).click()
  await expect(menu(page).getByRole("menuitem", { name: "Publications", exact: true })).toBeFocused()
  await expect(menu(page).getByRole("menuitem", { name: "Awards & Certifications", exact: true })).toHaveCount(0)
  expect(await awards.boundingBox()).toEqual(before)
  await page.keyboard.press("ArrowDown")
  await expect(menu(page).getByRole("menuitem", { name: "Volunteer", exact: true })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(menu(page)).toBeHidden()
  await expect(nav(page).getByRole("button", { name: "Add section", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await page.getByRole("button", { name: "Delete Awards & Certifications", exact: true }).click()
  await expect(nav(page).getByRole("button", { name: /^Awards & Certifications$/ })).toHaveCount(0)
  await expect.poll(async () => (await savedResume(page, "flexible")).sectionOrder).not.toContain("Awards")
  expect(errors).toEqual([])
})

test("the Add section menu stays closed once a section is chosen, though the page scrolls as it goes", async ({ page }) => {
  const errors = pageErrors(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await open(page)
  await previewShown(page)
  // The page scrolls to the new section as the menu goes, and the menu follows its button as anything
  // scrolls. Here a scroll comes the moment each timer runs, the menu's own included, so one lands as it goes.
  await page.evaluate(() => {
    const later = window.setTimeout
    window.setTimeout = ((run: TimerHandler, wait?: number, ...rest: unknown[]) =>
      later(() => {
        if (typeof run === "function") run(...rest)
        window.dispatchEvent(new Event("scroll"))
      }, wait)) as typeof window.setTimeout
  })
  await nav(page).getByRole("button", { name: "Add section", exact: true }).click()
  await menu(page).getByRole("menuitem", { name: "Publications", exact: true }).click()
  await expect(editorHeading(page, "Publications", { exact: true })).toBeVisible()
  await expect(menu(page)).toBeHidden()
  // A fixed wait: proving it doesn't come back.
  await page.waitForTimeout(500)
  await expect(menu(page)).toBeHidden()
  expect(errors).toEqual([])
})

test("an added section alone is checked, its finding selects the line it's about, and deleting it moves the focus to the section before", async ({
  page,
}) => {
  const errors = pageErrors(page)
  const sectionId = "11111111-1111-4111-8111-111111111111"
  await saveResumes(page, [
    {
      id: "flexible",
      resumeTitle: "Extra checks",
      profileSection: { fullName: "Ada Lovelace" },
      extraSections: { [sectionId]: { kind: "list", heading: "Interests", bullets: "○ PRIVATE_SENTINEL\n• Wrote the the notes" } },
      sectionOrder: [`extra:${sectionId}`],
    },
  ])
  await page.goto("/create/new/flexible")
  await previewShown(page)
  await page.getByRole("tab", { name: "ATS checks" }).click()
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  await expect(panel.getByRole("region", { name: "ATS score" })).not.toContainText("Not scored yet")
  const issue = panel.getByRole("button", { name: /“the” twice in a row/ })
  await expect(issue).toBeVisible()
  await issue.click()
  const field = page.getByRole("textbox", { name: "Bullet points", exact: true })
  await expect(field).toBeFocused()
  expect(await page.evaluate(() => String(getSelection()))).toBe("Wrote the the notes")
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await page.getByRole("button", { name: "Delete Interests", exact: true }).click()
  // The section before it shows, with the focus on its title, as in Write.
  await expect(editorTitle(page)).toBeFocused()
  await expect(issue).toBeHidden()
  expect(errors).toEqual([])
})

test.describe("touch", () => {
  test.use({ hasTouch: true })
  test("on a phone, an added section doesn't open the keyboard, keeps its name when given a blank one, and can be left out and deleted", async ({
    page,
  }) => {
    const errors = pageErrors(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await open(page)
    await add(page, "Text")
    await expect(editorHeading(page, "New section", { exact: true })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Text", exact: true })).not.toBeFocused()
    await page.getByRole("textbox", { name: "Text", exact: true }).fill("Narrow screen content.")
    await rename(page, "")
    await expect(editorHeading(page, "New section", { exact: true })).toBeVisible()
    await page.getByRole("checkbox", { name: "Include section in the PDF", exact: true }).uncheck()
    await expect
      .poll(async () => Object.values((await savedResume(page, "flexible")).extraSections ?? {}).some((section: any) => section.leftOut))
      .toBe(true)
    await page.getByRole("button", { name: "Delete section", exact: true }).click()
    await page.getByRole("button", { name: "Delete New section", exact: true }).click()
    await expect.poll(async () => Object.keys((await savedResume(page, "flexible")).extraSections)).toEqual([])
    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
    expect(errors).toEqual([])
  })
})

test("a resume from before sections were added from the list shows only the ones it uses, and one added after stays", async ({ page }) => {
  const errors = pageErrors(page)
  // Saved when every resume listed all eight sections, used or not.
  const older = {
    ...initial,
    id: "older",
    sectionOrder: ["Education", "Work", "Projects", "Publications", "Skills", "Leadership", "Volunteership", "Awards"],
    leadershipExperienceSection: [{ id: 1, leadershipRole: "Club president" }],
  }
  await saveResumes(page, [older])
  await page.goto("/create/new/older")
  const listed = (name: string) => nav(page).getByRole("button", { name: new RegExp(`^${name}$`) })
  await expect(listed("Leadership")).toHaveCount(1)
  for (const empty of ["Publications", "Volunteer", "Awards & Certifications"]) await expect(listed(empty)).toHaveCount(0)
  await previewShown(page)

  // Added now, Publications stays while it's empty, after a reload too.
  await add(page, "Publications")
  await expect(listed("Publications")).toHaveCount(1)
  await expect
    .poll(() => savedResume(page, "older"))
    .toMatchObject({ sectionsChosen: true, sectionOrder: ["Education", "Work", "Projects", "Skills", "Leadership", "Publications"] })
  await page.reload()
  await expect(listed("Publications")).toHaveCount(1)
  await expect(listed("Awards & Certifications")).toHaveCount(0)
  await previewShown(page)
  expect(errors).toEqual([])
})

test("a section the resume started with can be deleted, and added back from the list", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page)
  await previewShown(page)
  const education = nav(page).getByRole("button", { name: /^Education$/ })
  await education.click()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await page.getByRole("button", { name: "Delete Education", exact: true }).click()
  await expect(education).toHaveCount(0)
  await expect.poll(async () => (await savedResume(page, "flexible")).sectionOrder).not.toContain("Education")

  // Deleted, it's offered in Add section, and comes back at the end.
  await add(page, "Education")
  await expect(education).toHaveCount(1)
  await expect.poll(async () => (await savedResume(page, "flexible")).sectionOrder).toEqual(["Work", "Skills", "Projects", "Education"])
  await page.reload()
  await expect(education).toHaveCount(1)
  await previewShown(page)
  expect(errors).toEqual([])
})
