import { useEffect, useState } from "react"

/**
 * Wide enough for the editor's three panels: the left bar, the form and the
 * preview side by side, under the top bar. Narrower, the sections are a row
 * of tabs above the form, and a switch at the foot (ViewSwitch) shows the
 * form, with Check or Style above it, or the preview.
 *
 * At 1280px the form has about 480px to write in and the page about 380px.
 * Any narrower and the left bar and the preview squeeze it. This is Tailwind's
 * `xl`, which the editor's layout classes use. It's in rem like Tailwind's, so
 * the two agree even when the browser's text size isn't the usual 16px.
 */
export const WIDE_SCREEN = "(min-width: 80rem)"

/** Whether the window is WIDE_SCREEN wide, following it as it's resized. False in the page as built, which has no window. */
export function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_SCREEN).matches)
  useEffect(() => {
    const query = window.matchMedia(WIDE_SCREEN)
    const sync = () => setWide(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  return wide
}

/** The part of the window that the editor's pinned bars (on narrower screens) leave uncovered. */
export function uncovered() {
  let top = 0
  let bottom = window.innerHeight
  for (const bar of document.querySelectorAll<HTMLElement>("[data-covers]")) {
    const { position } = getComputedStyle(bar)
    const box = bar.getBoundingClientRect()
    if ((position !== "sticky" && position !== "fixed") || !box.height) continue
    if (bar.dataset.covers === "top") top = Math.max(top, box.bottom)
    else bottom = Math.min(bottom, box.top)
  }
  return { top, bottom }
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** The element that scrolls the editor: its pane on wide screens, the page on small ones. */
export function scrollerOf(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node
  }
  return document.scrollingElement as HTMLElement
}

/** Where a scroller shows its contents: its own box, or for the page, the part of the window the pinned bars leave uncovered. */
export const visibleArea = (scroller: HTMLElement) =>
  scroller === document.scrollingElement ? uncovered() : scroller.getBoundingClientRect()

/**
 * Scrolls just enough to show an element clear of the pinned bars, or the top
 * of a tall one, like an opened entry's heading and first fields.
 */
export function reveal(element: HTMLElement, scroller: HTMLElement) {
  const box = element.getBoundingClientRect()
  const view = visibleArea(scroller)
  const below = box.top + Math.min(box.height, 260) - view.bottom
  const above = view.top - box.top
  const by = above > 0 ? -above - 16 : below > 0 ? below + 16 : 0
  if (by) scroller.scrollBy({ top: by, behavior: reducedMotion() ? "auto" : "smooth" })
}
