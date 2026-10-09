// Polish (P1–P7 in issue #58): small things written one way, and spaced and
// capitalized the usual way.

import type { FieldKey, SectionName } from "@/components/editor/sections"
import type { Problem, Rule } from "./engine"
import { fieldOf, LINK_FIELDS, LOCATION_FIELDS, type Place } from "./places"
import { textsOf, type ResumeView } from "./resume"
import {
  ACRONYMS,
  DEGREE_ABBREVIATIONS,
  LOWERCASE_NAMES,
  NAME_FIELDS,
  NOT_COUNTED_AFTER,
  NUMBER_LABELS,
  NUMBER_UNITS,
  NUMBER_WORDS,
  SHORTHAND,
  STATES_ALSO_COUNTRIES,
  US_STATES,
} from "./settings"
import { bulletsIn, escaped, firstWord, mostCommon, type PlacedBullet } from "./text"
import { verbOf } from "./verbs"

const capitalized = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase()

const NAME_KEYS = new Set<string | undefined>(NAME_FIELDS)
const TITLE_KEYS = new Set<string | undefined>(["workRole", "volunteerRole", "leadershipRole", "awardName", "publicationTitle"])
const namesIn = (resume: ResumeView) =>
  new Set(
    textsOf(resume)
      .filter(({ place }) => NAME_KEYS.has(fieldOf(place)))
      .flatMap(({ text }) => text.toLowerCase().match(/[\p{L}\p{N}.+-]+/gu) ?? []),
  )

// Quoted terminology and code are intentional text, not prose to copyedit.
const proseOf = (text: string) => text.replace(/`[^`]*`|“[^”]*”|"[^"]*"|‘[^’]*’|(?<!\p{L})'[^']+'(?!\p{L})|\b[\w.]+\([^)]*\)/gu, " ")

const endings: Rule = {
  id: "P1",
  category: "polish",
  advisory: true,
  level: "look",
  reads: "form",
  title: "Bullets end the same way",
  why: "Bullets that all end the same way look tidy.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    if (bullets.length < 2) return null
    const period = (text: string) => text.trimEnd().endsWith(".")
    const groups = new Map<string, typeof bullets>()
    for (const placed of bullets) {
      if (/\b(?:etc|Inc|Ltd|[A-Z])\.$/.test(placed.bullet.text)) continue
      const key = `${placed.entry.section}:${placed.entry.index}`
      groups.set(key, [...(groups.get(key) ?? []), placed])
    }
    const problems: Problem[] = []
    for (const group of groups.values()) {
      if (group.length < 2) continue
      const usual = mostCommon(group.map(({ bullet }) => period(bullet.text)))
      problems.push(
        ...group
          .filter(({ bullet }) => period(bullet.text) !== usual)
          .map(({ place }) =>
            usual
              ? {
                  place,
                  message: "No period at the end, unlike your other bullets",
                  suggestion: "Consider matching the punctuation in this entry, unless sentence structure differs.",
                }
              : {
                  place,
                  message: "Ends with a period, unlike your other bullets",
                  suggestion: "Consider matching the punctuation in this entry, unless sentence structure differs.",
                },
          ),
      )
    }
    return {
      checked: bullets.length,
      problems,
    }
  },
}

const LOWERCASE = new Set(LOWERCASE_NAMES)

const capitalStarts: Rule = {
  id: "P2",
  category: "polish",
  advisory: true,
  level: "look",
  reads: "form",
  title: "Bullets start with a capital letter",
  why: "A capital letter starts each bullet like a sentence.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    const names = namesIn(resume)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ bullet, place }) => {
        if (/^["“'‘`]/.test(bullet.text)) return []
        const word = firstWord(bullet.text)
        // "iOS" and "npm" are written that way on purpose.
        if (!/^\p{Ll}/u.test(word) || word !== word.toLowerCase() || LOWERCASE.has(word) || names.has(word)) return []
        return [{ place, message: "Starts with a lowercase letter", suggestion: `Start with “${word[0].toUpperCase()}${word.slice(1)}”.` }]
      }),
    }
  },
}

/** Something written one of two ways, where it is, and how to write it the other way. */
interface Way {
  place: Place
  way: string
  rewrite: string
}

// Written-out names that are also countries aren't counted: "Tbilisi, Georgia" may not be in the US.
const STATE_NAMES = new Map(
  US_STATES.filter(([, name]) => !STATES_ALSO_COUNTRIES.includes(name)).map(([abbreviation, name]) => [name.toLowerCase(), abbreviation]),
)
const STATE_ABBREVIATIONS = new Map(US_STATES)

// "Austin, TX" or "Austin, Texas": how each place's state is written.
function statesIn(resume: ResumeView): Way[] {
  const places: { place: Place; text: string }[] = [{ place: { kind: "profile", field: "location" }, text: resume.profile.location }]
  for (const [section, field] of Object.entries(LOCATION_FIELDS) as [SectionName, FieldKey][]) {
    for (const entry of resume.sections[section])
      places.push({ place: { kind: "entry", section, entry: entry.index, field }, text: entry.values[field] })
  }
  return places.flatMap(({ place, text }): Way[] => {
    const parts = text.split(",")
    if (parts.length < 2) return []
    const state = parts.at(-1)!.trim()
    const city = parts.slice(0, -1).join(",").trim()
    const name = STATE_ABBREVIATIONS.get(state)
    if (name) return [{ place, way: "abbreviated", rewrite: `${city}, ${name}` }]
    const abbreviation = STATE_NAMES.get(state.toLowerCase())
    return abbreviation ? [{ place, way: "written out", rewrite: `${city}, ${abbreviation}` }] : []
  })
}

const PLAIN_DEGREE = new Map(DEGREE_ABBREVIATIONS)
const DOTTED_DEGREE = new Map(DEGREE_ABBREVIATIONS.map(([dotted, plain]) => [plain, dotted]))

// "B.S." or "BS": how each degree's abbreviation is written.
function degreesIn(resume: ResumeView): Way[] {
  return resume.sections.Education.flatMap((entry): Way[] => {
    const degree = entry.values.degree
    const token = degree.match(/^[A-Za-z.]+/)?.[0] ?? ""
    const place: Place = { kind: "entry", section: "Education", entry: entry.index, field: "degree" }
    const plain = PLAIN_DEGREE.get(token)
    if (plain) return [{ place, way: "abbreviated with dots", rewrite: plain + degree.slice(token.length) }]
    const dotted = DOTTED_DEGREE.get(token)
    return dotted ? [{ place, way: "abbreviated without dots", rewrite: dotted + degree.slice(token.length) }] : []
  })
}

const oneWay: Rule = {
  id: "P3",
  category: "polish",
  advisory: true,
  level: "look",
  reads: "form",
  title: "States and degrees written one way",
  why: "Writing the same kind of thing one way looks careful.",
  check: ({ resume }) => {
    const groups = [
      { ways: statesIn(resume), what: "State", others: "your other places" },
      { ways: degreesIn(resume), what: "Degree", others: "your other degrees" },
    ]
    if (groups.every(({ ways }) => ways.length < 2)) return null
    const problems: Problem[] = []
    for (const { ways, what, others } of groups) {
      const usual = mostCommon(ways.map(({ way }) => way))
      for (const { place, way, rewrite } of ways) {
        if (way !== usual) problems.push({ place, message: `${what} ${way}, unlike ${others}`, suggestion: `Write it “${rewrite}”.` })
      }
    }
    return { checked: groups.reduce((total, { ways }) => total + ways.length, 0), problems }
  },
}

const SPACING: { pattern: RegExp; message: string; suggestion: (found: RegExpExecArray) => string }[] = [
  { pattern: /\p{L} {2}\p{L}/u, message: "Two spaces in a row", suggestion: () => "Use one space." },
  { pattern: /(\S+) +([,.;:])(?=\s|$)/, message: "A space before punctuation", suggestion: (found) => `Write “${found[1]}${found[2]}”.` },
  { pattern: /([\p{L}\p{N})]+),(\p{L}+)/u, message: "No space after a comma", suggestion: (found) => `Write “${found[1]}, ${found[2]}”.` },
  // "users.Built", but not "Node.js", "ASP.NET" or "U.S.".
  {
    pattern: /(\p{Ll}{2,})\.(\p{Lu}\p{Ll}+)/u,
    message: "No space after a period",
    suggestion: (found) => `Write “${found[1]}. ${found[2]}”.`,
  },
]

const spacing: Rule = {
  id: "P4",
  category: "polish",
  advisory: true,
  level: "look",
  reads: "form",
  title: "Clean spacing",
  why: "Even spacing can make prose easier to read.",
  check: ({ resume }) => {
    const texts = textsOf(resume).filter(({ place }) => !LINK_FIELDS.has(fieldOf(place)) && !NAME_KEYS.has(fieldOf(place)))
    if (texts.length === 0) return null
    return {
      checked: texts.length,
      // Each kind of spacing problem in a text, so all of them show at once.
      problems: texts.flatMap(({ place, text }) =>
        SPACING.flatMap(({ pattern, message, suggestion }) => {
          const found = pattern.exec(proseOf(text))
          return found ? [{ place, message, suggestion: suggestion(found) }] : []
        }),
      ),
    }
  },
}

const KNOWN_CAPITALS = new Set(ACRONYMS)

const allCaps: Rule = {
  id: "P5",
  category: "polish",
  advisory: true,
  level: "look",
  reads: "form",
  title: "Capitalization in prose",
  why: "Ordinary words are easier to read in sentence case; names and acronyms can differ.",
  check: ({ resume }) => {
    // Not the profile (a name can be in capitals on purpose), or the lists of
    // tools and courses, which are full of names written in capitals.
    const texts = textsOf(resume).filter(
      ({ place }) =>
        place.kind === "entry" &&
        place.section !== "Skills" &&
        place.field !== "coursework" &&
        !LINK_FIELDS.has(place.field) &&
        !NAME_KEYS.has(place.field) &&
        !TITLE_KEYS.has(place.field),
    )
    const names = namesIn(resume)
    if (texts.length === 0) return null
    return {
      checked: texts.length,
      problems: texts.flatMap(({ place, text }) => {
        const found = [...proseOf(text).matchAll(/\b[A-Z]{5,}\b/g)].find(
          ([word]) => !KNOWN_CAPITALS.has(word) && !names.has(word.toLowerCase()) && !/^[IVXLCDM]+$/.test(word),
        )
        if (!found) return []
        const word = found[0]
        const rewrite = found.index === 0 ? capitalized(word) : word.toLowerCase()
        return [
          {
            place,
            message: `“${word}” in capitals`,
            suggestion: `If this is ordinary prose, consider “${rewrite}”. Keep the case of names and acronyms.`,
          },
        ]
      }),
    }
  },
}

// How each kind of shorthand is found: "hr" and "yr" only in lower case ("HR"
// is a department).
function shorthandPattern(short: string): RegExp {
  if (/^(yrs?|hrs?)$/.test(short)) return new RegExp(String.raw`\b${short}\b`)
  if (short.includes("/")) return new RegExp(String.raw`(?<![\p{L}\p{N}/])${escaped(short)}(?!/)`, "iu")
  return new RegExp(String.raw`(?<!\p{L})${escaped(short)}(?!\p{L})`, "iu")
}
const SHORTHANDS = SHORTHAND.map(([short, word]) => ({ word, pattern: shorthandPattern(short) }))

const shorthand: Rule = {
  id: "P6",
  category: "polish",
  advisory: true,
  level: "look",
  reads: "form",
  title: "No shorthand like “w/” or “mgmt”",
  why: "Spelling out unfamiliar shorthand can help readers; titles, names and units can keep their usual form.",
  check: ({ resume }) => {
    // Bullets, and fields like a role or a skill ("Project Mgr"); not links.
    const texts = textsOf(resume).filter(
      ({ place }) => !LINK_FIELDS.has(fieldOf(place)) && !NAME_KEYS.has(fieldOf(place)) && !TITLE_KEYS.has(fieldOf(place)),
    )
    if (texts.length === 0) return null
    return {
      checked: texts.length,
      problems: texts.flatMap(({ place, text }) => {
        for (const { word, pattern } of SHORTHANDS) {
          const prose = proseOf(text)
          const match = pattern.exec(prose)
          const found = match?.[0].trim()
          if (!found) continue
          const before = prose.slice(0, match!.index).trimEnd()
          if (
            /^(?:hrs?|yrs?)$/.test(found) &&
            (/\d$/.test(before) || NUMBER_WORDS.includes(before.match(/\p{L}+$/u)?.[0].toLowerCase() ?? ""))
          )
            continue
          const full = /^\p{Lu}/u.test(found) ? word[0].toUpperCase() + word.slice(1) : word
          return [{ place, message: `“${found}” is shorthand`, suggestion: `Write “${full}”.` }]
        }
        return []
      }),
    }
  },
}

const WORDS_FOR = ["two", "three", "four", "five", "six", "seven", "eight", "nine"]
// Before a counted thing ("5 engineers"), but not a unit or a size ("9 ms",
// "4 million"), or a small word that shows it isn't counting ("to 6 across").
const COUNTED = String.raw`(?= (?!(?:${[...NUMBER_UNITS, ...NOT_COUNTED_AFTER].join("|")})\b)\p{Ll})`
const DIGIT = new RegExp(String.raw`(?<![\p{L}\p{N}$€£.,/-])[2-9]${COUNTED}`, "gu")
const LABELS = new Set(NUMBER_LABELS)

// The word before a number in a text.
const wordBefore = (text: string, index: number) =>
  text
    .slice(0, index)
    .trimEnd()
    .match(/[\p{L}\p{N}.-]+$/u)?.[0] ?? ""

// A digit counting something ("Led 3 engineers"), but not a version or a
// label: not after a name ("Python 2", "iOS 7", "Java 8 services"), or after
// a word like "version" or "phase". A capitalized first word is a name unless
// it's a verb.
function digitCount(text: string): string | undefined {
  for (const found of text.matchAll(DIGIT)) {
    const word = wordBefore(text, found.index)
    const first = !/\s/.test(text.slice(0, found.index).trim())
    const name = /\p{Lu}/u.test(word.slice(1)) || (/^\p{Lu}/u.test(word) && (!first || !verbOf(word)))
    if (!name && !LABELS.has(word.toLowerCase())) return found[0]
  }
}

const WORD_COUNT = new RegExp(String.raw`\b(?:${WORDS_FOR.join("|")})\b${COUNTED}`, "giu")

// A count written as a word ("five engineers"), but not a label ("phase three").
function wordCount(text: string): string | undefined {
  for (const found of text.matchAll(WORD_COUNT)) {
    if (found.index === 0) continue
    if (!LABELS.has(wordBefore(text, found.index).toLowerCase())) return found[0]
  }
}

// A count from 2 to 9, written as a digit or a word, and a percentage written
// with "%" or "percent". When nothing else on the resume says which way is
// usual, small counts go in words and percentages with "%".
const NUMBER_WAYS = [
  {
    digit: digitCount,
    word: wordCount,
    asWord: (digit: string) => WORDS_FOR[Number(digit) - 2],
    asDigit: (word: string) => String(WORDS_FOR.indexOf(word.toLowerCase()) + 2),
    elsewhere: { digit: "digits", word: "words" },
    usually: "word" as const,
  },
  {
    digit: (text: string) => /\p{N}[\p{N}.,]*\s*%/u.exec(text)?.[0],
    word: (text: string) => /\p{N}[\p{N}.,]*\s*percent\b/iu.exec(text)?.[0],
    asWord: (digit: string) => digit.replace(/\s*%/, " percent"),
    asDigit: (word: string) => word.replace(/\s*percent/i, "%"),
    elsewhere: { digit: "“%”", word: "“percent”" },
    usually: "digit" as const,
  },
]

const numbersOneWay: Rule = {
  id: "P7",
  category: "polish",
  advisory: true,
  level: "look",
  reads: "form",
  title: "Numbers written one way",
  why: "Numbers written the same way read as careful work.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    if (bullets.length < 2) return null
    const problems = new Map<string, Problem>()
    for (const ways of NUMBER_WAYS) {
      // How each bullet writes it: as a digit, as a word, or both.
      const written = bullets.flatMap((placed): (PlacedBullet & { digit?: string; word?: string })[] => {
        const digit = ways.digit(placed.bullet.text)?.trim()
        const word = ways.word(placed.bullet.text)?.trim()
        return digit || word ? [{ ...placed, digit, word }] : []
      })
      const oneWay = written
        .filter(({ digit, word }) => !digit !== !word)
        .map(({ digit }) => (digit ? ("digit" as const) : ("word" as const)))
      const usual = mostCommon(oneWay) ?? ways.usually
      for (const { place, bullet, digit, word } of written) {
        const key = `${fieldOf(place)}|${bullet.line}|${place.kind === "entry" ? `${place.section}.${place.entry}` : ""}`
        if (problems.has(key)) continue
        if (digit && word) {
          const rewrite = usual === "digit" ? ways.asDigit(word) : ways.asWord(digit)
          problems.set(key, { place, message: `“${digit}” and “${word}” in one bullet`, suggestion: `Write “${rewrite}”.` })
        } else if ((digit ? "digit" : "word") !== usual) {
          problems.set(key, {
            place,
            message: `“${digit ?? word}” here, ${ways.elsewhere[usual]} elsewhere`,
            suggestion: `Write “${digit ? ways.asWord(digit) : ways.asDigit(word!)}”.`,
          })
        }
      }
    }
    return { checked: bullets.length, problems: [...problems.values()] }
  },
}

export const POLISH_RULES: readonly Rule[] = [endings, capitalStarts, oneWay, spacing, allCaps, shorthand, numbersOneWay]
