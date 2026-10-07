// Where a finding is, so the editor can open it: a profile field, a section's
// title, a whole section, an entry (one of its fields, or one bullet), or the
// PDF's pages. Also how a finding is told apart from others, for dismissing it.

import { PROFILE_FIELDS, SECTIONS, type SectionName } from "@/components/editor/sections"
import type { ResumeView } from "./resume"

export type Place =
  // A profile field, like "email".
  | { kind: "profile"; field: string }
  // A section's title, which the person can rename.
  | { kind: "heading"; section: SectionName }
  // A whole section, as when it's missing or empty.
  | { kind: "section"; section: SectionName }
  // An entry (its place in the list, from 0), one of its fields, or one line of
  // a bullet field (a bullet's `line`).
  | { kind: "entry"; section: SectionName; entry: number; field?: string; line?: number }
  // The PDF as a whole, or one of its pages (from 1).
  | { kind: "page"; page?: number }

/** Whether a place is on this resume, so the editor can open it. `pages` is how many the PDF has. */
export function placeExists(view: ResumeView, place: Place, pages = 0): boolean {
  switch (place.kind) {
    case "profile":
      return PROFILE_FIELDS.some((field) => field.key === place.field)
    case "heading":
    case "section":
      return Object.hasOwn(SECTIONS, place.section)
    case "entry": {
      if (!Object.hasOwn(SECTIONS, place.section)) return false
      const entry = view.sections[place.section][place.entry]
      if (!entry) return false
      if (place.field === undefined) return place.line === undefined
      const field = SECTIONS[place.section].fields.find((field) => field.key === place.field)
      if (!field) return false
      if (place.line === undefined) return true
      return entry.bullets.some((bullet) => bullet.field === place.field && bullet.line === place.line)
    }
    case "page":
      return place.page === undefined || (Number.isInteger(place.page) && place.page >= 1 && place.page <= pages)
  }
}

/**
 * The text at a place, as typed: a field's value, a bullet, a renamed title,
 * or for an entry as a whole, what the editor shows when it's collapsed
 * ("Software Engineer, Google"). "" for sections and pages.
 */
export function textAt(view: ResumeView, place: Place): string {
  switch (place.kind) {
    case "profile":
      return view.profile[place.field] ?? ""
    case "heading":
      return view.headings[place.section] ?? ""
    case "section":
    case "page":
      return ""
    case "entry": {
      const entry = view.sections[place.section]?.[place.entry]
      if (!entry) return ""
      if (place.line !== undefined) {
        return entry.bullets.find((bullet) => bullet.field === place.field && bullet.line === place.line)?.raw ?? ""
      }
      if (place.field !== undefined) return entry.values[place.field] ?? ""
      return SECTIONS[place.section].summary
        .map((key) => entry.values[key])
        .filter(Boolean)
        .join(", ")
    }
  }
}

// Which field a place is in. A bullet's line is left out: bullets move as
// others are added above them, and their text tells them apart anyway.
function pathOf(place: Place): string {
  switch (place.kind) {
    case "profile":
      return `profile.${place.field}`
    case "heading":
    case "section":
      return `${place.kind}.${place.section}`
    case "entry":
      return place.field === undefined ? `${place.section}.${place.entry}` : `${place.section}.${place.entry}.${place.field}`
    case "page":
      return "page"
  }
}

// A short stand-in for text, the same each time (32-bit FNV-1a), so a
// dismissal stays small and ends when the text changes.
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (const char of text.replace(/\s+/g, " ").trim()) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** What tells a finding apart: its rule, the field it's in, and the text it flagged. */
export const findingKey = (rule: string, place: Place, text: string) => `${rule}|${pathOf(place)}|${fingerprint(text)}`

/** The rule a finding's key belongs to, or "" if it isn't one. */
export const ruleOfKey = (key: string) => (key.includes("|") ? key.slice(0, key.indexOf("|")) : "")
