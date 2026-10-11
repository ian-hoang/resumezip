// Conservative cues for coaching, not a semantic assessment of an accomplishment.
// Numeric identifiers do not establish scope, and qualitative results need no number.

import {
  BULLET_FILLER_COUNTS,
  BULLET_GENERIC_WORDS,
  BULLET_SCOPE_NOUNS,
  BULLET_VAGUE_RESULTS,
  NUMBER_UNITS,
  NUMBER_WORDS,
  OUTCOME_WORDS,
} from "./settings"
import { escaped, opening } from "./text"
import { verbAtStart } from "./verbs"

const count = `(?:\\d[\\d,.]*(?:[kmb])?|${NUMBER_WORDS.map(escaped).join("|")})`
// "in" is too often a preposition after a year to use as an inch unit here.
const unit = NUMBER_UNITS.filter((word) => word !== "in")
  .map(escaped)
  .join("|")
const scope = BULLET_SCOPE_NOUNS.map(escaped).join("|")
const quantity = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])${count}\\s*\\+?\\s*(?:(?:${unit})|(?:[\\p{L}-]+\\s+){0,2}(?:${scope}))\\b|${count}\\s*%|[$€£]\\s*${count}`,
  "iu",
)
// A count of anything plural is scope too: "1,500 robots", "six partner
// pantries", "12 APIs". The words after a count are checked in code, as a
// case-insensitive pattern would take the "Is" of "APIs" for the -is of
// "analysis".
const countThenWords = new RegExp(`(?:^|[^\\p{L}\\p{N}])${count}\\+?\\s+([\\p{L}-]+(?:\\s+[\\p{L}-]+){0,2})`, "giu")
const NOT_PLURAL = new Set(["has", "was", "its", "always", "perhaps", "towards", "yes"])
const fillerCounts = new Set(BULLET_FILLER_COUNTS)
// Ends in -s, but not -ss, -us or -is ("process", "campus", "analysis").
const isPlural = (word: string) => /^\p{L}{2,}s$/u.test(word) && !/(?:ss|us|is)$/.test(word) && !NOT_PLURAL.has(word.toLowerCase())
// "5 meetings" or "4 tasks" says how busy someone was, not how far the work reached.
const counted = (word: string) => isPlural(word) && !fillerCounts.has(word.toLowerCase())
const countsSomething = (text: string) => [...text.matchAll(countThenWords)].some((match) => match[1].split(/\s+/).some(counted))
const changed = /\b(?:doubled|tripled|halved)\b/i

export function hasScope(text: string): boolean {
  // Strip versions, standards, dates and labeled identifiers before looking
  // for quantities. An adjacent digit alone (CSS3) never matches a quantity.
  const withoutLabels = text
    .replace(
      /\b(?:version|release|v|ISO|RFC|SOC|HTTP|WCAG|Python|Java|HTML|CSS|OAuth|Web|Windows|ticket|issue|case|ID)\s*#?\s*\d[\w.-]*/gi,
      "",
    )
    .replace(/\b\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, "")
    .replace(/\b(?:in|during|since|until|through|year)\s+(?:19|20)\d{2}\b/gi, "")
  return quantity.test(withoutLabels) || countsSomething(withoutLabels) || changed.test(withoutLabels)
}

// A change, and what came of the work. Each counts only with specific words
// after it: "Improved the code" or "Used by people" says nothing a reader can
// picture, while "Restored access to patient records" does.
const CHANGE =
  /\b(?:reduc(?:e[ds]?|ing)|increas(?:e[ds]?|ing)|improv(?:e[ds]?|ing)|restor(?:e[ds]?|ing)|resolv(?:e[ds]?|ing)|eliminat(?:e[ds]?|ing)|prevent(?:s|ed|ing)?|enabl(?:e[ds]?|ing)|unblock(?:s|ed|ing)?|cut(?:s|ting)?|sav(?:e[ds]?|ing)|grew|grow(?:s|ing)?|rais(?:e[ds]?|ing))\s+/gi
// "so its volunteers could", "allowed the clinic's nurses to": who it helped can take a few words.
const CAME_OF =
  /\b(?:adopted (?:as|by)|used by|selected (?:as|for)|so (?:that )?(?:[\w'’]+ ){1,3}could|result(?:ed|ing|s)? in|led to|allow(?:ed|s|ing) (?:[\w'’]+ ){1,3}to)\s+/gi
const vagueWords = new Set([...BULLET_GENERIC_WORDS, ...BULLET_VAGUE_RESULTS])

// How many specific words are among the few after a cue, before its clause ends.
function specificAfter(text: string, end: number): number {
  const clause = text.slice(end).split(/[,;:.()!?]/)[0]
  const words = (clause.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, OUTCOME_WORDS)
  return words.filter((word) => !vagueWords.has(word)).length
}

const cued = (text: string, cue: RegExp, least: number) =>
  [...text.matchAll(cue)].some((match) => specificAfter(text, match.index + match[0].length) >= least)

// A change needs two specific words ("Cut deploy time", "Reduced customer
// churn"), since one is usually the vague thing that changed ("Reduced bugs").
export function hasOutcome(text: string): boolean {
  return cued(text, CHANGE, 2) || cued(text, CAME_OF, 1)
}

const genericWords = new Set(BULLET_GENERIC_WORDS)

/** Only an action followed entirely by generic filler is diagnosed as lacking detail. */
export function isGenericBullet(text: string): boolean {
  // A word that looks generic may be an intentional product or code name.
  if (/["“][^"”]+["”]|`[^`]+`|(?:^|\s)['‘][^'’]+['’](?=$|[\s.,;:!?])/u.test(text)) return false
  const action = verbAtStart(text)
  if (!action) return false
  const start = opening(text)
  const at = start.toLowerCase().indexOf(action.word.toLowerCase())
  const words =
    start
      .slice(at + action.word.length)
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  return words.length === 0 || words.every((word) => genericWords.has(word) || /^\d+$/.test(word) || NUMBER_WORDS.includes(word))
}

/** Whether a bullet shows how far the work reached or what came of it, beyond naming generic work. */
export const showsImpact = (text: string) => !isGenericBullet(text) && (hasScope(text) || hasOutcome(text))
