import { SECTION_NAMES, SECTIONS, type DataKey, type SectionName } from "@/components/editor/sections"
import { isObject } from "@/lib/isObject"
import type { Headings } from "@/lib/resume"

interface ExtraBase {
  heading: string
  leftOut?: boolean
}
export type ExtraSection = (ExtraBase & { kind: "text"; text: string }) | (ExtraBase & { kind: "list"; bullets: string })
export type ExtraKind = ExtraSection["kind"]
export type ExtraSections = Record<string, ExtraSection>
export type SectionRef = SectionName | `extra:${string}`
export type ExtraPatch = { heading?: string; leftOut?: boolean; text?: string; bullets?: string }

const isUUID = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export const extraKey = (ref: string): string | null => (ref.startsWith("extra:") ? ref.slice(6) : null)
export const extraRef = (key: string): SectionRef => `extra:${key}`
/** Whether a saved value names a section: one of the editor's, or one the person added that's in `extras`. */
export const isSectionRef = (value: unknown, extras: ExtraSections): value is SectionRef =>
  typeof value === "string" &&
  (SECTION_NAMES.includes(value as SectionName) || (extraKey(value) !== null && Object.hasOwn(extras, extraKey(value)!)))
export const sectionIncluded = (section: { leftOut?: boolean }) => section.leftOut !== true
export const extraHeading = (section: ExtraSection) => section.heading.trim() || "New section"

/** Each section's title as the person named it, or the editor's: what the section list calls it and the PDF prints over it. */
export function sectionTitles(
  sections: readonly SectionRef[],
  headings: Headings | null | undefined,
  extras: ExtraSections | null | undefined,
): Map<SectionRef, string> {
  return new Map(
    sections.map((ref) => {
      const key = extraKey(ref)
      if (key !== null) return [ref, extras?.[key] ? extraHeading(extras[key]) : "New section"] as const
      const section = SECTIONS[ref as SectionName]
      return [ref, headings?.[section.headingKey] || section.title] as const
    }),
  )
}

/**
 * The added sections that can be read, and whether that's all of them: a file
 * with a section that can't be read isn't opened (resumeFile.ts), and saved
 * text with one is kept aside before it's saved over (resumeStorage.ts).
 */
export function readExtraSections(value: unknown, { local = false } = {}): { sections: ExtraSections; complete: boolean } {
  if (!isObject(value)) return { sections: {}, complete: false }
  let complete = true
  const members: [string, ExtraSection][] = []
  for (const [key, raw] of Object.entries(value)) {
    const section = readExtraSection(key, raw)
    if (section) {
      members.push([key, section])
      // In this browser, a section with fields this version doesn't know, as a
      // newer one may save, isn't all read, so its saved text is kept aside
      // before a save drops them. A file's sections keep only these fields.
      if (local && isObject(raw)) {
        const allowed = new Set(["kind", "heading", "leftOut", section.kind === "list" ? "bullets" : "text"])
        if (Object.keys(raw).some((field) => !allowed.has(field))) complete = false
      }
    } else complete = false
  }
  return { sections: Object.fromEntries(members), complete }
}

function readExtraSection(key: string, value: unknown): ExtraSection | null {
  if (!isObject(value)) return null
  const kind = value.kind
  if (!isUUID(key) || (kind !== "text" && kind !== "list")) return null
  if (
    (value.heading !== undefined && typeof value.heading !== "string") ||
    (value.leftOut !== undefined && typeof value.leftOut !== "boolean")
  )
    return null
  const base = { heading: (value.heading ?? "") as string, ...(value.leftOut !== undefined && { leftOut: value.leftOut as boolean }) }
  if (kind === "text") {
    if (value.text !== undefined && typeof value.text !== "string") return null
    return { ...base, kind, text: (value.text ?? "") as string }
  }
  if (value.bullets !== undefined && typeof value.bullets !== "string") return null
  return { ...base, kind: "list", bullets: (value.bullets ?? "") as string }
}

// The sections read from each map, by the map: the preview, the checker and
// the section list all ask for the same one, several times a key typed, and a
// change makes a new map.
const readMaps = new WeakMap<object, ExtraSections>()

/**
 * A resume's added sections, the ones that can be read. Saved data, so it's
 * read as unknown and checked; what comes back is shared, not to be changed.
 */
export function extrasOf(resume: { extraSections?: unknown }): ExtraSections {
  const value = resume.extraSections
  if (!isObject(value)) return {}
  let sections = readMaps.get(value)
  if (!sections) {
    sections = readExtraSections(value).sections
    readMaps.set(value, sections)
  }
  return sections
}

/** What resolveSections reads of a resume: its order, its added sections, and which sections have entries. */
type SavedSections = { sectionOrder?: unknown; sectionsChosen?: unknown; extraSections?: unknown } & { [Key in DataKey]?: unknown }

/** The sections with entries in them, which show whether they're in the saved order or not. */
export const filledSections = (resume: SavedSections): SectionName[] =>
  SECTION_NAMES.filter((name) => {
    const entries = resume[SECTIONS[name].dataKey]
    return Array.isArray(entries) && entries.length > 0
  })

/**
 * The sections the editor shows and the PDF prints, in order: the saved
 * order's, then any section with entries it lacks (`filled`), then sections
 * the person added that it lacks. The saved order holds the sections the
 * person has (`sectionsChosen`): a new resume's core ones and those added
 * since, which show even while empty, and not one they deleted. A resume
 * older than that listed every section, so there an optional section shows
 * only with entries, and the core ones always do. It only reads.
 */
export function resolveSections(resume: SavedSections, filled: readonly SectionName[] = filledSections(resume)): SectionRef[] {
  const extras = extrasOf(resume)
  const order: SectionRef[] = []
  const seen = new Set<SectionRef>()
  const add = (ref: SectionRef) => {
    if (!seen.has(ref)) {
      seen.add(ref)
      order.push(ref)
    }
  }
  const chosen = resume.sectionsChosen === true
  const shown = (ref: SectionRef) =>
    chosen || !SECTION_NAMES.includes(ref as SectionName) || !SECTIONS[ref as SectionName].optional || filled.includes(ref as SectionName)
  for (const ref of Array.isArray(resume.sectionOrder) ? resume.sectionOrder : []) if (isSectionRef(ref, extras) && shown(ref)) add(ref)
  for (const name of SECTION_NAMES) if ((!chosen && !SECTIONS[name].optional) || filled.includes(name)) add(name)
  for (const key of Object.keys(extras)) add(extraRef(key))
  return order
}

export function extraHasBody(section: ExtraSection): boolean {
  if (!sectionIncluded(section)) return false
  if (section.kind === "list")
    return section.bullets.split("\n").some((line) => !line.trimStart().startsWith("○") && line.replace(/^\s*•\s*/, "").trim())
  return !!section.text.trim()
}

export function newExtraSection(kind: ExtraKind): ExtraSection {
  return kind === "list" ? { kind, heading: "New section", bullets: "" } : { kind, heading: "New section", text: "" }
}
