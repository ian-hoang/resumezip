// The text of a box that shows styled words (StyledBox.tsx), as it shows it:
// the words without their marks, with each character's style. It's saved with
// the marks the PDF reads (lib/marks.ts), **bold**, *italic*, ***both***,
// __underline__ and [linked words](address), and read back with the same code,
// so the box always shows a line as it prints. A bullets box's lines start
// with a bullet ("• ", or "○ " when left out), as plain text, and follow
// arrange.ts's rules for Enter, pasting and typing; a box for prose has no bullets.

import { escapedWords, markedPieces, typedPieces } from "@/lib/marks"
import { cursorWithBullets, lineStartOf, newBullet, pastedList, sameEnd, typedList, withBullets } from "./arrange"

export const BOLD = 1
export const ITALIC = 2
export const UNDERLINE = 4
// The bits above these hold a character's link, by its place in LINKS.
const LINK_SHIFT = 3
const STYLE_BITS = (1 << LINK_SHIFT) - 1

/**
 * A character's style: BOLD, ITALIC and UNDERLINE added together, and its
 * link, if any (linkOf). Two characters in the same style, link and all, have
 * the same number, so a style is compared and copied as one.
 */
export type Style = number

// Every link address the page has shown, by number; 0 is none. A style holds
// the number, so it stays a number, and an address keeps its number until the
// page is closed: styles are never saved as numbers.
const LINKS = [""]

/** The address `style` links to, or "" if none. */
export const linkOf = (style: Style) => LINKS[style >> LINK_SHIFT] ?? ""

/** `style` linking to `address`, or to nothing for "". */
export function withLink(style: Style, address: string): Style {
  let number = address ? LINKS.indexOf(address) : 0
  if (number < 0) number = LINKS.push(address) - 1
  return (style & STYLE_BITS) | (number << LINK_SHIFT)
}

/** `style` without its link. */
const unlinked = (style: Style) => style & STYLE_BITS

const styleOf = (piece: { bold: boolean; italic: boolean; underline?: true; link?: string }): Style =>
  withLink((piece.bold ? BOLD : 0) + (piece.italic ? ITALIC : 0) + (piece.underline ? UNDERLINE : 0), piece.link ?? "")

export interface Styled {
  /** The words as the box shows them, a line each, bullets and all. */
  text: string
  /** Each character's style, one per UTF-16 code unit of `text`. */
  styles: Style[]
}

/** A bullets box, or a box for prose, whose lines have no bullets. */
export type Kind = "bullets" | "prose"

/** Styled text with the cursor, or a selection, in it. */
export interface StyledEdit extends Styled {
  start: number
  end: number
}

/** `text` all in one style. */
export const styled = (text: string, style: Style = 0): Styled => ({ text, styles: new Array<Style>(text.length).fill(style) })

export const slice = ({ text, styles }: Styled, start: number, end = text.length): Styled => ({
  text: text.slice(start, end),
  styles: styles.slice(start, end),
})

const concat = (...parts: Styled[]): Styled => ({
  text: parts.map((part) => part.text).join(""),
  styles: parts.flatMap((part) => part.styles),
})

export function linesOf(s: Styled): Styled[] {
  let from = 0
  return s.text.split("\n").map((line) => {
    const part = slice(s, from, from + line.length)
    from += line.length + 1
    return part
  })
}

const joinLines = (lines: Styled[]): Styled => concat(...lines.flatMap((line, index) => (index ? [styled("\n"), line] : [line])))

export const sameStyled = (a: Styled, b: Styled) => a.text === b.text && a.styles.every((style, index) => style === b.styles[index])

/** How long a line's bullet is, with the spaces after it, which are never bold or italic. */
export const bulletLength = (line: string) => line.match(/^[•○][^\S\n]*/)?.[0].length ?? 0

// Where a line's words start: after its bullet in a bullets box.
const wordsStart = (line: string, kind: Kind) => (kind === "bullets" ? bulletLength(line) : 0)

// A bullets box's lines each start with a bullet; a prose box's are as typed.
const lined = (text: string, kind: Kind) => (kind === "bullets" ? withBullets(text) : text)

const isSpace = (character: string) => /\s/.test(character)

/** A line as it was typed, marks and all, as the box shows it, with where each character it shows is in it. */
function readLine(typed: string): { line: Styled; at: number[] } {
  let text = ""
  const styles: Style[] = []
  const at: number[] = []
  for (const piece of markedPieces(typed)) {
    text += piece.text
    for (let index = 0; index < piece.text.length; index++) {
      styles.push(styleOf(piece))
      at.push(piece.at + index)
    }
  }
  return { line: { text, styles }, at }
}

/** A field's saved text as its box shows it. */
export const styledOf = (saved: string, kind: Kind): Styled =>
  joinLines(
    lined(saved, kind)
      .split("\n")
      .map((line) => readLine(line).line),
  )

// By bold and italic: **bold**, *italic*, ***both***. Underline goes outside them: __**both**__.
const STARS = ["", "**", "*", "***"]
const opening = (style: Style) => `${style & UNDERLINE ? "__" : ""}${STARS[style & (BOLD | ITALIC)]}`
const closing = (style: Style) => `${STARS[style & (BOLD | ITALIC)]}${style & UNDERLINE ? "__" : ""}`

/**
 * A line in marks, with where each of its characters went. A mark has to
 * touch its words, so spaces at either end of styled or linked words go
 * outside it, and a link holds the other marks: [the **new** site](address).
 * Words are escaped (escapedWords), so a "_" or "[" stays a word. With no
 * asterisks typed in the words, every line reads back as it was styled;
 * asterisks typed next to bold or italic words can pair up with a mark, and
 * `settled` then shows what that prints.
 */
function writeLine({ text, styles }: Styled, kind: Kind): { typed: string; at: number[] } {
  let typed = ""
  const at: number[] = []
  const bullet = (to: number) => {
    for (let index = 0; index < to; index++) {
      at.push(typed.length)
      typed += text[index]
    }
  }
  // Each character goes after the backslash escaping it, if it has one.
  const words = (from: number, to: number) => {
    const escaped = escapedWords(text.slice(from, to))
    let out = 0
    for (let index = from; index < to; index++) {
      if (escaped[out] === "\\") out++
      at.push(typed.length + out++)
    }
    typed += escaped
  }
  const trimmed = (from: number, to: number) => {
    while (from < to && isSpace(text[from])) from++
    while (to > from && isSpace(text[to - 1])) to--
    return [from, to]
  }
  // Words in runs of one style, each in its marks.
  const marked = (start: number, stop: number) => {
    while (start < stop) {
      const style = unlinked(styles[start])
      let end = start + 1
      while (end < stop && unlinked(styles[end]) === style) end++
      const [from, to] = style ? trimmed(start, end) : [start, start]
      if (from === to) words(start, end)
      else {
        words(start, from)
        typed += opening(style)
        words(from, to)
        typed += closing(style)
        words(to, end)
      }
      start = end
    }
  }
  let start = wordsStart(text, kind)
  bullet(start)
  while (start < text.length) {
    const link = linkOf(styles[start])
    let end = start + 1
    while (end < text.length && linkOf(styles[end]) === link) end++
    const [from, to] = link ? trimmed(start, end) : [start, start]
    if (from === to) marked(start, end)
    else {
      marked(start, from)
      typed += "["
      marked(from, to)
      typed += `](${link})`
      marked(to, end)
    }
    start = end
  }
  return { typed, at }
}

const keyOf = (line: Styled) => `${line.styles.join("")}:${line.text}`

/**
 * Marks typed as words in a line, read a stretch of one style at a time, as
 * the PDF reads them, with where each character that's left came from.
 * "*Spanish*" typed among bold words is bold and italic: saved as typed,
 * inside the bold words' marks, it wouldn't read that way.
 */
function readTyped(line: Styled, kind: Kind): { line: Styled; at: number[] } {
  const words = wordsStart(line.text, kind)
  const out: Styled = { text: line.text.slice(0, words), styles: new Array<Style>(words).fill(0) }
  const at = Array.from({ length: words }, (_, index) => index)
  let start = words
  while (start < line.text.length) {
    let end = start + 1
    while (end < line.text.length && line.styles[end] === line.styles[start]) end++
    const style = line.styles[start]
    for (const piece of typedPieces(line.text.slice(start, end), (style & BOLD) > 0, (style & ITALIC) > 0)) {
      out.text += piece.text
      for (let index = 0; index < piece.text.length; index++) {
        // Asterisks only make bold and italic: underline and links are kept as they were.
        out.styles.push((style & ~(BOLD | ITALIC)) | (piece.bold ? BOLD : 0) | (piece.italic ? ITALIC : 0))
        at.push(start + piece.at + index)
      }
    }
    start = end
  }
  return { line: out, at }
}

/** `line` with its start changed to make `text`: the words at its end keep their styles, and what's new is plain. */
function restyled(line: Styled, text: string): Styled {
  const same = sameEnd(line.text, text)
  return { text, styles: [...styled(text.slice(0, text.length - same)).styles, ...line.styles.slice(line.text.length - same)] }
}

/** An edit settled: as the box shows it, as it's saved, and the style of what's typed next at the cursor, when it isn't the usual one. */
export interface Settled {
  edit: StyledEdit
  saved: string
  next?: Style
}

/**
 * An edit as the box shows it and as it's saved: every line starts with a
 * bullet (withBullets), and shows what it prints, so marks typed as words,
 * like "**Rust**", turn bold. The cursor moves with the words, and after a
 * closing mark typed there, what's typed next is outside it. Lines that are
 * the same as in `previous`, the saved text before the edit, are saved as
 * they were typed, so an edit only rewrites the lines it changes.
 */
export function settled(edit: StyledEdit, previous: string, kind: Kind): Settled {
  const kept = new Map<string, string>()
  for (const line of lined(previous, kind).split("\n")) kept.set(keyOf(readLine(line).line), line)

  const bulleted = linesOf(edit).map((line) => restyled(line, lined(line.text, kind)))
  const start = kind === "bullets" ? cursorWithBullets(edit.text, edit.start) : edit.start
  const end = kind === "bullets" ? cursorWithBullets(edit.text, edit.end) : edit.end
  const shown: Styled[] = []
  const typed: string[] = []
  let next = { start, end }
  let nextStyle: Style | undefined
  let from = 0
  let to = 0
  for (const line of bulleted) {
    const length = line.text.length
    const cursorHere = start === end && start >= from && start <= from + length
    let offset = (at: number) => at
    let printed = line
    let written = kept.get(keyOf(line))
    if (written === undefined) {
      const marks = readTyped(line, kind)
      const write = writeLine(marks.line, kind)
      const read = readLine(write.typed)
      written = write.typed
      // Where `at` in the line is once the marks typed in it are read.
      const marked = (at: number) => marks.at.filter((index) => index < at).length
      const same = read.line.text === marks.line.text
      if (same) {
        // Spaces keep the style they were typed in, as a mark can't hold them:
        // a space typed after a bold word, and the next word, stay bold.
        const words = wordsStart(marks.line.text, kind)
        printed = {
          text: marks.line.text,
          styles: marks.line.styles.map((style, index) =>
            index < words ? 0 : isSpace(marks.line.text[index]) ? style : read.line.styles[index],
          ),
        }
        offset = marked
      } else {
        // Asterisks typed next to bold or italic words paired up with a mark:
        // the line as it prints, with the cursor before the same characters.
        printed = read.line
        const placeOf = (at: number) => (at < marks.line.text.length ? write.at[at] : write.typed.length)
        offset = (at: number) => read.at.filter((index) => index < placeOf(marked(at))).length
      }
      // Right after a mark that closed, what's typed next takes the style of the words before the ones it marked.
      const at = start - from
      const typedAt = cursorHere ? marks.at.indexOf(at - 1) : -1
      const printedBefore = typedAt >= 0 && (same || read.at.includes(write.at[typedAt]))
      const shownAt = cursorHere ? offset(at) : 0
      if (cursorHere && line.text[at - 1] === "*" && !printedBefore && shownAt > 0 && printed.styles[shownAt - 1] !== 0) {
        let run = shownAt - 1
        while (run > 0 && printed.styles[run - 1] === printed.styles[shownAt - 1]) run--
        nextStyle = run > wordsStart(printed.text, kind) ? printed.styles[run - 1] : 0
      }
    }
    next = {
      start: start >= from && start <= from + length ? to + offset(start - from) : next.start,
      end: end >= from && end <= from + length ? to + offset(end - from) : next.end,
    }
    shown.push(printed)
    typed.push(written)
    from += length + 1
    to += printed.text.length + 1
  }
  return { edit: { ...joinLines(shown), ...next }, saved: typed.join("\n"), next: nextStyle }
}

/**
 * The style a character typed at `at` gets: the one before it on its line, or
 * at the start of a line's words, the one after it, as in word processors.
 * Words typed at either end of a link aren't in it, or underlined with it.
 */
export function styleAt({ text, styles }: Styled, at: number, kind: Kind): Style {
  const from = lineStartOf(text, at)
  const words = from + wordsStart(text.slice(from), kind)
  const after = at < text.length && text[at] !== "\n" ? styles[at] : 0
  const style = at > words ? styles[at - 1] : at === words ? after : 0
  const inLink = at > words && linkOf(style) !== "" && after >> LINK_SHIFT === style >> LINK_SHIFT
  return linkOf(style) && !inLink ? unlinked(style) & ~UNDERLINE : style
}

/** The style words typed over a selection get: its first word's, as in word processors. */
export function styleOver(s: Styled, start: number, end: number, kind: Kind): Style {
  for (let index = start; index < end; index++) {
    if (!isSpace(s.text[index]) && !inBullet(s.text, index, kind)) return s.styles[index]
  }
  return styleAt(s, start, kind)
}

/** Whether the character at `at` is a line's bullet, or a space after it. */
const inBullet = (text: string, at: number, kind: Kind) => {
  const from = lineStartOf(text, at)
  return at < from + wordsStart(text.slice(from), kind)
}

/**
 * `words` typed from start to end, in `style`. As in arrange.ts, a "- " typed
 * after a bullet goes, as the bullet's there already.
 */
export function typed(s: Styled, start: number, end: number, words: string, style: Style, kind: Kind): StyledEdit {
  const from = lineStartOf(s.text, start)
  const before = slice(s, from, start)
  const typedHere = concat(before, styled(words, style))
  const head = kind === "bullets" ? restyled(typedHere, typedList(before.text, words)) : typedHere
  const cursor = from + head.text.length
  return { ...concat(slice(s, 0, from), head, slice(s, end)), start: cursor, end: cursor }
}

/**
 * `words` pasted from start to end. In a bullets box, each list marker gets a
 * bullet in its place (pastedList), and words copied from a bullets box
 * (`copiedHere`) keep their bullets. Words copied from a box keep their bold
 * and italic words.
 */
export function pasted(s: Styled, start: number, end: number, words: Styled, copiedHere: boolean, kind: Kind): StyledEdit {
  const from = lineStartOf(s.text, start)
  const before = slice(s, from, start)
  const given = linesOf(words)
  const head =
    kind === "bullets"
      ? joinLines(
          pastedList(words.text, before.text, copiedHere)
            .split("\n")
            .map((line, index) => restyled(index ? given[index] : concat(before, given[0]), line)),
        )
      : concat(before, words)
  const cursor = from + head.text.length
  return { ...concat(slice(s, 0, from), head, slice(s, end)), start: cursor, end: cursor }
}

/**
 * What Enter does: in a bullets box, the words after the cursor go on a new
 * bullet below, in their styles (newBullet); in prose, a new line.
 */
export function split(s: Styled, start: number, end: number, kind: Kind): StyledEdit {
  if (kind === "prose") return { ...concat(slice(s, 0, start), styled("\n"), slice(s, end)), start: start + 1, end: start + 1 }
  const next = newBullet(s.text, start, end)
  if (start === lineStartOf(s.text, start)) return { ...next, styles: [...s.styles.slice(0, start), ...s.styles.slice(end)] }
  // The text after the cursor, less the spaces newBullet drops, ends both texts.
  const rest = next.text.length - next.start
  return { ...next, styles: [...s.styles.slice(0, start), 0, 0, 0, ...s.styles.slice(s.text.length - rest)] }
}

export const removed = (s: Styled, start: number, end: number): StyledEdit => ({
  ...concat(slice(s, 0, start), slice(s, end)),
  start,
  end: start,
})

/**
 * What Backspace at `at` deletes when it's at the start of a line's words, or
 * of the line: back to the end of the line above, bullet and all, so the
 * words join that line, as in word processors. Undefined anywhere else, and
 * on the first line, whose bullet would only come back.
 */
export function joinedBack(text: string, at: number): [number, number] | undefined {
  const from = lineStartOf(text, at)
  const words = from + bulletLength(text.slice(from))
  if (from > 0 && (at === from || at === words)) return [from - 1, words]
}

/** What Delete at the end of a line deletes: the line break, and the bullet of the line below, whose words join this one. */
export function joinedForward(text: string, at: number): [number, number] | undefined {
  if (text[at] === "\n") return [at, at + 1 + bulletLength(text.slice(at + 1))]
}

/**
 * The characters of the words from start to end: not bullets or line breaks,
 * or spaces at either end. Undefined when there are no words in it.
 */
function wordsIn(s: Styled, start: number, end: number, kind: Kind): number[] | undefined {
  const all: number[] = []
  for (let index = start; index < end; index++) {
    if (s.text[index] !== "\n" && !inBullet(s.text, index, kind)) all.push(index)
  }
  const first = all.findIndex((index) => !isSpace(s.text[index]))
  if (first < 0) return undefined
  const last = all.findLastIndex((index) => !isSpace(s.text[index]))
  return all.slice(first, last + 1)
}

/** Whether there are words from start to end to style or link. */
export const hasWords = (s: Styled, start: number, end: number, kind: Kind) => wordsIn(s, start, end, kind) !== undefined

/** Styles changed on the words at `words`, selected. */
function restyledWords(s: Styled, words: number[], change: (style: Style) => Style): StyledEdit {
  const styles = [...s.styles]
  for (const index of words) styles[index] = change(styles[index])
  return { text: s.text, styles, start: words[0], end: words[words.length - 1] + 1 }
}

/**
 * Bold (BOLD), italic (ITALIC) or underline (UNDERLINE) on the words from
 * start to end, or off if they all have it already. Bullets, and spaces at
 * either end, are left as they are, and each line gets its own marks when
 * it's saved. Undefined when there are no words in it.
 */
export function toggled(s: Styled, start: number, end: number, style: Style, kind: Kind): StyledEdit | undefined {
  const words = wordsIn(s, start, end, kind)
  if (!words) return undefined
  const on = words.some((index) => !isSpace(s.text[index]) && !(s.styles[index] & style))
  return restyledWords(s, words, (old) => (on ? old | style : old & ~style))
}

/**
 * The words from start to end linked to `address`, and underlined, so the
 * link shows on the page; with "", unlinked, and not underlined. An
 * underline is an ordinary one, which can be taken off and leave the link.
 * Undefined when there are no words in it.
 */
export function linked(s: Styled, start: number, end: number, address: string, kind: Kind): StyledEdit | undefined {
  const words = wordsIn(s, start, end, kind)
  if (!words) return undefined
  return restyledWords(s, words, (old) => (address ? withLink(old | UNDERLINE, address) : unlinked(old) & ~UNDERLINE))
}

/** The link the character at `at`, or the one before it, is in: where it starts and ends, and its address. */
export function linkAround({ text, styles }: Styled, at: number): { start: number; end: number; address: string } | undefined {
  const inside = (index: number) => index >= 0 && index < text.length && linkOf(styles[index]) !== ""
  const index = inside(at) ? at : inside(at - 1) ? at - 1 : -1
  if (index < 0) return undefined
  const number = styles[index] >> LINK_SHIFT
  let start = index
  let end = index + 1
  while (start > 0 && styles[start - 1] >> LINK_SHIFT === number && text[start - 1] !== "\n") start--
  while (end < text.length && styles[end] >> LINK_SHIFT === number && text[end] !== "\n") end++
  return { start, end, address: linkOf(styles[index]) }
}

/** Which of BOLD, ITALIC and UNDERLINE every word from start to end has, as buttons show them, and the link they're all in. */
export function stylesOver(s: Styled, start: number, end: number, kind: Kind): { style: Style; link: string } {
  const words = wordsIn(s, start, end, kind)?.filter((index) => !isSpace(s.text[index]))
  if (!words) {
    const style = styleAt(s, start, kind)
    return { style: unlinked(style), link: linkOf(style) }
  }
  const style = words.reduce((all, index) => all & s.styles[index], STYLE_BITS)
  const link = linkOf(s.styles[words[0]])
  return { style, link: words.every((index) => linkOf(s.styles[index]) === link) ? link : "" }
}

/** Swaps the line with `at` in it with the one above (-1) or below (1), as Alt+↑ and Alt+↓ do, keeping the cursor in it. */
export function movedLine(s: Styled, at: number, by: -1 | 1): StyledEdit | undefined {
  const lines = linesOf(s)
  const line = s.text.slice(0, at).split("\n").length - 1
  const to = line + by
  if (to < 0 || to >= lines.length) return undefined
  const column = at - lineStartOf(s.text, at)
  ;[lines[line], lines[to]] = [lines[to], lines[line]]
  const cursor = lines.slice(0, to).reduce((total, words) => total + words.text.length + 1, 0) + column
  return { ...joinLines(lines), start: cursor, end: cursor }
}
