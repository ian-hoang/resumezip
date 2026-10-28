"use client"

import type React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { Pencil } from "lucide-react"
import { TONE_NAMES } from "@/components/review/notes"
import type { Finding } from "@/lib/check/engine"
import { onMac, shortcut } from "@/lib/keys"
import { markedPieces } from "@/lib/typst/resumeData"
import { bulletLines, offsetOfLine, withBullets } from "./arrange"
import { readBox, selectIn, selectLineIn } from "./boxDom"
import { reducedMotion } from "./layout"
import { wordsIn, type PickedWords } from "./previewPick"
import { bulletLength } from "./styledText"
import { StyledBox } from "./StyledBox"

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
  /** What belongs in the field, shown under it and read out with it: in a multiline box, before the keys for bold and italic. */
  hint?: string
  /** A few lines of prose, as the summary: a box that grows with them, where Enter starts a new line, with bold and italic words. */
  multiline?: boolean
  /** A multiline box's least height, as a class: as tall as three lines unless given. */
  boxHeight?: string
}

/**
 * A finding's tier, as the Check tab shows it: a must-fix (red), which costs
 * points and holds the score down; worth a look (yellow), which costs points
 * and can be dismissed; or optional advice (blue), which doesn't count.
 */
export type Tier = "fix" | "look" | "optional"

export const tierOf = (finding: Pick<Finding, "level" | "advisory">): Tier => (finding.advisory ? "optional" : finding.level)

export const TIER_NAMES: Record<Tier, string> = { fix: "Must fix", look: "Worth a look", optional: "Optional" }

/** Each tier's color, as the dot by a finding in the Check panel; its mark on the preview is drawn in the same color (styles/review.css). */
export const TIER_BG: Record<Tier, string> = { fix: "bg-alert", look: "bg-caution", optional: "bg-accent" }

/**
 * What the checker or the AI found where the person is fixing it, read out
 * with the field it describes. It isn't shown: the Check panel and the marks
 * on the preview show it, and the form stays clear for writing.
 */
export function FlagNote({ id, finding }: { id?: string; finding: Finding }) {
  return (
    <div id={id} className="sr-only">
      <p>
        {finding.flag ? TONE_NAMES[finding.flag].one : TIER_NAMES[tierOf(finding)]}: {finding.message}
      </p>
      <p>{finding.why}</p>
      {finding.suggestion && <p>{finding.suggestion}</p>}
    </div>
  )
}

/**
 * How a field looks, a one-line input or a text box alike: no box, just a
 * line under it, blue where the checker points. Its parent is `relative`, in
 * a `group/field`, with FocusGlow before it and FocusLine after it.
 */
const underlined = (flagged: boolean) =>
  `relative w-full min-w-0 border-0 bg-transparent py-2 text-base text-ink outline-none transition-colors focus-visible:outline-none ${
    !flagged ? "border-b border-rule-strong hover:border-ink/40" : "border-b-2 border-accent"
  }`

/**
 * A soft blue light that rises from a field's line while it has focus. It's
 * under the field (which is `relative`, and later), so the text stays crisp,
 * and nothing moves.
 */
function FocusGlow() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-t-[6px] bg-linear-to-t from-accent/[0.09] to-accent/0 opacity-0 transition-opacity duration-200 ease-out group-focus-within/field:opacity-100 motion-reduce:transition-none"
    />
  )
}

/** The line under the field being typed in, in blue, drawn out from the left, with a glow. */
function FocusLine() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-accent shadow-[0_0_10px_rgb(46_91_230/0.55)] transition-transform duration-300 ease-glide group-focus-within/field:scale-x-100 motion-reduce:transition-none"
    />
  )
}

/**
 * A labelled, underlined text input, or a box for a few lines of prose with
 * bold and italic words. A label can't be for that box, a div, so it's a div
 * too, and a click on its name puts the cursor in the box.
 */
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
  hint,
  boxHeight = "min-h-24",
}: FieldProps) {
  const noteId = useId()
  const boxId = useId()
  const hintId = useId()
  const describedBy = [hint && hintId, flag && noteId].filter(Boolean).join(" ") || undefined
  const look = underlined(!!flag)
  const Labelled = multiline ? "div" : "label"
  return (
    <div data-field={name} className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <Labelled className="group/field relative flex min-w-0 flex-col gap-1.5">
        <span
          id={`${boxId}-label`}
          onClick={multiline ? () => document.getElementById(boxId)?.focus() : undefined}
          className="label-mono text-ink-2 transition-colors group-focus-within/field:text-accent"
        >
          {label}
        </span>
        <FocusGlow />
        {multiline ? (
          <StyledBox
            kind="prose"
            id={boxId}
            value={value}
            onChange={onChange}
            labelId={`${boxId}-label`}
            describedBy={flag ? `${hintId} ${noteId}` : hintId}
            invalid={flag?.level === "fix"}
            placeholder={placeholder}
            className={`${look} ${boxHeight} leading-relaxed`}
          />
        ) : (
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={flag?.level === "fix" || undefined}
            autoComplete={autoComplete}
            inputMode={web ? "url" : undefined}
            spellCheck={web ? false : undefined}
            autoCapitalize={web ? "off" : undefined}
            onChange={(event) => onChange(event.target.value)}
            className={`${look} placeholder:text-ink-2/50`}
          />
        )}
        <FocusLine />
      </Labelled>
      {multiline ? (
        <span id={hintId} className="text-[13px] leading-normal text-ink-2">
          {hint && `${hint} `}
          <FormatHint />
        </span>
      ) : (
        hint && (
          <span id={hintId} className="text-[13px] leading-normal text-ink-2">
            {hint}
          </span>
        )
      )}
      {flag && <FlagNote id={noteId} finding={flag} />}
    </div>
  )
}

/** Selects a line's words in a bullets box, after its "• ", to point at one bullet. */
function selectLine(field: HTMLElement, line: number) {
  if (field.isContentEditable) selectLineIn(field, line)
}

/**
 * Selects words picked on the preview in a field: in the line `line` of a
 * bullets box, or anywhere in another field. The whole bullet, or nothing,
 * if they aren't there any more.
 */
function selectWords(field: HTMLElement, line: number | undefined, words: PickedWords) {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const found = wordsIn(field.value, words)
    if (found) field.setSelectionRange(found.start, found.end)
    return
  }
  if (!field.isContentEditable) return
  const text = readBox(field).styled.text
  if (line === undefined) {
    const found = wordsIn(text, words)
    if (found) selectIn(field, found.start, found.end)
    return
  }
  const lines = text.split("\n")
  if (line < 0 || line >= lines.length) return
  const start = offsetOfLine(lines, line) + bulletLength(lines[line])
  const found = wordsIn(lines[line].slice(bulletLength(lines[line])), words)
  if (found) selectIn(field, start + found.start, start + found.end)
  else selectLine(field, line)
}

/**
 * Moves the cursor to what the checker points at (one bullet, if `line` is
 * given), or selects `words` picked on the preview, and scrolls it into view.
 */
export function pointAt(
  target: HTMLElement | null | undefined,
  line?: number,
  view: HTMLElement | null | undefined = target,
  words?: PickedWords,
) {
  if (!target) return
  target.focus({ preventScroll: true })
  if (words) selectWords(target, line, words)
  else if (line !== undefined) selectLine(target, line)
  view?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" })
}

// With Option on a Mac, Alt elsewhere: ⌥↑, Alt+↑.
const altShortcut = (key: string) => (onMac() ? `⌥${key}` : `Alt+${key}`)

/**
 * The keys for bold and italic, and with `moveLines`, for moving a line. A
 * touch screen has no keys, so it shows the marks to type, which turn bold and
 * italic as they're typed.
 */
function FormatHint({ moveLines = false }: { moveLines?: boolean }) {
  return window.matchMedia("(pointer: coarse)").matches ? (
    <>
      <span className="font-mono">**bold**</span> · <span className="font-mono">*italic*</span>
    </>
  ) : (
    <>
      <kbd className="font-mono">{shortcut("B")}</kbd> <strong className="font-semibold text-ink">bold</strong> ·{" "}
      <kbd className="font-mono">{shortcut("I")}</kbd> <em className="text-ink">italic</em>
      {moveLines && (
        <>
          {" "}
          · <kbd className="font-mono">{altShortcut("↑")}</kbd> <kbd className="font-mono">{altShortcut("↓")}</kbd> move a line
        </>
      )}
    </>
  )
}

/** How much of a bullet an open card shows until its box is used, in characters, cut at a word: about a line and a half. */
const PREVIEW_CHARACTERS = 70
/** How many bullets an open card shows until its box is used. */
const PREVIEW_BULLETS = 2

/** A bullet's words without their bold and italic marks, cut short at a word, with "…" where they were cut. */
function previewOf(words: string): string {
  const plain = markedPieces(words)
    .map((piece) => piece.text)
    .join("")
  if (plain.length <= PREVIEW_CHARACTERS) return plain
  const cut = plain.slice(0, PREVIEW_CHARACTERS + 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > PREVIEW_CHARACTERS / 2 ? cut.slice(0, space) : cut.slice(0, PREVIEW_CHARACTERS)).replace(/[\s,.;:]+$/, "")}…`
}

/**
 * A box for bullet points: one per line, and Enter starts a new bullet. Bold
 * and italic words show as they print, and are saved as **bold**, *italic*
 * and ***both***; ⌘B and ⌘I add or remove them. Alt+↑ and Alt+↓ move the line
 * the cursor is on. A line starting with "○" is left out of the PDF.
 *
 * With `compact`, as in an entry's card, it shows its first bullets cut short
 * and how many more there are until it's used: the box itself is over them,
 * unseen, so a click or Tab goes into it, and screen readers read all of it.
 */
export function BulletsField({
  label,
  value,
  placeholder,
  className = "",
  onChange,
  name,
  flag,
  request,
  compact = false,
}: FieldProps & { compact?: boolean }) {
  const text = withBullets(value)
  const boxId = useId()
  const hintId = useId()
  const noteId = useId()
  const bullets = bulletLines(text)
  // Once the box has been used, it shows in full until its card is folded.
  const [used, setUsed] = useState(false)
  // Choosing a finding here shows the text, where the cursor goes to it. Only a
  // new choice does: the finding is found afresh each time the checker runs,
  // and it's gone while the person is in Write mode, then back.
  const [shownRequest, setShownRequest] = useState(request)
  if (request !== undefined && request !== shownRequest) {
    setShownRequest(request)
    setUsed(true)
  }
  const previewing = compact && !used && bullets.length > 0
  // Underlined, as the other fields are; the cut-short bullets are drawn the same way.
  const box = `${underlined(!!flag)} leading-relaxed`

  return (
    <div data-field={name} className={`group/field flex min-w-0 flex-col gap-1.5 ${className}`}>
      {/* Blue while typing in the box, as a field's label is. A label can't be for a div,
          so a click on it puts the cursor in the box itself. */}
      <label
        id={`${boxId}-label`}
        onClick={() => document.getElementById(boxId)?.focus()}
        className="label-mono text-ink-2 transition-colors group-focus-within/field:text-accent"
      >
        {label}
      </label>
      <div className="relative" onFocus={() => setUsed(true)}>
        <FocusGlow />
        {previewing && (
          <div aria-hidden="true" className={`${box} flex flex-col`}>
            {bullets.slice(0, PREVIEW_BULLETS).map((bullet) => (
              <p key={bullet.line} className={bullet.leftOut ? "text-ink-2" : undefined}>
                {bullet.leftOut ? "○" : "•"} {previewOf(bullet.words)}
              </p>
            ))}
            {bullets.length > PREVIEW_BULLETS && <p className="mt-0.5 text-[13px] text-ink-2">+ {bullets.length - PREVIEW_BULLETS} more</p>}
          </div>
        )}
        {/* While the bullets show cut short, the box is over them, unseen, and no taller. */}
        <div className={previewing ? "absolute inset-0 overflow-hidden opacity-0" : undefined}>
          <StyledBox
            kind="bullets"
            id={boxId}
            value={value}
            onChange={onChange}
            labelId={`${boxId}-label`}
            describedBy={flag ? `${hintId} ${noteId}` : hintId}
            invalid={flag?.level === "fix"}
            placeholder={placeholder}
            className={`${box} ${compact ? "min-h-[110px]" : "min-h-[132px]"}`}
          />
        </div>
        <FocusLine />
      </div>
      {flag && <FlagNote id={noteId} finding={flag} />}
      <span id={hintId} className={`text-[13px] leading-normal text-ink-2 ${previewing ? "sr-only" : ""}`}>
        One bullet per line · <FormatHint moveLines />
        {bullets.some((bullet) => bullet.leftOut) && " · Lines starting with ○ are left out of the PDF."}
      </span>
    </div>
  )
}

interface SectionHeadingProps {
  title: string
  /** A line under the title, as "3 entries · drag to reorder". */
  note?: string
  /** When given, the title can be renamed. */
  onRename?: (title: string) => void
  /** What the checker found about the section or its title, while the person is fixing it. */
  flag?: Finding | null
  allowEmpty?: boolean
  /** At the far end of the title, as a section's Delete. */
  end?: React.ReactNode
}

/** The big serif title at the top of each section, optionally renameable, with a note under it. */
export function SectionHeading({ title, note, onRename, flag, allowEmpty = false, end }: SectionHeadingProps) {
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-[5px]">
          {draft === null ? (
            <div className="group/title flex min-w-0 flex-wrap items-center gap-1.5">
              <h1 tabIndex={-1} className="min-w-0 font-serif text-[34px] leading-[1.1] tracking-[-0.03em] wrap-anywhere sm:text-[40px]">
                {title}
              </h1>
              {onRename && (
                <button
                  ref={renameButton}
                  type="button"
                  aria-label="Rename section"
                  title="Rename section"
                  onClick={() => setDraft(title)}
                  className="rounded-full p-1.5 text-ink-3 transition-[color,opacity] hover:text-ink [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/title:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
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
              className="w-full border-0 border-b-[1.5px] border-accent bg-transparent font-serif text-[34px] leading-[1.1] tracking-[-0.03em] outline-none focus-visible:outline-none sm:text-[40px]"
            />
          )}
          {note && <p className="text-[14px] leading-5 text-ink-3">{note}</p>}
        </div>
        {end && <div className="-mb-1.5 ml-auto shrink-0">{end}</div>}
      </div>
      {flag && <FlagNote finding={flag} />}
    </div>
  )
}
