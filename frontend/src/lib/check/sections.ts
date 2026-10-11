// Sections & entries (S1–S9 in issue #58, and S10): what the resume has, and
// whether each entry says what it is and where it was.

import { SECTIONS, type FieldKey, type FieldKeyOf, type SectionName } from "@/components/editor/sections"
import type { Problem, Rule } from "./engine"
import { LOCATION_FIELDS, type Place } from "./places"
import { datesOf } from "./readDate"
import { textsOf, type Entry, type ResumeView } from "./resume"
import {
  COLLEGE_DEGREE,
  COLLEGE_NAME,
  EARLY_CAREER_YEARS,
  FRESHMAN_YEARS_LEFT,
  HIGH_SCHOOL_NAME,
  MAX_COURSES,
  MAX_SKILLS_PER_LINE,
  REFERENCES_ON_REQUEST,
  SCHOOL_YEAR_STARTS,
} from "./settings"

const at = (entry: Entry, field?: FieldKey): Place => ({ kind: "entry", section: entry.section, entry: entry.index, field })

const filled = (entries: Entry[]) => entries.filter((entry) => !entry.blank)

// The sections that show what the person has done.
const EXPERIENCE: SectionName[] = ["Work", "Projects", "Leadership", "Volunteership"]

// What says what an entry is: its role and company, its school and degree.
const NAMED_BY: { [Section in SectionName]?: FieldKeyOf<Section>[] } = {
  Education: ["schoolName", "degree"],
  Work: ["workRole", "companyName"],
  Projects: ["projectName"],
  Publications: ["publicationTitle"],
  Volunteership: ["volunteerRole", "volunteerOrg"],
  Leadership: ["leadershipRole", "leadershipOrg"],
  Awards: ["awardName"],
}

const labelOf = (section: SectionName, field: FieldKey) => SECTIONS[section].fields.find((def) => def.key === field)?.label ?? field

/**
 * The items in a list typed with commas, semicolons or bars, leaving those
 * inside brackets alone: "Excel (pivot tables, VLOOKUP)" is one item.
 */
export function listOf(text: string): string[] {
  const items: string[] = []
  let item = ""
  let depth = 0
  for (const char of text) {
    if (char === "(" || char === "[") depth++
    else if ((char === ")" || char === "]") && depth > 0) depth--
    else if (depth === 0 && /[,;|•·]/.test(char)) {
      items.push(item)
      item = ""
      continue
    }
    item += char
  }
  items.push(item)
  return items.map((each) => each.trim()).filter(Boolean)
}

// The latest year in a date, like 2027 in "Expected May 2027".
function yearOf(date: string): number | null {
  const years = (date.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number)
  return years.length ? Math.max(...years) : null
}

const experience: Rule = {
  id: "S1",
  category: "sections",
  level: "fix",
  reads: "form",
  title: "Experience, projects, leadership or volunteering",
  why: "It's what a recruiter reads most closely: what you've done.",
  check: ({ resume }) => {
    const entries = EXPERIENCE.flatMap((section) => filled(resume.sections[section]))
    // Titles, tools and links identify an entry, but don't describe what the
    // person did. Only printed descriptions can satisfy this essential check.
    if (entries.some((entry) => entry.bullets.some((bullet) => /\p{L}/u.test(bullet.text)))) return { checked: 1, problems: [] }
    const first = entries[0]
    const description = first && SECTIONS[first.section].fields.find((field) => field.type === "bullets")?.key
    return {
      checked: 1,
      problems: [
        {
          place: first ? at(first, description) : { kind: "section", section: "Work" },
          message: first ? "Describe what you did in an experience or project" : "Add experience, projects, leadership or volunteering",
          suggestion: "Describe a contribution in a job, class project, club, leadership role or volunteer experience.",
        },
      ],
    }
  },
}

/**
 * Whether the person started working less than EARLY_CAREER_YEARS ago, or
 * the resume doesn't say when: early in a career, a missing school or skills
 * is a gap recruiters notice, while later the work can speak for itself.
 */
function earlyCareer(resume: ResumeView, today: Date): boolean {
  const years = EXPERIENCE.flatMap((section) => resume.sections[section]).flatMap((entry) => {
    const { start, end } = datesOf(entry)
    const date = (start ?? end)?.date
    return date && !date.present && date.year !== undefined ? [date.year] : []
  })
  return years.length === 0 || today.getFullYear() - Math.min(...years) < EARLY_CAREER_YEARS
}

const education: Rule = {
  id: "S2",
  category: "sections",
  level: "look",
  reads: "form",
  title: "Your education",
  why: "Most job posts ask for a degree or school, so recruiters look for it.",
  check: ({ resume, today }) => ({
    checked: 1,
    problems:
      filled(resume.sections.Education).length > 0
        ? []
        : [
            {
              place: { kind: "section", section: "Education" },
              message: "Add your education",
              ...(earlyCareer(resume, today) && { level: "fix" as const }),
            },
          ],
  }),
}

const named: Rule = {
  id: "S3",
  category: "sections",
  level: "look",
  reads: "form",
  title: "Each entry has its role, company, school or degree",
  why: "Without it, a recruiter can't tell what the entry is.",
  check: ({ resume }) => {
    let checked = 0
    const problems: Problem[] = []
    for (const section of resume.order) {
      const fields = NAMED_BY[section] ?? []
      for (const entry of filled(resume.sections[section])) {
        checked += fields.length
        for (const field of fields.filter((key) => !entry.values[key])) {
          // An explicitly independent role already explains why there is no
          // single employer. Ordinary job titles still need an organization.
          if (
            section === "Work" &&
            field === "companyName" &&
            /\b(?:freelanc(?:e|er)|self[ -]employed|independent contractor)\b/i.test(entry.values.workRole)
          )
            continue
          problems.push({
            place: at(entry, field),
            message: `No ${labelOf(section, field).toLowerCase()}`,
            ...(section === "Work" && { level: "fix" as const }),
            ...(section === "Work" &&
              field === "companyName" && { suggestion: "Name the employer, or identify the work as self-employed or freelance." }),
          })
        }
      }
    }
    return checked ? { checked, problems } : null
  },
}

const located: Rule = {
  id: "S10",
  category: "sections",
  level: "look",
  reads: "form",
  title: "Every job, school and role has its location",
  why: "Recruiters look at where you worked and studied, and some jobs need someone nearby.",
  check: ({ resume }) => {
    let checked = 0
    const problems: Problem[] = []
    for (const section of resume.order) {
      const field = LOCATION_FIELDS[section]
      if (!field) continue
      for (const entry of filled(resume.sections[section])) {
        checked++
        if (!entry.values[field])
          problems.push({ place: at(entry, field), message: "No location", suggestion: "Add the city, like “Austin, TX”, or “Remote”." })
      }
    }
    return checked ? { checked, problems } : null
  },
}

const blank: Rule = {
  id: "S4",
  category: "sections",
  level: "look",
  reads: "form",
  title: "No empty entries",
  why: "An entry that was added but never filled in leaves a gap on the page.",
  check: ({ resume }) => {
    const entries = resume.order.flatMap((section) => resume.sections[section])
    if (entries.length === 0) return null
    return {
      checked: entries.length,
      problems: entries
        .filter((entry) => entry.blank)
        .map((entry) => ({ place: at(entry), message: "Empty entry", suggestion: "Fill it in or delete it." })),
    }
  },
}

const skills: Rule = {
  id: "S5",
  category: "sections",
  level: "look",
  reads: "form",
  title: "Your skills, in short lines, each listed once",
  why: "Recruiters and hiring software look for skills by name, and skim long lists.",
  check: ({ resume, today }) => {
    const entries = filled(resume.sections.Skills)
    if (entries.length === 0) {
      const level = earlyCareer(resume, today) ? ("fix" as const) : undefined
      return {
        checked: 1,
        problems: [{ place: { kind: "section", section: "Skills" }, message: "Add your skills", ...(level && { level }) }],
      }
    }
    let checked = 0
    const problems: Problem[] = []
    const seen = new Set<string>()
    for (const entry of entries) {
      const items = listOf(entry.values.skillDetails)
      // A group with a category but no skills prints as "Languages:" and nothing more.
      if (items.length === 0) {
        checked += 1
        problems.push({ place: at(entry, "skillDetails"), message: "No skills in this group" })
        continue
      }
      checked += items.length
      if (items.length >= MAX_SKILLS_PER_LINE) {
        problems.push({
          place: at(entry, "skillDetails"),
          message: `${items.length} skills on one line`,
          suggestion: "Split them into groups, like Languages and Tools.",
        })
      }
      for (const item of items) {
        const same = item.toLowerCase().replace(/\s+/g, " ")
        if (seen.has(same)) {
          problems.push({ place: at(entry, "skillDetails"), message: `“${item}” is listed twice`, text: item })
        }
        seen.add(same)
      }
    }
    return { checked, problems }
  },
}

const projects: Rule = {
  id: "S6",
  category: "sections",
  level: "look",
  reads: "form",
  title: "Each project has a link or its tech stack",
  why: "A link or the tools it's built with shows the project is real.",
  check: ({ resume }) => {
    const entries = filled(resume.sections.Projects)
    if (entries.length === 0) return null
    return {
      checked: entries.length,
      problems: entries
        .filter(({ values }) => !values.projectGithub && !values.additionalLink && !values.techStack)
        .map((entry) => ({
          place: at(entry, "techStack"),
          message: "No link or tech stack",
          suggestion: "Add what it's built with, or a link to it.",
        })),
    }
  },
}

const highSchool: Rule = {
  id: "S7",
  category: "sections",
  level: "look",
  reads: "form",
  title: "No high school once you're past your first year of college",
  why: "Recruiters look at your latest school, and high school takes room from it.",
  check: ({ resume, today }) => {
    const schools = filled(resume.sections.Education)
    const isHighSchool = ({ values }: Entry) => HIGH_SCHOOL_NAME.test(values.schoolName) || HIGH_SCHOOL_NAME.test(values.degree)
    const high = schools.filter(isHighSchool)
    const college = schools.filter(
      (entry) => !isHighSchool(entry) && (COLLEGE_DEGREE.test(entry.values.degree) || COLLEGE_NAME.test(entry.values.schoolName)),
    )
    if (high.length === 0 || college.length === 0) return null
    // A freshman can keep high school: college ends 3 or more school years
    // from the one under way, which ends the June after August.
    const schoolYear = today.getFullYear() + (today.getMonth() >= SCHOOL_YEAR_STARTS ? 1 : 0)
    const freshman = college.some((entry) => (yearOf(entry.values.schoolEndDate) ?? 0) - schoolYear >= FRESHMAN_YEARS_LEFT)
    return {
      checked: high.length,
      problems: freshman
        ? []
        : high.map((entry) => ({
            place: at(entry),
            message: "High school next to college",
            suggestion: "Leave it off after your first year of college.",
          })),
    }
  },
}

const coursework: Rule = {
  id: "S8",
  category: "sections",
  level: "look",
  reads: "form",
  title: "Short coursework lists",
  why: "A long list of courses buries the ones that matter.",
  check: ({ resume }) => {
    const entries = filled(resume.sections.Education).filter(({ values }) => values.coursework)
    if (entries.length === 0) return null
    return {
      checked: entries.length,
      problems: entries.flatMap((entry) => {
        const courses = listOf(entry.values.coursework).length
        return courses > MAX_COURSES
          ? [{ place: at(entry, "coursework"), message: `${courses} courses listed`, suggestion: "Keep the few that fit the job best." }]
          : []
      }),
    }
  },
}

const references: Rule = {
  id: "S9",
  category: "sections",
  level: "look",
  reads: "form",
  title: "No “References available upon request”",
  why: "Recruiters ask for references when they want them, so the line takes room for nothing.",
  check: ({ resume }) => ({
    checked: 1,
    problems: textsOf(resume).flatMap(({ place, text }) => {
      const found = REFERENCES_ON_REQUEST.exec(text)
      return found ? [{ place, message: "Leave off “References available upon request”", text: found[0] }] : []
    }),
  }),
}

export const SECTION_RULES: readonly Rule[] = [
  experience,
  education,
  named,
  blank,
  skills,
  projects,
  highSchool,
  coursework,
  references,
  located,
]
