// What the resume checker counts, and how much. Rule groups add their word
// lists and thresholds here too, so tuning the checker means changing this
// file only. See README.md.

/** The rubric's categories, in the order they're shown, and what each is worth in the score (100 in all). */
export const CATEGORIES = [
  { id: "contact", name: "Contact & personal details", points: 15 },
  { id: "readable", name: "Readable by hiring software", points: 15 },
  { id: "sections", name: "Sections & entries", points: 10 },
  { id: "dates", name: "Dates", points: 10 },
  { id: "bullets", name: "Bullets", points: 20 },
  { id: "length", name: "Length & layout", points: 10 },
  { id: "spelling", name: "Spelling & grammar", points: 15 },
  { id: "polish", name: "Polish", points: 5 },
] as const

export type CategoryId = (typeof CATEGORIES)[number]["id"]

/**
 * How sure a rule is. A "fix" is clearly wrong, so it can't be dismissed; a
 * "look" is a suggestion, and can be. In the score, a fix rule counts twice
 * as much as a look rule.
 */
export const LEVELS = {
  fix: { name: "Must fix", weight: 2 },
  look: { name: "Worth a look", weight: 1 },
} as const

export type Level = keyof typeof LEVELS

/** What every template guarantees, so it's always listed with the passed checks. */
export const AUTOMATIC_PASSES = [
  "Contact details are on the page itself, not in a header or footer",
  "Text reads in one order, top to bottom",
  "No tables or text boxes",
  "No images, icons or skill bars",
  "Standard fonts",
  "Real text that can be selected and copied",
  "The PDF's title is your name",
] as const

/** How many dismissed findings, and how many added words, a resume keeps. The oldest go first. */
export const MAX_DISMISSED = 500
export const MAX_WORDS = 500

/** Longer than this isn't a word, so "Add word" ignores it. */
export const MAX_WORD_LENGTH = 60
