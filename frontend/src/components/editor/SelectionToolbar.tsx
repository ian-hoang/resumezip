"use client"

import { Link2 } from "lucide-react"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { onMac } from "@/lib/keys"
import { linkAddress } from "@/lib/marks"
import { uncovered } from "./layout"
import { BOLD, ITALIC, UNDERLINE, type Style } from "./styledText"

/** Where the words selected in a box are on screen, the box's sides, and their styles, as the toolbar shows them. */
export interface SelectedWords {
  top: number
  bottom: number
  left: number
  right: number
  boxLeft: number
  boxRight: number
  /** BOLD, ITALIC and UNDERLINE that all the words have. */
  style: Style
  /** The address they all link to, or "". */
  link: string
}

interface SelectionToolbarProps {
  words: SelectedWords
  /** The address being typed for the words, while the link box is open. */
  editingLink: string | null
  onToggle: (style: Style) => void
  onEditLink: () => void
  /** Links the words to an address linkAddress has made of what was typed, or with "", unlinks them. */
  onLink: (address: string) => void
  onCancelLink: () => void
  /** Focus left the link box for somewhere else. */
  onLeave: () => void
  /** The toolbar's element, so the box can tell focus moving into it from focus leaving. */
  toolbarRef: React.RefObject<HTMLDivElement | null>
}

const GAP = 8
// Kept this far from the window's sides.
const MARGIN = 8

const key = (letter: string) => (onMac() ? `⌘${letter}` : `Ctrl+${letter}`)

// A button that leaves focus where it is, in the box or the link box: pressing it would otherwise move
// focus to it, or in Safari, which doesn't focus a button, nowhere, and the link box would close.
const keepSelection = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault()

/**
 * Bold, italic, underline and link buttons over the words selected in a box
 * (StyledBox.tsx), or the link box, to paste an address in. Above the words,
 * or below them where there's no room, or on a touch screen, where the
 * phone's own menu shows above them. It stays inside the box's sides, and
 * the window's.
 */
export function SelectionToolbar({
  words,
  editingLink,
  onToggle,
  onEditLink,
  onLink,
  onCancelLink,
  onLeave,
  toolbarRef,
}: SelectionToolbarProps) {
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null)
  const [problem, setProblem] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const problemId = useId()
  const linking = editingLink !== null

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    const { width, height } = toolbar.getBoundingClientRect()
    const { top: visibleTop, bottom: visibleBottom } = uncovered()
    const bottom = Math.min(
      visibleBottom,
      window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : Infinity,
    )
    const touch = window.matchMedia("(pointer: coarse)").matches
    const above = words.top - GAP - height
    const below = words.bottom + GAP
    const top = (touch || above < visibleTop + MARGIN) && below + height <= bottom - MARGIN ? below : above
    const middle = (words.left + words.right) / 2 - width / 2
    const inBox = width <= words.boxRight - words.boxLeft ? Math.min(Math.max(middle, words.boxLeft), words.boxRight - width) : middle
    const left = Math.min(Math.max(inBox, MARGIN), window.innerWidth - MARGIN - width)
    setPlace((old) => (old?.top === top && old.left === left ? old : { top, left }))
  }, [words, linking, toolbarRef])

  useLayoutEffect(() => {
    if (!linking) return
    setProblem("")
    input.current?.focus()
    input.current?.select()
  }, [linking])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const typed = input.current?.value ?? ""
    if (!typed.trim()) return onLink("")
    const address = linkAddress(typed)
    if (!address) return setProblem("Paste a web or email address.")
    onLink(address)
  }

  const button = (pressed: boolean) =>
    `inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[15px] leading-none transition-colors duration-150 motion-reduce:transition-none ${
      pressed ? "bg-ink text-paper" : "text-ink hover:bg-ink/[0.06]"
    }`

  return createPortal(
    <div
      ref={toolbarRef}
      role={linking ? "group" : "toolbar"}
      aria-label={linking ? "Link" : "Text style"}
      style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: "hidden" }}
      onBlur={(event) => {
        if (linking && !event.currentTarget.contains(event.relatedTarget)) onLeave()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && linking) {
          event.preventDefault()
          onCancelLink()
        }
      }}
      className="glass glass-frost fixed z-50 rounded-full p-1 shadow-[0_6px_24px_-8px_rgb(17_19_24/0.3)]"
    >
      {linking ? (
        <form onSubmit={submit} className="flex items-center gap-1 pl-2">
          <input
            ref={input}
            type="text"
            inputMode="url"
            defaultValue={editingLink.replace(/^https:\/\//, "").replace(/^mailto:/, "")}
            placeholder="Paste a link"
            aria-label="Link address"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? problemId : undefined}
            autoCapitalize="off"
            spellCheck={false}
            onChange={() => setProblem("")}
            className="h-8 w-52 min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2/60"
          />
          <button
            type="submit"
            onPointerDown={keepSelection}
            onMouseDown={keepSelection}
            className="h-8 rounded-full bg-ink px-3 text-[14px] font-medium text-paper"
          >
            {editingLink ? "Save" : "Add"}
          </button>
          {editingLink && (
            <button
              type="button"
              onPointerDown={keepSelection}
              onMouseDown={keepSelection}
              onClick={() => onLink("")}
              className="h-8 rounded-full px-3 text-[14px] text-ink hover:bg-ink/[0.06]"
            >
              Remove
            </button>
          )}
          {problem && (
            <p
              id={problemId}
              role="alert"
              className="absolute left-3 top-full mt-1.5 rounded-full bg-ink px-2.5 py-1 text-[13px] text-paper"
            >
              {problem}
            </p>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-pressed={(words.style & BOLD) > 0}
            aria-label="Bold"
            title={`Bold (${key("B")})`}
            onPointerDown={keepSelection}
            onMouseDown={keepSelection}
            onClick={() => onToggle(BOLD)}
            className={`${button((words.style & BOLD) > 0)} font-bold`}
          >
            B
          </button>
          <button
            type="button"
            aria-pressed={(words.style & ITALIC) > 0}
            aria-label="Italic"
            title={`Italic (${key("I")})`}
            onPointerDown={keepSelection}
            onMouseDown={keepSelection}
            onClick={() => onToggle(ITALIC)}
            className={`${button((words.style & ITALIC) > 0)} font-serif italic`}
          >
            I
          </button>
          <button
            type="button"
            aria-pressed={(words.style & UNDERLINE) > 0}
            aria-label="Underline"
            title={`Underline (${key("U")})`}
            onPointerDown={keepSelection}
            onMouseDown={keepSelection}
            onClick={() => onToggle(UNDERLINE)}
            className={`${button((words.style & UNDERLINE) > 0)} underline underline-offset-2`}
          >
            U
          </button>
          <button
            type="button"
            aria-pressed={words.link !== ""}
            aria-label="Link"
            title={`Link (${key("K")})`}
            onPointerDown={keepSelection}
            onMouseDown={keepSelection}
            onClick={onEditLink}
            className={button(words.link !== "")}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
