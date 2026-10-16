// Reads dates the way resumes write them: "Jan 2024", "January 2024",
// "Sept 2024", "01/2024", "2024", "Fall 2023", "Expected May 2027", "Jan '21",
// and "Present", plus ranges in one field, like a project's "Jun – Aug 2025".
// The words match what the resume reader in lib/import/parse.ts finds.

import type { FieldKey, FieldKeyOf, SectionName } from "@/components/editor/sections"
import type { Entry } from "./resume"
import { DATE_PREFIXES, PRESENT_WORDS } from "./settings"
import { escaped } from "./text"

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

// Seasons, as the month they're counted from when dates are compared.
const SEASONS: Record<string, number> = { winter: 1, spring: 3, summer: 6, fall: 9, autumn: 9 }

/** How a date's month was written, so dates written different ways can be found. */
export type MonthStyle =
  // "Jan", "January", "Sept", "Aug.": `spelling` is lower case, without the dot.
  | { kind: "name"; spelling: string; dotted: boolean }
  // "01/2024", "1/2024", "2024-01".
  | { kind: "number" }
  // "Fall 2023".
  | { kind: "season" }
  // Only a year: "2024".
  | { kind: "year" }

/** A date as a resume writes it. */
export type ResumeDate =
  // "Present", "Current", "Now"…: it hasn't ended. `word` is as written.
  | { present: true; word: string }
  | {
      present: false
      /** Missing only for a range's first month, as "Jun" in "Jun – Aug 2025", until its range gives it one. */
      year?: number
      /** 1 to 12, when there's a month (or a season). */
      month?: number
      style: MonthStyle
      /** The year was written with an apostrophe: "Jan '21". */
      shortYear: boolean
    }

const YEAR = String.raw`(?:19|20)\d{2}`
const SHORT_YEAR = String.raw`['’‘]\d{2}`

/** The month a word names, 1 to 12, and how it was spelled. */
function monthOf(word: string): { month: number; spelling: string; dotted: boolean } | null {
  const dotted = word.endsWith(".")
  const spelling = word.replace(/\.$/, "").toLowerCase()
  if (spelling === "sept") return { month: 9, spelling, dotted }
  const index = MONTHS.findIndex((name) => name === spelling || (spelling.length === 3 && name.startsWith(spelling)))
  // A full name with a dot after it ("June.") isn't how anyone writes a date.
  if (index < 0 || (dotted && spelling === MONTHS[index] && spelling.length > 3)) return null
  return { month: index + 1, spelling, dotted }
}

// A two-digit year, read as POSIX reads one: 69 to 99 are the 1900s, 00 to 68 the 2000s.
const fullYear = (short: number) => (short >= 69 ? 1900 : 2000) + short
const yearOf = (text: string) => (/^['’‘]/.test(text) ? fullYear(Number(text.slice(1))) : Number(text))

// "Expected May 2027", "Expected Graduation Date: May 2027", "May 2027 (Expected)": the date in it.
const PREFIX_WORDS = DATE_PREFIXES.map(escaped).join("|")
const PREFIX = new RegExp(String.raw`^(?:(?:${PREFIX_WORDS})(?:\s+date)?\s*:?\s*)+(?=\S)`, "i")
const SUFFIX = new RegExp(String.raw`\s*\((?:${PREFIX_WORDS})\)$`, "i")
const withoutWords = (text: string) => text.trim().replace(PREFIX, "").replace(SUFFIX, "").trim()

const PRESENT = new RegExp(String.raw`^(?:${PRESENT_WORDS.join("|")})$`, "i")
// "May 2023", "May 15, 2023" and "15 May 2023".
const MONTH_YEAR = new RegExp(
  String.raw`^(?:\d{1,2}(?:st|nd|rd|th)?\s+)?([a-z]+\.?)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?\s*,?\s*(${YEAR}|${SHORT_YEAR})$`,
  "i",
)
const NUMBERS = new RegExp(String.raw`^(\d{1,2})\s*[/.-]\s*(?:\d{1,2}\s*[/.-]\s*)?(${YEAR})$`)
// "01/24": a month and a two-digit year, which the resume reader in lib/import takes too.
const NUMBERS_SHORT_YEAR = /^(\d{1,2})\s*\/\s*(\d{2})$/
const YEAR_FIRST = new RegExp(String.raw`^(${YEAR})-(\d{1,2})$`)
const YEAR_ONLY = new RegExp(String.raw`^(${YEAR}|${SHORT_YEAR})$`)

/**
 * Reads one date: "Jan 2024", "01/2024", "2024", "Present"… Null when it
 * can't be read, as "Jnu 2024" can't. A month on its own is only read as
 * the start of a range (see readDateRange).
 */
export function readDate(text: string, { monthOnly = false } = {}): ResumeDate | null {
  const value = withoutWords(text)
  if (PRESENT.test(value)) return { present: true, word: value }
  let match = MONTH_YEAR.exec(value)
  if (match) {
    const year = yearOf(match[2])
    const shortYear = /^['’‘]/.test(match[2])
    const season = SEASONS[match[1].toLowerCase()]
    if (season) return { present: false, year, month: season, style: { kind: "season" }, shortYear }
    const month = monthOf(match[1])
    return (
      month && {
        present: false,
        year,
        month: month.month,
        style: { kind: "name", spelling: month.spelling, dotted: month.dotted },
        shortYear,
      }
    )
  }
  if ((match = NUMBERS.exec(value))) return numbered(Number(match[1]), Number(match[2]))
  if ((match = YEAR_FIRST.exec(value))) return numbered(Number(match[2]), Number(match[1]))
  if ((match = NUMBERS_SHORT_YEAR.exec(value))) return numbered(Number(match[1]), fullYear(Number(match[2])))
  if ((match = YEAR_ONLY.exec(value)))
    return { present: false, year: yearOf(match[1]), style: { kind: "year" }, shortYear: /^['’‘]/.test(match[1]) }
  if (monthOnly) {
    const season = SEASONS[value.toLowerCase()]
    if (season) return { present: false, month: season, style: { kind: "season" }, shortYear: false }
    const month = monthOf(value)
    if (month)
      return {
        present: false,
        month: month.month,
        style: { kind: "name", spelling: month.spelling, dotted: month.dotted },
        shortYear: false,
      }
  }
  return null
}

const numbered = (month: number, year: number): ResumeDate | null =>
  month >= 1 && month <= 12 ? { present: false, year, month, style: { kind: "number" }, shortYear: false } : null

// Between a range's two dates: a dash of any length, "to" or "until". A
// hyphen can also be inside a date ("01-2024"), so each one is tried.
const SEPARATOR = /\s*(?:–|—|−|-|\bto\b|\buntil\b)\s*/gi

/** A range in one field, as written, and its two dates. */
export interface DateRange {
  start: { text: string; date: ResumeDate }
  end: { text: string; date: ResumeDate }
}

/**
 * Reads a range written in one field: "Jun – Aug 2025", "2023 – 2026",
 * "Jan 2026 – Present". A first month without a year takes the end's year,
 * or the year before when its month comes later ("Nov – Feb 2025"). Null if
 * it isn't a range both of whose dates can be read.
 */
export function readDateRange(text: string): DateRange | null {
  for (const separator of text.matchAll(SEPARATOR)) {
    const startText = text.slice(0, separator.index).trim()
    const endText = text.slice(separator.index + separator[0].length).trim()
    const start = readDate(startText, { monthOnly: true })
    const end = readDate(endText)
    if (!start || start.present || !end) continue
    if (start.year === undefined) {
      if (end.present || end.year === undefined) continue
      const year = start.month !== undefined && end.month !== undefined && start.month > end.month ? end.year - 1 : end.year
      return { start: { text: startText, date: { ...start, year } }, end: { text: endText, date: end } }
    }
    return { start: { text: startText, date: start }, end: { text: endText, date: end } }
  }
  return null
}

// The month each season ends, by the month it's counted from: fall runs to December.
const SEASON_ENDS: Record<number, number> = { 1: 3, 3: 5, 6: 8, 9: 12 }

/** A date as late as it can mean, for whether it's over: “Fall 2026” is still going in October. */
export function latestOf(date: ResumeDate): ResumeDate {
  if (date.present || date.style.kind !== "season" || date.month === undefined) return date
  return { ...date, month: SEASON_ENDS[date.month] ?? date.month }
}

/**
 * Which of two dates is later: below 0 if `a` is earlier, above 0 if it's
 * later, 0 if they're the same as far as both say. Present is the latest;
 * months count only when both dates have one.
 */
export function compareDates(a: ResumeDate, b: ResumeDate): number {
  if (a.present || b.present) return a.present && b.present ? 0 : a.present ? 1 : -1
  if (a.year === undefined || b.year === undefined) return 0
  if (a.year !== b.year) return a.year - b.year
  return a.month !== undefined && b.month !== undefined ? a.month - b.month : 0
}

/** A month's name as the resume would write it, for suggestions: "Jan", "January", "Sept.". */
export function monthName(month: number, { long = false, dotted = false, sept = false } = {}): string {
  const full = MONTHS[month - 1]
  const name = long ? full : month === 9 && sept ? "sept" : full.slice(0, 3)
  const capital = name[0].toUpperCase() + name.slice(1)
  return dotted && name !== full ? `${capital}.` : capital
}

// Each section's date fields: when it started and ended, or one field that
// can hold a range, as a project's "Jun – Aug 2025".
export const DATE_FIELDS: {
  [Section in SectionName]?: { start: FieldKeyOf<Section>; end: FieldKeyOf<Section> } | { single: FieldKeyOf<Section> }
} = {
  Education: { start: "schoolStartDate", end: "schoolEndDate" },
  Work: { start: "workStartDate", end: "workEndDate" },
  Projects: { single: "projectDate" },
  Publications: { single: "publicationDate" },
  Volunteership: { start: "volunteerStartDate", end: "volunteerEndDate" },
  Leadership: { start: "leadershipStartDate", end: "leadershipEndDate" },
  Awards: { single: "awardDate" },
}

/** A date on the resume, where it is, and how it's written. */
export interface Written {
  entry: Entry
  field: FieldKey
  /** As written: the field, or one side of a range in it. */
  text: string
  date: ResumeDate
}

export interface EntryDates {
  entry: Entry
  start?: Written
  end?: Written
  /** Date fields with something in them that can't be read. */
  unreadable: { field: FieldKey; text: string }[]
  /** How many date fields have something in them. */
  filled: number
}

/** An entry's dates: its start and end, from two fields or a range in one. */
export function datesOf(entry: Entry): EntryDates {
  const fields = DATE_FIELDS[entry.section]
  const found: EntryDates = { entry, unreadable: [], filled: 0 }
  if (!fields) return found
  const written = (field: FieldKey, text: string, date: ResumeDate): Written => ({ entry, field, text, date })
  const range = (field: FieldKey, text: string) => {
    const both = readDateRange(text)
    if (!both) return false
    found.start = written(field, both.start.text, both.start.date)
    found.end = written(field, both.end.text, both.end.date)
    return true
  }
  if ("single" in fields) {
    const text = entry.values[fields.single]
    if (!text) return found
    found.filled = 1
    const date = readDate(text)
    if (date) found.end = written(fields.single, text, date)
    else if (!range(fields.single, text)) found.unreadable.push({ field: fields.single, text })
    return found
  }
  const start = entry.values[fields.start]
  const end = entry.values[fields.end]
  found.filled = Number(Boolean(start)) + Number(Boolean(end))
  if (start) {
    const date = readDate(start)
    // A whole range typed into the start field reads too, when the end is empty.
    if (date) found.start = written(fields.start, start, date)
    else if (end || !range(fields.start, start)) found.unreadable.push({ field: fields.start, text: start })
  }
  if (end) {
    const date = readDate(end)
    if (date) found.end = written(fields.end, end, date)
    else found.unreadable.push({ field: fields.end, text: end })
  }
  return found
}

/** Whether an entry ended before `today`. One that's still going ("Present"), or has no end date, hasn't. */
export function hasEnded(entry: Entry, today: Date): boolean {
  const end = datesOf(entry).end?.date
  if (end === undefined || end.present) return false
  const now: ResumeDate = {
    present: false,
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    style: { kind: "number" },
    shortYear: false,
  }
  return compareDates(latestOf(end), now) < 0
}
