"use client"

import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { onMac } from "@/lib/keys"
import { drawBox, htmlOf, readBox, selectIn, selectionIn, targetIn } from "./boxDom"
import { scrollerOf, visibleArea } from "./layout"
import { SelectionToolbar, type SelectedWords } from "./SelectionToolbar"
import {
  BOLD,
  hasWords,
  ITALIC,
  joinedBack,
  joinedForward,
  linkAround,
  linked,
  movedLine,
  pasted,
  removed,
  sameStyled,
  settled,
  slice,
  split,
  styleAt,
  styled,
  styledOf,
  styleOver,
  stylesOver,
  toggled,
  typed,
  UNDERLINE,
  type Kind,
  type Style,
  type Styled,
  type StyledEdit,
} from "./styledText"

// A text box can't show bold words, so this box is an editable div that draws
// its text itself (boxDom.ts). The browser's own editing would write any HTML
// it likes into it, so each edit is stopped before it happens (beforeinput),
// made to the text (styledText.ts), saved, and drawn. Only words an input
// method composes (Chinese, Japanese, a phone's keyboard) are left to the
// browser, as they can't be stopped, and read back once they're done. Undo is
// the box's own, as the browser's can't undo what it didn't do.

interface Shown {
  /** The field's saved text, with its marks: what the box last saved, or was given. */
  saved: string
  styled: Styled
}

interface Snapshot extends Shown {
  start: number
  end: number
}

interface Range {
  start: number
  end: number
}

/** What can be done to words in a box from outside it, without moving its selection or focus. */
export interface BoxStyler {
  stylesOver: (start: number, end: number) => { style: Style; link: string }
  toggle: (start: number, end: number, style: Style) => void
  /** Links the words to `address`, or with "", unlinks them. */
  link: (start: number, end: number, address: string) => void
}

/** Each box on the page, for styling words picked on the preview (pickedStyle.ts). */
export const boxStylers = new WeakMap<HTMLElement, BoxStyler>()

/** "type" and "delete" steps in a row are undone together, as in a text box. */
type StepKind = "type" | "delete" | "other"

interface Step {
  kind: StepKind
  before: Snapshot
  after: Snapshot
  at: number
}

// Typing that carries on where the last keystroke left off, this soon after
// it, is undone with it.
const TYPING_MS = 1000
const UNDO_STEPS = 200

// What was last copied or cut from a box. Pasted back, its words keep their
// bold and italic, and in a bullets box, its "○" bullets stay left out.
let copied: Styled | undefined

// What the PDF can't print, which the box ignores, as it does formatting other than its own. A link is
// made with the box's own button and ⌘K, which ask for its address.
const IGNORED = new Set(["insertOrderedList", "insertUnorderedList", "insertHorizontalRule", "insertLink"])
// Typing, pasting, Enter and undo, which the box makes itself, as it does
// formatting and deletes (madeHere), when the browser says what they reach.
const MADE_HERE = new Set([
  ...IGNORED,
  "historyUndo",
  "historyRedo",
  "insertParagraph",
  "insertLineBreak",
  "insertText",
  "insertReplacementText",
  "insertFromPaste",
  "insertFromPasteAsQuotation",
  "insertFromYank",
  "insertFromDrop",
])

// An input method's words, which the browser puts in itself as it composes them and once it's done.
const COMPOSED = new Set(["insertCompositionText", "deleteCompositionText", "insertFromComposition"])

/**
 * Whether the box makes an edit of this kind itself. Anything else, as
 * swapping two letters with Ctrl+T, the browser does, and it's read back.
 */
const madeHere = (type: string) => !COMPOSED.has(type) && (MADE_HERE.has(type) || type.startsWith("format") || type.startsWith("delete"))

/** Scrolls just enough to show the cursor clear of the pinned bars, as the browser does after its own edits. */
function revealCursor(box: HTMLElement) {
  const selection = box.ownerDocument.getSelection()
  if (!selection?.rangeCount || box.ownerDocument.activeElement !== box) return
  let rect = selection.getRangeAt(0).getBoundingClientRect()
  // A cursor on an empty line has no box of its own.
  if (!rect.height) {
    const node = selection.focusNode
    rect = (node instanceof Element ? node : node?.parentElement)?.getBoundingClientRect() ?? rect
  }
  if (!rect.height) return
  const scroller = scrollerOf(box)
  const view = visibleArea(scroller)
  // A phone's keyboard covers the bottom of the window without making it shorter.
  const keyboard = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : Infinity
  const bottom = Math.min(view.bottom, keyboard)
  const by = rect.bottom > bottom ? rect.bottom - bottom + 16 : rect.top < view.top ? rect.top - view.top - 16 : 0
  if (by) scroller.scrollBy({ top: by })
}

interface StyledBoxProps {
  kind: Kind
  id: string
  value: string
  onChange: (value: string) => void
  labelId: string
  describedBy?: string
  invalid: boolean
  placeholder?: string
  /** Its look, with a min-height for the lines it shows while empty. */
  className: string
}

/**
 * A box for bullets or prose, which shows styled and linked words as they
 * print, without their marks. Selecting words shows a toolbar over them
 * (SelectionToolbar.tsx) with the styles ⌘B, ⌘I, ⌘U and ⌘K set.
 */
export function StyledBox({ kind, id, value, onChange, labelId, describedBy, invalid, placeholder, className }: StyledBoxProps) {
  const root = useRef<HTMLDivElement>(null)
  const shown = useRef<Shown | null>(null)
  const history = useRef<{ done: Step[]; undone: Step[] }>({ done: [], undone: [] })
  // While an input method composes words, the box's text is the browser's,
  // and stays so until it's been read back: Safari ends composing, then puts
  // the words in, so the box waits for both before it draws again.
  const composing = useRef(false)
  const unread = useRef(false)
  const [composingWords, setComposingWords] = useState(false)
  const change = useRef(onChange)
  change.current = onChange
  // The words selected, for the toolbar over them, and while the link box is
  // open, the words it links and their address ("" for a new link).
  const [selectedWords, setSelectedWords] = useState<SelectedWords | null>(null)
  const [linking, setLinking] = useState<(Range & { address: string }) | null>(null)
  const linkingNow = useRef(linking)
  linkingNow.current = linking
  const toolbar = useRef<HTMLDivElement>(null)
  // What the toolbar's buttons do, set by the effect that makes edits.
  const actions = useRef<{ toggle: (style: Style) => void; link: (range: Range, address: string) => void; editLink: () => void } | null>(
    null,
  )

  // Text the box didn't save (the first, or a change from another tab):
  // shown as given, with nothing to undo, as a text box does.
  if (shown.current?.saved !== value) {
    shown.current = { saved: value, styled: styledOf(value, kind) }
    history.current = { done: [], undone: [] }
  }
  const empty = shown.current.styled.text === ""

  // Draws whatever the box should show that it doesn't yet: the first text,
  // or one from elsewhere, keeping the cursor where it was.
  useLayoutEffect(() => {
    const box = root.current
    if (!box || !shown.current || composing.current || unread.current) return
    const selection = box.ownerDocument.activeElement === box ? selectionIn(box) : null
    if (!drawBox(box, shown.current.styled) || !selection) return
    const length = shown.current.styled.text.length
    selectIn(box, Math.min(selection.start, length), Math.min(selection.end, length))
  })

  useEffect(() => {
    const box = root.current
    if (!box) return
    // Where the selection last was, for an edit the browser made itself, by the time it's read back.
    let selected: Range = { start: 0, end: 0 }
    // A style chosen with ⌘B or ⌘I and nothing selected, for the words typed next at `at`.
    let pending: { at: number; style: Style } | null = null
    // Where the selection was as an input method started composing.
    let beforeComposing: Range = selected
    // The pending style there, for the words composed. It's kept apart, as the
    // cursor moves on as the words go in, which takes `pending` away.
    let composedStyle: Style | null = null
    let readSoon = 0

    const current = () => shown.current!
    const selection = (): Range => selectionIn(box) ?? selected

    /** Shows the toolbar over the words selected, with their styles, or hides it when none are. */
    const placeToolbar = () => {
      // While the link box is open, focus is in it, and the words stay as they were.
      if (linkingNow.current) return
      const range = composing.current || box.ownerDocument.activeElement !== box ? null : selectionIn(box)
      const domSelection = box.ownerDocument.getSelection()
      if (!range || range.start === range.end || !domSelection?.rangeCount) return setSelectedWords(null)
      const rect = domSelection.getRangeAt(0).getBoundingClientRect()
      const sides = box.getBoundingClientRect()
      const { style, link } = stylesOver(current().styled, range.start, range.end, kind)
      setSelectedWords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        boxLeft: sides.left,
        boxRight: sides.right,
        style,
        link,
      })
    }

    const show = (s: Styled, start: number, end: number) => {
      drawBox(box, s)
      selectIn(box, start, end)
      selected = { start, end }
      revealCursor(box)
      placeToolbar()
    }

    const record = (step: StepKind, before: Snapshot, after: Snapshot) => {
      const { done } = history.current
      const last = done[done.length - 1]
      const now = Date.now()
      const carriesOn =
        last &&
        step !== "other" &&
        last.kind === step &&
        now - last.at < TYPING_MS &&
        last.after.saved === before.saved &&
        last.after.start === before.start &&
        last.after.end === before.end
      history.current = {
        done: carriesOn
          ? [...done.slice(0, -1), { ...last, after, at: now }]
          : [...done, { kind: step, before, after, at: now }].slice(-UNDO_STEPS),
        undone: [],
      }
    }

    /** Makes an edit: settled (bullets, and marks shown as they print), saved, drawn, and remembered to undo. */
    const commit = (edit: StyledEdit, step: StepKind, before: Range) => {
      const was = current()
      const { edit: next, saved, next: nextStyle } = settled(edit, was.saved, kind)
      pending = nextStyle === undefined ? null : { at: next.start, style: nextStyle }
      if (saved !== was.saved || !sameStyled(next, was.styled)) {
        record(step, { ...was, ...before }, { saved, styled: next, start: next.start, end: next.end })
        shown.current = { saved, styled: next }
      }
      show(next, next.start, next.end)
      if (saved !== was.saved) change.current(saved)
    }

    const restore = (snapshot: Snapshot) => {
      const was = current()
      pending = null
      shown.current = { saved: snapshot.saved, styled: snapshot.styled }
      show(snapshot.styled, snapshot.start, snapshot.end)
      if (snapshot.saved !== was.saved) change.current(snapshot.saved)
    }

    const undo = () => {
      const { done, undone } = history.current
      const step = done[done.length - 1]
      if (!step) return
      history.current = { done: done.slice(0, -1), undone: [...undone, step] }
      restore(step.before)
    }

    const redo = () => {
      const { done, undone } = history.current
      const step = undone[undone.length - 1]
      if (!step) return
      history.current = { done: [...done, step], undone: undone.slice(0, -1) }
      restore(step.after)
    }

    // Bold, italic or underline on the words selected, or with none, on the words typed next.
    const toggle = (style: Style) => {
      const before = selection()
      const s = current().styled
      const edit = toggled(s, before.start, before.end, style, kind)
      if (edit) return commit(edit, "other", before)
      const now = pending?.at === before.start ? pending.style : styleAt(s, before.start, kind)
      pending = { at: before.start, style: now ^ style }
    }

    // The link box, for the words selected, or with none, the link the cursor is in.
    const editLink = () => {
      const before = selection()
      const s = current().styled
      const around = before.start === before.end ? linkAround(s, before.start) : undefined
      const range = around ?? before
      if (!hasWords(s, range.start, range.end, kind)) return
      if (around) {
        selectIn(box, around.start, around.end)
        selected = { start: around.start, end: around.end }
      }
      placeToolbar()
      setLinking({ ...range, address: around?.address ?? stylesOver(s, range.start, range.end, kind).link })
    }

    // Links the words to `address`, or unlinks them with "", and puts the selection back on them.
    const link = (range: Range, address: string) => {
      setLinking(null)
      linkingNow.current = null
      box.focus({ preventScroll: true })
      const edit = linked(current().styled, range.start, range.end, address, kind)
      if (edit) commit(edit, "other", range)
      else show(current().styled, range.start, range.end)
    }

    actions.current = { toggle, link, editLink }

    // The same, on words picked on the preview, which stay selected there: an
    // edit like any other, undone with ⌘Z here, that leaves the box's own
    // selection where it was, and focus where it is.
    const quietly = (edit: StyledEdit | undefined, range: Range) => {
      if (!edit) return
      const was = current()
      const { edit: next, saved } = settled(edit, was.saved, kind)
      if (saved === was.saved && sameStyled(next, was.styled)) return
      record("other", { ...was, ...range }, { saved, styled: next, start: range.start, end: range.end })
      shown.current = { saved, styled: next }
      const cursor = box.ownerDocument.activeElement === box ? selectionIn(box) : null
      drawBox(box, next)
      if (cursor) selectIn(box, cursor.start, cursor.end)
      if (saved !== was.saved) change.current(saved)
    }
    boxStylers.set(box, {
      stylesOver: (start, end) => stylesOver(current().styled, start, end, kind),
      toggle: (start, end, style) => quietly(toggled(current().styled, start, end, style, kind), { start, end }),
      link: (start, end, address) => quietly(linked(current().styled, start, end, address, kind), { start, end }),
    })

    /** Reads back what the browser changed itself, and makes it an edit. */
    const readBack = (before: Range) => {
      unread.current = false
      const style = composedStyle
      composedStyle = null
      const points = []
      const domSelection = box.ownerDocument.getSelection()
      if (domSelection?.anchorNode && domSelection.focusNode) {
        points.push({ node: domSelection.anchorNode, offset: domSelection.anchorOffset })
        points.push({ node: domSelection.focusNode, offset: domSelection.focusOffset })
      }
      const { styled: read, offsets } = readBox(box, points)
      const was = current().styled
      if (sameStyled(read, was)) return
      const found = offsets.filter((offset) => offset >= 0)
      const start = found.length ? Math.min(...found) : read.text.length
      const end = found.length ? Math.max(...found) : start
      // The browser puts composed words in the style of the text they're
      // typed into. Where ⌘B or ⌘I chose another for them, they take that.
      const at = before.start
      const added = read.text.length - was.text.length
      const inserted = style !== null && added > 0 && read.text.startsWith(was.text.slice(0, at)) && read.text.endsWith(was.text.slice(at))
      const styles = inserted ? read.styles.map((old, index) => (index >= at && index < at + added ? style : old)) : read.styles
      commit({ text: read.text, styles, start, end }, "type", before)
    }

    const onBeforeInput = (event: InputEvent) => {
      // Words an input method is composing are the browser's to change, and
      // so are edits it won't let go of: either is read back once it's done.
      const type = event.inputType
      if (composing.current || event.isComposing || !event.cancelable || !madeHere(type)) return
      // Words just composed are read back first, so the edit is made to them.
      if (unread.current) readBack(beforeComposing)
      const before = selection()
      const s = current().styled
      if (type === "historyUndo" || type === "historyRedo") {
        event.preventDefault()
        return type === "historyUndo" ? undo() : redo()
      }
      if (type === "formatBold" || type === "formatItalic" || type === "formatUnderline") {
        event.preventDefault()
        return toggle(type === "formatBold" ? BOLD : type === "formatItalic" ? ITALIC : UNDERLINE)
      }
      if (type.startsWith("format") || IGNORED.has(type)) return event.preventDefault()
      if (type === "insertParagraph" || type === "insertLineBreak") {
        event.preventDefault()
        const { start, end } = targetIn(box, event) ?? before
        return commit(split(s, start, end, kind), "other", before)
      }
      const words = (event.data ?? event.dataTransfer?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n")
      if (type === "insertText" || type === "insertReplacementText") {
        // A spelling suggestion replaces its word, which only the browser knows; without it, it's left to the browser.
        const target = targetIn(box, event) ?? (type === "insertText" ? before : null)
        if (!target) return
        event.preventDefault()
        const { start, end } = target
        if (!words) return start < end ? commit(removed(s, start, end), "delete", before) : undefined
        const style = start < end ? styleOver(s, start, end, kind) : pending?.at === start ? pending.style : styleAt(s, start, kind)
        return commit(typed(s, start, end, words, style, kind), "type", before)
      }
      if (type === "insertFromPaste" || type === "insertFromPasteAsQuotation" || type === "insertFromYank" || type === "insertFromDrop") {
        event.preventDefault()
        // A drop goes where it's dropped, which only the browser knows.
        const target = targetIn(box, event) ?? (type === "insertFromDrop" ? null : before)
        if (!target || !words) return
        const own = copied?.text === words ? copied : undefined
        return commit(pasted(s, target.start, target.end, own ?? styled(words), !!own, kind), "other", before)
      }
      if (type.startsWith("delete")) {
        // Backspace at the start of a bullet's words joins them to the line
        // above, and Delete at the end of a line brings the next one up,
        // without its bullet, as in word processors.
        const collapsed = before.start === before.end
        const joined =
          kind !== "bullets"
            ? undefined
            : collapsed && type.endsWith("Backward")
              ? joinedBack(s.text, before.start)
              : collapsed && type.endsWith("Forward")
                ? joinedForward(s.text, before.start)
                : undefined
        const target = joined ? { start: joined[0], end: joined[1] } : (targetIn(box, event) ?? (collapsed ? null : before))
        // How far a delete reaches (a letter, a word, a line) is the browser's to say. When it doesn't, it deletes it itself.
        if (!target || target.start === target.end) return
        event.preventDefault()
        return commit(removed(s, target.start, target.end), "delete", before)
      }
    }

    const onInput = () => {
      if (!composing.current) readBack(unread.current ? beforeComposing : selected)
    }

    const onCompositionStart = () => {
      // Words composed just before, not read back yet, are read back now.
      if (unread.current) readBack(beforeComposing)
      composing.current = true
      setComposingWords(true)
      beforeComposing = selection()
      const { start, end } = beforeComposing
      composedStyle = pending && start === end && pending.at === start ? pending.style : null
    }

    const onCompositionEnd = () => {
      composing.current = false
      unread.current = true
      setComposingWords(false)
      // Chrome is done with the words by now, but Safari puts them in next.
      clearTimeout(readSoon)
      readSoon = window.setTimeout(() => unread.current && readBack(beforeComposing))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || composing.current) return
      if (unread.current) readBack(beforeComposing)
      const key = event.key.toLowerCase()
      const command = event.metaKey || event.ctrlKey
      if (command && !event.altKey && !event.shiftKey && (key === "b" || key === "i" || key === "u")) {
        event.preventDefault()
        toggle(key === "b" ? BOLD : key === "i" ? ITALIC : UNDERLINE)
      } else if (command && !event.altKey && !event.shiftKey && key === "k") {
        event.preventDefault()
        editLink()
      } else if (command && !event.altKey && key === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (event.ctrlKey && !event.metaKey && !event.altKey && key === "y" && !onMac()) {
        event.preventDefault()
        redo()
      } else if (
        kind === "bullets" &&
        event.altKey &&
        !event.shiftKey &&
        !command &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        // With Shift, Alt+↑ and Alt+↓ select (on a Mac); at either end they move the cursor as usual.
        const before = selection()
        const edit = movedLine(current().styled, before.start, event.key === "ArrowUp" ? -1 : 1)
        if (!edit) return
        event.preventDefault()
        commit(edit, "other", before)
      }
    }

    const copy = (event: ClipboardEvent): Range | undefined => {
      if (unread.current) readBack(beforeComposing)
      const range = selectionIn(box)
      if (!range || range.start === range.end) return undefined
      const words = slice(current().styled, range.start, range.end)
      copied = words
      // A copy made by a script has nothing to put the words on.
      if (event.clipboardData) {
        event.preventDefault()
        event.clipboardData.setData("text/plain", words.text)
        event.clipboardData.setData("text/html", htmlOf(words))
      }
      return range
    }

    const onCut = (event: ClipboardEvent) => {
      const range = copy(event)
      if (!range) return
      event.preventDefault()
      commit(removed(current().styled, range.start, range.end), "other", range)
    }

    const onSelectionChange = () => {
      const range = composing.current ? null : selectionIn(box)
      placeToolbar()
      if (!range) return
      selected = range
      if (pending && (range.start !== pending.at || range.end !== pending.at)) pending = null
    }

    // Focus moving into the toolbar keeps it; anywhere else, it goes.
    const onFocusOut = (event: FocusEvent) => {
      if (!toolbar.current?.contains(event.relatedTarget as Node | null)) setSelectedWords(null)
    }

    // Dragging words would move them without the box's say.
    const onDragStart = (event: DragEvent) => event.preventDefault()

    box.addEventListener("beforeinput", onBeforeInput)
    box.addEventListener("input", onInput)
    box.addEventListener("compositionstart", onCompositionStart)
    box.addEventListener("compositionend", onCompositionEnd)
    box.addEventListener("keydown", onKeyDown)
    box.addEventListener("copy", copy)
    box.addEventListener("cut", onCut)
    box.addEventListener("dragstart", onDragStart)
    box.addEventListener("focusout", onFocusOut)
    document.addEventListener("selectionchange", onSelectionChange)
    // Scrolling anything moves the words; the toolbar follows them.
    window.addEventListener("scroll", placeToolbar, { capture: true, passive: true })
    window.addEventListener("resize", placeToolbar)
    return () => {
      box.removeEventListener("beforeinput", onBeforeInput)
      box.removeEventListener("input", onInput)
      box.removeEventListener("compositionstart", onCompositionStart)
      box.removeEventListener("compositionend", onCompositionEnd)
      box.removeEventListener("keydown", onKeyDown)
      box.removeEventListener("copy", copy)
      box.removeEventListener("cut", onCut)
      box.removeEventListener("dragstart", onDragStart)
      box.removeEventListener("focusout", onFocusOut)
      document.removeEventListener("selectionchange", onSelectionChange)
      window.removeEventListener("scroll", placeToolbar, { capture: true })
      window.removeEventListener("resize", placeToolbar)
      clearTimeout(readSoon)
      boxStylers.delete(box)
    }
  }, [kind])

  const hint = placeholder && (kind === "bullets" ? `• ${placeholder}` : placeholder)
  const closeLink = (focusBox: boolean) => {
    const range = linking
    setLinking(null)
    linkingNow.current = null
    if (!focusBox || !range || !root.current) return setSelectedWords(null)
    root.current.focus({ preventScroll: true })
    selectIn(root.current, range.start, range.end)
  }
  return (
    <>
      <div
        ref={root}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-placeholder={hint || undefined}
        // Empty, it shows its placeholder (.styled-box in globals.css), but not over words being composed.
        data-empty={hint && empty && !composingWords ? "" : undefined}
        style={hint ? ({ "--placeholder": JSON.stringify(hint) } as React.CSSProperties) : undefined}
        contentEditable
        spellCheck
        // Translating the page would rewrite the words, and then save them.
        translate="no"
        className={`styled-box relative cursor-text whitespace-pre-wrap break-words [&_a]:text-inherit [&_a]:no-underline [&_strong]:font-semibold [&_u]:underline-offset-2 ${className}`}
      />
      {selectedWords && (
        <SelectionToolbar
          words={selectedWords}
          editingLink={linking && linking.address}
          onToggle={(style) => actions.current?.toggle(style)}
          onEditLink={() => actions.current?.editLink()}
          onLink={(address) => linking && actions.current?.link(linking, address)}
          onCancelLink={() => closeLink(true)}
          onLeave={() => closeLink(false)}
          toolbarRef={toolbar}
        />
      )}
    </>
  )
}
