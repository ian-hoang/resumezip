import { expect, test, type Page } from "@playwright/test"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

declare global {
  interface Window {
    /** What the share sheet was handed, in order, noted by a test. */
    shared?: Shared[]
    /** How the share sheet answers the next shares, set by a test: the name of an error, as AbortError for closing it. After these, it shares. */
    shareAnswers?: string[]
    /** How many PDFs with the resume attached, as to share, the compiler has made, counted by a test. */
    attachedPdfs?: number
    /** Set by a test to hold PDFs with the resume attached on their way to the compiler. */
    holdAttached?: boolean
    /** Sends the held PDFs on to the compiler, and stops holding them. */
    releaseAttached?: () => void
  }
}

interface Shared {
  /** What the share sheet was given, as files, text or a title. */
  given: string[]
  name: string
  type: string
  base64: string
  /** Whether it was shared in the press itself, before anything was waited on. */
  inPress: boolean
}

/**
 * Makes the page's browser one that shares PDFs, as phones' browsers do, with
 * a share sheet the test reads and answers (shareAnswers). It also counts the
 * PDFs made with the resume attached, as to share, and can hold them.
 */
async function sharesFiles(page: Page, answers: string[] = []) {
  await page.addInitScript((answers) => {
    window.shared = []
    window.shareAnswers = answers
    window.attachedPdfs = 0
    Object.defineProperty(Navigator.prototype, "canShare", {
      configurable: true,
      value: (data?: ShareData) => !!data?.files?.length && data.files.every((file) => file.type === "application/pdf"),
    })
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        // Read before anything's awaited, while the press that shared is going on, if one is.
        const inPress = window.event?.type === "click"
        const answer = window.shareAnswers!.shift()
        if (answer) throw new DOMException("Not shared", answer)
        const file = data.files![0]
        let binary = ""
        for (const byte of new Uint8Array(await file.arrayBuffer())) binary += String.fromCharCode(byte)
        window.shared!.push({ given: Object.keys(data), name: file.name, type: file.type, base64: btoa(binary), inPress })
      },
    })

    const held: (() => void)[] = []
    window.releaseAttached = () => {
      window.holdAttached = false
      for (const send of held.splice(0)) send()
    }
    const RealWorker = window.Worker
    window.Worker = class extends RealWorker {
      // The PDFs asked for with the resume attached, by their ids.
      private attached = new Set<number>()
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args)
        this.addEventListener("message", (event) => {
          if (event.data?.pdf !== undefined && this.attached.delete(event.data.id)) window.attachedPdfs!++
        })
      }
      postMessage(message: any, options?: any) {
        if (message?.attachment === undefined) return super.postMessage(message, options)
        this.attached.add(message.id)
        if (window.holdAttached) held.push(() => super.postMessage(message, options))
        else super.postMessage(message, options)
      }
    }
  }, answers)
}

/** Starts a resume called "Ada's resume", and waits for its preview, so the compiler is ready. */
async function readyToShare(page: Page) {
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

const sharedSoFar = (page: Page) => page.evaluate(() => window.shared!)
const attachedPdfs = (page: Page) => page.evaluate(() => window.attachedPdfs)

test("Share PDF hands the share sheet the PDF, made as the menu opened, in the press itself, and it opens again elsewhere", async ({
  page,
  browser,
}) => {
  const errors = pageErrors(page)
  await sharesFiles(page)
  await readyToShare(page)

  // Opening the menu starts making the PDF, so it's ready when Share PDF is
  // pressed: Safari only opens the share sheet straight after a press.
  const more = page.getByRole("button", { name: "More formats" })
  const share = page.getByRole("menuitem", { name: /^Share PDF/ })
  await more.click()
  await expect(share).toContainText("Send it to another app")
  await expect.poll(() => attachedPdfs(page)).toBe(1)
  expect(await seriousAccessibilityProblems(page, [".react-pdf__Page"])).toEqual([])
  await share.click()

  // It's the PDF alone, named for the resume, and the keyboard goes back to the ▾.
  await expect(page.getByRole("status").filter({ hasText: "PDF shared" })).toBeAttached()
  const [shared] = await sharedSoFar(page)
  expect(shared).toMatchObject({ given: ["files"], name: "Ada's resume.pdf", type: "application/pdf", inPress: true })
  await expect(more).toBeFocused()

  // It carries the resume, so it opens again in another browser.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  const otherErrors = pageErrors(other)
  await other.goto("/create/dashboard")
  await other
    .locator('input[type="file"]')
    .setInputFiles({ name: shared.name, mimeType: shared.type, buffer: Buffer.from(shared.base64, "base64") })
  await expect(other).toHaveURL(/\/create\/new\//)
  await expect(other.getByLabel("Full name")).toHaveValue("Ada Lovelace")
  await elsewhere.close()

  // Shared again with nothing changed, it's the same PDF, not made again.
  await more.click()
  await share.click()
  await expect.poll(async () => (await sharedSoFar(page)).length).toBe(2)
  expect(await attachedPdfs(page)).toBe(1)

  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test("Share PDF pressed before its PDF is made shows it's being made, then shares it", async ({ page }) => {
  const errors = pageErrors(page)
  await sharesFiles(page)
  await readyToShare(page)

  await page.evaluate(() => (window.holdAttached = true))
  const more = page.getByRole("button", { name: "More formats" })
  await more.click()
  await page.getByRole("menuitem", { name: /^Share PDF/ }).click()
  await expect(more).toHaveAttribute("aria-busy", "true")

  await page.evaluate(() => window.releaseAttached!())
  await expect(page.getByRole("status").filter({ hasText: "PDF shared" })).toBeAttached()
  await expect(more).not.toHaveAttribute("aria-busy")
  expect(await sharedSoFar(page)).toMatchObject([{ name: "Ada's resume.pdf", type: "application/pdf" }])
  expect(errors).toEqual([])
})

test("closing the share sheet says nothing, and a share that fails says so and can be tried again", async ({ page }) => {
  const errors = pageErrors(page)
  await sharesFiles(page, ["AbortError", "NotAllowedError"])
  await readyToShare(page)
  const more = page.getByRole("button", { name: "More formats" })
  const share = page.getByRole("menuitem", { name: /^Share PDF/ })
  const failed = page.getByRole("alert").filter({ hasText: "Share failed" })

  // Closed without sharing, then refused. Had closing it counted, the
  // failure would say it "still" couldn't.
  await more.click()
  await share.click()
  await expect.poll(() => page.evaluate(() => window.shareAnswers!.length)).toBe(1)
  await more.click()
  await share.click()
  await expect(failed.getByRole("paragraph")).toHaveText("Couldn't share your PDF. Try again, or download it instead.")

  // Trying again shares it in the press, as it's made by then.
  await failed.getByRole("button", { name: "Try again" }).click()
  await expect(failed).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "PDF shared" })).toBeAttached()
  expect(await sharedSoFar(page)).toMatchObject([{ name: "Ada's resume.pdf", inPress: true }])

  // Only the failure, logged by the editor.
  expect(errors.filter((error) => !/^Error sharing resume:/.test(error))).toEqual([])
})

// Browsers that can't share files: Firefox can't share at all, and some share links but not files.
const CANT_SHARE_FILES: Record<string, () => void> = {
  "can't share anything": () => {
    delete (Navigator.prototype as any).canShare
    delete (Navigator.prototype as any).share
  },
  "shares links but not files": () => {
    Object.defineProperty(Navigator.prototype, "canShare", { configurable: true, value: (data?: ShareData) => !data?.files?.length })
  },
}

for (const [what, browserThat] of Object.entries(CANT_SHARE_FILES)) {
  test(`a browser that ${what} has no Share PDF`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.addInitScript(browserThat)
    await readyToShare(page)
    await page.getByRole("button", { name: "More formats" }).click()
    await expect(page.getByRole("menuitem", { name: /^JSON/ })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: /^Share PDF/ })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
