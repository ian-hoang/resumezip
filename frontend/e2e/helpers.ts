import { readFile } from "node:fs/promises"
import AxeBuilder from "@axe-core/playwright"
import { expect, type Download, type FileChooser, type Locator, type Page } from "@playwright/test"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

declare global {
  interface Window {
    /** Set on the open page by a test. A link that loads a new page loses it; one the app opens in the page keeps it. */
    marked?: boolean
    /** How many PDFs the compiler's worker has sent back, counted by holdablePreviews. */
    previewsBuilt?: number
    /** Holds resumes on their way to the compiler, or sends the held ones on (holdablePreviews). */
    holdPreviews?: (hold: boolean) => void
  }
}

// Safari logs these when a page is left while something is still loading in
// the background, and the visitor never sees them: the PDF compiler, its
// fonts and pdf.js's worker, which the home page, dashboard and editor start
// early, the scripts the compiler's worker loads as it starts, the PDF a
// preview or page picture is reading from its blob: URL, and the pages
// behind a page's links, which Next.js fetches ahead. They're only left out
// while the page is being left, so a load that fails on a page that stays
// open counts.
const CUT_SHORT = [
  /^Fetch API cannot load \S+\.(wasm|otf|ttf|mjs) due to access control checks\.$/,
  /^Cannot load (\S+\.m?js|blob:\S+) due to access control checks\.$/,
  // pdf.js reads the PDF at a blob: URL with an XMLHttpRequest, whose load
  // Safari words its own way.
  /^XMLHttpRequest cannot load blob:\S+ due to access control checks\.$/,
  /^Failed to fetch RSC payload for \S+\. Falling back to browser navigation\. TypeError: Load failed$/,
  // What pdf.js (4.8) throws after those: its worker cut short, it tries
  // to load the worker's code on the page instead, which is cut short too...
  /^Error: Setting up fake worker failed: "Importing a module script failed\."\.$/,
  // ...and a PDF's request cut short ends with no status and no headers,
  // which it reads into a Headers object, one with an empty name.
  /^Invalid header name: ''$/,
  /^UnexpectedResponseException: Unexpected server response \(0\) while retrieving PDF "blob:\S+"\.$/,
]
// Safari can report a load cut short just before the request for the next page.
const BEFORE_LEAVING_MS = 500

/** Whether `text`, an error as Safari words it, is a load cut short by leaving the page. */
export const cutShort = (text: string) => CUT_SHORT.some((pattern) => pattern.test(text))

// What the Content-Security-Policy logs for what it refuses.
const REFUSED = /^Refused to /

// Safari sometimes reports a load cut short as an error thrown by the page
// rather than logging it. Playwright splits a thrown error's text at its first
// colon, here the one in "http://", into a name ("Cannot load http") and a
// message ("/localhost:…"), dropping the character after the colon: "/", or
// "h" in "blob:http://". Put back together, it reads as it does when it's logged.
export const thrownText = (error: Error) => {
  if (/ https?$/.test(error.name)) return `${error.name}:/${error.message}`
  if (/ blob$/.test(error.name)) return `${error.name}:h${error.message}`
  return error.message
}

/**
 * Collects the errors a page throws or logs, and what its Content-Security-Policy
 * (next.config.js) refused, its workers' included, for a test to check at the
 * end. Logged errors end with where they came from, e.g. "… (at http://…/page)".
 */
export function pageErrors(page: Page): string[] {
  const errors: string[] = []
  // A page is being left from the request for the next one until that one's
  // DOMContentLoaded. The first page loaded leaves nothing.
  let loaded = page.url() !== "about:blank"
  let leaving = false
  // Loads cut short while the page wasn't being left, in case it's left just after.
  let recent: { entry: string; at: number }[] = []
  page.on("request", (request) => {
    if (!loaded || !request.isNavigationRequest() || request.frame() !== page.mainFrame()) return
    leaving = true
    const now = Date.now()
    for (const { entry, at } of recent) {
      const index = errors.indexOf(entry)
      if (now - at <= BEFORE_LEAVING_MS && index !== -1) errors.splice(index, 1)
    }
    recent = []
  })
  page.on("domcontentloaded", () => {
    loaded = true
    leaving = false
  })
  // `text` is the error as Safari words it, to tell a load cut short.
  const add = (entry: string, text: string) => {
    if (cutShort(text)) {
      if (leaving) return
      recent.push({ entry, at: Date.now() })
    }
    errors.push(entry)
  }
  page.on("pageerror", (error) => add(error.message, thrownText(error)))
  page.on("console", (message) => {
    const text = message.text()
    // How every test that doesn't answer it sees /api/review (test.ts): as on a site with no AI keys.
    if (/status of 503/.test(text) && message.location().url.endsWith("/api/review")) return
    if (message.type() === "error") add(`${text} (at ${message.location().url})`, text)
  })
  // Playwright passes on what a worker's code logs, but not what Chromium
  // itself logs for a worker, as what its policy refused. Chromium sends those to
  // a session of the page's own, along with what it logged before that opened.
  if (page.context().browser()?.browserType().name() === "chromium") {
    void page
      .context()
      .newCDPSession(page)
      .then(async (session) => {
        session.on("Log.entryAdded", ({ entry }) => {
          if (entry.source === "worker" && REFUSED.test(entry.text)) add(`${entry.text} (at ${entry.url})`, entry.text)
        })
        await session.send("Log.enable")
      })
      // The page closed first.
      .catch(() => {})
  }
  return errors
}

/** Waits for the CSS transitions under way to end, as a dialog fading in. */
export async function transitionsDone(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        // Transitions only: CSS animations, as a spinner's, can go on for ever.
        .filter((animation) => "transitionProperty" in animation)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

/**
 * Waits until no transition is under way on an element, on what contains it
 * or on what's in it, as a dialog growing into place, so a box read next is
 * its final one. Each look comes two frames on: a transition can start with
 * the next frame, and its transitionrun event comes with the one after.
 * A view transition counts too: until it ends, what shows of the element is
 * its picture, moving from where it was. Its animations are on the root's
 * ::view-transition pseudo-elements, and start as the browser pictures the
 * new view, at the next frame after it's rendered. Only those still playing
 * count: once done, they hold their last frame (fill: both), and WebKit went
 * on listing one after Start writing's rise had played, which held up every
 * test that came into the editor that way. A failure names what's moving.
 */
export async function settled(locator: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator.evaluate(async (element) => {
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
          return document.getAnimations().flatMap((animation) => {
            const effect = animation.effect as KeyframeEffect | null
            const target = effect?.target
            if (!target || !(target.contains(element) || element.contains(target))) return []
            if ("transitionProperty" in animation)
              return [`${target.tagName.toLowerCase()} ${(animation as CSSTransition).transitionProperty}`]
            if (!effect.pseudoElement?.startsWith("::view-transition") || animation.playState !== "running") return []
            return [`${effect.pseudoElement} ${(animation as CSSAnimation).animationName}${animation.pending ? " pending" : ""}`]
          })
        }),
      { message: "nothing on, in or around it is transitioning" },
    )
    .toEqual([])
}

/**
 * Makes the page's scrolling instant. The site scrolls smoothly (scroll-smooth
 * on <html>), so a scroll Playwright makes to reach something, as when it
 * retries a hover, would go on after its action and move something else under
 * the pointer. For tests of what's under the pointer, not of scrolling.
 */
export async function instantScrolling(page: Page) {
  await page.addStyleTag({ content: "html { scroll-behavior: auto }" })
}

/**
 * Whether the white pill on a grey track of choices (useThumb) covers the
 * chosen one to within a pixel, and is the only white there.
 */
export async function thumbCovers(row: Locator, choice: Locator): Promise<boolean> {
  const box = (await choice.boundingBox())!
  const white = await row.evaluate((row) =>
    [...row.querySelectorAll("*")].flatMap((element) => {
      const style = getComputedStyle(element)
      if (style.backgroundColor !== "rgb(255, 255, 255)" || style.visibility !== "visible") return []
      const { x, y, width, height } = element.getBoundingClientRect()
      return [{ x, y, width, height }]
    }),
  )
  return white.length === 1 && (["x", "y", "width", "height"] as const).every((side) => Math.abs(white[0][side] - box[side]) < 1)
}

/** Counts the slides of the white pill on a grey track of choices from now on: the translate transitions that start on it. */
export async function countThumbSlides(row: Locator): Promise<() => Promise<number>> {
  const count = await row.evaluateHandle((row) => {
    const count = { slides: 0 }
    row.addEventListener("transitionrun", (event) => {
      if ((event as TransitionEvent).propertyName === "translate") count.slides++
    })
    return count
  })
  return () => count.evaluate((count) => count.slides)
}

/**
 * The page's serious and critical problems under WCAG 2.1 A and AA, as
 * readable lines, leaving out the parts matching `exclude`.
 */
export async function seriousAccessibilityProblems(page: Page, exclude: string[] = []): Promise<string[]> {
  // Something fading in would be read part-way, with colors too faint for its contrast.
  await transitionsDone(page)
  let axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  for (const selector of exclude) axe = axe.exclude(selector)
  const { violations } = await axe.analyze()
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`)
}

/**
 * Lets a test hold the resumes sent to the PDF compiler's worker (holdPreviews),
 * so the preview, and the checks on it, wait. It also counts the PDFs the
 * worker sends back (previewsBuilt), whether or not the page still wants them.
 */
export async function holdablePreviews(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const held: (() => void)[] = []
    let holding = false
    window.previewsBuilt = 0
    window.holdPreviews = (hold: boolean) => {
      holding = hold
      if (!hold) for (const send of held.splice(0)) send()
    }
    const RealWorker = window.Worker
    window.Worker = class extends RealWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args)
        this.addEventListener("message", (event) => {
          if (event.data?.pdf !== undefined) window.previewsBuilt!++
        })
      }
      postMessage(message: any, options?: any) {
        // A resume to compile has an id and a template; the grammar checker's texts have no template.
        if (holding && message?.id !== undefined && message?.template !== undefined) held.push(() => super.postMessage(message, options))
        else super.postMessage(message, options)
      }
    }
  })
}

/** Holds resumes on their way to the compiler, or sends the held ones on. */
export const holdPreviews = (page: Page, hold: boolean): Promise<void> => page.evaluate((hold) => window.holdPreviews!(hold), hold)

/** How many PDFs the compiler's worker has sent back, with holdablePreviews. */
export const previewsBuilt = (page: Page): Promise<number> => page.evaluate(() => window.previewsBuilt!)

/**
 * Starts a new resume from the home page's Start writing link, and gives its
 * id once the editor has it. With `title`, names the resume; with `name`,
 * types it as the full name and waits for the preview to print it.
 */
export async function newResume(page: Page, { title, name }: { title?: string; name?: string } = {}): Promise<string> {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  if (title !== undefined) await page.getByLabel("Resume name").fill(title)
  if (name !== undefined) {
    await page.getByLabel("Full name").fill(name)
    await expect(preview(page).getByText(name).first()).toBeVisible()
  }
  return new URL(page.url()).pathname.split("/").pop()!
}

/**
 * Saves resumes in the browser before each page loads, unless one is saved
 * under the same id already, so what a test changes stays over a reload.
 * With `once`, only before the tab's first page, so a test can delete them.
 */
export async function saveResumes(
  page: Page,
  resumes: readonly { id: string; [field: string]: unknown }[],
  { once = false } = {},
): Promise<void> {
  await page.addInitScript(
    ({ resumes, once }) => {
      if (once) {
        if (sessionStorage.getItem("seeded")) return
        sessionStorage.setItem("seeded", "yes")
      }
      for (const resume of resumes) {
        const key = `resume:${resume.id}`
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(resume))
      }
    },
    { resumes, once },
  )
}

/** A resume as this browser has it saved, or {} if there's none. */
export const savedResume = (page: Page, id: string): Promise<Record<string, any>> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), `resume:${id}`)

/**
 * The list of sections: the rail on a wide screen, and narrower, the drawer
 * the section bar opens (SectionPicker), which it opens first if it's shut.
 */
export async function sectionList(page: Page): Promise<Locator> {
  const list = page.getByRole("navigation", { name: "Sections" })
  if (!(await list.isVisible())) await page.getByRole("button", { name: /^Sections: / }).click()
  await expect(list).toBeVisible()
  return list
}

/** Opens a section from the list of sections, wherever it is (sectionList). */
export async function openSection(page: Page, name: string | RegExp) {
  await (await sectionList(page)).getByRole("button", { name: typeof name === "string" ? new RegExp(`^${name}$`) : name }).click()
}

/** The editor's preview. */
export const preview = (page: Page): Locator => page.getByRole("region", { name: "Live preview" })

/**
 * Waits for the preview's first page to be drawn. Tests wait for it before
 * leaving the editor: Safari reports leaving while the editor still
 * downloads its PDF compiler as an error.
 */
export const previewShown = (page: Page): Promise<void> => expect(preview(page).locator(".react-pdf__Page__canvas").first()).toBeVisible()

/**
 * The text of the preview's pages, in the order it's printed, or "" while a
 * page's text is still being laid out (it ends with an "endOfContent" mark),
 * so that what isn't printed is never missing just because it isn't there yet.
 */
export const printed = (page: Page): Promise<string> =>
  preview(page)
    .locator(".react-pdf__Page__textContent")
    .evaluateAll((layers) =>
      layers.every((layer) => layer.querySelector(".endOfContent")) ? layers.map((layer) => layer.textContent ?? "").join(" ") : "",
    )

/** The text of a PDF file. */
export async function pdfText(file: string): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(await readFile(file)), isEvalSupported: false }).promise
  try {
    const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, index) => doc.getPage(index + 1)))
    const contents = await Promise.all(pages.map((page) => page.getTextContent()))
    return contents.flatMap((content) => content.items.map((item) => ("str" in item ? item.str : ""))).join(" ")
  } finally {
    await doc.destroy()
  }
}

/** The text of a downloaded file. */
export const downloadText = async (download: Download): Promise<string> => readFile((await download.path())!, "utf8")

/**
 * The pixels of a screenshot, or of an area of it, a row at a time: four
 * values to a pixel, its red, green, blue and alpha. The page decodes the PNG.
 */
export async function pixelsOf(
  page: Page,
  png: Buffer,
  area?: { x: number; y: number; width: number; height: number },
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  return page.evaluate(
    async ({ png, area }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext("2d")!
      context.drawImage(image, 0, 0)
      const { x, y, width, height } = area ?? { x: 0, y: 0, width: image.width, height: image.height }
      return { data: context.getImageData(x, y, width, height).data, width, height }
    },
    { png: png.toString("base64"), area },
  )
}

/**
 * Opens files as a person does: with the button that opens a file ("Open a
 * file" on the dashboard, "Review my resume" on the review page), choosing
 * them in the browser's file chooser.
 */
export async function openFile(button: Locator, files: Parameters<FileChooser["setFiles"]>[0]): Promise<void> {
  const choosing = button.page().waitForEvent("filechooser")
  await button.click()
  await (await choosing).setFiles(files)
}

/** Chooses a template from the gallery behind the header's Template button, which every screen has. */
export async function chooseTemplate(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /^Template/ }).click()
  await page.getByRole("dialog", { name: "Choose a template" }).getByRole("button", { name, exact: true }).click()
}

/** What names the resume's template on screen: the header's Template button. */
export const templateShown = (page: Page): Locator => page.getByRole("button", { name: /^Template/ })

/**
 * The editor's heading of a section, such as "Experience". Not the preview's:
 * the PDF tags its section titles as headings, which pdf.js shows as headings
 * in the page, and WebKit names them, so one of the same name is in both.
 */
export const editorHeading = (page: Page, name: string, options: { exact?: boolean } = {}): Locator =>
  page.getByRole("main").getByRole("heading", { name, ...options })

/** The editor's title, the open section's heading: its own H1, not the preview's, which is the resume's name. */
export const editorTitle = (page: Page): Locator => page.getByRole("main").getByRole("heading", { level: 1 })

// A box that shows bold and italic words is an editable div that draws a div
// per line, with bold words in <strong> and italic ones in <em>
// (src/components/editor/boxDom.ts). Its text counts a character for each line
// break, as a text box's would.

/** The text in a box, a line per line, as it shows it: without its bold and italic marks. */
export const boxText = (box: Locator) => box.evaluate((element) => [...element.children].map((line) => line.textContent ?? "").join("\n"))

/** Waits for a box's text, as boxText reads it, to be `text`. */
export const expectText = (box: Locator, text: string): Promise<void> => expect.poll(() => boxText(box)).toBe(text)

/** Selects from `start` to `end` in a box's text, or puts the cursor at `start`. */
export const selectInBox = (box: Locator, start: number, end = start) =>
  box.evaluate(
    (element, [start, end]) => {
      const pointAt = (offset: number): [Node, number] => {
        const lines = [...element.children]
        for (const [index, line] of lines.entries()) {
          const length = line.textContent?.length ?? 0
          if (offset <= length || index === lines.length - 1) {
            const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (offset <= (node as Text).length) return [node, offset]
              offset -= (node as Text).length
            }
            return [line, 0]
          }
          offset -= length + 1
        }
        return [element, 0]
      }
      const [from, to] = [pointAt(start), pointAt(end)]
      getSelection()!.setBaseAndExtent(from[0], from[1], to[0], to[1])
    },
    [start, end],
  )

/** Where the cursor is in a box's text. */
export const cursorInBox = (box: Locator) =>
  box.evaluate((element) => {
    const { focusNode, focusOffset } = getSelection()!
    let offset = 0
    for (const line of element.children) {
      if (focusNode && line.contains(focusNode)) {
        const range = document.createRange()
        range.setStart(line, 0)
        range.setEnd(focusNode, focusOffset)
        return offset + range.toString().length
      }
      offset += (line.textContent?.length ?? 0) + 1
    }
    return -1
  })
