// Runs Harper, the grammar checker, over pieces of a resume's text. The
// browser runs this in a worker (grammar.worker.ts); tests run it directly.

import { Dialect, type Lint, type Linter } from "harper.js"
import type { DialectName } from "./dialect"
import type { GrammarLint } from "./engine"
import { GRAMMAR_RULES_OFF } from "./settings"
import { oneSlipApart } from "./text"

export const HARPER_VERSION = "2.13.0"

/** Harper's slim build: its rules and an English dictionary, compiled to WebAssembly. */
export const HARPER_FILE = "dist/harper_wasm_slim_bg.wasm"
export const HARPER_CDN_URL = `https://cdn.jsdelivr.net/npm/harper.js@${HARPER_VERSION}/${HARPER_FILE}`

/** The file's SHA-256, in subresource-integrity form. harper.test.ts checks it against the installed package. */
export const HARPER_INTEGRITY = "sha256-yC2NeyZDCFurpBDRLmGmKr/caUr6jriWAw+Zkz3VjLs="

/** Harper's name for each kind of English (dialect.ts). */
export const DIALECTS: Record<DialectName, Dialect> = {
  american: Dialect.American,
  british: Dialect.British,
  australian: Dialect.Australian,
  canadian: Dialect.Canadian,
  indian: Dialect.Indian,
}

/** Turns off the rules that are wrong for resumes (GRAMMAR_RULES_OFF). */
export async function setUp(linter: Linter): Promise<void> {
  await linter.setup()
  const config = await linter.getDefaultLintConfig()
  for (const rule of GRAMMAR_RULES_OFF) if (rule in config) config[rule] = false
  await linter.setLintConfig(config)
}

// Ways a word can be built on another: "prototyped" on "prototype",
// "distilled" on "distill", "studies" on "study".
const STEMS: [RegExp, string[]][] = [
  [/ied$/, ["y"]],
  [/ies$/, ["y"]],
  [/([^aeiou])\1(ed|ing|er|ers)$/, ["$1", "$1$1"]],
  [/(ed|ing|er|ers)$/, ["", "e"]],
  [/(es|s)$/, [""]],
]

function stemsOf(word: string): string[] {
  const lower = word.toLowerCase()
  // "verifys" isn't built on "verify": that's "verifies".
  if (lower.length < 5 || /[^aeiou]ys$/.test(lower)) return []
  return STEMS.flatMap(([ending, replacements]) =>
    ending.test(lower) ? replacements.map((replacement) => lower.replace(ending, replacement)) : [],
  )
}

// Whether Harper's suggestions hold the same word spelled another way, one
// slip apart with the same ending: "occurring" for "occuring". Then the word
// is a misspelling, though the word it's built on ("occur") isn't.
const misspeltForm = (word: string, suggestions: string[]) =>
  suggestions.some((suggestion) => {
    const lower = suggestion.toLowerCase()
    return oneSlipApart(lower, word.toLowerCase()) && lower.slice(-2) === word.toLowerCase().slice(-2)
  })

/**
 * Checks pieces of text, each on its own, with `linter`. A word it flags is
 * let through when one of `others`, the other kinds of English, spells it
 * that way ("colour", "travelled", "lakh"), since a resume is written for
 * where the job is, not where the browser is. Harper's dictionary also leaves
 * out some forms of words it knows, as "prototyped", so a word is let through
 * when a word it's built on is spelled right, unless Harper offers the same
 * form spelled another way ("occurring" for "occuring").
 */
export async function lintTexts(linter: Linter, texts: readonly string[], others: readonly Linter[] = []): Promise<GrammarLint[][]> {
  const spelledRight = new Map<Linter, Map<string, boolean>>()
  const isSpelledRight = async (word: string, by = linter) => {
    const known = spelledRight.get(by) ?? new Map<string, boolean>()
    spelledRight.set(by, known)
    if (!known.has(word)) {
      const organized = await by.organizedLints(word, { language: "plaintext" })
      known.set(word, !organized.SpellCheck?.length)
      for (const lint of Object.values(organized).flat()) lint.free()
    }
    return known.get(word)!
  }
  // Whether one of the words is spelled right, and whether another English spells a word that way.
  const anySpelledRight = async (words: string[]) => {
    for (const word of words) if (await isSpelledRight(word)) return true
    return false
  }
  const otherEnglishHas = async (word: string) => {
    for (const other of others) if (await isSpelledRight(word, other)) return true
    return false
  }
  const results: GrammarLint[][] = []
  for (const text of texts) {
    const found: GrammarLint[] = []
    const organized = await linter.organizedLints(text, { language: "plaintext" })
    for (const [rule, lints] of Object.entries(organized)) {
      for (const lint of lints) {
        const read = readLint(rule, lint)
        lint.free()
        if (rule === "SpellCheck") {
          if (await otherEnglishHas(read.text)) continue
          if (!misspeltForm(read.text, read.suggestions) && (await anySpelledRight(stemsOf(read.text)))) continue
        }
        found.push(read)
      }
    }
    results.push(found.sort((a, b) => a.start - b.start))
  }
  return results
}

// A lint as plain data, to send from the worker, and since Harper's own
// objects have to be freed.
function readLint(rule: string, lint: Lint): GrammarLint {
  const suggestions = lint.suggestions()
  const span = lint.span()
  const read = {
    rule,
    kind: lint.lint_kind(),
    text: lint.get_problem_text(),
    start: span.start,
    message: lint.message(),
    suggestions: suggestions.slice(0, 3).map((suggestion) => suggestion.get_replacement_text()),
  }
  for (const suggestion of suggestions) suggestion.free()
  span.free()
  return read
}
