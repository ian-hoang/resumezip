import { expect, test, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// After a PDF downloads, a card says what the file is for: it carries the
// resume, to open here again (components/editor/DownloadedCard.tsx).

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

test("a card after a download says the PDF opens here again, without taking the keyboard", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  const button = download(page)

  // The card comes without taking the keyboard, and says why the file matters.
  await button.focus()
  await page.keyboard.press("Enter")
  const card = page.getByRole("region", { name: "PDF downloaded" })
  await expect(card).toBeVisible()
  await expect(card).toContainText(/\.pdf/)
  await expect(card).toContainText("This PDF carries your resume. Open it here on any computer to keep editing.")
  for (const name of ["Got it", "Check it first"]) await expect(card.getByRole("button", { name })).not.toBeFocused()
  await expect(page.getByRole("status").filter({ hasText: "PDF downloaded" })).toContainText("carries your resume")
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // Check it first opens Check, with the keyboard on it.
  await card.getByRole("button", { name: "Check it first" }).click()
  await expect(card).toBeHidden()
  const check = page.getByRole("tab", { name: /^Check/ })
  await expect(check).toHaveAttribute("aria-selected", "true")
  await expect(check).toBeFocused()

  // Got it, from the keyboard, puts it back on Download PDF.
  await download(page).click()
  await card.getByRole("button", { name: "Got it" }).focus()
  await page.keyboard.press("Enter")
  await expect(card).toBeHidden()
  await expect(download(page)).toBeFocused()

  expect(errors).toEqual([])
})

test("the download card goes by itself, but not while it's pointed at", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await startWriting(page, 1440, 900)
  await download(page).click()
  const card = page.getByRole("region", { name: "PDF downloaded" })
  await expect(card).toBeVisible()

  await card.hover()
  await page.clock.runFor(15_000)
  await expect(card).toBeVisible()
  await page.mouse.move(5, 5)
  await page.clock.runFor(15_000)
  await expect(card).toBeHidden()

  expect(errors).toEqual([])
})

test("on a phone the card sits above the Edit / Preview switch, and Check it first goes back to the form's Check", async ({ page }) => {
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
  const card = page.getByRole("region", { name: "PDF downloaded" })
  await expect(card).toBeVisible()
  const [shown, switcher] = [(await card.boundingBox())!, (await views.boundingBox())!]
  expect(shown.x).toBeGreaterThanOrEqual(0)
  expect(shown.x + shown.width).toBeLessThanOrEqual(390)
  expect(shown.y + shown.height).toBeLessThanOrEqual(switcher.y)

  await card.getByRole("button", { name: "Check it first" }).click()
  await expect(views.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("tab", { name: /^Check/ })).toBeFocused()
  await expect(page.getByRole("heading", { name: "Resume score" })).toBeVisible()
  expect(errors).toEqual([])
})
