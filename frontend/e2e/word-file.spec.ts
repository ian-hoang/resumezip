import { expect, test, type Page } from "@playwright/test"
import { pageErrors } from "./helpers"

/** A resume with a job, a bullet and an entry left out of the PDF. */
const MARA = {
  id: "mara",
  resumeTitle: "Mara at Stripe",
  updatedAt: "2026-10-08T12:00:00.000Z",
  selectedTemplate: "modernjack",
  sectionOrder: ["Work", "Education", "Skills"],
  sectionsChosen: true,
  headings: {},
  profileSection: { fullName: "Mara Lin", email: "mara@example.com", linkedin: "linkedin.com/in/maralin" },
  educationSection: [{ id: 1, schoolName: "State University", degree: "B.S. in Biology", schoolEndDate: "May 2024" }],
  workExperienceSection: [
    {
      id: 1,
      workRole: "Engineer",
      companyName: "Stripe",
      workStartDate: "Jun 2024",
      workEndDate: "Present",
      workDescription: "• Built **payments** search\n○ Fed the cat",
    },
    { id: 2, workRole: "Secret agent", companyName: "MI6", leftOut: true },
  ],
  skillsSection: [{ id: 1, skillName: "Languages", skillDetails: "Go, TypeScript" }],
  projectsSection: [],
  publicationsSection: [],
  volunteerExperienceSection: [],
  leadershipExperienceSection: [],
  awardsSection: [],
}

/** Opens Mara's resume in the editor, saved before the page opens, as an earlier visit would have. */
async function openMara(page: Page) {
  await page.addInitScript((resume) => {
    if (localStorage.getItem("resume:mara") === null) localStorage.setItem("resume:mara", JSON.stringify(resume))
  }, MARA)
  await page.goto("/create/new/mara")
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Mara Lin/i)
      .first(),
  ).toBeVisible()
}

test("a resume downloaded as Word from the ▾ menu opens in another browser as its PDF does", async ({ page, browser }, testInfo) => {
  const errors = pageErrors(page)
  await openMara(page)

  // Choosing Word saves "<name>.docx", and the keyboard goes back to the ▾.
  const more = page.getByRole("button", { name: "More formats" })
  await more.click()
  const downloading = page.waitForEvent("download")
  await page.getByRole("menuitem", { name: /^Word/ }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe("Mara at Stripe.docx")
  await expect(more).toBeFocused()
  await expect(page.getByRole("status").filter({ hasText: "Word file downloaded" })).toBeAttached()
  // Saved under its own name, which a resume opened from it is named after.
  const file = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(file)

  // Opened in another browser, it's the resume as printed, as from its PDF: what's left out isn't in it.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other.locator('input[type="file"]').setInputFiles(file)
  await expect(other).toHaveURL(/\/create\/new\/mara$/)
  await expect(other.getByLabel("Resume name")).toHaveValue("Mara at Stripe")
  const opened = await other.evaluate(() => JSON.parse(localStorage.getItem("resume:mara") ?? "{}"))
  expect(opened).toMatchObject({
    selectedTemplate: "modernjack",
    sectionOrder: ["Work", "Education", "Skills"],
    profileSection: MARA.profileSection,
    educationSection: [MARA.educationSection[0]],
    workExperienceSection: [{ ...MARA.workExperienceSection[0], workDescription: "• Built **payments** search" }],
    skillsSection: MARA.skillsSection,
  })
  expect(opened.workExperienceSection).toHaveLength(1)
  await elsewhere.close()

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("a Word file that can't be made says so, and trying again downloads it", async ({ page }) => {
  const errors = pageErrors(page)
  await openMara(page)

  // Word's code downloads when it's first chosen; here, the download fails.
  const failed = page.getByRole("alert").filter({ hasText: "Download failed" })
  await page.route("**/_next/static/chunks/**", (route) => route.abort())
  await page.getByRole("button", { name: "More formats" }).click()
  await page.getByRole("menuitem", { name: /^Word/ }).click()
  await expect(failed).toContainText("Couldn't make your Word file.")

  await page.unroute("**/_next/static/chunks/**")
  const downloading = page.waitForEvent("download")
  await failed.getByRole("button", { name: "Try again" }).click()
  expect((await downloading).suggestedFilename()).toBe("Mara at Stripe.docx")
  await expect(failed).toHaveCount(0)

  // Only the failure, as the editor logs it, and the download it stopped.
  expect(errors.filter((error) => !/^Error downloading the Word file:|^Failed to load resource/.test(error))).toEqual([])
})
