// Turns a PDF or Word file into lines of text that keep what a reader would
// use to make sense of a resume: where text sits, how big and bold it is, and
// what's pushed to the right edge. parse.ts sorts the lines into fields.

import type { PDFDocumentProxy } from "pdfjs-dist"
import type { TextContent } from "pdfjs-dist/types/src/display/api"
import { unzip, zip } from "@/lib/zip"
import { MAX_CELL_PARAGRAPHS, MAX_CHARACTERS, MAX_LINES, MAX_UNZIPPED_BYTES, TooMuchTextError } from "./limits"

/** A stretch of text in one style; `start` and `end` index into its part's text. */
export interface Run {
  start: number
  end: number
  bold: boolean
  italic: boolean
}

/** Text set apart from the rest of its line by a wide gap or a tab, like dates on the right edge. */
export interface Part {
  text: string
  x: number
  runs: Run[]
  /** Its biggest text's size, in a PDF. The line's is the biggest on it, which can be a heading's set in a margin beside it. */
  size?: number
}

export interface Line {
  parts: Part[]
  /** The parts joined by spaces. */
  text: string
  /** The line started with a bullet, which has been removed from the text. */
  bullet: boolean
  /** Where the line starts, including any bullet. */
  left: number
  /** Where the text (after any bullet) starts. */
  x: number
  size: number
  bold: boolean
  italic: boolean
  /** Links on the line: PDF link annotations or Word hyperlinks. */
  links: string[]
  /** A Word heading. */
  heading?: boolean
  /** In a Word file's page footer: on every page, apart from the section above it. */
  footer?: boolean
  /** Set across a PDF page's two columns, above them, like a name or a centered contact line: in neither column. */
  spans?: boolean
  /** 1-based page, for highlighting. Word files have no pages. */
  page?: number
  /** [left, top, right, bottom] in PDF points from the page's top-left corner. */
  box?: [number, number, number, number]
}

export interface PageSize {
  width: number
  height: number
}

/** Ends a line where a word was broken in two; parse.ts joins the word back up. */
export const SOFT_HYPHEN = "\u00AD"

/** "2", "Page 2", "2 of 3", "- 2 -". */
export const PAGE_NUMBER = /^[\s\-\u2013\u2014]*(?:page\s+)?(\d{1,3})(?:\s*(?:of|\/)\s*\d{1,3})?[\s\-\u2013\u2014]*$/i

/** Characters that start a bullet: the usual ones, symbols, and those Word puts in its own fonts. */
export const BULLET_CHARS =
  "\u2022\u25CF\u25AA\u25A0\u25E6\u2023\u2219\u00B7\u25CB\u25C6\u25BA\u25B8\u27A2\u27A4\u2713\u2714\u2605\u2043\uF0B7\uF0A7\uF076\uF0D8\uF0FC\uF0A8\uF06C"
// Symbol bullets may touch the text; dashes and asterisks need a space after
// them, or a gap wide enough to set them apart from the text.
const BULLET = new RegExp(`^(?:[${BULLET_CHARS}]\\s*|[-\\u2013\\u2014*](?:\\s+|$))`)
const BULLET_ONLY = new RegExp(`^[${BULLET_CHARS}\\-\\u2013\\u2014*]$`)
const BOLD_FONT = /bold|black|heavy|demi|cmbx|cmb\d|extrab|ultrab/i
const ITALIC_FONT = /italic|oblique|cmti|cmsl|cmmi|-it\b/i

/** A stretch of text in one style. */
export interface Piece {
  text: string
  bold: boolean
  italic: boolean
}

/** Joins pieces of text into parts, starting a new part at each tab or run of spaces. */
function toParts(pieces: Piece[], x: number, size?: number): Part[] {
  const parts: Part[] = []
  let part: Part = { text: "", x, runs: [] }
  const finish = () => {
    const lead = part.text.length - part.text.trimStart().length
    const text = part.text.trim()
    if (!text) return
    const runs = part.runs
      .map((run) => ({ ...run, start: Math.max(0, run.start - lead), end: Math.min(text.length, run.end - lead) }))
      .filter((run) => run.end > run.start)
    parts.push({ text, x: part.x, runs, ...(size !== undefined && { size }) })
  }
  for (const piece of pieces) {
    piece.text.split(/\t+| {3,}/).forEach((chunk, i) => {
      if (i > 0) {
        finish()
        // Tab-separated text has no position of its own; keep the order.
        part = { text: "", x: x + i, runs: [] }
      }
      const start = part.text.length
      part.text += chunk.replace(/\s/g, " ")
      if (chunk) part.runs.push({ start, end: part.text.length, bold: piece.bold, italic: piece.italic })
    })
  }
  finish()
  return parts
}

/**
 * A link as written. LaTeX turns a link without "https://" into a link to
 * another PDF, which pdf.js reports as "www.site.com/page/.pdf#[0,{...}]";
 * the part from ".pdf#[" on isn't part of the address.
 */
export function cleanLink(url: string): string {
  const remote = url.match(/^(.*?)\/?\.pdf#\[/i)
  return remote ? remote[1] : url
}

/** A line from its parts, with any bullet it starts with taken off. */
export function toLine(parts: Part[], size: number, links: string[], extra: Partial<Line> = {}): Line | null {
  if (parts.length === 0) return null
  const left = parts[0].x
  let x = left
  let bullet = extra.bullet === true

  const match = parts[0].text.match(BULLET)
  if (match) {
    bullet = true
    const cut = match[0].length
    const first = parts[0]
    const rest = first.text.slice(cut)
    parts = rest
      ? [
          {
            ...first,
            text: rest,
            runs: first.runs
              .map((run) => ({ ...run, start: Math.max(0, run.start - cut), end: run.end - cut }))
              .filter((run) => run.end > run.start),
          },
          ...parts.slice(1),
        ]
      : parts.slice(1)
    if (parts.length === 0) return null
    x = extra.x ?? (rest ? left : parts[0].x)
  }

  const chars = (predicate: (run: Run) => boolean) =>
    parts.reduce((sum, part) => sum + part.runs.filter(predicate).reduce((n, run) => n + run.end - run.start, 0), 0)
  const total = chars(() => true) || 1

  return {
    parts,
    text: parts.map((part) => part.text).join(" "),
    bullet,
    left,
    x,
    size,
    bold: chars((run) => run.bold) / total > 0.6,
    italic: chars((run) => run.italic) / total > 0.6,
    links: [...new Set(links)],
    heading: extra.heading,
    page: extra.page,
    box: extra.box,
  }
}

// ---------------------------------------------------------------- PDF

interface Item {
  text: string
  x: number
  right: number
  baseline: number
  size: number
  bold: boolean
  italic: boolean
  /** A hyphen alone in a marked span, the way a typesetter marks one it added to break a word. */
  soft?: boolean
  /** Ends where a hyphen pdf.js leaves out broke a word in two. */
  broken?: boolean
}

/** A link on a page, in the same coordinates as the page's text. */
interface Link {
  url: string
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A page's text and links as pdf.js read them, before they're sorted into lines. */
export interface PdfPage extends PageSize {
  items: Item[]
  links: Link[]
}

/** Text in a column starts at the same place on most of its lines, at least `fewest` of them; right-aligned dates don't. */
function leftAligned(items: Item[], fewest = 5): boolean {
  const starts = new Map<number, number>()
  for (const item of items) {
    const line = Math.round(item.baseline)
    starts.set(line, Math.min(starts.get(line) ?? Infinity, item.x))
  }
  if (starts.size < fewest) return false
  const counts = new Map<number, number>()
  for (const x of starts.values()) counts.set(Math.round(x / 3), (counts.get(Math.round(x / 3)) ?? 0) + 1)
  const most = Math.max(...counts.values())
  return most >= 2 && most / starts.size >= 0.5
}

/** Every line ends at one place, within a point. */
function flushRight(items: Item[]): boolean {
  const ends = new Map<number, number>()
  for (const item of items) {
    const line = Math.round(item.baseline)
    ends.set(line, Math.max(ends.get(line) ?? -Infinity, item.right))
  }
  return Math.max(...ends.values()) - Math.min(...ends.values()) < 1
}

/** How many times text switches between the two sides of `x`, in the order it's written. */
function switches(items: Item[], x: number): number {
  let count = 0
  let side = 0
  for (const item of items) {
    const next = item.right <= x + 1 ? 1 : item.x >= x - 1 ? 2 : 0
    if (next === 0) continue
    if (side !== 0 && next !== side) count++
    side = next
  }
  return count
}

const chars = (list: Item[]) => list.reduce((sum, item) => sum + item.text.length, 0)

/** The text on each side of `x`, where columns split there would start, and the text below that. */
function sidesOf(items: Item[], x: number) {
  const left = items.filter((item) => item.right <= x + 1)
  const right = items.filter((item) => item.x >= x - 1)
  // The columns start below the last line that crosses the gap, like a
  // centered contact line, even where some of that line is on one side.
  const crossed = new Set(items.filter((item) => item.x < x - 1 && item.right > x + 1).map((item) => Math.round(item.baseline)))
  const highest = (list: Item[]) => Math.max(...list.filter((item) => !crossed.has(Math.round(item.baseline))).map((item) => item.baseline))
  const top = Math.min(highest(left), highest(right))
  const below = items.filter((item) => item.baseline <= top + 1)
  return { left, right, top, below, crossing: chars(below.filter((item) => item.x < x - 1 && item.right > x + 1)) }
}

/**
 * Finds the gap between two columns of text, if the page has them, and where
 * the columns start. Text may only cross it above that, like a name across the top.
 */
function findGutter(items: Item[], width: number): { x: number; top: number } | null {
  const total = chars(items)
  if (total < 150) return shortGutter(items, width)
  let best: { x: number; top: number; crossing: number; apart: boolean } | null = null
  for (let x = width * 0.2; x <= width * 0.8; x += 2) {
    const { left, right, top, below, crossing } = sidesOf(items, x)
    const share = Math.min(chars(left), chars(right)) / total
    if (share < 0.05) continue
    if (!Number.isFinite(top)) continue
    if (crossing / total > 0.01) continue
    // A column written whole, before or after the other, is a column however
    // little it holds, as long as it has lines of its own and the columns
    // hold most of the page. Dates in a margin are written with their entries.
    const lines = (list: Item[]) => new Set(list.map((item) => Math.round(item.baseline))).size
    const apart =
      switches(below, x) <= 3 &&
      chars(below) / total >= 0.5 &&
      lines(below.filter((item) => item.right <= x + 1)) >= 5 &&
      lines(below.filter((item) => item.x >= x - 1)) >= 5
    if (share < 0.2 && !apart) continue
    if (!best || crossing < best.crossing) best = { x, top, crossing, apart }
  }
  if (!best) return shortGutter(items, width)
  const { x, top, apart } = best
  const ok = apart || (leftAligned(items.filter((item) => item.x >= x - 1)) && leftAligned(items.filter((item) => item.right <= x + 1)))
  return ok ? { x, top } : shortGutter(items, width)
}

/**
 * Two columns with too few lines for findGutter to go by, like Deedy's with
 * one school and one job: nothing crosses between them, each is written
 * whole, one after the other, and most lines of each start at one place.
 * The gap is just left of the right column, so a name centered above
 * crosses it, and reads first.
 */
function shortGutter(items: Item[], width: number): { x: number; top: number } | null {
  const total = chars(items)
  for (let x = width * 0.8; x >= width * 0.2; x -= 2) {
    const { top, below, crossing } = sidesOf(items, x)
    if (!Number.isFinite(top) || crossing > 0 || switches(below, x) > 1 || chars(below) / total < 0.5) continue
    const columns = [below.filter((item) => item.right <= x + 1), below.filter((item) => item.x >= x - 1)]
    // Right-aligned dates written after a one-column page's text would pass
    // for a column of their own: they all end at one place, and a column's
    // lines, set ragged right, don't.
    if (columns.some(flushRight)) continue
    if (columns.every((column) => leftAligned(column, 2))) return { x, top }
  }
  return null
}

// pdf.js's codes for the drawing instructions read here (its `OPS`), which
// this file can't import without loading pdf.js along with it.
const SHOW_TEXT = 44
const BEGIN_MARKED_CONTENT = 69
const BEGIN_MARKED_CONTENT_PROPS = 70
const END_MARKED_CONTENT = 71

/**
 * The marked spans, by MCID, whose text ends with a soft hyphen. That's how
 * Typst draws a hyphen it added to break a word, and pdf.js leaves soft
 * hyphens out of a page's text, so they're found in its drawing instead.
 */
function softHyphenSpans({ fnArray = [], argsArray = [] }: { fnArray?: number[]; argsArray?: unknown[] }): Set<number> {
  const found = new Set<number>()
  // Only each open span's last glyph is kept, not its text: a span's text
  // passes on to the one around it, so keeping it all would take time
  // quadratic in how deeply a PDF nests its spans.
  const spans: { mcid: unknown; last: string }[] = []
  fnArray.forEach((fn, i) => {
    const args = argsArray[i]
    if (fn === BEGIN_MARKED_CONTENT || fn === BEGIN_MARKED_CONTENT_PROPS) {
      spans.push({ mcid: fn === BEGIN_MARKED_CONTENT_PROPS && Array.isArray(args) ? args[1] : undefined, last: "" })
    } else if (fn === END_MARKED_CONTENT) {
      const span = spans.pop()
      if (span && typeof span.mcid === "number" && span.last.endsWith(SOFT_HYPHEN)) found.add(span.mcid)
      if (span?.last && spans.length > 0) spans[spans.length - 1].last = span.last
    } else if (fn === SHOW_TEXT && spans.length > 0 && Array.isArray(args) && Array.isArray(args[0])) {
      // Glyphs, with numbers between them for the spacing.
      for (const glyph of args[0] as unknown[]) {
        const unicode = typeof glyph === "object" && glyph !== null ? (glyph as { unicode?: unknown }).unicode : undefined
        if (typeof unicode === "string" && unicode) spans[spans.length - 1].last = unicode
      }
    }
  })
  return found
}

/**
 * Reads every page's text, with its styles and links. pdf.js does the reading
 * in a worker of its own; sorting the text into lines (`linesFromPages`) is
 * plain work that can run in another. Stops as soon as there's more text than
 * a resume would have, or when `signal` aborts.
 */
export async function readPdf(doc: PDFDocumentProxy, signal?: AbortSignal): Promise<PdfPage[]> {
  const pages: PdfPage[] = []
  let characters = 0

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    signal?.throwIfAborted()
    const page = await doc.getPage(pageNumber)
    const [x0, y0, x1, y1] = page.view

    // Font names (like "Calibri-Bold") are only available once the page's fonts are loaded.
    const hyphens = softHyphenSpans(await page.getOperatorList())
    const fontStyles = new Map<string, { bold: boolean; italic: boolean }>()
    const styleOf = (fontName: string) => {
      let style = fontStyles.get(fontName)
      if (!style) {
        let name = ""
        try {
          name = String((page.commonObjs.get(fontName) as { name?: string } | null)?.name ?? "")
        } catch {
          // Not loaded: treat it as regular.
        }
        style = { bold: BOLD_FONT.test(name), italic: ITALIC_FONT.test(name) }
        fontStyles.set(fontName, style)
      }
      return style
    }

    // pdf.js sends a page's text a few pieces at a time, so reading stops at
    // the first piece past the limit, even partway through a page.
    const items: Item[] = []
    // Marked spans of text, open around the current one. A hyphen a
    // typesetter added to break a word is marked as a soft hyphen in a span
    // of its own; pdf.js gives the hyphen, but not what it's marked as. So
    // each span counts the pieces of text in it, keeping the first, and
    // passes them on to the span around it when it ends. Only a span with
    // properties can say what its text stands for, and only one outside the
    // document's structure (with no MCID) is there to say it.
    const spans: { count: number; first?: Item; standsIn: boolean; mcid?: number }[] = []
    const reader = (page.streamTextContent({ includeMarkedContent: true }) as ReadableStream<TextContent>).getReader()
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        for (const item of chunk.value.items) {
          if ("type" in item) {
            if (item.type === "beginMarkedContent" || item.type === "beginMarkedContentProps") {
              const mcid = item.type === "beginMarkedContentProps" ? item.id?.match(/_mc(\d+)$/)?.[1] : undefined
              spans.push({ count: 0, standsIn: item.type === "beginMarkedContentProps" && !item.id, mcid: mcid ? Number(mcid) : undefined })
            } else if (item.type === "endMarkedContent") {
              const span = spans.pop()
              if (span?.standsIn && span.count === 1 && /^[-\u2010]$/.test(span.first!.text)) span.first!.soft = true
              // A span ending with a soft hyphen broke the word read last, in it or just before it.
              const word = items[items.length - 1]
              if (span?.mcid !== undefined && hyphens.has(span.mcid) && word && /\p{L}$/u.test(word.text)) word.broken = true
              const outer = spans[spans.length - 1]
              if (span?.first && outer) {
                outer.first ??= span.first
                outer.count += span.count
              }
            }
            continue
          }
          if (!("str" in item) || item.str.trim() === "") continue
          const [a, b, c, d, e, f] = item.transform as number[]
          if (Math.abs(b) > Math.abs(a)) continue // rotated, like a vertical label in a sidebar
          const text = item.str.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
          characters += text.length
          if (characters > MAX_CHARACTERS) throw new TooMuchTextError()
          const read: Item = {
            text,
            x: e - x0,
            right: e - x0 + item.width,
            baseline: f - y0,
            size: Math.hypot(c, d) || item.height || 10,
            ...styleOf(item.fontName),
          }
          items.push(read)
          const span = spans[spans.length - 1]
          if (span) {
            span.first ??= read
            span.count++
          }
        }
      }
    } catch (error) {
      // pdf.js stops reading the rest of the page. It needs an Error as the
      // reason, or it misses that the reading was stopped.
      void reader.cancel(new Error("Stopped reading the page")).catch(() => {})
      throw error
    }

    const annotations = (await page.getAnnotations()) as { subtype?: string; url?: string; unsafeUrl?: string; rect?: number[] }[]
    const links = annotations
      .filter((note) => note.subtype === "Link" && (note.url || note.unsafeUrl) && note.rect?.length === 4)
      .map((note) => {
        const [lx0, ly0, lx1, ly1] = note.rect!
        return { url: cleanLink(String(note.url || note.unsafeUrl)), x0: lx0 - x0, y0: ly0 - y0, x1: lx1 - x0, y1: ly1 - y0 }
      })

    pages.push({ width: x1 - x0, height: y1 - y0, items, links })
  }

  return pages
}

/** Sorts pages' text into lines, in reading order. */
export function linesFromPages(pages: PdfPage[]): Line[] {
  const lines: Line[] = []

  pages.forEach((page, index) => {
    const pageNumber = index + 1
    const { width, height, links } = page
    const items = page.items.map((item) => ({ ...item, column: 0 }))
    const gutter = findGutter(items, width)
    if (gutter !== null) {
      const { x, top } = gutter
      // Above the columns, a line that crosses the gap spans them, even the
      // parts of it on one side, and so does all the text above it, like a
      // short centered name over a contact line.
      const crossing = items.filter((item) => item.baseline > top + 1 && item.x < x - 1 && item.right > x + 1)
      const spanning = new Set(crossing.map((item) => Math.round(item.baseline)))
      const below = Math.min(...crossing.map((item) => item.baseline))
      for (const item of items) {
        const spans = item.baseline > top + 1 && (spanning.has(Math.round(item.baseline)) || item.baseline > below)
        item.column = spans ? 0 : item.right <= x + 1 ? 1 : item.x >= x - 1 ? 2 : 0
      }
    }

    // Top to bottom (text spanning the columns first, then each column),
    // grouping text that shares a baseline into a line.
    items.sort((p, q) => p.column - q.column || q.baseline - p.baseline || p.x - q.x)
    const groups: (typeof items)[] = []
    for (const item of items) {
      const group = groups[groups.length - 1]
      const anchor = group?.[0]
      const sameLine =
        anchor && anchor.column === item.column && Math.abs(anchor.baseline - item.baseline) <= 0.45 * Math.max(anchor.size, item.size)
      if (sameLine) group.push(item)
      else groups.push([item])
    }

    // Each line, with where it sits, for links that no text sits on.
    const placed: { line: Line; baseline: number; left: number; right: number; size: number }[] = []
    const claimed = new Set<Link>()
    for (const group of groups) {
      group.sort((p, q) => p.x - q.x)
      const size = Math.max(...group.map((item) => item.size))
      // Split into parts at wide gaps; elsewhere add spaces where words were set apart.
      // Letter-spaced text ("E D U C A T I O N") has a gap after every letter;
      // only gaps wider than those are spaces between words.
      let letterGap = 0
      if (group.length >= 4 && group.filter((item) => item.text.trim().length <= 2).length / group.length >= 0.6) {
        const gaps = group
          .slice(1)
          .map((item, i) => item.x - group[i].right)
          .sort((a, b) => a - b)
        const median = gaps[Math.floor(gaps.length / 2)]
        // Small caps also come out a letter or two at a time, but with the letters touching.
        if (median > 0.08 * size) letterGap = median + 0.2 * size
      }
      const apart = Math.max(0.9 * size, 7, letterGap + 0.5 * size)
      const parts: Part[] = []
      let pieces: Piece[] = []
      let partX = group[0].x
      let partSize = 0
      let previous: Item | null = null
      for (const [index, item] of group.entries()) {
        if (previous) {
          const gap = item.x - previous.right
          if (gap > apart) {
            parts.push(...toParts(pieces, partX, partSize))
            pieces = []
            partX = item.x
            partSize = 0
          } else if (gap > Math.max(0.12 * size, letterGap) && !/\s$/.test(previous.text) && !/^\s/.test(item.text)) {
            pieces.push({ text: " ", bold: item.bold, italic: item.italic })
          }
        }
        // A marked hyphen ending a line, right after a letter, broke a word in two.
        const soft =
          item.soft &&
          item === group[group.length - 1] &&
          previous &&
          item.x - previous.right < 0.12 * size &&
          /\p{L}$/u.test(previous.text)
        // So did a hyphen pdf.js left out, ending the word's part of the line:
        // a heading in a margin has the section's text beside it.
        const next = group[index + 1]
        const hidden = item.broken && (!next || next.x - item.right > apart)
        pieces.push({ text: soft ? SOFT_HYPHEN : hidden ? item.text + SOFT_HYPHEN : item.text, bold: item.bold, italic: item.italic })
        partSize = Math.max(partSize, item.size)
        previous = item
      }
      parts.push(...toParts(pieces, partX, partSize))

      const left = group[0].x
      const right = Math.max(...group.map((item) => item.right))
      // Where most of the line's text sits: a heading in a margin beside it can sit a little higher or lower.
      const weights = new Map<number, number>()
      for (const item of group) weights.set(item.baseline, (weights.get(item.baseline) ?? 0) + item.text.length)
      const baseline = [...weights].sort((a, b) => b[1] - a[1])[0][0]
      const box: [number, number, number, number] = [left, height - baseline - size * 0.85, right, height - baseline + size * 0.3]
      const onLine = links.filter(
        (link) => baseline >= link.y0 - 3 && baseline <= link.y1 + 1 && link.x1 >= left - 2 && link.x0 <= right + 2,
      )
      for (const link of onLine) claimed.add(link)
      const lineLinks = onLine.map((link) => link.url)

      // A bullet drawn as its own piece of text: the line's text starts at the next piece.
      const textX = BULLET_ONLY.test(group[0].text.trim()) && group.length > 1 ? group[1].x : undefined
      const line = toLine(parts, size, lineLinks, { page: pageNumber, box, x: textX })
      if (line) {
        if (gutter !== null && group[0].column === 0) line.spans = true
        lines.push(line)
        placed.push({ line, baseline, left, right, size })
      }
    }

    // A link with no text on it, like an icon, belongs to the closest line just
    // above or below it: icons for LinkedIn and GitHub under the phone number.
    for (const link of links) {
      if (claimed.has(link)) continue
      const distance = (at: (typeof placed)[number]) =>
        at.baseline < link.y0 ? link.y0 - at.baseline : at.baseline > link.y1 ? at.baseline - link.y1 : 0
      const nearest = placed
        .filter((at) => distance(at) <= 1.5 * at.size && at.right >= link.x0 - 40 && at.left <= link.x1 + 40)
        .sort((a, b) => distance(a) - distance(b))[0]
      if (nearest && !nearest.line.links.includes(link.url)) nearest.line.links.push(link.url)
    }
  })

  return lines
}

// ---------------------------------------------------------------- Word

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? entity
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
    return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : ""
  })

// Word files carry no positions, so headings get sizes that rank them like a PDF's would.
const HEADING_SIZES: Record<string, number> = { h1: 22, h2: 18, h3: 15, h4: 13, h5: 12, h6: 12 }
const BODY_SIZE = 11

interface Block {
  pieces: Piece[]
  size: number
  heading: boolean
  bullet: boolean
  links: string[]
}

/** A paragraph, or a table row read across, before it's a line: one in a cell waits there until its row ends. */
interface Paragraph {
  /** Set from x = 0, with any bullet still on, since how its row is read decides where it goes and whether it starts a line. */
  parts: Part[]
  size: number
  heading?: boolean
  bullet: boolean
  /** How far its list indents it. */
  indent: number
  links: string[]
  /** It came out of a table's row, so a cell holding it holds a table. */
  table?: boolean
}

const moved = (parts: Part[], by: number): Part[] => (by === 0 ? parts : parts.map((part) => ({ ...part, x: part.x + by })))

/**
 * A table row's cells as paragraphs. Read across, each paragraph down the
 * row becomes one, with a part per cell, like a PDF's columns, as a cell's
 * paragraphs sit beside the first lines of the others: a heading beside its
 * section, or an entry's dates and place beside its title. A paragraph
 * alone on its line keeps its style. Cells that are columns of their own,
 * as in a layout table, would interleave that way, so they're read one
 * after another: when two or more hold several paragraphs and two of those
 * hold four or more, more than an entry's details take, or start with a
 * heading, or one of them holds a table.
 */
function readRow(cells: Paragraph[][]): Paragraph[] {
  // Paragraphs of only spaces would push the text beside them down a line, so
  // they're left out, as mammoth leaves out empty ones. One with a link stays.
  const filled = cells.map((cell) => cell.filter((paragraph) => paragraph.parts.length > 0 || paragraph.links.length > 0))
  const several = filled.filter((cell) => cell.length > 1)
  const long = several.filter((cell) => cell.length >= 4).length
  const headed = several.filter((cell) => cell[0].heading).length
  const holdsTable = several.some((cell) => cell.some((paragraph) => paragraph.table))
  if (long > 1 || headed > 1 || (several.length > 1 && holdsTable)) return filled.flat()
  const height = filled.reduce((most, cell) => Math.max(most, cell.length), 0)
  return Array.from({ length: height }, (_, i) => {
    const line = filled.flatMap((cell, column) => (cell[i] ? [{ ...cell[i], parts: moved(cell[i].parts, column * 200) }] : []))
    if (line.length === 1) return line[0]
    const links = line.flatMap((paragraph) => paragraph.links)
    return { parts: line.flatMap((paragraph) => paragraph.parts), size: BODY_SIZE, bullet: false, indent: 0, links }
  })
}

/**
 * Reads the HTML mammoth makes from a Word file. It only uses a few tags (p,
 * h1-h6, ul/ol/li, table, strong, em, a, br), so a small scanner is enough.
 * A table's paragraphs wait in their cells until their row ends, to be read
 * across it or a cell at a time (`readRow`). A table in a cell reads its rows
 * into that cell, as paragraphs.
 */
function linesFromHtml(html: string): Line[] {
  const lines: Line[] = []
  const state: { block: Block | null } = { block: null }
  // The tables around the text being read, innermost last.
  const tables: { row: Paragraph[][] | null; cell: Paragraph[] | null }[] = []
  let bold = 0
  let italic = 0
  let listDepth = 0
  let inCells = 0

  // Into the innermost open cell, or out as a line.
  const place = (paragraph: Paragraph) => {
    const cell = tables.findLast((table) => table.cell)?.cell
    if (cell) {
      if (++inCells > MAX_CELL_PARAGRAPHS) throw new TooMuchTextError()
      cell.push(paragraph)
      return
    }
    const { parts, size, links, heading, bullet, indent } = paragraph
    const line = toLine(moved(parts, indent), size, links, { heading, bullet })
    if (line) lines.push(line)
  }
  const start = (tag: string): Block => {
    state.block = { pieces: [], size: HEADING_SIZES[tag] ?? BODY_SIZE, heading: tag in HEADING_SIZES, bullet: tag === "li", links: [] }
    return state.block
  }
  const end = () => {
    const done = state.block
    state.block = null
    if (!done) return
    const { pieces, size, heading, bullet, links } = done
    place({ parts: toParts(pieces, 0), size, heading, bullet, indent: bullet ? 20 * listDepth : 0, links })
  }
  const endCell = () => {
    end()
    const table = tables[tables.length - 1]
    if (!table?.cell) return
    const cell = table.cell
    table.cell = null
    if (table.row) table.row.push(cell)
    else cell.forEach(place)
  }
  const endRow = () => {
    endCell()
    const table = tables[tables.length - 1]
    if (!table?.row) return
    const cells = table.row
    table.row = null
    for (const paragraph of readRow(cells)) place({ ...paragraph, table: true })
  }
  const endTable = () => {
    endRow()
    tables.pop()
  }

  for (const match of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    const [, closing, rawTag, attributes, text] = match
    if (text !== undefined) {
      const block = state.block ?? start("p")
      block.pieces.push({ text: decode(text).replace(/[\r\n]+/g, " "), bold: bold > 0, italic: italic > 0 })
      continue
    }
    const tag = rawTag.toLowerCase()
    if (tag === "strong" || tag === "b") bold = Math.max(0, bold + (closing ? -1 : 1))
    else if (tag === "em" || tag === "i") italic = Math.max(0, italic + (closing ? -1 : 1))
    else if (tag === "ul" || tag === "ol") {
      end()
      listDepth = Math.max(0, listDepth + (closing ? -1 : 1))
    } else if (tag === "a" && !closing) {
      const href = attributes.match(/href="([^"]*)"/i)?.[1]
      if (href && !href.startsWith("#")) (state.block ?? start("p")).links.push(decode(href))
    } else if (tag === "br") {
      const current = state.block
      end()
      if (current) start(current.bullet ? "li" : "p").size = current.size
    } else if (tag === "p" || tag === "li" || tag in HEADING_SIZES) {
      end()
      if (!closing) start(tag)
    } else if (tag === "table") {
      if (closing) endTable()
      else {
        end()
        tables.push({ row: null, cell: null })
      }
    } else if (tag === "tr") {
      endRow()
      if (!closing && tables.length > 0) tables[tables.length - 1].row = []
    } else if (tag === "td" || tag === "th") {
      endCell()
      if (!closing && tables.length > 0) tables[tables.length - 1].cell = []
    }
  }
  while (tables.length > 0) endTable()
  end()
  return lines
}

// ---------------------------------------------------------------- Word headers and footers

/**
 * A tag in a Word file's XML, or the text between tags. An attribute's value
 * can hold ">" but not "<", so a tag ends at the first ">" outside quotes.
 */
const XML_TOKEN = /<(\/?)([\w.:-]+)((?:[^<>"']|"[^"<]*"|'[^'<]*')*)>|([^<]+)/g

/** An attribute's value, from a tag's attributes. */
function attribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`))
  return match ? decode(match[1] ?? match[2]) : undefined
}

/** Whether a property like w:b is on: written alone, it is. */
const isOn = (attributes: string) => !/^(?:0|false|off)$/i.test(attribute(attributes, "w:val") ?? "")

/** A file in the zip as text, or "" when there's no such file. */
const xmlOf = (files: Record<string, Uint8Array>, path: string) => (Object.hasOwn(files, path) ? new TextDecoder().decode(files[path]) : "")

interface Relationship {
  type: string
  /** A file's path in the zip, or an address outside it. */
  target: string
  external: boolean
}

/** What a part of a Word file points to, by relationship ID. The package's own relationships are part ""'s. */
function relationshipsOf(files: Record<string, Uint8Array>, part: string): Map<string, Relationship> {
  const folder = part.slice(0, part.lastIndexOf("/") + 1)
  const found = new Map<string, Relationship>()
  for (const [, closing, tag, attributes] of xmlOf(files, `${folder}_rels/${part.slice(folder.length)}.rels`).matchAll(XML_TOKEN)) {
    const id = tag === "Relationship" && !closing ? attribute(attributes, "Id") : undefined
    const target = id && attribute(attributes, "Target")
    if (!id || !target) continue
    const external = attribute(attributes, "TargetMode") === "External"
    // A path starts from the part's folder, or from the top of the zip with a "/", and ".." is the folder above.
    const path = (target.startsWith("/") ? target.slice(1) : folder + target)
      .split("/")
      .reduce<string[]>((up, segment) => (segment === ".." ? up.slice(0, -1) : segment === "." ? up : [...up, segment]), [])
      .join("/")
    found.set(id, { type: attribute(attributes, "Type") ?? "", target: external ? target : path, external })
  }
  return found
}

interface Section {
  /** Its first page has a header and footer of its own (w:titlePg). */
  titlePage: boolean
  references: { kind: "header" | "footer"; type: string; id: string }[]
}

/** The document's sections, with the headers and footers each one names. */
function sectionsOf(document: string): Section[] {
  const sections: Section[] = []
  // A section's properties can hold their own earlier version, as a tracked change.
  let depth = 0
  for (const [, closing, tag, attributes] of document.matchAll(XML_TOKEN)) {
    if (tag === "w:sectPr") {
      if (closing) depth = Math.max(0, depth - 1)
      else if (!attributes.endsWith("/") && depth++ === 0) sections.push({ titlePage: false, references: [] })
    } else if (depth === 1 && !closing) {
      const section = sections[sections.length - 1]
      const kind = tag === "w:headerReference" ? "header" : tag === "w:footerReference" ? "footer" : null
      const id = kind && attribute(attributes, "r:id")
      if (kind && id) section.references.push({ kind, type: attribute(attributes, "w:type") ?? "default", id })
      else if (tag === "w:titlePg") section.titlePage = isOn(attributes)
    }
  }
  return sections
}

// Elements whose text isn't shown: a paragraph's properties (which hold its
// tab stops), formatting from before a tracked change, and deleted text.
const UNSHOWN = new Set(["w:pPr", "w:rPrChange", "w:del", "w:moveFrom"])

/** The code of a field Word fills in with a page number. */
const PAGE_NUMBER_CODE = /^\s*(?:PAGE|NUMPAGES|SECTIONPAGES)\b/i
/** Stands in for a page number Word fills in until its line is done. */
const PAGE_FIELD = "\uE000"
/** A page number Word fills in, with the words and marks around it: "Page 2 of 3", "| 2", "- 2 -". */
const NUMBERED = /[\s|,\u2022\u00B7\-\u2013\u2014]*(?:\bpage\s*)?\uE000(?:\s*(?:of|\/)\s*\uE000)?[\s|,\u2022\u00B7\-\u2013\u2014]*/gi

/** `pieces` with what `pattern` finds in their text, read across them, replaced by `by` in the style of the text it starts in. */
function replaced(pieces: Piece[], pattern: RegExp, by: string): Piece[] {
  const matches = [
    ...pieces
      .map((piece) => piece.text)
      .join("")
      .matchAll(pattern),
  ].map((match) => {
    const start = match.index ?? 0
    return { start, end: start + match[0].length }
  })
  if (matches.length === 0) return pieces
  let at = 0
  return pieces.map((piece) => {
    let text = ""
    for (let i = 0; i < piece.text.length; i++, at++) {
      const match = matches.find(({ start, end }) => at >= start && at < end)
      if (!match) text += piece.text[i]
      else if (at === match.start) text += by
    }
    return { ...piece, text }
  })
}

/**
 * Reads a header or footer a paragraph at a time, in tables and text boxes
 * too, with bold, italics and links read from each run as mammoth reads the
 * body's. A line's parts that are only a page number are left out.
 */
function readHeaderOrFooter(xml: string, relationships: Map<string, Relationship>, add: (line: Line) => void) {
  // The paragraphs open around the text, innermost last: a text box's sit in a run of the paragraph it's anchored to.
  const paragraphs: { pieces: Piece[]; links: string[] }[] = []
  const runs: { bold: boolean; italic: boolean }[] = []
  // Whether a choice of each mc:AlternateContent open was read: its other
  // choices, and its fallback, are the same text drawn another way.
  const alternatives: boolean[] = []
  // The fields open around the text, innermost last: Word's code for what it
  // fills in, then what it filled in last, which for a page number isn't read.
  const fields: { code: string; pageNumber: boolean }[] = []
  let unshown = 0
  let inText = false
  let inCode = false
  let inRunProperties = false

  const write = (text: string) => {
    const style = runs[runs.length - 1] ?? { bold: false, italic: false }
    paragraphs[paragraphs.length - 1]?.pieces.push({ text, ...style })
  }
  const endLine = () => {
    const paragraph = paragraphs[paragraphs.length - 1]
    if (!paragraph) return
    // A page number Word fills in, with its words, is a gap between what's on either side of it.
    const pieces = replaced(paragraph.pieces, NUMBERED, "\t")
    const line = toLine(
      toParts(pieces, 0).filter((part) => !PAGE_NUMBER.test(part.text)),
      BODY_SIZE,
      paragraph.links,
    )
    if (line) add(line)
    paragraph.pieces = []
    paragraph.links = []
  }

  for (const [, closing, tag, attributes, text] of xml.matchAll(XML_TOKEN)) {
    if (text !== undefined) {
      const field = fields[fields.length - 1]
      if (unshown) continue
      if (inCode && field) field.code += decode(text)
      else if (inText && !fields.some((open) => open.pageNumber)) write(decode(text).replace(/[\r\n]+/g, " "))
      continue
    }
    const empty = attributes.endsWith("/")
    if (unshown) {
      if (!empty) unshown += closing ? -1 : 1
      continue
    }
    const opens = !closing && !empty
    switch (tag) {
      case "w:p":
        if (opens) paragraphs.push({ pieces: [], links: [] })
        else if (closing) {
          endLine()
          paragraphs.pop()
        }
        break
      case "w:r":
        if (opens) runs.push({ bold: false, italic: false })
        else if (closing) runs.pop()
        break
      case "w:rPr":
        inRunProperties = opens
        break
      case "w:b":
      case "w:i":
        if (inRunProperties && !closing && runs.length > 0) runs[runs.length - 1][tag === "w:b" ? "bold" : "italic"] = isOn(attributes)
        break
      case "w:t":
        inText = opens
        break
      // w:ptab is the tab Word's own header layouts use, to set text in the middle or on the right.
      case "w:tab":
      case "w:ptab":
        if (!closing) write("\t")
        break
      case "w:br":
        if (!closing) endLine()
        break
      // A plain hyphen, not the U+2011 mammoth makes of it, so a phone number typed with them reads as one.
      case "w:noBreakHyphen":
        if (!closing) write("-")
        break
      // A character in a symbol font's own code, like a bullet or a phone between contact details: a gap between them.
      case "w:sym":
        if (!closing) write(" ")
        break
      case "w:hyperlink": {
        const link = opens ? relationships.get(attribute(attributes, "r:id") ?? "") : undefined
        if (link?.external) paragraphs[paragraphs.length - 1]?.links.push(link.target)
        break
      }
      // A field written out in runs: its start, its code, then what Word filled in, and its end.
      case "w:fldChar": {
        const type = closing ? undefined : attribute(attributes, "w:fldCharType")
        const field = fields[fields.length - 1]
        if (type === "begin") fields.push({ code: "", pageNumber: false })
        else if (type === "end") fields.pop()
        else if (type === "separate" && field) {
          field.pageNumber = PAGE_NUMBER_CODE.test(field.code)
          if (field.pageNumber) write(PAGE_FIELD)
        }
        break
      }
      case "w:instrText":
        inCode = opens
        break
      // A field with its code in an attribute, around what Word filled in.
      case "w:fldSimple": {
        if (closing) {
          fields.pop()
          break
        }
        const pageNumber = PAGE_NUMBER_CODE.test(attribute(attributes, "w:instr") ?? "")
        if (pageNumber) write(PAGE_FIELD)
        if (!empty) fields.push({ code: "", pageNumber })
        break
      }
      case "mc:AlternateContent":
        if (opens) alternatives.push(false)
        else if (closing) alternatives.pop()
        break
      case "mc:Choice":
      case "mc:Fallback":
        if (!opens || alternatives.length === 0) break
        if (alternatives[alternatives.length - 1]) unshown = 1
        else if (tag === "mc:Choice") alternatives[alternatives.length - 1] = true
        break
      default:
        if (opens && UNSHOWN.has(tag)) unshown = 1
    }
  }
}

/**
 * The lines of the page headers and footers a Word file's sections use, each
 * kind with the first page's before the rest's, and each line once. mammoth
 * only reads the body, and templates often put the name and contact details
 * in the header.
 */
function headersAndFooters(files: Record<string, Uint8Array>): Record<"header" | "footer", Line[]> {
  const main =
    [...relationshipsOf(files, "").values()].find(
      (relationship) =>
        relationship.type.endsWith("/officeDocument") && !relationship.external && Object.hasOwn(files, relationship.target),
    )?.target ?? "word/document.xml"
  const relationships = relationshipsOf(files, main)
  const found: Record<"header" | "footer", Line[]> = { header: [], footer: [] }
  const read = new Set<string>()
  const seen = new Set<string>()
  for (const section of sectionsOf(xmlOf(files, main))) {
    // Only a section that says so shows its "first" header and footer, on its first page.
    for (const type of section.titlePage ? ["first", "default"] : ["default"]) {
      for (const { kind, id } of section.references.filter((reference) => reference.type === type)) {
        const part = relationships.get(id)
        if (!part || part.external || !part.type.endsWith(`/${kind}`) || read.has(part.target)) continue
        read.add(part.target)
        readHeaderOrFooter(xmlOf(files, part.target), relationshipsOf(files, part.target), (line) => {
          // The header on the pages after the first often repeats the name in the first's.
          if (seen.has(line.text)) return
          seen.add(line.text)
          found[kind].push(kind === "footer" ? { ...line, footer: true } : line)
          if (found.header.length + found.footer.length > MAX_LINES) throw new TooMuchTextError()
        })
      }
    }
  }
  return found
}

interface Mammoth {
  convertToHtml: (
    input: { arrayBuffer: ArrayBuffer; buffer: ArrayBuffer },
    options: { convertImage: unknown },
  ) => Promise<{ value: string }>
  images: { imgElement: (attributes: () => { src: string }) => unknown }
}

/** A file mammoth couldn't read as a Word file. */
export class UnreadableWordFileError extends Error {}

/**
 * Reads a Word (.docx) file. mammoth is only downloaded when one is opened;
 * a failed download is thrown as it is, since it's no fault of the file.
 */
export async function linesFromDocx(data: ArrayBuffer): Promise<Line[]> {
  // mammoth's unzipper believes the sizes a zip gives until it has unzipped
  // everything, so it gets a copy unzipped here, under the limit, and stored.
  const files = await unzip(data, MAX_UNZIPPED_BYTES)
  if (files === "too big") throw new TooMuchTextError()
  if (!files) throw new UnreadableWordFileError("not a zip resumezip can read")
  const { header, footer } = headersAndFooters(files)
  const unzipped = zip(files).buffer
  const loaded = (await import("mammoth")) as unknown as Partial<Mammoth> & { default?: Mammoth }
  const mammoth = loaded.convertToHtml ? (loaded as Mammoth) : loaded.default!
  let html: string
  try {
    ;({ value: html } = await mammoth.convertToHtml(
      // Browsers get mammoth's browser build, which reads `arrayBuffer`; tests in Node get the one that reads `buffer`.
      { arrayBuffer: unzipped, buffer: unzipped },
      // Pictures aren't read, since only text is kept. By default mammoth copies each into the HTML.
      { convertImage: mammoth.images.imgElement(() => ({ src: "" })) },
    ))
  } catch (error) {
    throw new UnreadableWordFileError("mammoth couldn't read the file", { cause: error })
  }
  return [...header, ...linesFromHtml(html), ...footer]
}
