import { expect, test, type Page } from "@playwright/test"
import { pageErrors } from "./helpers"

// The templates page's search and style chips. Each card is a link that starts a resume with its template.

const cards = (page: Page) => page.getByRole("main").getByRole("link", { name: / template/ })

test("/ goes to the search, which finds templates by name, font or style", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/templates")
  const search = page.getByRole("searchbox", { name: "Search templates" })
  await expect(cards(page).first()).toBeVisible()
  const every = await cards(page).count()

  await page.keyboard.press("/")
  await expect(search).toBeFocused()
  await expect(search).toHaveValue("")

  await page.keyboard.type("garamond")
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page)).toHaveAccessibleName(/^Harvard template/)

  await search.fill("serif")
  await expect(cards(page)).toHaveCount(2)
  await expect(cards(page).first()).toHaveAccessibleName(/^Jake's template/)

  // Escape clears it.
  await search.press("Escape")
  await expect(search).toHaveValue("")
  await expect(cards(page)).toHaveCount(every)
  expect(errors).toEqual([])
})

test("a chip shows the templates with that style, and says it's picked", async ({ page }) => {
  await page.goto("/templates")
  const chips = page.getByRole("group", { name: "Filter by style" })
  const all = chips.getByRole("button", { name: "All" })
  await expect(all).toHaveAttribute("aria-pressed", "true")
  const every = await cards(page).count()

  await chips.getByRole("button", { name: "Color headings" }).click()
  await expect(chips.getByRole("button", { name: "Color headings" })).toHaveAttribute("aria-pressed", "true")
  await expect(all).toHaveAttribute("aria-pressed", "false")
  await expect(cards(page)).toHaveCount(2)
  await expect(page.getByRole("status")).toHaveText("Showing Blueprint and Ian's.")

  await all.click()
  await expect(cards(page)).toHaveCount(every)
})

test("when nothing matches, it says so, and one click shows every template again", async ({ page }) => {
  await page.goto("/templates")
  const every = await cards(page).count()
  await page.getByRole("searchbox", { name: "Search templates" }).fill("zebra")
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByText("No template matches that.")).toBeVisible()
  await expect(page.getByRole("status")).toHaveText("No template matches.")

  await page.getByRole("button", { name: "Show every template" }).click()
  await expect(cards(page)).toHaveCount(every)
  await expect(page.getByRole("searchbox", { name: "Search templates" })).toBeFocused()
})

test("/ typed in the search is part of the search", async ({ page }) => {
  await page.goto("/templates")
  const search = page.getByRole("searchbox", { name: "Search templates" })
  await search.click()
  await page.keyboard.type("a/b")
  await expect(search).toHaveValue("a/b")
})

test("at most one template is marked new", async ({ page }) => {
  await page.goto("/templates")
  await expect(cards(page).first()).toBeVisible()
  expect(await page.getByRole("main").getByText("New", { exact: true }).count()).toBeLessThanOrEqual(1)
})
