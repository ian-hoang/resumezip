import { SECTION_NAMES, SECTIONS, type DataKey, type SectionName } from "@/components/editor/sections"

interface ExtraBase {
  heading: string
  leftOut?: boolean
}
export type ExtraSection = (ExtraBase & { kind: "text"; text: string }) | (ExtraBase & { kind: "list"; bullets: string })
export type ExtraKind = ExtraSection["kind"]
export type ExtraSections = Record<string, ExtraSection>
export type SectionRef = SectionName | `extra:${string}`
export type ExtraPatch = { heading?: string; leftOut?: boolean; text?: string; bullets?: string }

export const isUUID = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
export const extraKey = (ref: string): string | null => (ref.startsWith("extra:") ? ref.slice(6) : null)
export const extraRef = (key: string): SectionRef => `extra:${key}`
export const sectionIncluded = (section: { leftOut?: boolean }) => section.leftOut !== true
export const extraHeading = (section: ExtraSection) => section.heading.trim() || "New section"

/** Decode only the new domain. Invalid members are salvaged separately from the original raw save. */
export function readExtraSections(value: unknown, { local = false } = {}): { sections: ExtraSections; complete: boolean } {
  if (!object(value)) return { sections: {}, complete: false }
  let complete = true
  const members: [string, ExtraSection][] = []
  for (const [key, raw] of Object.entries(value)) {
    const section = readExtraSection(key, raw)
    if (section) {
      members.push([key, section])
      // Future local fields must be recoverable before a narrower editor saves.
      // Portable files instead pass through an explicit public allowlist.
      if (local && object(raw)) {
        const allowed = new Set(["kind", "heading", "leftOut", section.kind === "list" ? "bullets" : "text"])
        if (Object.keys(raw).some((field) => !allowed.has(field))) complete = false
      }
    } else complete = false
  }
  return { sections: Object.fromEntries(members), complete }
}

function readExtraSection(key: string, value: unknown): ExtraSection | null {
  if (!object(value)) return null
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
  if (!object(value)) return {}
  let sections = readMaps.get(value)
  if (!sections) {
    sections = readExtraSections(value).sections
    readMaps.set(value, sections)
  }
  return sections
}

/** What resolveSections reads of a resume: its order, its sections, and whether the optional ones have entries. */
type SavedSections = { sectionOrder?: unknown; sectionsChosen?: unknown; extraSections?: unknown } & { [Key in DataKey]?: unknown }

/** The optional sections with entries in them, which show whether they're in the saved order or not. */
export const filledSections = (resume: SavedSections): SectionName[] =>
  SECTION_NAMES.filter((name) => {
    const entries = resume[SECTIONS[name].dataKey]
    return SECTIONS[name].optional && Array.isArray(entries) && entries.length > 0
  })

/**
 * The sections the editor shows and the PDF prints, in order: the saved
 * order's, then any core section it lacks, or optional one with entries
 * (`filled`), then sections the person added that it lacks. An optional
 * section in the saved order shows even when it's empty, as the person added
 * it, unless the resume is older than adding them (no `sectionsChosen`): its
 * order listed every section. A view only: opening a resume never repairs
 * order, creates content or generates identities.
 */
export function resolveSections(resume: SavedSections, filled: readonly SectionName[] = filledSections(resume)): SectionRef[] {
  const extras = extrasOf(resume)
  const valid = (value: unknown): value is SectionRef =>
    typeof value === "string" &&
    (SECTION_NAMES.includes(value as SectionName) || (extraKey(value) !== null && Object.hasOwn(extras, extraKey(value)!)))
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
  for (const ref of Array.isArray(resume.sectionOrder) ? resume.sectionOrder : []) if (valid(ref) && shown(ref)) add(ref)
  for (const name of SECTION_NAMES) if (!SECTIONS[name].optional || filled.includes(name)) add(name)
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
