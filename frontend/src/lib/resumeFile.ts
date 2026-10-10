// Every downloaded PDF carries a copy of its resume as an attached file, so
// resumezip can open the PDF again and restore the resume exactly. There are
// no accounts, so the PDF is the user's save file: it's how a resume moves to
// another browser or computer.
//
// A JSON file is the same format, for the person's own use: a backup of one
// resume, or of every resume in the browser ("Download all"). Nobody else
// reads it, so it holds what the PDF leaves out too.

import { PROFILE_FIELDS, SECTION_NAMES, SECTIONS } from "@/components/editor/sections"
import { CHECK_FIELD, readCheckState } from "@/lib/check/state"
import { isLeftOut, printedResume } from "@/lib/leftOut"
import { RESUME_TAGS, type Entry, type Headings, type Profile, type Resume, type ResumeContent } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import { extraKey, readExtraSections, resolveSections } from "./resumeSections"

export const ATTACHMENT_NAME = "resumezip.json"
/** Where a Word file keeps its text, and its document's relationships, which have the addresses its links go to. */
export const WORD_DOCUMENT = "word/document.xml"
export const WORD_RELATIONSHIPS = "word/_rels/document.xml.rels"

/** The CRC-32s a Word file's attachment has of its WORD_DOCUMENT and WORD_RELATIONSHIPS (see lib/word.ts). */
export interface WordCrcs {
  documentCrc32?: number
  relationshipsCrc32?: number
}

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
 * rather than opened with parts cut off. A JSON file has the same limits,
 * the entries counted for each resume in it.
 */
export const MAX_LENGTH = 10_000_000
export const MAX_ENTRIES = 10_000
/** The most resumes a JSON file can hold and still be opened: more than a browser has room to save. */
export const MAX_RESUMES = 1_000

/** An attachment with more than MAX_LENGTH characters or MAX_ENTRIES entries, or a JSON file with more than MAX_RESUMES resumes. */
export class TooLongError extends Error {}
/** A recognized save file must never silently fall back to guessed PDF text. */
export class AttachmentError extends Error {}

/** What a file is called in the messages about it. */
type FileNoun = "PDF" | "Word file" | "file"

const damaged = (noun: FileNoun) => new AttachmentError(`The resume data in this ${noun} is damaged. Try another saved ${noun}.`)

/**
 * The attachment for a resume: what's printed on it and how it's laid out.
 * Not the resume's name or tag, or what the person left out of it, since
 * anyone who gets the PDF can read it. Opening the PDF again brings back
 * what was printed; what was left out stays only in this browser. A Word
 * file's also has the CRC-32s of its text and of where its links go.
 */
export function toAttachment(resume: Resume, crcs: WordCrcs = {}): string {
  const clean = cleanResume(printedResume(resume))
  const version = Object.keys(clean.extraSections ?? {}).length ? VERSION : 1
  if (version === 1) delete clean.extraSections
  const text = JSON.stringify({ format: FORMAT, version, resume: clean, ...crcs })
  if (text.length > MAX_LENGTH || entryCount(clean) > MAX_ENTRIES) throw new TooLongError()
  return text
}

/**
 * Reads an attachment back, or returns null if the text isn't one. Throws a
 * TooLongError if it's one too big to open (see MAX_LENGTH). `noun` is what
 * it was attached to, for the messages. A Word file's is read with the CRC-32s
 * its text and relationships have now, and is null if either has changed:
 * another app changed the text or where a link goes, and the attachment
 * would undo that.
 */
export function fromAttachment(text: string, noun: "PDF" | "Word file" = "PDF", crcs: WordCrcs = {}): ResumeContent | null {
  const file = readFormat(text, noun)
  if (!file || file.documentCrc32 !== crcs.documentCrc32 || file.relationshipsCrc32 !== crcs.relationshipsCrc32) return null
  return readContent(file.version, file.resume, noun)
}

/** A resume from a JSON file, with its name and tag in the list when the file has them. */
export interface FileResume {
  resume: ResumeContent
  title?: string
  tag?: string
}

/**
 * The JSON file of a resume: all of it, as the editor has it, with its name
 * and tag, what's left out of the PDF, and what the person told the checker.
 */
export function toJson(resume: Resume): string {
  return readable({ format: FORMAT, version: VERSION, resume: everything(resume) })
}

/** The JSON file of every resume ("Download all"), in the order given. */
export function toJsonOfAll(resumes: Resume[]): string {
  return readable({ format: FORMAT, version: VERSION, resumes: resumes.map(everything) })
}

/**
 * Reads a JSON file: the resume in it, or each one in a file of them all.
 * Null if it isn't a resumezip file. Throws an AttachmentError if it is one
 * but can't be read, and a TooLongError if it holds more than can be opened.
 */
export function fromJson(text: string): FileResume[] | null {
  const file = readFormat(text, "file")
  if (!file) return null
  const all: unknown = Object.hasOwn(file, "resumes") ? file.resumes : [file.resume]
  if (!Array.isArray(all)) throw damaged("file")
  if (all.length > MAX_RESUMES) throw new TooLongError()
  return all.map((saved) => {
    const { resumeTitle, resumeTag, [CHECK_FIELD]: check } = object(saved)
    return {
      resume: {
        ...readContent(file.version, saved, "file"),
        ...(check !== undefined && { [CHECK_FIELD]: readCheckState({ [CHECK_FIELD]: object(check) }) }),
      },
      ...(typeof resumeTitle === "string" && resumeTitle.trim() !== "" && { title: resumeTitle }),
      ...(RESUME_TAGS.some((tag) => tag.id === resumeTag) && { tag: resumeTag as string }),
    }
  })
}

// Indented, a field to a line, so people can read it, unless that's too long to open again.
const readable = (file: object) => {
  const text = JSON.stringify(file, null, 2)
  return text.length <= MAX_LENGTH ? text : JSON.stringify(file)
}

// A resume as a JSON file holds it. Its id, name and tag come first, for
// whoever reads the file. Version 2 needs extraSections, even when there are none.
function everything(resume: Resume): Record<string, unknown> {
  const clean = cleanResume(resume)
  return {
    id: clean.id,
    ...(typeof resume.resumeTitle === "string" && { resumeTitle: resume.resumeTitle }),
    ...(typeof resume.resumeTag === "string" && { resumeTag: resume.resumeTag }),
    updatedAt: clean.updatedAt,
    ...clean,
    extraSections: clean.extraSections ?? {},
    ...(resume[CHECK_FIELD] != null && { [CHECK_FIELD]: readCheckState(resume) }),
  }
}

/** The format and version of a resumezip file, or null if the text isn't one. Told apart by how it starts, so a long file isn't read in full. */
function readFormat(
  text: string,
  noun: FileNoun,
): { version: 1 | 2; resume?: unknown; resumes?: unknown; documentCrc32?: unknown; relationshipsCrc32?: unknown } | null {
  if (text.length > MAX_LENGTH) {
    if (recognized(text)) throw new TooLongError()
    return null
  }
  let file
  try {
    file = JSON.parse(text)
  } catch {
    if (recognized(text)) throw damaged(noun)
    return null
  }
  if (file?.format !== FORMAT) return null
  if (file.version !== 1 && file.version !== VERSION)
    throw new AttachmentError(`This ${noun} needs a newer resumezip. Refresh the app and try again, or open it with a newer version.`)
  return file
}

/** A resume in a file of the given version, checked and cleaned. */
function readContent(version: 1 | 2, saved: unknown, noun: FileNoun): ResumeContent {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw damaged(noun)
  if (entryCount(saved) > MAX_ENTRIES) throw new TooLongError()
  const resume = saved as Record<string, unknown>
  if (version === 1) {
    const { extraSections, ...legacy } = resume
    return cleanResume(legacy)
  }
  const decoded = readExtraSections(resume.extraSections)
  if (!decoded.complete) throw new AttachmentError(`The sections in this ${noun} are damaged. Try another saved ${noun}.`)
  if (
    resume.sectionOrder !== undefined &&
    (!Array.isArray(resume.sectionOrder) ||
      resume.sectionOrder.some(
        (ref: unknown) =>
          typeof ref !== "string" ||
          (extraKey(ref) === null
            ? !SECTION_NAMES.includes(ref as (typeof SECTION_NAMES)[number])
            : !Object.hasOwn(decoded.sections, extraKey(ref)!)),
      ))
  )
    throw new AttachmentError(`The section order in this ${noun} is damaged. Try another saved ${noun}.`)
  return cleanResume({ ...resume, extraSections: decoded.sections })
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
 * cut short: what the editor can hold, an attachment can too. What's left out
 * of the PDF is kept, marked as it is in the editor: an attachment never has
 * any (toAttachment prints the resume first), but a JSON file does.
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
      ...(isLeftOut(entry) && { leftOut: true }),
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
    clean.extraSections = decoded.sections
  }
  // The saved order's known sections, then the core ones it lacks and any optional one with entries.
  // That's then only the sections it shows, so it's marked as chosen (see Resume.sectionsChosen).
  clean.sectionOrder = resolveSections({ ...clean, sectionOrder: resume.sectionOrder, sectionsChosen: resume.sectionsChosen })
  clean.sectionsChosen = true
  return clean
}
