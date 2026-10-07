// What the person has told the checker about a resume: the findings they
// dismissed, and the words they added so they aren't flagged as typos. It's
// saved with the resume in this browser, under CHECK_FIELD, so it's kept the
// same careful way as the rest of the resume. Downloaded PDFs leave it out,
// as they only carry what's printed (lib/resumeFile.ts).

import type { Finding, Report } from "./engine"
import { ruleOfKey } from "./places"
import { MAX_DISMISSED, MAX_WORD_LENGTH, MAX_WORDS } from "./settings"

/** The resume field it's saved under. */
export const CHECK_FIELD = "check"

export interface CheckState {
  /** The keys of the dismissed findings, oldest first. */
  dismissed: string[]
  /** The added words, as typed, oldest first. */
  words: string[]
}

const strings = (value: unknown, max: number, longest: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= longest)
    .slice(-max)

const savedOn = (resume: Record<string, any>): Record<string, unknown> => {
  const saved = resume?.[CHECK_FIELD]
  return typeof saved === "object" && saved !== null && !Array.isArray(saved) ? saved : {}
}

// Far longer than any finding's key (see findingKey in places.ts).
const MAX_KEY_LENGTH = 200

/** What's saved on a resume, or nothing dismissed and no words if it's missing or in another shape. */
export function readCheckState(resume: Record<string, any>): CheckState {
  const check = savedOn(resume)
  return {
    dismissed: strings(check.dismissed, MAX_DISMISSED, MAX_KEY_LENGTH),
    words: strings(check.words, MAX_WORDS, MAX_WORD_LENGTH),
  }
}

/**
 * Makes a change to what's saved on a resume, and gives the value to save
 * under CHECK_FIELD, or null if nothing changed. What the change didn't touch
 * stays exactly as saved, so if two tabs change different parts at once, as
 * one dismissing a finding while the other adds a word, both are kept (see
 * mergeResume in lib/resumeStorage.ts).
 */
export function changeCheck(resume: Record<string, any>, change: (state: CheckState) => CheckState): Record<string, unknown> | null {
  const before = readCheckState(resume)
  const after = change(before)
  if (after === before) return null
  return {
    ...savedOn(resume),
    ...(after.dismissed !== before.dismissed && { dismissed: after.dismissed }),
    ...(after.words !== before.words && { words: after.words }),
  }
}

/**
 * Dismisses a finding, if it's a suggestion: fixes can't be dismissed. With
 * the latest report, dismissals that no longer match anything its rules
 * found are dropped too, so they don't pile up. The same state comes back if
 * nothing changed.
 */
export function dismiss(state: CheckState, finding: Finding, report?: Report): CheckState {
  if (finding.level !== "look" || state.dismissed.includes(finding.key)) return state
  let kept = state.dismissed
  if (report) {
    // Rules that waited or broke didn't look, so their dismissals stay.
    const ran = new Set(report.results.filter((result) => result.status === "passed" || result.status === "failed").map((result) => result.rule.id))
    const current = new Set(report.dismissed.map((dismissed) => dismissed.key))
    kept = kept.filter((key) => !ran.has(ruleOfKey(key)) || current.has(key))
  }
  return { ...state, dismissed: [...kept, finding.key].slice(-MAX_DISMISSED) }
}

/** Brings a dismissed finding back. */
export function restore(state: CheckState, key: string): CheckState {
  return state.dismissed.includes(key) ? { ...state, dismissed: state.dismissed.filter((dismissed) => dismissed !== key) } : state
}

/** Adds a word, so it isn't flagged as a typo on this resume. Case doesn't matter. */
export function addWord(state: CheckState, word: string): CheckState {
  const added = word.trim()
  if (!added || added.length > MAX_WORD_LENGTH || state.words.some((known) => known.toLowerCase() === added.toLowerCase())) {
    return state
  }
  return { ...state, words: [...state.words, added].slice(-MAX_WORDS) }
}

/** Removes an added word, whatever its case. */
export function removeWord(state: CheckState, word: string): CheckState {
  const lower = word.trim().toLowerCase()
  const words = state.words.filter((known) => known.toLowerCase() !== lower)
  return words.length === state.words.length ? state : { ...state, words }
}
