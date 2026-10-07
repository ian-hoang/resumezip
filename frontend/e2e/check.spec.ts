import { expect, test, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// The editor's left bar switches between the sections (Write) and what the
// checker found (Check), and remembers which in this browser.

async function newResume(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
}

test("the left bar switches between writing and checking, and remembers which", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const modes = page.getByRole("tablist", { name: "Write or check" })
  const write = modes.getByRole("tab", { name: "Write" })
  const check = modes.getByRole("tab", { name: /^Check/ })
  const sections = page.getByRole("navigation", { name: "Sections" })

  // It opens on Write, with the section list as it's always been.
  await expect(write).toHaveAttribute("aria-selected", "true")
  await sections.getByRole("button", { name: /^\d+ Experience$/ }).click()
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible()

  // Check puts the checker where the section list was, and leaves the form as it was.
  await check.click()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await expect(sections).toBeHidden()
  await expect(page.getByRole("tabpanel", { name: /^Check/ })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // Arrow keys, Home and End move between the two, as in any set of tabs.
  await check.focus()
  for (const [key, tab] of [
    ["ArrowLeft", write],
    ["End", check],
    ["Home", write],
    ["ArrowRight", check],
  ] as const) {
    await page.keyboard.press(key)
    await expect(tab).toBeFocused()
    await expect(tab).toHaveAttribute("aria-selected", "true")
  }

  // The mode stays after a reload, until it's switched back.
  await page.reload()
  await expect(check).toHaveAttribute("aria-selected", "true")
  await write.click()
  await page.reload()
  await expect(write).toHaveAttribute("aria-selected", "true")
  await expect(sections).toBeVisible()

  expect(errors).toEqual([])
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the switch sits above the section tabs, and works with the Edit and Preview switch", async ({ page }) => {
    const errors = pageErrors(page)
    await newResume(page)
    const modes = page.getByRole("tablist", { name: "Write or check" })
    const check = modes.getByRole("tab", { name: /^Check/ })
    const sections = page.getByRole("navigation", { name: "Sections" })

    const switchBox = await modes.boundingBox()
    const tabsBox = await sections.boundingBox()
    expect(switchBox!.y + switchBox!.height).toBeLessThanOrEqual(tabsBox!.y + 1)

    await check.tap()
    await expect(check).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("tabpanel", { name: /^Check/ })).toBeVisible()
    await expect(sections).toBeHidden()

    // Preview hides the left bar, and Edit brings it back as it was.
    await page.getByRole("button", { name: "Preview", exact: true }).tap()
    await expect(page.getByRole("region", { name: "Live preview" })).toBeVisible()
    await expect(modes).toBeHidden()
    await page.getByRole("button", { name: "Edit", exact: true }).tap()
    await expect(check).toHaveAttribute("aria-selected", "true")

    expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
    expect(errors).toEqual([])
  })
})
