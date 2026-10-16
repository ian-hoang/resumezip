import { describe, expect, test } from "vitest"
import type { Resume } from "@/lib/resume"
import { runChecks } from "./engine"
import { RULES } from "./rules"

const job = (workStartDate: string, workEndDate: string, companyName = "Google") => ({
  id: 1,
  workRole: "Engineer",
  companyName,
  workStartDate,
  workEndDate,
})

const jake = {
  profileSection: { fullName: "Jake Ryan" },
  educationSection: [
    { id: 1, schoolName: "University of Texas at Austin", degree: "B.S.", schoolStartDate: "Aug 2020", schoolEndDate: "May 2024" },
  ],
  workExperienceSection: [job("Jan 2025", "Present"), job("Jun 2024", "Dec 2024", "Meta")],
  projectsSection: [{ id: 1, projectName: "Gitlytics", projectDate: "Sep – Dec 2024" }],
}

const withWork = (...work: ReturnType<typeof job>[]) => ({ ...jake, workExperienceSection: work })
// Only jobs, so no other dates count toward how months are usually written.
const onlyWork = (...work: ReturnType<typeof job>[]) => ({ profileSection: jake.profileSection, workExperienceSection: work })

/** What one rule says about a resume. */
function check(id: string, resume: Resume, today?: Date) {
  const rule = RULES.find((rule) => rule.id === id)!
  const report = runChecks(resume, { rules: [rule], today })
  return { status: report.results[0].status, messages: report.findings.map((finding) => finding.message), findings: report.findings }
}

const placeOf = (section: string, entry: number, field: string) => ({ kind: "entry", section, entry, field })

// The day the tests read dates on, for rules that depend on it.
const today = new Date(2026, 9, 13)

test("well-kept dates pass every date rule", () => {
  for (const id of ["D1", "D2", "D3", "D4", "D6", "D7", "D8", "D9"]) {
    expect(check(id, jake, today).status, id).toBe("passed")
  }
  // Only one “Present”, so there's nothing to compare it with.
  expect(check("D5", jake).status).toBe("skipped")
})

describe("D1 no dates", () => {
  test("is a fix for a job, school or role with no dates, pointing at its start", () => {
    const resume = withWork(job("Jan 2025", "Present"), job("", ""))
    expect(check("D1", resume).findings).toEqual([
      expect.objectContaining({ level: "fix", place: placeOf("Work", 1, "workStartDate"), message: "No dates" }),
    ])
  })

  test("takes one date, like a graduation, and leaves projects and awards alone", () => {
    const resume = {
      ...jake,
      educationSection: [{ id: 1, schoolName: "University of Texas at Austin", schoolEndDate: "May 2027" }],
      projectsSection: [{ id: 1, projectName: "Gitlytics" }],
      awardsSection: [{ id: 1, awardName: "Dean's List" }],
    }
    expect(check("D1", resume).status).toBe("passed")
  })
})

describe("D2 end before start", () => {
  test("is a fix, pointing at the end", () => {
    expect(check("D2", withWork(job("Jun 2024", "Jan 2024"))).findings).toEqual([
      expect.objectContaining({ level: "fix", place: placeOf("Work", 0, "workEndDate"), message: "Ends before it starts" }),
    ])
  })

  test("flags “Present” as the start of something that ended", () => {
    expect(check("D2", withWork(job("Present", "Jan 2024"))).findings).toEqual([
      expect.objectContaining({ place: placeOf("Work", 0, "workEndDate"), message: "Ends before it starts" }),
    ])
  })

  test("reads a range in one field too", () => {
    const resume = { ...jake, awardsSection: [{ id: 1, awardName: "Scholarship", awardDate: "2026 – 2023" }] }
    expect(check("D2", resume).findings).toEqual([expect.objectContaining({ place: placeOf("Awards", 0, "awardDate") })])
  })

  test("goes by year when only one date has a month, and lets anything end in Present", () => {
    for (const [start, end] of [
      ["2024", "Jan 2024"],
      ["Mar 2024", "2024"],
      ["Jan 2030", "Present"],
      ["Jan 2024", "Jan 2024"],
    ]) {
      expect(check("D2", withWork(job(start, end))).status, `${start} – ${end}`).toBe("passed")
    }
  })
})

describe("D3 unreadable dates", () => {
  test("points at each date it can't read", () => {
    const resume = {
      ...withWork(job("Jnu 2024", "Present"), job("Jun 2023", "Agu 2023")),
      projectsSection: [{ id: 1, projectName: "X", projectDate: "Summer" }],
    }
    expect(check("D3", resume).findings.map((finding) => finding.place)).toEqual([
      placeOf("Work", 0, "workStartDate"),
      placeOf("Work", 1, "workEndDate"),
      placeOf("Projects", 0, "projectDate"),
    ])
  })

  test("reads a whole range typed into the start field when the end is empty", () => {
    expect(check("D3", withWork(job("Jan 2024 – Present", ""))).status).toBe("passed")
    expect(check("D3", withWork(job("Jan 2024 – Present", "Present"))).status).toBe("failed")
  })
})

describe("D4 dates written different ways", () => {
  test("flags a month written as a number among names, with the name to use", () => {
    expect(check("D4", onlyWork(job("Jan 2025", "Present"), job("06/2024", "Dec 2024"))).findings).toEqual([
      expect.objectContaining({
        place: placeOf("Work", 1, "workStartDate"),
        message: "Not written like your other dates",
        suggestion: "Write it like “Jun 2024”.",
      }),
    ])
  })

  test("flags long and short month names mixed, and “Sep” with “Sept”", () => {
    const longAndShort = onlyWork(job("January 2025", "Present"), job("Jun 2024", "Dec 2024"), job("Mar 2023", "Aug 2023"))
    expect(check("D4", longAndShort).findings).toEqual([
      expect.objectContaining({ place: placeOf("Work", 0, "workStartDate"), suggestion: "Write it like “Jan 2025”." }),
    ])
    const september = onlyWork(job("Sept 2024", "Present"), job("Sep 2023", "Aug 2024"), job("Sept 2022", "May 2023"))
    expect(check("D4", september).findings).toEqual([
      expect.objectContaining({ place: placeOf("Work", 1, "workStartDate"), suggestion: "Write it like “Sept 2023”." }),
    ])
  })

  test("flags a dot after some short months and not others", () => {
    const resume = onlyWork(job("Jan. 2025", "Present"), job("Jun. 2024", "Dec 2024"))
    expect(check("D4", resume).findings).toEqual([
      expect.objectContaining({ place: placeOf("Work", 1, "workEndDate"), suggestion: "Write it like “Dec. 2024”." }),
    ])
  })

  test("takes May, June and July with either short or long months, and “Sept” alone", () => {
    expect(check("D4", onlyWork(job("June 2024", "Present"), job("Jan 2023", "May 2024"))).status).toBe("passed")
    expect(check("D4", onlyWork(job("June 2024", "Present"), job("January 2023", "July 2023"))).status).toBe("passed")
    expect(check("D4", onlyWork(job("Sept 2024", "Present"), job("Jan 2023", "Aug 2024"))).status).toBe("passed")
  })

  test("takes years on their own when a section uses them throughout", () => {
    const resume = {
      ...jake,
      projectsSection: [
        { id: 1, projectName: "Gitlytics", projectDate: "2024 – Present" },
        { id: 2, projectName: "Raft", projectDate: "2023" },
      ],
      awardsSection: [{ id: 1, awardName: "Dean's List", awardDate: "2019 – 2022" }],
    }
    expect(check("D4", resume).status).toBe("passed")
  })

  test("flags a year on its own among months in a section, and a month among years", () => {
    const leadership = {
      ...jake,
      leadershipExperienceSection: [
        { id: 1, leadershipRole: "President", leadershipOrg: "ACM", leadershipStartDate: "Jan 2025", leadershipEndDate: "Present" },
        { id: 2, leadershipRole: "Treasurer", leadershipOrg: "ACM", leadershipStartDate: "Jun 2023", leadershipEndDate: "2024" },
      ],
    }
    expect(check("D4", leadership).findings).toEqual([
      expect.objectContaining({
        place: placeOf("Leadership", 1, "leadershipEndDate"),
        message: "No month, unlike the rest of this section",
      }),
    ])
    const projects = {
      ...jake,
      projectsSection: [
        { id: 1, projectName: "A", projectDate: "2024" },
        { id: 2, projectName: "B", projectDate: "2023" },
        { id: 3, projectName: "C", projectDate: "Mar 2022" },
      ],
    }
    expect(check("D4", projects).findings).toEqual([
      expect.objectContaining({
        place: placeOf("Projects", 2, "projectDate"),
        message: "Has a month, unlike the rest of this section",
        suggestion: "Write just the year: “2022”.",
      }),
    ])
  })

  test("leaves a job's missing month to D8, and never tells a school to drop its month", () => {
    expect(check("D4", withWork(job("Jan 2025", "Present"), job("Jun 2023", "2024"))).status).toBe("passed")
    const schools = {
      ...jake,
      educationSection: [
        { id: 1, schoolName: "Georgia Tech", degree: "M.S.", schoolStartDate: "2020", schoolEndDate: "2022" },
        { id: 2, schoolName: "University of Texas at Austin", degree: "B.S.", schoolStartDate: "2016", schoolEndDate: "May 2020" },
      ],
    }
    expect(check("D4", schools, today).status).toBe("passed")
  })

  test("leaves a student's graduation month to D9", () => {
    const student = {
      ...jake,
      educationSection: [
        { id: 1, schoolName: "University of Texas at Austin", degree: "B.S.", schoolStartDate: "Aug 2023", schoolEndDate: "2027" },
      ],
      workExperienceSection: [job("Jun 2025", "Aug 2025")],
    }
    expect(check("D4", student, today).status).toBe("passed")
    expect(check("D9", student, today).messages).toEqual(["No month"])
  })

  test("leaves publications to their citation style", () => {
    const resume = { ...jake, publicationsSection: [{ id: 1, publicationTitle: "Sparse Attention", publicationDate: "Aug. 2023" }] }
    expect(check("D4", resume).status).toBe("passed")
  })

  test("points at one side of a range in one field", () => {
    const resume = { ...jake, projectsSection: [{ id: 1, projectName: "Gitlytics", projectDate: "September – Dec 2024" }] }
    expect(check("D4", resume).findings).toEqual([
      expect.objectContaining({ place: placeOf("Projects", 0, "projectDate"), text: "September", suggestion: "Write it like “Sep”." }),
    ])
  })
})

describe("D5 “Present” written different ways", () => {
  test("flags the ones that differ from the usual word, case aside", () => {
    const resume = withWork(job("Jan 2025", "Present"), job("Jun 2024", "present"), job("Jan 2024", "Current"))
    expect(check("D5", resume).findings).toEqual([
      expect.objectContaining({
        place: placeOf("Work", 2, "workEndDate"),
        message: "“Current” here, “Present” elsewhere",
        suggestion: "Use “Present” everywhere.",
      }),
    ])
  })

  test("reads it in a range in one field too", () => {
    const resume = {
      ...withWork(job("Jan 2025", "Present")),
      projectsSection: [{ id: 1, projectName: "Gitlytics", projectDate: "2024 – Now" }],
    }
    expect(check("D5", resume).messages).toEqual(["“Now” here, “Present” elsewhere"])
  })
})

describe("D6 newest first", () => {
  test("flags an entry newer than the one above it, by its start and its end", () => {
    const resume = withWork(job("Jun 2023", "Aug 2023"), job("Jan 2025", "Present"))
    expect(check("D6", resume).findings).toEqual([
      expect.objectContaining({ place: placeOf("Work", 1, "workEndDate"), message: "Newer than the entry above" }),
    ])
    // Two that are still going: the one that started later goes first.
    expect(check("D6", withWork(job("Sep 2023", "Present"), job("Jan 2025", "Present"))).status).toBe("failed")
  })

  test("lets overlapping entries go either way, like an upcoming internship above a campus job", () => {
    expect(check("D6", withWork(job("Jun 2026", "Aug 2026"), job("Jan 2025", "Present"))).status).toBe("passed")
    expect(check("D6", withWork(job("May 2025", "Aug 2025"), job("Sep 2024", "Dec 2025"))).status).toBe("passed")
  })

  test("compares within each section, skipping entries without dates", () => {
    const resume = {
      ...withWork(job("Jan 2025", "Present"), job("", ""), job("Jun 2024", "Dec 2024")),
      educationSection: [
        { id: 1, schoolName: "Georgia Tech", degree: "M.S.", schoolEndDate: "May 2023" },
        { id: 2, schoolName: "University of Lagos", degree: "B.Sc.", schoolStartDate: "Sep 2015", schoolEndDate: "Jul 2020" },
      ],
    }
    expect(check("D6", resume).status).toBe("passed")
    // An entry without dates doesn't hide one out of order below it.
    expect(check("D6", withWork(job("Jun 2023", "Aug 2023"), job("", ""), job("Jan 2025", "Present"))).findings).toEqual([
      expect.objectContaining({ place: placeOf("Work", 2, "workEndDate"), message: "Newer than the entry above" }),
    ])
  })

  test("leaves projects and awards in the order the person chose", () => {
    const resume = {
      ...jake,
      projectsSection: [
        { id: 1, projectName: "A", projectDate: "2021" },
        { id: 2, projectName: "B", projectDate: "2024" },
      ],
    }
    expect(check("D6", resume).status).toBe("passed")
  })
})

describe("D7 apostrophe years", () => {
  test("flags a year with an apostrophe, with the whole year to use", () => {
    expect(check("D7", withWork(job("Jan '21", "Present"), job("Jun 2020", "Dec ’20"))).findings).toEqual([
      expect.objectContaining({
        place: placeOf("Work", 0, "workStartDate"),
        message: "Year written as “'21”",
        suggestion: "Write the whole year: “2021”.",
      }),
      expect.objectContaining({ place: placeOf("Work", 1, "workEndDate"), message: "Year written as “’20”" }),
    ])
    expect(check("D7", withWork(job("Jun '99", "Aug '99"))).findings[0].suggestion).toBe("Write the whole year: “1999”.")
  })
})

describe("D8 month and year on every job", () => {
  test("flags a job dated by the year alone, with its month to add", () => {
    expect(check("D8", withWork(job("Jan 2025", "Present"), job("2023", "Dec 2024"))).findings).toEqual([
      expect.objectContaining({
        place: placeOf("Work", 1, "workStartDate"),
        message: "No month",
        suggestion: "Add the month, like “Jun 2023”.",
      }),
    ])
  })

  test("takes a season, and a job still going", () => {
    expect(check("D8", withWork(job("Summer 2024", "Present"))).status).toBe("passed")
  })
})

describe("D9 month and year on your graduation date", () => {
  const studentAt = (schoolStartDate: string, schoolEndDate: string, schoolName = "University of Texas at Austin") => ({
    ...jake,
    educationSection: [{ id: 1, schoolName, degree: "B.S.", schoolStartDate, schoolEndDate }],
    workExperienceSection: [job("Jun 2025", "Aug 2025")],
  })

  test("asks a student for the month they graduate", () => {
    for (const end of ["2027", "Class of 2027"]) {
      expect(check("D9", studentAt("Aug 2023", end), today).findings, end).toEqual([
        expect.objectContaining({
          place: placeOf("Education", 0, "schoolEndDate"),
          message: "No month",
          suggestion: "Write it like “Expected May 2027”.",
        }),
      ])
    }
    expect(check("D9", studentAt("Aug 2023", "Expected May 2027"), today).status).toBe("passed")
  })

  test("asks a student with no end date, or “Present”, when they graduate", () => {
    expect(check("D9", studentAt("Aug 2023", ""), today).messages).toEqual(["No graduation date"])
    expect(check("D9", studentAt("Aug 2023", "Present"), today).messages).toEqual(["No graduation date"])
  })

  test("reads graduation dates written with more than one word before them (D3)", () => {
    for (const end of ["Expected Graduation: May 2027", "Graduation Date: May 2027", "Expected Graduation: Spring 2027"]) {
      expect(check("D3", studentAt("15 Aug 2023", end), today).status, end).toBe("passed")
    }
  })

  test("flags an expected date that has passed, for anyone", () => {
    expect(check("D9", studentAt("Aug 2020", "Expected May 2024"), today).messages).toEqual(["This date has passed"])
    expect(check("D9", studentAt("Aug 2020", "Expected Graduation: May 2024"), today).messages).toEqual(["This date has passed"])
    const experienced = {
      ...jake,
      educationSection: [
        { id: 1, schoolName: "University of Texas at Austin", degree: "B.S.", schoolStartDate: "2012", schoolEndDate: "Expected 2016" },
      ],
      workExperienceSection: [job("Jun 2016", "Present")],
    }
    expect(check("D9", experienced, today).messages).toEqual(["This date has passed"])
  })

  test("takes a year alone later in a career, and leaves high school alone", () => {
    const experienced = {
      ...jake,
      educationSection: [
        { id: 1, schoolName: "University of Texas at Austin", degree: "B.S.", schoolStartDate: "2008", schoolEndDate: "2012" },
      ],
      workExperienceSection: [job("Jun 2016", "Present")],
    }
    expect(check("D9", experienced, today).status).toBe("passed")
    expect(check("D9", studentAt("2022", "2026", "Westlake High School"), today).status).toBe("skipped")
  })
})
