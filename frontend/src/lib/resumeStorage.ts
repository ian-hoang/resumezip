// Resumes are saved in the browser's localStorage, each under a key of its
// own ("resume:<id>"); earlier versions saved them all under one. That's the
// only copy there is, so nothing here throws: the browser can block storage
// or run out of room, and what's saved can be unreadable. None of that may
// crash the app or get saved over. lib/resumeStore.ts decides when to save.

import { SECTIONS } from "@/components/editor/sections"
import { CHECK_FIELD } from "@/lib/check/state"

/**
 * Saved data that can't be read is kept instead of being saved over, each
 * time under a key of its own: this, then the time and a random suffix.
 */
export const UNREADABLE_PREFIX = "allResumes-unreadable-"
const KEPT = new RegExp(`^${UNREADABLE_PREFIX}(\\d+)-[a-z0-9]*$`)

/** Whether a localStorage key holds saved data kept aside. */
export const isKeptAside = (key: string) => KEPT.test(key)

/** Each resume is saved under a key of its own: this, then its id. */
export const RESUME_PREFIX = "resume:"
/** The localStorage key a resume is saved under. */
export const keyOf = (id: string) => RESUME_PREFIX + id

/** The id of the resume saved under a localStorage key, or null if it isn't one. */
export const idOf = (key: string) => (key.startsWith(RESUME_PREFIX) ? key.slice(RESUME_PREFIX.length) : null)

/** In a resume's changed fields: all of them, as for a new resume. */
export const EVERY_FIELD = "*"

/** Where earlier versions saved every resume, as one JSON object by id. */
export const LEGACY_KEY = "allResumes"
/** A copy of what was saved there, kept once when it's moved. */
export const BACKUP_KEY = "allResumes-backup"

type Resume = Record<string, any>
type Resumes = Record<string, Resume>

/**
 * Whether the latest changes are saved: "blocked" when the browser won't let
 * the site save anything, "full" when its storage is out of room, and
 * "failed" when anything else stops a save.
 */
export type SaveStatus = "saved" | "blocked" | "full" | "failed"

/** localStorage, or null when the browser won't let the site use it. */
export function getStorage(): Storage | null {
  try {
    // Reading it throws when the browser blocks sites from saving data, and
    // some apps' built-in browsers don't have it.
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export interface SavedResumes {
  /** The saved resumes that could be read, by id. */
  resumes: Resumes
  /** The text each resume was read as, to tell later whether another tab has saved it since. */
  texts: Map<string, string>
  /**
   * "blocked" if the browser won't let the site use storage; "full" or
   * "failed" if saved data that can't be read couldn't be kept aside (so it's
   * left as it is), or resumes couldn't be moved from where earlier versions
   * saved them; otherwise "saved".
   */
  status: SaveStatus
}

/** Reads every saved resume, moving any that earlier versions saved first (see migrateLegacy). */
export function loadSaved(storage: Storage | null): SavedResumes {
  const blocked: SavedResumes = { resumes: {}, texts: new Map(), status: "blocked" }
  if (!storage) return blocked
  try {
    let status = migrateLegacy(storage).status
    const resumes = new Map<string, Resume>()
    const texts = new Map<string, string>()
    for (const id of savedIds(storage)) {
      const saved = readSaved(storage, id)
      status = worse(status, saved.status)
      if (saved.resume && saved.text !== null) {
        resumes.set(id, saved.resume)
        texts.set(id, saved.text)
      }
    }
    // Resumes that couldn't be moved yet, e.g. for lack of room, are still
    // read from where they are, if that copy is newer. Saving one gives it a
    // key of its own.
    const legacy = storage.getItem(LEGACY_KEY)
    if (legacy !== null) {
      for (const [id, resume] of Object.entries(parse(legacy).resumes)) {
        const current = resumes.get(id)
        if (!current || supersedes(resume, current)) resumes.set(id, resume)
      }
    }
    // fromEntries keeps an id like "__proto__" an ordinary key.
    return { resumes: Object.fromEntries(resumes), texts, status }
  } catch {
    return blocked
  }
}

/**
 * One saved resume, as loaded, and the text it's saved as. Text that can't be
 * fully read is kept aside, then the key is saved again with what could be
 * read (or removed, if none could), so it isn't found again next time. If it
 * can't be kept aside, it's left as it is, and the status says why. Throws if
 * storage can't be read.
 */
export function readSaved(storage: Storage, id: string): { resume: Resume | null; text: string | null; status: SaveStatus } {
  const key = keyOf(id)
  const text = storage.getItem(key)
  if (text === null) return { resume: null, text: null, status: "saved" }
  const { resume, complete } = readResume(text)
  if (complete) return { resume, text, status: "saved" }
  const kept = keepAside(storage, text)
  if (kept !== "saved") return { resume, text, status: kept }
  try {
    if (!resume) {
      storage.removeItem(key)
      return { resume: null, text: null, status: "saved" }
    }
    const readable = JSON.stringify(resume)
    storage.setItem(key, readable)
    return { resume, text: readable, status: "saved" }
  } catch {
    // It's kept aside, so it's safe as it is.
    return { resume, text, status: "saved" }
  }
}

// The ids of the resumes saved under keys of their own.
function savedIds(storage: Storage): string[] {
  const ids: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const id = idOf(storage.key(i) ?? "")
    if (id !== null) ids.push(id)
  }
  return ids
}

export interface Migrated {
  /** The ids it saved under keys of their own. */
  saved: string[]
  /** What could be read of the resumes it found, moved or not. */
  resumes: Resumes
  /** "saved", unless something couldn't be moved, or couldn't be read and kept aside either. */
  status: SaveStatus
}

/**
 * Moves the resumes that earlier versions saved under one key (LEGACY_KEY) to
 * keys of their own. `text` is what's saved there, or what a tab still on an
 * earlier version just saved, which is moved even if the key has been removed
 * since. A resume already under its own key is only replaced by a newer
 * version (see supersedes). The old text is copied once to BACKUP_KEY (or kept
 * aside, if some of it can't be read), then removed. Anything that can't be
 * moved is left for next time, and resumes `skip` names aren't moved at all.
 * Throws if storage can't be read.
 */
export function migrateLegacy(
  storage: Storage,
  text: string | null = storage.getItem(LEGACY_KEY),
  skip: (id: string) => boolean = () => false,
): Migrated {
  if (text === null) return { saved: [], resumes: {}, status: "saved" }
  const { resumes, complete } = parse(text)
  let status: SaveStatus = complete ? "saved" : keepAside(storage, text)
  if (status !== "saved") return { saved: [], resumes, status }
  const saved: string[] = []
  let moved = true
  for (const [id, resume] of Object.entries(resumes)) {
    if (skip(id)) continue
    const current = storage.getItem(keyOf(id))
    if (current !== null) {
      const existing = readResume(current)
      if (existing.complete && existing.resume && !supersedes(resume, existing.resume)) continue
      const kept = existing.complete ? "saved" : keepAside(storage, current)
      if (kept !== "saved") {
        status = worse(status, kept)
        moved = false
        continue
      }
    }
    try {
      storage.setItem(keyOf(id), JSON.stringify(resume))
      saved.push(id)
    } catch (error) {
      // It still loads from the old key (see loadSaved); the status says why it wasn't moved.
      status = worse(status, failure(error))
      moved = false
    }
  }
  if (!moved) return { saved, resumes, status }
  if (complete && Object.keys(resumes).length > 0 && storage.getItem(BACKUP_KEY) === null) {
    try {
      storage.setItem(BACKUP_KEY, text)
    } catch {
      // Only a precaution: every resume is under its own key by now.
    }
  }
  // Unless a tab on an earlier version saved again meanwhile.
  if (storage.getItem(LEGACY_KEY) === text) storage.removeItem(LEGACY_KEY)
  return { saved, resumes, status }
}

/**
 * Whether a resume an earlier version saved replaces the copy under its own
 * key: if it was edited later, or at the same moment but differs, as that
 * version saved last.
 */
export function supersedes(legacy: Resume, current: Resume): boolean {
  const legacyTime = time(legacy.updatedAt)
  const currentTime = time(current.updatedAt)
  return legacyTime > currentTime || (legacyTime === currentTime && JSON.stringify(legacy) !== JSON.stringify(current))
}

/** What can be read of the resumes earlier versions saved (see LEGACY_KEY), and whether that's all of it. */
function parse(text: string): { resumes: Resumes; complete: boolean } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { resumes: {}, complete: false }
  }
  if (!isObject(value)) return { resumes: {}, complete: false }
  let complete = true
  const resumes: [string, Resume][] = []
  for (const [id, entry] of Object.entries(value)) {
    const { resume, complete: whole } = readEntry(entry)
    if (!whole) complete = false
    if (resume) resumes.push([id, resume])
  }
  // fromEntries keeps an id like "__proto__" an ordinary key. Assigning it
  // would set the object's prototype instead, and the resume would be lost.
  return { resumes: Object.fromEntries(resumes), complete }
}

/** A resume saved under its own key: what the editor can show of it, and whether that's all of it. */
export function readResume(text: string): { resume: Resume | null; complete: boolean } {
  try {
    return readEntry(JSON.parse(text))
  } catch {
    return { resume: null, complete: false }
  }
}

/**
 * A resume as the editor can show it, and whether that's all of it; null if
 * it isn't a resume at all. The editor would show a field or entry in another
 * shape as empty, or crash on it, and the first edit would replace it. So it's
 * left out here, and whoever saves over it keeps the text aside first.
 */
function readEntry(value: unknown): { resume: Resume | null; complete: boolean } {
  if (!isObject(value)) return { resume: null, complete: false }
  let complete = true
  const fields: [string, unknown][] = []
  for (const [key, field] of Object.entries(value)) {
    const readable = readField(key, field)
    if (!readable?.complete) complete = false
    if (readable) fields.push([key, readable.value])
  }
  return { resume: Object.fromEntries(fields), complete }
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

// Fields the editor reads as lists of entries, and as objects of named
// values (the checker's dismissals and added words are one). Older resumes
// can lack some of them, or have them empty (null); only other shapes count.
const ENTRY_LISTS = new Set(Object.values(SECTIONS).map((section) => section.dataKey))
export const OBJECT_FIELDS = new Set(["profileSection", "headings", CHECK_FIELD])

/** A field as the editor can show it, and whether that's all of it; null if none of it. */
function readField(key: string, value: unknown): { value: unknown; complete: boolean } | null {
  if (value == null) return { value, complete: true }
  if (key === "sectionOrder" || ENTRY_LISTS.has(key)) {
    if (!Array.isArray(value)) return null
    // Entries are objects, and the section order is a list of names.
    const items = value.filter(key === "sectionOrder" ? (item) => typeof item === "string" : isObject)
    return { value: items, complete: items.length === value.length }
  }
  if (OBJECT_FIELDS.has(key) && !isObject(value)) return null
  return { value, complete: true }
}

export interface Saved {
  status: SaveStatus
  /** Once saved, the text saved, and the resume as saved (with another tab's changes, if it made any). */
  text?: string
  resume?: Resume
}

/**
 * Saves one resume, and says how that went. If another tab saved it since
 * this tab last read or saved it (`seen`), what that tab saved is kept, with
 * the fields this tab changed on top. Saved text that can't be fully read is
 * kept aside before it's saved over; if that fails, nothing is saved.
 */
export function saveResume(
  storage: Storage | null,
  id: string,
  resume: Resume,
  changed: ReadonlySet<string>,
  seen: string | null,
): Saved {
  if (!storage) return { status: "blocked" }
  const key = keyOf(id)
  let current: string | null
  try {
    current = storage.getItem(key)
  } catch {
    return { status: "blocked" }
  }
  let saving = resume
  if (current !== null) {
    const theirs = readResume(current)
    const kept = theirs.complete ? "saved" : keepAside(storage, current)
    if (kept !== "saved") return { status: kept }
    if (current !== seen && theirs.resume) saving = mergeResume(theirs.resume, resume, changed)
  }
  const text = JSON.stringify(saving)
  try {
    storage.setItem(key, text)
    return { status: "saved", text, resume: saving }
  } catch (error) {
    return { status: failure(error) }
  }
}

/** Removes a saved resume, and says how that went. */
export function removeResume(storage: Storage | null, id: string): SaveStatus {
  if (!storage) return "blocked"
  try {
    storage.removeItem(keyOf(id))
  } catch (error) {
    return failure(error)
  }
  return removeLegacy(storage, id)
}

// A resume not yet moved from where earlier versions saved it (see loadSaved)
// is removed from there too, or it would come back. If that fails, the
// status says so, and the deletion is tried again.
function removeLegacy(storage: Storage, id: string): SaveStatus {
  let all: unknown
  try {
    const text = storage.getItem(LEGACY_KEY)
    if (text === null) return "saved"
    all = JSON.parse(text)
  } catch {
    // Unreadable there, so it can't come back from there either.
    return "saved"
  }
  if (!isObject(all) || !Object.hasOwn(all, id)) return "saved"
  try {
    storage.setItem(LEGACY_KEY, JSON.stringify(Object.fromEntries(Object.entries(all).filter(([key]) => key !== id))))
    return "saved"
  } catch (error) {
    return failure(error)
  }
}

/**
 * Another tab's version of a resume, with what this tab changed taken from
 * its own, and the later of the two edit times. `changed` names fields, or
 * single values inside an object field, like "profileSection.email" (see
 * changedPaths). Changing the same one in two tabs at once keeps the one
 * saved last.
 */
export function mergeResume(theirs: Resume, ours: Resume, changed: ReadonlySet<string>): Resume {
  if (changed.has(EVERY_FIELD)) return ours
  const fields = new Map(Object.entries(theirs))
  for (const path of changed) {
    const dot = path.indexOf(".")
    if (dot < 0) {
      if (Object.hasOwn(ours, path)) fields.set(path, ours[path])
      else fields.delete(path)
      continue
    }
    // One value in an object field: theirs, with ours for that value.
    const field = path.slice(0, dot)
    const key = path.slice(dot + 1)
    if (changed.has(field)) continue
    const values = new Map(Object.entries(isObject(fields.get(field)) ? (fields.get(field) as Resume) : {}))
    const mine = isObject(ours[field]) ? (ours[field] as Resume) : {}
    if (Object.hasOwn(mine, key)) values.set(key, mine[key])
    else values.delete(key)
    fields.set(field, Object.fromEntries(values))
  }
  return { ...Object.fromEntries(fields), updatedAt: later(theirs.updatedAt, ours.updatedAt) }
}

/**
 * What an edit changed, as mergeResume takes it: the field, or for an object
 * field like the profile, each value in it that changed.
 */
export function changedPaths(field: string, before: unknown, after: unknown): string[] {
  if (!OBJECT_FIELDS.has(field) || !isObject(before) || !isObject(after)) return [field]
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => before[key] !== after[key]).map((key) => `${field}.${key}`)
}

// The worse of two outcomes, to show for a save of several things.
const RANK: SaveStatus[] = ["saved", "failed", "full", "blocked"]
export const worse = (a: SaveStatus, b: SaveStatus) => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b)

// When a resume was last edited, for comparing; unknown times come first.
const time = (value: unknown) => {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN
  return Number.isNaN(parsed) ? -Infinity : parsed
}
const later = (a: unknown, b: unknown) => (time(a) >= time(b) ? a : b)

function failure(error: unknown): SaveStatus {
  if (isQuotaError(error)) return "full"
  console.warn("Couldn't save resumes:", error)
  return "failed"
}

// Older versions of Firefox give the error their own name.
const isQuotaError = (error: unknown) =>
  error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")

/** Copies saved data under a key of its own (see UNREADABLE_PREFIX), and says how that went. */
function keepAside(storage: Storage, text: string): SaveStatus {
  try {
    // Another tab may have kept it already.
    if (keptKeys(storage).some((key) => storage.getItem(key) === text)) return "saved"
    // A new key every time, so two tabs keeping different data at once can't
    // pick the same one and save over each other's copy.
    storage.setItem(`${UNREADABLE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text)
    return "saved"
  } catch (error) {
    return failure(error)
  }
}

/** The keys of the data kept aside, oldest first. */
function keptKeys(storage: Storage): string[] {
  const kept: [number, string][] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    const time = key?.match(KEPT)?.[1]
    if (key && time) kept.push([Number(time), key])
  }
  return kept.sort(([a, keyA], [b, keyB]) => a - b || keyA.localeCompare(keyB)).map(([, key]) => key)
}

/** The saved data kept aside because it couldn't be read, oldest first. */
export function readKeptAside(storage: Storage | null): string[] {
  if (!storage) return []
  try {
    return keptKeys(storage).flatMap((key) => storage.getItem(key) ?? [])
  } catch {
    return []
  }
}

/** Deletes the saved data kept aside. */
export function deleteKeptAside(storage: Storage | null) {
  if (!storage) return
  try {
    for (const key of keptKeys(storage)) storage.removeItem(key)
  } catch {
    // Anything not deleted is still listed by readKeptAside.
  }
}
