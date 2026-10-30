import { expect, test, type Page } from "./test"
import { newResume, pageErrors } from "./helpers"

// A date field's calendar (components/editor/DatePicker.tsx): opened from the
// icon at the field's end, a year first, then a month, or the year alone, no
// date at all, or Present for an end date. The field can still be typed in.

async function addJob(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await newResume(page, { name: "Ada Lovelace" })
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  // A new entry puts the cursor in its first field once it has slid open, and the form has stopped scrolling to it.
  await expect(page.getByLabel("Company", { exact: true })).toBeFocused()
}

test("the calendar picks a year, then a month or the year alone, or no date, and an end date can be Present", async ({ page }) => {
  const errors = pageErrors(page)
  await addJob(page)
  const start = page.getByRole("textbox", { name: "Start date" })
  const end = page.getByRole("textbox", { name: "End date" })
  const [startIcon, endIcon] = await page.getByRole("button", { name: "Pick a date" }).all()
  const calendar = page.getByRole("dialog", { name: "Start date" })

  // Clicking into the field is for typing: only the icon opens the calendar.
  await start.click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await startIcon.click()
  await expect(startIcon).toHaveAttribute("aria-expanded", "true")
  await calendar.getByRole("button", { name: "2025", exact: true }).click()
  await calendar.getByRole("button", { name: "Jun", exact: true }).click()
  await expect(start).toHaveValue("Jun 2025")
  await expect(calendar).toBeHidden()

  // It opens on what's there, and Skip month keeps the year alone.
  await startIcon.click()
  await expect(calendar.getByRole("button", { name: "2025", exact: true })).toHaveAttribute("aria-pressed", "true")
  await calendar.getByRole("button", { name: "2024", exact: true }).click()
  await calendar.getByRole("button", { name: "Skip month" }).click()
  await expect(start).toHaveValue("2024")

  // What's typed is read too: a typed date opens the calendar on its year.
  await start.fill("March 2019")
  await startIcon.click()
  await expect(calendar.getByRole("button", { name: "2019", exact: true })).toHaveAttribute("aria-pressed", "true")
  // Escape closes it, back on the icon.
  await page.keyboard.press("Escape")
  await expect(calendar).toBeHidden()
  await expect(startIcon).toBeFocused()

  // An end date can be Present; Skip date leaves a field empty.
  const endCalendar = page.getByRole("dialog", { name: "End date" })
  await endIcon.click()
  await endCalendar.getByRole("button", { name: "Present" }).click()
  await expect(end).toHaveValue("Present")
  await startIcon.click()
  await expect(calendar.getByRole("button", { name: "Present" })).toHaveCount(0)
  await calendar.getByRole("button", { name: "Skip date" }).click()
  await expect(start).toHaveValue("")

  // A press anywhere else closes it.
  await endIcon.click()
  await page.getByRole("heading", { name: "Experience" }).click()
  await expect(endCalendar).toBeHidden()
  expect(errors).toEqual([])
})
