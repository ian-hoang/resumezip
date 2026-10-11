import { readFile } from "node:fs/promises"
import { expect, test, type Download, type Page } from "@playwright/test"
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
      workDescription: "• Built **payments** search for R&D\n○ Fed the cat",
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

/** Opens `resume` in the editor, saved before the page opens, as an earlier visit would have. */
async function open(page: Page, resume: typeof MARA) {
  await page.addInitScript((resume) => {
    if (localStorage.getItem(`resume:${resume.id}`) === null) localStorage.setItem(`resume:${resume.id}`, JSON.stringify(resume))
  }, resume)
  await page.goto(`/create/new/${resume.id}`)
  await expect(page.getByRole("region", { name: "Live preview" }).getByText("Stripe").first()).toBeVisible()
}

/** Chooses LaTeX from the ▾ beside Download PDF, and waits for its file. */
async function downloadLatex(page: Page): Promise<Download> {
  await page.getByRole("button", { name: "More formats" }).click()
  const downloading = page.waitForEvent("download")
  await page.getByRole("menuitem", { name: /^LaTeX/ }).click()
  return downloading
}

const textOf = async (download: Download) => readFile((await download.path())!, "utf8")

test("a resume downloaded as LaTeX from the ▾ menu is Jake's Resume, with what its PDF prints", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page, MARA)

  // Choosing LaTeX saves "<name>.tex", and the keyboard goes back to the ▾.
  const download = await downloadLatex(page)
  expect(download.suggestedFilename()).toBe("Mara at Stripe.tex")
  await expect(page.getByRole("button", { name: "More formats" })).toBeFocused()
  await expect(page.getByRole("status").filter({ hasText: "LaTeX file downloaded" })).toBeAttached()

  // Jake's commands, whatever the template, and only what the PDF prints.
  const text = await textOf(download)
  expect(text).toContain("\\resumeSubheading\n      {Engineer}{Jun 2024 - Present}\n      {Stripe}{}")
  expect(text).toContain("\\resumeItem{Built \\textbf{payments} search for R\\&D}")
  expect(text).toContain("\\href{https://linkedin.com/in/maralin}{\\underline{linkedin.com/in/maralin}}")
  expect(text).not.toContain("MI6")
  expect(text).not.toContain("Fed the cat")
  // pdfLaTeX, Overleaf's default, prints it all, so there's nothing more to say.
  expect(text).not.toContain("xelatex")
  await expect(page.getByRole("group", { name: "LaTeX file downloaded" })).toHaveCount(0)

  expect(errors).toEqual([])
})

test("a LaTeX file with letters pdfLaTeX can't print says to compile it with XeLaTeX", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page, {
    ...MARA,
    id: "ivan",
    resumeTitle: "Ivan at Stripe",
    profileSection: { ...MARA.profileSection, fullName: "Иван Петров" },
  })

  const download = await downloadLatex(page)
  expect(download.suggestedFilename()).toBe("Ivan at Stripe.tex")
  expect((await textOf(download)).split("\n")[0]).toBe("% !TeX program = xelatex")

  // Said under the ▾, and aloud, until it's closed.
  const notice = page.getByRole("group", { name: "LaTeX file downloaded" })
  await expect(notice).toContainText("On Overleaf, set Compiler to XeLaTeX in the project's settings.")
  await expect(notice).toContainText("Ivan at Stripe.tex")
  await expect(page.getByRole("status").filter({ hasText: "set Compiler to XeLaTeX" })).toBeAttached()
  await notice.getByRole("button", { name: "Close" }).click()
  await expect(notice).toHaveCount(0)
  await expect(page.getByRole("button", { name: "More formats" })).toBeFocused()

  expect(errors).toEqual([])
})

test("a LaTeX file that can't be made says so, and trying again downloads it", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page, MARA)

  // LaTeX's code downloads when it's first chosen; here, the download fails.
  const failed = page.getByRole("alert").filter({ hasText: "Download failed" })
  await page.route("**/_next/static/chunks/**", (route) => route.abort())
  await page.getByRole("button", { name: "More formats" }).click()
  await page.getByRole("menuitem", { name: /^LaTeX/ }).click()
  await expect(failed).toContainText("Couldn't make your LaTeX file.")
  await page.unroute("**/_next/static/chunks/**")

  // A Word file downloading meanwhile doesn't make the LaTeX file, so its failure stays.
  await page.getByRole("button", { name: "More formats" }).click()
  const word = page.waitForEvent("download")
  await page.getByRole("menuitem", { name: /^Word/ }).click()
  expect((await word).suggestedFilename()).toBe("Mara at Stripe.docx")
  await expect(page.getByRole("status").filter({ hasText: "Word file downloaded" })).toBeAttached()
  await expect(failed).toContainText("Couldn't make your LaTeX file.")

  const downloading = page.waitForEvent("download")
  await failed.getByRole("button", { name: "Try again" }).click()
  expect((await downloading).suggestedFilename()).toBe("Mara at Stripe.tex")
  await expect(failed).toHaveCount(0)

  // Only the failure, as the editor logs it, and the download it stopped.
  expect(errors.filter((error) => !/^Error downloading the LaTeX file:|^Failed to load resource/.test(error))).toEqual([])
})
