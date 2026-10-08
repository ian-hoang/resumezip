// Finding a few words in a resume's text the way it prints: letters and
// digits only, without case or accents, so line breaks, hyphens, quotes,
// ligatures and bold marks don't count. Where they are is given back in the
// text as it was, so they can be underlined there.

/** Text as compared, and where each of its characters came from in the text as it was. */
export interface Folded {
  text: string
  /** For each character of `text`, where the character it came from starts. */
  from: number[]
  /** For each character of `text`, where the character it came from ends. */
  to: number[]
}

/** Text as compared: letters and digits only, lower case, without accents. */
export function fold(text: string): Folded {
  let folded = ""
  const from: number[] = []
  const to: number[] = []
  let at = 0
  for (const char of text) {
    const end = at + char.length
    // Upper case first, as some templates print names in capitals: "Strauß"
    // prints as "STRAUSS". "ﬁ" comes apart into "fi".
    const kept = char
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toUpperCase()
      .toLowerCase()
      .replace(/ß/g, "ss")
      .replace(/[^\p{L}\p{N}]/gu, "")
    for (let i = 0; i < kept.length; i++) {
      from.push(at)
      to.push(end)
    }
    folded += kept
    at = end
  }
  return { text: folded, from, to }
}

// Where `length` folded characters from `start` are, in `text` as it was,
// taking in the marks the quote starts or ends with where the text has them
// too, like the "%" of "by 18%" or the quotes around "team player".
function spanAt(text: string, folded: Folded, start: number, length: number, quote: string): [number, number] {
  let from = folded.from[start]
  let to = folded.to[start + length - 1]
  const before = quote.match(/^[^\p{L}\p{N}]*/u)![0].trimStart()
  const after = quote.match(/[^\p{L}\p{N}]*$/u)![0].trimEnd()
  if (before && text.slice(from - before.length, from) === before) from -= before.length
  if (after && text.slice(to, to + after.length) === after) to += after.length
  return [from, to]
}

/** Where `quote` is in `text`, as [start, end) in `text` as it was, or null. The first one. */
export function spanOf(text: string, quote: string): [number, number] | null {
  const hay = fold(text)
  const words = fold(quote).text
  if (!words) return null
  const at = hay.text.indexOf(words)
  return at === -1 ? null : spanAt(text, hay, at, words.length, quote)
}

/** What's being looked for in the printed text: a quote, in the piece of text it was taken from. */
export interface Wanted {
  piece: string
  quote: string
}

/**
 * Where each quote is in `printed`, the text of the whole resume as printed,
 * or null where it isn't. Quotes are looked for in their piece, so words that
 * are printed more than once are found where they were meant. Pieces are
 * looked for in the order given, which should be the order they're printed
 * in, each after the last one found, then anywhere, as templates print some
 * fields in another order.
 */
export function locate(printed: string, wanted: readonly Wanted[]): ([number, number] | null)[] {
  const hay = fold(printed)
  let after = 0
  return wanted.map(({ piece, quote }) => {
    const words = fold(quote).text
    if (!words) return null
    const whole = fold(piece).text
    const inPiece = whole.indexOf(words)
    if (whole && inPiece !== -1) {
      let at = hay.text.indexOf(whole, after)
      if (at === -1) at = hay.text.indexOf(whole)
      if (at !== -1) {
        after = Math.max(after, at + whole.length)
        return spanAt(printed, hay, at + inPiece, words.length, quote)
      }
    }
    // The piece isn't printed as typed: the quote wherever it's printed.
    const at = hay.text.indexOf(words)
    return at === -1 ? null : spanAt(printed, hay, at, words.length, quote)
  })
}
