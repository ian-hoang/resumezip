// Turns a PDF or Word file into lines of text that keep what a reader would
// use to make sense of a resume: where text sits, how big and bold it is, and
// what's pushed to the right edge. parse.ts sorts the lines into fields.

import type { PDFDocumentProxy } from "pdfjs-dist"
import type { TextContent } from "pdfjs-dist/types/src/display/api"
import { zipDirectory } from "@/lib/zip"
import { MAX_CHARACTERS, MAX_WORD_XML_BYTES, TooMuchTextError } from "./limits"

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

/** Characters that start a bullet: the usual ones, symbols, and those Word puts in its own fonts. */
export const BULLET_CHARS =
  "\u2022\u25CF\u25AA\u25A0\u25E6\u2023\u2219\u00B7\u25CB\u25C6\u25BA\u25B8\u27A2\u27A4\u2713\u2714\u2605\u2043\uF0B7\uF0A7\uF076\uF0D8\uF0FC\uF0A8\uF06C"
// Symbol bullets may touch the text; dashes and asterisks need a space after
// them, or a gap wide enough to set them apart from the text.
const BULLET = new RegExp(`^(?:[${BULLET_CHARS}]\\s*|[-\\u2013\\u2014*](?:\\s+|$))`)
const BULLET_ONLY = new RegExp(`^[${BULLET_CHARS}\\-\\u2013\\u2014*]$`)
const BOLD_FONT = /bold|black|heavy|demi|cmbx|cmb\d|extrab|ultrab/i
const ITALIC_FONT = /italic|oblique|cmti|cmsl|cmmi|-it\b/i

interface Piece {
  text: string
  bold: boolean
  italic: boolean
}

/** Joins pieces of text into parts, starting a new part at each tab or run of spaces. */
function toParts(pieces: Piece[], x: number): Part[] {
  const parts: Part[] = []
  let part: Part = { text: "", x, runs: [] }
  const finish = () => {
    const lead = part.text.length - part.text.trimStart().length
    const text = part.text.trim()
    if (!text) return
    const runs = part.runs
      .map((run) => ({ ...run, start: Math.max(0, run.start - lead), end: Math.min(text.length, run.end - lead) }))
      .filter((run) => run.end > run.start)
    parts.push({ text, x: part.x, runs })
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

function toLine(parts: Part[], size: number, links: string[], extra: Partial<Line> = {}): Line | null {
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

/** Text in a column starts at the same place on most lines; right-aligned dates don't. */
function leftAligned(items: Item[]): boolean {
  const starts = new Map<number, number>()
  for (const item of items) {
    const line = Math.round(item.baseline)
    starts.set(line, Math.min(starts.get(line) ?? Infinity, item.x))
  }
  if (starts.size < 5) return false
  const counts = new Map<number, number>()
  for (const x of starts.values()) counts.set(Math.round(x / 3), (counts.get(Math.round(x / 3)) ?? 0) + 1)
  return Math.max(...counts.values()) / starts.size >= 0.5
}

/**
 * Finds the gap between two columns of text, if the page has them. Text may
 * only cross it above where the columns start, like a name across the top.
 */
function findGutter(items: Item[], width: number): number | null {
  const chars = (list: Item[]) => list.reduce((sum, item) => sum + item.text.length, 0)
  const total = chars(items)
  if (total < 150) return null
  let best: { x: number; crossing: number } | null = null
  for (let x = width * 0.2; x <= width * 0.8; x += 2) {
    const left = items.filter((item) => item.right <= x + 1)
    const right = items.filter((item) => item.x >= x - 1)
    if (chars(left) / total < 0.2 || chars(right) / total < 0.2) continue
    const top = Math.min(Math.max(...left.map((item) => item.baseline)), Math.max(...right.map((item) => item.baseline)))
    const crossing = chars(items.filter((item) => item.x < x - 1 && item.right > x + 1 && item.baseline <= top + 1))
    if (crossing / total <= 0.01 && (!best || crossing < best.crossing)) best = { x, crossing }
  }
  if (!best) return null
  const gutter = best.x
  const ok = leftAligned(items.filter((item) => item.x >= gutter - 1)) && leftAligned(items.filter((item) => item.right <= gutter + 1))
  return ok ? gutter : null
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
    await page.getOperatorList()
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
    const spans: { count: number; first?: Item; standsIn: boolean }[] = []
    const reader = (page.streamTextContent({ includeMarkedContent: true }) as ReadableStream<TextContent>).getReader()
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        for (const item of chunk.value.items) {
          if ("type" in item) {
            if (item.type === "beginMarkedContent" || item.type === "beginMarkedContentProps") {
              spans.push({ count: 0, standsIn: item.type === "beginMarkedContentProps" && !item.id })
            } else if (item.type === "endMarkedContent") {
              const span = spans.pop()
              if (span?.standsIn && span.count === 1 && /^[-\u2010]$/.test(span.first!.text)) span.first!.soft = true
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
      for (const item of items) item.column = item.right <= gutter + 1 ? 1 : item.x >= gutter - 1 ? 2 : 0
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
      const parts: Part[] = []
      let pieces: Piece[] = []
      let partX = group[0].x
      let previous: Item | null = null
      for (const item of group) {
        if (previous) {
          const gap = item.x - previous.right
          if (gap > Math.max(0.9 * size, 7, letterGap + 0.5 * size)) {
            parts.push(...toParts(pieces, partX))
            pieces = []
            partX = item.x
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
        pieces.push({ text: soft ? SOFT_HYPHEN : item.text, bold: item.bold, italic: item.italic })
        previous = item
      }
      parts.push(...toParts(pieces, partX))

      const left = group[0].x
      const right = Math.max(...group.map((item) => item.right))
      const baseline = group[0].baseline
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

/**
 * Reads the HTML mammoth makes from a Word file. It only uses a few tags (p,
 * h1-h6, ul/ol/li, table, strong, em, a, br), so a small scanner is enough.
 * Each table row becomes a line with a part per cell, like a PDF's columns.
 */
export function linesFromHtml(html: string): Line[] {
  const lines: Line[] = []
  const state: { block: Block | null; row: Block[][] | null; cell: Block[] | null } = { block: null, row: null, cell: null }
  let bold = 0
  let italic = 0
  let listDepth = 0

  const start = (tag: string): Block => {
    state.block = { pieces: [], size: HEADING_SIZES[tag] ?? BODY_SIZE, heading: tag in HEADING_SIZES, bullet: tag === "li", links: [] }
    return state.block
  }
  const end = () => {
    const done = state.block
    state.block = null
    if (!done) return
    if (state.cell) {
      state.cell.push(done)
      return
    }
    const line = toLine(toParts(done.pieces, done.bullet ? 20 * listDepth : 0), done.size, done.links, {
      heading: done.heading,
      bullet: done.bullet,
    })
    if (line) lines.push(line)
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
    } else if (tag === "tr") {
      end()
      if (!closing) state.row = []
      else if (state.row) {
        // A cell with several paragraphs adds lines below the row's first.
        const cells = state.row
        const height = Math.max(0, ...cells.map((c) => c.length))
        for (let i = 0; i < height; i++) {
          const parts = cells.flatMap((c, column) => (c[i] ? toParts(c[i].pieces, column * 200) : []))
          const line = toLine(
            parts,
            BODY_SIZE,
            cells.flatMap((c) => c[i]?.links ?? []),
          )
          if (line) lines.push(line)
        }
        state.row = null
      }
    } else if (tag === "td" || tag === "th") {
      end()
      if (!closing) state.cell = []
      else if (state.cell) {
        state.row?.push(state.cell)
        state.cell = null
      }
    }
  }
  end()
  return lines
}

/**
 * How big a Word file's XML (its text, styles and lists) is once unzipped, as
 * the zip's directory says. Infinity when the zip says it's too big for the
 * usual place and keeps it elsewhere (ZIP64, for files over 4 GB), which no
 * resume needs. Null when there's no directory to read, which leaves mammoth
 * to say whether it's a Word file at all.
 */
export function unzippedXmlSize(data: ArrayBuffer): number | null {
  const files = zipDirectory(data)
  if (files === "zip64") return Infinity
  if (!files) return null
  let total = 0
  for (const { name, size } of files) {
    if (!/\.(?:xml|rels)$/i.test(name)) continue
    // The real size is kept elsewhere (ZIP64).
    if (size === 0xffffffff) return Infinity
    total += size
  }
  return total
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
  if ((unzippedXmlSize(data) ?? 0) > MAX_WORD_XML_BYTES) throw new TooMuchTextError()
  const loaded = (await import("mammoth")) as unknown as Partial<Mammoth> & { default?: Mammoth }
  const mammoth = loaded.convertToHtml ? (loaded as Mammoth) : loaded.default!
  let html: string
  try {
    ;({ value: html } = await mammoth.convertToHtml(
      // Browsers get mammoth's browser build, which reads `arrayBuffer`; tests in Node get the one that reads `buffer`.
      { arrayBuffer: data, buffer: data },
      // Pictures aren't read, since only text is kept. By default mammoth copies each into the HTML.
      { convertImage: mammoth.images.imgElement(() => ({ src: "" })) },
    ))
  } catch (error) {
    throw new UnreadableWordFileError("mammoth couldn't read the file", { cause: error })
  }
  return linesFromHtml(html)
}
