// Every downloaded PDF carries a copy of its resume as an attached file, so
// resumezip can open the PDF again and restore the resume exactly. There are
// no accounts, so the PDF is the user's save file: it's how a resume moves to
// another browser or computer.

import { PROFILE_FIELDS, SECTION_NAMES, SECTIONS } from "@/components/editor/sections"
import { templateById } from "@/lib/templates"

export const ATTACHMENT_NAME = "resumezip.json"

const FORMAT = "resumezip"
const VERSION = 1

/** A resume in the editor's format, without the name and tag it has in this browser. */
export type ResumeContent = Record<string, any>

/**
 * The attachment for a resume: what's printed on it and how it's laid out.
 * Not the resume's name or tag, since anyone who gets the PDF can read it.
 */
export function toAttachment(resume: Record<string, any>): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, resume: cleanResume(resume) })
}

/** Reads an attachment back, or returns null if the text isn't one. */
export function fromAttachment(text: string): ResumeContent | null {
  try {
    const file = JSON.parse(text)
    if (file?.format !== FORMAT || typeof file.version !== "number" || file.version > VERSION) return null
    return cleanResume(file.resume)
  } catch {
    return null
  }
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const string = (value: unknown, max = 10_000) => (typeof value === "string" ? value.slice(0, max) : "")

// Older resumes stored bullets as a list; the editor uses one "• " line each.
const bulletText = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((line): line is string => typeof line === "string" && line.trim() !== "")
        .map((line) => `• ${line.trim().replace(/^•\s*/, "")}`)
        .join("\n")
        .slice(0, 10_000)
    : string(value)

/**
 * Keeps only the fields the editor knows, as strings, with entries numbered
 * 1..n. Files can come from anywhere, so nothing else is trusted.
 */
export function cleanResume(input: unknown): ResumeContent {
  const resume = object(input)
  const profile = object(resume.profileSection)
  const headings = object(resume.headings)
  const saved = (Array.isArray(resume.sectionOrder) ? resume.sectionOrder : []).filter(
    (name, index, all): name is (typeof SECTION_NAMES)[number] =>
      SECTION_NAMES.includes(name as (typeof SECTION_NAMES)[number]) && all.indexOf(name) === index,
  )

  const clean: ResumeContent = {
    selectedTemplate: templateById(resume.selectedTemplate).id,
    sectionOrder: [...saved, ...SECTION_NAMES.filter((name) => !saved.includes(name))],
    headings: Object.fromEntries(
      SECTION_NAMES.map((name) => SECTIONS[name].headingKey)
        .filter((key) => string(headings[key]).trim() !== "")
        .map((key) => [key, string(headings[key], 200)]),
    ),
    profileSection: Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, string(profile[field.key], 500)])),
  }

  for (const name of SECTION_NAMES) {
    const { dataKey, fields } = SECTIONS[name]
    const entries = Array.isArray(resume[dataKey]) ? (resume[dataKey] as unknown[]).slice(0, 100) : []
    clean[dataKey] = entries.map((entry, index) => ({
      id: index + 1,
      ...Object.fromEntries(
        fields.map((field) => [
          field.key,
          field.type === "bullets" ? bulletText(object(entry)[field.key]) : string(object(entry)[field.key]),
        ]),
      ),
    }))
  }

  if (typeof resume.id === "string" && resume.id.length > 0 && resume.id.length <= 100) clean.id = resume.id
  if (typeof resume.updatedAt === "string" && !Number.isNaN(Date.parse(resume.updatedAt))) {
    clean.updatedAt = resume.updatedAt
  }
  return clean
}
