// Sorts the lines of a resume made somewhere else into the editor's fields.
// It reads the file the way a person would: headings start sections, dates
// and places sit beside job titles, bullets describe the entry above them.
// It's still guesswork, so the import review shows the result, and whatever
// couldn't be placed, before anything is saved.

import { PROFILE_FIELDS, SECTION_NAMES, SECTIONS, type SectionName } from "@/components/editor/sections"
import type { ResumeContent } from "@/lib/resumeFile"
import type { Line, Part } from "./lines"

export interface FoundEntry {
  /** Values keyed by the section's field names. */
  fields: Record<string, string>
  /** Indexes of the lines it was read from. */
  lines: number[]
}

export interface FoundSection {
  name: SectionName
  entries: FoundEntry[]
}

export interface ParsedResume {
  /** The lines that entries' `lines` index into: the file's, with side headings split off. */
  lines: Line[]
  profile: Record<string, string>
  profileLines: number[]
  /** In the order they appear in the file. */
  sections: FoundSection[]
  /** Text that didn't fit anywhere, grouped under the heading it was found under. */
  unplaced: { heading: string; lines: number[]; text: string[] }[]
}

/** A line being parsed: its place in the file, and lines joined onto it. */
type ParseLine = Line & {
  index: number
  /** The right edge of its column: the furthest any line like it reaches. */
  margin?: number
  merged?: number[]
}

// ---------------------------------------------------------------- patterns

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?"
const SEASON = "(?:spring|summer|fall|autumn|winter)"
const YEAR = "(?:19|20)\\d{2}"
const ONE_DATE = `(?:(?:${MONTH}|${SEASON})\\s*,?\\s*(?:${YEAR}|['\u2019]\\d{2})|\\d{1,2}\\s*/\\s*(?:${YEAR}|\\d{2})|${YEAR})`
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
const URL = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|dev|me|org|net|co|ai|app|xyz|tech|site|page|us|ca|edu|info|so|sh|gg|design|codes|blog|cc|tv|uk|in|de)(?:\/[^\s|,;)]*)?/i

const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
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

const TITLE_WORDS = /\b(?:engineer(?:ing)?|developer|intern(?:ship)?|manager|analyst|assistant|associate|lead|director|designer|scientist|researcher|consultant|specialist|coordinator|president|vice|founder|co-?founder|officer|chair(?:man|person|woman)?|member|volunteer|tutor|mentor|captain|treasurer|secretary|head|representative|administrator|technician|architect|programmer|fellow|instructor|teacher|ambassador|organizer|editor|writer|owner|contractor|freelancer?|cashier|server|barista|leader|trainee|apprentice|advis[eo]r|counselor|supervisor|executive|vp|cto|ceo|cfo|coo|principal|sde|swe|sre|tester|operator|agent|clerk|receptionist|lifeguard|coach|host|ta|ra|delegate|chief|staff)\b/i
const ORG_WORDS = /\bco\.|\b(?:inc|llc|ltd|corp|corporation|company|labs?|laboratory|technologies|technology|systems|solutions|group|bank|foundation|association|society|club|council|hospital|center|centre|agency|department|dept|studios?|partners|capital|ventures|health|network|government|committee|organi[sz]ation|federation|union|church|ministry|museum|library|university|college|institute|school|academy|startup|consulting|software|bureau|service|services)\b/i
const SCHOOL_WORDS = /\b(?:university|college|institute|school|academy|polytechnic|conservatory|universit[\u00E9e]|universidad|hochschule)\b|\bU(?:C|T)\s|\bMIT\b/i
const DEGREE_WORDS = /\b(?:bachelor|master|associate['\u2019]?s?|doctor(?:ate)?|ph\.?\s?d|mba|m\.b\.a|diploma|certificate|degree|major|minor|honou?rs|ged|a\.?a\.?s?|b\.?\s?(?:s|a|sc|eng|e|ed|fa|tech|com|ba)\.?|m\.?\s?(?:s|a|sc|eng|ed|fa|tech|phil)\.?)(?=[\s,.:()]|$)/i
// "BSE in Computer Science", "MPH in Epidemiology": capitals matter, so this is its own pattern.
const DEGREE_ABBREVIATION = /\b(?:[BM]\.?[A-Z][A-Za-z]{0,3}\.?|Ph\.?D\.?|J\.?D\.?|M\.?D\.?|A\.?[AB]\.?|S\.?[BM]\.?|Ing\.)\s+(?:in|of)\s/
const isDegree = (text: string) => DEGREE_WORDS.test(text) || DEGREE_ABBREVIATION.test(text)
const GPA = /\(?\s*(?:cumulative\s+|overall\s+|major\s+)?(?:gpa|grade point average)\s*[:\-]?\s*(\d(?:\.\d{1,3})?(?:\s*\/\s*\d(?:\.\d{1,2})?)?)\s*\)?|\(?\s*(\d\.\d{1,3}\s*\/\s*[45](?:\.0{1,2})?)\s*(?:gpa)?\s*\)?/i
const LABEL = /^(relevant\s+)?(coursework|courses|involvements?|activities|organizations|clubs|tech(?:nologies|nical)?(?:\s+stack)?|stack|tools|built\s+with|languages)\s*:\s*/i

// ---------------------------------------------------------------- headings

type HeadingMeaning = { section: SectionName; category?: string } | { section: null; contact?: boolean }

const HEADINGS: [HeadingMeaning, string[]][] = [
  [{ section: "Education" }, ["education", "academic background", "academics", "educational background", "education and training", "academic history", "education and certifications", "academic qualifications", "education and honors", "education and awards"]],
  [{ section: "Work" }, ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "relevant experience", "industry experience", "internships", "internship experience", "career history", "professional background", "technical experience", "research experience", "engineering experience", "software engineering experience", "work", "experiences", "professional history", "research", "teaching experience", "relevant work experience", "related experience", "additional experience", "other experience", "research and work experience", "work and research experience", "teaching", "academic experience", "positions", "research positions", "appointments", "academic appointments", "professional appointments"]],
  [{ section: "Projects" }, ["projects", "technical projects", "personal projects", "academic projects", "selected projects", "side projects", "relevant projects", "project experience", "key projects", "software projects", "project", "notable projects", "research projects", "projects and research", "software", "open source", "open source projects", "selected software", "portfolio"]],
  [{ section: "Skills" }, ["skills", "technical skills", "skills and interests", "core competencies", "technologies", "tech stack", "tools", "languages and technologies", "technical proficiencies", "skills summary", "competencies", "expertise", "skills and tools", "skills and technologies", "programming languages", "technical expertise", "relevant skills", "computer skills", "key skills", "areas of expertise", "technical toolbox", "skills and certifications", "skills and abilities", "additional skills"]],
  [{ section: "Leadership" }, ["leadership", "leadership experience", "leadership and activities", "activities", "extracurricular activities", "extracurriculars", "campus involvement", "involvement", "activities and leadership", "organizations", "leadership and involvement", "extracurricular", "campus leadership", "student organizations", "activities and involvement", "leadership and extracurriculars", "extracurricular activities and leadership", "service and leadership", "leadership and service"]],
  [{ section: "Volunteership" }, ["volunteer", "volunteering", "volunteer experience", "community service", "community involvement", "volunteer work", "community engagement", "service", "volunteer and community service", "volunteer activities"]],
  [{ section: "Awards" }, ["awards", "honors", "honors and awards", "awards and honors", "achievements", "certifications", "certificates", "awards certifications", "awards and certifications", "licenses and certifications", "accomplishments", "scholarships", "honors awards", "certifications and awards", "awards and achievements", "certification", "licenses", "honors and achievements", "awards and scholarships", "achievements and awards", "competitions", "hackathons", "fellowships", "fellowships and awards", "awards and fellowships", "grants", "grants and fellowships", "fellowships and grants", "honors and fellowships", "honors and distinctions", "distinctions", "recognition", "awards and recognition"]],
  [{ section: "Skills", category: "Languages" }, ["languages", "spoken languages", "language skills"]],
  [{ section: "Skills", category: "Interests" }, ["interests", "hobbies", "hobbies and interests", "personal interests", "interests and hobbies"]],
  [{ section: null, contact: true }, ["contact", "contact information", "contact info", "contact details", "personal information", "personal details", "personal info", "links", "personal", "details"]],
  [{ section: null }, ["summary", "professional summary", "objective", "career objective", "profile", "about", "about me", "publications", "references", "coursework", "relevant coursework", "courses", "additional information", "other", "miscellaneous", "patents", "presentations", "papers", "conferences", "talks", "memberships", "professional memberships", "affiliations", "highlights", "qualifications", "summary of qualifications", "career summary", "executive summary", "overview", "bio"]],
]
const HEADING_LOOKUP = new Map(HEADINGS.flatMap(([meaning, names]) => names.map((name) => [name, meaning] as const)))
// Letter-spaced headings can lose the gaps between their words.
const HEADING_LOOKUP_COMPACT = new Map([...HEADING_LOOKUP].map(([name, meaning]) => [name.replace(/ /g, ""), meaning] as const))
const lookupHeading = (text: string) => {
  const normal = normalizeHeading(text)
  return HEADING_LOOKUP.get(normal) ?? HEADING_LOOKUP_COMPACT.get(normal.replace(/ /g, ""))
}

/** "E D U C A T I O N": letter-spaced text reads as one letter (or kerned pair) per word. */
const unspace = (text: string) => {
  const tokens = text.trim().split(/\s+/)
  return tokens.length >= 4 && tokens.filter((token) => token.length <= 2).length / tokens.length >= 0.7 ? tokens.join("") : text
}

const normalizeHeading = (text: string) =>
  unspace(text).toLowerCase().replace(/&/g, " and ").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim()

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
  isAllCaps(text) ? text.toLowerCase().replace(/(^|[\s\-'\u2019.])(\S)/g, (_, before, letter: string) => before + letter.toUpperCase()) : text

interface Fragment {
  text: string
  bold: boolean
  italic: boolean
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
  const add = (end: number) => {
    const raw = part.text.slice(start, end)
    const text = tidy(raw)
    if (text) {
      const offset = start + raw.indexOf(text.charAt(0))
      pieces.push({ text, start: offset, ...styleAt(part, offset, offset + text.length) })
    }
  }
  for (const match of part.text.matchAll(SEPARATOR)) {
    add(match.index!)
    start = match.index! + match[0].length
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
      joined[joined.length - 1] = { ...above, parts: aboveParts, text: aboveParts.map((part) => part.text).join(" "), merged: [...(above.merged ?? []), line.index] }
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

interface Item {
  text: string
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
function continues(line: Line, item: Item, wasBullet: boolean): boolean {
  if (line.page === undefined || line.bullet || hasDate(line)) return false
  if (wasBullet) return line.left > item.left + 1 && line.x <= Math.max(item.x, item.left + 3 * item.size) + 4
  return Math.abs(line.x - item.x) <= 3 && (!/[.!?]$/.test(item.text) || /^[a-z]/.test(line.text))
}

const joinWrapped = (text: string, next: string) =>
  /\w-$/.test(text) && /^[a-z]/.test(next) ? text + next : `${text} ${next}`

/** A long line that reads like a sentence, not an entry's title. */
const sentence = (line: Line) =>
  !line.bold && !hasDate(line) && (line.text.length > 85 || (/[.!?]$/.test(line.text) && words(line.text).length >= 4))

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
  const text = line.text.trim()
  const url = text.match(URL)
  return isLocation(text) || (url !== null && url[0].length === text.length) || dateOnly(text)
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

const CONNECTOR = /(?:[,;:&/-]|\b(?:and|or|of|in|for|the|a|an|at|with|to|by|on|from|into|using|via|across|through|as|including|such|than|while|that|which))$/i

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
  return { ...a, parts, text: parts.map((part) => part.text).join(" "), links: [...a.links, ...b.links], merged: [...(a.merged ?? []), b.index, ...(b.merged ?? [])] }
}

/**
 * Splits a section into entries: one or more title lines (role, company,
 * dates, place) followed by bullets.
 */
function groupEntries(lines: ParseLine[], isBody: (line: Line) => boolean = () => false): Group[] {
  const groups: Group[] = []
  let lastWasBullet = false
  let previous: ParseLine | undefined

  for (const line of lines) {
    const group: Group | undefined = groups[groups.length - 1]
    const last: Item | undefined = group?.body[group.body.length - 1]
    const item: Item = { text: line.text, lines: [line.index], left: line.left, x: line.x, size: line.size }
    const before = previous
    previous = line

    // Text wrapping under a bullet lines up with the bullet's text.
    if (last && lastWasBullet && continues(line, last, true)) {
      last.text = joinWrapped(last.text, line.text)
      last.lines.push(line.index)
      continue
    }

    // Without bullets, descriptions are set in from their entry's title, and
    // a line that ran to the right edge carries on in the next.
    const title = group?.header[0]
    if (!line.bullet && title && line.page !== undefined && line.left >= textStart(title) + 6 && !hasDate(line)) {
      // A new point usually starts with a capital; wrapped text rarely does unless the line before ended mid-phrase.
      const wrapped = before && wrapsInto(before, line) && (!/^[A-Z]/.test(line.text) || CONNECTOR.test(before.text))
      if (last && before && wrapped && last.lines.includes(before.index) && Math.abs(line.left - before.left) < 3) {
        last.text = joinWrapped(last.text, line.text)
        last.lines.push(line.index)
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
      continue
    }
    if (last && !lastWasBullet && continues(line, last, false)) {
      last.text = joinWrapped(last.text, line.text)
      last.lines.push(line.index)
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
  const header: Header = { texts: [], date: null, location: "", links: [] }
  for (const line of joinWrappedTitles(lines)) {
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
      for (let date = findDate(text); date; date = findDate(text)) {
        header.date ??= date
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
      for (const fragment of fragmentsOf({ ...part, text })) {
        let value = fragment.text
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
        if (value) header.texts.push({ ...fragment, text: value })
      }
    }
  }
  return header
}

const score = (text: string, pattern: RegExp) => (text.match(new RegExp(pattern.source, "gi")) ?? []).length

/** Above zero for job titles, below for organizations. The last word counts double. */
function titleScore(text: string): number {
  const last = words(text).pop() ?? ""
  const acronym = /^[A-Z0-9&.]{2,6}$/.test(text) ? 1 : 0
  return score(text, TITLE_WORDS) + Number(TITLE_WORDS.test(last)) - score(text, ORG_WORDS) - Number(ORG_WORDS.test(last)) - acronym
}

/** Decides which bit of text is the job title and which is the organization. */
function roleAndOrg(texts: Fragment[]): { role: string; org: string; rest: string[] } {
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
      if (aTitle > 0 && bTitle <= 0) return { role: a, org: b, rest: [] }
      if (bTitle > 0 && aTitle <= 0) return { role: b, org: a, rest: [] }
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
  return { role: role.text, org: org.text, rest: others.filter((item) => item !== org).map((item) => item.text) }
}

/** "• one\n• two", the editor's format for bullets. */
const bulletField = (items: string[]) =>
  items
    .map((item) => tidy(item))
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join("\n")

const linesOf = (group: Group) => [...group.header.flatMap((line) => [line.index, ...(line.merged ?? [])]), ...group.body.flatMap((item) => item.lines)]

// ---------------------------------------------------------------- sections

interface SectionResult {
  entries: FoundEntry[]
  leftover: { lines: number[]; text: string[] }
}

const EXPERIENCE_FIELDS: Record<"Work" | "Leadership" | "Volunteership", Record<string, string>> = {
  Work: { role: "workRole", org: "companyName", location: "workLocation", start: "workStartDate", end: "workEndDate", bullets: "workDescription" },
  Leadership: { role: "leadershipRole", org: "leadershipOrg", location: "leadershipLocation", start: "leadershipStartDate", end: "leadershipEndDate", bullets: "leadershipDescription" },
  Volunteership: { role: "volunteerRole", org: "volunteerOrg", location: "volunteerLocation", start: "volunteerStartDate", end: "volunteerEndDate", bullets: "volunteerDescription" },
}

function blankEntry(name: SectionName): Record<string, string> {
  return Object.fromEntries(SECTIONS[name].fields.map((field) => [field.key, ""]))
}

function readExperience(name: "Work" | "Leadership" | "Volunteership", lines: ParseLine[]): SectionResult {
  const keys = EXPERIENCE_FIELDS[name]
  const leftover: SectionResult["leftover"] = { lines: [], text: [] }
  const entries = groupEntries(lines).map((group) => {
    const header = readHeader(group.header)
    const { role, org, rest } = roleAndOrg(header.texts)
    const fields = blankEntry(name)
    fields[keys.role] = role
    fields[keys.org] = org
    fields[keys.location] = header.location
    fields[keys.start] = header.date?.start ?? ""
    fields[keys.end] = header.date?.end ?? ""
    fields[keys.bullets] = bulletField(group.body.map((item) => item.text))
    if (rest.length) {
      leftover.lines.push(...group.header.map((line) => line.index))
      leftover.text.push(...rest)
    }
    return { fields, lines: linesOf(group) }
  })
  return { entries, leftover }
}

/** "B.S. in Biology, Stanford University" is a degree and a school. */
function splitDegreeAndSchool(fragment: Fragment): Fragment[] {
  const pieces = fragment.text.split(/\s*,\s+/)
  if (pieces.length < 2) return [fragment]
  const at = pieces.findIndex((piece) => SCHOOL_WORDS.test(piece) && !isDegree(piece))
  if (at < 0 || !pieces.some((piece, i) => i !== at && isDegree(piece))) return [fragment]
  if (at === 0) return [{ ...fragment, text: pieces[0] }, { ...fragment, text: pieces.slice(1).join(", ") }]
  if (at === pieces.length - 1) return [{ ...fragment, text: pieces.slice(0, -1).join(", ") }, { ...fragment, text: pieces[at] }]
  return [fragment]
}

function readEducation(lines: ParseLine[]): SectionResult {
  const leftover: SectionResult["leftover"] = { lines: [], text: [] }
  // "Relevant Coursework: ..." and "GPA: ..." lines are details of the school above.
  const details = (line: Line) => LABEL.test(line.text) || /^(?:cumulative\s+)?gpa\b/i.test(line.text)
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
    fields.schoolName = school
    fields.degree = degree
    fields.schoolLocation = header.location
    fields.schoolStartDate = header.date?.start ?? ""
    fields.schoolEndDate = header.date?.end ?? ""

    const other: string[] = [...rest]
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
      else bullets.push(item.text)
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
    return { fields, lines: linesOf(group) }
  })
  return { entries, leftover }
}

function readSkills(lines: ParseLine[], category?: string): SectionResult {
  const entries: FoundEntry[] = []
  if (category) {
    const text = lines.map((line, i) => (i === 0 || /,$/.test(lines[i - 1].text) ? "" : ", ") + line.text).join("")
    return { entries: [{ fields: { skillName: category, skillDetails: tidy(text) }, lines: lines.map((line) => line.index) }], leftover: { lines: [], text: [] } }
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
    const name = colon && words(colon[1]).length <= 5 ? colon[1] : line.parts.length > 1 && words(line.parts[0].text).length <= 4 ? line.parts[0].text : ""
    const details = colon && name === colon[1] ? colon[2] : name ? line.parts.slice(1).map((part) => part.text).join(" ") : line.text
    if (!name && last && !line.bullet) {
      // Wrapped from the line above.
      last.fields.skillDetails = `${last.fields.skillDetails} ${details}`.trim()
      last.lines.push(line.index)
      return
    }
    entries.push({ fields: { skillName: name, skillDetails: details }, lines: [line.index] })
  })
  for (const entry of entries) {
    entry.fields.skillName = tidy(entry.fields.skillName)
    entry.fields.skillDetails = tidy(entry.fields.skillDetails)
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

function readAwards(lines: ParseLine[]): SectionResult {
  const blocks = blocksBySpacing(lines)
  if (blocks) {
    const entries = blocks.map((block) => {
      const header = readHeader(block)
      return {
        fields: {
          awardName: header.texts[0]?.text ?? "",
          awardOrg: header.texts.slice(1).map((fragment) => fragment.text).join(", "),
          awardDate: header.date?.text ?? "",
        },
        lines: block.flatMap((line) => [line.index, ...(line.merged ?? [])]),
      }
    })
    return { entries, leftover: { lines: [], text: [] } }
  }
  const entries: FoundEntry[] = []
  for (const line of lines) {
    const last = entries[entries.length - 1]
    // A date on a line of its own goes with the award above it.
    const date = findDate(line.text)
    if (last && !last.fields.awardDate && date && tidy(line.text.replace(date.text, "")) === "") {
      last.fields.awardDate = date.text
      last.lines.push(line.index)
      continue
    }
    if (last && !line.bullet && !hasDate(line) && (/^[a-z]/.test(line.text) || line.left > (lines[0]?.left ?? 0) + 4)) {
      last.fields.awardName = tidy(`${last.fields.awardName} ${line.text}`)
      last.lines.push(line.index)
      continue
    }
    const header = readHeader([line])
    let name = header.texts[0]?.text ?? ""
    let org = header.texts.slice(1).map((fragment) => fragment.text).join(", ")
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
  return { entries: entries.filter((entry) => entry.fields.awardName || entry.fields.awardOrg), leftover: { lines: [], text: [] } }
}

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
  fields: Record<string, string>
  lines: number[]
  /** Lines that were only contact details. */
  used: Set<number>
  /** What's left of lines that mixed contact details with other text. */
  remainders: Map<number, string>
}

const CONTACT_LABEL = /\b(?:e-?mail|phone|mobile|cell|tel|telephone|linkedin|github|website|portfolio|web|site|address)\s*:?/gi

function readContacts(lines: ParseLine[], isTop: (line: ParseLine) => boolean): Contacts {
  const fields: Record<string, string> = {}
  const result: Contacts = { fields, lines: [], used: new Set(), remainders: new Map() }

  for (const line of lines) {
    const inHeader = isTop(line)
    let text = line.text
    let found = false
    const take = (key: string, value: string, match?: string) => {
      if (!fields[key]) fields[key] = value
      if (match) text = text.replace(match, " ")
      found = true
    }

    for (const link of line.links) {
      if (/^mailto:/i.test(link)) take("email", bare(link))
      else if (LINKEDIN.test(link)) take("linkedin", bare(link))
      else if (GITHUB_PROFILE.test(link) && /^(?:https?:\/\/)?(?:www\.)?github\.com\/[^/]+\/?$/i.test(link)) take("profileGithub", bare(link))
      else if (inHeader && !/github\.com\/[^/]+\/[^/]+/i.test(link)) take("personalWebsite", bare(link))
    }
    const email = text.match(EMAIL)
    if (email) take("email", email[0], email[0])
    const linkedin = text.match(LINKEDIN)
    if (linkedin) take("linkedin", bare(linkedin[0]), linkedin[0])
    const github = text.match(GITHUB_PROFILE)
    if (github) take("profileGithub", bare(github[0]), github[0])
    if (inHeader || /^(?:\+|\(|\d)/.test(text.trim())) {
      const phone = text.match(PHONE)
      if (phone && !DATE.test(phone[0])) take("phoneNumber", phone[0].trim(), phone[0])
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
function splitSideHeadings(lines: Line[]): Line[] {
  const candidate = (line: Line) =>
    line.parts.length > 1 && !line.bullet && lookupHeading(line.parts[0].text) !== undefined && words(line.parts[0].text).length <= 4 && line.parts[1].x - line.parts[0].x >= 40
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
        parts.reduce((sum, part) => sum + part.runs.filter((run) => (bold === null || run.bold === bold) && (italic === null || run.italic === italic)).reduce((n, run) => n + run.end - run.start, 0), 0)
      const total = chars(null, null) || 1
      return { bold: chars(true, null) / total > 0.6, italic: chars(null, true) / total > 0.6 }
    }
    const box = line.box
    const heading: Line = { ...line, parts: [first], text: first.text, links: [], ...restyle([first]), box: box && [box[0], box[1], rest[0].x - 4, box[3]] }
    const entry: Line = { ...line, parts: rest, text: rest.map((part) => part.text).join(" "), left: rest[0].x, x: rest[0].x, ...restyle(rest), box: box && [rest[0].x, box[1], box[2], box[3]] }
    return [heading, entry]
  })
}

export function parseResume(file: Line[]): ParsedResume {
  const input = splitSideHeadings(file)
  const lines: ParseLine[] = input.map((line, index) => ({ ...line, index }))
  const body = bodySize(lines)

  // The right edge of each line's column, from lines on its page that start near it in a similar size.
  for (const line of lines) {
    if (!line.box) continue
    const column = lines.filter(
      (other) => other.box && other.page === line.page && Math.abs(other.left - line.left) < 60 && Math.abs(other.size - line.size) < 1.5,
    )
    line.margin = Math.max(...column.map((other) => other.box![2]))
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
  const sample = [...knownLines].sort(
    (a, b) => knownLines.filter((other) => similar(b, other)).length - knownLines.filter((other) => similar(a, other)).length,
  )[0]
  if (sample && knownLines.filter((other) => similar(sample, other)).length >= 2) {
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
  const addUnplaced = (heading: string, lineIndexes: number[], text: string[]) => {
    const kept = text.map(tidy).filter(Boolean)
    if (kept.length === 0) return
    const existing = unplaced.find((group) => group.heading === heading)
    if (existing) {
      existing.lines.push(...lineIndexes)
      existing.text.push(...kept)
    } else {
      unplaced.push({ heading, lines: lineIndexes, text: kept })
    }
  }
  const textOf = (line: Line & { index: number }) => contacts.remainders.get(line.index) ?? line.text
  const content = (line: Line & { index: number }) => !contacts.used.has(line.index) && line !== nameLine

  // Anything at the top that isn't the name or contact details, like a tagline or address.
  const topRest = lines.filter((line) => line.index < firstHeading && content(line))
  addUnplaced("Top of the resume", topRest.map((line) => line.index), topRest.map(textOf))

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
  starts.forEach((start, i) => {
    const { meaning, label } = headings.get(start.index)!
    const end = starts[i + 1]?.index ?? lines.length
    const sectionLines = joinWrappedDates(
      lines
        .slice(start.index + 1, end)
        .filter(content)
        .map((line) => (contacts.remainders.has(line.index) ? { ...line, text: textOf(line), parts: [{ ...line.parts[0], text: textOf(line), runs: [] }] } : line)),
    )
    if (sectionLines.length === 0) return

    if (meaning.section === null) {
      // Coursework listed on its own goes with the first school.
      const education = sections.find((found) => found.name === "Education")
      if (/course/i.test(label) && education?.entries[0] && !education.entries[0].fields.coursework) {
        education.entries[0].fields.coursework = tidy(sectionLines.map((line) => line.text).join(", "))
        education.entries[0].lines.push(...sectionLines.map((line) => line.index))
        return
      }
      addUnplaced(titleCase(label), sectionLines.map((line) => line.index), sectionLines.map((line) => line.text))
      return
    }

    const name = meaning.section
    const result =
      name === "Education"
        ? readEducation(sectionLines)
        : name === "Projects"
          ? readProjects(sectionLines)
          : name === "Skills"
            ? readSkills(sectionLines, "category" in meaning ? meaning.category : undefined)
            : name === "Awards"
              ? readAwards(sectionLines)
              : readExperience(name, sectionLines)
    const entries = result.entries.filter((entry) => Object.values(entry.fields).some((value) => value.trim() !== ""))
    if (entries.length) sectionFor(name).entries.push(...entries)
    addUnplaced(titleCase(label), result.leftover.lines, result.leftover.text)
  })

  // Lines before the first heading that we couldn't read, when there are no headings at all.
  if (starts.length === 0) {
    const rest = lines.filter((line) => line.index >= firstHeading && content(line))
    addUnplaced("Everything else", rest.map((line) => line.index), rest.map(textOf))
  }

  return { lines: input, profile, profileLines, sections, unplaced }
}

/** Builds a resume for the editor from what was found, leaving out entries the user unticked. */
export function toResumeContent(parsed: ParsedResume, skip: Set<string> = new Set()): ResumeContent {
  const resume: ResumeContent = {
    profileSection: { ...parsed.profile },
    headings: {},
    sectionOrder: [
      ...parsed.sections.map((section) => section.name),
      ...SECTION_NAMES.filter((name) => !parsed.sections.some((section) => section.name === name)),
    ],
  }
  for (const name of SECTION_NAMES) {
    const section = parsed.sections.find((found) => found.name === name)
    resume[SECTIONS[name].dataKey] = (section?.entries ?? [])
      .filter((_, index) => !skip.has(entryKey(name, index)))
      .map((entry, index) => ({ id: index + 1, ...blankEntry(name), ...entry.fields }))
  }
  return resume
}

export const entryKey = (section: SectionName, index: number) => `${section}:${index}`
