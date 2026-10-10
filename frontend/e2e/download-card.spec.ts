import { expect, test, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// After a PDF downloads, a note says what the file is for: it carries the
// resume, to open here again (components/editor/DownloadedCard.tsx). It's only
// a note: there's nothing to press, and it goes by itself in a moment.

/** Starts a resume with a name, in a `width` × `height` window, and waits for its preview. */
async function startWriting(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()
}

const download = (page: Page) => page.getByRole("button", { name: "Download PDF" })

/** The note, found by its words: the editor's status says the download aloud, so the note itself isn't read out. */
const note = (page: Page) => page.getByText("Open it here on any computer to keep editing.", { exact: true })

test("a note after a download says the PDF opens here again, with nothing to press, and goes by itself in a moment", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await startWriting(page, 1440, 900)

  // It says only what it does: no paper or page count to make it longer.
  await expect(download(page)).toHaveText("Download PDF")
  await download(page).focus()
  await page.keyboard.press("Enter")
  await expect(note(page)).toBeVisible()
  // The time it shows is checked first, as the checks after it take a while.
  // It's under Download PDF, at the top right, in the window, and has nothing to press.
  const pressed = page.getByRole("button", { name: /^Download(ed| PDF)$/ })
  const [shown, button] = [(await note(page).boundingBox())!, (await pressed.boundingBox())!]
  expect(shown.y).toBeGreaterThan(button.y + button.height)
  expect(shown.y).toBeLessThan(button.y + button.height + 140)
  expect(shown.x + shown.width).toBeLessThanOrEqual(1440)
  for (const name of ["Got it", "Check it first"]) await expect(page.getByRole("button", { name })).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "PDF downloaded" })).toContainText("carries your resume")

  // It goes by itself after about three seconds, whether or not it's pointed at.
  await page.mouse.move(shown.x + shown.width / 2, shown.y + shown.height / 2)
  await page.clock.runFor(2_000)
  await expect(note(page)).toBeVisible()
  await page.clock.runFor(1_500)
  await expect(note(page)).toBeHidden()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  expect(errors).toEqual([])
})

test("on a phone the note sits above the Edit / Preview switch", async ({ page }) => {
  const errors = pageErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await page.getByLabel("Full name").fill("Ada Lovelace")
  const views = page.getByRole("group", { name: "View" })
  await views.getByRole("button", { name: "Preview" }).click()
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()

  await page.getByRole("button", { name: "Download PDF" }).click()
  await expect(note(page)).toBeVisible()
  const [shown, switcher] = [(await note(page).boundingBox())!, (await views.boundingBox())!]
  expect(shown.x).toBeGreaterThanOrEqual(0)
  expect(shown.x + shown.width).toBeLessThanOrEqual(390)
  expect(shown.y + shown.height).toBeLessThanOrEqual(switcher.y)
  await expect(note(page)).toBeHidden()
  expect(errors).toEqual([])
})
