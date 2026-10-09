// Where a finding is, so the editor can open it: a profile field, a section's
// title, a whole section, an entry (one of its fields, or one bullet), or the
// PDF's pages. Also how a finding is told apart from others, for dismissing it.

import { PROFILE_FIELDS, SECTIONS, type FieldKey, type FieldKeyOf, type ProfileKey, type SectionName } from "@/components/editor/sections"
import { entryAt, type ResumeView } from "./resume"

export type Place =
  // A profile field, like "email".
  | { kind: "profile"; field: ProfileKey }
  // A section's title, which the person can rename.
  | { kind: "heading"; section: SectionName }
  // A whole section, as when it's missing or empty.
  | { kind: "section"; section: SectionName }
  // An entry (its place in the list, from 0), one of its fields, or one line of
  // a bullet field (a bullet's `line`).
  | { kind: "entry"; section: SectionName; entry: number; field?: FieldKey; line?: number }
  | { kind: "extra-heading"; sectionId: string }
  | { kind: "extra-text"; sectionId: string; field: "text" | "bullets"; line?: number }
  // The PDF as a whole, or one of its pages (from 1).
  | { kind: "page"; page?: number }

/** The field a place is in: a profile field, or one of an entry's. */
export const fieldOf = (place: Place) =>
  place.kind === "profile" || place.kind === "entry" || place.kind === "extra-text" ? place.field : undefined

/** Fields that hold a link or an email address rather than words. */
export const LINK_FIELDS: ReadonlySet<ReturnType<typeof fieldOf>> = new Set<ReturnType<typeof fieldOf>>([
  "email",
  "linkedin",
  "profileGithub",
  "personalWebsite",
  "projectGithub",
  "additionalLink",
  "publicationLink",
])

/** Where an entry was, in the sections that have one: jobs, schools and roles. */
export const LOCATION_FIELDS: { [Section in SectionName]?: FieldKeyOf<Section> } = {
  Education: "schoolLocation",
  Work: "workLocation",
  Volunteership: "volunteerLocation",
  Leadership: "leadershipLocation",
}

/** Whether a place is on this resume, so the editor can open it. `pages` is how many the PDF has. */
export function placeExists(view: ResumeView, place: Place, pages = 0): boolean {
  switch (place.kind) {
    case "extra-heading":
      return !!view.extras[place.sectionId] && !view.extras[place.sectionId].blank
    case "extra-text": {
      const extra = view.extras[place.sectionId]
      if (!extra) return false
      if (place.field === "bullets")
        return extra.section.kind === "list" && (place.line === undefined || extra.bullets.some((bullet) => bullet.line === place.line))
      return extra.section.kind === "text" && place.line === undefined
    }
    case "profile":
      return PROFILE_FIELDS.some((field) => field.key === place.field)
    case "heading":
    case "section":
      return Object.hasOwn(SECTIONS, place.section)
    case "entry": {
      if (!Object.hasOwn(SECTIONS, place.section)) return false
      const entry = entryAt(view, place.section, place.entry)
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
    case "extra-heading":
      return view.extras[place.sectionId]?.heading ?? ""
    case "extra-text": {
      const extra = view.extras[place.sectionId]
      if (!extra) return ""
      if (place.field === "bullets")
        return place.line === undefined
          ? extra.bullets.map((bullet) => bullet.raw).join("\n")
          : (extra.bullets.find((bullet) => bullet.line === place.line)?.raw ?? "")
      return extra.section.kind === "text" ? extra.section.text.trim() : ""
    }
    case "profile":
      return view.profile[place.field] ?? ""
    case "heading":
      return view.headings[place.section] ?? ""
    case "section":
    case "page":
      return ""
    case "entry": {
      const entry = entryAt(view, place.section, place.entry)
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
// others are added above them, and their text tells them apart anyway. A
// page's number stays in, as pages can have the same text, or none.
function pathOf(place: Place): string {
  switch (place.kind) {
    case "extra-heading":
      return `extra.${place.sectionId}.heading`
    case "extra-text":
      return `extra.${place.sectionId}.${place.field}`
    case "profile":
      return `profile.${place.field}`
    case "heading":
    case "section":
      return `${place.kind}.${place.section}`
    case "entry":
      return place.field === undefined ? `${place.section}.${place.entry}` : `${place.section}.${place.entry}.${place.field}`
    case "page":
      return place.page === undefined ? "page" : `page.${place.page}`
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

/** Identifies a place exactly, bullet line included: equal ids mean the same place. */
export const placeId = (place: Place) =>
  place.kind === "entry" && place.line !== undefined ? `${pathOf(place)}.${place.line}` : pathOf(place)

/** What tells a finding apart: its rule, the field it's in, and the text it flagged. */
export const findingKey = (rule: string, place: Place, text: string) => `${rule}|${pathOf(place)}|${fingerprint(text)}`

/** The rule a finding's key belongs to, or "" if it isn't one. */
export const ruleOfKey = (key: string) => (key.includes("|") ? key.slice(0, key.indexOf("|")) : "")
