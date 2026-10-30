// A deleted resume's page flies into the "Deleted · Undo" message, and Undo
// flies it back; the resumes around it slide into the gap, or out of the way.
// Web Animations rather than CSS, as where it lands is only known once the
// message is on the page.

import { useLayoutEffect, useRef, type RefObject } from "react"
import { reducedMotion } from "@/components/editor/layout"

/** How long the page takes to fly into the message or back, in milliseconds. */
const FLIGHT_MS = 560

/** How long the resumes after it take to slide into its place, or out of the way. */
const GLIDE_MS = 420

// Lifts off a little, then speeds up toward the message and settles into it.
const FLIGHT_EASING = "cubic-bezier(0.6, 0, 0.2, 1)"
// --ease-glide in globals.css, as script animations can't read a CSS variable.
const EASE_GLIDE = "cubic-bezier(0.16, 1, 0.3, 1)"
// The copy fades out over the flight's last moment, as the message's own small page fades in (dashboard.css).
const HAND_OVER_MS = 60

/**
 * Whenever `order` changes (a search, a sort, a copy made, one put back), a
 * list's resumes slide from where they were to their new places, and one
 * that wasn't there before grows in, rather than each jumping. Places are
 * kept by layout (offsetLeft, offsetTop), which a slide's own translate
 * doesn't change; a resume a deletion is already sliding (glideFrom) is left
 * to it.
 */
export function useGlideOnChange(list: RefObject<HTMLElement | null>, order: string) {
  const places = useRef(new Map<string, { x: number; y: number }>())
  useLayoutEffect(() => {
    const before = places.current
    const now = new Map<string, { x: number; y: number }>()
    for (const element of list.current?.querySelectorAll<HTMLElement>(":scope > [data-glide]") ?? []) {
      const at = { x: element.offsetLeft, y: element.offsetTop }
      now.set(element.dataset.glide!, at)
      // One being put back is flown back to its place instead (fly).
      if (before.size === 0 || reducedMotion() || element.getAnimations().length > 0 || element.matches(".is-returning")) continue
      const was = before.get(element.dataset.glide!)
      if (!was) {
        element.animate(
          [
            { opacity: 0, scale: 0.96 },
            { opacity: 1, scale: 1 },
          ],
          { duration: GLIDE_MS, easing: EASE_GLIDE },
        )
        continue
      }
      const dx = was.x - at.x
      const dy = was.y - at.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      element.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: GLIDE_MS, easing: EASE_GLIDE })
    }
    places.current = now
  }, [list, order])
}

/** Where each of a list's resumes (and the New resume tile) is, before a change. */
export function placesIn(list: Element | null): Map<Element, DOMRect> {
  return new Map([...(list?.querySelectorAll("[data-glide]") ?? [])].map((element) => [element, element.getBoundingClientRect()]))
}

/** Slides each of them from where it was (placesIn, before the change) to where it is now. */
export function glideFrom(before: Map<Element, DOMRect>) {
  for (const [element, was] of before) {
    if (!element.isConnected) continue
    const now = element.getBoundingClientRect()
    const dx = was.left - now.left
    const dy = was.top - now.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    // `translate`, not `transform`, so it leaves alone any transform the element has of its own.
    element.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: GLIDE_MS, easing: EASE_GLIDE })
  }
}

/**
 * A resume's small page, as drawn in the list or the pages: the one that's
 * showing, as the list is drawn twice, a card for phones and a table for
 * wider screens, one hidden.
 */
export function pageOf(list: Element | null, id: string): HTMLElement | null {
  const pages = list?.querySelectorAll<HTMLElement>(`[data-glide="${CSS.escape(id)}"] [data-resume-page]`) ?? []
  return [...pages].find((page) => page.getClientRects().length > 0) ?? null
}

/**
 * Where an element will be once whatever is moving it has finished: its
 * place on the page without transforms, as the message slides up into place
 * while the page flies to it. Measured up to the fixed box it's in.
 */
export function restingBox(element: HTMLElement): DOMRect {
  let x = 0
  let y = 0
  let at: HTMLElement | null = element
  while (at && getComputedStyle(at).position !== "fixed") {
    x += at.offsetLeft
    y += at.offsetTop
    at = at.offsetParent as HTMLElement | null
  }
  const fixed = at?.getBoundingClientRect()
  return new DOMRect((fixed?.left ?? 0) + x, (fixed?.top ?? 0) + y, element.offsetWidth, element.offsetHeight)
}

/**
 * Flies a copy of `page` between its own box and `slot`'s: into the slot, or
 * out of it (`back`). The copy is laid over everything, so nothing it passes
 * clips it (the list's table scrolls sideways in a box of its own). Returns
 * it, so it can be taken away if another delete or Undo comes first.
 * `landed` runs as it lands, before the copy goes: a page flying back is
 * shown there first, so there's no moment without either.
 */
export function fly(page: HTMLElement, slot: DOMRect, back = false, landed?: () => void): HTMLElement {
  const from = page.getBoundingClientRect()
  const copy = page.cloneNode(true) as HTMLElement
  // Not a second of the resume's page as far as the page's code and screen readers know,
  // and no name for a view transition that the page already has.
  copy.removeAttribute("data-resume-page")
  copy.removeAttribute("style")
  copy.setAttribute("aria-hidden", "true")
  copy.inert = true
  copy.dataset.flyingPage = ""
  Object.assign(copy.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    zIndex: "50",
    pointerEvents: "none",
    transformOrigin: "0 0",
  })
  document.body.append(copy)

  const dx = slot.left - from.left
  const dy = slot.top - from.top
  const flight = copy.animate(
    [
      { transform: "none" },
      { transform: `translate(${dx * 0.12}px, ${dy * 0.04 - 12}px) scale(0.9)`, offset: 0.22 },
      { transform: `translate(${dx}px, ${dy}px) scale(${slot.width / from.width}, ${slot.height / from.height})` },
    ],
    { duration: FLIGHT_MS, easing: FLIGHT_EASING, fill: "both", direction: back ? "reverse" : "normal" },
  )
  if (!back) copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HAND_OVER_MS, delay: FLIGHT_MS - HAND_OVER_MS, fill: "forwards" })
  flight.finished.then(
    () => {
      landed?.()
      copy.remove()
    },
    () => copy.remove(),
  )
  return copy
}
