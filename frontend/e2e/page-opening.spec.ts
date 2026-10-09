import { expect, test, type Page } from "@playwright/test"
import { pageErrors } from "./helpers"

// Opening a resume from a picture of its page carries the picture into the
// editor (lib/viewTransition.ts): the browser moves the element named
// "resume-page" before the change to the one named so after it.

declare global {
  interface Window {
    /** What each page opening named, on each side, and whether it finished. */
    openings?: { before: string[]; after: string[]; finished: boolean }[]
  }
}

/**
 * Records each view transition: the elements named "resume-page" as it
 * starts, and once the editor has rendered, each as where it is: the template
 * or resume card it's the picture of, or the region it's in.
 */
async function recordOpenings(page: Page) {
  await page.addInitScript(() => {
    if (!("startViewTransition" in document)) return
    const start = Document.prototype.startViewTransition
    const named = () =>
      [...document.querySelectorAll<HTMLElement>("*")]
        .filter((element) => getComputedStyle(element).viewTransitionName === "resume-page")
        .map((element) => {
          // A resume's card is named by its name's link; the picture's own link is hidden.
          const card = element.closest("li")?.querySelector("[data-resume-link]") ?? element.closest("a")
          if (card) return `picture in “${card.textContent?.trim()}”`
          const drawn = element.querySelector("img[src^='blob:']") ? "picture" : "page"
          return `${drawn} in ${element.closest("[aria-label]")?.getAttribute("aria-label")}`
        })
    Document.prototype.startViewTransition = function (this: Document, update) {
      const opening = { before: named(), after: [] as string[], finished: false }
      ;(window.openings ??= []).push(opening)
      const transition = start.call(this, update)
      transition.updateCallbackDone.then(() => (opening.after = named()))
      transition.finished.then(() => (opening.finished = true))
      return transition
    }
  })
}

const resume = {
  id: "ada",
  resumeTitle: "Ada's resume",
  resumeTag: "professional",
  updatedAt: "2026-10-06T12:00:00.000Z",
  selectedTemplate: "jake",
  profileSection: { fullName: "Ada Lovelace" },
}

test.beforeEach(async ({ page }) => {
  // Wide enough for the preview to sit beside the form, where the page lands.
  await page.setViewportSize({ width: 1440, height: 900 })
})

test("a template's picture carries into the editor as its page", async ({ page }) => {
  const errors = pageErrors(page)
  await recordOpenings(page)
  await page.goto("/templates")
  test.skip(!(await page.evaluate(() => "startViewTransition" in document)), "This browser has no view transitions")

  await page.getByRole("link", { name: /^Harvard template/ }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect.poll(() => page.evaluate(() => window.openings?.[0]?.finished)).toBe(true)
  const [opening, ...more] = await page.evaluate(() => window.openings!)
  expect(more).toEqual([])
  expect(opening.before).toEqual([expect.stringMatching(/^picture in “Harvard/)])
  expect(opening.after).toEqual(["page in Live preview"])
  // Once it's done, nothing keeps the name, so the next opening has one of each.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll("*")].some((element) => getComputedStyle(element).viewTransitionName === "resume-page"),
    ),
  ).toBe(false)
  await expect(page.getByRole("region", { name: "Live preview" }).locator("canvas")).toBeVisible()
  expect(errors).toEqual([])
})

test("a resume's card carries its picture into the editor, which shows it until the preview is made", async ({ page }) => {
  const errors = pageErrors(page)
  await recordOpenings(page)
  await page.addInitScript((resume) => localStorage.setItem(`resume:${resume.id}`, JSON.stringify(resume)), resume)
  await page.goto("/create/dashboard")
  test.skip(!(await page.evaluate(() => "startViewTransition" in document)), "This browser has no view transitions")
  const card = page.getByRole("list", { name: "Resumes" }).getByRole("listitem")
  await expect(card.locator("[data-page] img")).toHaveAttribute("src", /^blob:/)

  await card.getByRole("link", { name: resume.resumeTitle }).click()
  await expect(page.getByLabel("Resume name")).toHaveValue(resume.resumeTitle)
  await expect.poll(() => page.evaluate(() => window.openings?.[0]?.finished)).toBe(true)
  const [opening] = await page.evaluate(() => window.openings!)
  expect(opening.before).toEqual([`picture in “${resume.resumeTitle}”`])
  // The editor's page shows the same picture as it lands.
  expect(opening.after).toEqual(["picture in Live preview"])
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("with less motion, a template's picture opens the editor without moving", async ({ page }) => {
  const errors = pageErrors(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await recordOpenings(page)
  await page.goto("/templates")
  await page.getByRole("link", { name: /^Harvard template/ }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(page.getByRole("button", { name: /^Template/ })).toContainText("Harvard")
  expect(await page.evaluate(() => window.openings ?? [])).toEqual([])
  expect(errors).toEqual([])
})
