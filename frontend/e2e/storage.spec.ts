import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { holdablePreviews, holdPreviews, pageErrors, previewsBuilt, seriousAccessibilityProblems } from "./helpers"

declare global {
  interface Window {
    /** Set by a test to make saving fail as if storage were full. */
    storageFull?: boolean
    /** The keys saved to localStorage, noted by a test. */
    saves?: string[]
    /** How many times the page asked the browser to keep its data, counted by a test. */
    persistRequests?: number
    /** How many times the page checked whether the person let it keep its data, counted by a test. */
    permissionChecks?: number
    /** Where the page was each time it read saved resumes, noted by a test. */
    reads?: string[]
    /** Set on the open page by a test. A link that loads a new page loses it; one the app opens in the page keeps it. */
    marked?: boolean
  }
}

/** What the editor and dashboard show while the latest changes aren't saved. */
const notSaved = (page: Page) => page.getByRole("alert").filter({ hasText: "Not saved" })

/** Starts a new resume, and returns the localStorage key it's saved under. */
async function startWriting(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  return `resume:${new URL(page.url()).pathname.split("/").pop()}`
}

/**
 * The preview showing some text. Tests wait for this before leaving the
 * editor: Safari reports leaving while the editor still downloads its PDF
 * compiler as an error.
 */
const previewShows = (preview: Locator, text: RegExp) => preview.getByText(text).first()

/** The text saved under a localStorage key, as one page sees it. */
const savedAt = (page: Page, key: string) => () => page.evaluate((key) => localStorage.getItem(key) ?? "", key)

/** The saved data a page has kept aside because it couldn't be read. */
const keptAside = (page: Page) => () =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("allResumes-unreadable-"))
      .map((key) => localStorage.getItem(key)),
  )

test("when the browser won't let the site save anything, it still works and says so", async ({ page }) => {
  const errors = pageErrors(page)
  // As in Chrome set to "Don't allow sites to save data on your device".
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Access is denied for this document.", "SecurityError")
      },
    })
  })
  await startWriting(page)
  await expect(notSaved(page)).toContainText("isn't letting resumezip save anything")

  // Editing and downloading still work, so a PDF can keep a copy: the warning has a button for it.
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()
  const downloading = page.waitForEvent("download")
  await notSaved(page).getByRole("button", { name: "Download PDF" }).click()
  expect((await downloading).suggestedFilename()).toMatch(/\.pdf$/)
  // The preview is left out. With the warning above it, the page no longer
  // fits, and its scroll area can't be reached by keyboard unless the resume
  // has a link in it. That's a problem of its own, not this test's.
  expect(await seriousAccessibilityProblems(page, ['[aria-label="Live preview"]'])).toEqual([])

  // The dashboard says so too, and has the resume until the page is closed,
  // through a visit to another page.
  await page.getByRole("link", { name: "Your resumes" }).click()
  await expect(notSaved(page)).toContainText("isn't letting resumezip save anything")
  await expect(page.getByText(/^1 resume\W+not saved$/i)).toBeVisible()
  await page.getByRole("banner").getByRole("link", { name: "resumezip" }).click()
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/dashboard$/)
  await expect(page.getByText(/^1 resume\W+not saved$/i)).toBeVisible()

  expect(errors).toEqual([])
})

test("the home page doesn't read saved resumes, and Start writing goes to them", async ({ page }) => {
  const errors = pageErrors(page)
  const ada = { id: "ada", resumeTitle: "Ada's resume", resumeTag: "personal", updatedAt: "2026-10-06T12:00:00.000Z" }
  // A resume saved on an earlier visit, and where the page is each time it reads saved resumes.
  await page.addInitScript((resume) => {
    const key = `resume:${resume.id}`
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(resume))
    window.reads = []
    const getItem = Storage.prototype.getItem
    Storage.prototype.getItem = function (key: string) {
      if (/^(resume:|allResumes)/.test(key)) window.reads?.push(location.pathname)
      return getItem.call(this, key)
    }
  }, ada)
  await page.goto("/")
  await page.evaluate(() => (window.marked = true))
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/dashboard$/)
  await expect(page.getByRole("link", { name: ada.resumeTitle }).first()).toBeVisible()

  // The dashboard opened in the same page, so these are all the reads since the home page loaded.
  expect(await page.evaluate(() => window.marked)).toBe(true)
  expect(await page.evaluate(() => [...new Set(window.reads)])).toEqual(["/create/dashboard"])

  expect(errors).toEqual([])
})

test("when storage is full, the editor says the changes aren't saved until they are", async ({ page }) => {
  const errors = pageErrors(page)
  // Saving throws as it does when storage is out of room, while window.storageFull is set.
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (window.storageFull) throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
      setItem.call(this, key, value)
    }
  })
  await startWriting(page)
  const name = page.getByLabel("Full name")
  const saved = page.getByText("Saved in this browser")

  await name.fill("Ada")
  await expect(saved).toHaveCount(1)
  await expect(notSaved(page)).toHaveCount(0)

  // Closing the tab straight after a change that can't be saved asks first,
  // even before that change was due to be saved. (Browsers only let a page
  // ask once someone has clicked in it.)
  await page.evaluate(() => (window.storageFull = true))
  await name.click()
  await name.fill("Ada Lovelace")
  const asking = page.waitForEvent("dialog")
  await page.close({ runBeforeUnload: true })
  const dialog = await asking
  expect(dialog.type()).toBe("beforeunload")
  await dialog.dismiss()
  await expect(notSaved(page)).toContainText("storage for resumezip is full")
  await expect(saved).toHaveCount(0)
  await expect(name).toHaveValue("Ada Lovelace")

  // The warning's button keeps a copy as a PDF.
  const downloading = page.waitForEvent("download")
  await notSaved(page).getByRole("button", { name: "Download PDF" }).click()
  expect((await downloading).suggestedFilename()).toMatch(/\.pdf$/)

  // Once there's room, the next change is saved and the warning goes.
  await page.evaluate(() => (window.storageFull = false))
  await name.fill("Ada King")
  await expect(notSaved(page)).toHaveCount(0)
  await expect(saved).toHaveCount(1)
  await expect(previewShows(page.getByRole("region", { name: "Live preview" }), /Ada King/i)).toBeVisible()

  // Leaving doesn't ask any more: the reload goes ahead without a question.
  const asked: string[] = []
  page.on("dialog", (dialog) => {
    asked.push(dialog.type())
    void dialog.accept()
  })
  await page.reload()
  await expect(page.getByLabel("Full name")).toHaveValue("Ada King")
  expect(asked).toEqual([])

  expect(errors).toEqual([])
})

test("saved data that can't be read is kept instead of being saved over", async ({ page }) => {
  const errors = pageErrors(page)
  const unreadable = '{"a": {"resumeTitle": "Ada'
  // Saved before the first page loads, once.
  await page.addInitScript((text) => {
    if (sessionStorage.getItem("seeded")) return
    sessionStorage.setItem("seeded", "yes")
    localStorage.setItem("allResumes", text)
  }, unreadable)
  // As a visitor saving data, so the dashboard doesn't start downloading the
  // PDF compiler a second after it opens: the reload below would cut that
  // short, which Safari logs as an error, and nothing on the page shows when
  // it's done.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true, effectiveType: "4g" } })
  })
  await page.goto("/create/dashboard")
  const kept = keptAside(page)

  const note = page.getByText("couldn't be read, so resumezip kept a copy")
  await expect(note).toBeVisible()
  expect(await kept()).toEqual([unreadable])
  expect(await seriousAccessibilityProblems(page)).toEqual([])

  // It's still there after a reload, and downloads exactly as it was saved.
  // The reload waits until the dashboard has fetched the pages its links go
  // to, as Next.js does ahead of a click, which Safari also logs as an error
  // when it's cut off.
  await page.waitForLoadState("networkidle")
  await page.reload()
  await expect(note).toBeVisible()
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download the copy" }).click()
  expect(readFileSync(await (await downloading).path(), "utf8")).toBe(unreadable)

  // Deleting it removes it from the browser.
  await page.getByRole("button", { name: "Delete it" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click()
  await expect(note).toHaveCount(0)
  expect(await kept()).toEqual([])

  expect(errors).toEqual([])
})

test("when another tab saves something unreadable, the open resume stays and is saved again", async ({ page, context }) => {
  const errors = pageErrors(page)
  const key = await startWriting(page)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  const saved = savedAt(page, key)
  await expect.poll(saved).toContain("Ada Lovelace")

  // Another tab (a page in the same browser) saves something unreadable over
  // it, once it has read the resumes itself.
  const other = await context.newPage()
  await other.goto("/create/dashboard")
  await expect(other.getByText(/^1 resume\W+stored in this browser$/i)).toBeVisible()
  await other.evaluate((key) => localStorage.setItem(key, "not json"), key)

  // The editor keeps what was unreadable aside, keeps its resume, and saves it back.
  await expect.poll(keptAside(page)).toEqual(["not json"])
  await expect.poll(saved).toContain("Ada Lovelace")
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")

  expect(errors).toEqual([])
})

test("typing is saved once it pauses, and just opening a page saves nothing", async ({ page }) => {
  const errors = pageErrors(page)
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    window.saves = []
    Storage.prototype.setItem = function (key: string, value: string) {
      window.saves?.push(key)
      setItem.call(this, key, value)
    }
  })
  const key = await startWriting(page)
  const editor = new URL(page.url()).pathname
  const preview = page.getByRole("region", { name: "Live preview" })
  const saves = () => page.evaluate(() => window.saves ?? [])
  await page.evaluate(() => (window.saves = []))

  // Twelve keystrokes are saved once, or a few times if the machine stalls mid-word.
  await page.getByLabel("Full name").pressSequentially("Ada Lovelace", { delay: 25 })
  await expect.poll(saves).not.toEqual([])
  const made = await saves()
  expect(made.every((saved) => saved === key)).toBe(true)
  expect(made.length).toBeLessThanOrEqual(3)
  await expect(previewShows(preview, /Ada Lovelace/i)).toBeVisible()

  // Opening the dashboard, or the editor again, saves nothing.
  await page.goto("/create/dashboard")
  await expect(page.getByText(/^1 resume\W+stored in this browser$/i)).toBeVisible()
  await page.waitForTimeout(1_000)
  expect(await saves()).toEqual([])
  await page.goto(editor)
  await expect(previewShows(preview, /Ada Lovelace/i)).toBeVisible()
  await page.waitForTimeout(1_000)
  expect(await saves()).toEqual([])

  expect(errors).toEqual([])
})

test("a change made just before the page closes is saved", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  const key = await startWriting(page)
  const name = page.getByLabel("Full name")
  await name.fill("Ada")
  await expect(previewShows(page.getByRole("region", { name: "Live preview" }), /Ada/i)).toBeVisible()

  // With the page's clock stopped, typing never pauses long enough to be
  // saved, so only the save as the page closes can save it.
  await page.clock.pauseAt(Date.now() + 1_000)
  await name.fill("Ada Lovelace")
  expect(await savedAt(page, key)()).not.toContain("Ada Lovelace")
  await page.reload()
  await page.clock.resume()
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")

  expect(errors).toEqual([])
})

test("the editor says Saving… while typing, and Saved once typing has stopped for a moment", async ({ page }) => {
  const errors = pageErrors(page)
  await page.clock.install()
  const key = await startWriting(page)
  const name = page.getByLabel("Full name")
  const saving = page.getByText("Saving…")
  const saved = page.getByText("Saved in this browser")
  await name.fill("Ada")
  await expect(previewShows(page.getByRole("region", { name: "Live preview" }), /Ada/i)).toBeVisible()
  await expect(saved).toBeVisible()

  // From here the page's clock only moves when the test moves it.
  await page.clock.pauseAt(Date.now() + 1_000)
  await name.fill("Ada Love")
  await expect(saving).toBeVisible()
  // A pause between words is long enough to save, but it still says Saving…,
  // rather than flicking to Saved and back as the next word is typed.
  await page.clock.runFor(600)
  await expect.poll(savedAt(page, key)).toContain("Ada Love")
  await expect(saving).toBeVisible()
  await expect(saved).toHaveCount(0)
  await name.fill("Ada Lovelace")
  await page.clock.runFor(600)
  await expect.poll(savedAt(page, key)).toContain("Ada Lovelace")
  await expect(saving).toBeVisible()

  // Stopped: it says it's saved.
  await page.clock.runFor(1_000)
  await expect(saved).toBeVisible()
  await expect(saving).toHaveCount(0)
  await page.clock.resume()

  expect(errors).toEqual([])
})

test("a resume deleted in another tab leaves no preview behind, so it's built afresh if it comes back", async ({ page, context }) => {
  const errors = pageErrors(page)
  await holdablePreviews(page)
  const key = await startWriting(page)
  const preview = page.getByRole("region", { name: "Live preview" })
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await expect(previewShows(preview, /Ada Lovelace/i)).toBeVisible()

  // A change is saved while its preview is held on the way to the compiler.
  await holdPreviews(page, true)
  await page.getByLabel("Full name").fill("Ada Byron")
  await expect.poll(savedAt(page, key)).toContain("Ada Byron")

  // Another tab deletes the resume, and the preview that was on its way is built after.
  const other = await context.newPage()
  await other.goto("/")
  const saved = await savedAt(other, key)()
  await other.evaluate((key) => localStorage.removeItem(key), key)
  await expect(page.getByRole("heading", { name: "Resume not found" })).toBeVisible()
  const built = await previewsBuilt(page)
  await holdPreviews(page, false)
  await expect.poll(() => previewsBuilt(page)).toBeGreaterThan(built)

  // It comes back with other words, as when its PDF is opened again in another
  // tab. Until they're built, the preview shows nothing of the deleted resume:
  // a fixed wait, to show nothing of it is drawn.
  await holdPreviews(page, true)
  await other.evaluate(([key, text]) => localStorage.setItem(key, text), [key, saved.replaceAll("Ada Byron", "Grace Hopper")])
  await expect(page.getByLabel("Full name")).toHaveValue("Grace Hopper")
  await expect(preview.getByRole("status", { name: "Loading preview" })).toBeVisible()
  await page.waitForTimeout(2_000)
  await expect(preview.getByText(/Ada/)).toHaveCount(0)
  await holdPreviews(page, false)
  await expect(previewShows(preview, /Grace Hopper/i)).toBeVisible()

  expect(errors).toEqual([])
})

test("two tabs editing different resumes at once keep both edits", async ({ page, context }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  const other = await context.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other.getByRole("button", { name: "New resume" }).click()
  await other.getByLabel("Name", { exact: true }).fill("Second resume")
  await other.getByRole("button", { name: "Create" }).click()
  await expect(other).toHaveURL(/\/create\/new\//)

  await Promise.all([
    page.getByLabel("Full name").pressSequentially("Ada Lovelace", { delay: 20 }),
    other.getByLabel("Full name").pressSequentially("Grace Hopper", { delay: 20 }),
  ])

  // A page opened afterwards finds both.
  const third = await context.newPage()
  await third.goto("/create/dashboard")
  const names = () =>
    third.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith("resume:"))
        .map((key) => JSON.parse(localStorage.getItem(key) ?? "{}").profileSection?.fullName)
        .sort(),
    )
  await expect.poll(names).toEqual(["Ada Lovelace", "Grace Hopper"])

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("an open dialog keeps focus where it is when another tab saves", async ({ page, context }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")
  await page.getByRole("button", { name: "New resume" }).click()
  const dialog = page.getByRole("dialog", { name: "New resume" })
  await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused()
  const create = dialog.getByRole("button", { name: "Create" })
  await create.focus()

  // Another tab saves a resume, so the dashboard behind the dialog shows it.
  const other = await context.newPage()
  await startWriting(other)
  await other.getByLabel("Full name").fill("Grace Hopper")
  await expect(page.getByText(/^1 resume\W+stored in this browser$/i)).toBeVisible()

  await expect(create).toBeFocused()
  expect(errors).toEqual([])
})

test("the browser is asked to keep saved resumes once there is one, and only once a page", async ({ page }) => {
  const errors = pageErrors(page)
  // Counts the requests instead of asking the real browser, and the
  // permission checks, after which the page decides whether to ask.
  await page.addInitScript(() => {
    window.persistRequests = 0
    window.permissionChecks = 0
    Object.defineProperty(navigator, "storage", {
      value: {
        persisted: async () => false,
        persist: async () => {
          window.persistRequests = (window.persistRequests ?? 0) + 1
          return false
        },
      },
    })
    Object.defineProperty(navigator, "permissions", {
      value: {
        query: async () => {
          window.permissionChecks = (window.permissionChecks ?? 0) + 1
          return { state: "prompt" }
        },
      },
    })
  })
  const requests = () => page.evaluate(() => window.persistRequests)
  await page.goto("/create/dashboard")
  await expect(page.getByText("No resumes yet")).toBeVisible()
  expect(await requests()).toBe(0)

  await startWriting(page)
  await expect.poll(requests).toBe(1)
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()
  expect(await requests()).toBe(1)
  // After a no, it waits a week before asking again.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("storage-persist-asked"))).not.toBeNull()
  await page.reload()
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace")
  // Once it has checked, it has decided.
  await expect.poll(() => page.evaluate(() => window.permissionChecks)).toBe(1)
  expect(await requests()).toBe(0)

  expect(errors).toEqual([])
})
