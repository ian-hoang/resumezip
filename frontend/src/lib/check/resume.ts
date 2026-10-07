// The resume as checks read it: each field as trimmed text, each bullet on
// its own without the editor's "• " or its bold and italic marks, and the
// resume's type. It's built once per run, so rules don't each pick the saved
// data apart, and none of them has to guard against older or broken shapes.

import { PROFILE_FIELDS, SECTION_NAMES, SECTIONS, type SectionName } from "@/components/editor/sections"
import { plainText, sectionOrder } from "@/lib/typst/resumeData"
import type { Place } from "./places"

/** Chosen when the resume was made (RESUME_TAGS in components/dashboard/CreateResumeModal.tsx). */
export type ResumeType = "professional" | "personal" | "academic"

/** A resume's type. Resumes without one, or with one this version doesn't know, count as Professional. */
export function resumeTypeOf(resume: Record<string, any>): ResumeType {
  const tag = resume?.resumeTag
  return tag === "academic" || tag === "personal" ? tag : "professional"
}

export interface Bullet {
  /** The field it's in, like "workDescription". */
  field: string
  /** Its line in that field, counting from 0 and blank lines included, which is where the editor finds it. */
  line: number
  /** As typed, without the "• " in front. */
  raw: string
  /** Its words as printed, without bold and italic marks. */
  text: string
}

export interface Entry {
  section: SectionName
  /** Its place in the section's list, from 0. */
  index: number
  /** Each of the section's fields, trimmed; "" when it's empty or missing. Bullet fields are as typed. */
  values: Record<string, string>
  /** The bullets in its bullet field, in order. */
  bullets: Bullet[]
  /** Nothing typed in it at all, as when it was added but never filled in. */
  blank: boolean
}

export interface ResumeView {
  type: ResumeType
  /** Each profile field, trimmed; "" when it's empty or missing. */
  profile: Record<string, string>
  /** Each section's entries, in the order they're saved and printed. */
  sections: Record<SectionName, Entry[]>
  /** Each section's own title if the person renamed it, or "" for the template's. */
  headings: Record<SectionName, string>
  /** The sections in the order they're printed. */
  order: SectionName[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

// Older resumes saved bullets as a list; the editor types them one "• " line each.
const linesOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((line) => (typeof line === "string" ? line : ""))
    : typeof value === "string"
      ? value.split("\n")
      : []

const bulletsOf = (field: string, value: unknown): Bullet[] =>
  linesOf(value).flatMap((line, index) => {
    const raw = line.trim().replace(/^•\s*/, "")
    return raw ? [{ field, line: index, raw, text: plainText(raw).trim() }] : []
  })

/** Reads a resume, as the editor saves it, for the checks. */
export function viewOf(resume: Record<string, any>): ResumeView {
  const profile = isObject(resume.profileSection) ? resume.profileSection : {}
  const headings = isObject(resume.headings) ? resume.headings : {}
  const sections = {} as Record<SectionName, Entry[]>
  const titles = {} as Record<SectionName, string>
  for (const name of SECTION_NAMES) {
    const { dataKey, headingKey, fields } = SECTIONS[name]
    const saved: unknown[] = Array.isArray(resume[dataKey]) ? resume[dataKey] : []
    sections[name] = saved.map((item, index) => {
      const entry = isObject(item) ? item : {}
      const values = Object.fromEntries(
        fields.map((field) => [
          field.key,
          field.type === "bullets" ? linesOf(entry[field.key]).join("\n").trim() : text(entry[field.key]),
        ]),
      )
      const bullets = fields
        .filter((field) => field.type === "bullets")
        .flatMap((field) => bulletsOf(field.key, entry[field.key]))
      return { section: name, index, values, bullets, blank: Object.values(values).every((value) => value === "") }
    })
    titles[name] = text(headings[headingKey])
  }
  return {
    type: resumeTypeOf(resume),
    profile: Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, text(profile[field.key])])),
    sections,
    headings: titles,
    order: sectionOrder(resume.sectionOrder) as SectionName[],
  }
}

/**
 * Every piece of typed text and where it is, in the order it's printed:
 * profile values, renamed section titles, entry fields, and each bullet on its
 * own. Empty ones are left out. For rules that read all of it, like spelling.
 */
export function textsOf(view: ResumeView): { place: Place; text: string }[] {
  const texts: { place: Place; text: string }[] = []
  for (const field of PROFILE_FIELDS) {
    const value = view.profile[field.key]
    if (value) texts.push({ place: { kind: "profile", field: field.key }, text: value })
  }
  for (const section of view.order) {
    if (view.headings[section]) texts.push({ place: { kind: "heading", section }, text: view.headings[section] })
    for (const entry of view.sections[section]) {
      for (const field of SECTIONS[section].fields) {
        const place = { kind: "entry", section, entry: entry.index, field: field.key } as const
        if (field.type !== "bullets") {
          if (entry.values[field.key]) texts.push({ place, text: entry.values[field.key] })
          continue
        }
        for (const bullet of entry.bullets) {
          if (bullet.field === field.key && bullet.text) texts.push({ place: { ...place, line: bullet.line }, text: bullet.text })
        }
      }
    }
  }
  return texts
}
