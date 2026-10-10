import { expect, test } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const PAGES = ["/", "/templates", "/about", "/contact", "/terms", "/create/dashboard", "/does-not-exist"]

test("contact shows the support address before and after opening a message", async ({ page }) => {
  await page.goto("/contact")
  const emailLinks = page.getByRole("link", { name: "hello@tryresumezip.com", exact: true })
  await expect(emailLinks).toHaveCount(1)
  await expect(emailLinks).toHaveAttribute("href", "mailto:hello@tryresumezip.com")

  await page.getByLabel("Your name").fill("Ada Lovelace")
  await page.getByLabel("Email address").fill("ada@example.com")
  await page.getByLabel("Subject", { exact: true }).selectOption("support")
  await page.getByLabel("Your message").fill("I have a question about my resume.")
  await page.getByRole("button", { name: "Send with your email app" }).click()

  await expect(page.getByRole("heading", { name: "Check your email app" })).toBeVisible()
  await expect(emailLinks).toHaveCount(2)
  for (const link of await emailLinks.all()) {
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", "mailto:hello@tryresumezip.com")
  }
})

// Google's sign-in, for Save to Google Drive, links to the privacy policy this way.
test("/terms#privacy opens the privacy policy, and a tab's address opens it from the page too", async ({ page }) => {
  await page.goto("/terms#privacy")
  await expect(page.getByRole("tab", { name: "Privacy policy" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("tabpanel", { name: "Privacy policy" })).toContainText("We don’t collect or store your resume")

  await page.evaluate(() => (window.location.hash = "faq"))
  await expect(page.getByRole("tab", { name: "FAQ" })).toHaveAttribute("aria-selected", "true")
})

for (const path of PAGES) {
  test(`${path} loads without errors and passes accessibility checks`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.goto(path)
    // The home page's looping video can keep streaming in Safari. Readiness
    // for this layout/accessibility check is visible content with fonts loaded.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))

    expect(await seriousAccessibilityProblems(page)).toEqual([])
    // The 404 page's own "not found" response is expected, and browsers log it.
    // Only that exact message for this page is let through.
    const ownNotFound = (error: string) =>
      path === "/does-not-exist" &&
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\) \(at http:\/\/[^/]+\/does-not-exist\)$/.test(error)
    expect(errors.filter((error) => !ownNotFound(error))).toEqual([])
  })
}
