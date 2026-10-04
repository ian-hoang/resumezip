// Maps the editor's resume data onto the shape the Typst templates read from
// /resume.json (see templates/common.typ). Every field is always present, so
// the templates never have to handle missing values. Values are passed as
// plain JSON strings, which Typst never evaluates as markup, so no escaping
// is needed.

import { templateById, type TemplateId } from "@/lib/templates"

export type { TemplateId }

export const DEFAULT_SECTION_ORDER = ["Education", "Work", "Skills", "Projects", "Volunteership", "Leadership", "Awards"]

export interface TemplateData {
  profile: { name: string; phone: string; email: string; linkedin: string; github: string; website: string }
  headings: {
    education: string
    work: string
    projects: string
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
  projects: { name: string; techStack: string; date: string; github: string; website: string; bullets: string[] }[]
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

// Links are displayed without their scheme; the templates add https:// back.
const bareUrl = (value: unknown) => text(value).replace(/^https?:\/\/(www\.)?/i, "")

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

  return {
    profile: {
      name: text(profile.fullName),
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
    projects: entries(resume.projectsSection, (e) => ({
      name: text(e.projectName),
      techStack: text(e.techStack),
      date: text(e.projectDate),
      github: bareUrl(e.projectGithub),
      website: bareUrl(e.additionalLink),
      bullets: bullets(e.projectDescription),
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
