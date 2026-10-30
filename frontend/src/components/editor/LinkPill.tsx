"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { SelectionToolbar, type SelectedWords } from "./SelectionToolbar"

// A link on the preview that was made in a box (StyledBox.tsx) shows the
// toolbar's link button and address over it while the pointer's on it, to
// change the address or take the link off. A click on the link still opens it.

/** A link pointed at on the preview: where it is, its address, and its words in the preview's text, as pick takes them. */
export interface PointedLink {
  at: Omit<SelectedWords, "style" | "link">
  address: string
  printed: string
  start: number
  end: number
}

// How long the pointer rests on a link before its address shows, so one passed over on the way
// elsewhere shows nothing, and how long it can be off the link and the pill before they go.
const SHOW_MS = 350
const HIDE_MS = 300

const PILL = "data-link-pill"

/**
 * The characters of the preview's text (its pages' text layers, joined)
 * that are inside a link's area: its words. Null if none are.
 */
function wordsUnder(link: Element, layers: HTMLElement[]): { printed: string; start: number; end: number } | null {
  const layer = link.closest("[data-preview-page]")?.querySelector<HTMLElement>(".textLayer")
  if (!layer || !layers.includes(layer)) return null
  const area = link.getBoundingClientRect()
  const inside = (rect: DOMRect) => {
    const x = (rect.left + rect.right) / 2
    const y = (rect.top + rect.bottom) / 2
    return rect.width > 0 && x >= area.left - 1 && x <= area.right + 1 && y >= area.top - 1 && y <= area.bottom + 1
  }
  const range = document.createRange()
  let offset = 0
  let start = -1
  let end = -1
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const near = node.parentElement?.getBoundingClientRect()
    if (near && near.bottom >= area.top && near.top <= area.bottom && near.right >= area.left && near.left <= area.right) {
      for (let at = 0; at < node.data.length; at++) {
        range.setStart(node, at)
        range.setEnd(node, at + 1)
        if (!inside(range.getBoundingClientRect())) continue
        if (start < 0) start = offset + at
        end = offset + at + 1
      }
    }
    offset += node.data.length
  }
  if (start < 0) return null
  const texts = layers.map((each) => each.textContent)
  const before = texts.slice(0, layers.indexOf(layer)).join("").length
  return { printed: texts.join(""), start: before + start, end: before + end }
}

/**
 * Follows the pointer over the preview's links, for the pill. A link shows
 * it only if `inBox` says a box printed its words: other links, as the
 * profile's, are changed in their own fields.
 */
export function usePointedLink(
  pages: React.RefObject<HTMLElement | null>,
  scroller: React.RefObject<HTMLElement | null>,
  inBox: (printed: string, start: number, end: number) => boolean,
) {
  const [pointed, setPointed] = useState<PointedLink | null>(null)
  const timers = useRef({ show: 0, hide: 0, link: null as Element | null })

  const hideSoon = () => {
    const now = timers.current
    clearTimeout(now.show)
    now.link = null
    clearTimeout(now.hide)
    now.hide = window.setTimeout(() => {
      // Not while the address is being changed in it.
      if (!document.activeElement?.closest(`[${PILL}]`)) setPointed(null)
    }, HIDE_MS)
  }

  const onPointerOver = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    const link = event.target instanceof Element ? event.target.closest(".annotationLayer a[href]") : null
    const now = timers.current
    if (!link) return hideSoon()
    if (link === now.link) return
    clearTimeout(now.hide)
    clearTimeout(now.show)
    now.link = link
    now.show = window.setTimeout(() => {
      const layers = [...(pages.current?.querySelectorAll<HTMLElement>(".textLayer") ?? [])]
      const words = wordsUnder(link, layers)
      const sides = scroller.current?.getBoundingClientRect()
      if (!words || !sides || !inBox(words.printed, words.start, words.end)) return setPointed(null)
      const { top, bottom, left, right } = link.getBoundingClientRect()
      setPointed({
        at: { top, bottom, left, right, boxLeft: sides.left, boxRight: sides.right },
        address: link.getAttribute("href")!,
        ...words,
      })
    }, SHOW_MS)
  }

  const close = () => {
    clearTimeout(timers.current.show)
    clearTimeout(timers.current.hide)
    timers.current.link = null
    setPointed(null)
  }

  /** The pointer came onto the pill, or left it. */
  const overPill = (over: boolean) => {
    if (over) clearTimeout(timers.current.hide)
    else hideSoon()
  }

  return { pointed, onPointerOver, onPointerLeave: hideSoon, overPill, close }
}

/**
 * The toolbar's link part over a link pointed at on the preview: its address,
 * to change, and the link button, to take it off. `onLink` gets the new
 * address, or "" to unlink.
 */
export function LinkPill({
  link,
  onLink,
  onClose,
  onPointerOver,
}: {
  link: PointedLink
  onLink: (address: string) => void
  onClose: () => void
  onPointerOver: (over: boolean) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  // pdf.js writes a link to a bare site with a "/" at the end, which wasn't typed.
  const address = link.address.replace(/^(https?:\/\/[^/?#]+)\/$/, "$1")

  useLayoutEffect(() => {
    toolbar.current?.setAttribute(PILL, "")
  })

  return (
    <SelectionToolbar
      words={{ ...link.at, style: 0, link: address }}
      editingLink={editing}
      onToggle={() => {}}
      onEditLink={() => setEditing(address)}
      onLink={onLink}
      onCancelLink={onClose}
      onLeave={onClose}
      toolbarRef={toolbar}
      linkOnly
      onPointerOver={onPointerOver}
    />
  )
}
