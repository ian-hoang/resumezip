import { flushSync } from "react-dom"
import { canTransition } from "@/components/site/rise"
import { WIDE_SCREEN } from "./layout"

/**
 * Changes what the editor shows in the form's place (a section, the ATS
 * Checks, AI Reviews or Style; on a phone, the form or the preview) as a quick
 * crossfade, the "view-swap" view transition in globals.css: the browser holds
 * a picture of the screen as it was, scrolled as it was, and fades it into the
 * new one, rather than the old view vanishing at once. `then` runs once the
 * new view is on the page, before it's pictured, as for scrolling to it. A
 * press while it fades ends it.
 *
 * On a wide screen with the form folded away, choosing brings the form back,
 * which slides (useFold) rather than fading. Where the browser has no view
 * transitions, or with less motion, it just changes.
 */
export function swapView(update: () => void, then?: () => void) {
  const folded =
    window.matchMedia(WIDE_SCREEN).matches &&
    ![...document.querySelectorAll<HTMLElement>("[data-column]")].some((column) => column.offsetWidth > 0)
  if (folded || !canTransition()) {
    update()
    then?.()
    return
  }
  const transition = document.startViewTransition({
    types: ["view-swap"],
    update: () => {
      flushSync(update)
      then?.()
    },
  })
  // A press while it fades ends the fade at once, so what's pressed, or dragged, is the live page.
  const skip = () => transition.skipTransition()
  document.addEventListener("pointerdown", skip, { capture: true, once: true })
  void transition.finished.finally(() => document.removeEventListener("pointerdown", skip, { capture: true }))
}
