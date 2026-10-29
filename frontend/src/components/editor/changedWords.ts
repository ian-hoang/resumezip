/** A word in a run of text, as `text.slice(start, end)`. */
export interface Word {
  start: number
  end: number
}

export const wordsIn = (text: string): Word[] =>
  [...text.matchAll(/\S+/g)].map((match) => ({ start: match.index, end: match.index + match[0].length }))

// The most words the longest-common-subsequence table is worked out for, past
// the ones that start and end both texts alike: a table of 1M cells. More is
// a new resume or template, which lights up nothing anyway (MAX_LIT).
const MAX_CELLS = 1_000_000

/**
 * Which of `after` aren't in `before`, matching the two in order as a diff
 * does, so a word moved to the next line still matches and a new copy of one
 * already there doesn't. Of two copies that could match, the first does.
 */
export function newWords(before: readonly string[], after: readonly string[]): boolean[] {
  let first = 0
  while (first < before.length && first < after.length && before[first] === after[first]) first++
  let last = 0
  while (last < before.length - first && last < after.length - first && before[before.length - 1 - last] === after[after.length - 1 - last])
    last++
  const added = after.map(() => false)
  const was = before.slice(first, before.length - last)
  const is = after.slice(first, after.length - last)
  if (was.length * is.length > MAX_CELLS) return after.map((_, index) => index >= first && index < after.length - last)
  // Longest common subsequence of the rest, from each pair of places to the end.
  const width = is.length + 1
  const common = new Uint32Array((was.length + 1) * width)
  for (let i = was.length - 1; i >= 0; i--) {
    for (let j = is.length - 1; j >= 0; j--) {
      common[i * width + j] =
        was[i] === is[j] ? common[(i + 1) * width + j + 1] + 1 : Math.max(common[(i + 1) * width + j], common[i * width + j + 1])
    }
  }
  let i = 0
  let j = 0
  while (j < is.length) {
    if (i < was.length && was[i] === is[j]) {
      i++
      j++
    } else if (i < was.length && common[(i + 1) * width + j] >= common[i * width + j + 1]) i++
    else added[first + j++] = true
  }
  return added
}
