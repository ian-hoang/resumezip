// Helpers for the rules that read the preview PDF: text compared without the
// things printing changes, and the lines each typed bullet is printed on.

import type { Line } from "@/lib/import/lines"
import type { PdfReading } from "./engine"
import type { ResumeView } from "./resume"
import { bulletsIn, type PlacedBullet } from "./text"
import type { Place } from "./places"

// Text without accents or case. Upper case first, as some templates print
// names in capitals: "Strauß" prints as "STRAUSS", and only comparing that
// way round finds them the same. A capital ẞ doesn't change when upper-cased,
// so a ß left at the end is spelled out too.
const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().toLowerCase().replace(/ß/g, "ss")

/**
 * Text as compared between the PDF and the editor: letters and digits only,
 * without accents, so line breaks, hyphens, quotes and bold marks don't count.
 */
export const comparable = (text: string) => fold(text).replace(/[^\p{L}\p{N}]+/gu, "")

/** A text's words, as compared between the PDF and the editor: lower case, without accents or punctuation. */
export const wordsOf = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/** A bullet as the PDF lays it out: the line it starts on, then the lines it wraps onto. */
export interface PrintedBullet {
  lines: Line[]
}

/**
 * Each typed bullet with the lines the PDF prints it on, matched in order by
 * their words: the line its words start on, then each line that carries them
 * on. That works whether or not a template's bullets are marked in the PDF's
 * text. A bullet the PDF doesn't print as typed is left out.
 */
export function printedBullets(resume: ResumeView, pdf: PdfReading): (PlacedBullet & { printed: PrintedBullet })[] {
  const excluded = new Set(pdf.extras?.excludedLines ?? [])
  const lines = pdf.lines.flatMap((line, index) => (excluded.has(index) ? [] : [{ line, text: comparable(line.text) }]))
  let from = 0
  return bulletsIn(resume).flatMap((placed) => {
    const want = comparable(placed.bullet.text)
    if (!want) return []
    for (let i = from; i < lines.length; i++) {
      if (!lines[i].text || !want.startsWith(lines[i].text)) continue
      let got = lines[i].text
      let next = i + 1
      while (got.length < want.length && next < lines.length && lines[next].text && want.startsWith(got + lines[next].text)) {
        got += lines[next].text
        next++
      }
      if (got !== want) continue
      from = next
      return [{ ...placed, printed: { lines: lines.slice(i, next).map(({ line }) => line) } }]
    }
    return []
  })
}

/** Custom lists participate in physical layout checks, without role-specific bullet advice. */
export function printedLayoutBullets(resume: ResumeView, pdf: PdfReading): { place: Place; printed: PrintedBullet }[] {
  const custom = (pdf.extras?.sections ?? [])
    .filter((section) => section.status === "matched")
    .flatMap((section) =>
      section.parts.flatMap(({ place, lines }) =>
        place.kind === "extra-text" && place.field === "bullets" && lines.length
          ? [{ place, printed: { lines: lines.map((index) => pdf.lines[index]) } }]
          : [],
      ),
    )
  return [...printedBullets(resume, pdf), ...custom]
}
