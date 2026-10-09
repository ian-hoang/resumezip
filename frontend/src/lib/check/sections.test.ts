import { describe, expect, test } from "vitest"
import type { Resume } from "@/lib/resume"
import { runChecks } from "./engine"
import { RULES } from "./rules"
import { listOf } from "./sections"

const college = {
  id: 1,
  schoolName: "University of Texas at Austin",
  schoolLocation: "Austin, TX",
  degree: "B.S. in Computer Science",
  schoolEndDate: "May 2028",
}
const highSchool = { id: 2, schoolName: "Westlake High School", schoolEndDate: "May 2024" }

const jake = {
  profileSection: { fullName: "Jake Ryan" },
  educationSection: [college],
  workExperienceSection: [
    { id: 1, workRole: "Engineer", companyName: "Google", workLocation: "Mountain View, CA", workDescription: "• Built a search index" },
  ],
  projectsSection: [{ id: 1, projectName: "Gitlytics", techStack: "Next.js, PostgreSQL" }],
  skillsSection: [
    { id: 1, skillName: "Languages", skillDetails: "TypeScript, Python, Go" },
    { id: 2, skillName: "Tools", skillDetails: "Git, Docker" },
  ],
}

// Early in a school year, as when this was written.
const OCTOBER_2026 = new Date(2026, 9, 6)

/** What one rule says about a resume. */
function check(id: string, resume: Resume, today = OCTOBER_2026) {
  const rule = RULES.find((rule) => rule.id === id)!
  const report = runChecks(resume, { rules: [rule], today })
  return { status: report.results[0].status, messages: report.findings.map((finding) => finding.message), findings: report.findings }
}

test("a whole resume passes every sections rule", () => {
  for (const id of ["S1", "S2", "S3", "S4", "S5", "S6", "S9", "S10"]) {
    expect(check(id, jake).status, id).toBe("passed")
  }
  // No high school, and no coursework.
  expect(check("S7", jake).status).toBe("skipped")
  expect(check("S8", jake).status).toBe("skipped")
})

describe("S1 and S2 experience and education", () => {
  test("S1 is a fix when there's no experience, projects, leadership or volunteering", () => {
    const resume = { ...jake, workExperienceSection: [{ id: 1 }], projectsSection: [] }
    expect(check("S1", resume).findings).toEqual([expect.objectContaining({ level: "fix", place: { kind: "section", section: "Work" } })])
    for (const section of ["projectsSection", "leadershipExperienceSection", "volunteerExperienceSection"]) {
      expect(
        check("S1", {
          ...resume,
          [section]: [
            {
              id: 1,
              projectName: "Club",
              leadershipRole: "Lead",
              volunteerRole: "Tutor",
              projectDescription: "Built a club website",
              leadershipDescription: "Organized club events",
              volunteerDescription: "Tutored students",
            },
          ],
        }).status,
        section,
      ).toBe("passed")
    }
  })

  test("S1 requires printed descriptions, beyond entry titles, tools, dates and links", () => {
    const resume = {
      ...jake,
      workExperienceSection: [{ id: 1, workRole: "Engineer", companyName: "Google" }],
      projectsSection: [{ id: 1, projectName: "Website", techStack: "HTML", projectGithub: "github.com/jake/site" }],
    }
    expect(check("S1", resume).findings).toEqual([
      expect.objectContaining({ level: "fix", place: { kind: "entry", section: "Work", entry: 0, field: "workDescription" } }),
    ])
    expect(
      check("S1", { ...resume, workExperienceSection: [{ ...resume.workExperienceSection[0], workDescription: "○ Built a search index" }] })
        .status,
    ).toBe("failed")
    expect(check("S1", { ...resume, workExperienceSection: [{ ...jake.workExperienceSection[0], leftOut: true }] }).status).toBe("failed")
    expect(
      check("S1", {
        ...resume,
        projectsSection: [{ ...resume.projectsSection[0], projectDescription: "Built a website for a local club" }],
      }).status,
    ).toBe("passed")
  })

  test("S2 suggests adding education", () => {
    expect(check("S2", { ...jake, educationSection: [] }).findings).toEqual([
      expect.objectContaining({ level: "look", place: { kind: "section", section: "Education" }, message: "Add your education" }),
    ])
    expect(check("S2", { ...jake, educationSection: [{ id: 1 }] }).status).toBe("failed")
  })
})

describe("S3 and S4 entries", () => {
  test("S3 points at each missing role, company, school or degree", () => {
    const resume = {
      ...jake,
      educationSection: [{ id: 1, schoolName: "University of Texas at Austin" }],
      workExperienceSection: [{ id: 1, companyName: "Google", workDescription: "• Built a search index" }],
    }
    expect(check("S3", resume).findings.map(({ place, message }) => ({ place, message }))).toEqual([
      { place: { kind: "entry", section: "Work", entry: 0, field: "workRole" }, message: "No role" },
      { place: { kind: "entry", section: "Education", entry: 0, field: "degree" }, message: "No degree" },
    ])
  })

  test("S3 leaves empty entries to S4, which points at each one", () => {
    const resume = { ...jake, workExperienceSection: [...jake.workExperienceSection, { id: 2, workRole: " ", workDescription: "•  \n" }] }
    expect(check("S3", resume).status).toBe("passed")
    expect(check("S4", resume).findings).toEqual([
      expect.objectContaining({ place: { kind: "entry", section: "Work", entry: 1 }, message: "Empty entry" }),
    ])
  })

  test("S3 requires work role and employer as fixes without changing education suggestions", () => {
    const resume = {
      ...jake,
      educationSection: [{ id: 1, schoolName: "University of Texas at Austin" }],
      workExperienceSection: [{ id: 1, workDescription: "Built a search index" }],
    }
    expect(check("S3", resume).findings.map(({ place, level }) => ({ place, level }))).toEqual([
      { place: { kind: "entry", section: "Work", entry: 0, field: "workRole" }, level: "fix" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "companyName" }, level: "fix" },
      { place: { kind: "entry", section: "Education", entry: 0, field: "degree" }, level: "look" },
    ])
  })

  test("S3 accommodates explicitly independent work while requiring a role", () => {
    for (const workRole of ["Freelance designer", "Self-employed developer", "Independent contractor"]) {
      expect(
        check("S3", { ...jake, workExperienceSection: [{ id: 1, workRole, workDescription: "Built client websites" }] }).status,
        workRole,
      ).toBe("passed")
    }
    expect(
      check("S3", { ...jake, workExperienceSection: [{ id: 1, companyName: "Self-employed", workDescription: "Built client websites" }] })
        .findings[0],
    ).toMatchObject({ level: "fix", message: "No role" })
    expect(
      check("S3", { ...jake, workExperienceSection: [{ id: 1, workRole: "Engineer", workDescription: "Built client websites" }] })
        .findings[0],
    ).toMatchObject({ level: "fix", message: "No company" })
  })

  test("skip a resume with no entries at all", () => {
    expect(check("S3", { profileSection: {} }).status).toBe("skipped")
    expect(check("S4", { profileSection: {} }).status).toBe("skipped")
  })
})

describe("S5 skills", () => {
  test("flags no skills", () => {
    expect(check("S5", { ...jake, skillsSection: [] }).messages).toEqual(["Add your skills"])
  })

  test("flags a group with a category but no skills", () => {
    const skills = [
      { id: 1, skillName: "Languages", skillDetails: "Python" },
      { id: 2, skillName: "Tools" },
    ]
    expect(check("S5", { ...jake, skillsSection: skills }).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Skills", entry: 1, field: "skillDetails" },
        message: "No skills in this group",
      }),
    ])
    expect(check("S5", { ...jake, skillsSection: [{ id: 1, skillName: "Languages", skillDetails: " , " }] }).messages).toEqual([
      "No skills in this group",
    ])
  })

  test("flags a line of 15 or more", () => {
    const many = Array.from({ length: 15 }, (_, i) => `Tool ${i + 1}`).join(", ")
    expect(check("S5", { ...jake, skillsSection: [{ id: 1, skillName: "Tools", skillDetails: many }] }).messages).toEqual([
      "15 skills on one line",
    ])
    const fewer = Array.from({ length: 14 }, (_, i) => `Tool ${i + 1}`).join(", ")
    expect(check("S5", { ...jake, skillsSection: [{ id: 1, skillName: "Tools", skillDetails: fewer }] }).status).toBe("passed")
  })

  test("flags a skill listed twice, whatever its case, where it's repeated", () => {
    const skills = [
      { id: 1, skillName: "Languages", skillDetails: "Python, SQL" },
      { id: 2, skillName: "Data", skillDetails: "sql; Pandas" },
    ]
    expect(check("S5", { ...jake, skillsSection: skills }).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Skills", entry: 1, field: "skillDetails" },
        message: "“sql” is listed twice",
        text: "sql",
      }),
    ])
  })

  test("reads lists with commas, semicolons or bars, leaving commas in brackets alone", () => {
    expect(listOf("Excel (pivot tables, VLOOKUP), SQL; R | Go ,, ")).toEqual(["Excel (pivot tables, VLOOKUP)", "SQL", "R", "Go"])
    expect(listOf("")).toEqual([])
  })
})

describe("S6 projects", () => {
  test("flags a project with no link and no tech stack", () => {
    const projects = [
      { id: 1, projectName: "Gitlytics" },
      { id: 2, projectName: "Raft", projectGithub: "github.com/jake/raft" },
      { id: 3, projectName: "Blog", additionalLink: "jake.dev" },
    ]
    expect(check("S6", { ...jake, projectsSection: projects }).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Projects", entry: 0, field: "techStack" },
        message: "No link or tech stack",
      }),
    ])
  })

  test("skips a resume without projects", () => {
    expect(check("S6", { ...jake, projectsSection: [] }).status).toBe("skipped")
  })
})

describe("S7 high school next to college", () => {
  test("flags high school once college is under 3 school years away", () => {
    const resume = { ...jake, educationSection: [college, highSchool] }
    expect(check("S7", resume).findings).toEqual([
      expect.objectContaining({ place: { kind: "entry", section: "Education", entry: 1 }, message: "High school next to college" }),
    ])
  })

  test("leaves a freshman's high school, counting school years from August", () => {
    const freshman = { ...jake, educationSection: [{ ...college, schoolEndDate: "Expected May 2030" }, highSchool] }
    // In October 2026 the school year ends in 2027, 3 years before 2030.
    expect(check("S7", freshman).status).toBe("passed")
    // So does the summer before, and the end of the first year.
    expect(check("S7", freshman, new Date(2026, 6, 15)).status).toBe("passed")
    expect(check("S7", freshman, new Date(2027, 4, 20)).status).toBe("passed")
    // A sophomore's, from August 2027, is flagged.
    expect(check("S7", freshman, new Date(2027, 7, 20)).status).toBe("failed")
  })

  test("knows a college by its degree or its name, and a high school by its name", () => {
    const byDegree = { id: 1, schoolName: "Questrom School of Business", degree: "BS in Business Administration", schoolEndDate: "2027" }
    const byName = { id: 1, schoolName: "Santa Monica College", schoolEndDate: "2027" }
    for (const school of [byDegree, byName]) {
      expect(check("S7", { ...jake, educationSection: [school, highSchool] }).status, school.schoolName).toBe("failed")
    }
    const twoHighSchools = [highSchool, { id: 3, schoolName: "College Park High School", schoolEndDate: "2022" }]
    expect(check("S7", { ...jake, educationSection: twoHighSchools }).status).toBe("skipped")
    expect(check("S7", { ...jake, educationSection: [college, { id: 4, schoolName: "Phillips Academy" }] }).status).toBe("skipped")
  })
})

describe("S8 coursework", () => {
  test("flags more than 8 courses", () => {
    const courses = (count: number) => Array.from({ length: count }, (_, i) => `Course ${i + 1}`).join(", ")
    expect(check("S8", { ...jake, educationSection: [{ ...college, coursework: courses(9) }] }).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Education", entry: 0, field: "coursework" },
        message: "9 courses listed",
      }),
    ])
    expect(check("S8", { ...jake, educationSection: [{ ...college, coursework: courses(8) }] }).status).toBe("passed")
  })

  test("skips a resume without coursework", () => {
    expect(check("S8", { ...jake, educationSection: [college] }).status).toBe("skipped")
  })
})

describe("S9 references", () => {
  test("flags “References available upon request”, however it's worded, wherever it is", () => {
    for (const line of ["References available upon request", "References: Available on request.", "References furnished upon request"]) {
      const resume = { ...jake, skillsSection: [...jake.skillsSection, { id: 3, skillName: "Other", skillDetails: line }] }
      expect(check("S9", resume).findings, line).toEqual([
        expect.objectContaining({ place: { kind: "entry", section: "Skills", entry: 2, field: "skillDetails" } }),
      ])
    }
  })

  test("doesn't flag references used in other ways", () => {
    const work = [{ id: 1, workRole: "Engineer", companyName: "Google", workDescription: "• Wrote API references, available on GitHub" }]
    expect(check("S9", { ...jake, workExperienceSection: work }).status).toBe("passed")
  })
})

describe("S10 locations", () => {
  test("suggests a location for each job, school and role without one", () => {
    const resume = {
      ...jake,
      educationSection: [{ ...college, schoolLocation: " " }],
      workExperienceSection: [{ ...jake.workExperienceSection[0], workLocation: "" }],
      volunteerExperienceSection: [
        { id: 1, volunteerRole: "Tutor", volunteerOrg: "Austin Public Library", volunteerLocation: "Austin, TX" },
      ],
      leadershipExperienceSection: [{ id: 1, leadershipRole: "President", leadershipOrg: "Robotics Club" }],
    }
    expect(check("S10", resume).findings.map(({ place, level, message }) => ({ place, level, message }))).toEqual([
      { place: { kind: "entry", section: "Education", entry: 0, field: "schoolLocation" }, level: "look", message: "No location" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "workLocation" }, level: "look", message: "No location" },
      { place: { kind: "entry", section: "Leadership", entry: 0, field: "leadershipLocation" }, level: "look", message: "No location" },
    ])
  })

  test("leaves projects, awards and empty entries alone", () => {
    const resume = {
      ...jake,
      educationSection: [],
      workExperienceSection: [{ id: 1, workRole: " " }],
      awardsSection: [{ id: 1, awardName: "Dean's List" }],
    }
    expect(check("S10", resume).status).toBe("skipped")
  })
})
