import AxeBuilder from "@axe-core/playwright"
import { expect, type Locator, type Page } from "@playwright/test"

// Safari logs these when a page is left while something is still loading in
// the background, and the visitor never sees them: the PDF compiler, its
// fonts and pdf.js's worker, which the home page, dashboard and editor start
// early, the scripts the compiler's worker loads as it starts, and the pages
// behind a page's links, which Next.js fetches ahead. They're only left out
// while the page is being left, so a load that fails on a page that stays
// open counts.
const CUT_SHORT = [
  /^Fetch API cannot load \S+\.(wasm|otf|ttf|mjs) due to access control checks\.$/,
  /^Cannot load \S+\.js due to access control checks\.$/,
  /^Failed to fetch RSC payload for \S+\. Falling back to browser navigation\. TypeError: Load failed$/,
]
// Safari can report a load cut short just before the request for the next page.
const BEFORE_LEAVING_MS = 500

// Safari sometimes reports a load cut short as an error thrown by the page
// rather than logging it. Playwright splits a thrown error's text at its first
// colon, here the one in "http://", into a name ("Cannot load http") and a
// message ("/localhost:…"), dropping the character after the colon. Put back
// together, it reads as it does when it's logged.
const thrownText = (error: Error) => (/ https?$/.test(error.name) ? `${error.name}:/${error.message}` : error.message)

/**
 * Collects the errors a page throws or logs, for a test to check at the end.
 * Logged errors end with where they came from, e.g. "… (at http://…/page)".
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
    if (CUT_SHORT.some((pattern) => pattern.test(text))) {
      if (leaving) return
      recent.push({ entry, at: Date.now() })
    }
    errors.push(entry)
  }
  page.on("pageerror", (error) => add(error.message, thrownText(error)))
  page.on("console", (message) => {
    if (message.type() === "error") add(`${message.text()} (at ${message.location().url})`, message.text())
  })
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
 */
export async function settled(locator: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator.evaluate(async (element) => {
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
          return document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target
            return "transitionProperty" in animation && !!target && (target.contains(element) || element.contains(target))
          }).length
        }),
      { message: "nothing on, in or around it is transitioning" },
    )
    .toBe(0)
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
    ;(window as any).previewsBuilt = 0
    ;(window as any).holdPreviews = (hold: boolean) => {
      holding = hold
      if (!hold) for (const send of held.splice(0)) send()
    }
    const RealWorker = window.Worker
    window.Worker = class extends RealWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args)
        this.addEventListener("message", (event) => {
          if (event.data?.pdf !== undefined) (window as any).previewsBuilt++
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
export const holdPreviews = (page: Page, hold: boolean): Promise<void> => page.evaluate((hold) => (window as any).holdPreviews(hold), hold)

/** How many PDFs the compiler's worker has sent back, with holdablePreviews. */
export const previewsBuilt = (page: Page): Promise<number> => page.evaluate(() => (window as any).previewsBuilt)

/**
 * Chooses a template: from the gallery behind the Template button on narrower
 * screens, or on wide ones from the left panel's Style tab, which it opens
 * and leaves open.
 */
export async function chooseTemplate(page: Page, name: string): Promise<void> {
  const tab = page.getByRole("tab", { name: "Style" })
  const picker = page.getByRole("button", { name: /^Template/ })
  await expect(tab.or(picker).first()).toBeVisible()
  if (await picker.isVisible()) {
    await picker.click()
    await page.getByRole("dialog", { name: "Choose a template" }).getByRole("button", { name, exact: true }).click()
    return
  }
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click()
  await page.getByRole("region", { name: "Style" }).getByRole("button", { name, exact: true }).click()
}

/**
 * What names the resume's template on screen: the Template button on narrower
 * screens, or on wide ones the chosen template in the Style tab, which has to
 * be open to show it.
 */
export const templateShown = (page: Page): Locator =>
  page
    .getByRole("region", { name: "Style" })
    .getByRole("button", { pressed: true })
    .or(page.getByRole("button", { name: /^Template/ }))
