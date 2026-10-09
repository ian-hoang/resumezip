import { expect, test, type Page } from "@playwright/test"
import { MAX_PAGES, MAX_WORD_XML_BYTES } from "../src/lib/import/limits"
import { textPdf, wordFile } from "../src/lib/import/testFiles"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const RESUME = ["Mara Lin", "mara@example.com", "EDUCATION", "State University"]
const pdf = (pages: string[][]) => ({ name: "Mara Lin.pdf", mimeType: "application/pdf", buffer: textPdf(pages) })
const docx = (buffer: Buffer) => ({
  name: "Mara Lin.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer,
})

/**
 * The workers that opening a file starts, like "pdf.js running" or "import
 * ended", in alphabetical order. pdf.js's is known by its file's name; the
 * import worker's file is only numbered, so it's known by what's in it. Any
 * other worker, like the PDF compiler's, is left out.
 */
function watchWorkers(page: Page): () => string[] {
  const seen: { kind: string; ended: boolean }[] = []
  page.on("worker", (worker) => {
    const entry = { kind: "", ended: false }
    seen.push(entry)
    worker.on("close", () => (entry.ended = true))
    if (/pdf\.worker/.test(worker.url())) entry.kind = "pdf.js"
    else {
      page.request
        .get(worker.url())
        .then(async (response) => {
          if ((await response.text()).includes("too much text")) entry.kind = "import"
        })
        .catch(() => {})
    }
  })
  return () =>
    seen
      .filter((entry) => entry.kind)
      .map((entry) => `${entry.kind} ${entry.ended ? "ended" : "running"}`)
      .sort()
}

/**
 * Holds back the download of pdf.js until `release` is called. Its chunk's
 * name changes with every build, so it's found by a message only pdf.js has.
 */
async function holdPdfjs(page: Page) {
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  const hold = { held: false, release }
  await page.route("**/_next/static/chunks/**", async (route) => {
    const response = await route.fetch()
    if (!hold.held && (await response.text()).includes("Setting up fake worker")) {
      hold.held = true
      await released
    }
    return route.fulfill({ response })
  })
  return hold
}

test("opening a PDF works after pdf.js failed to download once", async ({ page }) => {
  const errors = pageErrors(page)
  const file = pdf([["Mara Lin", "mara@example.com"]])

  // pdf.js downloads when the first PDF is opened. Its chunk's name changes
  // with every build, so it's found by a message only pdf.js has.
  let failed = false
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (failed) return route.continue()
    const response = await route.fetch()
    if ((await response.text()).includes("Setting up fake worker")) {
      failed = true
      return route.abort("internetdisconnected")
    }
    return route.fulfill({ response })
  })

  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(file)
  const error = page.getByRole("dialog", { name: "Couldn't open that file" })
  await expect(error).toContainText("Something went wrong reading this file.")
  expect(failed).toBe(true)

  // The connection is back. Trying again opens the PDF, without reloading the page.
  const choosing = page.waitForEvent("filechooser")
  await error.getByRole("button", { name: "Choose another file" }).click()
  await (await choosing).setFiles(file)
  await expect(page.getByRole("dialog", { name: "Here's what we found" })).toBeVisible()

  // Only the failed download, and the dashboard logging it.
  expect(errors.filter((error) => !/^(Failed to load resource|Couldn't open file:)/.test(error))).toEqual([])
})

test("when the code that reads files can't download, it says so, and works once it can", async ({ page }) => {
  const errors = pageErrors(page)
  // It downloads when the first file is opened. Its chunk's name changes
  // with every build, so it's found by a message only it has.
  let offline = true
  let failed = 0
  await page.route("**/_next/static/chunks/**", async (route) => {
    const response = await route.fetch()
    if (offline && (await response.text()).includes("This file took too long to read")) {
      failed++
      return route.abort("internetdisconnected")
    }
    return route.fulfill({ response })
  })

  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(pdf([RESUME]))
  const error = page.getByRole("dialog", { name: "Couldn't open that file" })
  await expect(error).toContainText("Something went wrong reading this file.")
  expect(failed).toBeGreaterThan(0)

  offline = false
  const choosing = page.waitForEvent("filechooser")
  await error.getByRole("button", { name: "Choose another file" }).click()
  await (await choosing).setFiles(pdf([RESUME]))
  await expect(page.getByRole("dialog", { name: "Here's what we found" })).toContainText("Mara Lin")

  // Only the failed downloads, and the dashboard logging one.
  expect(errors.filter((error) => !/^(Failed to load resource|Couldn't open file:)/.test(error))).toEqual([])
})

test("Cancel stops reading a file, and the next one opens as usual", async ({ page }) => {
  const errors = pageErrors(page)
  const workers = watchWorkers(page)
  const pdfjs = await holdPdfjs(page)

  // Cancelled while pdf.js downloads, so the file is still being read.
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(pdf([RESUME]))
  const reading = page.getByRole("dialog", { name: "Opening your file" })
  await expect(reading).toBeVisible()
  await expect.poll(() => pdfjs.held).toBe(true)
  await reading.getByRole("button", { name: "Cancel" }).click()
  await expect(reading).toBeHidden()

  // Once pdf.js arrives, the cancelled file isn't opened with it.
  pdfjs.release()
  await page.waitForTimeout(1000)
  expect(workers()).toEqual([])
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // The next file opens. The worker that sorted its text has ended; pdf.js's
  // stays while the review shows the PDF, and ends when it closes.
  await page.locator('input[type="file"]').setInputFiles(pdf([RESUME]))
  const review = page.getByRole("dialog", { name: "Here's what we found" })
  await expect(review).toContainText("Mara Lin")
  await expect.poll(workers).toEqual(["import ended", "pdf.js running"])
  await review.getByRole("button", { name: "Cancel" }).click()
  await expect.poll(workers).toEqual(["import ended", "pdf.js ended"])
  expect(errors).toEqual([])
})

test("a file read mostly wrong says so up front, and shows what couldn't be placed", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  const review = page.getByRole("dialog", { name: "Here's what we found" })

  // Read right: nothing to warn about.
  await page.locator('input[type="file"]').setInputFiles(pdf([RESUME]))
  await expect(review).toContainText("State University")
  await expect(review).not.toContainText("We couldn't place")
  // Unticked, the school is text to copy or download, but it was placed.
  await review.getByRole("checkbox", { name: "Include State University" }).uncheck()
  await expect(review.getByRole("region", { name: /^Unticked · 1 line$/ })).toBeVisible()
  await expect(review.getByRole("region", { name: /^Couldn't place/ })).toHaveCount(0)
  await review.getByRole("button", { name: "Cancel" }).click()
  // Something was unticked, so closing asks first.
  await page.getByRole("dialog", { name: "Discard your changes?" }).getByRole("button", { name: "Discard", exact: true }).click()
  await expect(review).toBeHidden()

  // No headings to sort it by, so almost all of it goes to "Couldn't place".
  const lost = [
    "Mara Lin",
    "mara@example.com",
    "Hospital Volunteer, Lakeview Medical Center, May 2025 to August 2025",
    "Escorted outpatients to imaging appointments and answered their questions",
    "Cleaned wheelchairs and kept the waiting areas tidy, following hospital rules",
  ]
  await page.locator('input[type="file"]').setInputFiles(pdf([lost]))
  await expect(review).toContainText("We couldn't place most of this file.")
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  // The dialog's buttons along its bottom aren't a second footer for the page.
  await expect(page.getByRole("contentinfo")).toHaveCount(1)
  await review.getByRole("button", { name: "Show what we couldn't place" }).click()
  await expect(review.getByRole("region", { name: /^Couldn't place/ })).toBeFocused()
  expect(errors).toEqual([])
})

test("leaving the page stops reading the file", async ({ page }) => {
  const errors = pageErrors(page)
  const workers = watchWorkers(page)
  const pdfjs = await holdPdfjs(page)

  await page.goto("/about")
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Your resumes" }).click()
  await page.locator('input[type="file"]').setInputFiles(pdf([RESUME]))
  await expect.poll(() => pdfjs.held).toBe(true)
  await page.goBack()
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Your resumes")

  pdfjs.release()
  await page.waitForTimeout(1000)
  expect(workers()).toEqual([])
  expect(errors).toEqual([])
})

test(`a PDF of ${MAX_PAGES} pages opens, and a longer one says why it can't`, async ({ page }) => {
  const errors = pageErrors(page)
  const pages = (count: number) => Array.from({ length: count }, () => RESUME)
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(pdf(pages(MAX_PAGES + 1)))
  const error = page.getByRole("dialog", { name: "Couldn't open that file" })
  await expect(error).toContainText(
    `This PDF has ${MAX_PAGES + 1} pages, too many for a resume. Open one with ${MAX_PAGES} pages or fewer.`,
  )

  const choosing = page.waitForEvent("filechooser")
  await error.getByRole("button", { name: "Choose another file" }).click()
  await (await choosing).setFiles(pdf(pages(MAX_PAGES)))
  await expect(page.getByRole("dialog", { name: "Here's what we found" })).toContainText("Mara Lin")
  expect(errors).toEqual([])
})

test("a Word file is read in a worker, which then ends", async ({ page }) => {
  const errors = pageErrors(page)
  const workers = watchWorkers(page)
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(docx(wordFile(RESUME)))
  const review = page.getByRole("dialog", { name: "Here's what we found" })
  await expect(review).toContainText("Mara Lin")
  await expect(review).toContainText("mara@example.com")
  await expect.poll(workers).toEqual(["import ended"])
  expect(errors).toEqual([])
})

test("a Word file that unzips to too much text says so", async ({ page }) => {
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(docx(wordFile(RESUME, { padding: MAX_WORD_XML_BYTES })))
  await expect(page.getByRole("dialog", { name: "Couldn't open that file" })).toContainText("This file has too much text to be a resume.")
})

test("closing the review after unticking or swapping asks first", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  const file = page.locator('input[type="file"]')
  const review = page.getByRole("dialog", { name: "Here's what we found" })
  const discard = page.getByRole("dialog", { name: "Discard your changes?" })
  const keepReviewing = discard.getByRole("button", { name: "Keep reviewing" })
  const entry = review.getByRole("checkbox", { name: "Include State University" })
  const swap = review.getByRole("button", { name: /^Swap school and degree/ })

  // Unchanged, Escape closes it at once.
  await file.setInputFiles(pdf([RESUME]))
  await expect(entry).toBeChecked()
  await page.keyboard.press("Escape")
  await expect(review).toBeHidden()

  // Unticked, Escape asks first. Escaping the question goes back to the
  // review, with the entry still unticked and focus where it was.
  await file.setInputFiles(pdf([RESUME]))
  await entry.press("Space")
  await expect(entry).not.toBeChecked()
  await page.keyboard.press("Escape")
  await expect(keepReviewing).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(discard).toBeHidden()
  await expect(entry).not.toBeChecked()
  await expect(entry).toBeFocused()

  // Swapped, a click outside asks too, with focus in the question.
  await entry.press("Space")
  await swap.press("Enter")
  await expect(swap).toHaveAttribute("aria-pressed", "true")
  await page.mouse.click(4, 4)
  await expect(keepReviewing).toBeFocused()
  await keepReviewing.click()
  await expect(discard).toBeHidden()
  await expect(swap).toHaveAttribute("aria-pressed", "true")

  // And so does Cancel. Discarding closes the review, with no resume made.
  await review.getByRole("button", { name: "Cancel" }).click()
  await discard.getByRole("button", { name: "Discard" }).click()
  await expect(review).toBeHidden()
  await expect(page.getByText("No resumes yet.")).toBeVisible()
  expect(errors).toEqual([])
})

test("Create resume needs something ticked", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles(pdf([RESUME]))
  const review = page.getByRole("dialog", { name: "Here's what we found" })
  const entry = review.getByRole("checkbox", { name: "Include State University" })
  const create = review.getByRole("button", { name: "Create resume" })

  // With every entry unticked, Create waits for one to be ticked.
  await entry.uncheck()
  await expect(create).toBeDisabled()
  await expect(review.getByRole("status")).toHaveText("Tick something to create a resume.")
  await entry.check()
  await expect(create).toBeEnabled()
  await expect(review.getByRole("status")).toHaveText("")
  expect(errors).toEqual([])
})
