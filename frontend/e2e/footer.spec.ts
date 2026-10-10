import { expect, test } from "@playwright/test"
import { pageErrors } from "./helpers"

test("the footer is a wordmark and its links to a screen reader: the zipper is only a picture", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/about")
  const footer = page.getByRole("contentinfo")

  await expect(footer.getByRole("link", { name: "resumezip" })).toHaveAttribute("href", "/")
  await expect(footer.getByRole("navigation", { name: "Footer" }).getByRole("link")).toHaveText(["About", "Terms & privacy", "Contact"])
  expect(errors).toEqual([])
})

// The zipper is drawn shut and stays that way: reaching the footer starts nothing in it.
test("the footer's zipper stays still as the page is scrolled to it and away", async ({ page }) => {
  await page.addInitScript(() => {
    for (const type of ["transitionrun", "animationstart"]) {
      window.addEventListener(
        type,
        (event) => {
          if ((event.target as Element).closest("footer")) document.documentElement.dataset.footerMoved = "yes"
        },
        true,
      )
    }
  })
  await page.goto("/about")
  await page.keyboard.press("End")
  await page.keyboard.press("Home")
  await page.keyboard.press("End")
  // Longer than the zipper used to take to shut, to be sure nothing starts.
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => document.documentElement.dataset.footerMoved)).toBeUndefined()
})
