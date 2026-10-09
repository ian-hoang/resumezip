// Sorts the lines of a resume made somewhere else into the editor's fields.
// It reads the file the way a person would: headings start sections, dates
// and places sit beside job titles, bullets describe the entry above them.
// It's still guesswork, so the import review shows the result, and whatever
// couldn't be placed, before anything is saved.

import {
  PROFILE_FIELDS,
  SECTION_NAMES,
  SECTIONS,
  type FieldKey,
  type FieldKeyOf,
  type ProfileKey,
  type SectionName,
} from "@/components/editor/sections"
import type { CompleteContent, ResumeContent } from "@/lib/resume"
import { extraKey, resolveSections, type ExtraSections, type SectionRef } from "@/lib/resumeSections"
import { SOFT_HYPHEN, type Line, type Part } from "./lines"

/** An entry's values, keyed by its section's field names. */
type Fields = Partial<Record<FieldKey, string>>

export interface FoundEntry {
  fields: Fields
  /** Indexes of the lines it was read from. */
  lines: number[]
}

export interface FoundSection {
  name: SectionName
  entries: FoundEntry[]
}

/** A heading occurrence is an address in this file, never a durable editor ID. */
export interface FoundOccurrence {
  id: string
  heading: string
  headingLine: number
  lines: number[]
  sourceLines: number[]
  section: SectionName | null
  kind: "builtin" | "summary" | "unsupported"
}

export interface FoundExtraGroup {
  id: string
  kind: "summary"
  heading: string
  headingLine: number
  lines: number[]
  sourceLines: number[]
  text: string[]
}

export interface ParsedResume {
  /** The lines that entries' `lines` index into: the file's, with side headings split off. */
  lines: Line[]
  profile: Partial<Record<ProfileKey, string>>
  profileLines: number[]
  /** In the order they appear in the file. */
  sections: FoundSection[]
  /** Text that didn't fit anywhere, grouped under the heading it was found under. */
  unplaced: { id?: string; heading: string; headingLine?: number; lines: number[]; sourceLines?: number[]; text: string[] }[]
  occurrences?: FoundOccurrence[]
  extraGroups?: FoundExtraGroup[]
}

/** A line being parsed: its place in the file, and lines joined onto it. */
type ParseLine = Line & {
  index: number
  /** The right edge of its column: the furthest any line like it reaches. */
  margin?: number
  /** It runs to its column's edge in justified text, as every line of a paragraph but its last does. */
  full?: boolean
  merged?: number[]
}

// ---------------------------------------------------------------- patterns

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?"
const SEASON = "(?:spring|summer|fall|autumn|winter)"
const YEAR = "(?:19|20)\\d{2}"
// "06/2024" and "6/24", but not "80/20": a month written as a number is 1 to 12.
const ONE_DATE = `(?:(?:${MONTH}|${SEASON})\\s*,?\\s*(?:${YEAR}|['\u2019]\\d{2})|(?:0?[1-9]|1[0-2])\\s*/\\s*(?:${YEAR}|\\d{2})|${YEAR})`
const END_DATE = `(?:${ONE_DATE}|present|current|now|ongoing|today)`
const EXPECTED = "(?:expected|anticipated|exp\\.)"
const RANGE = `(${ONE_DATE}|${MONTH}|${SEASON})\\s*(?:-|\u2013|\u2014|\u2212|to|until)\\s*((?:${EXPECTED}\\s+)?${END_DATE})`
// Group 1: the character before the date, 2: "expected" before it, 3-4: a range's
// start and end, 5: a single date, 6: "(expected)" after it.
const DATE = new RegExp(
  `(^|[^\\w/])(?:(${EXPECTED}|graduat(?:ed|ion|ing)):?\\s+)?(?:${RANGE}|(${ONE_DATE}))(\\s*\\(${EXPECTED}\\))?(?![\\w/])`,
  "i",
)

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)|\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}(?!\d)/
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[^\s|,;)]+/i
const GITHUB_PROFILE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9-]+\/?(?![\w/.-])/i
const URL =
  /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|dev|me|org|net|co|ai|app|xyz|tech|site|page|us|ca|edu|info|so|sh|gg|design|codes|blog|cc|tv|uk|in|de)(?:\/[^\s|,;)]*)?/i

const US_STATES =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
// prettier-ignore
const PLACES = new Set(
  [
    ...US_STATES.split(" "),
    ..."ON QC BC AB MB NS NB NL PE SK UK US USA UAE".split(" "),
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming", "Ontario", "Quebec", "British Columbia", "Alberta",
    "United States", "Canada", "United Kingdom", "England", "Scotland", "Ireland", "India", "China", "Japan", "Korea",
    "South Korea", "Vietnam", "Singapore", "Australia", "New Zealand", "Germany", "France", "Spain", "Italy",
    "Netherlands", "Belgium", "Switzerland", "Sweden", "Norway", "Denmark", "Finland", "Poland", "Portugal", "Austria",
    "Israel", "Brazil", "Mexico", "Argentina", "Chile", "Colombia", "Nigeria", "Kenya", "Ghana", "South Africa",
    "Egypt", "Pakistan", "Bangladesh", "Philippines", "Indonesia", "Malaysia", "Thailand", "Taiwan", "Hong Kong",
    "Turkey", "Greece", "Czech Republic", "Romania", "Hungary", "Ukraine",
  ].map((place) => place.toLowerCase()),
)
const REMOTE = /^(?:remote|hybrid|on-?site|in-person)(?:\s*[-(,].*)?$/i
const PLACE_NAME = /^[A-Z\u00C0-\u00DE][A-Za-z\u00C0-\u024F.'\u2019\- ]{1,40}$/

/** "Austin, TX", "Toronto, Ontario, Canada", "Remote". */
function isLocation(text: string): boolean {
  if (REMOTE.test(text)) return true
  const pieces = text.split(/\s*,\s*/)
  if (pieces.length < 2 || pieces.length > 3 || !PLACE_NAME.test(pieces[0])) return false
  // "City, State", optionally followed by a country or ZIP code.
  const place = (piece: string) => PLACES.has(piece.replace(/\.$/, "").toLowerCase())
  return place(pieces[1]) && (pieces.length === 2 || place(pieces[2]) || /^\d{5}$/.test(pieces[2]))
}

/** Splits "Google, Mountain View, CA" into the text and the place at its end. */
function peelLocation(text: string): { rest: string; location: string } | null {
  const inParens = text.match(/^(.*?)\s*\(([^()]+)\)$/)
  if (inParens && isLocation(inParens[2].trim())) return { rest: inParens[1], location: inParens[2].trim() }
  const pieces = text.split(/\s*,\s*/)
  for (const size of [3, 2, 1]) {
    if (pieces.length <= size) continue
    const location = pieces.slice(-size).join(", ")
    if (isLocation(location)) return { rest: pieces.slice(0, -size).join(", "), location }
  }
  return null
}

const TITLE_WORDS =
  /\b(?:engineer(?:ing)?|developer|intern(?:ship)?|manager|analyst|assistant|associate|lead|director|designer|scientist|researcher|consultant|specialist|coordinator|president|vice|founder|co-?founder|officer|chair(?:man|person|woman)?|member|volunteer|tutor|mentor|captain|treasurer|secretary|head|representative|administrator|technician|architect|programmer|fellow|instructor|teacher|ambassador|organizer|editor|writer|owner|contractor|freelancer?|cashier|server|barista|leader|trainee|apprentice|advis[eo]r|counselor|supervisor|executive|vp|cto|ceo|cfo|coo|principal|sde|swe|sre|tester|operator|agent|clerk|receptionist|lifeguard|coach|host|ta|ra|delegate|chief|staff)\b/i
const ORG_WORDS =
  /\bco\.|\b(?:inc|llc|ltd|corp|corporation|company|labs?|laboratory|technologies|technology|systems|solutions|group|bank|foundation|association|society|club|council|hospital|center|centre|agency|department|dept|studios?|partners|capital|ventures|health|network|government|committee|organi[sz]ation|federation|union|church|ministry|museum|library|university|college|institute|school|academy|startup|consulting|software|bureau|service|services)\b/i
const SCHOOL_WORDS =
  /\b(?:university|college|institute|school|academy|polytechnic|conservatory|universit[\u00E9e]|universidad|hochschule)\b|\bU(?:C|T)\s|\bMIT\b/i
const DEGREE_WORDS =
  /\b(?:bachelor|master|associate['\u2019]?s?|doctor(?:ate)?|ph\.?\s?d|mba|m\.b\.a|diploma|certificate|degree|major|minor|honou?rs|ged|a\.?a\.?s?|b\.?\s?(?:s|a|sc|eng|e|ed|fa|tech|com|ba)\.?|m\.?\s?(?:s|a|sc|eng|ed|fa|tech|phil)\.?)(?=[\s,.:()]|$)/i
// "BSE in Computer Science", "MPH in Epidemiology": capitals matter, so this is its own pattern.
const DEGREE_ABBREVIATION = /\b(?:[BM]\.?[A-Z][A-Za-z]{0,3}\.?|Ph\.?D\.?|J\.?D\.?|M\.?D\.?|A\.?[AB]\.?|S\.?[BM]\.?|Ing\.)\s+(?:in|of)\s/
const isDegree = (text: string) => DEGREE_WORDS.test(text) || DEGREE_ABBREVIATION.test(text)
const GPA =
  /\(?\s*(?:cumulative\s+|overall\s+|major\s+)?(?:gpa|grade point average)\s*[:\-]?\s*(\d(?:\.\d{1,3})?(?:\s*\/\s*\d(?:\.\d{1,2})?)?)\s*\)?|\(?\s*(\d\.\d{1,3}\s*\/\s*[45](?:\.0{1,2})?)\s*(?:gpa)?\s*\)?/i
const LABEL =
  /^(relevant\s+)?(coursework|courses|involvements?|activities|organizations|clubs|tech(?:nologies|nical)?(?:\s+stack)?|stack|tools|built\s+with|languages)\s*:\s*/i

// ---------------------------------------------------------------- headings

type HeadingMeaning = { section: SectionName; category?: string } | { section: null; contact?: boolean }

// prettier-ignore
const HEADINGS: [HeadingMeaning, string[]][] = [
  [{ section: "Education" }, ["education", "academic background", "academics", "educational background", "education and training", "academic history", "education and certifications", "academic qualifications", "education and honors", "education and awards"]],
  [{ section: "Work" }, ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "relevant experience", "industry experience", "internships", "internship experience", "career history", "professional background", "technical experience", "research experience", "engineering experience", "software engineering experience", "work", "experiences", "professional history", "research", "teaching experience", "relevant work experience", "related experience", "additional experience", "other experience", "research and work experience", "work and research experience", "teaching", "academic experience", "positions", "research positions", "appointments", "academic appointments", "professional appointments"]],
  [{ section: "Projects" }, ["projects", "technical projects", "personal projects", "academic projects", "selected projects", "side projects", "relevant projects", "project experience", "key projects", "software projects", "project", "notable projects", "research projects", "projects and research", "software", "open source", "open source projects", "selected software", "portfolio"]],
  [{ section: "Skills" }, ["skills", "technical skills", "skills and interests", "core competencies", "technologies", "tech stack", "tools", "languages and technologies", "technical proficiencies", "skills summary", "competencies", "expertise", "skills and tools", "skills and technologies", "programming languages", "technical expertise", "relevant skills", "computer skills", "key skills", "areas of expertise", "technical toolbox", "skills and certifications", "skills and abilities", "additional skills"]],
  [{ section: "Leadership" }, ["leadership", "leadership experience", "leadership and activities", "activities", "extracurricular activities", "extracurriculars", "campus involvement", "involvement", "activities and leadership", "organizations", "leadership and involvement", "extracurricular", "campus leadership", "student organizations", "activities and involvement", "leadership and extracurriculars", "extracurricular activities and leadership", "service and leadership", "leadership and service"]],
  [{ section: "Volunteership" }, ["volunteer", "volunteering", "volunteer experience", "community service", "community involvement", "volunteer work", "community engagement", "service", "volunteer and community service", "volunteer activities"]],
  [{ section: "Awards" }, ["awards", "honors", "honors and awards", "awards and honors", "achievements", "certifications", "certificates", "awards certifications", "awards and certifications", "licenses and certifications", "accomplishments", "scholarships", "honors awards", "certifications and awards", "awards and achievements", "certification", "licenses", "honors and achievements", "awards and scholarships", "achievements and awards", "competitions", "hackathons", "fellowships", "fellowships and awards", "awards and fellowships", "grants", "grants and fellowships", "fellowships and grants", "honors and fellowships", "honors and distinctions", "distinctions", "recognition", "awards and recognition"]],
  [{ section: "Publications" }, ["publications", "selected publications", "research publications", "papers", "selected papers", "publications and presentations", "peer reviewed publications", "journal articles", "conference papers", "research papers", "publications and talks", "research and publications", "publications and research"]],
  [{ section: "Skills", category: "Languages" }, ["languages", "spoken languages", "language skills"]],
  [{ section: "Skills", category: "Interests" }, ["interests", "hobbies", "hobbies and interests", "personal interests", "interests and hobbies"]],
  [{ section: null, contact: true }, ["contact", "contact information", "contact info", "contact details", "personal information", "personal details", "personal info", "links", "personal", "details"]],
  [{ section: null }, ["summary", "professional summary", "objective", "career objective", "profile", "about", "about me", "references", "coursework", "relevant coursework", "courses", "additional information", "other", "miscellaneous", "patents", "presentations", "conferences", "talks", "memberships", "professional memberships", "affiliations", "highlights", "qualifications", "summary of qualifications", "career summary", "executive summary", "overview", "bio"]],
]
const HEADING_LOOKUP = new Map(HEADINGS.flatMap(([meaning, names]) => names.map((name) => [name, meaning] as const)))
// Letter-spaced headings can lose the gaps between their words.
const HEADING_LOOKUP_COMPACT = new Map([...HEADING_LOOKUP].map(([name, meaning]) => [name.replace(/ /g, ""), meaning] as const))
const lookupHeading = (text: string) => {
  const normal = normalizeHeading(text)
  return HEADING_LOOKUP.get(normal) ?? HEADING_LOOKUP_COMPACT.get(normal.replace(/ /g, ""))
}

/**
 * Headings it doesn't know by name, known instead by a word that says what
 * the section holds: "Clinical Experience", "Honors & Certifications",
 * "Current Employment". The first that matches wins, so "Volunteer
 * Experience" would be volunteering. Only for lines that look like the
 * headings it knows by name: an entry's title can hold these words too.
 */
const HEADING_WORDS: [HeadingMeaning, RegExp][] = [
  [{ section: "Education" }, /\b(?:education|degrees?|schooling)\b/],
  [{ section: "Publications" }, /\b(?:publications?|papers|articles)\b/],
  [{ section: "Projects" }, /\bprojects?\b/],
  [{ section: "Skills" }, /\b(?:skills|technologies|competencies|proficiencies)\b/],
  [
    { section: "Awards" },
    /\b(?:awards?|honou?rs|certifications?|certificates?|licen[cs]es?|scholarships?|fellowships?|grants|achievements|distinctions|recognition)\b/,
  ],
  [{ section: "Volunteership" }, /\b(?:volunteer\w*|community)\b/],
  [{ section: "Leadership" }, /\b(?:leadership|activities|involvement|service|extracurriculars?|organi[sz]ations)\b/],
  // Before work, so "Career Interests" are interests.
  [{ section: "Skills", category: "Interests" }, /\binterests\b/],
  [{ section: "Work" }, /\b(?:experience|employment|work|positions|internships?|teaching|appointments|career)\b/],
]

/** A heading's meaning from a word in it, keeping its own words as a skill category: "Research Interests". */
function headingByWord(text: string): HeadingMeaning | undefined {
  const meaning = HEADING_WORDS.find(([, pattern]) => pattern.test(normalizeHeading(text)))?.[0]
  return meaning && "category" in meaning ? { ...meaning, category: titleCase(tidy(text.replace(/:$/, ""))) } : meaning
}

/** "E D U C A T I O N": letter-spaced text reads as one letter (or kerned pair) per word. */
const unspace = (text: string) => {
  const tokens = text.trim().split(/\s+/)
  return tokens.length >= 4 && tokens.filter((token) => token.length <= 2).length / tokens.length >= 0.7 ? tokens.join("") : text
}

const normalizeHeading = (text: string) =>
  unspace(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const SUMMARY_HEADINGS = new Set([
  "summary",
  "professional summary",
  "objective",
  "career objective",
  "profile",
  "about",
  "about me",
  "summary of qualifications",
  "career summary",
  "executive summary",
  "overview",
  "bio",
])

const words = (text: string) => text.split(/\s+/).filter(Boolean)
const isAllCaps = (text: string) => /[A-Z]/.test(text) && !/[a-z]/.test(text) && text.replace(/[^A-Z]/g, "").length >= 3

/** Could this line be a heading at all? Short, alone on its line, not a sentence. */
function headingShaped(line: Line): boolean {
  const text = line.text.replace(/:$/, "").trim()
  return (
    !line.bullet &&
    line.parts.length === 1 &&
    text.length > 1 &&
    text.length <= 50 &&
    words(unspace(text)).length <= 6 &&
    !DATE.test(text) &&
    !EMAIL.test(text) &&
    !/[.!?,;]$/.test(text) &&
    !/^[a-z]/.test(text)
  )
}

// ---------------------------------------------------------------- helpers

const tidy = (text: string) =>
  text
    .replaceAll(SOFT_HYPHEN, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*\($/, "")
    .replace(/^\)\s*/, "")
    .replace(/^[\s|,;:\u2013\u2014\-\u2022\u00B7]+|[\s|,;:\u2013\u2014\-\u2022\u00B7]+$/g, "")
    .trim()

const bare = (url: string) =>
  url
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")

const titleCase = (text: string) =>
  isAllCaps(text)
    ? text.toLowerCase().replace(/(^|[\s\-'\u2019.])(\S)/g, (_, before, letter: string) => before + letter.toUpperCase())
    : text

interface Fragment {
  text: string
  bold: boolean
  italic: boolean
  /** The separator between this and the fragment before it, when they were one piece of text. */
  joint?: string
}

/** The style of `start`..`end` within a part, by majority of characters. */
function styleAt(part: Part, start: number, end: number): { bold: boolean; italic: boolean } {
  let bold = 0
  let italic = 0
  let total = 0
  for (const run of part.runs) {
    const overlap = Math.min(end, run.end) - Math.max(start, run.start)
    if (overlap <= 0) continue
    total += overlap
    if (run.bold) bold += overlap
    if (run.italic) italic += overlap
  }
  return { bold: total > 0 && bold / total > 0.5, italic: total > 0 && italic / total > 0.5 }
}

const SEPARATOR = /\s+[|\u2022\u00B7\u25AA\u25E6\u2013\u2014]\s+|\s+-\s+|\s*\|\s*|:\s+|\s{3,}/g

/** Splits a part at separators like " | " and " – ", keeping each piece's style. */
function fragmentsOf(part: Part): (Fragment & { start: number })[] {
  const pieces: (Fragment & { start: number })[] = []
  let start = 0
  let joint: string | undefined
  const add = (end: number) => {
    const raw = part.text.slice(start, end)
    const text = tidy(raw)
    if (text) {
      const offset = start + raw.indexOf(text.charAt(0))
      pieces.push({ text, start: offset, ...styleAt(part, offset, offset + text.length), joint })
    }
  }
  for (const match of part.text.matchAll(SEPARATOR)) {
    // "(UF in Japan: CCED)": a separator inside brackets is part of what's in them.
    const before = part.text.slice(0, match.index)
    if ((before.match(/[([]/g)?.length ?? 0) > (before.match(/[)\]]/g)?.length ?? 0)) continue
    add(match.index!)
    start = match.index! + match[0].length
    joint = match[0]
  }
  add(part.text.length)
  return pieces
}

interface FoundDate {
  text: string
  start: string
  end: string
}

function findDate(text: string): (FoundDate & { index: number; length: number }) | null {
  const match = DATE.exec(text)
  if (!match) return null
  const index = match.index + match[1].length
  const whole = match[0].slice(match[1].length)
  const start = match[3] ? tidy(match[3]) : ""
  // Keep "Expected" as written: before the date or as "(Expected)" after it.
  let end = tidy(match[4] ?? match[5] ?? "")
  if (match[2] && /expect|anticipat|exp\./i.test(match[2])) end = `${match[2]} ${end}`
  if (match[6]) end = `${end} ${match[6].trim()}`
  return { text: tidy(whole), start, end, index, length: whole.length }
}

const hasDate = (line: Line) => DATE.test(line.text)

const CUT_DATE = new RegExp(`${ONE_DATE}\\s*(?:-|\u2013|\u2014|to)\\s*(?:${MONTH}|${SEASON})?\\s*$`, "i")
const YEAR_FIRST = /^(?:(?:19|20)\d{2}|present|current|now)\b/i

/** Joins a date range that wrapped onto the next line back together. */
function joinWrappedDates(lines: ParseLine[]): ParseLine[] {
  const joined: ParseLine[] = []
  for (const line of lines) {
    const above = joined[joined.length - 1]
    const cut = above ? above.parts.findIndex((part) => CUT_DATE.test(part.text)) : -1
    const rest = cut >= 0 ? line.parts.findIndex((part) => Math.abs(part.x - above.parts[cut].x) < 3 && YEAR_FIRST.test(part.text)) : -1
    if (above && rest >= 0 && line.page === above.page) {
      const year = line.parts[rest].text.match(YEAR_FIRST)![0]
      const abovePart = above.parts[cut]
      const aboveParts = above.parts.map((part, i) => (i === cut ? { ...abovePart, text: `${abovePart.text} ${year}` } : part))
      joined[joined.length - 1] = {
        ...above,
        parts: aboveParts,
        text: aboveParts.map((part) => part.text).join(" "),
        merged: [...(above.merged ?? []), line.index],
      }
      const left = line.parts[rest].text.slice(year.length).trim()
      const parts = line.parts.flatMap((part, i) => (i !== rest ? [part] : left ? [{ ...part, text: left, runs: [] }] : []))
      if (parts.length > 0) {
        joined.push({ ...line, parts, text: parts.map((part) => part.text).join(" "), left: parts[0].x, x: parts[0].x })
      }
      continue
    }
    joined.push(line)
  }
  return joined
}

// ---------------------------------------------------------------- entries

/** A stretch of text in one style. */
interface Piece {
  text: string
  bold: boolean
  italic: boolean
}

interface Item {
  text: string
  /** The same text in plain, bold and italic pieces, for marking styled words in the editor. */
  pieces: Piece[]
  lines: number[]
  /** For wrapped lines: where the item's text starts and ends up. */
  left: number
  x: number
  size: number
}

interface Group {
  header: ParseLine[]
  body: Item[]
}

/** Wrapped text lines up with the text above it, not with its bullet. */
function continues(line: ParseLine, item: Item, wasBullet: boolean, above: ParseLine | undefined): boolean {
  if (line.page === undefined || line.bullet) return false
  if (datesEntry(line, above && item.lines.includes(above.index) ? above : undefined)) return false
  if (wasBullet) return line.left > item.left + 1 && line.x <= Math.max(item.x, item.left + 3 * item.size) + 4
  // A paragraph carries on after a full stop when the line above ran to the edge of justified text.
  const afterFull = above !== undefined && item.lines.includes(above.index) && above.full === true
  return Math.abs(line.x - item.x) <= 3 && (!/[.!?]$/.test(item.text) || /^[a-z]/.test(line.text) || afterFull)
}

/**
 * A wrapped line joined onto the one above: a word a soft hyphen broke in two
 * joins back up, and so does a link or "and/or" that broke after a slash.
 */
const joinWrapped = (text: string, next: string) =>
  text.endsWith(SOFT_HYPHEN)
    ? text.slice(0, -1) + next
    : (/\w-$/.test(text) && /^[a-z]/.test(next)) || /\w\/$/.test(text)
      ? text + next
      : `${text} ${next}`

/** Adds text in a style, merged into the piece before when the style is the same. */
function addPiece(pieces: Piece[], text: string, bold: boolean, italic: boolean) {
  if (!text) return
  const last = pieces[pieces.length - 1]
  if (last && last.bold === bold && last.italic === italic) last.text += text
  else pieces.push({ text, bold, italic })
}

/** A line's text in plain, bold and italic pieces, joined the way `line.text` is. */
function stylePieces(line: Line): Piece[] {
  const pieces: Piece[] = []
  line.parts.forEach((part, index) => {
    // The space between parts takes the style before it, so a styled phrase stays in one piece.
    const last = pieces[pieces.length - 1]
    if (index > 0) addPiece(pieces, " ", last?.bold ?? false, last?.italic ?? false)
    let cursor = 0
    for (const run of [...part.runs].sort((a, b) => a.start - b.start)) {
      addPiece(pieces, part.text.slice(cursor, Math.max(cursor, run.start)), false, false)
      addPiece(pieces, part.text.slice(Math.max(cursor, run.start), run.end), run.bold, run.italic)
      cursor = Math.max(cursor, run.end)
    }
    addPiece(pieces, part.text.slice(cursor), false, false)
  })
  return pieces
}

/** Adds a wrapped line to the item above it. */
function extendItem(item: Item, line: ParseLine) {
  const soft = item.text.endsWith(SOFT_HYPHEN)
  const together = soft || (/\w-$/.test(item.text) && /^[a-z]/.test(line.text))
  item.text = joinWrapped(item.text, line.text)
  const last = item.pieces[item.pieces.length - 1]
  if (soft && last) last.text = last.text.replace(/\u00AD$/, "")
  if (!together) addPiece(item.pieces, " ", last?.bold ?? false, last?.italic ?? false)
  for (const piece of stylePieces(line)) addPiece(item.pieces, piece.text, piece.bold, piece.italic)
  item.lines.push(line.index)
}

const hasWords = (text: string) => /[\p{L}\p{N}]/u.test(text)

/**
 * An item as a bullet, with its bold and italic words in the editor's marks
 * (**bold**, *italic*, ***both***), so keywords set in bold or italic inside
 * a bullet stay that way. A style the whole item is in isn't marked.
 */
function described(item: Item): string {
  const words = item.pieces.filter((piece) => hasWords(piece.text))
  const allBold = words.every((piece) => piece.bold)
  const allItalic = words.every((piece) => piece.italic)
  return item.pieces
    .map(({ text, bold, italic }) => {
      const strong = bold && !allBold
      const emph = italic && !allItalic
      if ((!strong && !emph) || !hasWords(text)) return text
      const marker = strong && emph ? "***" : strong ? "**" : "*"
      // Marks hug the words, with any spaces outside them.
      const [, before, core, after] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!
      return `${before}${marker}${core}${marker}${after}`
    })
    .join("")
}

/**
 * A long line that reads like a sentence, not an entry's title. A title can
 * be long too, but has a few words set apart on its right: a GPA, a place.
 */
const sentence = (line: ParseLine) =>
  !line.bold &&
  !hasDate(line) &&
  ((line.text.length > 85 && !setApartOnRight(line)) || (/[.!?]$/.test(line.text) && words(line.text).length >= 4) || line.full === true)

const setApartOnRight = (line: Line) => line.parts.length > 1 && words(line.parts[line.parts.length - 1].text).length <= 5

/** The style a line starts in ("**President** | ACM"), which is what tells entry titles apart. */
const leadStyle = (line: Line) => {
  const run = line.parts[0].runs[0]
  return run ? { bold: run.bold, italic: run.italic } : { bold: false, italic: false }
}

const dateOnly = (text: string) => {
  const date = findDate(text)
  return date !== null && tidy(text.replace(date.text, "")) === ""
}

/** Where a line's text starts, after any column of dates on its left. */
const textStart = (line: Line) => (line.parts.find((part) => !dateOnly(part.text)) ?? line.parts[0]).x

/** A line with only a place, a date or a link on it, which belongs to the title above. */
const detailOnly = (line: Line) => {
  const isDetail = (value: string) => {
    const text = value.trim()
    const url = text.match(URL)
    return isLocation(text) || (url !== null && url[0].length === text.length) || dateOnly(text)
  }
  // Each side on its own: "UNIVERSITY OF MICHIGAN    Ann Arbor, MI" is a name with its
  // place, even though the whole line reads like a long place name.
  return line.parts.length > 1 ? line.parts.every((part) => isDetail(part.text)) : isDetail(line.text)
}

const sameStyle = (a: Line, b: Line) => {
  const [x, y] = [leadStyle(a), leadStyle(b)]
  return x.bold === y.bold && x.italic === y.italic && Math.abs(a.size - b.size) < 0.5 && Math.abs(a.left - b.left) < 4
}

/** Whether `next`'s first word didn't fit at the end of `line`, so `next` may be `line` wrapping. */
function wrapsInto(line: ParseLine, next: ParseLine): boolean {
  if (!line.box || !next.box || line.margin === undefined || line.page !== next.page) return false
  const charWidth = (next.box[2] - next.box[0]) / Math.max(next.text.length, 1)
  const word = next.text.split(/\s+/)[0] ?? ""
  // Generous: digits and capitals run wider than the line's average letter.
  return line.box[2] + (word.length + 1) * charWidth * 1.15 >= line.margin - 2
}

/**
 * Prose as it was written rather than as it was printed: a line that ran to
 * its column's edge is joined back up with the line it wrapped onto, so each
 * line here is one the person typed (or a bullet). Word files have no
 * wrapping to undo.
 */
function unwrapped(lines: ParseLine[]): string[] {
  const written: string[] = []
  lines.forEach((line, i) => {
    if (i > 0 && !line.bullet && wrapsInto(lines[i - 1], line))
      written[written.length - 1] = joinWrapped(written[written.length - 1], line.text)
    else written.push(line.text)
  })
  return written.map(tidy).filter(Boolean)
}

/** A date laid out the way an entry's is: set apart from the rest of its line, or alone on it. */
const datedLikeTitle = (line: Line) => (line.parts.length > 1 ? hasDate(line) : dateOnly(line.text))

/**
 * A date on a line usually starts a new entry. A year in running text
 * doesn't, when the line above ran out of room for its first word ("…for
 * the" then "2027 American Solar Challenge"), unless it's laid out the way
 * an entry's date is. Only running text runs out of room: a title with its
 * place or date set at the right edge reaches it on purpose.
 */
const datesEntry = (line: ParseLine, above: ParseLine | undefined) =>
  hasDate(line) && (datedLikeTitle(line) || above === undefined || above.parts.length > 1 || !wrapsInto(above, line))

const CONNECTOR =
  /(?:[,;:&/\u00AD-]|\b(?:and|or|of|in|for|the|a|an|at|with|to|by|on|from|into|using|via|across|through|as|including|such|than|while|that|which))$/i

/** Joins a line onto the end of the one before it. */
function mergeLines(a: ParseLine, b: ParseLine): ParseLine {
  const end = a.parts[a.parts.length - 1]
  const shift = end.text.length + 1
  const joined: Part = {
    ...end,
    text: `${end.text} ${b.parts[0].text}`,
    runs: [...end.runs, ...b.parts[0].runs.map((run) => ({ ...run, start: run.start + shift, end: run.end + shift }))],
  }
  const parts = [...a.parts.slice(0, -1), joined, ...b.parts.slice(1)]
  return {
    ...a,
    parts,
    text: parts.map((part) => part.text).join(" "),
    links: [...a.links, ...b.links],
    merged: [...(a.merged ?? []), b.index, ...(b.merged ?? [])],
  }
}

/**
 * Whether `line` carries on a detail line ("Relevant Coursework: ...") that
 * was cut off mid-list: it starts at the same left edge, without the indent a
 * bullet's text has, and in the style the line above ended in.
 */
function detailCarriesOn(line: ParseLine, item: Item, above: ParseLine): boolean {
  const end = item.pieces[item.pieces.length - 1]
  const start = leadStyle(line)
  return (
    !line.bullet &&
    line.parts.length === 1 &&
    line.page === above.page &&
    item.lines.includes(above.index) &&
    Math.abs(line.left - item.left) < 3 &&
    start.bold === Boolean(end?.bold) &&
    start.italic === Boolean(end?.italic) &&
    (CONNECTOR.test(item.text) || above.full === true)
  )
}

/**
 * Splits a section into entries: one or more title lines (role, company,
 * dates, place) followed by bullets.
 */
function groupEntries(lines: ParseLine[], isBody: (line: Line) => boolean = () => false): Group[] {
  const groups: Group[] = []
  let lastWasBullet = false
  let lastWasDetail = false
  let previous: ParseLine | undefined

  for (const line of lines) {
    const group: Group | undefined = groups[groups.length - 1]
    const last: Item | undefined = group?.body[group.body.length - 1]
    const item: Item = { text: line.text, pieces: stylePieces(line), lines: [line.index], left: line.left, x: line.x, size: line.size }
    const before = previous
    previous = line
    const wasDetail: boolean = lastWasDetail
    lastWasDetail = false

    // Text wrapping under a bullet lines up with the bullet's text.
    if (last && lastWasBullet && continues(line, last, true, before)) {
      extendItem(last, line)
      lastWasDetail = wasDetail
      continue
    }
    if (last && wasDetail && before && !isBody(line) && detailCarriesOn(line, last, before)) {
      extendItem(last, line)
      lastWasDetail = true
      continue
    }

    // Without bullets, descriptions are set in from their entry's title, and
    // a line that ran to the right edge carries on in the next.
    const title = group?.header[0]
    if (!line.bullet && title && line.page !== undefined && line.left >= textStart(title) + 6 && !datesEntry(line, before)) {
      // A new point usually starts with a capital; wrapped text rarely does unless the line before ended mid-phrase.
      const wrapped = before && wrapsInto(before, line) && (!/^[A-Z]/.test(line.text) || CONNECTOR.test(before.text))
      if (last && before && wrapped && last.lines.includes(before.index) && Math.abs(line.left - before.left) < 3) {
        extendItem(last, line)
      } else {
        group!.body.push(item)
      }
      lastWasBullet = false
      continue
    }

    if (line.bullet || (group && isBody(line))) {
      if (group) group.body.push(item)
      else groups.push({ header: [], body: [item] })
      lastWasBullet = true
      lastWasDetail = !line.bullet
      continue
    }
    if (last && !lastWasBullet && continues(line, last, false, before)) {
      extendItem(last, line)
      continue
    }
    if (group && group.header.length > 0 && sentence(line)) {
      group.body.push(item)
      lastWasBullet = false
      continue
    }

    lastWasBullet = false
    const header = group?.header ?? []
    const first = header[0]
    // A title line that wrapped: "Bachelor of Arts in Computer Science," then "Minor in Business".
    const lastTitle = group && group.body.length === 0 ? header[header.length - 1] : undefined
    if (
      lastTitle &&
      (!hasDate(lastTitle) || (CUT_DATE.test(lastTitle.text) && YEAR_FIRST.test(line.text))) &&
      sameStyle(lastTitle, line) &&
      (wrapsInto(lastTitle, line) || CONNECTOR.test(lastTitle.text) || /^[a-z(]/.test(line.text))
    ) {
      header[header.length - 1] = mergeLines(lastTitle, line)
      continue
    }
    const startsNew =
      !group ||
      group.body.length > 0 ||
      (detailOnly(line) ? false : header.length >= 3) ||
      (header.some(hasDate) && hasDate(line)) ||
      (first !== undefined && !detailOnly(line) && (header.some(hasDate) || header.length >= 2) && sameStyle(first, line))
    if (startsNew) groups.push({ header: [line], body: [] })
    else group.header.push(line)
  }
  return groups
}

interface Header {
  texts: Fragment[]
  date: FoundDate | null
  /** Dates besides `date`. An entry has one date field, so these go to "Couldn't place". */
  otherDates: string[]
  location: string
  links: string[]
}

/**
 * A title too long for its column wraps, leaving its first words on a line of
 * their own above the rest of the row. Joins them back, if the line above
 * starts where the column does, looks the same and nearly fills it.
 */
function joinWrappedTitles(lines: Line[]): Line[] {
  const joined: Line[] = []
  for (const line of lines) {
    const above = joined[joined.length - 1]
    if (above?.box && above.parts.length === 1 && line.parts.length >= 2 && !DATE.test(above.text)) {
      const [first, next] = line.parts
      const [a, b] = [leadStyle(above), leadStyle(line)]
      const column = next.x - first.x
      if (Math.abs(above.parts[0].x - first.x) < 3 && a.bold === b.bold && a.italic === b.italic && above.box[2] >= next.x - column * 0.4) {
        const shift = above.parts[0].text.length + 1
        const part = {
          ...first,
          text: `${above.parts[0].text} ${first.text}`,
          runs: [...above.parts[0].runs, ...first.runs.map((run) => ({ ...run, start: run.start + shift, end: run.end + shift }))],
        }
        const parts = [part, ...line.parts.slice(1)]
        joined[joined.length - 1] = { ...line, parts, text: parts.map((p) => p.text).join(" "), links: [...above.links, ...line.links] }
        continue
      }
    }
    joined.push(line)
  }
  return joined
}

/** Pulls the dates, place and links out of an entry's title lines, leaving the other bits of text. */
function readHeader(lines: Line[], remove: RegExp[] = []): Header {
  const header: Header = { texts: [], date: null, otherDates: [], location: "", links: [] }
  const joined = joinWrappedTitles(lines)
  const without = (text: string) => remove.reduce((rest, pattern) => rest.replace(new RegExp(pattern.source, "gi"), " "), text)
  // A date set apart on its own, like one on the right edge, is the entry's.
  // A year inside other text ("Sprout – HackGT 2026") is then part of a name,
  // and stays in it.
  const datedApart = joined.some((line) => line.parts.some((part) => dateOnly(without(part.text))))
  for (const line of joined) {
    header.links.push(...line.links)
    for (const part of line.parts) {
      // Dates and links come out first, since their dashes and dots aren't
      // separators. Blanking them keeps the text's style offsets in place.
      let text = part.text
      const blank = (index: number, length: number) => {
        text = text.slice(0, index) + " ".repeat(length) + text.slice(index + length)
      }
      for (const pattern of remove) {
        for (const match of text.matchAll(new RegExp(pattern.source, "gi"))) blank(match.index!, match[0].length)
      }
      const apart = dateOnly(text)
      for (let date = findDate(text); date && (apart || !datedApart); date = findDate(text)) {
        if (header.date) header.otherDates.push(date.text)
        else header.date = date
        blank(date.index, date.length)
      }
      for (const url of text.matchAll(new RegExp(URL.source, "gi"))) {
        // A bare domain is only a link when the line links to it, so "Code.org" can be a name.
        const linked = line.links.some((link) => bare(link).toLowerCase() === bare(url[0]).toLowerCase())
        if (url[0].includes("/") || /^(?:https?:|www\.)/i.test(url[0]) || linked) {
          header.links.push(url[0])
          blank(url.index!, url[0].length)
        }
      }
      // Whether the last fragment of this part is in `texts`, for joining back up to.
      let follows = false
      for (const fragment of fragmentsOf({ ...part, text })) {
        let value = fragment.text
        const joint = follows ? fragment.joint : undefined
        follows = false
        if (!/[A-Za-z0-9\u00C0-\u024F]/.test(value)) continue
        if (!header.location && isLocation(value)) {
          header.location = value
          continue
        }
        const peeled = header.location ? null : peelLocation(value)
        if (peeled) {
          header.location = peeled.location
          value = peeled.rest
        }
        if (value) {
          header.texts.push({ ...fragment, text: value, joint })
          follows = !peeled
        }
      }
    }
  }
  return header
}

const score = (text: string, pattern: RegExp) => (text.match(new RegExp(pattern.source, "gi")) ?? []).length

/**
 * Above zero for job titles, below for organizations. The last word counts
 * double. A word that usually names an organization is part of a title when
 * it says what the title word after it does: "Software Engineer", "Lab Manager".
 */
function titleScore(text: string): number {
  const all = words(text)
  const last = all[all.length - 1] ?? ""
  const acronym = /^[A-Z0-9&.]{2,6}$/.test(text) ? 1 : 0
  const orgWords = all.filter((word, i) => ORG_WORDS.test(word) && !TITLE_WORDS.test(all[i + 1] ?? "")).length
  return score(text, TITLE_WORDS) + Number(TITLE_WORDS.test(last)) - orgWords - Number(ORG_WORDS.test(last)) - acronym
}

/**
 * "Physician Shadowing – Cardiology": a title split at a dash, when that
 * leaves more pieces than a role and an organization, goes back together.
 * Split from the end, so a subtitle rejoins the title it follows.
 */
function joinDashed(texts: Fragment[]): Fragment[] {
  const joined = [...texts]
  for (let i = joined.length - 1; i > 0 && joined.length > 2; i--) {
    const { joint } = joined[i]
    if (joint && /^\s+[-\u2013\u2014]\s+$/.test(joint))
      joined.splice(i - 1, 2, { ...joined[i - 1], text: `${joined[i - 1].text}${joint}${joined[i].text}` })
  }
  return joined
}

/** Whether an entry's role came before its organization, and how much more title-like it scored. */
interface RoleCall {
  roleFirst: boolean
  margin: number
}

/**
 * Where an entry's role and organization were told apart: at a comma ("Vice-President, BoilerHacks"),
 * or at a dash or colon between them. A role split off at a dash that holds a comma itself
 * ("Lead TA, ME 3410 - Robot Kinematics") may have been meant to split there instead: `atComma`.
 */
interface SplitCall {
  at: "comma" | "dash"
  /** Whether the scores were clear about it. */
  clear: boolean
  role: string
  atComma?: { role: string; org: string }
}

const DASH_OR_COLON = /^(?:\s+[-\u2013\u2014]\s+|:\s+)$/

/** Decides which bit of text is the job title and which is the organization. */
function roleAndOrg(pieces: Fragment[]): { role: string; org: string; rest: string[]; call?: RoleCall; split?: SplitCall } {
  const texts = joinDashed(pieces)
  if (texts.length === 0) return { role: "", org: "", rest: [] }
  if (texts.length === 1) {
    const text = texts[0].text
    const at = text.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i)
    if (at) return { role: at[1], org: at[2], rest: [] }
    const comma = text.split(/\s*,\s+/)
    if (comma.length === 2) {
      const [a, b] = comma
      const aTitle = titleScore(a)
      const bTitle = titleScore(b)
      if (aTitle > 0 && bTitle <= 0) return { role: a, org: b, rest: [], split: { at: "comma", clear: true, role: a } }
      if (bTitle > 0 && aTitle <= 0) return { role: b, org: a, rest: [], split: { at: "comma", clear: true, role: b } }
    }
    return titleScore(text) > 0 ? { role: text, org: "", rest: [] } : { role: "", org: text, rest: [] }
  }
  // Score each piece as a title; the best is the role, the least title-like of the rest the organization.
  const ranked = texts.map((fragment, order) => ({
    text: fragment.text,
    order,
    title: titleScore(fragment.text),
  }))
  const role = [...ranked].sort((a, b) => b.title - a.title || a.order - b.order)[0]
  const others = ranked.filter((item) => item !== role)
  const org = [...others].sort((a, b) => a.title - b.title || a.order - b.order)[0]
  // Role and organization split apart at a dash or colon between them.
  const [first, second] = role.order < org.order ? [role, org] : [org, role]
  const joint = texts[second.order].joint
  let split: SplitCall | undefined
  if (second.order === first.order + 1 && joint && DASH_OR_COLON.test(joint)) {
    split = { at: "dash", clear: role.title - org.title > CLOSE_CALL, role: role.text }
    const [before, ...after] = role.text.split(/,\s+/)
    if (role === first && after.length && titleScore(before) > 0 && titleScore(after.join(", ")) <= 0) {
      split.atComma = { role: before, org: `${after.join(", ")}${joint}${org.text}` }
    }
  }
  return {
    role: role.text,
    org: org.text,
    rest: others.filter((item) => item !== org).map((item) => item.text),
    call: { roleFirst: role.order < org.order, margin: role.title - org.title },
    split,
  }
}

/** A role that scores this much more title-like than its organization, or less, is a close call. */
const CLOSE_CALL = 1

type ExperienceName = keyof typeof EXPERIENCE_FIELDS

/**
 * People set every entry out the same way, so a close call between role and
 * organization goes the way the other entries went: those in its own
 * section, or for a tie with none there to go by, those in the rest of the
 * resume, which may set its entries out another way. Only entries whose
 * scores weren't tied count. A tie goes their way with one to go by; a call
 * a point apart takes two, since its scores lean the right way more often
 * than not. With fewer, or ones that disagree, it stays as it was.
 */
function followOtherEntries(sections: { name: ExperienceName; calls: Map<FoundEntry, RoleCall> }[]) {
  const all = sections.flatMap(({ calls }) => [...calls.values()])
  for (const { name, calls } of sections) {
    const keys = EXPERIENCE_FIELDS[name]
    for (const [entry, call] of calls) {
      if (call.margin > CLOSE_CALL) continue
      const voters = (from: RoleCall[]) => from.filter((other) => other !== call && other.margin > 0)
      const own = voters([...calls.values()])
      const others = own.length > 0 || call.margin > 0 ? own : voters(all)
      const roleFirst = others.filter((other) => other.roleFirst).length
      const orgFirst = others.length - roleFirst
      const needed = call.margin + 1
      const order =
        roleFirst >= needed && roleFirst >= 2 * orgFirst ? true : orgFirst >= needed && orgFirst >= 2 * roleFirst ? false : undefined
      if (order === undefined || order === call.roleFirst) continue
      ;[entry.fields[keys.role], entry.fields[keys.org]] = [entry.fields[keys.org], entry.fields[keys.role]]
    }
  }
}

/**
 * "Lead TA, ME 3410 - Robot Kinematics" splits at the dash unless the resume
 * shows it puts commas between roles and organizations: clearly, on two
 * entries or more, and at least twice as often as dashes. Then it splits at
 * the comma, the dash being part of the organization's name.
 */
function followCommas(sections: { name: ExperienceName; splits: Map<FoundEntry, SplitCall> }[]) {
  const all = sections.flatMap(({ splits }) => [...splits.values()])
  const commas = all.filter((split) => split.at === "comma" && split.clear).length
  const dashes = all.filter((split) => split.at === "dash" && split.clear && !split.atComma).length
  if (commas < 2 || commas < 2 * dashes) return
  for (const { name, splits } of sections) {
    const keys = EXPERIENCE_FIELDS[name]
    for (const [entry, split] of splits) {
      // Left alone if a close call already swapped it.
      if (!split.atComma || entry.fields[keys.role] !== split.role) continue
      entry.fields[keys.role] = split.atComma.role
      entry.fields[keys.org] = split.atComma.org
    }
  }
}

/** "• one\n• two", the editor's format for bullets. */
const bulletField = (items: string[]) =>
  items
    .map((item) => tidy(item))
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join("\n")

const linesOf = (group: Group) => [
  ...group.header.flatMap((line) => [line.index, ...(line.merged ?? [])]),
  ...group.body.flatMap((item) => item.lines),
]

// ---------------------------------------------------------------- sections

interface SectionResult {
  entries: FoundEntry[]
  leftover: { lines: number[]; text: string[] }
  /** How each entry's role and organization were told apart, where they had to be. */
  calls?: Map<FoundEntry, RoleCall>
  splits?: Map<FoundEntry, SplitCall>
}

// prettier-ignore
const EXPERIENCE_FIELDS: {
  [Section in "Work" | "Leadership" | "Volunteership"]: Record<"role" | "org" | "location" | "start" | "end" | "bullets", FieldKeyOf<Section>>
} = {
  Work: { role: "workRole", org: "companyName", location: "workLocation", start: "workStartDate", end: "workEndDate", bullets: "workDescription" },
  Leadership: { role: "leadershipRole", org: "leadershipOrg", location: "leadershipLocation", start: "leadershipStartDate", end: "leadershipEndDate", bullets: "leadershipDescription" },
  Volunteership: { role: "volunteerRole", org: "volunteerOrg", location: "volunteerLocation", start: "volunteerStartDate", end: "volunteerEndDate", bullets: "volunteerDescription" },
}

function blankEntry(name: SectionName): Fields {
  return Object.fromEntries(SECTIONS[name].fields.map((field) => [field.key, ""]))
}

/**
 * Where entries' text starts when their dates are in a column on the left
 * ("2023 – 2025   Lead TA, …"), or undefined when they aren't.
 */
function dateColumnEnd(lines: Line[]): number | undefined {
  const counts = new Map<number, number>()
  for (const line of lines) {
    if (line.parts.length < 2 || !dateOnly(line.parts[0].text)) continue
    const start = Math.round(line.parts[1].x)
    counts.set(start, (counts.get(start) ?? 0) + 1)
  }
  const [end, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? []
  return count !== undefined && count >= 2 ? end : undefined
}

/**
 * "Teaching", "Mentoring": a few words alone in the column of dates, with no
 * date of their own, head the entries below them and have no field to go in.
 */
function subHeadingsBesideDates(lines: ParseLine[]): Set<ParseLine> {
  const end = dateColumnEnd(lines)
  if (end === undefined) return new Set()
  return new Set(
    lines.filter(
      (line) =>
        line.box !== undefined &&
        line.box[2] < end &&
        line.parts.length === 1 &&
        !hasDate(line) &&
        !isLocation(line.text) &&
        words(line.text).length <= 4,
    ),
  )
}

/**
 * In a CV with its dates in a column on the left, a line with something
 * else in that column, neither a date nor a place ("Purdue Univ.", beside a
 * paragraph about students mentored), doesn't start an entry and isn't part
 * of the one above. It has no field to go in, nor do the lines it wraps
 * onto, set at the column's edge, up to the next line in the column.
 */
function besideDatesWithoutOne(lines: ParseLine[]): ParseLine[][] {
  const end = dateColumnEnd(lines)
  if (end === undefined) return []
  const found: ParseLine[][] = []
  let current: ParseLine[] | undefined
  for (const line of lines) {
    const [first, second] = line.parts
    if (second && Math.abs(second.x - end) <= 3 && !DATE.test(first.text) && !isLocation(first.text)) {
      current = [line]
      found.push(current)
    } else if (current && !line.bullet && Math.abs(line.left - end) <= 3) {
      current.push(line)
    } else {
      current = undefined
    }
  }
  return found
}

/**
 * "Lab Manager & Instructional Staff", then a department or two, each on a
 * short line of its own under the organization, before the bullets: the
 * first is the role, the rest have no field. Without bullets after them,
 * short lines are as likely the description itself, so they're left be.
 */
function titleLines(body: Item[], isBullet: (item: Item) => boolean): Item[] {
  const lines: Item[] = []
  for (const item of body) {
    if (isBullet(item)) return lines
    if (item.lines.length > 1 || words(item.text).length > 8 || /[.!?;:,]$/.test(item.text)) return []
    lines.push(item)
  }
  return []
}

function readExperience(name: ExperienceName, lines: ParseLine[]): SectionResult {
  const keys = EXPERIENCE_FIELDS[name]
  const leftover: SectionResult["leftover"] = { lines: [], text: [] }
  const calls = new Map<FoundEntry, RoleCall>()
  const splits = new Map<FoundEntry, SplitCall>()
  const bullets = new Set(lines.filter((line) => line.bullet).map((line) => line.index))
  const subHeadings = subHeadingsBesideDates(lines)
  for (const line of subHeadings) {
    leftover.lines.push(line.index)
    leftover.text.push(line.text)
  }
  const besideNoDate = besideDatesWithoutOne(lines)
  for (const block of besideNoDate) {
    leftover.lines.push(...block.map((line) => line.index))
    leftover.text.push(tidy(block.map((line) => line.text).reduce(joinWrapped)))
  }
  const setAside = new Set([...subHeadings, ...besideNoDate.flat()])
  const entries = groupEntries(lines.filter((line) => !setAside.has(line))).map((group) => {
    const header = readHeader(group.header)
    const { role, org, rest, call, split } = roleAndOrg(header.texts)
    const fields = blankEntry(name)
    // An organization with no role over it may have its role on a line below.
    const below = !role && org ? titleLines(group.body, (item) => bullets.has(item.lines[0])) : []
    const body = group.body.slice(below.length)
    fields[keys.role] = below.length ? tidy(below[0].text) : role
    fields[keys.org] = org
    fields[keys.location] = header.location
    fields[keys.start] = header.date?.start ?? ""
    fields[keys.end] = header.date?.end ?? ""
    fields[keys.bullets] = bulletField(body.map(described))
    if (rest.length || header.otherDates.length) {
      leftover.lines.push(...group.header.map((line) => line.index))
      leftover.text.push(...rest, ...header.otherDates)
    }
    if (below.length > 1) {
      leftover.lines.push(...below.slice(1).flatMap((item) => item.lines))
      leftover.text.push(...below.slice(1).map((item) => tidy(item.text)))
    }
    const entry = { fields, lines: linesOf(group) }
    if (call) calls.set(entry, call)
    if (split) splits.set(entry, split)
    return entry
  })
  return { entries, leftover, calls, splits }
}

/** "B.S. in Biology, Stanford University" is a degree and a school. */
function splitDegreeAndSchool(fragment: Fragment): Fragment[] {
  const pieces = fragment.text.split(/\s*,\s+/)
  if (pieces.length < 2) return [fragment]
  const at = pieces.findIndex((piece) => SCHOOL_WORDS.test(piece) && !isDegree(piece))
  if (at < 0 || !pieces.some((piece, i) => i !== at && isDegree(piece))) return [fragment]
  if (at === 0)
    return [
      { ...fragment, text: pieces[0] },
      { ...fragment, text: pieces.slice(1).join(", ") },
    ]
  if (at === pieces.length - 1)
    return [
      { ...fragment, text: pieces.slice(0, -1).join(", ") },
      { ...fragment, text: pieces[at] },
    ]
  return [fragment]
}

/**
 * "Advisor: Prof. Reyes", "Thesis: …": a detail under a label of a word or
 * two. Not a degree ("Bachelor of Science: …"), a school, or a date ("Expected: …").
 */
function detailLabel(text: string): boolean {
  const label = text.match(/^([A-Z][a-z]+(?: [A-Za-z][a-z]+){0,2}):\s/)?.[1]
  return label !== undefined && !isDegree(label) && !SCHOOL_WORDS.test(label) && !/^(?:expected|anticipated|graduat|gpa)/i.test(label)
}

function readEducation(lines: ParseLine[]): SectionResult {
  const leftover: SectionResult["leftover"] = { lines: [], text: [] }
  // "Relevant Coursework: ...", "GPA: ..." and "Advisor: ..." lines are details of the school above.
  const details = (line: Line) => LABEL.test(line.text) || /^(?:cumulative\s+)?gpa\b/i.test(line.text) || detailLabel(line.text)
  let schoolAbove: { name: string; location: string; left: number } | undefined
  const entries = groupEntries(lines, details).map((group) => {
    const fields = blankEntry("Education")
    // The GPA can be anywhere: "(GPA: 3.9)", "GPA 3.9/4.0", "3.8/4.0".
    for (const line of [...group.header, ...group.body]) {
      const gpa = line.text.match(GPA)
      if (gpa) {
        fields.gpa = (gpa[1] ?? gpa[2]).replace(/\s+/g, "")
        break
      }
    }
    const withoutGpa = (text: string) => tidy(text.replace(GPA, " ").replace(/\(\s*\)/g, ""))
    const header = readHeader(group.header, [GPA])
    const texts = header.texts.flatMap(splitDegreeAndSchool)

    // "High School Diploma" mentions a school but is a degree.
    const isSchool = (text: string) => SCHOOL_WORDS.test(text) && !isDegree(text)
    let schoolIndex = texts.findIndex((fragment) => isSchool(fragment.text))
    if (schoolIndex < 0) schoolIndex = texts.findIndex((fragment) => SCHOOL_WORDS.test(fragment.text))
    const degreeIndex = texts.findIndex((fragment, i) => i !== schoolIndex && isDegree(fragment.text))
    let school = schoolIndex >= 0 ? texts[schoolIndex].text : ""
    let degree = degreeIndex >= 0 ? texts[degreeIndex].text : ""
    const rest = texts.filter((_, i) => i !== schoolIndex && i !== degreeIndex).map((fragment) => fragment.text)
    if (!school && rest.length) school = rest.shift()!
    if (!degree && rest.length) degree = rest.shift()!
    // Degrees listed under one school: one set in under the school's line,
    // with no school of its own, is that school's.
    const start = group.header[0]
    if (school && start) schoolAbove = { name: school, location: header.location, left: start.left }
    else if (degree && start && schoolAbove && start.left > schoolAbove.left + 3) {
      school = schoolAbove.name
      header.location ||= schoolAbove.location
    }
    fields.schoolName = school
    fields.degree = degree
    fields.schoolLocation = header.location
    fields.schoolStartDate = header.date?.start ?? ""
    fields.schoolEndDate = header.date?.end ?? ""

    const other: string[] = [...rest, ...header.otherDates]
    for (const item of group.body) {
      const text = withoutGpa(item.text)
      const label = text.match(LABEL)
      if (label && /course/i.test(label[2])) fields.coursework = tidy(text.slice(label[0].length))
      else if (label && /involve|activit|organi|club/i.test(label[2])) fields.involvement = tidy(text.slice(label[0].length))
      else if (text) other.push(text)
    }
    if (other.length) {
      leftover.lines.push(...linesOf(group))
      leftover.text.push(...other)
    }
    return { fields, lines: linesOf(group) }
  })
  return { entries, leftover }
}

function readProjects(lines: ParseLine[]): SectionResult {
  const leftover: SectionResult["leftover"] = { lines: [], text: [] }
  const entries = groupEntries(lines).map((group) => {
    const fields = blankEntry("Projects")
    const header = readHeader(group.header)
    const texts = header.texts.map((fragment) => fragment.text)
    let name = texts[0] ?? ""
    let tech = texts.slice(1).join(", ")
    // "Gitlytics (React, Flask)"
    const parens = name.match(/^(.+?)\s*\(([^)]*,[^)]*)\)$/)
    if (!tech && parens) {
      name = parens[1]
      tech = parens[2]
    }
    const bullets: string[] = []
    for (const item of group.body) {
      const label = item.text.match(LABEL)
      if (label && /tech|stack|tools|built|languages/i.test(label[2]) && !tech) tech = tidy(item.text.slice(label[0].length))
      else bullets.push(described(item))
    }
    fields.projectName = tidy(name.replace(/:$/, ""))
    fields.techStack = tidy(tech)
    fields.projectDate = header.date?.text ?? ""
    for (const link of header.links) {
      const url = bare(link)
      if (/^github\.com\/[^/]+\/[^/]+/i.test(url) && !fields.projectGithub) fields.projectGithub = url
      else if (!/^github\.com/i.test(url) && !url.includes("@") && !fields.additionalLink) fields.additionalLink = url
    }
    fields.projectDescription = bulletField(bullets)
    if (header.otherDates.length) {
      leftover.lines.push(...group.header.map((line) => line.index))
      leftover.text.push(...header.otherDates)
    }
    return { fields, lines: linesOf(group) }
  })
  return { entries, leftover }
}

// ---------------------------------------------------------------- publications

const NUMBERED = /^\s*(?:\[\d+\]|\d+[.)])\s+/
// Abbreviations that end in a full stop without ending a sentence.
// prettier-ignore
const ABBREVIATIONS = new Set(["proc", "conf", "vol", "no", "pp", "int", "trans", "eds", "ed", "inc", "dept", "univ", "st", "jr", "sr", "dr", "vs"])

/** Splits "A. Smith, B. Lee. Title. Venue" into its sentences, without splitting at initials. */
function sentencesOf(text: string): string[] {
  const pieces: string[] = []
  let start = 0
  for (const match of text.matchAll(/\.\s+(?=[A-Z0-9À-Þ"“(])/g)) {
    const before =
      text
        .slice(start, match.index)
        .split(/[\s,]+/)
        .pop() ?? ""
    if (/^[A-ZÀ-Þ]$/.test(before) || ABBREVIATIONS.has(before.toLowerCase())) continue
    // "et al." keeps its full stop; it ends the authors.
    pieces.push(text.slice(start, match.index) + (/\bet al$/.test(text.slice(start, match.index)) ? "." : ""))
    start = match.index! + match[0].length
  }
  pieces.push(text.slice(start).replace(/\.\s*$/, (end) => (/\bet al\.\s*$/.test(text) ? end : "")))
  return pieces.map(tidy).filter(Boolean)
}

/** "J. Ryan, A. Smith", "Ryan et al.", "Jake Ryan and Ann Smith". */
function looksLikeAuthors(text: string): boolean {
  if (/\bet al\b/i.test(text) || /\b[A-ZÀ-Þ]\.\s?(?:[A-ZÀ-Þ]\.\s?)*[A-ZÀ-Þ][a-zß-ÿ]/.test(text)) return true
  const names = text.split(/\s*,\s*|\s+and\s+|\s*&\s*/).filter(Boolean)
  return names.length >= 2 && names.every((name) => words(name).length <= 4 && /^[A-ZÀ-Þ]/.test(name))
}

/** Fills title, authors and venue from bits of text, the title being the first bit that isn't authors. */
function publicationFields(pieces: string[], fields: Fields) {
  const rest = [...pieces]
  if (rest.length > 1 && looksLikeAuthors(rest[0])) fields.publicationAuthors = rest.shift()!
  fields.publicationTitle = rest.shift() ?? ""
  const authors = fields.publicationAuthors ? -1 : rest.findIndex(looksLikeAuthors)
  if (authors >= 0) fields.publicationAuthors = rest.splice(authors, 1)[0]
  fields.publicationVenue = rest.join(". ")
}

/** Tidies what's left of a citation once pieces are cut out: no doubled or dangling commas. */
const tidyCitation = (text: string) => tidy(text.replace(/(\s*,\s*)+/g, ", ").replace(/^[\s,.;:]+|[\s,.;:]+$/g, ""))

/**
 * Without italics to mark it, a venue runs to the first comma after the
 * title ("Senior Design Project, School of Engineering, …", "IEEE Trans.
 * Robotics, vol. 5, …"), unless that comma is in a short list in the
 * venue's name: "Fairness, Accountability, and Transparency".
 */
function venueAndDetails(after: string): { venue: string; details: string } {
  const pieces = after.split(/,\s+/)
  const ends = pieces.findIndex((piece, i) => i > 0 && /^(?:and|or|&)\s/i.test(piece))
  const list = ends > 0 && ends <= 4 && pieces.slice(1, ends + 1).every((piece) => words(piece).length <= 3)
  const end = list ? ends + 1 : 1
  return { venue: pieces.slice(0, end).join(", "), details: tidyCitation(pieces.slice(end).join(", ")) }
}

/**
 * "[1] A. Smith, B. Lee. Title of the paper. NeurIPS 2025.", or IEEE style:
 * "[1] A. Smith and B. Lee, “Title,” Venue, City, 2025, doi: 10.1/x."
 * `italics` is the citation's italic text, which in IEEE style is the venue.
 */
function readCitation(text: string, italics: string[] = []): Fields {
  const fields = blankEntry("Publications")
  let rest = text.replace(NUMBERED, "")
  // Links come out before the date, since DOIs and URLs often hold a year
  // ("10.1109/CVPR.2016.90").
  const doi = rest.match(/\bdoi:\s*(10\.\d{4,9}\/\S+)/i)
  if (doi) {
    fields.publicationLink = `doi.org/${doi[1].replace(/[.,;]$/, "")}`
    rest = rest.replace(doi[0], " ")
  }
  const link = fields.publicationLink ? null : rest.match(new RegExp(`(?:https?://|doi\\.org/|www\\.)\\S+|${URL.source}`, "i"))
  if (link && (link[0].includes("/") || /^www\./i.test(link[0]))) {
    fields.publicationLink = bare(link[0].replace(/[.,;]$/, ""))
    rest = rest.replace(link[0], " ")
  }
  // The year usually comes last; a year in a title shouldn't count.
  let date: ReturnType<typeof findDate> = null
  for (let found = findDate(rest), offset = 0; found;) {
    date = { ...found, index: found.index + offset }
    offset = date.index + date.length
    found = findDate(rest.slice(offset))
  }
  if (date) {
    fields.publicationDate = date.text
    rest = rest.slice(0, date.index) + " " + rest.slice(date.index + date.length)
  }
  const quoted = rest.match(/["“]([^"”]+)["”]/)
  if (quoted) {
    fields.publicationTitle = tidy(quoted[1])
    // Authors keep a closing full stop ("et al."), just not the comma before the title.
    fields.publicationAuthors = tidy(rest.slice(0, quoted.index)).replace(/[\s,;:]+$/, "")
    const after = tidyCitation(rest.slice(quoted.index! + quoted[0].length).replace(/^[.,]\s*(?:in:?\s+)?/i, ""))
    // The venue is in italics; anything else left over (a city, pages) is detail.
    const venue = italics.map(tidy).find((italic) => italic.length > 2 && after.includes(italic))
    if (venue) {
      fields.publicationVenue = venue
      fields.publicationDetails = tidyCitation(after.replace(venue, " "))
    } else {
      const split = venueAndDetails(after)
      fields.publicationVenue = split.venue
      fields.publicationDetails = split.details
    }
    return fields
  }
  publicationFields(sentencesOf(tidy(rest.replace(/\s+([.,])/g, "$1"))), fields)
  return fields
}

/**
 * Publications come either as citations, one per bullet or number, or laid
 * out like other entries: the title and date, then authors and venue below.
 */
function readPublications(section: ParseLine[]): SectionResult {
  const leftover: SectionResult["leftover"] = { lines: [], text: [] }
  const startsCitation = (line: Line) => line.bullet || NUMBERED.test(line.text)
  // Sub-headings over groups of citations ("Conference", "Thesis"): a few
  // words in bold or italic, just before a citation.
  const label = (line: ParseLine, i: number) =>
    !startsCitation(line) &&
    section[i + 1] !== undefined &&
    startsCitation(section[i + 1]) &&
    (line.bold || line.italic) &&
    words(line.text).length <= 4 &&
    !/[.,;:]$/.test(line.text)
  const lines = section.filter((line, i) => !label(line, i))
  // Citations that wrap are set in under the line they start on, so every
  // other line sits right of the bullet or number above it.
  let start: ParseLine | undefined
  const hanging = lines.every((line) => {
    if (startsCitation(line)) start = line
    else if (!start || line.left <= start.left + 3) return false
    return true
  })
  const citations = lines.filter(startsCitation).length >= lines.length / 2 || (hanging && lines.filter(startsCitation).length >= 2)
  if (citations) {
    // The sub-headings label groups, which a citation has no field for.
    for (const line of section) {
      if (lines.includes(line)) continue
      leftover.lines.push(line.index)
      leftover.text.push(line.text)
    }
    const items: { text: string; lines: number[]; x: number; italics: string[] }[] = []
    for (const line of lines) {
      const last = items[items.length - 1]
      const starts = line.bullet || NUMBERED.test(line.text) || !last || line.x <= last.x - 3
      // Italic runs, joined with the one before when it carries on from the end of the line above.
      const italics = line.parts.flatMap((part) =>
        part.runs
          .filter((run) => run.italic)
          .map((run) => ({ text: part.text.slice(run.start, run.end), start: run.start === 0 && part === line.parts[0] })),
      )
      if (starts) items.push({ text: line.text, lines: [line.index], x: line.x, italics: italics.map((italic) => italic.text) })
      else {
        if (italics[0]?.start && last.italics.length && last.text.trimEnd().endsWith(last.italics[last.italics.length - 1].trim())) {
          last.italics[last.italics.length - 1] = joinWrapped(last.italics[last.italics.length - 1], italics.shift()!.text)
        }
        last.italics.push(...italics.map((italic) => italic.text))
        last.text = joinWrapped(last.text, line.text)
        last.lines.push(line.index)
      }
    }
    return { entries: items.map((item) => ({ fields: readCitation(item.text, item.italics), lines: item.lines })), leftover }
  }

  const entries = groupEntries(section).map((group) => {
    const fields = blankEntry("Publications")
    const header = readHeader(group.header)
    fields.publicationDate = header.date?.text ?? ""
    const link = header.links.find((url) => !/^mailto:/i.test(url))
    if (link) fields.publicationLink = bare(link)
    // Publications have no descriptions, so a line of names under the title is the authors.
    const authors = group.body.filter((item) => looksLikeAuthors(item.text))
    const rest = group.body.filter((item) => !authors.includes(item))
    // A line like "J. Ryan, A. Smith. NeurIPS" holds both the authors and the venue.
    publicationFields([...header.texts.map((fragment) => fragment.text), ...authors.map((item) => item.text)].flatMap(sentencesOf), fields)
    if (header.otherDates.length) {
      leftover.lines.push(...group.header.map((line) => line.index))
      leftover.text.push(...header.otherDates)
    }
    if (rest.length) {
      leftover.lines.push(...rest.flatMap((item) => item.lines))
      leftover.text.push(...rest.map((item) => item.text))
    }
    return { fields, lines: linesOf(group) }
  })
  return { entries, leftover }
}

function readSkills(lines: ParseLine[], category?: string): SectionResult {
  const entries: FoundEntry[] = []
  if (category) {
    const text = lines.reduce(
      (joined, line, i) =>
        i === 0
          ? line.text
          : joined.endsWith(SOFT_HYPHEN)
            ? joinWrapped(joined, line.text)
            : `${joined}${/,$/.test(joined) ? "" : ", "}${line.text}`,
      "",
    )
    return {
      entries: [{ fields: { skillName: category, skillDetails: tidy(text) }, lines: lines.map((line) => line.index) }],
      leftover: { lines: [], text: [] },
    }
  }
  lines.forEach((line, i) => {
    const last = entries[entries.length - 1]
    const next = lines[i + 1]
    if (!line.bullet && !line.text.includes(":") && words(line.text).length <= 4 && leadStyle(line).bold && next && !leadStyle(next).bold) {
      entries.push({ fields: { skillName: line.text, skillDetails: "" }, lines: [line.index] })
      return
    }
    // "Languages: Java, Python", or a table with the category in its first cell.
    const colon = line.text.match(/^([^:]{1,40}):\s*(.*)$/)
    const name =
      colon && words(colon[1]).length <= 5
        ? colon[1]
        : line.parts.length > 1 && words(line.parts[0].text).length <= 4
          ? line.parts[0].text
          : ""
    const details =
      colon && name === colon[1]
        ? colon[2]
        : name
          ? line.parts
              .slice(1)
              .map((part) => part.text)
              .join(" ")
          : line.text
    if (!name && last && !line.bullet) {
      // Wrapped from the line above.
      last.fields.skillDetails = joinWrapped(last.fields.skillDetails ?? "", details).trim()
      last.lines.push(line.index)
      return
    }
    entries.push({ fields: { skillName: name, skillDetails: details }, lines: [line.index] })
  })
  for (const entry of entries) {
    entry.fields.skillName = tidy(entry.fields.skillName ?? "")
    entry.fields.skillDetails = tidy(entry.fields.skillDetails ?? "")
  }
  return { entries, leftover: { lines: [], text: [] } }
}

/**
 * Groups lines into blocks wherever the space above a line is clearly more
 * than the closest spacing. Null when spacing is even or every block would be a single line.
 */
function blocksBySpacing(lines: ParseLine[]): ParseLine[][] | null {
  if (lines.length < 3 || lines.some((line) => !line.box || line.bullet)) return null
  const gaps = lines.slice(1).map((line, i) => (line.page === lines[i].page ? line.box![1] - lines[i].box![3] : Infinity))
  const finite = gaps.filter(Number.isFinite).sort((a, b) => a - b)
  if (finite.length < 2) return null
  const threshold = finite[0] + Math.max(2, 0.3 * lines[0].size)
  const blocks: ParseLine[][] = [[lines[0]]]
  gaps.forEach((gap, i) => (gap > threshold ? blocks.push([lines[i + 1]]) : blocks[blocks.length - 1].push(lines[i + 1])))
  return blocks.length > 1 && blocks.some((block) => block.length > 1) ? blocks : null
}

/** A line about an award ("Awarded to the team while serving as its lead."): a sentence, not part of a name. */
const aboutAward = (line: Line) => !line.bold && words(line.text).length >= 6 && (/[.!?]$/.test(line.text) || line.text.length > 60)

function readAwards(lines: ParseLine[]): SectionResult {
  const leftover: SectionResult["leftover"] = { lines: [], text: [] }
  const keepOtherDates = (header: Header, from: ParseLine[]) => {
    if (header.otherDates.length === 0) return
    leftover.lines.push(...from.map((line) => line.index))
    leftover.text.push(...header.otherDates)
  }
  const blocks = blocksBySpacing(lines)
  if (blocks) {
    const entries = blocks.map((all) => {
      // A line about the award, and what follows it, has no field to go in.
      const about = all.findIndex((line, i) => i > 0 && aboutAward(line))
      const block = about > 0 ? all.slice(0, about) : all
      if (about > 0) {
        leftover.lines.push(...all.slice(about).map((line) => line.index))
        leftover.text.push(
          all
            .slice(about)
            .map((line) => line.text)
            .reduce(joinWrapped),
        )
      }
      const header = readHeader(block)
      keepOtherDates(header, block)
      return {
        fields: {
          awardName: header.texts[0]?.text ?? "",
          awardOrg: header.texts
            .slice(1)
            .map((fragment) => fragment.text)
            .join(", "),
          awardDate: header.date?.text ?? "",
        },
        lines: block.flatMap((line) => [line.index, ...(line.merged ?? [])]),
      }
    })
    return { entries, leftover }
  }
  const entries: FoundEntry[] = []
  let describing = false
  for (const line of lines) {
    const last = entries[entries.length - 1]
    const wraps = last !== undefined && !line.bullet && (/^[a-z]/.test(line.text) || line.left > (lines[0]?.left ?? 0) + 4)
    // A line about the award has no field to go in, nor do the lines it wraps onto.
    if (wraps && (describing || (!hasDate(line) && aboutAward(line)))) {
      if (describing) leftover.text[leftover.text.length - 1] = joinWrapped(leftover.text[leftover.text.length - 1], line.text)
      else leftover.text.push(line.text)
      leftover.lines.push(line.index)
      describing = true
      continue
    }
    describing = false
    // A date on a line of its own goes with the award above it.
    const date = findDate(line.text)
    if (last && !last.fields.awardDate && date && tidy(line.text.replace(date.text, "")) === "") {
      last.fields.awardDate = date.text
      last.lines.push(line.index)
      continue
    }
    if (last && !line.bullet && !hasDate(line) && (/^[a-z]/.test(line.text) || line.left > (lines[0]?.left ?? 0) + 4)) {
      last.fields.awardName = tidy(joinWrapped(last.fields.awardName ?? "", line.text))
      last.lines.push(line.index)
      continue
    }
    const header = readHeader([line])
    keepOtherDates(header, [line])
    let name = header.texts[0]?.text ?? ""
    let org = header.texts
      .slice(1)
      .map((fragment) => fragment.text)
      .join(", ")
    const comma = name.indexOf(", ")
    if (!org && comma > 0) {
      // "**Name**, Organization": the name is the bold text before the comma.
      const first = name.slice(0, comma)
      const second = name.slice(comma + 2)
      const part = line.parts.find((candidate) => candidate.text.includes(name))
      const at = part ? part.text.indexOf(name) : -1
      const boldName = part && at >= 0 && styleAt(part, at, at + comma).bold && !styleAt(part, at + comma + 2, at + name.length).bold
      const plain = part && part.runs.every((run) => run.bold === part.runs[0].bold && run.italic === part.runs[0].italic)
      if (boldName || (plain && /^[A-Z0-9]/.test(second) && words(second).length <= 6)) {
        name = first
        org = second
      }
    }
    entries.push({
      fields: { awardName: tidy(name), awardOrg: tidy(org), awardDate: header.date?.text ?? "" },
      lines: [line.index],
    })
  }
  return { entries: entries.filter((entry) => entry.fields.awardName || entry.fields.awardOrg), leftover }
}

const lineIndexes = (line: ParseLine) => [line.index, ...(line.merged ?? [])]

// ---------------------------------------------------------------- profile

function looksLikeName(text: string): boolean {
  const parts = words(text)
  return (
    parts.length >= 2 &&
    parts.length <= 5 &&
    text.length <= 40 &&
    !/\d|@|\/|:/.test(text) &&
    parts.every((word) => /^[A-Z\u00C0-\u024F]/.test(word) || /^(?:de|da|del|van|von|der|la|le|bin|al)$/.test(word)) &&
    !lookupHeading(text)
  )
}

interface Contacts {
  fields: Partial<Record<ProfileKey, string>>
  lines: number[]
  /** Lines that were only contact details. */
  used: Set<number>
  /** What's left of lines that mixed contact details with other text. */
  remainders: Map<number, string>
}

/** A link to a web page, with https:// or written without it, not tel: or sms:. */
const WEB_LINK = /^(?:https?:\/\/|(?![a-z][a-z0-9+.-]*:))/i

// Labels in front of contact details, including short ones with a colon ("P: 555-0100", "E: me@x.com").
const CONTACT_LABEL =
  /\b(?:(?:e-?mail|phone|mobile|cell|tel|telephone|linkedin|github|website|portfolio|web|site|address)\s*:?|(?:p|ph|m|t|e)\s*:)/gi

function readContacts(lines: ParseLine[], isTop: (line: ParseLine) => boolean): Contacts {
  const fields: Contacts["fields"] = {}
  const result: Contacts = { fields, lines: [], used: new Set(), remainders: new Map() }

  for (const line of lines) {
    const inHeader = isTop(line)
    let text = line.text
    let found = false
    const take = (key: ProfileKey, value: string, match?: string) => {
      if (!fields[key]) fields[key] = value
      if (match) text = text.replace(match, " ")
      found = true
    }

    for (const link of line.links) {
      if (/^mailto:/i.test(link)) take("email", bare(link))
      else if (LINKEDIN.test(link)) take("linkedin", bare(link))
      else if (GITHUB_PROFILE.test(link) && /^(?:https?:\/\/)?(?:www\.)?github\.com\/[^/]+\/?$/i.test(link))
        take("profileGithub", bare(link))
      // A website is a web address: not a phone number's tel: link.
      else if (inHeader && WEB_LINK.test(link) && !/github\.com\/[^/]+\/[^/]+/i.test(link)) take("personalWebsite", bare(link))
    }
    const email = text.match(EMAIL)
    if (email) take("email", email[0], email[0])
    const linkedin = text.match(LINKEDIN)
    if (linkedin) take("linkedin", bare(linkedin[0]), linkedin[0])
    const github = text.match(GITHUB_PROFILE)
    if (github) take("profileGithub", bare(github[0]), github[0])
    if (inHeader || /^(?:\+|\(|\d)/.test(text.trim())) {
      const phone = text.match(PHONE)
      if (phone && !DATE.test(phone[0])) {
        // A plus written apart from the number ("+ (352) 284-0205") is still part of it.
        const plus = text.slice(0, phone.index).match(/\+\s*$/)
        const number = (plus ? plus[0] : "") + phone[0]
        take("phoneNumber", number.trim(), number)
      }
    }
    if (inHeader) {
      const url = text.match(URL)
      if (url && !/github\.com\/[^/]+\/[^/]+/i.test(url[0])) take("personalWebsite", bare(url[0]), url[0])
    }

    // A place among the contact details: "Austin, TX | 512-555-0100 | ...".
    if (inHeader && !fields.location) {
      const pieces = [...line.parts.map((part) => part.text), ...text.split(/\s*[|\u2022\u00B7\u25AA]\s*|\s{2,}/)]
      const place = pieces.map(tidy).find((piece) => piece !== "" && isLocation(piece) && text.includes(piece))
      if (place) take("location", place, place)
    }

    // Link text broken across lines ("github.com/" then "mjalvarez") is part of the link.
    if (inHeader && line.links.length) {
      const targets = line.links.map((link) => bare(link).toLowerCase())
      for (const token of text.split(/[\s|\u2022\u00B7\u25AA,]+/)) {
        const piece = token.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
        if (piece.length >= 3 && targets.some((target) => target.includes(piece))) {
          text = text.replace(token, " ")
          found = true
        }
      }
    }
    if (!found) continue
    result.lines.push(line.index)
    // Link text like "LinkedIn" or "Portfolio" with the address behind it.
    const left = tidy(text.replace(CONTACT_LABEL, " ").replace(/\s*[|\u2022\u00B7\u25AA,]\s*/g, " "))
    if (!left || !inHeader) {
      if (!left) result.used.add(line.index)
    } else {
      result.remainders.set(line.index, left)
    }
  }
  // Link text alone ("LinkedIn | GitHub") leaves nothing behind.
  for (const [index, left] of result.remainders) {
    if (!left.replace(/\b(?:linkedin|github|portfolio|website|email|resume|cv)\b/gi, "").trim()) {
      result.remainders.delete(index)
      result.used.add(index)
    }
  }
  return result
}

// ---------------------------------------------------------------- the whole resume

function bodySize(lines: Line[]): number {
  const counts = new Map<number, number>()
  for (const line of lines) {
    const size = Math.round(line.size * 2) / 2
    counts.set(size, (counts.get(size) ?? 0) + line.text.length)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11
}

/**
 * Some layouts put each section's heading in a margin column, on the same
 * line as the section's first entry. Splits such lines in two.
 */
export type SourceLine = Line & { sourceIndex: number }

function splitSideHeadings(lines: SourceLine[]): SourceLine[] {
  const candidate = (line: Line) =>
    line.parts.length > 1 &&
    !line.bullet &&
    lookupHeading(line.parts[0].text) !== undefined &&
    words(line.parts[0].text).length <= 4 &&
    line.parts[1].x - line.parts[0].x >= 40
  // Only when the margin holds nothing but headings: a column of dates or
  // skill categories ("Languages", "Tools") can look the same.
  const sides = lines.filter(candidate)
  if (sides.length < 2) return lines
  const margin = sides[0].parts[0].x
  const others = lines.filter((line) => line.parts.length > 1 && Math.abs(line.parts[0].x - margin) < 3 && !candidate(line))
  if (others.length > 0 || sides.some((line) => Math.abs(line.parts[0].x - margin) >= 3)) return lines

  return lines.flatMap((line) => {
    if (!candidate(line)) return [line]
    const [first, ...rest] = line.parts
    const restyle = (parts: Part[]) => {
      const chars = (bold: boolean | null, italic: boolean | null) =>
        parts.reduce(
          (sum, part) =>
            sum +
            part.runs
              .filter((run) => (bold === null || run.bold === bold) && (italic === null || run.italic === italic))
              .reduce((n, run) => n + run.end - run.start, 0),
          0,
        )
      const total = chars(null, null) || 1
      return { bold: chars(true, null) / total > 0.6, italic: chars(null, true) / total > 0.6 }
    }
    const box = line.box
    const heading: SourceLine = {
      ...line,
      parts: [first],
      text: first.text,
      links: [],
      ...restyle([first]),
      box: box && [box[0], box[1], rest[0].x - 4, box[3]],
    }
    const entry: SourceLine = {
      ...line,
      parts: rest,
      text: rest.map((part) => part.text).join(" "),
      left: rest[0].x,
      x: rest[0].x,
      ...restyle(rest),
      box: box && [rest[0].x, box[1], box[2], box[3]],
    }
    return [heading, entry]
  })
}

/** "2", "Page 2", "2 of 3", "- 2 -". */
const PAGE_NUMBER = /^[\s\-\u2013\u2014]*(?:page\s+)?(\d{1,3})(?:\s*(?:of|\/)\s*\d{1,3})?[\s\-\u2013\u2014]*$/i

/** Lines that are only a page's number, at its top or bottom: not part of the resume. */
function withoutPageNumbers<T extends Line>(lines: T[]): T[] {
  const ends = new Set<Line>()
  lines.forEach((line, i) => {
    if (line.page === undefined) return
    if (lines[i - 1]?.page !== line.page || lines[i + 1]?.page !== line.page) ends.add(line)
  })
  return lines.filter((line) => !(ends.has(line) && Number(line.text.match(PAGE_NUMBER)?.[1]) === line.page))
}

/**
 * A file's lines as the parser reads them: without the pages' numbers, and
 * with a heading set in a margin column split off its line. Each keeps its
 * place in the file as `sourceIndex`.
 */
export const preparedLines = (file: Line[]): SourceLine[] =>
  splitSideHeadings(withoutPageNumbers(file.map((line, sourceIndex) => ({ ...line, sourceIndex }))))

export function parseResume(file: Line[]): ParsedResume {
  const input = preparedLines(file)
  const lines: ParseLine[] = input.map((line, index) => ({ ...line, index }))
  const body = bodySize(lines)

  // The right edge of each line's column, from lines on its page that start near it in a similar size.
  const pages = new Map<number | undefined, ParseLine[]>()
  for (const line of lines) {
    if (!line.box) continue
    const page = pages.get(line.page)
    if (page) page.push(line)
    else pages.set(line.page, [line])
  }
  for (const page of pages.values()) {
    for (const line of page) {
      const column = page.filter((other) => Math.abs(other.left - line.left) < 60 && Math.abs(other.size - line.size) < 1.5)
      line.margin = column.reduce((edge, other) => Math.max(edge, other.box![2]), -Infinity)
    }
    // Justified text: the long lines of a column all end at the same edge, at
    // its right side, as text set ragged hardly ever does. A hyphen breaking a
    // word can reach a little past it. Short lines, like titles, don't count
    // either way, nor do short lines that end together ("Chicago, IL" under
    // each job).
    for (const line of page) {
      if (line.parts.length !== 1) continue
      const ends = page
        .filter((other) => other.parts.length === 1 && Math.abs(other.left - line.left) < 60 && Math.abs(other.size - line.size) < 1.5)
        .map((other) => other.box![2])
      const counts = new Map<number, number>()
      for (const end of ends) counts.set(Math.round(end), (counts.get(Math.round(end)) ?? 0) + 1)
      const edge = [...counts].sort((a, b) => b[1] - a[1])[0][0]
      const atEdge = (end: number) => end >= edge - 1.5 && end <= edge + 4
      const long = ends.filter((end) => end >= edge - 20 && end <= edge + 4)
      const exact = long.filter(atEdge)
      line.full = edge >= line.margin! - 20 && exact.length >= 3 && exact.length >= 0.6 * long.length && atEdge(line.box![2])
    }
  }

  // Headings: first the ones we know by name, then anything styled the same way.
  const known = new Map<number, HeadingMeaning>()
  for (const line of lines) {
    if (!headingShaped(line)) continue
    const meaning = lookupHeading(line.text)
    if (meaning) known.set(line.index, meaning)
  }
  // A heading word can also be a skill category ("Languages"), so when most
  // headings share a style, ones that don't are ordinary lines.
  const similar = (a: Line, b: Line) =>
    Math.abs(a.size - b.size) < 0.6 &&
    leadStyle(a).bold === leadStyle(b).bold &&
    isAllCaps(unspace(a.text)) === isAllCaps(unspace(b.text)) &&
    Boolean(a.heading) === Boolean(b.heading)
  let knownLines = lines.filter((line) => known.has(line.index))
  // The first heading with the most others like it.
  const alike = knownLines.map((line) => knownLines.filter((other) => similar(line, other)).length)
  const most = Math.max(...alike)
  const sample: ParseLine | undefined = knownLines[alike.indexOf(most)]
  if (sample && most >= 2) {
    for (const line of knownLines) if (!similar(sample, line)) known.delete(line.index)
    knownLines = knownLines.filter((line) => known.has(line.index))
  }
  const headingStyle = (line: Line) => {
    if (!sample) {
      return line.heading === true || (isAllCaps(line.text) && (line.bold || line.size > body * 1.1)) || line.size >= body * 1.25
    }
    const sameX = knownLines.every((other) => Math.abs(other.left - sample.left) < 4) ? Math.abs(line.left - sample.left) < 4 : true
    return (
      Math.abs(line.size - sample.size) < 0.25 &&
      line.bold === sample.bold &&
      isAllCaps(line.text) === isAllCaps(sample.text) &&
      Boolean(line.heading) === Boolean(sample.heading) &&
      sameX
    )
  }
  // Headings it doesn't know by name, but known by a word in them, when they
  // look like the ones it does know.
  lines.forEach((line, i) => {
    if (i === 0 || known.has(line.index) || !headingShaped(line) || !headingStyle(line)) return
    const meaning = headingByWord(line.text)
    if (meaning) known.set(line.index, meaning)
  })
  knownLines = lines.filter((line) => known.has(line.index))
  // Unknown headings are only guessed from their style when it sets them apart:
  // if entry titles look the same (all bold, same size), it doesn't.
  const lookalikes = lines.filter((line, i) => i > 0 && !known.has(line.index) && headingShaped(line) && headingStyle(line))
  const guessHeadings = lookalikes.length <= Math.max(2, knownLines.length / 2)
  const headings = new Map<number, { meaning: HeadingMeaning; label: string }>()
  lines.forEach((line, i) => {
    const meaning = known.get(line.index)
    if (meaning) headings.set(line.index, { meaning, label: line.text.replace(/:$/, "") })
    // The first line is usually the name, which can look like a heading.
    else if (guessHeadings && i > 0 && headingShaped(line) && headingStyle(line) && !looksLikeName(line.text)) {
      headings.set(line.index, { meaning: { section: null }, label: line.text.replace(/:$/, "") })
    }
  })

  const firstHeading = lines.find((line) => headings.has(line.index))?.index ?? Math.min(lines.length, 4)
  // Contact details sit at the top, or in a section of their own.
  const contactSections = new Set<number>()
  let inContactSection = false
  for (const line of lines) {
    const heading = headings.get(line.index)
    if (heading) inContactSection = heading.meaning.section === null && heading.meaning.contact === true
    else if (inContactSection) contactSections.add(line.index)
  }
  const contacts = readContacts(lines, (line) => line.index < firstHeading || contactSections.has(line.index))
  const profile: Record<string, string> = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, contacts.fields[field.key] ?? ""]))
  const profileLines = [...contacts.lines]

  // The name: the biggest text near the top, or failing that, something shaped like a name.
  const top = lines.slice(0, Math.max(firstHeading, 1)).filter((line) => !contacts.used.has(line.index))
  const candidates = top.slice(0, 4).filter((line) => !headings.has(line.index))
  const biggest = [...candidates].sort((a, b) => b.size - a.size)[0]
  let nameLine =
    biggest && biggest.size >= body * 1.2 && words(biggest.parts[0].text).length <= 6
      ? biggest
      : candidates.find((line) => looksLikeName(line.parts[0].text))
  if (!nameLine) {
    nameLine = [...lines]
      .filter((line) => !headings.has(line.index) && line.size >= body * 1.4 && looksLikeName(line.text))
      .sort((a, b) => b.size - a.size)[0]
  }
  if (nameLine) {
    profile.fullName = titleCase(tidy(nameLine.parts[0].text))
    profileLines.push(nameLine.index)
  }

  const unplaced: ParsedResume["unplaced"] = []
  const provenance = (indexes: number[]) => [
    ...new Set(indexes.map((index) => input[index]?.sourceIndex).filter((index): index is number => index !== undefined)),
  ]
  const addUnplaced = (heading: string, lineIndexes: number[], text: string[], headingLine = lineIndexes[0] ?? -1) => {
    const kept = text.map(tidy).filter(Boolean)
    if (kept.length === 0) return
    unplaced.push({
      id: `unplaced:${headingLine}:${unplaced.length}`,
      heading,
      headingLine,
      lines: lineIndexes,
      sourceLines: provenance(lineIndexes),
      text: kept,
    })
  }
  const textOf = (line: Line & { index: number }) => contacts.remainders.get(line.index) ?? line.text
  const content = (line: Line & { index: number }) => !contacts.used.has(line.index) && line !== nameLine

  // Anything at the top that isn't the name or contact details, like a tagline or address.
  const topRest = lines.filter((line) => line.index < firstHeading && content(line))
  addUnplaced(
    "Top of the resume",
    topRest.map((line) => line.index),
    topRest.map(textOf),
  )

  const sections: FoundSection[] = []
  const sectionFor = (name: SectionName) => {
    let section = sections.find((found) => found.name === name)
    if (!section) {
      section = { name, entries: [] }
      sections.push(section)
    }
    return section
  }

  const starts = lines.filter((line) => headings.has(line.index))
  const occurrences: FoundOccurrence[] = []
  const extraGroups: FoundExtraGroup[] = []
  const experience: { name: ExperienceName; calls: Map<FoundEntry, RoleCall>; splits: Map<FoundEntry, SplitCall> }[] = []
  starts.forEach((start, i) => {
    const { meaning, label } = headings.get(start.index)!
    const end = starts[i + 1]?.index ?? lines.length
    const sectionLines = joinWrappedDates(
      lines
        .slice(start.index + 1, end)
        .filter(content)
        .map((line) =>
          contacts.remainders.has(line.index)
            ? { ...line, text: textOf(line), parts: [{ ...line.parts[0], text: textOf(line), runs: [] }] }
            : line,
        ),
    )
    const normalized = normalizeHeading(label)
    // A summary is prose: one in bullets isn't read as one.
    const summary = SUMMARY_HEADINGS.has(normalized) && !sectionLines.some((line) => line.bullet)
    const kind: FoundOccurrence["kind"] = summary ? "summary" : meaning.section === null ? "unsupported" : "builtin"
    const indexes = sectionLines.flatMap(lineIndexes)
    const occurrence: FoundOccurrence = {
      id: `heading:${start.index}`,
      heading: label,
      headingLine: start.index,
      lines: indexes,
      sourceLines: provenance([start.index, ...indexes]),
      section: kind === "builtin" ? meaning.section : null,
      kind,
    }
    occurrences.push(occurrence)
    if (sectionLines.length === 0) return

    if (kind === "summary") {
      extraGroups.push({ ...occurrence, kind, text: unwrapped(sectionLines) })
      return
    }

    if (meaning.section === null) {
      // Coursework listed on its own goes with the first school.
      const education = sections.find((found) => found.name === "Education")
      if (/course/i.test(label) && education?.entries[0] && !education.entries[0].fields.coursework) {
        education.entries[0].fields.coursework = tidy(sectionLines.map((line) => line.text).join(", "))
        education.entries[0].lines.push(...sectionLines.map((line) => line.index))
        return
      }
      addUnplaced(titleCase(label), indexes, unwrapped(sectionLines), start.index)
      return
    }

    const name = meaning.section
    const result =
      name === "Education"
        ? readEducation(sectionLines)
        : name === "Projects"
          ? readProjects(sectionLines)
          : name === "Publications"
            ? readPublications(sectionLines)
            : name === "Skills"
              ? readSkills(sectionLines, "category" in meaning ? meaning.category : undefined)
              : name === "Awards"
                ? readAwards(sectionLines)
                : readExperience(name, sectionLines)
    const entries = result.entries.filter((entry) => Object.values(entry.fields).some((value) => value.trim() !== ""))
    if (entries.length) sectionFor(name).entries.push(...entries)
    if (result.calls && result.splits && name in EXPERIENCE_FIELDS)
      experience.push({ name: name as ExperienceName, calls: result.calls, splits: result.splits })
    addUnplaced(titleCase(label), result.leftover.lines, result.leftover.text, start.index)
  })
  followOtherEntries(experience)
  followCommas(experience)

  // With no headings at all, firstHeading falls back to the 4th line: what's
  // below the top of the resume couldn't be sorted, so it's listed as it is.
  if (starts.length === 0) {
    const rest = lines.filter((line) => line.index >= firstHeading && content(line))
    addUnplaced(
      "Everything else",
      rest.map((line) => line.index),
      rest.map(textOf),
    )
  }

  return { lines: input, profile, profileLines, sections, unplaced, occurrences, extraGroups }
}

/** Builds a resume for the editor from what was found, leaving out entries the user unticked. */
export interface ImportChoices {
  /** Deliberate promotions, initially absent from the review. */
  keepAs?: Record<string, "text" | "list">
}

export const extraGroupKey = (id: string) => `extra-group:${id}`
export const unplacedKey = (group: ParsedResume["unplaced"][number], index: number) => group.id ?? `unplaced:${index}`

export function toResumeContent(parsed: ParsedResume, skip: Set<string> = new Set(), choices: ImportChoices = {}): CompleteContent {
  const resume: ResumeContent = {
    profileSection: { ...parsed.profile },
    headings: {},
  }
  for (const name of SECTION_NAMES) {
    const section = parsed.sections.find((found) => found.name === name)
    resume[SECTIONS[name].dataKey] = (section?.entries ?? [])
      .filter((_, index) => !skip.has(entryKey(name, index)))
      .map((entry, index) => ({ id: index + 1, ...blankEntry(name), ...entry.fields }))
  }
  const extras: ExtraSections = {}
  const positions = new Map<SectionRef, number>()
  for (const occurrence of parsed.occurrences ?? []) {
    if (occurrence.section && !positions.has(occurrence.section)) positions.set(occurrence.section, occurrence.headingLine)
  }
  // The summaries ticked go in the profile's summary, a paragraph each, in the file's order.
  const summaries = (parsed.extraGroups ?? []).filter((group) => group.kind === "summary" && !skip.has(extraGroupKey(group.id)))
  if (summaries.length)
    resume.profileSection = { ...resume.profileSection, summary: summaries.map((group) => group.text.join("\n")).join("\n\n") }
  parsed.unplaced.forEach((group, index) => {
    const kind = choices.keepAs?.[unplacedKey(group, index)]
    if (!kind) return
    const key = crypto.randomUUID()
    const common = {
      kind,
      heading: group.heading === "Top of the resume" || group.heading === "Everything else" ? "New section" : group.heading,
    }
    extras[key] =
      kind === "text"
        ? { ...common, kind, text: group.text.join("\n") }
        : { ...common, kind, bullets: group.text.map((line) => `• ${line.replace(/^[•○]\s*/, "")}`).join("\n") }
    positions.set(`extra:${key}`, group.headingLine ?? group.lines[0] ?? Number.MAX_SAFE_INTEGER)
  })
  if (Object.keys(extras).length) resume.extraSections = extras
  // The sections found, in the file's order, but an optional one only with an
  // entry ticked; then the core sections the file doesn't have.
  const authored: SectionRef[] = [
    ...parsed.sections.map((section) => section.name),
    ...Object.keys(extras).map((key): SectionRef => `extra:${key}`),
  ].filter(
    (ref) => extraKey(ref) !== null || !SECTIONS[ref as SectionName].optional || resume[SECTIONS[ref as SectionName].dataKey]?.length,
  )
  authored.sort((a, b) => (positions.get(a) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b) ?? Number.MAX_SAFE_INTEGER))
  resume.sectionOrder = resolveSections({ ...resume, sectionOrder: authored })
  // Every section is set above.
  return resume as CompleteContent
}

export const entryKey = (section: SectionName, index: number) => `${section}:${index}`

/**
 * When this much of a file's text couldn't be placed, the file was likely
 * read wrong, not just left with a few lines that have no field. A resume
 * read right leaves out a tenth at most: an address, an advisor, a line
 * about an award. One whose headings were missed leaves out a third or more.
 */
export const MUCH_UNPLACED = 0.25

/** How much of the file's text went to "Couldn't place", from 0 to 1, leaving out spaces. */
export function unplacedShare(parsed: ParsedResume): number {
  const length = (text: string) => text.replace(/\s/g, "").length
  const total = parsed.lines.reduce((sum, line) => sum + length(line.text), 0)
  const unplaced = parsed.unplaced.reduce((sum, group) => sum + group.text.reduce((count, text) => count + length(text), 0), 0)
  return total > 0 ? Math.min(1, unplaced / total) : 0
}
