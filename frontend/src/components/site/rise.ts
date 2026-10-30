import { reducedMotion } from "@/components/editor/layout"

/** How long a view transition waits for the next page before it goes on without it, in milliseconds. */
const WAIT_MS = 2500

/**
 * Whether a page can change with a typed view transition, which its CSS times
 * and shapes: the browser has them, and the visitor hasn't asked for less
 * motion.
 */
export const canTransition = () => "startViewTransition" in document && "types" in ViewTransition.prototype && !reducedMotion()

/**
 * Resolves once `found` is true, or after `ms` (WAIT_MS), for a view transition
 * waiting on the next page. Polled with timers: the browser runs no animation
 * frames while it waits for the new page, so requestAnimationFrame would never
 * come back.
 */
export function waitFor(found: () => boolean, ms = WAIT_MS): Promise<void> {
  const until = performance.now() + ms
  return new Promise((done) => {
    const look = () => {
      if (found() || performance.now() > until) done()
      else setTimeout(look, 16)
    }
    look()
  })
}

/**
 * Goes to another page from the header's links: the page fades and lifts a
 * little as the next one fades up (the "page" view transition in globals.css),
 * the header staying put. Where the browser has no view transitions, or with
 * less motion, it just goes.
 */
export function turnPage(go: () => void) {
  if (!canTransition()) return go()
  const from = location.pathname
  document.startViewTransition({
    types: ["page"],
    update: async () => {
      go()
      await waitFor(() => location.pathname !== from && document.querySelector("main") !== null)
    },
  })
}

/**
 * Goes to the next page with the page lifting away and the next rising up
 * (the "rise" view transition in globals.css). Where the browser has no view
 * transitions, or with less motion, it just goes.
 */
export function rise(go: () => void) {
  if (!canTransition()) return go()
  const from = location.pathname
  document.startViewTransition({
    types: ["rise"],
    update: async () => {
      go()
      await waitFor(() => location.pathname !== from && document.querySelector("main") !== null)
    },
  })
}
