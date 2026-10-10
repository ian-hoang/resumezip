import type { CSSProperties } from "react"
import { flushSync } from "react-dom"

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
