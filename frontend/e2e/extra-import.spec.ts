import { expect, test } from "@playwright/test"
import { wordFile, textPdf } from "../src/lib/import/testFiles"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const WORDS = [
  "Mara Lin",
  "SUMMARY",
  "First paragraph.",
  "PROFESSIONAL SUMMARY",
  "Second paragraph.",
  "PRESENTATIONS",
  "First talk",
  "PRESENTATIONS",
  "Second talk",
]

test("review consolidates selected singletons and keeps repeated unknown groups independently", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles({
    name: "Flexible.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: wordFile(WORDS),
  })
  const review = page.getByRole("dialog", { name: "Here's what we found" })
  await expect(review).toContainText("These 2 go together in your profile's summary")
  const choices = review.getByRole("combobox")
  await expect(choices).toHaveCount(2)
  await expect(choices.nth(0)).toHaveValue("")
  await expect(choices.nth(1)).toHaveValue("")
  await choices.nth(0).selectOption("text")
  await choices.nth(1).selectOption("list")
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  await review.getByRole("button", { name: "Create resume", exact: true }).click()
  await expect(review).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith("resume:"))
          .map(([, value]) => JSON.parse(value)),
      ),
    )
    .toHaveLength(1)
  const saved = await page.evaluate(
    () =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith("resume:"))
        .map(([, value]) => JSON.parse(value))[0],
  )
  expect(saved.profileSection.summary).toBe("First paragraph.\n\nSecond paragraph.")
  const custom = Object.entries(saved.extraSections)
  expect(custom.map(([, value]) => value)).toEqual([
    { kind: "text", heading: "Presentations", text: "First talk" },
    { kind: "list", heading: "Presentations", bullets: "• Second talk" },
  ])
  expect(new Set(custom.map(([key]) => key)).size).toBe(2)
  expect(errors).toEqual([])
})

test("narrow PDF review retains uncertain and excluded text in its download", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/create/dashboard")
  await page.locator('input[type="file"]').setInputFiles({
    name: "Flexible.pdf",
    mimeType: "application/pdf",
    buffer: textPdf([["Mara Lin", "SUMMARY", "Private draft paragraph.", "PRESENTATIONS", "Talk on accessible software"]]),
  })
  const review = page.getByRole("dialog", { name: "Here's what we found" })
  await expect(review.getByRole("combobox")).toHaveValue("")
  await review.getByRole("checkbox", { name: "Include SUMMARY, group 1" }).uncheck()
  const downloading = page.waitForEvent("download")
  await review.getByRole("button", { name: "Download", exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe("Flexible-review-text.txt")
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString("utf8")
  expect(text).toContain("Private draft paragraph.")
  expect(text).toContain("Talk on accessible software")
  await review.getByRole("button", { name: "Create resume", exact: true }).click()
  await expect(review).toBeHidden()
  const saved = await page.evaluate(
    () =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith("resume:"))
        .map(([, value]) => JSON.parse(value))[0],
  )
  expect(saved.extraSections ?? {}).toEqual({})
  expect(saved.profileSection.summary).toBe("")
})
