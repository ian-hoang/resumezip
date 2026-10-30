import { expect, test } from "./test"
import { newResume, pageErrors } from "./helpers"

// Spelling and grammar (issue #66): the grammar checker loads once Check is
// opened, runs in the browser, and "Add word" clears a word everywhere on the
// resume.

test("unknown words are suggestions, and Add word clears them without the text leaving the browser", async ({ page }) => {
  const errors = pageErrors(page)
  const sent: string[] = []
  page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`))

  await newResume(page)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Company").fill("Analytical Engines")
  await page.getByLabel(/^Description/).fill("Wrote the Zorbly notes on the Qwexy engine\nTaught Zorbly methods to the the society")

  await page
    .getByRole("tablist", { name: /check or style$/i })
    .getByRole("tab", { name: "ATS checks" })
    .click()
  const panel = page.getByRole("tabpanel", { name: "ATS checks" })
  const typos = panel.getByRole("button", { name: /^Experience → .*The English dictionary doesn't know “Zorbly”/ })
  await expect(typos).toHaveCount(2)
  await expect(panel.getByRole("button", { name: /“the” twice in a row/ })).toBeVisible()
  await expect(panel.getByText("Checking spelling and grammar…")).toBeHidden()

  // Choosing one opens its bullet, and the note there is about that word,
  // though the bullet has another typo.
  const bullets = page.getByLabel(/^Description/)
  await panel.getByRole("button", { name: /^Experience → .*The English dictionary doesn't know “Qwexy”/ }).click()
  await expect(bullets).toBeFocused()
  await expect(bullets).toHaveAccessibleDescription(/The English dictionary doesn't know “Qwexy”/)
  await page.getByRole("tab", { name: "ATS Checks" }).click()
  await expect(panel.getByRole("button", { name: /Dismiss: The English dictionary doesn't know “Qwexy”/ })).toBeVisible()

  // Add word clears a word in both bullets.
  await panel.getByRole("button", { name: "Add word “Zorbly”" }).first().click()
  await expect(typos).toHaveCount(0)
  await expect(panel.getByRole("button", { name: /“the” twice in a row/ })).toBeVisible()

  // Nothing typed was sent anywhere: the grammar checker is downloaded, not called.
  expect(sent.filter((request) => request.includes("Zorbly"))).toEqual([])
  expect(errors).toEqual([])
})
