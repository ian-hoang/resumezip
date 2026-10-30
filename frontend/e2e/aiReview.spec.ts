import { expect, test, type Page } from "./test"
import { textPdf } from "../src/lib/import/testFiles"
import { openFile, pageErrors, seriousAccessibilityProblems } from "./helpers"
import { FROM_ELSEWHERE } from "./resumes"

declare global {
  interface Window {
    /** How many times the page has measured an SVG element's box (getBBox), counted by a test. */
    measured?: number
  }
}

// The AI's notes, with /api/review answered here: tests never ask a real AI.

const pdf = { name: "Mara Lin.pdf", mimeType: "application/pdf", buffer: textPdf([FROM_ELSEWHERE]) }

// The line ids are left wrong on purpose: the page places a note by its quote.
const NOTES = [
  {
    tone: "red",
    line: "u99",
    quote: "Responsible for testing",
    title: "Says what you did, not what changed",
    why: "A recruiter can't tell what your testing caught.",
    suggestion: "Tested the checkout service, catching [number] bugs before release",
  },
  {
    tone: "green",
    line: "u98",
    quote: "cut release time from two hours to ten minutes",
    title: "A result anyone can picture",
    why: "Before and after, with who it helped.",
    suggestion: null,
  },
  {
    tone: "red",
    line: "u97",
    quote: "nowhere on this resume",
    title: "Add a summary",
    why: "It says who you are at a glance.",
    suggestion: null,
  },
]

async function reviewed(page: Page) {
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), pdf)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByRole("img", { name: "Page 1 of your resume, with the notes marked" })).toBeVisible()
}

test("AI notes are asked for once the resume is read, sent as the printed lines, and drawn in red and blue, with a tile for each", async ({
  page,
}) => {
  const errors = pageErrors(page)
  let sent: unknown = null
  await page.route("**/api/review", async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({ json: { notes: NOTES } })
  })
  await page.goto("/review")
  // The page says, before a file is chosen, that the resume goes to an AI.
  await expect(page.getByText("Resume is sent to AI for review, and kept only in this browser.")).toBeVisible()
  await reviewed(page)
  // A tile for each kind, the red flags pressed and listed.
  await expect(page.getByRole("button", { name: "Red flags, 2", pressed: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Done well, 1", pressed: false })).toBeVisible()
  // The lines, numbered, and nothing else: not the file, not its name.
  const lines = (sent as { lines: { id: string; text: string; bullet: boolean }[] }).lines
  expect(Object.keys(sent as object)).toEqual(["lines"])
  expect(lines[0]).toEqual({ id: "u1", text: "Mara Lin", bullet: false })
  expect(lines.map(({ text }) => text)).toContain("Responsible for testing the checkout service")

  // The page is marked with the AI's notes alone, and the checks are a switch away.
  await expect(page.getByRole("button", { name: "AI Reviews", pressed: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "“Responsible for” is a weak start" })).toHaveCount(0)
  await page.getByRole("button", { name: "ATS Checks" }).click()
  await expect(page.getByRole("button", { name: "“Responsible for” is a weak start" })).toBeAttached()
  await expect(page.getByRole("button", { name: "Red flag: Says what you did, not what changed" })).toHaveCount(0)
  // With the checks drawn, both tiles are shut and nothing is listed; pressing one goes back to the AI's notes.
  await expect(page.getByRole("button", { name: "Red flags, 2", pressed: false })).toBeVisible()
  await expect(page.getByRole("button", { name: "Done well, 1", pressed: false })).toBeVisible()
  await expect(page.getByRole("button", { name: "Says what you did, not what changed", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Red flags, 2" }).click()
  await expect(page.getByRole("button", { name: "AI Reviews", pressed: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Red flags, 2", pressed: true })).toBeVisible()
  // So does the switch, opening the tile pressed last.
  await page.getByRole("button", { name: "ATS Checks" }).click()
  await page.getByRole("button", { name: "AI Reviews" }).click()
  await expect(page.getByRole("button", { name: "Red flags, 2", pressed: true })).toBeVisible()

  // Each flag is drawn on its line, and pointing at it in the list shows its note there.
  const red = page.getByRole("button", { name: "Red flag: Says what you did, not what changed" })
  await expect(red).toBeAttached()
  await expect(page.getByRole("button", { name: "Done well: A result anyone can picture" })).toBeAttached()
  // The list's rows are named by their titles alone; the marks say which flag they are first.
  await page.getByRole("button", { name: "Says what you did, not what changed", exact: true }).hover()
  const tip = page.getByRole("tooltip")
  await expect(tip).toContainText("Red flag")
  await expect(tip).toContainText("Tested the checkout service, catching [number] bugs before release")
  await page.keyboard.press("Escape")
  await expect(tip).toBeHidden()
  // The other tile lists what's done well instead, and picking one brings its mark into focus, which shows its note.
  await page.getByRole("button", { name: "Done well, 1" }).click()
  await expect(page.getByRole("button", { name: "Done well, 1", pressed: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Says what you did, not what changed", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "A result anyone can picture", exact: true }).click()
  await expect(page.getByRole("button", { name: "Done well: A result anyone can picture" })).toBeFocused()
  await expect(tip).toContainText("Before and after, with who it helped.")
  // A note whose words aren't on the resume is listed under the page instead.
  await expect(page.getByRole("listitem").filter({ hasText: "Red flag: Add a summary" })).toBeVisible()

  expect(await seriousAccessibilityProblems(page)).toEqual([])
  expect(errors).toEqual([])
})

test("when the AI turns a review away, the page shows the checks and says why, and it can be asked again", async ({ page }) => {
  const errors = pageErrors(page)
  let calls = 0
  await page.route("**/api/review", async (route) => {
    calls++
    // The firewall's answer: no { error } body.
    if (calls === 1) await route.fulfill({ status: 429, contentType: "text/plain", body: "Too Many Requests" })
    else await route.fulfill({ json: { notes: NOTES.slice(0, 1) } })
  })
  await reviewed(page)
  await expect(page.getByRole("status").filter({ hasText: "AI notes are paused for a few minutes" })).toBeVisible()
  await expect(page.getByRole("button", { name: "ATS Checks", pressed: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "“Responsible for” is a weak start" })).toBeAttached()
  await expect(page.getByText("Give it a few minutes.")).toBeVisible()
  await page.getByRole("button", { name: "OK" }).click()
  await expect(page.getByText("AI notes are paused for a few minutes")).toHaveCount(0)

  // Back on the drop zone in this tab, the pause is said before a file is chosen, and another resume doesn't ask.
  await page.goto("/review")
  await expect(page.getByRole("status").filter({ hasText: "AI notes are paused for a few minutes" })).toBeVisible()
  await openFile(page.getByRole("button", { name: "Review my resume" }), {
    ...pdf,
    buffer: textPdf([[...FROM_ELSEWHERE, "Volunteer tutor, 2022"]]),
  })
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByText("Give it a few minutes.")).toBeVisible()
  expect(calls).toBe(1)

  // Asked again, it answers, and the pause is over.
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByRole("button", { name: "Red flags, 1" })).toBeVisible()
  await page.getByRole("button", { name: "Done well, 0" }).click()
  await expect(page.getByText("None stood out.")).toBeVisible()
  await expect(page.getByRole("button", { name: "AI Reviews", pressed: true })).toBeVisible()
  await page.goto("/review")
  await expect(page.getByRole("button", { name: "Review my resume" })).toBeVisible()
  await expect(page.getByText("AI notes are paused for a few minutes")).toHaveCount(0)
  // The browser logs the refused request itself; nothing else went wrong.
  expect(errors.filter((error) => !error.includes("status of 429"))).toEqual([])
})

test("AI notes are kept in the browser: the same resume shows them again without asking, and the editor lists them", async ({ page }) => {
  const errors = pageErrors(page)
  let calls = 0
  await page.route("**/api/review", async (route) => {
    calls++
    await route.fulfill({ json: { notes: NOTES } })
  })
  await reviewed(page)
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible()

  // Reviewed again, as a file with another name: the same notes, with no call.
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), { ...pdf, name: "Mara Lin (2).pdf" })
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible({ timeout: 90_000 })
  expect(calls).toBe(1)

  // In the editor, AI review opens on them and lists them, and they're marked on the preview.
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(page.getByRole("tab", { name: "AI review" })).toHaveAttribute("aria-selected", "true")
  const notes = page.getByRole("region", { name: "AI notes" })
  await expect(notes.getByRole("region", { name: "Red flags, 2" })).toBeVisible()
  await expect(notes.getByRole("region", { name: "Done well, 1" })).toBeVisible()
  // One note is open at a time, the top red flag first: it says why, and the others only their titles.
  await expect(notes.getByText("A recruiter can't tell what your testing caught.")).toBeVisible()
  await expect(notes.getByText("Before and after, with who it helped.")).toHaveCount(0)
  const mark = page.getByRole("button", { name: "Red flag: Says what you did, not what changed" })
  await expect(mark).toBeAttached({ timeout: 60_000 })
  // Pointing at its row shows its note on the preview.
  const row = notes.getByRole("button", { name: /Says what you did, not what changed/ })
  await row.hover()
  await expect(page.getByRole("tooltip")).toContainText("Tested the checkout service, catching [number] bugs before release")
  // The note that was never on a line is about the whole resume, and has nothing to open.
  await expect(notes.getByText("On your resume")).toBeVisible()
  await expect(notes.getByText("Changed since the notes")).toHaveCount(0)
  // Choosing it opens the words it's about in the form, in AI review's place, which say the note to a screen
  // reader, not under the field.
  await row.click()
  const bullets = page.getByLabel(/^Description/)
  await expect(bullets).toBeFocused()
  await expect(bullets).toHaveAccessibleDescription(/Red flag: Says what you did, not what changed/)
  // Once its words are rewritten, a note says so, and its mark goes from the preview.
  await bullets.fill(
    "• Responsible for the checkout service, catching 12 bugs before release\n• Built a deploy tool that cut release time from two hours to ten minutes for 40 engineers",
  )
  await page.getByRole("button", { name: "Back to AI review" }).click()
  await expect(notes.getByText("Changed since the notes")).toBeVisible({ timeout: 60_000 })
  await expect(mark).toHaveCount(0, { timeout: 60_000 })
  await expect(page.getByRole("button", { name: "Done well: A result anyone can picture" })).toBeAttached()
  // Choosing another note opens it, and the one that was open closes; back from its words, it's still open.
  await notes.getByRole("button", { name: "A result anyone can picture" }).click()
  await page.getByRole("button", { name: "Back to AI review" }).click()
  await expect(notes.getByText("Before and after, with who it helped.")).toBeVisible()
  await expect(notes.getByText("A recruiter can't tell what your testing caught.")).toHaveCount(0)
  // The checks' marks are a tab away, and never drawn with the AI's.
  await page.getByRole("tab", { name: "ATS checks" }).click()
  await expect(page.getByRole("button", { name: "“Responsible for” is a weak start", exact: true })).toBeAttached()
  await expect(mark).toHaveCount(0)
  expect(calls).toBe(1)
  expect(errors).toEqual([])
})

test("a review that found nothing can be asked again from the editor", async ({ page }) => {
  const errors = pageErrors(page)
  let calls = 0
  await page.route("**/api/review", async (route) => {
    calls++
    await route.fulfill({ json: { notes: calls === 1 ? [] : NOTES } })
  })
  await reviewed(page)
  await expect(page.getByText("None found. Nice.")).toBeVisible()

  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByRole("tab", { name: "AI review" }).click()
  // Its empty review isn't taken for an answer: the AI is asked.
  const ask = page.getByRole("button", { name: "Get AI notes" })
  await expect(ask).toBeEnabled({ timeout: 60_000 })
  await ask.click()
  await expect(page.getByRole("region", { name: "AI notes" }).getByRole("region", { name: "Red flags, 2" })).toBeVisible()
  expect(calls).toBe(2)
  expect(errors).toEqual([])
})

test("a reviewed file is kept as a past review, which opens as it was reviewed, again on reload, and outlives the resume made of it", async ({
  page,
}) => {
  const errors = pageErrors(page)
  let calls = 0
  await page.route("**/api/review", async (route) => {
    calls++
    await route.fulfill({ json: { notes: calls === 1 ? NOTES : [NOTES[1]] } })
  })
  await reviewed(page)
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible()

  // In the editor, it's rewritten and new notes are asked for: the review it came from keeps its own.
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  const id = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!)
  const notes = page.getByRole("region", { name: "AI notes" })
  await expect(page.getByRole("button", { name: "Red flag: Says what you did, not what changed" })).toBeAttached({ timeout: 60_000 })
  await notes.getByRole("button", { name: /Says what you did, not what changed/ }).click()
  const bullets = page.getByLabel(/^Description/)
  await expect(bullets).toBeFocused()
  await bullets.fill("• Built a deploy tool that cut release time from two hours to ten minutes for 40 engineers")
  await page.getByRole("button", { name: "Back to AI review" }).click()
  const again = notes.getByRole("button", { name: "Get new notes for this version" })
  await expect(again).toBeEnabled({ timeout: 60_000 })
  await again.click()
  // The new notes are in once there's the one done well they're answered with: the old ones go as soon as it's asked.
  await expect(notes.getByRole("region", { name: "Done well, 1" })).toBeVisible({ timeout: 60_000 })
  await expect(notes.getByRole("region", { name: "Red flags, 2" })).toHaveCount(0)
  expect(calls).toBe(2)

  // Listed under the drop zone, it opens as the file was, with the notes it got then, without asking again, and again on reload.
  await page.goto("/review")
  const past = page.getByRole("region", { name: "Past reviews" })
  await past.getByRole("button", { name: /^Mara Lin/ }).click()
  await expect(page).toHaveURL(/\/review\?past=[0-9a-f]{64}$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByText("Reviewed just now")).toBeVisible()
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Red flag: Says what you did, not what changed" })).toBeAttached()
  await page.reload()
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible({ timeout: 90_000 })
  expect(calls).toBe(2)

  // The resume made of it is deleted; the past review stays, listed under the drop zone.
  await page.goto("/create/dashboard")
  await page.getByRole("button", { name: "More for “Mara Lin”" }).first().click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible()
  await page.goto("/review")
  expect(await page.evaluate((id) => localStorage.getItem(`resume:${id}`), id)).toBeNull()
  await expect(past.getByRole("button", { name: /^Mara Lin/ })).toBeVisible()
  await expect(past).toContainText("ATS checks:")
  await expect(past).toContainText("AI: 2 red flags")
  await past.getByRole("button", { name: /^Mara Lin/ }).click()
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible({ timeout: 90_000 })
  expect(calls).toBe(2)

  // Opened in the editor again, it's added as a resume again, since the one it became is gone.
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(notes.getByRole("region", { name: "Red flags, 2" })).toBeVisible()

  // Deleted, it's gone from the list, and from the browser.
  await page.goto("/review")
  await past.getByRole("button", { name: "Delete the review of Mara Lin" }).click()
  await expect(past).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole("button", { name: "Review my resume" })).toBeVisible()
  await expect(past).toHaveCount(0)
  expect(errors).toEqual([])
})

test("a new review's address opens it again, and one opened in the editor straight away, while it's still being kept, is tied to its resume", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await page.route("**/api/review", (route) => route.fulfill({ json: { notes: NOTES } }))
  // Storage that's slow to open: the result is up, and the editor chosen, before the review is kept.
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open
    IDBFactory.prototype.open = function (...args: Parameters<typeof open>) {
      const request = open.apply(this, args)
      Object.defineProperty(request, "onsuccess", {
        set(handler: (event: Event) => void) {
          request.addEventListener("success", (event) => setTimeout(() => handler(event), 2_000))
        },
      })
      return request
    }
  })
  await reviewed(page)
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//, { timeout: 30_000 })
  const made = new URL(page.url()).pathname

  // Back on the review page, the past review opens the resume it became, not another copy of it.
  await page.goto("/review")
  await page
    .getByRole("region", { name: "Past reviews" })
    .getByRole("button", { name: /^Mara Lin/ })
    .click()
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible({ timeout: 90_000 })
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//, { timeout: 30_000 })
  expect(new URL(page.url()).pathname).toBe(made)

  // A file just reviewed is named in the address once it's kept, so a reload opens it again.
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), { ...pdf, name: "Mara Lin (2).pdf" })
  await expect(page).toHaveURL(/\/review\?past=[0-9a-f]{64}$/, { timeout: 90_000 })
  await page.reload()
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible({ timeout: 90_000 })
  expect(errors).toEqual([])
})

test("a past review that can't be deleted stays listed, and says so", async ({ page }) => {
  await page.route("**/api/review", (route) => route.fulfill({ json: { notes: NOTES } }))
  await reviewed(page)
  await page.goto("/review")
  const past = page.getByRole("region", { name: "Past reviews" })
  await expect(past.getByRole("button", { name: /^Mara Lin/ })).toBeVisible()
  await page.evaluate(() => {
    const refuse = () => {
      throw new DOMException("Refused", "UnknownError")
    }
    IDBObjectStore.prototype.delete = refuse
    IDBObjectStore.prototype.clear = refuse
  })
  await past.getByRole("button", { name: "Delete the review of Mara Lin" }).click()
  await expect(past.getByRole("alert")).toHaveText("That couldn’t be deleted. Try again.")
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0)
  await past.getByRole("button", { name: "Clear all" }).click()
  await past.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(past.getByRole("alert")).toHaveText("That couldn’t be deleted. Try again.")
  // The question stays, to try again.
  await expect(past.getByRole("status")).toHaveText("Delete all?")
  await page.reload()
  await expect(past.getByRole("button", { name: /^Mara Lin/ })).toBeVisible()
})

/** How many past reviews are kept in the browser's storage, read from IndexedDB itself. */
const keptReviews = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("resumezip")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const count = request.result.transaction("pastReviews").objectStore("pastReviews").count()
          count.onerror = () => reject(count.error)
          count.onsuccess = () => {
            request.result.close()
            resolve(count.result)
          }
        }
      }),
  )

test("a past review is deleted at once, and Undo puts it back, file and all; Clear all asks first", async ({ page }) => {
  const errors = pageErrors(page)
  await page.route("**/api/review", (route) => route.fulfill({ json: { notes: NOTES } }))
  await reviewed(page)
  await page.goto("/review")
  const past = page.getByRole("region", { name: "Past reviews" })
  const review = past.getByRole("button", { name: /^Mara Lin/ })
  const bin = past.getByRole("button", { name: "Delete the review of Mara Lin" })
  const clearAll = past.getByRole("button", { name: "Clear all" })
  const keep = past.getByRole("button", { name: "Keep" })

  // The bin deletes it from the browser at once; Undo puts it back, with the focus on it.
  await bin.click()
  await expect(past).toHaveCount(0)
  await expect(page.getByRole("status")).toHaveText("“Mara Lin” deleted")
  expect(await keptReviews(page)).toBe(0)
  await page.getByRole("button", { name: "Undo" }).click()
  await expect(review).toBeFocused()
  await expect(page.getByRole("status")).toHaveText("“Mara Lin” is back")
  expect(await keptReviews(page)).toBe(1)

  // Clear all only asks. Escape or Keep backs out, giving it the focus again, and nothing's deleted.
  await clearAll.click()
  await expect(past.getByRole("status")).toHaveText("Delete all?")
  await expect(keep).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(past.getByRole("status")).toHaveCount(0)
  await expect(clearAll).toBeFocused()
  await clearAll.click()
  await keep.click()
  await expect(clearAll).toBeFocused()
  expect(await keptReviews(page)).toBe(1)

  // The review put back came back with its file: it opens as it was reviewed, after a reload too.
  await page.reload()
  await review.click()
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible({ timeout: 90_000 })

  // Deleted once that's said, they're all gone from the browser.
  await page.goto("/review")
  await clearAll.click()
  await past.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(past).toHaveCount(0)
  expect(await keptReviews(page)).toBe(0)
  expect(errors).toEqual([])
})

/**
 * Opens a resume whose review found nothing in the editor, on its AI notes,
 * and asks the AI there, which answers only once `answer()` is called.
 */
async function askedFromTheEditor(page: Page) {
  let calls = 0
  let answer = () => {}
  const answered = new Promise<void>((resolve) => (answer = resolve))
  await page.route("**/api/review", async (route) => {
    calls++
    if (calls > 1) await answered
    await route.fulfill({ json: { notes: calls === 1 ? [] : NOTES } })
  })
  await reviewed(page)
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByRole("tab", { name: "AI review" }).click()
  const ask = page.getByRole("button", { name: "Get AI notes" })
  await expect(ask).toBeEnabled({ timeout: 60_000 })
  await ask.click()
  return { answer, calls: () => calls }
}

test("while the editor asks the AI, it counts a recruiter's seven seconds, then says the AI reads the rest, until the notes come", async ({
  page,
}) => {
  const errors = pageErrors(page)
  const { answer, calls } = await askedFromTheEditor(page)
  const notes = page.getByRole("region", { name: "AI notes" })
  await expect(notes.getByRole("status")).toHaveText("Reading it like a recruiter")
  await expect(notes.getByRole("button", { name: "Get AI notes" })).toHaveCount(0)
  await expect(notes.getByText(/^\d\.\d$/)).toBeVisible()
  await expect(notes.getByText("Where a recruiter’s eyes go first.")).toBeVisible()
  // Past the seven seconds, the eyes are done: the rest of the wait is the AI's.
  await expect(notes.getByText("The AI reads the rest…")).toBeVisible({ timeout: 15_000 })
  await expect(notes.getByText(/^\d\.\d$/)).toHaveCount(0)
  answer()
  await expect(notes.getByRole("region", { name: "Red flags, 2" })).toBeVisible()
  await expect(notes.getByRole("status")).toHaveCount(0)
  expect(calls()).toBe(2)
  expect(errors).toEqual([])
})

test("with less motion, the editor's wait for the AI counts no seconds", async ({ page }) => {
  const errors = pageErrors(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  const { answer } = await askedFromTheEditor(page)
  const notes = page.getByRole("region", { name: "AI notes" })
  await expect(notes.getByRole("status")).toHaveText("Reading it like a recruiter")
  await expect(notes.getByText("The AI reads every line…")).toBeVisible()
  await expect(notes.getByText(/^\d\.\d$/)).toHaveCount(0)
  answer()
  await expect(notes.getByRole("region", { name: "Red flags, 2" })).toBeVisible()
  expect(errors).toEqual([])
})

/** Answers /api/review only once `answer()` is called; `asked` settles when the page has asked. */
async function heldAnswer(page: Page) {
  let ask = () => {}
  const asked = new Promise<void>((resolve) => (ask = resolve))
  let answer = () => {}
  const answered = new Promise<void>((resolve) => (answer = resolve))
  await page.route("**/api/review", async (route) => {
    ask()
    await answered
    await route.fulfill({ json: { notes: NOTES } })
  })
  return { asked, answer }
}

test("the AI is asked as soon as the resume's pages are read, and the result waits for its notes while a recruiter's seconds count on the page", async ({
  page,
}) => {
  const errors = pageErrors(page)
  const { asked, answer } = await heldAnswer(page)
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), pdf)
  await asked
  // Asked before there's a result: the page is still being read, its own page counting a recruiter's seven seconds.
  await expect(page.getByRole("heading", { level: 1, name: "Reading it like a recruiter…" })).toBeVisible()
  await expect(page.getByText(/^\d\.\d seconds$/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("status").getByText("Getting notes from AI")).toBeVisible()
  answer()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  // It opens with the notes in: nothing says they're on their way.
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible()
  await expect(page.getByText("Getting notes from AI")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Red flag: Says what you did, not what changed" })).toBeAttached()
  expect(errors).toEqual([])
})

test("when the AI is long coming, the result opens without its notes, and a view chosen meanwhile stays when they arrive", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await page.clock.install()
  const { asked, answer } = await heldAnswer(page)
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), pdf)
  await asked
  await page.clock.fastForward(26_000)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByRole("status").filter({ hasText: "Getting notes from AI" })).toBeVisible()
  await page.getByRole("button", { name: "ATS Checks" }).click()
  answer()
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible()
  await expect(page.getByRole("button", { name: "ATS Checks", pressed: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "“Responsible for” is a weak start" })).toBeAttached()
  expect(errors).toEqual([])
})

test("a page that never finishes drawing doesn't hold the result: after the wait it opens with the notes listed", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  // A browser whose pictures never come back.
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toBlob = () => {}
  })
  let ask = () => {}
  const asked = new Promise<void>((resolve) => (ask = resolve))
  await page.route("**/api/review", async (route) => {
    ask()
    await route.fulfill({ json: { notes: NOTES } })
  })
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), pdf)
  await asked
  await page.clock.fastForward(26_000)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByRole("listitem").filter({ hasText: "Red flag: Says what you did, not what changed" })).toBeVisible()
  expect(errors).toEqual([])
})

test("the verdict's cloud is measured as it's drawn, not again each time the page changes", async ({ page }) => {
  const errors = pageErrors(page)
  await page.addInitScript(() => {
    const getBBox = SVGGraphicsElement.prototype.getBBox
    window.measured = 0
    SVGGraphicsElement.prototype.getBBox = function (this: SVGGraphicsElement, options?: SVGBoundingBoxOptions) {
      window.measured!++
      return getBBox.call(this, options)
    }
  })
  await page.route("**/api/review", (route) => route.fulfill({ json: { notes: NOTES } }))
  await reviewed(page)
  await page.evaluate(() => document.fonts.ready)
  const measured = await page.evaluate(() => window.measured!)
  expect(measured).toBeGreaterThan(0)
  // Pointing at a flag in the list opens its mark on the page, which renders the page again.
  const flag = page.getByRole("list", { name: "Red flags" }).getByRole("button", { name: "Says what you did, not what changed" })
  for (let time = 0; time < 3; time++) {
    await flag.hover()
    await expect(flag).toHaveAttribute("data-open", "")
    await page.mouse.move(0, 0)
    await expect(flag).not.toHaveAttribute("data-open")
  }
  expect(await page.evaluate(() => window.measured)).toBe(measured)
  expect(errors).toEqual([])
})

/**
 * Makes hashing the lines fail, as it does where the page isn't served
 * securely and has no crypto.subtle. Only the lines' hash fails: Next.js
 * hashes with it too, as it prefetches links.
 */
const linesCantBeHashed = (page: Page) =>
  page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = (algorithm: AlgorithmIdentifier, data: BufferSource) =>
      new TextDecoder().decode(data).startsWith('[["u1"') ? Promise.reject(new Error("No digest for the lines")) : digest(algorithm, data)
  })

test("where the lines can't be hashed, the AI is still asked and its notes shown, just not kept", async ({ page }) => {
  const errors = pageErrors(page)
  await linesCantBeHashed(page)
  await page.route("**/api/review", (route) => route.fulfill({ json: { notes: NOTES } }))
  await reviewed(page)
  await expect(page.getByRole("button", { name: "Red flags, 2" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Red flag: Says what you did, not what changed" })).toBeAttached()
  expect(errors).toEqual([])
})

test("where the lines can't be hashed, the editor still asks the AI and shows its notes", async ({ page }) => {
  const errors = pageErrors(page)
  await linesCantBeHashed(page)
  let calls = 0
  await page.route("**/api/review", async (route) => {
    calls++
    await route.fulfill({ json: { notes: NOTES } })
  })
  await reviewed(page)
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  // The review's notes weren't kept without a hash, so the editor asks again.
  await page.getByRole("tab", { name: "AI review" }).click()
  const ask = page.getByRole("button", { name: "Get AI notes" })
  await expect(ask).toBeEnabled({ timeout: 60_000 })
  await ask.click()
  await expect(page.getByRole("region", { name: "AI notes" }).getByRole("region", { name: "Red flags, 2" })).toBeVisible()
  expect(calls).toBe(2)
  expect(errors).toEqual([])
})

test("the drop zone's note that AI notes are paused goes when the pause is over", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  await page.goto("/review")
  await page.evaluate(() => sessionStorage.setItem("resumezip.aiPausedUntil", String(Date.now() + 60_000)))
  await page.reload()
  const note = page.getByRole("status").filter({ hasText: "AI notes are paused for a few minutes" })
  await expect(note).toBeVisible()
  await page.clock.fastForward(61_000)
  await expect(note).toHaveCount(0)
  expect(errors).toEqual([])
})
