import { expect, test, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// The AI review (lib/review): asked for from the Check panel, it lists the
// words that stick and the ones that hurt, and draws them on the preview.
// Claude isn't asked here: the review's server function is answered for it.

const BULLETS = "What you did · one bullet per line"

async function resumeToReview(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await page.getByLabel("Email").fill("ada@example.com")
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^\d+ Experience$/ }).click()
  await page.getByRole("button", { name: "Add experience" }).click()
  await page.getByLabel("Role").fill("Analyst")
  await page.getByLabel("Company").fill("Analytical Engines")
  await page.getByLabel("Location").fill("London")
  await page.getByLabel(BULLETS).fill("• Grew sales by 30% in a year\n• Results-driven team player on the loom project")
  await expect(page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()
  await page.getByRole("tab", { name: /^Check/ }).click()
  return page.getByRole("tabpanel", { name: /^Check/ })
}

test("the AI review is asked for, listed and drawn on the preview, and a red flag goes once it's fixed", async ({ page }) => {
  const errors = pageErrors(page)
  const sent: { pieces: { id: string; text: string }[] }[] = []
  await page.route("**/api/review", async (route) => {
    const body = route.request().postDataJSON()
    sent.push(body)
    const id = (start: string) => body.pieces.find((piece: { text: string }) => piece.text.startsWith(start))?.id
    await route.fulfill({
      json: {
        highlights: [{ id: id("Grew"), quote: "Grew sales by 30%", note: "A number a recruiter remembers." }],
        redFlags: [
          { id: id("Results"), quote: "Results-driven team player", note: "Buzzwords. Say what the loom did instead." },
          // Words that aren't on the resume are left out.
          { id: id("Grew"), quote: "Led a team of ten", note: "Not on the resume." },
        ],
      },
    })
  })
  const panel = await resumeToReview(page)

  // Before it's asked for, it says where the text goes.
  await expect(panel.getByText("Sends the resume’s text to Claude")).toBeVisible()
  await panel.getByRole("button", { name: "Get AI feedback" }).click()
  await expect(panel.getByText("AI review: 1 highlight, 1 red flag.")).toBeAttached()

  // Only the entries' words were sent: not the name, the email, or where the job was.
  expect(sent).toHaveLength(1)
  const words = JSON.stringify(sent[0])
  for (const kept of ["Ada Lovelace", "ada@example.com", "London"]) expect(words).not.toContain(kept)
  expect(words).toContain("Grew sales by 30% in a year")

  // The highlights first: in the panel, and under their words on the preview, with the note on pointing at them.
  const highlights = panel.getByRole("button", { name: /^Highlights/ })
  await expect(highlights).toHaveAttribute("aria-pressed", "true")
  await expect(panel.getByRole("button", { name: /A number a recruiter remembers/ })).toBeVisible()
  const preview = page.getByRole("region", { name: "Live preview" })
  const marks = preview.locator("[data-mark]")
  await expect(marks).toHaveCount(1)
  await marks.first().hover()
  await expect(preview.getByText("A number a recruiter remembers.")).toBeVisible()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])

  // The red flags, from the preview's own switch.
  await preview.getByRole("button", { name: /^Red flags/ }).click()
  await expect(panel.getByRole("button", { name: /^Red flags/ })).toHaveAttribute("aria-pressed", "true")
  await expect(panel.getByRole("button", { name: /Buzzwords\. Say what the loom did instead\./ })).toBeVisible()
  await expect(panel.getByText("Not on the resume.")).toHaveCount(0)
  await expect(marks).toHaveCount(1)

  // Fixed, it goes, and the review can be asked for again.
  await page.getByLabel(BULLETS).fill("• Grew sales by 30% in a year\n• Built the loom's first program")
  await expect(panel.getByText("No red flags. Nice.")).toBeVisible()
  await expect(panel.getByText("1 fixed since the review.")).toBeVisible()
  await expect(marks).toHaveCount(0)
  await expect(panel.getByRole("button", { name: "Read again" })).toBeVisible()

  // In Write mode the preview is as it always is.
  await page.getByRole("tab", { name: "Write" }).click()
  await expect(preview.getByRole("button", { name: /^Red flags/ })).toHaveCount(0)
  await expect(marks).toHaveCount(0)
  expect(errors).toEqual([])
})

test("says why there's no review, and it can be tried again", async ({ page }) => {
  let answer = 503
  await page.route("**/api/review", (route) => route.fulfill({ status: answer, json: { error: "unavailable" } }))
  const panel = await resumeToReview(page)

  await panel.getByRole("button", { name: "Get AI feedback" }).click()
  await expect(panel.getByRole("alert")).toHaveText("AI feedback isn't available right now.")
  answer = 429
  await panel.getByRole("button", { name: "Try again" }).click()
  await expect(panel.getByRole("alert")).toHaveText("That's a lot of reviews. Try again in a few minutes.")
})
