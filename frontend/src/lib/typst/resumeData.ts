// Maps the editor's resume data onto the shape the Typst templates read from
// /resume.json (see templates/common.typ). Every field is always present, so
// the templates never have to handle missing values. Values are passed as
// plain JSON strings, which Typst never evaluates as markup, so no escaping
// is needed.

import { SECTIONS, type SectionName } from "@/components/editor/sections"
import { printedResume } from "@/lib/leftOut"
import { markedPieces, sameStyle } from "@/lib/marks"
import type { Entry, Resume } from "@/lib/resume"
import { extraHeading, extrasOf, resolveSections } from "@/lib/resumeSections"
import { templateById, type TemplateId } from "@/lib/templates"
import { printedTune, type PrintedTune } from "@/lib/tune"

export type { TemplateId }

export interface TemplateData {
  /** Fine-tune's settings, each there (see templates/common.typ). */
  tune: PrintedTune
  profile: { name: string; location: string; phone: string; email: string; linkedin: string; github: string; website: string }
  /** The profile's summary, printed under its own heading above the sections. */
  summary: Paragraph[]
  headings: {
    education: string
    work: string
    projects: string
    publications: string
    skills: string
    leadership: string
    volunteer: string
    awards: string
  }
  order: string[]
  /** Text and list sections the person added, by their `extra:<id>` in `order`. */
  extras: Record<string, ExtraTemplateSection>
  education: {
    school: string
    location: string
    degree: string
    gpa: string
    start: string
    end: string
    coursework: string
    involvement: string
  }[]
  work: { company: string; location: string; role: string; start: string; end: string; bullets: Run[][] }[]
  /** `link` is set when the name links somewhere; `links` are printed as text. */
  projects: { name: string; link: string; links: string[]; techStack: string; start: string; end: string; bullets: Run[][] }[]
  /** Printed as citations; `doi` is set instead of `link` when the link is a DOI. */
  publications: { title: string; authors: AuthorPiece[]; venue: string; details: string; date: string; doi: string; link: string }[]
  skills: { name: string; details: string }[]
  leadership: Experience[]
  volunteer: Experience[]
  awards: { name: string; organization: string; date: string }[]
}

export type ExtraTemplateSection =
  { kind: "text"; heading: string; paragraphs: Paragraph[] } | { kind: "list"; heading: string; bullets: Run[][] }

/**
 * A stretch of a bullet's or a paragraph's text, styled as the user marked it
 * (lib/marks.ts). `underline` and `link` are only there when set, and a link
 * is a full address (https:// or mailto:), printed on its words alone.
 */
export interface Run {
  text: string
  bold: boolean
  italic: boolean
  underline?: true
  link?: string
}

/** A paragraph of prose (a summary's, or a text section's): its lines, each in runs. */
export type Paragraph = Run[][]

/** A piece of an author list: a name, or the text between names. `me` marks the resume owner's name. */
interface AuthorPiece {
  text: string
  me: boolean
}

interface Experience {
  organization: string
  location: string
  role: string
  start: string
  end: string
  bullets: Run[][]
}

// An entry as saved: older resumes can lack any of its fields.
type Saved = Partial<Entry>

// What an opened file or a paste can bring that no template prints, and the
// LaTeX file drops too: half of an emoji (a surrogate without its pair), which
// JSON.stringify writes as an escape Typst's json() won't read, so no template
// could print the resume; and control characters other than tab and line
// breaks, which print as boxes. With the u flag, \p{Cs} only matches a
// surrogate that isn't part of a pair, so whole emoji are kept.
const UNPRINTABLE = /[\p{Cs}\0-\x08\x0B\x0C\x0E-\x1F\x7F]/gu

// ﬀ ﬁ ﬂ ﬃ ﬄ ﬅ ﬆ, which NFKC spells out as letters.
const LIGATURES = /[\uFB00-\uFB06]/gu

// Characters that print nothing, of which trim() only removes U+FEFF. A field
// of only these is empty, so it doesn't print an empty heading or bullet.
const INVISIBLE = /^[\s\u00AD\u200B\u2060\uFEFF]*$/

/**
 * A field as printed. Letters are composed (NFC), since Lato has no combining
 * marks: "e" and a separate accent, as macOS, PDFs and some Vietnamese
 * keyboards type it, prints as boxes in its templates. Control characters are
 * dropped first, so one between a letter and its accent doesn't keep them
 * apart. Typst prints a tab as nothing, so it's a space, as in the Word and
 * LaTeX files. A ligature character (ﬁ, ﬂ, ...), as text copied from a PDF
 * brings, prints as its letters: Typst gives a glyph one character in the PDF's
 * text, so a typed "ﬁ" would make every "fi" the font joins read as "ﬁ", and
 * "final" couldn't be found. Saved data stays as typed.
 */
function text(value: unknown): string {
  if (typeof value !== "string") return ""
  const printed = value
    .replace(UNPRINTABLE, "")
    .normalize("NFC")
    .replace(LIGATURES, (sign) => sign.normalize("NFKC"))
    .replace(/\t/g, " ")
    .trim()
  return INVISIBLE.test(printed) ? "" : printed
}

// Prose as paragraphs, split at blank lines. A single line break stays in its
// paragraph. Each line is read for **bold** and *italic* words on its own, as
// a bullet is, and as the editor's box saves them.
const paragraphs = (value: unknown): Paragraph[] =>
  text(value)
    .split(/\r?\n\s*\r?\n/)
    .map(text)
    .filter(Boolean)
    .map((paragraph) => paragraph.split("\n").map((line) => runs(line)))

// Links are displayed without their scheme, "www." or a trailing slash; the
// templates add https:// back.
const bareUrl = (value: unknown) =>
  text(value)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")

// Descriptions are typed one bullet per line, each prefixed with "• ".
const bullets = (value: unknown) =>
  (Array.isArray(value) ? value.map(text) : text(value).split("\n"))
    .map((line) => text(line.trim().replace(/^•\s*/, "")))
    .filter(Boolean)
    .map((line) => runs(line))

// The pieces of a line, with neighbours in the same style joined.
function runs(line: string): Run[] {
  const out: Run[] = []
  for (const { at, ...piece } of markedPieces(line)) {
    const last = out[out.length - 1]
    if (last && sameStyle(last, piece)) last.text += piece.text
    else out.push(piece)
  }
  return out
}

/** A bullet's words as printed, without its marks. */
export const plainText = (line: string) =>
  runs(line)
    .map((run) => run.text)
    .join("")

/** Prose (a summary, a text section) as printed, line by line, without its marks. */
export const plainProse = (value: string) => value.split("\n").map(plainText).join("\n")

// For matching names: lower case, without accents.
const plain = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

// What separates names in an author list: commas, "and", "&" and a closing "et al."
const AUTHOR_SEPARATOR = /(,\s*(?:and\s+|&\s*)?|\s+(?:and|&)\s+|\s+et al\.?\s*$)/i

/**
 * Whether a name in an author list is the resume owner's. "R. Conde",
 * "Rafael Conde" and "Conde, R." all match Rafael Conde.
 */
export function ownerMatcher(owner: string): (name: string) => boolean {
  const names = plain(owner).split(/\s+/).filter(Boolean)
  const last = names[names.length - 1]
  return (name) => {
    const words = plain(name)
      .split(/[\s.,]+/)
      .filter(Boolean)
    if (names.length < 2) return names.length === 1 && words.length === 1 && words[0] === last
    return words.includes(last) && words.some((word) => word !== last && word[0] === names[0][0])
  }
}

/**
 * Splits an author list into names and separators, marking the resume
 * owner's name so it can be printed in bold.
 */
function authorPieces(value: unknown, owner: string): AuthorPiece[] {
  const authors = text(value)
  if (!authors) return []
  const isOwner = ownerMatcher(owner)
  return authors
    .split(AUTHOR_SEPARATOR)
    .filter(Boolean)
    .map((piece) => ({ text: piece, me: !AUTHOR_SEPARATOR.test(piece) && isOwner(piece) }))
}

/** A DOI on its own ("10.1145/3580305"), after "doi:", or as a doi.org link without its "https://". */
export function doiOf(link: string): string {
  const doi = link.replace(/^doi:\s*/i, "").replace(/^(?:dx\.)?doi\.org\//i, "")
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : ""
}

// Maps a section's entries, dropping ones the user added but left blank.
function entries<T extends Record<string, string | unknown[]>>(value: unknown, map: (entry: Saved) => T): T[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => map(entry && typeof entry === "object" ? (entry as Saved) : {}))
    .filter((entry) => Object.values(entry).some((field) => field.length > 0))
}

export function templateIdOf(value: unknown): TemplateId {
  return templateById(value).id
}

export function toTemplateData(saved: Resume): TemplateData {
  // What the person left out isn't printed.
  const resume = printedResume(saved)
  const profile = resume.profileSection ?? {}
  const headings = resume.headings ?? {}
  // Project links are printed as text, unless the user chose to link each project's name.
  const linkTitles = resume.projectLinks === "title"

  return {
    tune: printedTune(resume.tune),
    profile: {
      name: text(profile.fullName),
      location: text(profile.location),
      phone: text(profile.phoneNumber),
      email: text(profile.email),
      linkedin: bareUrl(profile.linkedin),
      github: bareUrl(profile.profileGithub),
      website: bareUrl(profile.personalWebsite),
    },
    summary: paragraphs(profile.summary),
    headings: {
      education: text(headings.edu),
      work: text(headings.work),
      projects: text(headings.projects),
      publications: text(headings.publications),
      skills: text(headings.skills),
      leadership: text(headings.leadership),
      volunteer: text(headings.volunteer),
      awards: text(headings.awards),
    },
    order: resolveSections(resume),
    extras: Object.fromEntries(
      Object.entries(extrasOf(resume))
        .map(([id, section]): [string, ExtraTemplateSection] => {
          const heading = extraHeading({ ...section, heading: text(section.heading) })
          const printable: ExtraTemplateSection =
            section.kind === "list"
              ? { kind: "list", heading, bullets: bullets(section.bullets) }
              : {
                  kind: "text",
                  heading,
                  paragraphs: paragraphs(section.text),
                }
          return [`extra:${id}`, printable]
        })
        // A section with nothing to print, as one of only invisible characters, would print a bare heading.
        .filter(([, printable]) => (printable.kind === "list" ? printable.bullets : printable.paragraphs).length > 0),
    ),
    education: entries(resume.educationSection, (e) => ({
      school: text(e.schoolName),
      location: text(e.schoolLocation),
      degree: text(e.degree),
      gpa: text(e.gpa),
      start: text(e.schoolStartDate),
      end: text(e.schoolEndDate),
      coursework: text(e.coursework),
      involvement: text(e.involvement),
    })),
    work: entries(resume.workExperienceSection, (e) => ({
      company: text(e.companyName),
      location: text(e.workLocation),
      role: text(e.workRole),
      start: text(e.workStartDate),
      end: text(e.workEndDate),
      bullets: bullets(e.workDescription),
    })),
    projects: entries(resume.projectsSection, (e) => {
      const urls = [bareUrl(e.projectGithub), bareUrl(e.additionalLink)].filter(Boolean)
      const name = text(e.projectName)
      // A project without a name has nothing to link, so its links are printed.
      const titled = linkTitles && name !== ""
      return {
        name,
        link: titled ? (urls[0] ?? "") : "",
        links: titled ? [] : urls,
        techStack: text(e.techStack),
        start: text(e.projectStartDate),
        end: text(e.projectEndDate),
        bullets: bullets(e.projectDescription),
      }
    }),
    publications: entries(resume.publicationsSection, (e) => {
      const link = bareUrl(e.publicationLink)
      const doi = doiOf(link)
      return {
        title: text(e.publicationTitle),
        authors: authorPieces(e.publicationAuthors, text(profile.fullName)),
        venue: text(e.publicationVenue),
        details: text(e.publicationDetails),
        date: text(e.publicationDate),
        doi,
        link: doi ? "" : link,
      }
    }),
    skills: entries(resume.skillsSection, (e) => ({
      name: text(e.skillName),
      details: text(e.skillDetails),
    })),
    leadership: entries(resume.leadershipExperienceSection, (e) => ({
      organization: text(e.leadershipOrg),
      location: text(e.leadershipLocation),
      role: text(e.leadershipRole),
      start: text(e.leadershipStartDate),
      end: text(e.leadershipEndDate),
      bullets: bullets(e.leadershipDescription),
    })),
    volunteer: entries(resume.volunteerExperienceSection, (e) => ({
      organization: text(e.volunteerOrg),
      location: text(e.volunteerLocation),
      role: text(e.volunteerRole),
      start: text(e.volunteerStartDate),
      end: text(e.volunteerEndDate),
      bullets: bullets(e.volunteerDescription),
    })),
    awards: entries(resume.awardsSection, (e) => ({
      name: text(e.awardName),
      organization: text(e.awardOrg),
      date: text(e.awardDate),
    })),
  }
}

/** Where each section's entries and heading are in TemplateData. */
const SECTION_KEYS: Record<SectionName, keyof TemplateData["headings"]> = {
  Education: "education",
  Work: "work",
  Projects: "projects",
  Publications: "publications",
  Skills: "skills",
  Leadership: "leadership",
  Volunteership: "volunteer",
  Awards: "awards",
}

/** A section with something to print, and its heading. */
export type PrintedSection = { heading: string; name: string } & (
  { kind: "extra"; extra: ExtraTemplateSection } | { kind: keyof TemplateData["headings"] }
)

/**
 * The resume's sections in its order, each with something to print, and the
 * heading it prints: the one the person wrote, or the one every template
 * prints (`heading-or` in the .typ files). The summary isn't one; it's in
 * `summary`.
 */
export function printedSections(data: TemplateData): PrintedSection[] {
  return data.order.flatMap((name): PrintedSection[] => {
    const extra = data.extras[name]
    if (extra) return [{ kind: "extra", name, heading: extra.heading, extra }]
    const kind = SECTION_KEYS[name as SectionName]
    if (!kind || data[kind].length === 0) return []
    return [{ kind, name, heading: data.headings[kind] || SECTIONS[name as SectionName].title }]
  })
}
