// Words double-clicked or selected on the preview, and the field that printed
// them, so the editor can open that field with the same words selected. The
// preview's text layer is the PDF's own text, which the templates restyle
// (capitals, a "|" between fields, a hyphen where a word wraps), so it's
// compared with the typed text as `comparable` does, letters and digits only.

import { comparable } from "@/lib/check/pdf"
import type { Place } from "@/lib/check/places"

/** Words in a piece of typed text, from `start` to `end`, as printed (textsOf). */
export interface PickedWords {
  text: string
  start: number
  end: number
}

export type Picked = PickedWords & { place: Place }

// Shorter matches are too likely to be in a field they weren't printed by,
// unless they're the whole field, as a one-letter skill like "C".
const LEAST_MATCH = 4

/** Text as compared, with where each of its characters came from: `from` and `to` in `text`. */
function folded(text: string) {
  let letters = ""
  const from: number[] = []
  const to: number[] = []
  let at = 0
  for (const character of text) {
    const kept = comparable(character)
    letters += kept
    for (let i = 0; i < kept.length; i++) {
      from.push(at)
      to.push(at + character.length)
    }
    at += character.length
  }
  return { letters, from, to }
}

type Folded = ReturnType<typeof folded>

/** Characters `start` to `end` of `text` as a range of its folded letters; null when they hold none. */
function lettersIn({ from }: Folded, start: number, end: number): [number, number] | null {
  const first = from.findIndex((at) => at >= start)
  if (first === -1 || from[first] >= end) return null
  let last = first
  while (last + 1 < from.length && from[last + 1] < end) last++
  return [first, last + 1]
}

/** Folded letters `first` to `last` back as characters of the text. */
const charactersOf = ({ from, to }: Folded, first: number, last: number) => ({ start: from[first], end: to[last - 1] })

/**
 * The field that printed characters `start` to `end` of `printed`, the
 * preview's text, and where they are in that field's text. Each field is
 * matched on as much of the printed text around the words as it holds, so a
 * word in a bullet goes to that bullet, not to another field with the same
 * word. When fields match as well as each other, as a skill printed twice,
 * the n-th one printed goes to the n-th field if they're as many, and else
 * the first. `texts` are in the order they're printed (textsOf).
 */
export function pickedIn(texts: readonly { place: Place; text: string }[], printed: string, start: number, end: number): Picked | null {
  const page = folded(printed)
  const picked = lettersIn(page, start, end)
  if (!picked) return null
  const [first, last] = picked
  const words = page.letters.slice(first, last)
  let best: { length: number; left: number; right: number; ties: number[] } | null = null
  for (const [index, { text }] of texts.entries()) {
    const own = folded(text).letters
    if (!own.includes(words)) continue
    let left = first
    let right = last
    while (left > 0 && own.includes(page.letters.slice(left - 1, right))) left--
    while (right < page.letters.length && own.includes(page.letters.slice(left, right + 1))) right++
    const length = right - left
    if (length < LEAST_MATCH && length < own.length) continue
    if (!best || length > best.length) best = { length, left, right, ties: [index] }
    else if (length === best.length) best.ties.push(index)
  }
  if (!best) return null
  const match = page.letters.slice(best.left, best.right)
  let chosen = best.ties[0]
  if (best.ties.length > 1) {
    const before = occurrences(page.letters.slice(0, best.left + match.length - 1), match)
    if (occurrences(page.letters, match) === best.ties.length) chosen = best.ties[before] ?? chosen
  }
  const { place, text } = texts[chosen]
  const own = folded(text)
  const at = own.letters.indexOf(match) + (first - best.left)
  return { place, text, ...charactersOf(own, at, at + words.length) }
}

/** How many times `part` is in `text`, without overlapping. */
function occurrences(text: string, part: string): number {
  let count = 0
  for (let at = text.indexOf(part); at !== -1; at = text.indexOf(part, at + part.length)) count++
  return count
}

/**
 * Where picked words are in a field's text as the form shows it: the same
 * place if it reads the same as what was printed, or else where the words
 * first are. Null if they aren't there, as when the field has changed since.
 */
export function wordsIn(field: string, { text, start, end }: PickedWords): { start: number; end: number } | null {
  const printed = folded(text)
  const shown = folded(field)
  const picked = lettersIn(printed, start, end)
  if (!picked) return null
  const [first, last] = picked
  if (shown.letters === printed.letters) return charactersOf(shown, first, last)
  const at = shown.letters.indexOf(printed.letters.slice(first, last))
  return at === -1 ? null : charactersOf(shown, at, at + last - first)
}
