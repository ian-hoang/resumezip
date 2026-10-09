// What a resume is, as the editor saves it in this browser. The list sections
// and their fields are defined in components/editor/sections.ts, and these
// types are derived from them, so a field name that isn't one won't compile.
//
// They describe what the app writes. Saved data is only checked for shape
// when it's read (readField in lib/resumeStorage.ts): sections are lists of
// entries, and the profile, headings and checker state are objects, but any
// of them can be missing or null in resumes saved by older versions. Code that
// prints or checks a resume (lib/typst/resumeData.ts, lib/check/resume.ts)
// still reads every value defensively.

import type { ChoiceKey, DataKey, FieldKey, HeadingKey, ProfileKey } from "@/components/editor/sections"
import type { CHECK_FIELD, SavedCheck } from "@/lib/check/state"
import type { ExtraSections } from "@/lib/resumeSections"

/** One entry in a list section, like a job. Only its own section's fields are set. */
export type Entry = { id: number; leftOut?: true } & { [Key in FieldKey]?: string }

export type Profile = { [Key in ProfileKey]?: string }

/** The sections the person renamed, by heading key ("edu"), as they named them. */
export type Headings = { [Key in HeadingKey]?: string }

export type Resume = {
  /** Its key in storage too (see lib/resumeStorage.ts). */
  id?: string
  /** Its name in the dashboard's list; not printed. */
  resumeTitle?: string
  /** "professional", "personal" or "academic" (RESUME_TAGS). */
  resumeTag?: string
  /** When it last changed, as an ISO date. */
  updatedAt?: string
  selectedTemplate?: string
  /** Section names in print order. Older resumes can lack some, or list unknown ones. */
  sectionOrder?: string[] | null
  /**
   * Set once sectionOrder holds only the optional sections the person added
   * from the list (see resolveSections). Resumes and PDFs from before then
   * listed every section, so their empty optional ones aren't shown, and the
   * first change to one keeps only what it shows, and sets this.
   */
  sectionsChosen?: true | null
  headings?: Headings | null
  profileSection?: Profile | null
  /** Sections beyond the built-in ones, by key, read with extrasOf (lib/resumeSections.ts). */
  extraSections?: ExtraSections
} & { [Key in DataKey]?: Entry[] | null } & { [Key in ChoiceKey]?: string } & {
  /** What the person told the checker, read with readCheckState (lib/check/state.ts). */
  [Key in typeof CHECK_FIELD]?: SavedCheck | null
}

/** A resume in this browser's list, with the id it's saved under (its key in the store). */
export type ResumeWithId = Resume & { id: string }

/** A resume without the name and tag it has in this browser, as a file holds it (lib/resumeFile.ts). */
export type ResumeContent = Omit<Resume, "resumeTitle" | "resumeTag">

/** Content with the profile, headings, section order and every section there, as a file read in is. */
export type CompleteContent = ResumeContent & { profileSection: Profile; headings: Headings; sectionOrder: string[] } & {
  [Key in DataKey]: Entry[]
}

/** A resume's top-level field, as the editor changes it. */
export type ResumeField = keyof Resume
