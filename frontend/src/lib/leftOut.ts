// What's left out of a resume: entries and bullets kept in the editor but not
// printed, so one resume can be tailored to a job without deleting anything.
// A left-out entry has `leftOut: true`; a left-out bullet starts with "○"
// where a printed one has "•". Older resumes have neither, so they print as
// they always have.

import { SECTIONS } from "@/components/editor/sections"
import type { Resume } from "@/lib/resume"
import { extraKey, extrasOf, sectionIncluded, type ExtraSection } from "./resumeSections"

/** What a left-out bullet starts with, instead of "•". */
export const LEFT_OUT_BULLET = "○"

/** Whether a line of a bullet field is left out. */
export const isLeftOutLine = (line: unknown) => typeof line === "string" && line.trimStart().startsWith(LEFT_OUT_BULLET)

/** Whether an entry is left out. */
export const isLeftOut = (entry: unknown) =>
  typeof entry === "object" && entry !== null && (entry as { leftOut?: unknown }).leftOut === true

// A bullet field's lines. Older resumes kept bullets as a list.
const linesOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [])

// A bullet field without its left-out lines.
const printedBullets = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((line) => !isLeftOutLine(line))
    : typeof value === "string"
      ? value
          .split("\n")
          .filter((line) => !isLeftOutLine(line))
          .join("\n")
      : value

/** Whether anything in the resume is left out: an entry, or a bullet. */
export function hasLeftOut(resume: Resume): boolean {
  const extraLeftOut = Object.values(extrasOf(resume)).some(
    (section) => !sectionIncluded(section) || (section.kind === "list" && section.bullets.split("\n").some(isLeftOutLine)),
  )
  return (
    extraLeftOut ||
    Object.values(SECTIONS).some(({ dataKey, fields }) => {
      const entries = resume[dataKey]
      return (
        Array.isArray(entries) &&
        entries.some(
          (entry: unknown) =>
            isLeftOut(entry) ||
            (typeof entry === "object" &&
              entry !== null &&
              fields.some(
                (field) => field.type === "bullets" && linesOf((entry as Record<string, unknown>)[field.key]).some(isLeftOutLine),
              )),
        )
      )
    })
  )
}

/**
 * The resume as it's printed: without left-out entries and bullets. It's
 * what the PDF shows, and all the copy of the resume inside the PDF holds,
 * since anyone who gets the PDF can read that copy.
 */
export function printedResume(resume: Resume): Resume {
  // Saved entries are only checked for shape, so they're read as unknown here.
  const printed: Record<string, unknown> = { ...resume }
  for (const { dataKey, fields } of Object.values(SECTIONS)) {
    const entries: unknown = resume[dataKey]
    if (!Array.isArray(entries)) continue
    printed[dataKey] = entries
      .filter((entry: unknown) => !isLeftOut(entry))
      .map((entry: unknown) => {
        if (typeof entry !== "object" || entry === null) return entry
        const { leftOut, ...kept } = entry as Record<string, unknown>
        for (const field of fields) {
          if (field.type === "bullets" && field.key in kept) kept[field.key] = printedBullets(kept[field.key])
        }
        return kept
      })
  }
  if (resume.extraSections !== undefined) {
    const extras = Object.fromEntries(
      Object.entries(extrasOf(resume))
        .filter(([, section]) => sectionIncluded(section))
        .map(([key, section]) => {
          const { leftOut, ...kept } = section
          if (kept.kind === "list") kept.bullets = printedBullets(kept.bullets) as string
          return [key, kept as ExtraSection]
        }),
    )
    printed.extraSections = extras
    if (Array.isArray(printed.sectionOrder))
      printed.sectionOrder = printed.sectionOrder.filter(
        (ref: unknown) => typeof ref !== "string" || extraKey(ref) === null || Object.hasOwn(extras, extraKey(ref)!),
      )
  }
  return printed as Resume
}
