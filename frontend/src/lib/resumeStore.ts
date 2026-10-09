// The resumes in memory, and when to save them. context/ResumeContext.tsx
// shares this store with the app; lib/resumeStorage.ts reads and writes
// localStorage for it.
//
// Each resume is saved under a key of its own, so tabs editing different
// resumes never save over each other. A change is saved once typing pauses,
// or straight away when the page is hidden or closed (see flush), and only
// the resumes that changed are saved. What another tab saves is taken in
// without being saved again; if both tabs changed the same resume, the fields
// each one changed are kept.

import { CORE_SECTIONS, SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Resume, ResumeContent, ResumeField } from "./resume"
import {
  changedPaths,
  deleteKeptAside,
  EVERY_FIELD,
  idOf,
  isKeptAside,
  keyOf,
  LEGACY_KEY,
  loadSaved,
  mergeResume,
  migrateLegacy,
  readKeptAside,
  readResume,
  readSaved,
  removeResume,
  saveResume,
  supersedes,
  worse,
  type SaveStatus,
} from "./resumeStorage"
import { numberDuplicateTitles, uniqueTitle } from "./resumeTitles"
import { DEFAULT_TEMPLATE } from "./templates"
import {
  extraKey,
  extraRef,
  newExtraSection,
  readExtraSections,
  resolveSections,
  type ExtraKind,
  type ExtraPatch,
  type ExtraSection,
  type ExtraSections,
  type SectionRef,
} from "./resumeSections"

export interface ResumeState {
  /** Every resume saved in this browser, by id. */
  resumes: Record<string, Resume>
  /** False until the saved resumes have been read. */
  loaded: boolean
  /** Whether the latest changes are saved in this browser, and if not, why. */
  saveStatus: SaveStatus
  /** Whether anything changed here isn't in storage yet: waiting to be saved, or because saving failed. */
  unsaved: boolean
  /** When a change was last written to this browser's storage (as Date.now()); 0 before any is. */
  savedAt: number
  /** Saved data that couldn't be read, kept aside instead of being saved over. */
  unreadable: string[]
  /** The resume last replaced with a file's content on this page, until it changes again. Only kept in memory. */
  replaced: Replaced | null
}

/**
 * A resume replaced with a file's content, and the copy it replaced. It lasts
 * while the resume is one or the other: once it changes, here or in another
 * tab, putting it back would lose that change.
 */
export interface Replaced {
  id: string
  before: Resume
  after: Resume
  /** Whether it's been put back as it was before. */
  undone: boolean
}

/** Before anything has been read, as when the page is rendered on the server. */
export const INITIAL_STATE: ResumeState = {
  resumes: {},
  loaded: false,
  saveStatus: "saved",
  unsaved: false,
  savedAt: 0,
  unreadable: [],
  replaced: null,
}

/** How long typing pauses before the changes are saved, in milliseconds. */
export const SAVE_DELAY = 400

/** The resume saved under `id`, if there's one. Ids come from addresses and files, so one like "constructor" is only an id. */
export const resumeOf = (state: ResumeState, id: string): Resume | undefined =>
  Object.hasOwn(state.resumes, id) ? state.resumes[id] : undefined

const blankResume = (template: string): Resume => ({
  profileSection: {},
  headings: {},
  selectedTemplate: template,
  educationSection: [],
  workExperienceSection: [],
  projectsSection: [],
  publicationsSection: [],
  volunteerExperienceSection: [],
  skillsSection: [],
  leadershipExperienceSection: [],
  awardsSection: [],
  sectionOrder: [...CORE_SECTIONS],
  sectionsChosen: true,
})

/**
 * What the first change to a resume from before optional sections were added
 * from the list also changes: its order listed every section, so it keeps
 * only the ones it shows (resolveSections), and is marked so a section added
 * from now on stays, even while empty. Nothing for any other resume.
 */
const migrated = (resume: Resume): [Partial<Resume>, string[]] =>
  resume.sectionsChosen === true
    ? [{}, []]
    : [{ sectionOrder: resolveSections(resume), sectionsChosen: true }, ["sectionOrder", "sectionsChosen"]]

const without = (resumes: Record<string, Resume>, id: string) => Object.fromEntries(Object.entries(resumes).filter(([key]) => key !== id))

export type ResumeStore = ReturnType<typeof createResumeStore>

export function createResumeStore(delay = SAVE_DELAY) {
  let storage: Storage | null = null
  let state = INITIAL_STATE
  const listeners = new Set<() => void>()
  // The text each resume was last read or saved as here; null once it's gone.
  const seen = new Map<string, string | null>()
  // The fields changed here and not saved yet, by resume.
  const pending = new Map<string, Set<string>>()
  // Resumes deleted here and not yet removed from storage.
  const deleted = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined

  // Every change to what's waiting to be saved is followed by a setState, which notes it.
  function setState(next: Partial<ResumeState>) {
    state = { ...state, ...next, unsaved: pending.size > 0 || deleted.size > 0 }
    // Every way a resume can change goes through here, so this is where a replaced one stops being undoable.
    const { replaced } = state
    if (replaced && resumeOf(state, replaced.id) !== (replaced.undone ? replaced.before : replaced.after)) {
      state = { ...state, replaced: null }
    }
    for (const listener of listeners) listener()
  }

  const has = (id: string) => Object.hasOwn(state.resumes, id)

  function markChanged(id: string, ...fields: string[]) {
    const changed = pending.get(id) ?? new Set<string>()
    for (const field of fields) changed.add(field)
    pending.set(id, changed)
  }

  function saveSoon() {
    clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  /** Reads the saved resumes from `from`: localStorage, or null if the browser won't allow it. */
  function load(from: Storage | null) {
    storage = from
    const saved = loadSaved(storage)
    seen.clear()
    for (const [id, text] of saved.texts) seen.set(id, text)
    // Resumes saved with the same name get numbered, and that's saved like any change.
    const resumes = numberDuplicateTitles(saved.resumes)
    for (const [id, resume] of Object.entries(resumes)) if (resume !== saved.resumes[id]) markChanged(id, "resumeTitle")
    setState({ resumes, loaded: true, saveStatus: saved.status, unreadable: readKeptAside(storage) })
    if (pending.size > 0) saveSoon()
  }

  /** Changes one field of a resume. It's saved once typing pauses. */
  function edit<Field extends ResumeField>(id: string, field: Field, value: Resume[Field]) {
    if (!has(id)) return
    const [migration, migrationPaths] = migrated(state.resumes[id])
    markChanged(id, ...changedPaths(field, state.resumes[id][field], value), ...migrationPaths, "updatedAt")
    const resume = { ...state.resumes[id], ...migration, [field]: value, updatedAt: new Date().toISOString() }
    setState({ resumes: { ...state.resumes, [id]: resume } })
    saveSoon()
  }

  // Commands read the latest snapshot, preserve untouched member references and
  // publish one update. A section is one merge unit.
  function commit(id: string, changes: Partial<Resume>, paths: string[]) {
    if (!has(id) || !paths.length) return
    const [migration, migrationPaths] = migrated(state.resumes[id])
    markChanged(id, ...paths, ...migrationPaths, "updatedAt")
    setState({
      resumes: { ...state.resumes, [id]: { ...state.resumes[id], ...migration, ...changes, updatedAt: new Date().toISOString() } },
    })
    saveSoon()
  }

  /**
   * Adds a section at the end, and gives back where it is: an optional one by
   * its name (where it is already, if it's there), or a new text or bullet list.
   */
  function addSection(id: string, kind: ExtraKind | SectionName): SectionRef | null {
    if (!has(id)) return null
    const resume = state.resumes[id]
    if (kind !== "text" && kind !== "list") {
      const order = resolveSections(resume)
      if (!order.includes(kind)) commit(id, { sectionOrder: [...order, kind] }, ["sectionOrder"])
      return kind
    }
    const extras: ExtraSections = resume.extraSections ?? {}
    const key = crypto.randomUUID()
    const ref = extraRef(key)
    commit(id, { extraSections: { ...extras, [key]: newExtraSection(kind) }, sectionOrder: [...resolveSections(resume), ref] }, [
      `extraSections.${key}`,
      "sectionOrder",
    ])
    return ref
  }

  function changeSection(id: string, key: string, change: (section: ExtraSection) => ExtraSection) {
    if (!has(id)) return
    const extras: ExtraSections = state.resumes[id].extraSections ?? {}
    if (!Object.hasOwn(extras, key)) return
    const before = extras[key]
    const after = change(before)
    if (after === before || JSON.stringify(after) === JSON.stringify(before)) return
    if (!readExtraSections({ [key]: after }).complete) return
    commit(id, { extraSections: { ...extras, [key]: after } }, [`extraSections.${key}`])
  }

  function editSection(id: string, key: string, patch: ExtraPatch) {
    changeSection(id, key, (section) => {
      const { heading, leftOut, text, bullets } = patch
      return {
        ...section,
        ...(heading !== undefined && { heading }),
        ...(leftOut !== undefined && { leftOut }),
        ...(section.kind === "text" && text !== undefined && { text }),
        ...(section.kind === "list" && bullets !== undefined && { bullets }),
      }
    })
  }

  function includeSection(id: string, key: string, included: boolean) {
    editSection(id, key, { leftOut: !included })
  }

  /** Takes an optional section off the resume, with its entries, and its title if it was renamed. */
  function removeSection(id: string, name: SectionName) {
    if (!has(id) || !SECTIONS[name].optional) return
    const resume = state.resumes[id]
    const { dataKey, headingKey } = SECTIONS[name]
    const headings = Object.fromEntries(Object.entries(resume.headings ?? {}).filter(([key]) => key !== headingKey))
    const changes: Partial<Resume> = { sectionOrder: resolveSections(resume).filter((ref) => ref !== name), [dataKey]: [], headings }
    commit(id, changes, ["sectionOrder", dataKey, ...changedPaths("headings", resume.headings, headings)])
  }

  function deleteSection(id: string, key: string) {
    if (!has(id)) return
    const resume = state.resumes[id]
    const extras: ExtraSections = resume.extraSections ?? {}
    if (!Object.hasOwn(extras, key)) return
    const next = Object.fromEntries(Object.entries(extras).filter(([name]) => name !== key))
    const order = resolveSections(resume).filter((ref) => extraKey(ref) !== key)
    commit(id, { extraSections: next, sectionOrder: order }, [`extraSections.${key}`, "sectionOrder"])
  }

  function reorderSections(id: string, order: SectionRef[]) {
    if (!has(id)) return
    const resume = state.resumes[id]
    const next = resolveSections({ ...resume, sectionOrder: order })
    if (JSON.stringify(resolveSections(resume)) !== JSON.stringify(next)) commit(id, { sectionOrder: next }, ["sectionOrder"])
  }

  /** Adds an empty resume, and returns its id. */
  function create(title: string, tag: string, template: string = DEFAULT_TEMPLATE): string {
    const id = crypto.randomUUID()
    add(id, title, { ...blankResume(template), id, resumeTag: tag, updatedAt: new Date().toISOString() })
    return id
  }

  /**
   * Adds a resume opened from a file, named after the file, and returns its
   * id. A resumezip PDF keeps its resume's id, so opening it again later is
   * recognised as the same resume.
   */
  function importResume(content: ResumeContent, title: string, { keepId = true } = {}): string {
    const id = keepId && typeof content.id === "string" && content.id && !has(content.id) ? content.id : crypto.randomUUID()
    add(id, title, {
      ...blankResume(content.selectedTemplate ?? DEFAULT_TEMPLATE),
      ...content,
      id,
      resumeTag: "personal",
      updatedAt: content.updatedAt ?? new Date().toISOString(),
    })
    return id
  }

  /**
   * Adds a copy of a resume, everything in it under a new id, named
   * "<name> copy", and returns its id.
   */
  function duplicate(id: string): string | undefined {
    if (!has(id)) return undefined
    const original = state.resumes[id]
    const copy = crypto.randomUUID()
    add(copy, `${original.resumeTitle?.trim() || "Untitled resume"} copy`, {
      ...structuredClone(original),
      id: copy,
      updatedAt: new Date().toISOString(),
    })
    return copy
  }

  /** Renames a resume, as the editor's title does: a blank name is "Untitled resume", and a taken one is numbered. */
  function rename(id: string, title: string) {
    if (!has(id)) return
    const others = Object.entries(state.resumes).filter(([key]) => key !== id)
    const resumeTitle = uniqueTitle(
      title,
      others.map(([, resume]) => resume?.resumeTitle),
    )
    if (resumeTitle !== state.resumes[id].resumeTitle) edit(id, "resumeTitle", resumeTitle)
  }

  // A new resume is saved straight away. A repeated name gets a number, e.g. "Untitled resume 2".
  function add(id: string, title: string, resume: Resume) {
    const resumeTitle = uniqueTitle(
      title,
      Object.values(state.resumes).map((other) => other?.resumeTitle),
    )
    deleted.delete(id)
    markChanged(id, EVERY_FIELD)
    setState({ resumes: { ...state.resumes, [id]: { ...resume, resumeTitle } } })
    flush()
  }

  /**
   * Replaces a resume's content with a file's, keeping its name and tag. It
   * keeps the file's last-edited time too, not now: opening the same file
   * again then finds nothing different, and a newer file still looks newer.
   * Until the resume changes again, undoReplace puts back the copy it replaced.
   */
  function replace(id: string, content: ResumeContent) {
    if (!has(id)) return
    const before = state.resumes[id]
    markChanged(id, EVERY_FIELD)
    // A file without sections a person added replaces the ones here too.
    const after = {
      ...before,
      ...content,
      extraSections: content.extraSections ?? {},
      id,
      updatedAt: content.updatedAt ?? new Date().toISOString(),
    }
    setState({ resumes: { ...state.resumes, [id]: after }, replaced: { id, before, after, undone: false } })
    flush()
  }

  /** Puts back the copy that replace last replaced, if the resume hasn't changed since. */
  function undoReplace(id: string) {
    // Another tab may have saved a change this tab hasn't heard of yet. Taken
    // in first, it ends the undo like a change here, rather than being saved over.
    receive(keyOf(id))
    const { replaced } = state
    if (replaced?.id !== id || replaced.undone) return
    markChanged(id, EVERY_FIELD)
    setState({ resumes: { ...state.resumes, [id]: replaced.before }, replaced: { ...replaced, undone: true } })
    flush()
  }

  /** Deletes a resume. */
  function remove(id: string) {
    if (!has(id)) return
    pending.delete(id)
    deleted.add(id)
    setState({ resumes: without(state.resumes, id) })
    flush()
  }

  /** Saves what's changed, now. */
  function flush() {
    clearTimeout(timer)
    if (!storage || (pending.size === 0 && deleted.size === 0)) return
    let status: SaveStatus = "saved"
    let wrote = false
    const merged: [string, Resume][] = []
    for (const id of deleted) {
      const removed = removeResume(storage, id)
      if (removed !== "saved") {
        status = worse(status, removed)
        continue
      }
      deleted.delete(id)
      seen.set(id, null)
    }
    for (const [id, changed] of pending) {
      if (!has(id)) {
        pending.delete(id)
        continue
      }
      const resume = state.resumes[id]
      const saved = saveResume(storage, id, resume, changed, seen.get(id) ?? null)
      if (saved.status !== "saved" || saved.text === undefined || !saved.resume) {
        status = worse(status, saved.status)
        continue
      }
      pending.delete(id)
      seen.set(id, saved.text)
      wrote = true
      // Another tab had saved changes to other fields, and they're in now.
      if (saved.resume !== resume) merged.push([id, saved.resume])
    }
    setState({
      saveStatus: status,
      ...(wrote && { savedAt: Date.now() }),
      unreadable: readKeptAside(storage),
      ...(merged.length > 0 && { resumes: { ...state.resumes, ...Object.fromEntries(merged) } }),
    })
  }

  /**
   * Takes in what another tab saved under `key` (null when it cleared
   * everything), without saving it again. `value` is what it saved there.
   */
  function receive(key: string | null, value: string | null = null) {
    if (!storage) return
    try {
      if (key === null) reloadAll(storage)
      else if (isKeptAside(key)) setState({ unreadable: readKeptAside(storage) })
      else if (key === LEGACY_KEY) {
        if (value !== null) receiveLegacy(storage, value)
      } else {
        const id = idOf(key)
        if (id !== null) receiveResume(storage, id)
      }
    } catch {
      // Storage can't be read any more. What's in memory stays.
    }
  }

  function receiveResume(storage: Storage, id: string) {
    // A deletion here that's still being saved wins.
    if (deleted.has(id)) return
    // What's saved now, rather than what the event said: events can arrive
    // after this tab has saved over them.
    const text = storage.getItem(keyOf(id))
    if (seen.has(id) ? text === seen.get(id) : text === null) return
    const ours = has(id) ? state.resumes[id] : undefined
    const changed = pending.get(id)
    if (text === null) {
      // Deleted in another tab. Changes here that aren't saved yet keep it;
      // they're saved again soon.
      seen.set(id, null)
      if (ours && !changed) setState({ resumes: without(state.resumes, id) })
      return
    }
    const theirs = readResume(text)
    if (!theirs.complete || !theirs.resume) {
      if (ours) {
        // Saved by something this tab can't fully read. This tab keeps its
        // own version, and saves it back once that text is kept aside.
        markChanged(id, EVERY_FIELD)
        saveSoon()
      } else {
        const saved = readSaved(storage, id)
        if (saved.resume && saved.text !== null) {
          seen.set(id, saved.text)
          setState({ resumes: { ...state.resumes, [id]: saved.resume } })
        }
        // It couldn't be kept aside, and is left as it is: show why.
        if (saved.status !== "saved") setState({ saveStatus: worse(state.saveStatus, saved.status) })
      }
      setState({ unreadable: readKeptAside(storage) })
      return
    }
    seen.set(id, text)
    // Changes here that aren't saved yet stay on top, and are saved soon.
    const resume = ours && changed ? mergeResume(theirs.resume, ours, changed) : theirs.resume
    setState({ resumes: { ...state.resumes, [id]: resume } })
  }

  // A tab still on an earlier version saved every resume under one key. What's
  // there now is used, as the event can be older than a change this tab made
  // since; if this tab has removed the key since, it's what the event says
  // was saved. Either way, resumes this tab has seen deleted stay deleted,
  // and newer ones that can't be moved to keys of their own for lack of room
  // are still taken in.
  function receiveLegacy(storage: Storage, text: string) {
    const gone = (id: string) => deleted.has(id) || seen.get(id) === null
    const legacy = migrateLegacy(storage, storage.getItem(LEGACY_KEY) ?? text, gone)
    if (legacy.status !== "saved") setState({ saveStatus: worse(state.saveStatus, legacy.status) })
    for (const id of legacy.saved) receiveResume(storage, id)
    for (const [id, resume] of Object.entries(legacy.resumes)) {
      if (legacy.saved.includes(id) || gone(id)) continue
      // What's under its own key is the copy to beat, as this tab may not have
      // heard of the latest save there yet. If it's as new, take that in instead.
      const current = storage.getItem(keyOf(id))
      const own = current === null ? null : readResume(current).resume
      if (own && !supersedes(resume, own)) {
        receiveResume(storage, id)
        continue
      }
      if (has(id) && !supersedes(resume, state.resumes[id])) continue
      // Newer, but not moved: taken in here, and saved under its own key once there's room.
      const changed = pending.get(id)
      const ours = has(id) ? state.resumes[id] : undefined
      setState({ resumes: { ...state.resumes, [id]: ours && changed ? mergeResume(resume, ours, changed) : resume } })
      markChanged(id, EVERY_FIELD)
    }
    if (pending.size > 0) saveSoon()
    setState({ unreadable: readKeptAside(storage) })
  }

  // Storage was cleared in another tab. Re-read it, keeping any resume this
  // tab has changes to, and saving it again.
  function reloadAll(storage: Storage) {
    const saved = loadSaved(storage)
    seen.clear()
    for (const [id, text] of saved.texts) seen.set(id, text)
    const kept = [...pending.keys()].filter(has).map((id) => [id, state.resumes[id]] as const)
    for (const [id] of kept) markChanged(id, EVERY_FIELD)
    setState({ resumes: { ...saved.resumes, ...Object.fromEntries(kept) }, unreadable: readKeptAside(storage) })
    if (saved.status !== "saved") setState({ saveStatus: worse(state.saveStatus, saved.status) })
    if (pending.size > 0) saveSoon()
  }

  /** Deletes the saved data kept aside, which makes room, so anything waiting is saved. */
  function deleteUnreadable() {
    deleteKeptAside(storage)
    setState({ unreadable: readKeptAside(storage) })
    flush()
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    getState: () => state,
    subscribe,
    load,
    edit,
    addSection,
    editSection,
    includeSection,
    removeSection,
    deleteSection,
    reorderSections,
    create,
    importResume,
    duplicate,
    rename,
    replace,
    undoReplace,
    remove,
    flush,
    receive,
    deleteUnreadable,
  }
}
