import { expect, test, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const HOBBIES = "00000000-0000-4000-8000-000000000001"

/** Everything the PDF doesn't carry: a name and tag, an entry, a bullet and a section left out, and what the checker was told. */
const ADA = {
  id: "ada",
  resumeTitle: "Ada at Google",
  resumeTag: "professional",
  updatedAt: "2026-10-08T12:00:00.000Z",
  selectedTemplate: "resumeworded",
  sectionOrder: ["Work", "Education", "Skills", `extra:${HOBBIES}`],
  sectionsChosen: true,
  headings: { work: "Engineering" },
  profileSection: { fullName: "Ada Lovelace", email: "ada@example.com" },
  educationSection: [{ id: 1, schoolName: "University of London", degree: "B.S. in Mathematics" }],
  workExperienceSection: [
    { id: 1, workRole: "Engineer", companyName: "Google", workDescription: "• Built the search index\n○ Fed the cat" },
    { id: 2, workRole: "Secret agent", companyName: "MI6", leftOut: true },
  ],
  skillsSection: [],
  projectsSection: [],
  publicationsSection: [],
  volunteerExperienceSection: [],
  leadershipExperienceSection: [],
  awardsSection: [],
  extraSections: { [HOBBIES]: { kind: "text", heading: "Hobbies", text: "Chess", leftOut: true } },
  check: { dismissed: [], words: ["Lovelace"] },
}

const GRACE = {
  ...ADA,
  id: "grace",
  resumeTitle: "Grace",
  resumeTag: "academic",
  updatedAt: "2026-10-07T12:00:00.000Z",
  profileSection: { fullName: "Grace Hopper" },
  workExperienceSection: [{ id: 1, workRole: "Rear Admiral", companyName: "U.S. Navy" }],
  extraSections: {},
  sectionOrder: ["Work", "Education", "Skills"],
  check: { dismissed: [], words: [] },
}

/** Saves these resumes in the page's browser before it opens, as an earlier visit would have. */
async function savedBefore(page: Page, resumes: { id: string }[]) {
  await page.addInitScript((resumes) => {
    for (const resume of resumes) {
      const key = `resume:${resume.id}`
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(resume))
    }
  }, resumes)
}

const saved = (page: Page, id: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), `resume:${id}`)

test("a resume downloaded as JSON from the ▾ menu opens in another browser exactly as it was", async ({ page, browser }, testInfo) => {
  const errors = pageErrors(page)
  await savedBefore(page, [ADA])
  await page.goto("/create/new/ada")
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()

  // The ▾ opens its menu from the keyboard on its first choice, arrows move
  // through it, and Escape puts the keyboard back on the ▾.
  const more = page.getByRole("button", { name: "More formats" })
  const json = page.getByRole("menuitem", { name: /^JSON/ })
  await more.focus()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("menuitem", { name: /^Word/ })).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("menuitem", { name: /^Save to Google Drive/ })).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(json).toBeFocused()
  await expect(more).toHaveAttribute("aria-expanded", "true")
  // Each choice shows its own mark (Word's W, Drive's triangle, JSON's braces), to find it at a glance.
  for (const item of await page.getByRole("menuitem").all()) await expect(item.locator("svg")).toHaveCount(1)
  // Its row is rounded to sit inside the menu's corners, not a pill bulging out of two lines.
  const corner = (element: Element) => parseFloat(getComputedStyle(element).borderTopLeftRadius)
  expect(await json.evaluate(corner)).toBeLessThan(await page.getByRole("menu").evaluate(corner))
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expect(more).toBeFocused()

  // Choosing JSON saves "<name>.json", and the keyboard goes back to the ▾.
  await more.click()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await expect(json).toBeFocused()
  const downloading = page.waitForEvent("download")
  await page.keyboard.press("Enter")
  const download = await downloading
  expect(download.suggestedFilename()).toBe("Ada at Google.json")
  await expect(more).toBeFocused()
  await expect(page.getByRole("status").filter({ hasText: "JSON downloaded" })).toBeAttached()
  const file = testInfo.outputPath("ada.json")
  await download.saveAs(file)

  // Opened in another browser, it's the same resume, with its name and what's left out of the PDF.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other.locator('input[type="file"]').setInputFiles(file)
  await expect(other).toHaveURL(/\/create\/new\/ada$/)
  await expect(other.getByLabel("Resume name")).toHaveValue("Ada at Google")
  expect(await saved(other, "ada")).toMatchObject(ADA)
  await elsewhere.close()

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("Download all saves every resume in one file, which opens them all, with one question for those already here", async ({
  page,
  browser,
}, testInfo) => {
  const errors = pageErrors(page)
  await savedBefore(page, [ADA, GRACE])
  await page.goto("/create/dashboard")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download all" }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^resumezip-resumes-\d{4}-\d\d-\d\d\.json$/)
  const file = testInfo.outputPath("resumes.json")
  await download.saveAs(file)

  // In another browser, they're all added, as they were, and the list shows them.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other.locator('input[type="file"]').setInputFiles(file)
  // Said on the page, and to screen readers.
  await expect(other.getByRole("paragraph").filter({ hasText: "Added 2 resumes." })).toBeVisible()
  await expect(other.getByRole("status").filter({ hasText: "Added" })).toHaveText("Added 2 resumes.")
  await expect(other).toHaveURL(/\/create\/dashboard$/)
  await expect(other.getByRole("link", { name: "Ada at Google" })).toBeVisible()
  await expect(other.getByRole("link", { name: "Grace" })).toBeVisible()
  expect(await saved(other, "ada")).toMatchObject(ADA)
  expect(await saved(other, "grace")).toMatchObject(GRACE)
  await elsewhere.close()

  // Here, Grace has changed since. Opening the file asks once, about her, and
  // says the file's copy is older; Ada, the same as in the file, is left as she is.
  await page.evaluate((grace) => {
    localStorage.setItem(
      "resume:grace",
      JSON.stringify({ ...grace, updatedAt: "2026-10-09T09:00:00.000Z", profileSection: { fullName: "Grace Murray" } }),
    )
  }, GRACE)
  await page.reload()
  await page.locator('input[type="file"]').setInputFiles(file)
  const question = page.getByRole("dialog", { name: "You already have one of these" })
  await expect(question).toContainText(
    "“Grace” is in this browser, and the file has a different copy. The file's copy is older: replacing loses your changes since then.",
  )
  // Keeping both is the main choice, as replacing loses something.
  await expect(question.getByRole("button", { name: "Keep both" })).toHaveCSS("background-color", "rgb(17, 19, 24)")
  expect(await seriousAccessibilityProblems(page)).toEqual([])

  await question.getByRole("button", { name: "Replace it" }).click()
  await expect(page.getByRole("paragraph").filter({ hasText: "Replaced 1 resume. 1 was already here." })).toBeVisible()
  expect(await saved(page, "grace")).toMatchObject(GRACE)

  // Downloading again is said aloud, with what the file did still on the page.
  const again = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download all" }).click()
  await again
  await expect(page.getByRole("status").filter({ hasText: "Downloaded" })).toHaveText("Downloaded 2 resumes in one file")

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("a JSON file that isn't from resumezip, or is too long to open, is refused with a message", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  const error = page.getByRole("dialog", { name: "Couldn't open that file" })
  const json = (name: string, value: unknown) => ({ name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) })

  await page.locator('input[type="file"]').setInputFiles(json("resume.json", { basics: { name: "Ada Lovelace" } }))
  await expect(error).toContainText("This JSON file isn't from resumezip. Open one you downloaded here, or a PDF or Word file.")
  await error.getByRole("button", { name: "Close" }).click()

  // Over MAX_LENGTH (lib/resumeFile.ts), ten million characters.
  await page
    .locator('input[type="file"]')
    .setInputFiles(json("big.json", { format: "resumezip", version: 2, resume: { notes: "x".repeat(10_000_000) } }))
  await expect(error).toContainText("This file is longer than resumezip can open")
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("resume:")))).toEqual([])

  expect(errors).toEqual([])
})
