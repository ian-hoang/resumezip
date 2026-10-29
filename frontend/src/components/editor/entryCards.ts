// What an entry's card says about it while it's folded (SectionForm.tsx): its
// dates in a few words, and whether a section's entries are in the order the
// checker wants, newest first.

import { isLeftOut } from "@/lib/leftOut"
import { compareDates, DATE_FIELDS, readDate, readDateRange, type ResumeDate } from "@/lib/check/readDate"
import type { Entry } from "@/lib/resume"
import type { SectionName } from "./sections"

const text = (entry: Entry, key: string) => (entry as Record<string, unknown>)[key]

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : "")

// A year at the end of a date, as "2025" or "'25", which a range's start can leave to its end.
const TRAILING_YEAR = /\s*(?:(?:19|20)\d{2}|['’‘]\d{2})$/

/**
 * An entry's dates as a card shows them: "May – Aug 2025" when both are in
 * one year, "Sep 2024 – Dec 2025" when not, or the one date there is. A
 * project's single field shows as it's written.
 */
export function datesOf(section: SectionName, entry: Entry): string {
  const fields = DATE_FIELDS[section]
  if (!fields) return ""
  if ("single" in fields) return trimmed(text(entry, fields.single))
  const start = trimmed(text(entry, fields.start))
  const end = trimmed(text(entry, fields.end))
  if (!start || !end) return start || end
  const [from, to] = [readDate(start), readDate(end)]
  const sameYear = from && to && !from.present && !to.present && from.year !== undefined && from.year === to.year
  const month = start.replace(TRAILING_YEAR, "")
  return sameYear && from.month !== undefined && month && month !== start ? `${month} – ${end}` : `${start} – ${end}`
}

/** An entry's start and end, from two fields or a range in one, for putting entries in order. */
function spanOf(section: SectionName, entry: Entry): { start?: ResumeDate; end?: ResumeDate } {
  const fields = DATE_FIELDS[section]
  if (!fields) return {}
  if ("single" in fields) {
    const written = trimmed(text(entry, fields.single))
    const date = readDate(written)
    if (date) return { end: date }
    const range = readDateRange(written)
    return range ? { start: range.start.date, end: range.end.date } : {}
  }
  return { start: readDate(trimmed(text(entry, fields.start))) ?? undefined, end: readDate(trimmed(text(entry, fields.end))) ?? undefined }
}

/**
 * Whether a section's entries are newest first, as the checker reads them
 * (rule D6 in lib/check/dates.ts): none of those printed is newer than the
 * dated one above it by every date both have. Null when fewer than two have
 * dates to compare, or the section has none.
 */
export function newestFirst(section: SectionName, entries: Entry[]): boolean | null {
  const dated = entries
    .filter((entry) => !isLeftOut(entry))
    .map((entry) => spanOf(section, entry))
    .filter((span) => span.start || span.end)
  let compared = 0
  for (let i = 1; i < dated.length; i++) {
    const [above, below] = [dated[i - 1], dated[i]]
    const sides = (["start", "end"] as const).filter((side) => above[side] && below[side])
    if (sides.length === 0) continue
    compared++
    const order = sides.map((side) => compareDates(below[side]!, above[side]!))
    if (order.some((difference) => difference > 0) && order.every((difference) => difference >= 0)) return false
  }
  return compared > 0 ? true : null
}
