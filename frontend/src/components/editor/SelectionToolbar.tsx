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
  /** The address being typed for the words, while the link box is open: their own, or "" for a new link. */
  editingLink: string | null
  onToggle: (style: Style) => void
  /** Opens the link box, as the link button does for words with no link, or a click in the address does. */
  onEditLink: () => void
  /** Links the words to an address linkAddress has made of what was typed, or with "", unlinks them. */
  onLink: (address: string) => void
  onCancelLink: () => void
  /** Focus left the link box for somewhere else. */
  onLeave: () => void
  /** The toolbar's element, so the box can tell focus moving into it from focus leaving. */
  toolbarRef: React.RefObject<HTMLDivElement | null>
  /** Only the link button and address, for a link pointed at on the preview (PdfPreview.tsx). */
  linkOnly?: boolean
  /** The pointer came onto the toolbar (true) or left it. */
  onPointerOver?: (over: boolean) => void
}

const GAP = 8
// Kept this far from the window's sides.
const MARGIN = 8

const key = (letter: string) => (onMac() ? `⌘${letter}` : `Ctrl+${letter}`)

/** An address as the link box shows it, without the https:// or mailto: linkAddress puts back. */
const shown = (address: string) => address.replace(/^https:\/\//, "").replace(/^mailto:/, "")

// A button that leaves focus where it is, in the box or the link box: pressing it would otherwise move
// focus to it, or in Safari, which doesn't focus a button, nowhere, and the link box would close.
const keepSelection = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault()

/**
 * Bold, italic and underline buttons over the words selected in a box
 * (StyledBox.tsx), then the link button, with the address beside it while
 * the words are linked or one is being pasted in. The link button adds a
 * link, or takes it off. Above the words, or below them where there's no
 * room, or on a touch screen, where the phone's own menu shows above them.
 * It stays inside the box's sides, and the window's.
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
  linkOnly = false,
  onPointerOver,
}: SelectionToolbarProps) {
  // `glide`: moved because the address opened or shut, which slides it across with the address.
  const [place, setPlace] = useState<{ top: number; left: number; glide: boolean } | null>(null)
  const [problem, setProblem] = useState("")
  const [typed, setTyped] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const problemId = useId()
  const linking = editingLink !== null
  const linked = words.link !== ""
  // The address shows while the words are linked, and while one is being typed for them.
  const withAddress = linked || linking
  const parts = `${withAddress} ${linking}`
  const placedFor = useRef(parts)
  // What the address and its button said, kept on them as they slide shut.
  const lastAddress = useRef("")
  const lastSubmit = useRef("Add")
  if (withAddress) lastAddress.current = linking ? typed : shown(words.link)
  if (linking) lastSubmit.current = editingLink ? "Save" : "Add"

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    const { height } = toolbar.getBoundingClientRect()
    // Placed for the width it's sliding to as the address opens or shuts, not the one it starts at.
    let width = toolbar.getBoundingClientRect().width
    for (const grow of toolbar.querySelectorAll<HTMLElement>("[data-grow]")) {
      const inside = grow.firstElementChild as HTMLElement
      width += (grow.dataset.grow === "open" ? inside.scrollWidth : 0) - inside.getBoundingClientRect().width
    }
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
    const glide = placedFor.current !== parts
    placedFor.current = parts
    setPlace((old) => (old?.top === top && old.left === left ? old : { top, left, glide: old !== null && glide }))
  }, [words, parts, toolbarRef])

  // The field starts on the words' own address, as the link box opens. It's
  // already focused when a click in it opened the box.
  const opening = useRef(editingLink)
  opening.current = editingLink
  useLayoutEffect(() => {
    if (opening.current === null) return
    setProblem("")
    setTyped(shown(opening.current))
    if (document.activeElement !== input.current) {
      input.current?.focus()
      // Selected once it holds the address, after this render.
      requestAnimationFrame(() => input.current?.select())
    }
  }, [linking])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!typed.trim()) return onLink("")
    const address = linkAddress(typed)
    if (!address) return setProblem("Paste a web or email address.")
    onLink(address)
  }

  // On words with a link, the button takes it off; on words without one, it opens the field to paste one in, or closes it again.
  const pressLink = () => {
    if (linked) onLink("")
    else if (linking) onCancelLink()
    else onEditLink()
  }

  const button = (pressed: boolean) =>
    `inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[15px] leading-none transition-colors duration-150 motion-reduce:transition-none ${
      pressed ? "bg-ink text-paper" : "text-ink hover:bg-ink/[0.06]"
    }`

  // What slides open beside the link button, and shut again: grid's 0fr to 1fr is the width of what's in it, which
  // `width` can't go to. Shut, it's hidden and can't be reached, as if it weren't there; its margin takes back
  // the form's gap, and what's in it puts one back. It's shown at once as it opens, so the address can take
  // focus, and hidden only once it has slid shut.
  const grow = (open: boolean, children: React.ReactNode) => (
    <div
      data-grow={open ? "open" : "shut"}
      inert={!open}
      className={`-ml-0.5 grid duration-[220ms] ease-glide motion-reduce:transition-none ${
        open
          ? "visible grid-cols-[1fr] opacity-100 transition-[grid-template-columns,opacity]"
          : "invisible grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity,visibility]"
      }`}
    >
      <div className="flex min-w-0 items-center overflow-hidden">{children}</div>
    </div>
  )

  const styleButton = (style: Style, label: string, letter: string, look: string, text: string) => (
    <button
      type="button"
      aria-pressed={(words.style & style) > 0}
      aria-label={label}
      title={`${label} (${key(letter)})`}
      onPointerDown={keepSelection}
      onMouseDown={keepSelection}
      onClick={() => onToggle(style)}
      className={`${button((words.style & style) > 0)} ${look}`}
    >
      {text}
    </button>
  )

  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={linkOnly ? "Link" : "Text style"}
      style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: "hidden" }}
      onPointerEnter={onPointerOver && (() => onPointerOver(true))}
      onPointerLeave={onPointerOver && (() => onPointerOver(false))}
      onBlur={(event) => {
        if (linking && !event.currentTarget.contains(event.relatedTarget)) onLeave()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && linking) {
          event.preventDefault()
          onCancelLink()
        }
      }}
      className={`glass glass-frost fixed z-50 rounded-full p-1 shadow-[0_6px_24px_-8px_rgb(17_19_24/0.3)] ${
        place?.glide ? "transition-[left] duration-[220ms] ease-glide motion-reduce:transition-none" : ""
      }`}
    >
      <form onSubmit={submit} className="flex items-center gap-0.5">
        {!linkOnly && (
          <>
            {styleButton(BOLD, "Bold", "B", "font-bold", "B")}
            {styleButton(ITALIC, "Italic", "I", "font-serif italic", "I")}
            {styleButton(UNDERLINE, "Underline", "U", "underline underline-offset-2", "U")}
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink/10" />
          </>
        )}
        <button
          type="button"
          aria-pressed={withAddress}
          aria-label="Link"
          title={linked ? "Remove link" : `Link (${key("K")})`}
          onPointerDown={keepSelection}
          onMouseDown={keepSelection}
          onClick={pressLink}
          className={button(withAddress)}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </button>
        {grow(
          withAddress,
          <>
            <input
              ref={input}
              type="text"
              inputMode="url"
              value={withAddress ? (linking ? typed : shown(words.link)) : lastAddress.current}
              placeholder="Paste a link"
              aria-label="Link address"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              autoCapitalize="off"
              spellCheck={false}
              // A click in the address opens the link box, to change it.
              onFocus={() => {
                if (!linking) onEditLink()
              }}
              onChange={(event) => {
                setTyped(event.target.value)
                setProblem("")
              }}
              className="ml-0.5 h-8 w-48 min-w-0 shrink-0 rounded-full bg-transparent px-2 text-[15px] text-ink outline-none placeholder:text-ink-2/60 focus:bg-white/60"
            />
            {grow(
              linking,
              <button
                type="submit"
                onPointerDown={keepSelection}
                onMouseDown={keepSelection}
                className="ml-1 h-8 shrink-0 rounded-full bg-ink px-3 text-[14px] font-medium text-paper"
              >
                {lastSubmit.current}
              </button>,
            )}
          </>,
        )}
        {problem && (
          <p id={problemId} role="alert" className="absolute left-3 top-full mt-1.5 rounded-full bg-ink px-2.5 py-1 text-[13px] text-paper">
            {problem}
          </p>
        )}
      </form>
    </div>,
    document.body,
  )
}
