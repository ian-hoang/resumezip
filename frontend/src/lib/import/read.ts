// The import worker's job: turn a file's text into lines and sort them into
// the editor's fields. It's here rather than in import.worker.ts so tests can
// run it without a worker.

import { MAX_CHARACTERS, MAX_LINES, TooMuchTextError } from "./limits"
import { linesFromDocx, linesFromPages, UnreadableWordFileError, type Line, type PdfPage } from "./lines"
import { parseResume, preparedLines, type ParsedResume } from "./parse"
import { matchExtraPdf, type ExtraPdfReading, type PdfSectionLayout } from "@/lib/check/extraPdf"

/** A PDF's pages, read on the page with pdf.js, or a Word file. */
export type ReadRequest = { kind: "pdf"; pages: PdfPage[]; checkerLayout?: PdfSectionLayout[] } | { kind: "docx"; data: ArrayBuffer }

/** What was found, why nothing was, or a bug's message (`failed`) for the page to log. */
export type ReadResult =
  { parsed: ParsedResume; extras?: ExtraPdfReading } | { problem: "no text" | "too much text" | "unreadable" } | { failed: string }

export async function readFile(request: ReadRequest): Promise<ReadResult> {
  try {
    let lines: Line[]
    try {
      lines = request.kind === "pdf" ? linesFromPages(request.pages) : await linesFromDocx(request.data)
    } catch (error) {
      if (error instanceof TooMuchTextError) return { problem: "too much text" }
      if (error instanceof UnreadableWordFileError) return { problem: "unreadable" }
      throw error
    }
    if (lines.length === 0) return { problem: "no text" }
    const characters = lines.reduce((sum, line) => sum + line.text.length, 0)
    if (lines.length > MAX_LINES || characters > MAX_CHARACTERS) return { problem: "too much text" }
    return request.kind === "pdf" && request.checkerLayout ? readForChecks(lines, request.checkerLayout) : { parsed: parseResume(lines) }
  } catch (error) {
    return { failed: error instanceof Error ? error.message : String(error) }
  }
}

/** Keep the physical source addresses even after excluding verified custom occurrences. */
export function readForChecks(lines: Line[], layout: PdfSectionLayout[]): { parsed: ParsedResume; extras: ExtraPdfReading } {
  // The lines as the parser prepares them, where a heading beside a section's
  // first entry has a line of its own in every template, to match the added
  // sections on. The file is parsed once, without the ones matched.
  const original = preparedLines(lines)
  const extras = matchExtraPdf(original, layout)
  if (extras.excludedLines.length === 0) return { parsed: parseResume(lines), extras }
  const excluded = new Set(extras.excludedLines)
  const indexes = original.flatMap((_, index) => (excluded.has(index) ? [] : [index]))
  const parsed = parseResume(indexes.map((index) => original[index]))
  const source = parsed.lines.map((line, index) => indexes[(line as Line & { sourceIndex?: number }).sourceIndex ?? index])
  const remap = (values: number[]) => values.map((index) => source[index]).filter((index): index is number => index !== undefined)
  const remapHeading = (index: number | undefined) => (index === undefined ? undefined : (source[index] ?? index))
  parsed.profileLines = remap(parsed.profileLines)
  for (const section of parsed.sections) for (const entry of section.entries) entry.lines = remap(entry.lines)
  for (const group of parsed.unplaced) {
    group.lines = remap(group.lines)
    group.headingLine = remapHeading(group.headingLine)
    if (group.sourceLines) group.sourceLines = group.sourceLines.map((index) => indexes[index])
  }
  for (const occurrence of parsed.occurrences ?? []) {
    occurrence.lines = remap(occurrence.lines)
    occurrence.headingLine = remapHeading(occurrence.headingLine)!
    occurrence.sourceLines = occurrence.sourceLines.map((index) => indexes[index])
  }
  for (const group of parsed.extraGroups ?? []) {
    group.lines = remap(group.lines)
    group.headingLine = remapHeading(group.headingLine)!
    group.sourceLines = group.sourceLines.map((index) => indexes[index])
  }
  parsed.lines = original
  return { parsed, extras }
}
