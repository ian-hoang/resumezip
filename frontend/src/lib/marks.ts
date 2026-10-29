// The marks a styled box (the editor's StyledBox.tsx) saves its words with,
// which everything that prints or reads a resume reads with markedPieces:
// **bold**, *italic*, ***both***, __underline__ and [linked words](url).
//
// Bold and italic are older, and asterisks typed as words still turn into
// them. Underline and links are only made with the box's buttons and keys, so
// a "_" or "[" typed as a word is saved behind a backslash ("\_", "\["), as is
// a backslash itself, and reads back as typed. Resumes saved before underline
// and links (no `marks` field) had none of those backslashes, so their text is
// escaped once when it's read (withMarks), and reads exactly as it did.

import { SECTIONS } from "@/components/editor/sections"
import { isObject } from "@/lib/isObject"
import type { Resume } from "@/lib/resume"
import type { Run } from "@/lib/typst/resumeData"

/** What `Resume.marks` is once its styled text can hold underline and links. */
export const MARKS_VERSION = 2

// A character a backslash keeps as typed, and one unit of text: a backslash
// and what it keeps, a backslash that keeps nothing, or any other character.
const ESCAPABLE = String.raw`[\\_\[\]]`
const UNIT = String.raw`(?:\\${ESCAPABLE}|\\(?!${ESCAPABLE})|[^\\])`
// A unit that isn't a space, as a mark has to touch its words.
const SOLID = String.raw`(?:\\${ESCAPABLE}|\\(?!${ESCAPABLE})|[^\\\s])`
// A unit of a link's words, which can't hold a "[" or "]" of its own.
const LINKED = String.raw`(?:\\${ESCAPABLE}|\\(?!${ESCAPABLE})|[^\\\[\]\n])`

// ***both***, **bold**, __underline__ or *italic*, tried at one place in a
// line (sticky). Each mark ends at the first marker that can close it, so
// "**C** and **Go**" is two bold words; a marker that doesn't touch words, as
// in "2 * 3", or has no pair, stays as typed.
const STARS = String.raw`\*\*\*(\S(?:[\s\S]*?\S)??)\*\*\*|\*\*(\S(?:[\s\S]*?\S)??)\*\*`
const UNDERLINE = String.raw`__(${SOLID}(?:${UNIT}*?${SOLID})??)__`
const EMPH = String.raw`\*([^\s*](?:[^*]*?[^\s*])?)\*`
const MARK = new RegExp(`${STARS}|${UNDERLINE}|${EMPH}`, "y")
// [words](url): the address has no spaces or brackets, which linkAddress encodes.
const LINK = new RegExp(String.raw`\[(${LINKED}+?)\]\(([^\s()]+)\)`, "y")
const ESCAPE = new RegExp(String.raw`\\(${ESCAPABLE})`, "y")

// Bold and italic alone, as typed into a box (typedPieces), and as every
// resume was saved before underline and links.
const TYPED = /\*\*\*(\S(?:[\s\S]*?\S)??)\*\*\*|\*\*(\S(?:[\s\S]*?\S)??)\*\*|\*([^\s*](?:[^*]*?[^\s*])?)\*/g

/** A stretch of a line's printed text, and where it starts in the line as typed, marks and all. */
export interface MarkedPiece extends Run {
  at: number
}

type Marks = Omit<Run, "text">

const PLAIN: Marks = { bold: false, italic: false }

/** Whether two runs are in the same style, link and all. */
export const sameStyle = (a: Marks, b: Marks) =>
  a.bold === b.bold && a.italic === b.italic && !a.underline === !b.underline && (a.link ?? "") === (b.link ?? "")

/**
 * "Optimized a **Rust** engine for *low latency*" in pieces of one style,
 * each a stretch of the line as typed. Marks can sit inside each other:
 * "**bold with *italic* inside**", "[the **new** site](https://example.com)".
 * A link's address is one of linkAddress's, or its words print unlinked. The
 * bullets box reads lines with this too, so it shows them as they print.
 */
export function markedPieces(line: string): MarkedPiece[] {
  const out: MarkedPiece[] = []
  const add = (character: string, at: number, marks: Marks) => {
    const last = out[out.length - 1]
    // Pieces are stretches of the line as typed, so a backslash before a character starts a new one.
    if (last && sameStyle(last, marks) && last.at + last.text.length === at) last.text += character
    else out.push({ ...marks, text: character, at })
  }
  const read = (text: string, offset: number, marks: Marks) => {
    let at = 0
    while (at < text.length) {
      ESCAPE.lastIndex = at
      const escape = ESCAPE.exec(text)
      if (escape) {
        add(escape[1], offset + at + 1, marks)
        at += 2
        continue
      }
      LINK.lastIndex = at
      const link = marks.link === undefined ? LINK.exec(text) : null
      if (link) {
        const address = linkAddress(link[2])
        read(link[1], offset + at + 1, address ? { ...marks, link: address } : marks)
        at += link[0].length
        continue
      }
      MARK.lastIndex = at
      const mark = MARK.exec(text)
      if (mark) {
        const [whole, both, strong, under, emph] = mark
        if (both !== undefined) read(both, offset + at + 3, { ...marks, bold: true, italic: true })
        else if (strong !== undefined) read(strong, offset + at + 2, { ...marks, bold: true })
        else if (under !== undefined) read(under, offset + at + 2, { ...marks, underline: true })
        else read(emph, offset + at + 1, { ...marks, italic: true })
        at += whole.length
        continue
      }
      add(text[at], offset + at, marks)
      at++
    }
  }
  read(line, 0, PLAIN)
  return out
}

/**
 * Bold and italic words typed into a box as marks, as "**Rust**", read in
 * words already `bold` or `italic`. Anything else typed is a word, "_" and "["
 * too: underline and links only come from the box's buttons and keys.
 */
export function typedPieces(line: string, bold = false, italic = false, offset = 0): MarkedPiece[] {
  const out: MarkedPiece[] = []
  let at = 0
  for (const match of line.matchAll(TYPED)) {
    if (match.index > at) out.push({ text: line.slice(at, match.index), bold, italic, at: offset + at })
    const [, both, strong, emph] = match
    const start = offset + match.index + (both !== undefined ? 3 : strong !== undefined ? 2 : 1)
    if (both !== undefined) out.push(...typedPieces(both, true, true, start))
    else if (strong !== undefined) out.push(...typedPieces(strong, true, italic, start))
    else out.push(...typedPieces(emph, bold, true, start))
    at = match.index + match[0].length
  }
  if (at < line.length) out.push({ text: line.slice(at), bold, italic, at: offset + at })
  return out
}

/**
 * Words as saved between marks, so they read back as they are: each
 * backslash, "[" and "]" behind a backslash, and each "_" next to another, or
 * at either end, where it could make "__" with a mark beside it.
 */
export function escapedWords(words: string): string {
  let out = ""
  for (let index = 0; index < words.length; index++) {
    const character = words[index]
    const lone = character === "_" && index > 0 && index < words.length - 1 && words[index - 1] !== "_" && words[index + 1] !== "_"
    out += character === "\\" || character === "[" || character === "]" || (character === "_" && !lone) ? `\\${character}` : character
  }
  return out
}

/**
 * A line saved before underline and links, escaped so it reads as it did:
 * only bold and italic. Its asterisks are left as they are, and so are its
 * other words, but for a backslash, a "[" or "]", and a "_" next to another.
 */
export function withEscapes(line: string): string {
  return line.replace(/\\|\[|\]|_(?=_)|(?<=_)_/g, (character) => `\\${character}`)
}

// Addresses a link can go to: the web and email. Anything else (a script, a
// file on someone's computer) prints as plain words.
const SCHEME = /^(?:https?:\/\/|mailto:)/i

/**
 * What a typed or pasted address links to, as saved: "example.com/dash" goes
 * to https://example.com/dash, and "me@example.com" to mailto:me@example.com.
 * Spaces and brackets are encoded, as a saved link can't hold them. "" when it
 * isn't an address a link can go to.
 */
export function linkAddress(typed: string): string {
  let address = typed.trim()
  if (!address || /\s/.test(address)) return ""
  if (!SCHEME.test(address)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(address) && !/^[^:/]+:\d/.test(address)) return ""
    address = /^[^@/]+@[^@/]+\.[^@/]+$/.test(address) ? `mailto:${address}` : `https://${address.replace(/^\/+/, "")}`
  }
  try {
    const url = new URL(address)
    if (url.protocol !== "mailto:" && !url.hostname.includes(".") && url.hostname !== "localhost") return ""
  } catch {
    return ""
  }
  return address.replace(/[()[\]]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * A resume whose styled text (descriptions, the summary, added sections) can
 * hold underline and links: as it is when it already can (`marks`), or
 * escaped a line at a time (withEscapes), so it prints as it did. Only the
 * text is changed; anything not in the shape the editor saves is left as it is.
 */
export function withMarks<T extends Resume>(resume: T): T {
  if (resume.marks === MARKS_VERSION) return resume
  const escaped = (value: unknown) => (typeof value === "string" ? value.split("\n").map(withEscapes).join("\n") : value)
  const out: Resume = { ...resume, marks: MARKS_VERSION }
  for (const section of Object.values(SECTIONS)) {
    const styled = section.fields.filter((field) => field.type === "bullets").map((field) => field.key)
    const entries = resume[section.dataKey]
    if (!styled.length || !Array.isArray(entries)) continue
    out[section.dataKey] = entries.map((entry) => {
      if (!isObject(entry)) return entry
      const copy = { ...entry }
      for (const key of styled) if (typeof copy[key] === "string") copy[key] = escaped(copy[key]) as string
      return copy
    })
  }
  if (isObject(resume.profileSection) && typeof resume.profileSection.summary === "string")
    out.profileSection = { ...resume.profileSection, summary: escaped(resume.profileSection.summary) as string }
  if (isObject(resume.extraSections)) {
    out.extraSections = Object.fromEntries(
      Object.entries(resume.extraSections).map(([key, section]) => {
        if (!isObject(section)) return [key, section]
        if (section.kind === "text" && typeof section.text === "string") return [key, { ...section, text: escaped(section.text) as string }]
        if (section.kind === "list" && typeof section.bullets === "string")
          return [key, { ...section, bullets: escaped(section.bullets) as string }]
        return [key, section]
      }),
    )
  }
  return out as T
}
