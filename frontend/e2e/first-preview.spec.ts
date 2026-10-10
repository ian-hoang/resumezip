import { expect, test, type Page } from "@playwright/test"
import { chooseTemplate, pageErrors } from "./helpers"

// The first preview waits for the PDF compiler to download. A stand-in page
// shows meanwhile (components/editor/PrintingPage.tsx), and the dashboard
// starts the download before the editor opens (lib/typst/compile.ts), as do
// the home page on a computer (components/home/PrefetchCompiler.tsx) and
// reaching for "Start writing" (components/site/StartWriting.tsx).

const resume = {
  id: "first-preview",
  resumeTitle: "First preview",
  resumeTag: "personal",
  updatedAt: "2026-10-06T12:00:00.000Z",
  selectedTemplate: "jake",
  profileSection: { fullName: "Ada Lovelace" },
}

/** Saves a resume in the browser before the page loads, as an earlier visit would have. */
const saveResume = (page: Page, saved: { id: string } & Record<string, unknown> = resume) =>
  page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: `resume:${saved.id}`, value: JSON.stringify(saved) },
  )

/** The compiler workers the page starts, noted as they start. (The preview's pdf.js has a worker too.) */
function compilerWorkers(page: Page): string[] {
  const urls: string[] = []
  page.on("worker", (worker) => {
    if (!worker.url().includes("pdf.worker")) urls.push(worker.url())
  })
  return urls
}

// Text in the code of react-pdf, which draws the preview, and of the drag and
// drop for sections, to tell their scripts from the rest of the app's.
const REACT_PDF = "react-pdf__Document"
const DRAG_AND_DROP = "Press space bar to start a drag"

test("the editor shows a stand-in page until the first preview, and downloads only the app's fonts", async ({ page }) => {
  const errors = pageErrors(page)
  const requested: string[] = []
  page.on("request", (request) => requested.push(request.url()))
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()

  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByRole("status", { name: "Loading preview" })).toBeVisible()
  await expect(preview.locator("canvas")).toBeVisible()
  await expect(preview.getByRole("status", { name: "Loading preview" })).toHaveCount(0)
  // Typst's own fonts, from its CDN, aren't used by any template.
  expect(requested.filter((url) => url.includes("typst-assets"))).toEqual([])
  expect(errors).toEqual([])
})

test("a resume downloads only its template's fonts, and another template's once it's chosen", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The page sees its workers' requests in Chromium")
  const errors = pageErrors(page)
  // The fonts the compiler downloads, by file name without the hash the app serves them under.
  const fonts: string[] = []
  page.on("request", (request) => {
    const font = request.url().match(/\/([\w-]+)\.[0-9a-f]+\.(otf|ttf)$/)
    if (font) fonts.push(font[1])
  })
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await page.getByLabel("Full name").fill("Ada Lovelace")
  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByText(/Ada Lovelace/i).first()).toBeVisible()
  // Jake's, the default, is set in New Computer Modern.
  expect([...fonts].sort()).toEqual(["NewCM10-Bold", "NewCM10-BoldItalic", "NewCM10-Italic", "NewCM10-Regular"])
  // The page as drawn, to tell when another template's has replaced it.
  const drawn = () =>
    preview
      .locator("canvas")
      .first()
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
  const jakes = await drawn()

  // Harvard is set in EB Garamond.
  // On wide screens the templates are in the left panel's Style tab.
  await page.getByRole("tab", { name: "Style" }).click()
  await chooseTemplate(page, "Harvard")
  await expect.poll(() => fonts.filter((font) => font.startsWith("EBGaramond")).length).toBe(4)
  await expect.poll(drawn).not.toBe(jakes)
  await expect(preview.getByText(/Ada Lovelace/i).first()).toBeVisible()
  await expect(page.getByText(/Couldn.t update the preview/)).toHaveCount(0)
  expect(fonts.filter((font) => !/^(NewCM10|EBGaramond)-/.test(font))).toEqual([])
  expect(errors).toEqual([])
})

test("the dashboard starts the compiler, and the editor uses the same one", async ({ page, browserName }) => {
  const errors = pageErrors(page)
  await saveResume(page)
  const workers = compilerWorkers(page)
  const downloads: string[] = []
  page.on("request", (request) => {
    if (request.url().endsWith(".wasm")) downloads.push(request.url())
  })
  // The download itself is checked in Chromium, where the page sees its workers' requests.
  const seesDownloads = browserName === "chromium"
  await page.goto("/create/dashboard")
  await expect.poll(() => workers.length).toBe(1)
  if (seesDownloads) await expect.poll(() => downloads.length).toBeGreaterThan(0)
  const downloadedAhead = downloads.length

  await page.getByRole("link", { name: resume.resumeTitle }).first().click()
  await expect(page.getByRole("region", { name: "Live preview" }).locator("canvas")).toBeVisible()
  expect(workers).toHaveLength(1)
  // The editor doesn't download the compiler again.
  expect(downloads).toHaveLength(downloadedAhead)
  expect(errors).toEqual([])
})

test("on a computer, the home page downloads the compiler once it has settled, and the editor builds it from that", async ({
  page,
  browserName,
}) => {
  const errors = pageErrors(page)
  const workers = compilerWorkers(page)
  const downloads: string[] = []
  page.on("request", (request) => {
    if (request.url().endsWith(".wasm")) downloads.push(request.url())
  })
  await page.goto("/")
  await expect.poll(() => workers.length).toBe(1)
  // The download itself is checked in Chromium, where the page sees its workers' requests.
  if (browserName === "chromium") await expect.poll(() => downloads.length).toBe(1)
  const downloadedAhead = downloads.length

  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page.getByRole("region", { name: "Live preview" }).locator("canvas")).toBeVisible()
  expect(workers).toHaveLength(1)
  // The editor doesn't download the compiler again.
  expect(downloads).toHaveLength(downloadedAhead)
  expect(errors).toEqual([])
})

test("if the home page's download of the compiler fails, the editor uses the app's own copy without trying jsDelivr again", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "The page sees its workers' requests in Chromium")
  const errors = pageErrors(page)
  const fromJsDelivr: string[] = []
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/.*\.wasm$/, (route) => {
    fromJsDelivr.push(route.request().url())
    return route.abort()
  })
  await page.goto("/")
  await expect.poll(() => fromJsDelivr.length).toBe(1)

  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page.getByRole("region", { name: "Live preview" }).locator("canvas")).toBeVisible()
  expect(fromJsDelivr).toHaveLength(1)
  expect(errors).toEqual([])
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("reading the home page doesn't download the compiler", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Checked in Chromium, whose touch emulation gives the page a phone's coarse pointer")
    const workers = compilerWorkers(page)
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Start writing" }).first()).toBeVisible()
    await page.waitForTimeout(2_000)
    expect(workers).toEqual([])
  })
})

test("a mouse resting on Start writing starts the editor's downloads before the click, and looking over the templates' pictures doesn't", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "The page sees its workers' requests in Chromium")
  const errors = pageErrors(page)
  // The fonts of the template to print, which only come once someone starts
  // writing: the home page's own download is of the compiler alone.
  const fonts: string[] = []
  page.on("request", (request) => {
    if (/\.(otf|ttf)$/.test(request.url())) fonts.push(request.url())
  })
  await page.goto("/")
  const pictures = page.getByRole("region", { name: "Templates" }).getByRole("link", { name: / template/ })
  for (const picture of await pictures.all()) await picture.hover()
  await page.waitForTimeout(1_500)
  expect(fonts).toEqual([])

  const startWriting = page.getByRole("link", { name: "Start writing" }).first()
  await startWriting.hover()
  await expect.poll(() => fonts.length).toBeGreaterThan(0)
  await startWriting.click()
  await expect(page.getByRole("region", { name: "Live preview" }).locator("canvas")).toBeVisible()
  expect(errors).toEqual([])
})

test("pressing a template's picture starts the compiler before the click", async ({ page }) => {
  const errors = pageErrors(page)
  const workers = compilerWorkers(page)
  await page.goto("/templates")
  await page.getByRole("link", { name: /^Harvard template/ }).hover()
  await page.waitForTimeout(500)
  expect(workers).toEqual([])

  await page.mouse.down()
  await expect.poll(() => workers.length).toBe(1)
  await page.mouse.up()
  await expect(page.getByRole("region", { name: "Live preview" }).locator("canvas")).toBeVisible()
  expect(workers).toHaveLength(1)
  expect(errors).toEqual([])
})

test("pdf.js's worker downloads while the first preview is still being made", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The page sees its workers' requests in Chromium")
  const errors = pageErrors(page)
  await saveResume(page)
  // The fonts are held back, so the first PDF can't be made yet.
  let releaseFonts = () => {}
  const fontsHeld = new Promise<void>((resolve) => (releaseFonts = resolve))
  await page.route(/\.(otf|ttf)$/, async (route) => {
    await fontsHeld
    await route.continue()
  })
  const requested: string[] = []
  page.on("request", (request) => requested.push(request.url()))
  await page.goto(`/create/new/${resume.id}`)

  const preview = page.getByRole("region", { name: "Live preview" })
  await expect.poll(() => requested.some((url) => url.includes("pdf.worker"))).toBe(true)
  await expect(preview.getByRole("status", { name: "Loading preview" })).toBeVisible()
  releaseFonts()
  await expect(preview.locator("canvas")).toBeVisible()
  expect(errors).toEqual([])
})

test("the form can be used before the code that draws the preview and drags sections has downloaded", async ({ page }) => {
  const errors = pageErrors(page)
  await saveResume(page)
  // The page's first download is what its HTML names. Everything after it,
  // scripts, styles and fonts alike, is held back until it's released.
  const firstDownload = new Set<string>()
  await page.route(/\/create\/new\//, async (route) => {
    const response = await route.fetch()
    for (const [file] of (await response.text()).matchAll(/static\/[\w/.-]+/g)) firstDownload.add(file)
    await route.fulfill({ response })
  })
  let release = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  const held = new Set<string>()
  await page.route(/\/_next\/static\//, async (route) => {
    if (firstDownload.has(new URL(route.request().url()).pathname.replace("/_next/", ""))) return route.continue()
    const response = await route.fetch()
    const code = await response.text()
    for (const mark of [REACT_PDF, DRAG_AND_DROP]) if (code.includes(mark)) held.add(mark)
    await released
    await route.fulfill({ response })
  })
  await page.goto(`/create/new/${resume.id}`)

  // Both are asked for as soon as the editor opens, before either is needed.
  await expect.poll(() => [...held].sort()).toEqual([DRAG_AND_DROP, REACT_PDF].sort())
  // Key by key, as each key is a render: while styles that came after the
  // page were downloading, React held renders back and the field lost each key.
  const name = page.getByLabel("Full name")
  await name.clear()
  await name.pressSequentially("Grace Hopper")
  await expect(name).toHaveValue("Grace Hopper")
  const sections = page.getByRole("navigation", { name: "Sections" })
  const experience = sections.getByRole("button", { name: /^\d+ Experience$/ })
  await experience.click()
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible()
  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByRole("status", { name: "Loading preview" })).toBeVisible()
  await expect(sections.getByRole("button", { name: "Reorder Experience" })).toHaveCount(0)

  // The sections are put back as draggable ones, and the one with the focus keeps it.
  await experience.focus()
  release()
  await expect(sections.getByRole("button", { name: "Reorder Experience" })).toBeVisible()
  await expect(experience).toBeFocused()
  await expect(preview.getByText(/Grace Hopper/i).first()).toBeVisible()
  expect(errors).toEqual([])
})

test("an entry being typed in when the drag and drop arrives keeps the cursor, and can be dragged once it's left", async ({ page }) => {
  const errors = pageErrors(page)
  await saveResume(page, { ...resume, workExperienceSection: [{ id: 1, workRole: "Engineer", companyName: "Google" }] })
  // Only the drag and drop is held back, until it's released.
  let release = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  let held = false
  await page.route(/\/_next\/static\/chunks\//, async (route) => {
    const response = await route.fetch()
    if ((await response.text()).includes(DRAG_AND_DROP)) {
      held = true
      await released
    }
    await route.fulfill({ response })
  })
  await page.goto(`/create/new/${resume.id}`)
  await expect.poll(() => held).toBe(true)
  const sections = page.getByRole("navigation", { name: "Sections" })
  await sections.getByRole("button", { name: /^\d+ Experience$/ }).click()

  // It arrives while the cursor is in the open entry, which stays as it is, cursor and all.
  const role = page.getByLabel("Role", { exact: true })
  await role.click()
  await page.keyboard.press("End")
  await page.keyboard.type(" II")
  release()
  await expect(sections.getByRole("button", { name: "Reorder Experience" })).toBeVisible()
  await page.keyboard.type("I")
  await expect(role).toBeFocused()
  await expect(role).toHaveValue("Engineer III")
  await expect(page.getByRole("button", { name: "Reorder entry 1" })).toHaveCount(0)

  // Once the cursor has left the entries, they can be dragged.
  await page.getByRole("heading", { name: "Experience" }).click()
  await expect(page.getByRole("button", { name: "Reorder entry 1" })).toBeVisible()
  expect(errors).toEqual([])
})

test("if the code that draws the preview fails to download, the next PDF tries it again", async ({ page }) => {
  const errors = pageErrors(page)
  await saveResume(page)
  let failed = false
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (failed) return route.continue()
    const response = await route.fetch()
    if ((await response.text()).includes(REACT_PDF)) {
      failed = true
      return route.abort("internetdisconnected")
    }
    return route.fulfill({ response })
  })
  await page.goto(`/create/new/${resume.id}`)
  await expect.poll(() => failed).toBe(true)

  // Whether the first PDF came before the failure or is still to come, a PDF comes after it.
  await page.getByLabel("Full name").fill("Grace Hopper")
  const preview = page.getByRole("region", { name: "Live preview" })
  await expect(preview.getByText(/Grace Hopper/i).first()).toBeVisible()
  // Only the failed download, which the browser logs.
  expect(errors.filter((error) => !/^Failed to load resource/.test(error))).toEqual([])
})

test("visitors saving data don't download the compiler ahead, on the home page or the dashboard", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true, effectiveType: "4g" } })
  })
  const workers = compilerWorkers(page)
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().hover()
  await page.waitForTimeout(1_000)
  expect(workers).toEqual([])

  await saveResume(page)
  await page.goto("/create/dashboard")
  await expect(page.getByRole("link", { name: resume.resumeTitle }).first()).toBeVisible()
  await page.waitForTimeout(3_000)
  expect(workers).toEqual([])

  // Opening a resume still makes its preview.
  await page.getByRole("link", { name: resume.resumeTitle }).first().click()
  await expect(page.getByRole("region", { name: "Live preview" }).locator("canvas")).toBeVisible()
})
