import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const initial = {
  id: "flexible",
  resumeTitle: "Flexible",
  selectedTemplate: "jake",
  profileSection: { fullName: "Ada Lovelace" },
  workExperienceSection: [{ id: 1, workRole: "Engineer", companyName: "Computing", workDescription: "• Built the analytical engine" }],
}
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("resume:flexible") ?? "{}"))
const nav = (page: Page) => page.getByRole("navigation", { name: "Sections" })
const preview = (page: Page) => page.getByRole("region", { name: "Live preview" })
const previewShown = (page: Page) => expect(preview(page).locator(".react-pdf__Page__canvas").first()).toBeVisible()
async function open(page: Page) {
  await page.addInitScript((resume) => {
    if (!localStorage.getItem("resume:flexible")) localStorage.setItem("resume:flexible", JSON.stringify(resume))
  }, initial)
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

test("optional section lifecycle, duplicate headings, keyboard movement and v2 PDF reopening", async ({ page, browser }, info) => {
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
  await expect(nav(page).getByRole("button", { name: /^\d+ Experience, section \d+$/ })).toHaveCount(3)
  await expect.poll(async () => Object.keys((await saved(page)).extraSections ?? {})).toHaveLength(2)
  await nav(page)
    .getByRole("button", { name: /Profile$/ })
    .click()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  await page.screenshot({ path: info.outputPath("flexible-editor.png"), fullPage: true })
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
    const contents = await Promise.all(
      Array.from({ length: doc.numPages }, async (_, index) => (await doc.getPage(index + 1)).getTextContent()),
    )
    const text = contents.flatMap((content) => content.items.map((item) => ("str" in item ? item.str : ""))).join(" ")
    expect(text).toContain("Community projects and interests")
    expect(text).toContain("Literal prose")
    expect(text).not.toContain("PRIVATE")
  } finally {
    await doc.destroy()
  }
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  await other.goto("/create/dashboard")
  await other.locator('input[type="file"]').setInputFiles(file)
  await expect(other).toHaveURL(/\/create\/new\/flexible$/)
  await previewShown(other)
  const reopened = await saved(other)
  expect(Object.keys(reopened.extraSections)).toHaveLength(2)
  expect(reopened.profileSection.summary).toBe("A precise summary.\n\n○ Literal prose.")
  expect(JSON.stringify(reopened)).not.toContain("PRIVATE")
  await elsewhere.close()
  await page.reload()
  await previewShown(page)
  // The last section is one of the two added.
  await nav(page)
    .getByRole("button", { name: /^\d+ Experience, section \d+$/ })
    .last()
    .click()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Escape")
  await expect(page.getByRole("button", { name: "Delete section", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await expect(nav(page).locator('[aria-current="true"]')).toBeFocused()
  await expect.poll(async () => Object.keys((await saved(page)).extraSections)).toHaveLength(1)
  expect(errors).toEqual([])
})

test("a resume starts with four sections, and the optional ones are added and deleted from the list", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page)
  await previewShown(page)
  await expect(nav(page).getByRole("button", { name: /^\d+ (Education|Experience|Skills|Projects)$/ })).toHaveCount(4)
  await expect(nav(page).getByRole("button", { name: /^\d+ Awards & Certifications$/ })).toHaveCount(0)
  await add(page, "Awards & Certifications")
  await expect(page.getByRole("heading", { name: "Awards & Certifications", exact: true })).toBeVisible()
  await expect.poll(async () => (await saved(page)).sectionOrder).toContain("Awards")
  // Added once, it's no longer offered. The menu opens over the page, and
  // Escape closes it, back on its button.
  const help = page.getByText("Drag a section to change its place on the page.")
  const before = await help.boundingBox()
  await nav(page).getByRole("button", { name: "Add section", exact: true }).click()
  await expect(menu(page).getByRole("menuitem", { name: "Publications", exact: true })).toBeFocused()
  await expect(menu(page).getByRole("menuitem", { name: "Awards & Certifications", exact: true })).toHaveCount(0)
  expect(await help.boundingBox()).toEqual(before)
  await page.keyboard.press("ArrowDown")
  await expect(menu(page).getByRole("menuitem", { name: "Volunteer", exact: true })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(menu(page)).toBeHidden()
  await expect(nav(page).getByRole("button", { name: "Add section", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await expect(nav(page).getByRole("button", { name: /^\d+ Awards & Certifications$/ })).toHaveCount(0)
  await expect.poll(async () => (await saved(page)).sectionOrder).not.toContain("Awards")
  expect(errors).toEqual([])
})

test("extra-only checking targets original list lines and deletion restores focus in Check mode", async ({ page }) => {
  const sectionId = "11111111-1111-4111-8111-111111111111"
  await page.addInitScript(
    ({ sectionId }) =>
      localStorage.setItem(
        "resume:flexible",
        JSON.stringify({
          id: "flexible",
          resumeTitle: "Extra checks",
          profileSection: { fullName: "Ada Lovelace" },
          extraSections: { [sectionId]: { kind: "list", heading: "Interests", bullets: "○ PRIVATE_SENTINEL\n• Wrote the the notes" } },
          sectionOrder: [`extra:${sectionId}`],
        }),
      ),
    { sectionId },
  )
  await page.goto("/create/new/flexible")
  await previewShown(page)
  await page.getByRole("tab", { name: /^Check/ }).click()
  const panel = page.getByRole("tabpanel", { name: /^Check/ })
  await expect(panel.getByRole("region", { name: "Resume score" })).not.toContainText("Not scored yet")
  const issue = panel.getByRole("button", { name: /“the” twice in a row/ })
  await expect(issue).toBeVisible()
  await issue.click()
  const field = page.getByRole("textbox", { name: "Bullet points", exact: true })
  await expect(field).toBeFocused()
  expect(await field.evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(
    "Wrote the the notes",
  )
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Delete section", exact: true }).click()
  await expect(page.locator("main h1")).toBeFocused()
  await expect(issue).toBeHidden()
})

test.describe("touch", () => {
  test.use({ hasTouch: true })
  test("narrow flows keep the keyboard closed on add and allow literal text, inclusion and deletion", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await open(page)
    await add(page, "Text")
    await expect(page.getByRole("heading", { name: "New section", exact: true })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Text", exact: true })).not.toBeFocused()
    await page.getByRole("textbox", { name: "Text", exact: true }).fill("Narrow screen content.")
    await rename(page, "")
    await expect(page.getByRole("heading", { name: "New section", exact: true })).toBeVisible()
    await page.getByRole("checkbox", { name: "Include section in the PDF", exact: true }).uncheck()
    await expect.poll(async () => Object.values((await saved(page)).extraSections ?? {}).some((section: any) => section.leftOut)).toBe(true)
    await page.getByRole("button", { name: "Delete section", exact: true }).click()
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused()
    await page.getByRole("button", { name: "Delete section", exact: true }).click()
    await expect.poll(async () => Object.keys((await saved(page)).extraSections)).toEqual([])
    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
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
  await page.addInitScript((resume) => {
    if (!localStorage.getItem("resume:older")) localStorage.setItem("resume:older", JSON.stringify(resume))
  }, older)
  await page.goto("/create/new/older")
  const listed = (name: string) => nav(page).getByRole("button", { name: new RegExp(`^\\d+ ${name}$`) })
  await expect(listed("Leadership")).toHaveCount(1)
  for (const empty of ["Publications", "Volunteer", "Awards & Certifications"]) await expect(listed(empty)).toHaveCount(0)
  await previewShown(page)

  // Added now, Publications stays while it's empty, after a reload too.
  await add(page, "Publications")
  await expect(listed("Publications")).toHaveCount(1)
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("resume:older") ?? "{}")))
    .toMatchObject({ sectionsChosen: true, sectionOrder: ["Education", "Work", "Projects", "Skills", "Leadership", "Publications"] })
  await page.reload()
  await expect(listed("Publications")).toHaveCount(1)
  await expect(listed("Awards & Certifications")).toHaveCount(0)
  await previewShown(page)
  expect(errors).toEqual([])
})
