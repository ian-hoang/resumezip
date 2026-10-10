/** How long the page waits for the next one before letting the transition go on without it, in milliseconds. */
const WAIT_MS = 2500

/**
 * Goes to the next page with the page lifting away and the next rising up
 * (the "rise" view transition in globals.css). Where the browser has no view
 * transitions, or with less motion, it just goes.
 */
export function rise(go: () => void) {
  if (!("startViewTransition" in document) || !("types" in ViewTransition.prototype)) return go()
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return go()
  const from = location.pathname
  document.startViewTransition({
    types: ["rise"],
    update: async () => {
      go()
      await nextPage(from)
    },
  })
}

/**
 * Resolves once the address has changed and the new page has its main part,
 * or after WAIT_MS. Polled with timers: the browser runs no animation frames
 * while it waits for the new page.
 */
function nextPage(from: string): Promise<void> {
  const until = performance.now() + WAIT_MS
  return new Promise((done) => {
    const look = () => {
      if ((location.pathname !== from && document.querySelector("main")) || performance.now() > until) done()
      else setTimeout(look, 16)
    }
    look()
  })
}
