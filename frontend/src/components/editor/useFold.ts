"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { reducedMotion, WIDE_SCREEN } from "./layout"

/** How long the form takes to slide shut or open; the page grows or shrinks with it (PdfPreview's RESIZE_MS). */
const FOLD_MS = 300
// --ease-glide in globals.css.
const GLIDE = "cubic-bezier(0.16, 1, 0.3, 1)"

/** The column beside the rail that's showing: the form, or the ATS Checks, AI Reviews or Style in its place. */
const shownColumn = () => [...document.querySelectorAll<HTMLElement>("[data-column]")].find((column) => column.offsetWidth > 0)

/**
 * Folds the form away on wide screens, so the page has the sheet to itself,
 * and brings it back. `folded` turns at once, so the page grows or shrinks as
 * the column slides; `shut` turns once the column has slid shut, taking it
 * out of the layout. The column slides like a drawer: its content keeps its
 * width, cut off at the column's edge, so nothing in it wraps anew each frame.
 * Turned back while it slides, it slides back from where it is.
 */
export function useFold() {
  const [folded, setFolded] = useState(false)
  const [shut, setShut] = useState(false)
  const wanted = useRef(false)
  const slide = useRef<{ animation: Animation; shutting: boolean } | null>(null)
  // Set as the form folds away or comes back, for the column to slide once the editor has been rendered
  // for it: started before, its time would run out during that render on a slow machine, and it would
  // jump rather than slide.
  const pending = useRef<"shut" | "open" | null>(null)

  const start = useCallback((column: HTMLElement, shutting: boolean) => {
    const inner = column.firstElementChild as HTMLElement
    const width = `${column.offsetWidth}px`
    inner.style.width = `${inner.offsetWidth}px`
    // Held at its end until it's out of the layout, so it doesn't spring back open for a frame first.
    const animation = column.animate(
      { width: shutting ? [width, "0px"] : ["0px", width] },
      { duration: FOLD_MS, easing: GLIDE, fill: "both" },
    )
    const current = { animation, shutting }
    slide.current = current
    animation.onfinish = () => {
      slide.current = null
      if (current.shutting) flushSync(() => setShut(true))
      animation.cancel()
      inner.style.width = ""
    }
  }, [])

  const foldTo = useCallback((fold: boolean) => {
    if (wanted.current === fold) return
    wanted.current = fold
    pending.current = null
    setFolded(fold)
    const running = slide.current
    if (running) {
      running.shutting = fold
      running.animation.reverse()
      return
    }
    if (!fold) {
      pending.current = "open"
      setShut(false)
      return
    }
    if (!shownColumn() || reducedMotion() || !window.matchMedia(WIDE_SCREEN).matches) setShut(true)
    else pending.current = "shut"
  }, [])

  // Before the first frame after the render: shutting, the column is still at its full width; opening, it's
  // back in the layout at its full width, and slides open from nothing.
  useLayoutEffect(() => {
    const going = pending.current
    if (!going) return
    pending.current = null
    const column = shownColumn()
    if (column && !reducedMotion() && window.matchMedia(WIDE_SCREEN).matches) start(column, going === "shut")
    else if (going === "shut") setShut(true)
  }, [folded, shut, start])

  const fold = useCallback(() => foldTo(!wanted.current), [foldTo])
  return { folded, shut, foldTo, fold }
}
