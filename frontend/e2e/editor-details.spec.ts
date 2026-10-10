import { expect, test, type Locator, type Page } from "@playwright/test"
import { pageErrors } from "./helpers"

// Small things in the editor's form and checker: the glow on the field being
// typed in (components/editor/fields.tsx) and the score's rolling digits
// (components/editor/CheckPanel.tsx).

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

const boxOf = async (locator: Locator) => (await locator.boundingBox())!

test("a field glows while it has the focus, and nothing moves", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page, 1440, 900)
  const email = page.getByLabel("Email")
  await page.getByRole("tab", { name: "Write" }).focus()
  const before = [await boxOf(page.getByLabel("Full name")), await boxOf(email)]
  await email.focus()
  // The glow is drawn behind the field, as a shadow and a wash, so nothing around it moves.
  await expect.poll(() => email.evaluate((input) => getComputedStyle(input.previousElementSibling!).opacity)).toBe("1")
  expect([await boxOf(page.getByLabel("Full name")), await boxOf(email)]).toEqual(before)
  expect(errors).toEqual([])
})

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(reducedMotion === "reduce" ? "with less motion" : "with motion", () => {
    test.use({ reducedMotion })

    test(`the score's digits are the score, ${reducedMotion === "reduce" ? "shown as they are" : "drawn to roll when it changes"}`, async ({
      page,
    }) => {
      const errors = pageErrors(page)
      await startWriting(page, 1440, 900)
      await page
        .getByRole("navigation", { name: "Sections" })
        .getByRole("button", { name: /^\d+ Experience$/ })
        .click()
      await page.getByRole("button", { name: "Add experience" }).click()
      await page.getByLabel("Company").fill("Analytical Engines")
      await page.getByRole("tab", { name: /^Check/ }).click()
      const number = page.getByRole("region", { name: "Resume score" }).getByText(/^\d+$/)
      await expect(number).toBeVisible()

      // The number is what's read, and the rolling digits over it show the same.
      const drawn = await number.evaluate((element) => {
        const digits = [...(element.parentElement?.querySelectorAll<HTMLElement>("[style*='--digit']") ?? [])]
        return {
          digits: digits.map((digit) => digit.style.getPropertyValue("--digit")).join(""),
          rolling: digits.length > 0 && getComputedStyle(digits[0].parentElement!).display !== "none",
          numberShown: getComputedStyle(element).opacity === "1",
        }
      })
      expect(drawn.digits).toBe(await number.textContent())
      expect(drawn.rolling).toBe(reducedMotion !== "reduce")
      expect(drawn.numberShown).toBe(reducedMotion === "reduce")

      expect(errors).toEqual([])
    })
  })
}
