// Maps the editor's resume data onto the shape the Typst templates read from
// /resume.json (see templates/common.typ). Every field is always present, so
// the templates never have to handle missing values. Values are passed as
// plain JSON strings, which Typst never evaluates as markup, so no escaping
// is needed.

import { templateById, type TemplateId } from "@/lib/templates"

export type { TemplateId }

export const DEFAULT_SECTION_ORDER = ["Education", "Work", "Skills", "Projects", "Publications", "Volunteership", "Leadership", "Awards"]

export interface TemplateData {
  profile: { name: string; location: string; phone: string; email: string; linkedin: string; github: string; website: string }
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
  work: { company: string; location: string; role: string; start: string; end: string; bullets: string[] }[]
  /** `link` is set when the name links somewhere; `links` are printed as text. */
  projects: { name: string; link: string; links: string[]; techStack: string; date: string; bullets: string[] }[]
  publications: { title: string; authors: string; venue: string; date: string; link: string }[]
  skills: { name: string; details: string }[]
  leadership: Experience[]
  volunteer: Experience[]
  awards: { name: string; organization: string; date: string }[]
}

interface Experience {
  organization: string
  location: string
  role: string
  start: string
  end: string
  bullets: string[]
}

type Entry = Record<string, unknown>

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

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

// Maps a section's entries, dropping ones the user added but left blank.
function entries<T extends Record<string, string | string[]>>(value: unknown, map: (entry: Entry) => T): T[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => map(entry && typeof entry === "object" ? entry : {}))
    .filter((entry) => Object.values(entry).some((field) => field.length > 0))
}

export function templateIdOf(value: unknown): TemplateId {
  return templateById(value).id
}

export function toTemplateData(resume: Record<string, any>): TemplateData {
  const profile = resume.profileSection ?? {}
  const headings = resume.headings ?? {}
  const order = Array.isArray(resume.sectionOrder) ? resume.sectionOrder : DEFAULT_SECTION_ORDER
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
    order: order.filter((section: unknown) => DEFAULT_SECTION_ORDER.includes(section as string)),
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
    publications: entries(resume.publicationsSection, (e) => ({
      title: text(e.publicationTitle),
      authors: text(e.publicationAuthors),
      venue: text(e.publicationVenue),
      date: text(e.publicationDate),
      link: bareUrl(e.publicationLink),
    })),
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
