import type { CSSProperties, MouseEvent } from "react"
import { flushSync } from "react-dom"
import { useRouter } from "next/navigation"
import { reducedMotion } from "@/components/editor/layout"
import { canTransition, startTransition, waitFor } from "@/components/site/rise"
import { pageOf } from "./flight"

/** The view transition type that dashboard.css times and shapes the switch by. */
const SWITCH_TYPE = "resume-view"

/**
 * Switches between the pages and the list with `update`, a React state
 * change. Where the browser has view transitions, each resume's page and
 * name move from their place in one view to their place in the other (paired
 * by `morph`). Either way the new view fades in, unless this returns
 * "instant": with less motion, where nothing moves at all (dashboard.css).
 */
export function switchView(update: () => void): "morph" | "fade" | "instant" {
  if (reducedMotion()) {
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
  if ("types" in ViewTransition.prototype) startTransition({ update: run, types: [SWITCH_TYPE] })
  else document.startViewTransition(run).ready.catch(() => {})
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

/** The view transition types for opening a resume from the dashboard, and going back to it (globals.css). */
const OPEN_TYPE = "resume-open"
const CLOSE_TYPE = "resume-close"
// The most going back waits for the resume's own picture on the dashboard, holding the editor still meanwhile.
const PICTURE_MS = 400
/** What a resume's page on the dashboard and the editor's page are both called while one becomes the other. */
export const OPEN_NAME = "resume-open-page"

/**
 * Opens a resume from its page on the dashboard: where the browser has view
 * transitions, the page grows into the editor's page as the editor comes in.
 * The browser holds a picture of the dashboard until `go` has put the editor
 * on screen, so it waits for the editor's page to be there (or gives up after
 * a moment, and the rest crossfades). Returns false where it doesn't run, for
 * the link to go as usual.
 */
function openResume(go: () => void, page: HTMLElement | null): boolean {
  if (!page || !canTransition()) return false
  // Its usual name pairs it with the other dashboard view; for this, it pairs with the editor's page.
  const usual = page.style.viewTransitionName
  page.style.viewTransitionName = OPEN_NAME
  startTransition(
    {
      types: [OPEN_TYPE],
      update: async () => {
        page.style.viewTransitionName = usual
        go()
        await waitFor(() => document.querySelector("[data-open-target]") !== null)
      },
    },
    () => {
      page.style.viewTransitionName = usual
    },
  )
  return true
}

/**
 * Back to the dashboard from a resume's editor: where the browser has view
 * transitions, the editor's page shrinks back into the resume's page on the
 * dashboard as it comes in, the way it came (openResume, backwards). The
 * browser holds a picture of the editor until that page is on the dashboard
 * (or gives up after a moment, and the rest crossfades). Returns false where
 * it doesn't run, for the link to go as usual.
 */
export function closeResume(id: string, go: () => void): boolean {
  if (!canTransition() || !document.querySelector("[data-open-target]")) return false
  let page: HTMLElement | null = null
  let usual = ""
  startTransition(
    {
      types: [CLOSE_TYPE],
      update: async () => {
        go()
        await waitFor(() => (page = pageOf(document.body, id)) !== null)
        // Its own picture rather than its template's, if it's drawn in a moment.
        await waitFor(() => page?.querySelector("img.page-arrived") != null, PICTURE_MS)
        // Its usual name pairs it with the other dashboard view; for this, it pairs with the editor's page.
        if (page) {
          usual = page.style.viewTransitionName
          page.style.viewTransitionName = OPEN_NAME
        }
      },
    },
    () => {
      if (page) page.style.viewTransitionName = usual
    },
  )
  return true
}

/**
 * A link's click handler that opens its resume with `openResume`, growing the
 * page in the same card or row (marked data-resume-page) into the editor's.
 * A click with a modifier, as to open a new tab, goes as usual.
 */
export function useOpenOnClick(): (event: MouseEvent<HTMLAnchorElement>) => void {
  const router = useRouter()
  return (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.currentTarget
    const page = link.closest("li, tr")?.querySelector<HTMLElement>("[data-resume-page]") ?? null
    if (openResume(() => router.push(link.getAttribute("href")!), page)) event.preventDefault()
  }
}
