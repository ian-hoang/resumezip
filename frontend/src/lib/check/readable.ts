// Readable by hiring software (R1–R6 in issue #58): the preview PDF read back
// the way hiring software reads a resume and compared with what was typed,
// and characters that may not come through.

import { SECTIONS, type FieldKey, type FieldKeyOf, type ProfileKey, type SectionName } from "@/components/editor/sections"
import { BULLET_CHARS } from "@/lib/import/lines"
import type { PdfReading, Problem, Rule } from "./engine"
import type { Place } from "./places"
import { comparable, wordsOf } from "./pdf"
import { readDate, readDateRange } from "./readDate"
import { textsOf } from "./resume"
import { FINE_SYMBOLS, ODD_SYMBOLS } from "./settings"
import { layoutBulletsIn } from "./text"
import type { ResumeView } from "./resume"

// An unresolved custom occurrence sharing a builtin heading can contaminate
// the heuristic semantic parse. Do not turn that uncertainty into invented
// jobs, missing fields or an ATS heading accusation against the builtin.
function unresolvedExtraHeadings(resume: ResumeView, pdf: PdfReading): Set<string> {
  return new Set(
    Object.values(resume.extras)
      .filter((extra) => !extra.blank && pdf.extras?.sections.find(({ sectionId }) => sectionId === extra.id)?.status !== "matched")
      .map((extra) => comparable(extra.heading)),
  )
}

function uncertainBuiltinSections(resume: ResumeView, pdf: PdfReading): Set<SectionName> {
  const headings = unresolvedExtraHeadings(resume, pdf)
  const sections = new Set(resume.order.filter((section) => headings.has(comparable(resume.printedHeadings[section]))))
  // Parser provenance covers aliases such as 'Work Experience', not merely
  // the exact default heading printed by our own templates.
  for (const occurrence of pdf.parsed.occurrences ?? [])
    if (occurrence.section && headings.has(comparable(occurrence.heading))) sections.add(occurrence.section)
  return sections
}

// The profile fields a recruiter needs to reach the person.
const CONTACT: { field: ProfileKey; label: string }[] = [
  { field: "fullName", label: "name" },
  { field: "email", label: "email" },
  { field: "phoneNumber", label: "phone number" },
]

const digits = (text: string) => text.replace(/\D/g, "")

// The fewest digits a phone number has anywhere: 7, as in "555-0134".
const PHONE_DIGITS = 7

// Whether the PDF has the phone number. The resume reader only knows how
// North American numbers are usually written, and hiring software reads
// numbers from everywhere else too ("07911 123456", "06 12 34 56 78"), so a
// line with all its digits, in order, will do.
function phoneFound(pdf: PdfReading, value: string): boolean {
  const typed = digits(value)
  if (digits(pdf.parsed.profile.phoneNumber ?? "") === typed) return true
  return typed.length >= PHONE_DIGITS && pdf.lines.some((line) => digits(line.text).includes(typed))
}

const contactRead: Rule = {
  id: "R1",
  category: "readable",
  level: "fix",
  reads: "pdf",
  title: "Hiring software finds your name, email and phone",
  why: "If it can't find them, a recruiter may not see how to reach you.",
  check: ({ resume, pdf }) => {
    const typed = CONTACT.filter(({ field }) => resume.profile[field])
    if (typed.length === 0) return null
    return {
      checked: typed.length,
      problems: typed
        .filter(({ field }) => {
          const value = resume.profile[field]
          return field === "phoneNumber" ? !phoneFound(pdf, value) : comparable(pdf.parsed.profile[field] ?? "") !== comparable(value)
        })
        .map(({ field, label }) => ({
          place: { kind: "profile", field },
          message: `Hiring software can't find your ${label} in the PDF`,
          suggestion: `Keep the field to just your ${label}.`,
        })),
    }
  },
}

const headings: Rule = {
  id: "R2",
  category: "readable",
  level: "fix",
  reads: "pdf",
  title: "Hiring software knows every section heading",
  why: "Hiring software sorts a resume by its headings, and can skip a section under one it doesn't know.",
  check: ({ resume, pdf }) => {
    const printed = resume.order.filter((section) => resume.sections[section].some((entry) => !entry.blank))
    if (printed.length === 0) return null
    const uncertain = uncertainBuiltinSections(resume, pdf)
    const reliable = printed.filter((section) => !uncertain.has(section))
    const found = new Set(pdf.parsed.sections.map(({ name }) => name))
    return {
      checked: reliable.length,
      ...(reliable.length < printed.length && { partial: true }),
      problems: reliable
        .filter((section) => !found.has(section))
        .map((section) => ({
          place: { kind: "heading", section },
          message: `Hiring software may not know “${resume.headings[section] || SECTIONS[section].title}” as a heading`,
          suggestion: `Use a usual one, like “${SECTIONS[section].title}”.`,
        })),
    }
  },
}

// What says what an entry is and when: the fields hiring software reads to
// know the job, school, role, project, skills, paper or award.
const KEY_FIELDS: { [Section in SectionName]: FieldKeyOf<Section>[] } = {
  Work: ["workRole", "companyName", "workStartDate", "workEndDate"],
  Education: ["schoolName", "degree", "schoolStartDate", "schoolEndDate"],
  Skills: ["skillName", "skillDetails"],
  Projects: ["projectName", "projectDate"],
  Publications: ["publicationTitle", "publicationDate"],
  Volunteership: ["volunteerRole", "volunteerOrg", "volunteerStartDate", "volunteerEndDate"],
  Leadership: ["leadershipRole", "leadershipOrg", "leadershipStartDate", "leadershipEndDate"],
  Awards: ["awardName", "awardDate"],
}

const labelOf = (section: SectionName, field: FieldKey) =>
  SECTIONS[section].fields.find((def) => def.key === field)?.label.toLowerCase() ?? field

// A year, or a month and a year, as in "2024" or "Jan 2024".
const HAS_DATE = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+'?\d/i
// Where hiring software can split one value into two: a comma, a bar, a dot or a spaced dash.
const SPLITS = /[,|•·;]|\s[-–—]\s/

/** Why a value may not be read with its entry, from what's in it, and what to do. */
function entryAdvice(section: SectionName, field: FieldKey, value: string): Pick<Problem, "message" | "suggestion"> {
  const label = labelOf(section, field)
  const unread = (suggestion: string) => ({ message: `Hiring software doesn't read the ${label} with this entry`, suggestion })
  if (field.endsWith("Date")) {
    // A date written the usual way has nothing to change.
    if (!readDate(value) && !readDateRange(value)) return unread("Write it the usual way, like “Jan 2024”, “2024” or “Present”.")
  } else if (HAS_DATE.test(value)) {
    return unread("Move the date to the entry's date fields.")
  } else if (SPLITS.test(value)) {
    return unread("Keep it to one thing: hiring software can split it at a comma or a dash. Move the rest to another field or a bullet.")
  }
  // Nothing in it that's known to trip hiring software up.
  return {
    message: `Hiring software may not read the ${label} with this entry`,
    suggestion: "Nothing in it looks wrong, so most hiring software should still read it. If it looks right in the preview, dismiss this.",
  }
}

const entriesRead: Rule = {
  id: "R3",
  category: "readable",
  level: "look",
  reads: "pdf",
  title: "Hiring software reads each entry as typed",
  why: "If a role, company, date or skill lands in another entry, or nowhere, your resume reads wrong.",
  check: ({ resume, pdf }) => {
    let checked = 0
    let partial = false
    const problems: Problem[] = []
    const uncertain = uncertainBuiltinSections(resume, pdf)
    for (const section of resume.order) {
      const keys = KEY_FIELDS[section]
      const typed = resume.sections[section].filter((entry) => !entry.blank)
      if (typed.length === 0) continue
      if (uncertain.has(section)) {
        partial = true
        continue
      }
      const found = pdf.parsed.sections.find(({ name }) => name === section)
      // A section that isn't found at all is R2's.
      if (typed.length === 0 || !found) continue
      if (found.entries.length !== typed.length) {
        checked++
        problems.push({
          place: { kind: "section", section },
          message: `Hiring software reads ${found.entries.length} ${found.entries.length === 1 ? "entry" : "entries"} here, not ${typed.length}`,
          suggestion: "An entry may be running into the next one. Check each has its own role, place and dates.",
        })
        continue
      }
      // Each typed value's words only have to be somewhere in its entry, as
      // read, as whole words: the reader can mix up neighbouring fields that
      // hiring software tells apart, as a role read as the company.
      const fields = SECTIONS[section].fields.filter((field) => field.type !== "bullets")
      typed.forEach((entry, i) => {
        const read = new Set(wordsOf(fields.map((field) => found.entries[i].fields[field.key] ?? "").join(" ")))
        for (const key of keys) {
          const words = wordsOf(entry.values[key])
          if (words.length === 0) continue
          checked++
          if (words.every((word) => read.has(word))) continue
          problems.push({
            place: { kind: "entry", section, entry: entry.index, field: key },
            ...entryAdvice(section, key, entry.values[key]),
          })
        }
      })
    }
    for (const extra of Object.values(resume.extras).filter((extra) => !extra.blank)) {
      const match = pdf.extras?.sections.find((section) => section.sectionId === extra.id)
      // Repeated text can leave it unclear which printed section is this one.
      // That's the checker's uncertainty, not the resume's problem, so it only
      // makes the check partial, as a section it can't tell apart does above.
      if (!match || match.status === "ambiguous") {
        partial = true
        continue
      }
      checked++
      if (match.status === "matched") continue
      problems.push({
        place: { kind: "extra-heading", sectionId: extra.id },
        message: `The checker couldn't verify all the text in “${extra.heading}” in the PDF`,
        suggestion: "Check the section in the preview; the extracted text did not match completely.",
      })
    }
    // Only uncertain sections is still partial, not a rule that doesn't apply.
    return checked || partial ? { checked, problems, ...(partial && { partial }) } : null
  },
}

const short = (text: string) => (text.length > 40 ? `${text.slice(0, 40).trimEnd()}…` : text)

// The shortest typed text that's worth matching inside a line, so a short
// one, like "MI", isn't found in every line.
const MIN_MATCH = 8

/**
 * The field a line the reader couldn't place came from: one whose text holds
 * the whole line, or else the one that makes up the most of it, as a line can
 * be one field printed beside another ("B.S. in Economics    Ann Arbor, MI").
 * Either way, a field in the section it was found under comes first.
 */
function fieldOf(
  texts: { place: Place; text: string; section: SectionName | null }[],
  line: string,
  under: SectionName | null,
): Place | undefined {
  const inSection = (section: SectionName | null) => (section !== null && section === under ? 1 : 0)
  const whole = texts.filter(({ text }) => text.includes(line))
  if (whole.length > 0) return whole.reduce((best, next) => (inSection(next.section) > inSection(best.section) ? next : best)).place
  const parts = texts.filter(({ text }) => text.length >= MIN_MATCH && line.includes(text))
  if (parts.length === 0) return undefined
  return parts.reduce((best, next) => {
    const nearer = inSection(next.section) - inSection(best.section)
    return nearer > 0 || (nearer === 0 && next.text.length > best.text.length) ? next : best
  }).place
}

const unplaced: Rule = {
  id: "R4",
  category: "readable",
  level: "look",
  reads: "pdf",
  title: "Hiring software can place all your text",
  why: "Text it can't place under a section may be left out of what it reads.",
  check: ({ resume, pdf }) => {
    const uncertain = unresolvedExtraHeadings(resume, pdf)
    const texts = textsOf(resume)
      .filter(({ place }) => !("sectionId" in place))
      .map(({ place, text }) => ({
        place,
        text: comparable(text),
        section: place.kind === "entry" || place.kind === "heading" ? place.section : null,
      }))
    // The section each printed heading stands for, to know which section a line was found under.
    const headed = new Map(resume.order.map((section) => [comparable(resume.printedHeadings[section]), section]))
    return {
      checked: 1,
      ...(uncertain.size > 0 && { partial: true }),
      problems: pdf.parsed.unplaced
        .filter((group) => !uncertain.has(comparable(group.heading)))
        .map((group): Problem => {
          // Pointing at the field it came from, when it can be found; text with
          // no letters or digits can't be, so it points at its page.
          const line = comparable(group.text[0] ?? "")
          const typed = line ? fieldOf(texts, line, headed.get(comparable(group.heading)) ?? null) : undefined
          const page: Place = { kind: "page", page: pdf.parsed.lines[group.lines[0]]?.page }
          return {
            place: typed ?? page,
            text: group.text.join(" "),
            message: `Hiring software can't tell where “${short(group.text[0] ?? "")}” belongs`,
            suggestion: "Check it's in the field it's for, without a date or place typed into it.",
          }
        }),
    }
  },
}

// A bullet character typed at the start of a bullet: a symbol, or a dash or
// asterisk before a space, as the resume reader reads them.
const TYPED_BULLET = new RegExp(String.raw`^(?:[${BULLET_CHARS}]|[-–—*](?=\s))`)

const symbols: Rule = {
  id: "R5",
  category: "readable",
  level: "look",
  reads: "form",
  title: "No symbols or emoji that may not come through",
  why: "Hiring software may drop them, or show a box instead.",
  check: ({ resume }) => {
    const texts = textsOf(resume)
    if (texts.length === 0) return null
    return {
      checked: texts.length,
      problems: texts.flatMap(({ place, text }) => {
        // A bullet character typed at the start of a bullet is R6's.
        const body =
          (place.kind === "entry" || place.kind === "extra-text") && place.line !== undefined ? text.replace(TYPED_BULLET, "") : text
        const found = [...body].find((char) => ODD_SYMBOLS.test(char) && !FINE_SYMBOLS.includes(char))
        return found ? [{ place, message: `“${found}” may not come through`, suggestion: "Leave it out, or say it in words." }] : []
      }),
    }
  },
}

const typedBullets: Rule = {
  id: "R6",
  category: "readable",
  level: "fix",
  reads: "form",
  title: "No bullet characters typed into bullets",
  why: "The template adds the bullet, so a typed one shows twice.",
  check: ({ resume }) => {
    const bullets = layoutBulletsIn(resume)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ bullet, place }) => {
        const found = TYPED_BULLET.exec(bullet.raw)?.[0]
        return found
          ? [{ place, message: `Starts with “${found}”, so it shows two bullets`, suggestion: "Delete it: the template adds the bullet." }]
          : []
      }),
    }
  },
}

export const READABLE_RULES: readonly Rule[] = [contactRead, headings, entriesRead, unplaced, symbols, typedBullets]
