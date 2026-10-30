import { expect, test } from "./test"
import { textPdf, wordFile } from "../src/lib/import/testFiles"
import { instantScrolling, openFile, pageErrors, pixelsOf, seriousAccessibilityProblems } from "./helpers"
import { FROM_ELSEWHERE } from "./resumes"

declare global {
  interface Window {
    /** Makes page 2's picture, held back by a test until it calls this. */
    drawPage2?: () => void
  }
}

const pdf = (lines: string[]) => ({ name: "Mara Lin.pdf", mimeType: "application/pdf", buffer: textPdf([lines]) })

test("reviews a resume in the browser, scribbles its notes on the page, and opens it in Check", async ({ page }) => {
  const errors = pageErrors(page)
  // Nothing is sent anywhere but the AI notes' request (its body is checked in aiReview.spec.ts): the review only downloads what it needs.
  const sent: string[] = []
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") sent.push(`${request.method()} ${request.url()}`)
  })

  await page.goto("/review")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Your resume has 7 seconds/)
  await openFile(page.getByRole("button", { name: "Review my resume" }), pdf(FROM_ELSEWHERE))

  // The first review downloads the PDF engine and the grammar checker.
  const verdict = page.getByRole("heading", { level: 1 })
  await expect(verdict).toHaveText(/^ATS checks: (ready|almost there|needs work)$/, { timeout: 90_000 })
  await expect(page.getByRole("img", { name: "Page 1 of your resume, with the notes marked" })).toBeVisible()
  // Pointing at a scribble shows its note, and Esc puts it away.
  const scribble = page.getByRole("button", { name: "“Responsible for” is a weak start" })
  await scribble.hover()
  await expect(page.getByRole("tooltip")).toContainText("Name your own contribution")
  await expect(scribble).toHaveAccessibleDescription(/Name your own contribution/)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("tooltip")).toBeHidden()
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  expect(sent.filter((request) => !request.endsWith("/api/review"))).toEqual([])

  // Fix it in the editor: the resume is added, and opens in Check. Printed in its template there, a PDF
  // from elsewhere can score differently; a file the review prints scores the same (the Word file's test).
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(page.getByRole("tablist", { name: /check or style$/i }).getByRole("tab", { name: "ATS checks" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(page.getByRole("region", { name: "ATS score" }).getByText(/^\d+$/)).toBeVisible()
  expect(errors).toEqual([])
})

test("when the resume can't be drawn, every note is listed under where it would be", async ({ page }) => {
  const errors = pageErrors(page)
  // A browser that can't turn the drawn page into a picture.
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(null)
    }
  })
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), pdf(FROM_ELSEWHERE))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByRole("listitem").filter({ hasText: "“Responsible for” is a weak start" })).toBeVisible()
  await expect(page.getByRole("img", { name: /^Page 1 of your resume/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

// Long enough that its template prints it on two pages: three pages of jobs as it comes in.
const LONG = (() => {
  const jobs = Array.from({ length: 12 }, (_, job) => [
    `Software Engineer, Company ${job + 1}`,
    `Jan ${2010 + job} - Dec ${2010 + job}`,
    ...Array.from(
      { length: 6 },
      (_, bullet) => `- Built service ${bullet + 1} that cut the time to deploy a release for ${job + 2} teams by half`,
    ),
  ])
  const pages = [
    [...FROM_ELSEWHERE.slice(0, 3), ...jobs.slice(0, 4).flat()],
    jobs.slice(4, 8).flat(),
    [...jobs.slice(8).flat(), ...FROM_ELSEWHERE.slice(7)],
  ]
  return { name: "Mara Lin.pdf", mimeType: "application/pdf", buffer: textPdf(pages) }
})()

test("the result opens once page 1 is drawn, and later pages join it as they're drawn", async ({ page }) => {
  const errors = pageErrors(page)
  // Page 2's picture is held until the test lets it be made.
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob
    let drawn = 0
    HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
      if (++drawn !== 2) return toBlob.call(this, callback, type, quality)
      window.drawPage2 = () => toBlob.call(this, callback, type, quality)
    }
  })
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), LONG)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByRole("img", { name: "Page 1 of your resume, with the notes marked" })).toBeVisible()
  await expect(page.getByRole("img", { name: "Page 2 of your resume, with the notes marked" })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => "drawPage2" in window)).toBe(true)
  await page.evaluate(() => window.drawPage2!())
  await expect(page.getByRole("img", { name: "Page 2 of your resume, with the notes marked" })).toBeVisible()
  // The pages scroll in a box one page tall, so page 1 is seen whole, rather than running the page on.
  const pages = page.getByRole("region", { name: "Your resume" })
  const first = page.getByRole("img", { name: "Page 1 of your resume, with the notes marked" })
  const { height, scrolls } = await pages.evaluate((box) => ({ height: box.clientHeight, scrolls: box.scrollHeight > box.clientHeight }))
  expect(Math.abs(height - (await first.boundingBox())!.height)).toBeLessThan(2)
  expect(scrolls).toBe(true)
  expect(errors).toEqual([])
})

test("while page 1 flies into the result, what's under it waits, rather than showing below the box", async ({ page }) => {
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), LONG)
  const pages = page.getByRole("region", { name: "Your resume" })
  // The box lets page 1 fly in from above it, unclipped, for the length of its flight.
  await page.locator("[data-flying]").waitFor({ state: "attached", timeout: 90_000 })
  const during = await pages.evaluate((box) => [...box.children].slice(1).map((child) => getComputedStyle(child).visibility))
  expect(during.length).toBeGreaterThan(0)
  expect(during.every((visibility) => visibility === "hidden")).toBe(true)
  // Landed, the box clips and scrolls again, and page 2 is under page 1.
  await expect(page.locator("[data-flying]")).toHaveCount(0)
  await expect(pages).toHaveCSS("overflow-y", "auto")
  await expect(page.getByRole("img", { name: "Page 2 of your resume, with the notes marked" })).toBeAttached()
  await expect(page.getByRole("img", { name: "Page 2 of your resume, with the notes marked" })).toHaveCSS("visibility", "visible")
})

test("a page that can't be drawn after page 1 leaves page 1 shown, with its own notes listed under it", async ({ page }) => {
  const errors = pageErrors(page)
  // Page 2's picture can't be made.
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob
    let drawn = 0
    HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
      if (++drawn === 2) return callback(null)
      return toBlob.call(this, callback, type, quality)
    }
  })
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), LONG)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByText("Notes on your resume")).toBeVisible()
  await expect(page.getByRole("img", { name: "Page 1 of your resume, with the notes marked" })).toBeVisible()
  await expect(page.getByRole("img", { name: "Page 2 of your resume, with the notes marked" })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("a PDF from elsewhere is reviewed as it is: its own pages, not a reprint of them", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), LONG)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  // It came on three pages; its template would print it on two.
  await expect(page.getByRole("img", { name: "Page 3 of your resume, with the notes marked" })).toBeVisible()
  await expect(page.getByText(/so this is how it prints in/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test("a Word file, which has no pages of its own, is printed in Jake's to be reviewed, says so, and scores the same in Check", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), {
    name: "Mara Lin.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: wordFile(FROM_ELSEWHERE),
  })
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByText("A Word file has no pages of its own, so this is how it prints in Jake's.")).toBeVisible()
  await expect(page.getByRole("img", { name: "Page 1 of your resume, with the notes marked" })).toBeVisible()
  const reviewed = (await page.getByText(/^\d+\/100$/).innerText()).replace("/100", "")
  await page.getByRole("button", { name: "Fix it in the editor" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  await expect(page.getByRole("region", { name: "ATS score" }).getByText(/^\d+$/)).toHaveText(reviewed)
  expect(errors).toEqual([])
})

test("a PDF that turns its own pages is printed in Jake's to be reviewed, as its marks couldn't land on them, and says so", async ({
  page,
}) => {
  const errors = pageErrors(page)
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), {
    name: "Mara Lin.pdf",
    mimeType: "application/pdf",
    buffer: textPdf([FROM_ELSEWHERE], { rotate: 90 }),
  })
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^ATS checks:/, { timeout: 90_000 })
  await expect(page.getByText("This PDF turns its pages, which can’t be marked, so this is how it prints in Jake's.")).toBeVisible()
  await expect(page.getByRole("img", { name: "Page 1 of your resume, with the notes marked" })).toBeVisible()
  expect(errors).toEqual([])
})

test("a file with no resume in it says so, and another can be tried", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/review")
  await openFile(page.getByRole("button", { name: "Review my resume" }), pdf(["Groceries", "Eggs", "Milk", "Bread"]))
  await expect(
    page.getByRole("alert").filter({ hasText: "There’s no name and no section in this file to check. Is it a resume?" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Try another file" })).toBeVisible()
  expect(errors).toEqual([])
})

test("the headline is in the home page's headline face", async ({ page }) => {
  const errors = pageErrors(page)
  const face = async (path: string) => {
    await page.goto(path)
    return page.getByRole("heading", { level: 1 }).evaluate((heading) => getComputedStyle(heading).fontFamily.split(",")[0])
  }
  const home = await face("/")
  expect(home).toMatch(/Instrument Serif/)
  expect(await face("/review")).toBe(home)
  expect(errors).toEqual([])
})

test("the sky is asked for with the page, and a soft copy of it shows until it arrives", async ({ page }) => {
  const errors = pageErrors(page)
  let arrive = () => {}
  const arrived = new Promise<void>((resolve) => (arrive = resolve))
  await page.route("**/backgrounds/sky-*.webp", async (route) => {
    await arrived
    await route.continue()
  })
  // Not waiting for the page's load, which waits for the picture.
  await page.goto("/review", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  // While the picture's on its way, the sky under it is the inlined copy, not a flat color.
  expect(await page.getByRole("main").evaluate((main) => getComputedStyle(main.parentElement!).backgroundImage)).toContain(
    "data:image/webp",
  )
  arrive()
  // Asked for by the page's head, rather than once the stylesheet's been read.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).find((entry) =>
            /\/backgrounds\/sky-(wide|tall)\.webp$/.test(entry.name),
          )?.initiatorType,
      ),
    )
    .toBe("link")
  expect(errors).toEqual([])
})

test("the page's fog runs on into the footer, with no strip of sky between them", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/review")
  // The page scrolls smoothly: measured mid-glide, the footer would move between its box and the picture.
  await instantScrolling(page)
  // How much bluer than red the bluest pixel is, down a column clear of the words and the footer's
  // rounded corners, from above the footer into its lift.
  const bluest = async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const footer = (await page.getByRole("contentinfo").boundingBox())!
    // In CSS pixels, so the column's where the footer is on WebKit's double-density screen too.
    const shot = await page.screenshot({ scale: "css" })
    const from = Math.round(footer.y - 80)
    const { data } = await pixelsOf(page, shot, { x: 200, y: from, width: 1, height: Math.round(footer.y + 16) - from })
    let most = 0
    for (let i = 0; i < data.length; i += 4) most = Math.max(most, data[i + 2] - data[i])
    return most
  }
  // The fog is a white with a faint cool tint (blue at most 12 above red, where WebKit's tests draw it
  // without its blur); the sky is 90 or more. Measured again while the page is still settling (its
  // headline's face arriving can move the footer between its box and the picture): a strip of sky
  // stays blue however often it's measured.
  await expect.poll(bluest).toBeLessThan(30)
  expect(errors).toEqual([])
})
