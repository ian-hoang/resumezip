import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test, type Page, type Route } from "./variant"
import { editorHeading, pageErrors, seriousAccessibilityProblems } from "./helpers"

// Adding publications from their DOIs or links. Crossref and doi.org are
// stood in for by records saved from real lookups (src/lib/papers/fixtures),
// so these tests never call them.

const fixture = (name: string) => readFileSync(path.join(__dirname, "../src/lib/papers/fixtures", `${name}.json`), "utf8")

const CROSSREF = "https://api.crossref.org/works/"
const DOI_ORG = "https://doi.org/"
const RECORDS: Record<string, string> = {
  [`${CROSSREF}10.1038/s41586-020-2649-2`]: "crossref-numpy",
  [`${DOI_ORG}10.48550/arXiv.2202.01037`]: "doi-org-arxiv",
}

const EXISTING = {
  id: 1,
  publicationTitle: "Fast Joins on Small Machines",
  publicationAuthors: "R. Gommers",
  publicationDate: "2025",
  publicationVenue: "Proc. VLDB",
  publicationDetails: "",
  publicationLink: "https://dl.acm.org/doi/10.1145/3580305.3599572",
}

/**
 * Answers lookups with the saved records, and 404 for anything else. Returns
 * what was asked, and lets a test hold the answers back until it's ready.
 */
async function standIn(page: Page) {
  const asked: { url: string; headers: Record<string, string> }[] = []
  let release = () => {}
  let held: Promise<void> = Promise.resolve()
  const answer = async (route: Route) => {
    const request = route.request()
    asked.push({ url: request.url(), headers: await request.allHeaders() })
    await held
    const name = RECORDS[decodeURI(request.url())]
    // A lookup that was stopped can't be answered.
    await route
      .fulfill({
        status: name ? 200 : 404,
        headers: { "access-control-allow-origin": "*" },
        contentType: "application/json",
        body: name ? fixture(name) : "",
      })
      .catch(() => {})
  }
  await page.route(`${CROSSREF}**`, answer)
  await page.route(`${DOI_ORG}**`, answer)
  return {
    asked,
    hold: () => {
      held = new Promise((resolve) => (release = resolve))
    },
    release: () => release(),
  }
}

/** Opens the editor's Publications section on a resume with one publication. */
async function openPublications(page: Page) {
  const resume = {
    id: "papers",
    resumeTitle: "Papers",
    resumeTag: "personal",
    updatedAt: "2026-10-07T12:00:00.000Z",
    selectedTemplate: "jake",
    profileSection: { fullName: "Ralf Gommers" },
    publicationsSection: [EXISTING],
  }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: "resume:papers", value: JSON.stringify(resume) },
  )
  await page.goto("/create/new/papers")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Publications$/ })
    .click()
  await expect(editorHeading(page, "Publications")).toBeVisible()
}

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("resume:papers") ?? "{}").publicationsSection as Record<string, string>[])

test("papers pasted as links are added as new entries, sending only their DOIs", async ({ page }) => {
  const errors = pageErrors(page)
  const lookups = await standIn(page)
  await openPublications(page)

  await page.getByRole("button", { name: "Add from DOI or link" }).click()
  const box = page.getByLabel("DOI or link · one per line")
  await expect(box).toBeFocused()
  await expect(page.getByText("Only each paper’s DOI is sent")).toBeVisible()
  await box.fill(
    [
      "https://www.nature.com/articles/s41586-020-2649-2",
      "arxiv.org/abs/2202.01037v2",
      "https://ieeexplore.ieee.org/document/9157091",
      "10.1145/3580305.3599572",
      "10.1145/9999999.0000001",
    ].join("\n"),
  )
  await page.getByRole("button", { name: "Add papers" }).click()

  await expect(page.getByRole("status").filter({ hasText: "Added" })).toHaveText("Added 2 papers. 1 paper was already in your list.")
  // What couldn't be added stays, with what went wrong.
  await expect(box).toHaveValue("https://ieeexplore.ieee.org/document/9157091\n10.1145/9999999.0000001")
  await expect(page.getByText("No DOI or arXiv ID in this.", { exact: false })).toBeVisible()
  await expect(page.getByText("No paper found with this DOI.")).toBeVisible()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // The existing entry is as it was, and the papers follow it.
  await expect.poll(() => saved(page).then((entries) => entries.length)).toBe(3)
  const [existing, numpy, arxiv] = await saved(page)
  expect(existing).toEqual(EXISTING)
  expect(numpy).toMatchObject({
    publicationTitle: "Array programming with NumPy",
    // Past six authors, the list runs to the resume owner's name.
    publicationAuthors: "C. R. Harris, K. J. Millman, S. J. van der Walt, R. Gommers, et al.",
    publicationDate: "Sep 2020",
    publicationVenue: "Nature",
    publicationDetails: "vol. 585, no. 7825, pp. 357–362",
    publicationLink: "10.1038/s41586-020-2649-2",
  })
  expect(arxiv).toMatchObject({
    publicationVenue: "arXiv preprint",
    publicationDate: "Feb 2022",
    publicationLink: "10.48550/arXiv.2202.01037",
  })
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Array programming with NumPy/)
      .first(),
  ).toBeVisible()

  // Only the DOIs went out: the IEEE link has none, and the repeat wasn't looked up.
  expect(lookups.asked.map((lookup) => decodeURI(lookup.url))).toEqual([
    `${CROSSREF}10.1038/s41586-020-2649-2`,
    `${DOI_ORG}10.48550/arXiv.2202.01037`,
    `${CROSSREF}10.1145/9999999.0000001`,
    `${DOI_ORG}10.1145/9999999.0000001`,
  ])
  for (const { headers } of lookups.asked) {
    expect(headers.referer).toBeUndefined()
    expect(headers.cookie).toBeUndefined()
  }

  // The rest can be added by hand, keeping the link.
  await page.getByRole("button", { name: "Add by hand" }).first().click()
  await page.getByRole("button", { name: "Add by hand" }).click()
  await expect(box).toBeHidden()
  await expect(page.getByLabel("Title").last()).toBeFocused()
  await expect
    .poll(() => saved(page).then((entries) => entries.slice(3).map((entry) => entry.publicationLink)))
    .toEqual(["https://ieeexplore.ieee.org/document/9157091", "10.1145/9999999.0000001"])

  // The browser logs the lookups that found nothing.
  expect(errors.filter((error) => !error.includes("404"))).toEqual([])
})

test("what's typed while a paper is looked up is kept", async ({ page }) => {
  const errors = pageErrors(page)
  const lookups = await standIn(page)
  await openPublications(page)

  lookups.hold()
  await page.getByRole("button", { name: "Add from DOI or link" }).click()
  await page.getByLabel("DOI or link · one per line").fill("10.1038/s41586-020-2649-2")
  await page.getByRole("button", { name: "Add papers" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Looking up" })).toHaveText("Looking up 1 of 1…")

  // The first entry is open, and gets a new title while the lookup waits.
  await page.getByLabel("Title").first().fill("Faster Joins on Small Machines")
  lookups.release()

  await expect(page.getByRole("status").filter({ hasText: "Added" })).toHaveText("Added 1 paper.")
  await expect
    .poll(() => saved(page).then((entries) => entries.map((entry) => entry.publicationTitle)))
    .toEqual(["Faster Joins on Small Machines", "Array programming with NumPy"])
  expect(errors).toEqual([])
})

test("stopping keeps what wasn't looked up, and closing the box adds nothing", async ({ page }) => {
  const errors = pageErrors(page)
  const lookups = await standIn(page)
  await openPublications(page)
  const box = page.getByLabel("DOI or link · one per line")
  const lines = "10.1038/s41586-020-2649-2\narxiv.org/abs/2202.01037"

  lookups.hold()
  await page.getByRole("button", { name: "Add from DOI or link" }).click()
  await box.fill(lines)
  await page.getByRole("button", { name: "Add papers" }).click()
  await expect(page.getByRole("button", { name: "Stop" })).toBeFocused()
  await page.getByRole("button", { name: "Stop" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Stopped" })).toHaveText("Stopped.")
  await expect(box).toHaveValue(lines)
  await expect(page.getByRole("button", { name: "Add papers" })).toBeFocused()

  // Escape while looking up stops too; Escape again closes the box.
  await page.getByRole("button", { name: "Add papers" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Looking up" })).toHaveText("Looking up 1 of 2…")
  await box.press("Escape")
  await expect(page.getByRole("status").filter({ hasText: "Stopped" })).toBeVisible()
  await box.press("Escape")
  await expect(box).toBeHidden()
  await expect(page.getByRole("button", { name: "Add from DOI or link" })).toBeFocused()

  // Closing the box while looking up cancels it.
  await page.getByRole("button", { name: "Add from DOI or link" }).click()
  await box.fill(lines)
  await page.getByRole("button", { name: "Add papers" }).click()
  await page.getByRole("button", { name: "Add from DOI or link" }).click()
  await expect(box).toBeHidden()
  lookups.release()

  await page.waitForTimeout(500)
  expect(await saved(page)).toEqual([EXISTING])
  expect(errors).toEqual([])
})
