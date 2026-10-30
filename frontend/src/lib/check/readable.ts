// Readable by hiring software (R1–R6 in issue #58, R7 and R8): the preview PDF
// read back the way hiring software reads a resume and compared with what was
// typed, characters that may not come through or don't print at all, and
// links that don't print.

import { SECTIONS, type FieldKey, type FieldKeyOf, type ProfileKey, type SectionName } from "@/components/editor/sections"
import { count } from "@/lib/count"
import { BULLET_CHARS } from "@/lib/import/lines"
import { noFontHas } from "@/lib/typst/fontFiles"
import type { PdfReading, Problem, Rule } from "./engine"
import { labelOf } from "./labels"
import type { Place } from "./places"
import { comparable, wordsOf } from "./pdf"
import { readDate, readDateRange } from "./readDate"
import { entryAt, textsOf, type ResumeView } from "./resume"
import { FINE_SYMBOLS, MIN_PHONE_MATCH, ODD_SYMBOLS } from "./settings"
import { layoutBulletsIn } from "./text"

// What the resume reader reads in place of each character no font had, as pdf.js reads it.
const NOT_PRINTED = "\0"

/** A symbol or emoji that may not come through (R5's). */
const oddSymbol = (char: string) => ODD_SYMBOLS.test(char) && !FINE_SYMBOLS.includes(char)

/** A character no template prints, as no font has it, other than a symbol or emoji (R8's). */
const unprintable = (char: string) => noFontHas(char) && !oddSymbol(char)

/** A typed value as far as the PDF can hold it: without the characters no font has. */
const printedPart = (text: string) => [...text.normalize("NFC")].filter((char) => !noFontHas(char)).join("")

/**
 * The typed text the PDF prints as text: all of it but a project's links with
 * “Link the title” chosen, which go behind its name instead (R7).
 */
const printedTextsOf = (resume: ResumeView) =>
  textsOf(resume).filter(
    ({ place }) =>
      !(
        resume.projectLinks === "title" &&
        place.kind === "entry" &&
        place.section === "Projects" &&
        (place.field === "projectGithub" || place.field === "additionalLink") &&
        entryAt(resume, "Projects", place.entry)?.values.projectName
      ),
  )

/**
 * Whether the text printed in sections prints: headings, entries, bullets,
 * the summary and sections the person added. What doesn't (R8's) reads as
 * nothing, which can throw out how the reader splits the sections and entries
 * around it, so R2–R4 can't tell the resume's problems from the missing
 * text's, and wait until it prints.
 */
const sectionsPrint = (resume: ResumeView) =>
  printedTextsOf(resume).every(
    ({ place, text }) => (place.kind === "profile" && place.field !== "summary") || ![...text.normalize("NFC")].some(unprintable),
  )

// The titles of the added sections not found for sure (extraPdf.ts). One
// that shares its title with one of the editor's sections may have been read
// as that section, so R2–R4 leave that section alone and are `partial`.
function unresolvedExtraHeadings(resume: ResumeView, pdf: PdfReading): Set<string> {
  return new Set(
    Object.values(resume.extras)
      .filter((extra) => !extra.blank && pdf.extras?.sections.find(({ sectionId }) => sectionId === extra.id)?.status !== "matched")
      .map((extra) => comparable(extra.heading)),
  )
}

// The editor's sections an added section not found for sure may have been read as.
function sectionsInDoubt(resume: ResumeView, pdf: PdfReading): Set<SectionName> {
  const headings = unresolvedExtraHeadings(resume, pdf)
  const sections = new Set(resume.order.filter((section) => headings.has(comparable(resume.printedHeadings[section]))))
  // The reader also knows other titles (“Work Experience”), so go by where it
  // found each section too.
  for (const occurrence of pdf.parsed.occurrences)
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

// Whether the PDF has the phone number. The resume reader only knows how
// North American numbers are usually written, and hiring software reads
// numbers from everywhere else too ("07911 123456", "06 12 34 56 78"), so a
// line with all its digits, in order, will do.
function phoneFound(pdf: PdfReading, value: string): boolean {
  const typed = digits(value)
  if (digits(pdf.parsed.profile.phoneNumber ?? "") === typed) return true
  return typed.length >= MIN_PHONE_MATCH && pdf.lines.some((line) => digits(line.text).includes(typed))
}

const contactRead: Rule = {
  id: "R1",
  category: "readable",
  level: "fix",
  reads: "pdf",
  title: "Hiring software finds your name, email and phone",
  why: "If it can't find them, a recruiter may not see how to reach you.",
  check: ({ resume, pdf }) => {
    // Only what prints can be found in the PDF; R8 says what doesn't.
    const typed = CONTACT.flatMap((contact) => {
      const value = printedPart(resume.profile[contact.field]).trim()
      return value ? [{ ...contact, value }] : []
    })
    if (typed.length === 0) return null
    return {
      checked: typed.length,
      problems: typed
        .filter(({ field, value }) =>
          field === "phoneNumber" ? !phoneFound(pdf, value) : comparable(pdf.parsed.profile[field] ?? "") !== comparable(value),
        )
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
    if (!sectionsPrint(resume)) return { checked: 0, problems: [], partial: true }
    const uncertain = sectionsInDoubt(resume, pdf)
    const reliable = printed.filter((section) => !uncertain.has(section))
    const found = new Set(pdf.parsed.sections.map(({ name }) => name))
    return {
      checked: reliable.length,
      ...(reliable.length < printed.length && { partial: true }),
      problems: reliable
        .filter((section) => !found.has(section))
        .map((section) => ({
          place: { kind: "heading", section },
          message: `Hiring software may not know “${resume.printedHeadings[section]}” as a heading`,
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
  Projects: ["projectName", "projectStartDate", "projectEndDate"],
  Publications: ["publicationTitle", "publicationDate"],
  Volunteership: ["volunteerRole", "volunteerOrg", "volunteerStartDate", "volunteerEndDate"],
  Leadership: ["leadershipRole", "leadershipOrg", "leadershipStartDate", "leadershipEndDate"],
  Awards: ["awardName", "awardDate"],
}

// A year, or a month and a year, as in "2024" or "Jan 2024".
const HAS_DATE = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+'?\d/i
// Where hiring software can split one value into two: a comma, a bar, a dot or a spaced dash.
const SPLITS = /[,|•·;]|\s[-–—]\s/

/** Why a value may not be read with its entry, from what's in it, and what to do. */
function entryAdvice(section: SectionName, field: FieldKey, value: string): Pick<Problem, "message" | "suggestion"> {
  const label = labelOf(section, field).toLowerCase()
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
    if (!sectionsPrint(resume)) return { checked: 0, problems: [], partial: true }
    let checked = 0
    let partial = false
    const problems: Problem[] = []
    const uncertain = sectionsInDoubt(resume, pdf)
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
      if (!found) continue
      if (found.entries.length !== typed.length) {
        checked++
        problems.push({
          place: { kind: "section", section },
          message: `Hiring software reads ${count(found.entries.length, "entry", "entries")} here, not ${typed.length}`,
          suggestion:
            section === "Projects"
              ? "A project may be running into the next one. Check each has its own name."
              : "An entry may be running into the next one. Check each has its own role, place and dates.",
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
        message: `Hiring software doesn't read “${extra.heading}” as typed`,
        suggestion: "Check the section in the preview.",
      })
    }
    // With only sections it can't be sure of, it's partial, not a rule that doesn't apply.
    return checked || partial ? { checked, problems, ...(partial && { partial }) } : null
  },
}

// Cut at a character, not a code unit, so half of an emoji or a rarer Chinese character isn't left.
const short = (text: string) => {
  const chars = [...text]
  return chars.length > 40 ? `${chars.slice(0, 40).join("").trimEnd()}…` : text
}

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
    if (!sectionsPrint(resume)) return { checked: 0, problems: [], partial: true }
    const uncertain = unresolvedExtraHeadings(resume, pdf)
    const texts = textsOf(resume)
      .filter(({ place }) => place.kind !== "extra-heading" && place.kind !== "extra-text")
      .map(({ place, text }) => ({
        place,
        text: comparable(text),
        section: place.kind === "entry" || place.kind === "heading" ? place.section : null,
      }))
    // The section each printed heading stands for, to know which section a line was found under.
    const headed = new Map(resume.order.map((section) => [comparable(resume.printedHeadings[section]), section]))
    // Text read with characters that didn't print, as a contact detail of
    // R8's or an emoji of R5's, can't be told apart from what's around it.
    const misread = (group: PdfReading["parsed"]["unplaced"][number]) =>
      [group.heading, ...group.text].some((text) => text.includes(NOT_PRINTED))
    return {
      checked: 1,
      ...((uncertain.size > 0 || pdf.parsed.unplaced.some(misread)) && { partial: true }),
      problems: pdf.parsed.unplaced
        .filter((group) => !uncertain.has(comparable(group.heading)) && !misread(group))
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
        const found = [...body].find(oddSymbol)
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

const projectLinks: Rule = {
  id: "R7",
  category: "readable",
  level: "look",
  reads: "form",
  title: "Project links printed as text",
  why: "On paper, and to hiring software reading the text, a link behind a name doesn't show.",
  check: ({ resume }) => {
    // A project's name only carries its link with "Link the title" chosen, and only when it has a name (typst/resumeData.ts).
    if (resume.projectLinks !== "title") return null
    const linked = resume.sections.Projects.filter(
      ({ blank, values }) => !blank && values.projectName && (values.projectGithub || values.additionalLink),
    )
    if (linked.length === 0) return null
    return {
      checked: linked.length,
      problems: linked.map((entry) => {
        const { projectGithub, additionalLink } = entry.values
        return {
          place: { kind: "entry", section: "Projects", entry: entry.index, field: projectGithub ? "projectGithub" : "additionalLink" },
          // The name links to the GitHub, so a website next to it isn't printed or linked at all.
          message: projectGithub && additionalLink ? "Link not printed, and its website left out" : "Link not printed",
          suggestion: "Choose “Show the link” under Projects → Links.",
        }
      }),
    }
  },
}

// Between two characters that don't print, what keeps them one stretch of
// text: spaces, as between a name's words, and invisible joiners.
const JOINS = /[\s\p{Default_Ignorable_Code_Point}]/u

/**
 * The stretches of a text no font has, as typed, once each: the characters
 * none has, run together with the spaces between them, so a name in two words
 * is one. Symbols and emoji are R5's.
 */
function unprinted(text: string): string[] {
  const runs = new Set<string>()
  let run = ""
  let gap = ""
  for (const char of text.normalize("NFC")) {
    if (unprintable(char)) {
      run += gap + char
      gap = ""
    } else if (run && JOINS.test(char)) {
      gap += char
    } else {
      if (run) runs.add(run)
      run = gap = ""
    }
  }
  if (run) runs.add(run)
  return [...runs]
}

/**
 * Whether a stretch that doesn't print is letters in a style of their own, as
 * 𝐁𝐨𝐥𝐝 from a fancy text generator or Ｆｕｌｌ from a Chinese keyboard, whose
 * plain letters (NFKC) do print.
 */
function lookAlike(run: string): boolean {
  const plain = run.normalize("NFKC")
  return plain !== run && ![...plain].some(noFontHas)
}

/** A few texts, quoted, as “a”, “a” and “b”, “a”, “b” and “c”, or “a”, “b” and 3 more. */
function quoted(texts: string[]): string {
  const each = texts.map((text) => `“${short(text)}”`)
  if (each.length === 1) return each[0]
  if (each.length <= 3) return `${each.slice(0, -1).join(", ")} and ${each.at(-1)}`
  return `${each.slice(0, 2).join(", ")} and ${each.length - 2} more`
}

const printable: Rule = {
  id: "R8",
  category: "readable",
  level: "fix",
  reads: "form",
  title: "Every character prints",
  why: "The templates' fonts don't have these characters, so the PDF leaves them out or prints boxes, and hiring software can't read them.",
  check: ({ resume }) => {
    const texts = printedTextsOf(resume)
    if (texts.length === 0) return null
    return {
      checked: texts.length,
      problems: texts.flatMap(({ place, text }) => {
        const runs = unprinted(text)
        if (runs.length === 0) return []
        // Which characters, and that it's the fonts, not the typing: else it
        // reads as if the person got their own name wrong. Unless they're
        // letters in a style pasted in, whose plain letters print.
        return [
          {
            place,
            message: `${quoted(runs)} ${runs.length === 1 ? "doesn't" : "don't"} print`,
            suggestion: runs.every(lookAlike)
              ? "These look like letters but aren't, so no font has them. Type them as plain letters."
              : "Your typing is fine. For now, write it in Latin letters.",
          },
        ]
      }),
    }
  },
}

export const READABLE_RULES: readonly Rule[] = [
  contactRead,
  headings,
  entriesRead,
  unplaced,
  symbols,
  typedBullets,
  projectLinks,
  printable,
]
