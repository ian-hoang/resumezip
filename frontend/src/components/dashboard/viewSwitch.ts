import type { CSSProperties, MouseEvent } from "react"
import { flushSync } from "react-dom"
import { useRouter } from "next/navigation"

/** The view transition type that dashboard.css times and shapes the switch by. */
const SWITCH_TYPE = "resume-view"

/**
 * Switches between the pages and the list with `update`, a React state
 * change. Where the browser has view transitions, each resume's page and
 * name move from their place in one view to their place in the other (paired
 * by `morph`), and the rest crossfades. Returns "fade" where it doesn't, for
 * the new view to fade in instead (dashboard.css), and "instant" with less
 * motion, where nothing moves at all.
 */
export function switchView(update: () => void): "morph" | "fade" | "instant" {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update()
    return "instant"
  }
  if (!("startViewTransition" in document)) {
    update()
    return "fade"
  }
  // The browser pictures the new view as soon as the callback returns, so
  // React has to have rendered it by then.
  const run = () => flushSync(update)
  // Types came with the options form. Browsers from before them only take a
  // callback, and switch with their own timing.
  if ("types" in ViewTransition.prototype) document.startViewTransition({ update: run, types: [SWITCH_TYPE] })
  else document.startViewTransition(run)
  return "morph"
}

/**
 * Pairs a resume's page or name in one view with the same in the other, for
 * `switchView` to move between them. Named by its place in the list, which
 * both views show in the same order, rather than by its id: an id from an
 * opened file could be anything, and a name has to be a CSS identifier, and
 * the only one of its kind on the page.
 */
export const morph = (part: "page" | "name", index: number): CSSProperties => ({
  viewTransitionName: `resume-${part}-${index}`,
  viewTransitionClass: `resume-${part}`,
})

/** The view transition type for opening a resume from the dashboard (dashboard.css). */
const OPEN_TYPE = "resume-open"
/** What a resume's page on the dashboard and the editor's page are both called while one becomes the other. */
export const OPEN_NAME = "resume-open-page"
/** How long the dashboard waits for the editor's page before it lets the transition go on without it, in milliseconds. */
const OPEN_WAIT_MS = 2500

/**
 * Opens a resume from its page on the dashboard: where the browser has view
 * transitions, the page grows into the editor's page as the editor comes in.
 * The browser holds a picture of the dashboard until `go` has put the editor
 * on screen, so it waits for the editor's page to be there (or gives up after
 * a moment, and the rest crossfades). Returns false where it doesn't run, for
 * the link to go as usual.
 */
export function openResume(go: () => void, page: HTMLElement | null): boolean {
  if (!page || !("startViewTransition" in document) || !("types" in ViewTransition.prototype)) return false
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false
  // Its usual name pairs it with the other dashboard view; for this, it pairs with the editor's page.
  const usual = page.style.viewTransitionName
  page.style.viewTransitionName = OPEN_NAME
  const transition = document.startViewTransition({
    types: [OPEN_TYPE],
    update: async () => {
      page.style.viewTransitionName = usual
      go()
      await editorPage()
    },
  })
  transition.finished.finally(() => {
    page.style.viewTransitionName = usual
  })
  return true
}

/**
 * Resolves once the editor's page is there, or after OPEN_WAIT_MS. Polled
 * with timers: the browser runs no animation frames while it waits for the
 * new page, so requestAnimationFrame would never come back.
 */
function editorPage(): Promise<void> {
  const until = performance.now() + OPEN_WAIT_MS
  return new Promise((done) => {
    const look = () => {
      if (document.querySelector("[data-open-target]") || performance.now() > until) done()
      else setTimeout(look, 16)
    }
    look()
  })
}

/**
 * A link's click handler that opens its resume with `openResume`, growing the
 * page in the same card or row (marked data-resume-page) into the editor's.
 * A click with a modifier, as to open a new tab, goes as usual.
 */
export function useOpenResume(): (event: MouseEvent<HTMLAnchorElement>) => void {
  const router = useRouter()
  return (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.currentTarget
    const page = link.closest("li, tr")?.querySelector<HTMLElement>("[data-resume-page]") ?? null
    if (openResume(() => router.push(link.getAttribute("href")!), page)) event.preventDefault()
  }
}
