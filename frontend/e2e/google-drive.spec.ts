import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// Save to Google Drive. Google's sign-in and Drive are stood in for, so these
// tests never call them: the sign-in sends its window straight back with an
// answer, as Google does once the person agrees, and Drive answers uploads.

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const PDF_PART = "Content-Type: application/pdf\r\n\r\n"

declare global {
  interface Window {
    /** What the editor handed fetch for each upload to Drive, noted by a test: its Content-Type, and its body as base64. */
    sentToDrive?: { type: string; body: string }[]
  }
}

/**
 * Stands in for Google. Each sign-in takes the next of `signIns` (a token, or
 * declined), and each upload the next of `uploads` (Drive's answer's status);
 * after them, it signs in and saves. Returns what Google was asked (each
 * upload's Authorization header), and lets a test hold Drive's answers back
 * until it's ready.
 */
async function fakeGoogle(context: BrowserContext, { signIns = [], uploads = [] }: { signIns?: "declined"[]; uploads?: number[] } = {}) {
  let held: Promise<void> = Promise.resolve()
  let release = () => {}
  const asked = {
    signIns: [] as URL[],
    uploads: [] as string[],
    hold: () => {
      held = new Promise((resolve) => (release = resolve))
    },
    release: () => release(),
  }
  // WebKit doesn't give a test the body of a request sent as a Blob, so each
  // upload's is read in the page, as it's handed to fetch (sentToDrive).
  await context.addInitScript((upload) => {
    window.sentToDrive = []
    const send = window.fetch
    window.fetch = async (input, init) => {
      if (String(input).startsWith(upload) && init?.body instanceof Blob) {
        let binary = ""
        for (const byte of new Uint8Array(await init.body.arrayBuffer())) binary += String.fromCharCode(byte)
        window.sentToDrive!.push({ type: new Headers(init.headers).get("content-type")!, body: btoa(binary) })
      }
      return send(input, init)
    }
  }, UPLOAD)
  await context.route(`${AUTH}**`, (route) => {
    const url = new URL(route.request().url())
    asked.signIns.push(url)
    const state = url.searchParams.get("state")!
    const answer =
      signIns.shift() === "declined"
        ? new URLSearchParams({ error: "access_denied", state })
        : new URLSearchParams({
            access_token: `token-${asked.signIns.length}`,
            token_type: "Bearer",
            expires_in: "3599",
            scope: DRIVE_FILE_SCOPE,
            state,
          })
    const back = `${url.searchParams.get("redirect_uri")}#${answer}`
    return route.fulfill({ contentType: "text/html", body: `<script>location.replace(${JSON.stringify(back)})</script>` })
  })
  await context.route(`${UPLOAD}**`, async (route) => {
    const request = route.request()
    const cors = { "access-control-allow-origin": "*" }
    // The upload's Authorization header makes the browser ask first.
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { ...cors, "access-control-allow-methods": "POST", "access-control-allow-headers": "authorization, content-type" },
      })
    }
    asked.uploads.push(request.headers()["authorization"])
    await held
    const status = uploads.shift() ?? 200
    const id = `file-${asked.uploads.length}`
    return route.fulfill({
      status,
      headers: cors,
      json: status === 200 ? { id, webViewLink: `https://drive.google.com/file/d/${id}/view` } : { error: { code: status, errors: [] } },
    })
  })
  return asked
}

/** The PDFs the editor sent Drive, in order, with the names sent with them. */
async function sentToDrive(page: Page): Promise<{ name: string; pdf: Buffer }[]> {
  const sent = await page.evaluate(() => window.sentToDrive!)
  return sent.map(({ type, body }) => {
    const boundary = type.match(/boundary=(\S+)/)![1]
    const bytes = Buffer.from(body, "base64")
    const text = bytes.toString("latin1")
    const metadata = text.indexOf("\r\n\r\n") + 4
    const pdf = text.indexOf(PDF_PART) + PDF_PART.length
    return {
      name: JSON.parse(text.slice(metadata, text.indexOf("\r\n", metadata))).name,
      pdf: bytes.subarray(pdf, text.lastIndexOf(`\r\n--${boundary}--`)),
    }
  })
}

/** Starts a resume called "Ada's resume", and waits for its preview, so the compiler is ready. */
async function readyToSave(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await page.getByLabel("Resume name").fill("Ada's resume")
  await page.getByLabel("Full name").fill("Ada Lovelace")
  await expect(
    page
      .getByRole("region", { name: "Live preview" })
      .getByText(/Ada Lovelace/i)
      .first(),
  ).toBeVisible()
}

/** Presses Save to Google Drive, in the ▾ menu. */
async function saveToDrive(page: Page) {
  await page.getByRole("button", { name: "More formats" }).click()
  await page.getByRole("menuitem", { name: /^Save to Google Drive/ }).click()
}

/** Presses Save to Google Drive, and waits for Google's window to come back and close. */
async function saveSigningIn(page: Page, press = () => saveToDrive(page)) {
  const popup = page.waitForEvent("popup")
  await press()
  const window = await popup
  await window.waitForEvent("close")
}

// The failures a test asks for: logged by the editor, and by the browser as Drive answers.
const EXPECTED_FAILURE = /^(Error saving resume to Google Drive:|Failed to load resource: .* \(at https:\/\/www\.googleapis\.com\/upload\/)/

/** The card under the ▾ that says the PDF is in Drive. */
const savedCard = (page: Page) => page.getByRole("group", { name: "Saved to Google Drive" })

test("Save to Google Drive signs in with Google in a window of its own, then puts the PDF in Drive, and nothing goes to Google before", async ({
  page,
  context,
  browser,
}) => {
  const errors = pageErrors(page)
  const asked = await fakeGoogle(context)
  const toGoogle: string[] = []
  context.on("request", (request) => {
    if (/(^|\.)google(apis)?\.com$/.test(new URL(request.url()).hostname)) toGoogle.push(request.url())
  })
  await readyToSave(page)

  // Opening the menu sends Google nothing.
  await page.getByRole("button", { name: "More formats" }).click()
  await expect(page.getByRole("menuitem", { name: /^Save to Google Drive/ })).toContainText(
    "Puts the PDF in your Drive. Google asks you first.",
  )
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  await page.keyboard.press("Escape")
  expect(toGoogle).toEqual([])

  // As soon as Google's window closes, the card under the ▾ says it's saving.
  asked.hold()
  await saveSigningIn(page)
  await expect(page.getByRole("group", { name: "Saving to Google Drive…" })).toBeVisible()
  asked.release()
  const [signIn] = asked.signIns
  expect(signIn.searchParams.get("redirect_uri")).toBe(new URL("/google-drive", page.url()).href)
  expect(signIn.searchParams.get("response_type")).toBe("token")
  expect(signIn.searchParams.get("scope")).toBe(DRIVE_FILE_SCOPE)

  // Drive gets the PDF under the resume's name, with the token alone, and the card says so.
  const saved = savedCard(page)
  await expect(saved).toContainText("Ada's resume.pdf")
  await expect(saved.getByRole("link", { name: "Open it in Google Drive" })).toHaveAttribute(
    "href",
    "https://drive.google.com/file/d/file-1/view",
  )
  await expect(page.getByRole("status").filter({ hasText: "PDF saved to Google Drive" })).toBeAttached()
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  expect(asked.uploads).toEqual(["Bearer token-1"])
  const [upload] = await sentToDrive(page)
  expect(upload.name).toBe("Ada's resume.pdf")

  // It carries the resume, so it opens again in another browser.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other.locator('input[type="file"]').setInputFiles({ name: upload.name, mimeType: "application/pdf", buffer: upload.pdf })
  await expect(other).toHaveURL(/\/create\/new\//)
  await expect(other.getByLabel("Full name")).toHaveValue("Ada Lovelace")
  await elsewhere.close()

  // Saved again, it goes straight to Drive with the same token, as a new file.
  let opened = false
  page.on("popup", () => (opened = true))
  await saveToDrive(page)
  await expect(saved.getByRole("link", { name: "Open it in Google Drive" })).toHaveAttribute(
    "href",
    "https://drive.google.com/file/d/file-2/view",
  )
  expect(asked.uploads).toEqual(["Bearer token-1", "Bearer token-1"])
  expect(opened).toBe(false)

  // × closes the card, and the keyboard goes back to the ▾.
  await saved.getByRole("button", { name: "Close" }).click()
  await expect(saved).toHaveCount(0)
  await expect(page.getByRole("button", { name: "More formats" })).toBeFocused()

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("declining in Google's window says nothing, and a blocked window or a failed upload says so and can be tried again", async ({
  page,
  context,
}) => {
  const errors = pageErrors(page)
  const asked = await fakeGoogle(context, { signIns: ["declined"], uploads: [500] })
  await readyToSave(page)
  const failed = page.getByRole("alert").filter({ hasText: "Save to Drive failed" })

  // Declined: nothing's uploaded, and nothing's said.
  await saveSigningIn(page)
  // A fixed wait, to show nothing comes of it.
  await page.waitForTimeout(500)
  expect(asked.uploads).toEqual([])
  await expect(failed).toHaveCount(0)
  await expect(page.getByRole("group", { name: /Google Drive/ })).toHaveCount(0)

  // The browser blocks Google's window.
  await page.evaluate(() => {
    const open = window.open
    window.open = () => {
      window.open = open
      return null
    }
  })
  await saveToDrive(page)
  await expect(failed.getByRole("paragraph")).toHaveText(
    "Couldn't save your PDF to Google Drive. Your browser blocked Google's sign-in window. Allow pop-ups for this site, then try again.",
  )

  // Trying again signs in, and Drive fails.
  await saveSigningIn(page, () => failed.getByRole("button", { name: "Try again" }).click())
  await expect(failed.getByRole("paragraph")).toHaveText("Still couldn't save your PDF to Google Drive. Try again, or download it instead.")

  // Signed in already, trying again goes straight to Drive.
  await failed.getByRole("button", { name: "Try again" }).click()
  await expect(failed).toHaveCount(0)
  await expect(savedCard(page)).toBeVisible()
  expect(asked.signIns).toHaveLength(2)
  expect(asked.uploads).toHaveLength(2)

  // With the pointer elsewhere, the card goes by itself after a few seconds.
  await page.mouse.move(5, 700)
  await expect(savedCard(page)).toHaveCount(0)

  expect(errors.filter((error) => !EXPECTED_FAILURE.test(error))).toEqual([])
})

test("a token Drive refuses is dropped, so trying again signs in again", async ({ page, context }) => {
  const errors = pageErrors(page)
  const asked = await fakeGoogle(context, { uploads: [401] })
  await readyToSave(page)
  const failed = page.getByRole("alert").filter({ hasText: "Save to Drive failed" })

  await saveSigningIn(page)
  await expect(failed.getByRole("paragraph")).toHaveText(
    "Couldn't save your PDF to Google Drive. Try again, and sign in to Google once more.",
  )

  await saveSigningIn(page, () => failed.getByRole("button", { name: "Try again" }).click())
  await expect(savedCard(page)).toBeVisible()
  expect(asked.uploads).toEqual(["Bearer token-1", "Bearer token-2"])

  expect(errors.filter((error) => !EXPECTED_FAILURE.test(error))).toEqual([])
})

test("pressing again as a save starts, before the editor says it's saving, doesn't save twice", async ({ page, context }) => {
  const errors = pageErrors(page)
  const asked = await fakeGoogle(context, { uploads: [401] })
  await readyToSave(page)
  const failed = page.getByRole("alert").filter({ hasText: "Save to Drive failed" })
  await saveSigningIn(page)
  await expect(failed).toBeVisible()

  // Presses Try again the moment Google's answer reaches the page: after the
  // editor takes it, but before it has re-rendered to say it's saving, which
  // a press can only do from inside the page.
  await page.evaluate(() => {
    new BroadcastChannel("google-drive").onmessage = () => {
      const buttons = document.querySelectorAll<HTMLButtonElement>('[role="alert"] button')
      ;[...buttons].find((button) => button.textContent?.includes("Try again"))?.click()
    }
  })
  await saveSigningIn(page, () => failed.getByRole("button", { name: "Try again" }).click())
  await expect(savedCard(page)).toBeVisible()
  expect(asked.uploads).toEqual(["Bearer token-1", "Bearer token-2"])

  expect(errors.filter((error) => !EXPECTED_FAILURE.test(error))).toEqual([])
})
