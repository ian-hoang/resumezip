"use client"

import type React from "react"
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react"
import type { Finding } from "@/lib/check/engine"
import { LEVELS, type Level } from "@/lib/check/settings"
import { plainText } from "@/lib/typst/resumeData"
import {
  bulletLines,
  cursorWithBullets,
  lineStartOf,
  moveBullet,
  moveLine,
  newBullet,
  nextAnnouncement,
  pastedList,
  setLeftOutLine,
  toggleMark,
  typedList,
  withBullets,
  type Edited,
} from "./arrange"
import { reducedMotion, reveal, scrollerOf } from "./layout"

interface FieldProps {
  label: string
  value: string
  placeholder?: string
  type?: string
  className?: string
  onChange: (value: string) => void
  /** The field's key, so the checker can find it on the page. */
  name?: string
  /** What the checker found here, while the person is fixing it. */
  flag?: Finding | null
  /** Counts up each time the person chooses `flag`'s finding, as the checker's requests do. */
  request?: number
  /** What the browser can fill it in with, as "name", "email" or "tel". */
  autoComplete?: string
  /** A web address: phones show the keyboard for one, with no spelling marks and no capital first letter. */
  web?: boolean
  /** A few lines of prose: a box that grows with them, where Enter starts a new line. */
  multiline?: boolean
}

/**
 * A small pill for a finding's level: red for a must-fix, the one thing that
 * holds the score down, so it stands out; grey for a suggestion.
 */
export const levelPill = (level: Level) =>
  `inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium leading-none ${
    level === "fix" ? "bg-alert text-white" : "bg-ink/[0.06] text-ink"
  }`

/**
 * What the checker found where the person is fixing it, and why it matters.
 * It says how sure the checker is in words, so the field's color isn't the
 * only sign. Its lines are balanced, as a sentence a little too long for the
 * box would otherwise leave a word or two on a line of its own.
 */
export function FlagNote({ id, finding }: { id?: string; finding: Finding }) {
  return (
    <div
      id={id}
      className="flex flex-col gap-2 rounded-[4px] border border-rule bg-sheet px-3 py-2.5 text-[13px] leading-normal text-balance"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
        <span className={levelPill(finding.level)}>{LEVELS[finding.level].name}</span>
        {finding.message}
      </p>
      <p className="text-ink-2">{finding.why}</p>
      {finding.suggestion && <p className="text-ink-2">{finding.suggestion}</p>}
    </div>
  )
}

/** A labelled, underlined text input, or a box for a few lines of prose. */
export function Field({
  label,
  value,
  placeholder,
  type = "text",
  className = "",
  onChange,
  name,
  flag,
  autoComplete,
  web,
  multiline,
}: FieldProps) {
  const noteId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useFitHeight(textareaRef, value)
  const shared = {
    value,
    placeholder,
    "aria-describedby": flag ? noteId : undefined,
    "aria-invalid": flag?.level === "fix" || undefined,
    className: `w-full min-w-0 border-0 bg-transparent py-2 text-base text-ink outline-none transition-colors placeholder:text-ink-2/50 focus-visible:outline-none ${
      !flag ? "border-b border-rule-strong focus:border-accent" : "border-b-2 border-accent"
    }`,
  }
  return (
    <div data-field={name} className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="label-mono text-ink-2">{label}</span>
        {multiline ? (
          <textarea
            ref={textareaRef}
            rows={3}
            onChange={(event) => onChange(event.target.value)}
            {...shared}
            className={`${shared.className} resize-none leading-relaxed`}
          />
        ) : (
          <input
            type={type}
            autoComplete={autoComplete}
            inputMode={web ? "url" : undefined}
            spellCheck={web ? false : undefined}
            autoCapitalize={web ? "off" : undefined}
            onChange={(event) => onChange(event.target.value)}
            {...shared}
          />
        )}
      </label>
      {flag && <FlagNote id={noteId} finding={flag} />}
    </div>
  )
}

/** Where a line starts in a textarea's text. */
const lineStart = (text: string, line: number) =>
  text
    .split("\n")
    .slice(0, line)
    .reduce((total, words) => total + words.length + 1, 0)

/** Selects a line's words in a bullets textarea, after its "• ", to point at one bullet. */
export function selectLine(textarea: HTMLTextAreaElement, line: number) {
  const lines = textarea.value.split("\n")
  if (line < 0 || line >= lines.length) return
  const start = lineStart(textarea.value, line)
  const bullet = lines[line].match(/^[•○]\s*/)?.[0].length ?? 0
  textarea.setSelectionRange(start + bullet, start + lines[line].length)
}

/**
 * Buttons that move something up or down one place in its list. At either
 * end, the button that can't move it stays where it is (and focusable, so
 * the focus isn't lost when something reaches the end), but does nothing.
 * What moved can go past the edge of the screen, or under the bars pinned
 * there, so the screen follows the button.
 */
export function MoveButtons({ name, first, last, onMove }: { name: string; first: boolean; last: boolean; onMove: (by: -1 | 1) => void }) {
  return (
    <span className="flex shrink-0 items-center">
      {([-1, 1] as const).map((by) => {
        const end = by < 0 ? first : last
        const Icon = by < 0 ? ArrowUp : ArrowDown
        return (
          <button
            key={by}
            type="button"
            data-move={by}
            onClick={(event) => {
              if (end) return
              const button = event.currentTarget
              onMove(by)
              requestAnimationFrame(() => reveal(button, scrollerOf(button), reducedMotion()))
            }}
            aria-label={`Move ${name} ${by < 0 ? "up" : "down"}`}
            aria-disabled={end || undefined}
            className="rounded-[4px] p-1.5 text-ink-2 transition-colors hover:text-ink aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:text-ink-2"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      })}
    </span>
  )
}

// Sets a textarea's height to show all its text, so it never scrolls inside.
function fitHeight(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto"
  textarea.style.height = `${textarea.scrollHeight + 2}px`
}

/**
 * Keeps a textarea as tall as its text as the text changes, and as its width
 * does: a narrower box wraps onto more lines, as when the window is resized, a
 * tablet turned, or the box shows after being hidden. `shown` is whatever
 * swaps the textarea for another element and back, so it's measured afresh.
 */
function useFitHeight(ref: React.RefObject<HTMLTextAreaElement | null>, text: string, shown?: unknown) {
  useLayoutEffect(() => {
    if (ref.current) fitHeight(ref.current)
  }, [ref, text, shown])

  useEffect(() => {
    const textarea = ref.current
    if (!textarea) return
    let width = textarea.clientWidth
    let frame = 0
    const observer = new ResizeObserver(() => {
      const next = textarea.clientWidth
      // Hidden while the preview shows on small screens: nothing to fit until it's back.
      if (!next || next === width) return
      width = next
      // On the next frame: changing the box's height while it's being
      // measured would make the browser report a ResizeObserver loop.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fitHeight(textarea))
    })
    observer.observe(textarea)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [ref, shown])
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

// True while typeInto types, so what it types goes in as it is.
let typing = false

// What was last copied or cut from a bullets box. Pasted back, its "○" bullets
// stay left out; a "○" pasted from anywhere else is a sub-bullet, and printed.
let copied: string | undefined

const rememberCopied = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const { selectionStart, selectionEnd, value } = event.currentTarget
  copied = value.slice(selectionStart, selectionEnd)
}

/**
 * Changes a text box's text to `next` as typing would, replacing only the part
 * that changed, so the browser can undo it with the person's own typing.
 * Setting the text any other way clears the browser's undo history. False if
 * the browser can't: execCommand is deprecated, but there's nothing else yet.
 */
function typeInto(textarea: HTMLTextAreaElement, next: string): boolean {
  const current = textarea.value
  let from = 0
  while (from < current.length && from < next.length && current[from] === next[from]) from++
  let same = 0
  while (same < current.length - from && same < next.length - from && current[current.length - 1 - same] === next[next.length - 1 - same])
    same++
  // Never half an emoji: a character made of two code units is replaced whole.
  if (from > 0 && (isLowSurrogate(current.charCodeAt(from)) || isLowSurrogate(next.charCodeAt(from)))) from--
  if (same > 0 && isLowSurrogate(current.charCodeAt(current.length - same))) same--
  textarea.setSelectionRange(from, current.length - same)
  const typed = next.slice(from, next.length - same)
  typing = true
  try {
    return typed ? document.execCommand("insertText", false, typed) : document.execCommand("delete")
  } catch {
    return false
  } finally {
    typing = false
  }
}

const onMac = () => /Mac|iPhone|iPad/.test(navigator.platform)

// A keyboard shortcut as this device writes it: ⌘B on a Mac, Ctrl+B elsewhere.
const shortcut = (key: string) => (onMac() ? `⌘${key}` : `Ctrl+${key}`)

// With Option on a Mac, Alt elsewhere: ⌥↑, Alt+↑.
const altShortcut = (key: string) => (onMac() ? `⌥${key}` : `Alt+${key}`)

/**
 * A textarea for bullet points: one per line, and Enter starts a new bullet.
 * **Bold**, *italic* and ***both*** print that way; ⌘B and ⌘I add or remove
 * the marks. Alt+↑ and Alt+↓ move the line the cursor is on. "Arrange" shows
 * the bullets as a list instead, to move them and leave them out of the PDF.
 */
export function BulletsField({ label, value, placeholder, className = "", onChange, name, flag, request }: FieldProps) {
  const text = withBullets(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaId = useId()
  const hintId = useId()
  const noteId = useId()
  const bullets = bulletLines(text)
  const [arranging, setArranging] = useState(false)
  // Choosing a finding here shows the text, where the cursor goes to it. Only a
  // new choice does: the finding is found afresh each time the checker runs,
  // and it's gone while the person is in Write mode, then back.
  const [shownRequest, setShownRequest] = useState(request)
  if (request !== undefined && request !== shownRequest) {
    setShownRequest(request)
    setArranging(false)
  }
  // Where the cursor goes once the box shows the text it was just given.
  const selection = useRef<[number, number] | null>(null)

  // Grow to fit the text instead of scrolling inside the box (and again when
  // it's back from arranging), then put the cursor where it goes.
  useFitHeight(textareaRef, text, arranging)
  useLayoutEffect(() => {
    if (selection.current) textareaRef.current?.setSelectionRange(...selection.current)
    selection.current = null
  }, [text, arranging])

  const change = useRef(onChange)
  change.current = onChange

  // Gives the box new text, with the cursor (or a selection) where it says. It's
  // typed in, so Ctrl+Z takes it back as it would the person's own typing. If
  // the browser can't type it, it's set through React, which can't be undone.
  const edit = useCallback((textarea: HTMLTextAreaElement, { text: next, start, end }: Edited) => {
    if (next === textarea.value || typeInto(textarea, next)) {
      textarea.setSelectionRange(start, end)
      return
    }
    selection.current = [start, end]
    change.current(next)
  }, [])

  // Words typed or pasted on a line with no bullet get one in the same edit, so
  // Ctrl+Z takes back both at once. (Left to React, the bullet would be added
  // after the edit, which clears the browser's undo history.) A pasted list's
  // own markers become its bullets, so it doesn't get two, and a "- " typed
  // after a bullet goes.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const onBeforeInput = (event: InputEvent) => {
      // Not words still being composed (Chinese, Japanese, a phone's keyboard): those are the input method's.
      if (typing || event.isComposing || (event.inputType !== "insertText" && event.inputType !== "insertFromPaste")) return
      const given = (event.data ?? event.dataTransfer?.getData("text/plain"))?.replace(/\r\n?/g, "\n")
      if (!given) return
      const { selectionStart: start, selectionEnd: end, value } = textarea
      const from = lineStartOf(value, start)
      const before = value.slice(from, start)
      // The line up to the cursor once it's typed or pasted in.
      const head = event.inputType === "insertFromPaste" ? pastedList(given, before, given === copied) : typedList(before, given)
      const typed = value.slice(0, from) + head + value.slice(end)
      const next = withBullets(typed)
      // Nothing to change: the browser puts it in as it is.
      if (next === typed && head === before + given) return
      event.preventDefault()
      const cursor = cursorWithBullets(typed, from + head.length)
      edit(textarea, { text: next, start: cursor, end: cursor })
    }
    textarea.addEventListener("beforeinput", onBeforeInput)
    return () => textarea.removeEventListener("beforeinput", onBeforeInput)
  }, [arranging, edit])

  // Moves the line the cursor is on, keeping the cursor where it was in it. False if it's at that end already.
  const moveCursorLine = (textarea: HTMLTextAreaElement, by: -1 | 1) => {
    const before = text.slice(0, textarea.selectionStart)
    const line = before.split("\n").length - 1
    const column = before.length - (before.lastIndexOf("\n") + 1)
    const to = line + by
    if (to < 0 || to >= text.split("\n").length) return false
    const next = moveLine(text, line, by)
    const cursor = lineStart(next, to) + column
    edit(textarea, { text: next, start: cursor, end: cursor })
    return true
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget
    const { selectionStart: start, selectionEnd: end } = textarea
    const key = event.key.toLowerCase()
    if ((event.metaKey || event.ctrlKey) && !event.altKey && (key === "b" || key === "i")) {
      event.preventDefault()
      edit(textarea, toggleMark(text, start, end, key === "b" ? 2 : 1))
      return
    }
    if (event.nativeEvent.isComposing) return
    // With Shift, Alt+↑ and Alt+↓ select (on a Mac); at either end they move the cursor as usual.
    if (event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      if (moveCursorLine(textarea, event.key === "ArrowUp" ? -1 : 1)) event.preventDefault()
      return
    }
    if (event.key !== "Enter") return
    event.preventDefault()
    edit(textarea, newBullet(text, start, end))
  }

  return (
    <div data-field={name} className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={textareaId} id={`${textareaId}-label`} className="label-mono text-ink-2">
          {label}
        </label>
        {(arranging || bullets.length > 0) && (
          <button
            type="button"
            onClick={() => setArranging(!arranging)}
            aria-label={arranging ? "Done arranging bullets" : "Arrange bullets"}
            className="-my-1.5 inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
          >
            {arranging ? (
              "Done"
            ) : (
              <>
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                Arrange
              </>
            )}
          </button>
        )}
      </div>
      {arranging ? (
        <ArrangedBullets labelId={`${textareaId}-label`} text={text} onChange={onChange} />
      ) : (
        <textarea
          id={textareaId}
          ref={textareaRef}
          aria-describedby={flag ? `${hintId} ${noteId}` : hintId}
          aria-invalid={flag?.level === "fix" || undefined}
          value={text}
          placeholder={placeholder ? `• ${placeholder}` : undefined}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onCopy={rememberCopied}
          onCut={rememberCopied}
          className={`w-full resize-none overflow-hidden rounded-[4px] border bg-sheet px-3.5 py-3 text-[15px] leading-[1.7] text-ink outline-none transition-colors placeholder:text-ink-2/50 focus-visible:outline-none ${
            !flag ? "border-rule focus:border-accent" : "border-accent ring-1 ring-accent"
          }`}
        />
      )}
      {flag && <FlagNote id={noteId} finding={flag} />}
      {!arranging && (
        <span id={hintId} className="text-[13px] leading-normal text-ink-2">
          {window.matchMedia("(pointer: coarse)").matches ? (
            // No keyboard shortcuts on a touch screen, so show the marks to type.
            <>
              <span className="font-mono">**bold**</span> · <span className="font-mono">*italic*</span>
            </>
          ) : (
            <>
              <kbd className="font-mono">{shortcut("B")}</kbd> <strong className="font-semibold text-ink">bold</strong> ·{" "}
              <kbd className="font-mono">{shortcut("I")}</kbd> <em className="text-ink">italic</em> ·{" "}
              <kbd className="font-mono">{altShortcut("↑")}</kbd> <kbd className="font-mono">{altShortcut("↓")}</kbd> move a line
            </>
          )}
          {bullets.some((bullet) => bullet.leftOut) && " · Lines starting with ○ are left out of the PDF."}
        </span>
      )}
    </div>
  )
}

/**
 * The bullets as a list, each with a box to leave it out of the PDF and
 * buttons to move it. A bullet keeps the focus as it moves, so it can be
 * moved again and again from the keyboard.
 */
function ArrangedBullets({ labelId, text, onChange }: { labelId: string; text: string; onChange: (value: string) => void }) {
  const bullets = bulletLines(text)
  // Bullets have no ids, so each gets a key here that moves with it, even
  // past a bullet with the same words. So React moves a bullet's row with it,
  // and the focus goes along. If the bullets change some other way (another
  // tab), they're keyed afresh.
  const [order, setOrder] = useState(() => bullets.map((_, index) => index))
  const keys = order.length === bullets.length ? order : bullets.map((_, index) => index)
  const keyed = bullets.map((bullet, index) => ({ ...bullet, key: keys[index] }))
  const [announcement, setAnnouncement] = useState("")

  return (
    <div className="flex flex-col gap-2">
      <ul aria-labelledby={labelId} className="flex flex-col rounded-[4px] border border-rule bg-sheet">
        {keyed.map((bullet, index) => (
          <li key={bullet.key} className="flex items-start gap-3 border-b border-rule px-3.5 py-2 last:border-b-0">
            <input
              type="checkbox"
              checked={!bullet.leftOut}
              onChange={(event) => onChange(setLeftOutLine(text, bullet.line, !event.target.checked))}
              aria-label={`Include bullet ${index + 1} in the PDF`}
              className="mt-1.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span className={`min-w-0 flex-1 py-0.5 text-[15px] leading-[1.6] ${bullet.leftOut ? "text-ink-2" : "text-ink"}`}>
              {plainText(bullet.words)}
              {bullet.leftOut && <span className="label-mono ml-2 whitespace-nowrap text-ink-2">Left out</span>}
            </span>
            <MoveButtons
              name={`bullet ${index + 1}`}
              first={index === 0}
              last={index === keyed.length - 1}
              onMove={(by) => {
                const next = [...keys]
                ;[next[index], next[index + by]] = [next[index + by], next[index]]
                setOrder(next)
                onChange(moveBullet(text, bullet.line, by))
                setAnnouncement((last) => nextAnnouncement(last, `Moved to ${index + by + 1} of ${keyed.length}`))
              }}
            />
          </li>
        ))}
      </ul>
      <p className="text-[13px] leading-normal text-ink-2">
        Untick a bullet to leave it out of the PDF. It stays here, so you can put it back.
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

interface SectionHeadingProps {
  /** e.g. "03 / 08" */
  position: string
  title: string
  /** When given, the title can be renamed. */
  onRename?: (title: string) => void
  /** What the checker found about the section or its title, while the person is fixing it. */
  flag?: Finding | null
  allowEmpty?: boolean
}

/** The big serif title at the top of each section, optionally renameable. */
export function SectionHeading({ position, title, onRename, flag, allowEmpty = false }: SectionHeadingProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const renameButton = useRef<HTMLButtonElement>(null)
  // Set when the rename ends from the keyboard, so the focus goes back to the
  // rename button rather than to the page. Clicking away keeps it where it went.
  const refocus = useRef(false)

  useEffect(() => {
    if (draft !== null || !refocus.current) return
    refocus.current = false
    renameButton.current?.focus()
  }, [draft])

  const save = () => {
    if (draft !== null && (allowEmpty || draft.trim()) && draft.trim() !== title) onRename?.(draft.trim())
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="label-mono text-ink-2">{position}</span>
      {draft === null ? (
        <div className="flex items-center gap-2">
          <h1 tabIndex={-1} className="font-serif text-[40px] leading-[1.1] tracking-[-0.02em]">
            {title}
          </h1>
          {onRename && (
            <button
              ref={renameButton}
              type="button"
              aria-label="Rename section"
              title="Rename section"
              onClick={() => setDraft(title)}
              className="p-1.5 text-ink-2 transition-colors hover:text-ink"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <input
          aria-label="Section title"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== "Escape") return
            // The focus is back on the rename button before Enter is done, so
            // Enter mustn't go on to press it and open the rename again.
            event.preventDefault()
            refocus.current = true
            if (event.key === "Enter") save()
            else setDraft(null)
          }}
          className="w-full border-0 border-b-[1.5px] border-accent bg-transparent font-serif text-[40px] leading-[1.1] tracking-[-0.02em] outline-none focus-visible:outline-none"
        />
      )}
      {flag && <FlagNote finding={flag} />}
    </div>
  )
}
