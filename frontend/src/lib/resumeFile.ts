// Every downloaded PDF carries a copy of its resume as an attached file, so
// resumezip can open the PDF again and restore the resume exactly. There are
// no accounts, so the PDF is the user's save file: it's how a resume moves to
// another browser or computer.

import { PROFILE_FIELDS, SECTION_NAMES, SECTIONS } from "@/components/editor/sections"
import { printedResume } from "@/lib/leftOut"
import type { Entry, Headings, Profile, Resume, ResumeContent } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import { extraKey, readExtraSections, resolveSections } from "./resumeSections"

export const ATTACHMENT_NAME = "resumezip.json"

const FORMAT = "resumezip"
const VERSION = 2

/** How every attachment starts, since toAttachment writes the format first. */
const START = `{"format":"${FORMAT}"`
const recognized = (text: string) => text.trimStart().startsWith(START) || /"format"\s*:\s*"resumezip"/.test(text.slice(0, 4096))

/**
 * The most an attachment can hold and still be opened: characters of text,
 * and entries in all sections together. Far more than any resume needs (a
 * browser only lets a site save about half as many characters), but a file
 * from anyone can't tie up the page. A bigger one isn't opened at all,
 * rather than opened with parts cut off.
 */
export const MAX_LENGTH = 10_000_000
export const MAX_ENTRIES = 10_000

/** An attachment with more than MAX_LENGTH characters or MAX_ENTRIES entries. */
export class TooLongError extends Error {}
/** A recognized save file must never silently fall back to guessed PDF text. */
export class AttachmentError extends Error {}

/**
 * The attachment for a resume: what's printed on it and how it's laid out.
 * Not the resume's name or tag, or what the person left out of it, since
 * anyone who gets the PDF can read it. Opening the PDF again brings back
 * what was printed; what was left out stays only in this browser.
 */
export function toAttachment(resume: Resume): string {
  const clean = cleanResume(printedResume(resume))
  const version = Object.keys(clean.extraSections ?? {}).length ? VERSION : 1
  if (version === 1) delete clean.extraSections
  const text = JSON.stringify({ format: FORMAT, version, resume: clean })
  if (text.length > MAX_LENGTH || entryCount(clean) > MAX_ENTRIES) throw new TooLongError()
  return text
}

/**
 * Reads an attachment back, or returns null if the text isn't one. Throws a
 * TooLongError if it's one too big to open (see MAX_LENGTH).
 */
export function fromAttachment(text: string): ResumeContent | null {
  // Told apart by how it starts, so that a long file isn't read in full.
  if (text.length > MAX_LENGTH) {
    if (recognized(text)) throw new TooLongError()
    return null
  }
  let file
  try {
    file = JSON.parse(text)
  } catch {
    if (recognized(text)) throw new AttachmentError("The resume data in this PDF is damaged. Try another saved PDF.")
    return null
  }
  if (file?.format !== FORMAT) return null
  if (file.version !== 1 && file.version !== VERSION)
    throw new AttachmentError("This PDF needs a newer resumezip. Refresh the app and try again, or open it with a newer version.")
  if (!file.resume || typeof file.resume !== "object" || Array.isArray(file.resume))
    throw new AttachmentError("The resume data in this PDF is damaged. Try another saved PDF.")
  if (entryCount(file.resume) > MAX_ENTRIES) throw new TooLongError()
  if (file.version === 1) {
    const { extraSections, ...legacy } = file.resume
    return cleanResume(legacy)
  }
  const decoded = readExtraSections(file.resume.extraSections)
  if (!decoded.complete) throw new AttachmentError("The sections in this PDF are damaged. Try another saved PDF.")
  if (
    file.resume.sectionOrder !== undefined &&
    (!Array.isArray(file.resume.sectionOrder) ||
      file.resume.sectionOrder.some(
        (ref: unknown) =>
          typeof ref !== "string" ||
          (extraKey(ref) === null
            ? !SECTION_NAMES.includes(ref as (typeof SECTION_NAMES)[number])
            : !Object.hasOwn(decoded.sections, extraKey(ref)!)),
      ))
  )
    throw new AttachmentError("The section order in this PDF is damaged. Try another saved PDF.")
  return cleanResume({ ...file.resume, extraSections: decoded.sections })
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const string = (value: unknown) => (typeof value === "string" ? value : "")

/** How many entries a resume's sections have together. */
const entryCount = (resume: unknown) => {
  const extras = object(object(resume).extraSections)
  return (
    SECTION_NAMES.reduce((count, name) => {
      const entries = object(resume)[SECTIONS[name].dataKey]
      return count + (Array.isArray(entries) ? entries.length : 0)
    }, 0) + Object.keys(extras).length
  )
}

// Older resumes stored bullets as a list; the editor uses one "• " line each.
const bulletText = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((line): line is string => typeof line === "string" && line.trim() !== "")
        .map((line) => `• ${line.trim().replace(/^•\s*/, "")}`)
        .join("\n")
    : string(value)

/**
 * Keeps only the fields the editor knows, as strings, with entries numbered
 * 1..n. Files can come from anywhere, so nothing else is trusted. Nothing is
 * cut short: what the editor can hold, an attachment can too.
 */
export function cleanResume(input: unknown): ResumeContent {
  const resume = object(input)
  const profile = object(resume.profileSection)
  const headings = object(resume.headings)

  const clean: ResumeContent = {
    selectedTemplate: templateById(resume.selectedTemplate).id,
    headings: Object.fromEntries(
      SECTION_NAMES.map((name) => SECTIONS[name].headingKey)
        .filter((key) => string(headings[key]).trim() !== "")
        .map((key) => [key, string(headings[key])]),
    ) as Headings,
    profileSection: Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, string(profile[field.key])])) as Profile,
  }

  for (const name of SECTION_NAMES) {
    const { dataKey, fields, choice } = SECTIONS[name]
    const chosen = choice && resume[choice.key]
    if (choice && choice.options.some((option) => option.value === chosen)) clean[choice.key] = chosen as string
    const entries = Array.isArray(resume[dataKey]) ? (resume[dataKey] as unknown[]) : []
    clean[dataKey] = entries.map((entry, index): Entry => ({
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
  if (resume.extraSections !== undefined) {
    const decoded = readExtraSections(resume.extraSections)
    if (!decoded.complete) throw new AttachmentError("The sections in this PDF are damaged. Try another saved PDF.")
    // The decoder is an allowlist; omit flags even when cleanResume is called directly.
    clean.extraSections = Object.fromEntries(Object.entries(decoded.sections).map(([key, { leftOut, ...section }]) => [key, section]))
  }
  // The saved order's known sections, then the core ones it lacks and any optional one with entries.
  clean.sectionOrder = resolveSections({ ...clean, sectionOrder: resume.sectionOrder })
  return clean
}
