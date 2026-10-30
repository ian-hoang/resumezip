// A project's dates were one field, typed as a range ("Jun – Aug 2025"),
// until it had a start and an end as the other sections do. Resumes and
// files saved before then are read with it split in two.

import { isObject } from "@/lib/isObject"

// The dash or word between a range's two dates: "Jun – Aug 2025", "2024—2025", "Jan 2024 - Present", "May to Aug 2023".
const BETWEEN = /\s*[–—]\s*|\s+-\s+|\s+to\s+/i
const YEAR = /\b(?:19|20)\d{2}\b/

/**
 * A project's old dates as a start and an end. A range's start without a year
 * takes its end's ("Jun – Aug 2025" starts "Jun 2025"); anything that isn't a
 * range of two is kept whole as the start, so nothing typed is lost.
 */
export function splitProjectDate(typed: string): { start: string; end: string } {
  const text = typed.trim()
  const parts = text.split(BETWEEN)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { start: text, end: "" }
  const [start, end] = parts
  const year = YEAR.exec(end)?.[0]
  return { start: YEAR.test(start) || !year ? start : `${start} ${year}`, end }
}

/**
 * `resume` with each project's `projectDate` split into its start and end
 * dates, unless it has them already; the same resume if no project has one.
 * It's read before anything else, as saved or as a file holds it, so it takes
 * anything.
 */
export function withProjectDates<T>(resume: T): T {
  if (!isObject(resume) || !Array.isArray(resume.projectsSection)) return resume
  let changed = false
  const projectsSection = resume.projectsSection.map((entry: unknown) => {
    if (!isObject(entry) || !("projectDate" in entry)) return entry
    changed = true
    const { projectDate, ...rest } = entry
    if (typeof projectDate !== "string" || rest.projectStartDate || rest.projectEndDate) return rest
    const { start, end } = splitProjectDate(projectDate)
    return { ...rest, projectStartDate: start, projectEndDate: end }
  })
  return changed ? { ...resume, projectsSection } : resume
}
