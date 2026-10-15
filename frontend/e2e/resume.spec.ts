import { readFileSync } from "node:fs"
import { expect, test } from "./variant"
import { boxText, pageErrors, seriousAccessibilityProblems } from "./helpers"

test("a new visitor writes a resume, sees it, downloads it and opens it again", async ({ page, browser }, testInfo) => {
  const errors = pageErrors(page)

  // A first visit goes straight to a new resume.
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)

  // The preview shows what's typed. Jake's prints the name in small caps.
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email").fill("ada@example.com")
  // The browser can fill in the name, email and phone. Web addresses get a
  // phone's keyboard for them, and no spelling marks or capital first letter.
  await expect(page.getByLabel("Full name")).toHaveAttribute("autocomplete", "name")
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email")
  await expect(page.getByLabel("Phone")).toHaveAttribute("autocomplete", "tel")
  for (const label of ["LinkedIn", "GitHub", "Website"]) {
    const field = page.getByLabel(label, { exact: true })
    await expect(field).toHaveAttribute("inputmode", "url")
    await expect(field).toHaveAttribute("spellcheck", "false")
    await expect(field).toHaveAttribute("autocapitalize", "off")
  }
  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByText(/Ada Lovelace/i).first()).toBeVisible()
  await expect(preview.getByText("ada@example.com").first()).toBeVisible()

  // The editor passes the same accessibility checks as the other pages. The
  // preview's pages are left out: pdf.js draws the PDF's email link with no
  // name a screen reader can read, which only dropping its link and text
  // layers would fix.
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // Download gives a PDF.
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download PDF" }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  const pdf = testInfo.outputPath("resume.pdf")
  await download.saveAs(pdf)
  expect(readFileSync(pdf).subarray(0, 5).toString()).toBe("%PDF-")

  // It's saved in the browser.
  await page.reload()
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")

  // The PDF opens again in another browser, with the resume as it was.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other.locator('input[type="file"]').setInputFiles(pdf)
  await expect(other).toHaveURL(/\/create\/new\//)
  await expect(other.getByLabel("Full name")).toHaveValue("Ada Lovelace")
  await expect(other.getByLabel("Email")).toHaveValue("ada@example.com")
  await elsewhere.close()

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("a long resume's PDF opens again with nothing cut off", async ({ page, browser }, testInfo) => {
  const errors = pageErrors(page)
  // Longer than earlier versions kept in a PDF: over 100 publications, and a
  // description of over 10,000 characters.
  const titles = Array.from({ length: 101 }, (_, index) => `Paper ${index + 1}`)
  const description = Array.from(
    { length: 120 },
    (_, index) => `• Ran experiment ${index + 1} on sparse attention for long documents, and wrote up what it found`,
  ).join("\n")
  expect(description.length).toBeGreaterThan(10_000)
  const resume = {
    id: "long-cv",
    resumeTitle: "Long CV",
    resumeTag: "personal",
    updatedAt: "2026-10-06T12:00:00.000Z",
    selectedTemplate: "jake",
    sectionOrder: ["Education", "Work", "Skills", "Projects", "Publications", "Volunteership", "Leadership", "Awards"],
    headings: {},
    profileSection: { fullName: "Ada Lovelace" },
    educationSection: [],
    workExperienceSection: [{ id: 1, workRole: "Research Engineer", companyName: "Google", workDescription: description }],
    projectsSection: [],
    publicationsSection: titles.map((title, index) => ({
      id: index + 1,
      publicationTitle: title,
      publicationAuthors: "A. Lovelace",
      publicationVenue: "Proc. NeurIPS",
      publicationDate: "2025",
    })),
    skillsSection: [],
    volunteerExperienceSection: [],
    leadershipExperienceSection: [],
    awardsSection: [],
  }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: "resume:long-cv", value: JSON.stringify(resume) },
  )
  await page.goto("/create/new/long-cv")
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download PDF" }).click()
  const pdf = testInfo.outputPath("long-cv.pdf")
  await (await downloading).saveAs(pdf)

  // Opened in another browser, it has every publication and the whole description.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other.locator('input[type="file"]').setInputFiles(pdf)
  await expect(other).toHaveURL(/\/create\/new\/long-cv$/)
  await expect(
    other
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()
  const restored = await other.evaluate(() => JSON.parse(localStorage.getItem("resume:long-cv") ?? "{}"))
  expect(restored.publicationsSection.map((entry: { publicationTitle: string }) => entry.publicationTitle)).toEqual(titles)
  expect(restored.workExperienceSection[0].workDescription).toBe(description)
  await elsewhere.close()

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("an older PDF of a resume in this browser says it's older, and replacing the resume with it can be undone", async ({
  page,
}, testInfo) => {
  const errors = pageErrors(page)
  const resume = {
    id: "ada",
    resumeTitle: "Ada",
    resumeTag: "personal",
    updatedAt: "2026-10-05T09:00:00.000Z",
    selectedTemplate: "jake",
    sectionOrder: ["Work", "Education", "Skills", "Projects", "Publications", "Volunteership", "Leadership", "Awards"],
    headings: {},
    profileSection: { fullName: "Ada Lovelace" },
    educationSection: [],
    workExperienceSection: [{ id: 1, workRole: "Engineer", companyName: "Google", workDescription: "• Built the search index" }],
    projectsSection: [],
    publicationsSection: [],
    skillsSection: [],
    volunteerExperienceSection: [],
    leadershipExperienceSection: [],
    awardsSection: [],
  }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: "resume:ada", value: JSON.stringify(resume) },
  )
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("resume:ada") ?? "{}"))
  const preview = page.getByRole("region", { name: "Live preview" })
  const openExperience = () =>
    page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("button", { name: /^Experience$/ })
      .click()
  const role = page.getByLabel("Role", { exact: true })
  const bullets = page.getByLabel("What you did")

  // The PDF is downloaded, then the resume changes: a new role, and a new bullet.
  await page.goto("/create/new/ada")
  await expect(preview.getByText(/Ada Lovelace/i).first()).toBeVisible()
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download PDF" }).click()
  const pdf = testInfo.outputPath("ada.pdf")
  await (await downloading).saveAs(pdf)
  await openExperience()
  await role.fill("Senior Engineer")
  await bullets.fill("• Built the search index\n• Shipped the new ranking")
  await expect.poll(async () => (await saved()).workExperienceSection[0]).toMatchObject({ workRole: "Senior Engineer" })
  await expect.poll(async () => (await saved()).workExperienceSection[0].workDescription).toContain("Shipped the new ranking")

  // Opening the PDF says it's older, and the main choice is to keep both.
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(pdf)
  const conflict = page.getByRole("dialog", { name: "You already have this resume" })
  await expect(conflict).toContainText("The PDF is older")
  await expect(conflict).toContainText("Replacing loses your changes since then.")
  // The main choice is the blue one, with white words.
  await expect(conflict.getByRole("button", { name: "Keep both" })).toHaveCSS("color", "rgb(255, 255, 255)")
  await expect(conflict.getByRole("button", { name: "Replace with the PDF" })).not.toHaveCSS("color", "rgb(255, 255, 255)")

  // Replacing anyway brings back the PDF's version, as last edited when the PDF says.
  await conflict.getByRole("button", { name: "Replace with the PDF" }).click()
  await expect(page).toHaveURL(/\/create\/new\/ada$/)
  await expect(page.getByText("This resume now has what's in the PDF.")).toBeVisible()
  await openExperience()
  await expect(role).toHaveValue("Engineer")
  await expect.poll(() => boxText(bullets)).toBe("• Built the search index")
  expect(await saved()).toMatchObject({ updatedAt: resume.updatedAt, workExperienceSection: [{ workRole: "Engineer" }] })
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // So the same PDF opened again is nothing new, and opens without asking. The undo is still there.
  await page.getByRole("link", { name: "Dashboard" }).click()
  await page.locator('input[type="file"]').setInputFiles(pdf)
  await expect(page).toHaveURL(/\/create\/new\/ada$/)
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // Undo puts back what changed since the PDF, and saves it.
  await page.getByRole("button", { name: "Undo" }).click()
  await expect(page.getByText("It's back as it was before you opened the PDF.")).toBeFocused()
  await openExperience()
  await expect(role).toHaveValue("Senior Engineer")
  await expect.poll(() => boxText(bullets)).toBe("• Built the search index\n• Shipped the new ranking")
  await expect.poll(async () => (await saved()).workExperienceSection[0]).toMatchObject({ workRole: "Senior Engineer" })

  // Kept after a reload, where there's nothing left to undo.
  await page.reload()
  await openExperience()
  await expect(role).toHaveValue("Senior Engineer")
  await expect(page.getByText("It's back as it was before you opened the PDF.")).toHaveCount(0)

  expect(errors).toEqual([])
})
