import { expect, test } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const PAGES = ["/", "/templates", "/about", "/terms", "/create/dashboard", "/does-not-exist"]

test("contact, on the about page, gives the support address to write to or copy", async ({ page, context, browserName }) => {
  // Contact is part of About now; its old address still leads to it.
  await page.goto("/contact")
  await expect(page).toHaveURL(/\/about#contact$/)
  const email = page.getByRole("link", { name: "hello@tryresumezip.com", exact: true })
  await expect(email).toHaveAttribute("href", "mailto:hello@tryresumezip.com")

  // Copied for those who write from a webmail, where the link opens nothing.
  test.skip(browserName !== "chromium", "Reading the clipboard back needs Chromium's permission")
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.getByRole("button", { name: "Copy email" }).click()
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("hello@tryresumezip.com")
})

// Google's sign-in, for Save to Google Drive, links to the privacy policy this way.
test("/terms#privacy opens the privacy policy, and a tab's address opens it from the page too", async ({ page }) => {
  await page.goto("/terms#privacy")
  await expect(page.getByRole("tab", { name: "Privacy policy" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("tabpanel", { name: "Privacy policy" })).toContainText(
    "If you press Save to Google Drive, Google asks you first",
  )

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
