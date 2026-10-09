// Opening a resume from a picture of its page, as a template's on the home
// page or a resume's card on the dashboard, carries that picture into the
// editor: a view transition, where the browser freezes the page, takes a
// picture of it before and after, and moves the one into the other. The
// picture clicked and the editor's page share a view-transition-name for it
// ("A page opening" in app/globals.css). Browsers without view transitions,
// and visitors who ask for less motion, go straight to the editor.

/** The browser's name for the page being carried, on both sides. */
const NAME = "resume-page"
/** The longest the editor can take to show its page before the move starts regardless. */
const LANDING_MS = 2_000

// Whether a page is opening, and what starts its move once the editor's page is on screen.
let opening = false
let land: (() => void) | null = null

/**
 * Runs `go`, which opens the editor, carrying `from`, the picture clicked,
 * to where the editor shows the page. The page stays as it is, frozen, until
 * the editor has rendered and calls landed().
 */
export function openPage(go: () => void, from: HTMLElement | null | undefined) {
  // One at a time: a second click while a page opens, as a double click, just goes.
  if (opening || !from || !("startViewTransition" in document) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    go()
    return
  }
  opening = true
  const root = document.documentElement
  from.style.viewTransitionName = NAME
  root.dataset.opening = ""
  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        land = resolve
        setTimeout(resolve, LANDING_MS)
        go()
      }),
  )
  // A transition the browser skips, as for a tab in the background, still opens the editor.
  transition.ready.catch(() => {})
  void transition.finished.finally(() => {
    from.style.viewTransitionName = ""
    delete root.dataset.opening
    land = null
    opening = false
  })
}

/** The editor has rendered: the picture can move to its page. */
export function landed() {
  land?.()
  land = null
}
