// Maps the editor's resume data onto the shape the Typst templates read from
// /resume.json (see templates/common.typ). Every field is always present, so
// the templates never have to handle missing values. Values are passed as
// plain JSON strings, which Typst never evaluates as markup, so no escaping
// is needed.

import { printedResume } from "@/lib/leftOut"
import type { Entry, Resume } from "@/lib/resume"
import { extraHeading, extraHasBody, extrasOf, resolveSections } from "@/lib/resumeSections"
import { templateById, type TemplateId } from "@/lib/templates"

export type { TemplateId }

export interface TemplateData {
  profile: { name: string; location: string; phone: string; email: string; linkedin: string; github: string; website: string }
  /** The profile's summary, printed under its own heading above the sections. */
  summary: string[]
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
  /** New section kinds only; built-in data and rendering keep their existing shapes. */
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
  projects: { name: string; link: string; links: string[]; techStack: string; date: string; bullets: Run[][] }[]
  /** Printed as citations; `doi` is set instead of `link` when the link is a DOI. */
  publications: { title: string; authors: AuthorPiece[]; venue: string; details: string; date: string; doi: string; link: string }[]
  skills: { name: string; details: string }[]
  leadership: Experience[]
  volunteer: Experience[]
  awards: { name: string; organization: string; date: string }[]
}

export type ExtraTemplateSection =
  { kind: "text"; heading: string; paragraphs: string[] } | { kind: "list"; heading: string; bullets: Run[][] }

/** A stretch of a bullet's text: **bold**, *italic* or ***both*** where the user marked it. */
interface Run {
  text: string
  bold: boolean
  italic: boolean
}

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

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

// Prose as paragraphs, split at blank lines. A single line break stays in its paragraph.
const paragraphs = (value: unknown) =>
  text(value)
    .split(/\r?\n\s*\r?\n/)
    .filter(Boolean)

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
    .map((line) => line.trim().replace(/^•\s*/, ""))
    .filter(Boolean)
    .map((line) => runs(line))

// ***both***, **bold** or *italic*. A marker has to touch its words, so the
// one in "2 * 3", or one without a pair, stays as typed. Each mark ends at
// the first marker that can close it, so "**C** and **Go**" is two bold words.
const MARKED = /\*\*\*(\S(?:[\s\S]*?\S)??)\*\*\*|\*\*(\S(?:[\s\S]*?\S)??)\*\*|\*([^\s*](?:[^*]*?[^\s*])?)\*/g

// "Optimized a **Rust** engine for *low latency*" in plain, bold and italic
// pieces. Marks can sit inside each other: "**bold with *italic* inside**".
function runs(line: string, bold = false, italic = false): Run[] {
  const out: Run[] = []
  const add = (text: string) => {
    const last = out[out.length - 1]
    if (last && last.bold === bold && last.italic === italic) last.text += text
    else if (text) out.push({ text, bold, italic })
  }
  let at = 0
  for (const match of line.matchAll(MARKED)) {
    add(line.slice(at, match.index))
    const [, both, strong, emph] = match
    for (const run of both !== undefined
      ? runs(both, true, true)
      : strong !== undefined
        ? runs(strong, true, italic)
        : runs(emph, bold, true)) {
      const last = out[out.length - 1]
      if (last && last.bold === run.bold && last.italic === run.italic) last.text += run.text
      else out.push(run)
    }
    at = match.index! + match[0].length
  }
  add(line.slice(at))
  return out
}

/** A bullet's words as printed, without its bold and italic marks. */
export const plainText = (line: string) =>
  runs(line)
    .map((run) => run.text)
    .join("")

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
        .filter(([, section]) => extraHasBody(section))
        .map(([id, section]) => {
          const heading = extraHeading(section)
          const printable: ExtraTemplateSection =
            section.kind === "list"
              ? { kind: "list", heading, bullets: bullets(section.bullets) }
              : {
                  kind: "text",
                  heading,
                  paragraphs: paragraphs(section.text),
                }
          return [`extra:${id}`, printable]
        }),
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
        date: text(e.projectDate),
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
