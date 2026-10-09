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

for (const path of PAGES) {
  test(`${path} loads without errors and passes accessibility checks`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.goto(path)
    await page.waitForLoadState("networkidle")

    expect(await seriousAccessibilityProblems(page)).toEqual([])
    // The 404 page's own "not found" response is expected, and browsers log it.
    // Only that exact message for this page is let through.
    const ownNotFound = (error: string) =>
      path === "/does-not-exist" &&
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\) \(at http:\/\/[^/]+\/does-not-exist\)$/.test(error)
    expect(errors.filter((error) => !ownNotFound(error))).toEqual([])
  })
}
