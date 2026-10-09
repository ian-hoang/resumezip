// Helpers shared by rules that read words: the bullets with their places,
// where a text's words start, and the usual way among several of writing
// something.

import type { FieldKey, SectionName } from "@/components/editor/sections"
import type { Place } from "./places"
import type { Bullet, Entry, ResumeView } from "./resume"
import { extraKey } from "@/lib/resumeSections"

/** A bullet, the entry it's in, and its place, for pointing at it. */
export interface PlacedBullet {
  entry: Entry
  bullet: Bullet
  place: Place
}

/** Every bullet, in the order they're printed; only those in `sections`, when given. */
export function bulletsIn(resume: ResumeView, sections?: readonly SectionName[]): PlacedBullet[] {
  return resume.order
    .filter((section) => !sections || sections.includes(section))
    .flatMap((section) => resume.sections[section])
    .flatMap((entry) =>
      entry.bullets.map((bullet) => ({
        entry,
        bullet,
        place: { kind: "entry", section: entry.section, entry: entry.index, field: bullet.field, line: bullet.line } as const,
      })),
    )
}

/** Bullets with layout, independent of whether the section describes a job or a custom topic. */
export function layoutBulletsIn(resume: ResumeView): { bullet: Bullet<FieldKey | "bullets">; place: Place }[] {
  const builtin = bulletsIn(resume)
  return resume.allOrder.flatMap<{ bullet: Bullet<FieldKey | "bullets">; place: Place }>((ref) => {
    const id = extraKey(ref)
    if (id === null) return builtin.filter(({ entry }) => entry.section === ref)
    return (resume.extras[id]?.bullets ?? []).map((bullet) => ({
      bullet,
      place: { kind: "extra-text", sectionId: id, field: "bullets", line: bullet.line } as const,
    }))
  })
}

/** A text from its first letter or digit, without quotes or dashes before it. */
export const opening = (text: string) => text.replace(/^[^\p{L}\p{N}]+/u, "")

/** A text's first word, with any hyphens in it ("Co-founded"), but not the punctuation after it. */
export const firstWord = (text: string) => opening(text).match(/^[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u)?.[0] ?? ""

/** The value most of them have; on a tie, the one that comes first. */
export function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: T | undefined
  for (const [value, count] of counts) if (best === undefined || count > counts.get(best)!) best = value
  return best
}

/** Text to match as it's written, in a regular expression. */
export const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

/**
 * Whether two words are one slip apart: a letter added, dropped or changed,
 * or two side by side swapped ("TypeScirpt" for "TypeScript").
 */
export function oneSlipApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length !== b.length) {
    const [longer, shorter] = a.length > b.length ? [a, b] : [b, a]
    return longer.slice(i + 1) === shorter.slice(i)
  }
  return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
}

const VOWEL = /[aeiouy]/

/**
 * Whether `typed` reads as `right` with a slip of the keys: a letter left out
 * from inside it ("Comunication"), two side by side swapped ("Teamwrok"), a
 * letter doubled ("Marketting"), or a vowel for another ("Adaptibility").
 * Names made from words differ from them in other ways: "Canva" and
 * "Canvas", "Benchling" and "Benching", "Kanban" and "Kansan".
 */
export function typedSlip(typed: string, right: string): boolean {
  const a = typed.toLowerCase()
  const b = right.toLowerCase()
  if (!/^\p{L}+$/u.test(b) || !oneSlipApart(a, b)) return false
  let i = 0
  while (a[i] === b[i]) i++
  if (b.length > a.length) return i > 0 && i < a.length
  if (a.length > b.length) return a[i] === a[i - 1] || a[i] === a[i + 1]
  return (a[i] === b[i + 1] && a[i + 1] === b[i]) || (VOWEL.test(a[i]) && VOWEL.test(b[i]))
}
