// Resume names are kept unique so they can be told apart in the list:
// a second "Untitled resume" becomes "Untitled resume 2", then 3, and so on.

const UNTITLED = "Untitled resume"

// Names are compared ignoring case and surrounding spaces; a blank name counts as "Untitled resume".
const key = (title: unknown) => (typeof title === "string" && title.trim() ? title.trim() : UNTITLED).toLowerCase()

/** The name as given, or with the lowest free number after it if another resume already uses it. */
export function uniqueTitle(title: string, taken: unknown[]): string {
  const base = title.trim() || UNTITLED
  const used = new Set(taken.map(key))
  if (!used.has(base.toLowerCase())) return base
  let n = 2
  while (used.has(`${base} ${n}`.toLowerCase())) n++
  return `${base} ${n}`
}

/** Numbers resumes that share a name. The oldest keeps it; the others get the next free numbers. */
export function numberDuplicateTitles(resumes: Record<string, any>): Record<string, any> {
  const entries = Object.entries(resumes)
  const seen = new Set<string>()
  const duplicates = entries.filter(([, resume]) => {
    const name = key(resume?.resumeTitle)
    if (seen.has(name)) return true
    seen.add(name)
    return false
  })
  if (duplicates.length === 0) return resumes

  const taken: unknown[] = [...seen]
  const numbered = { ...resumes }
  for (const [id, resume] of duplicates) {
    const title = uniqueTitle(resume?.resumeTitle ?? "", taken)
    taken.push(title)
    numbered[id] = { ...resume, resumeTitle: title }
  }
  return numbered
}
