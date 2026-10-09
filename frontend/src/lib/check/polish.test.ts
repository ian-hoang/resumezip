import { describe, expect, test } from "vitest"
import type { Resume } from "@/lib/resume"
import { runChecks } from "./engine"
import { RULES } from "./rules"

const job = (bullets: string[], more: Record<string, string> = {}) => ({
  id: 1,
  workRole: "Engineer",
  companyName: "Google",
  workDescription: bullets.map((bullet) => `• ${bullet}`).join("\n"),
  ...more,
})

const resumeWith = (...jobs: ReturnType<typeof job>[]) => ({ profileSection: { fullName: "Jake Ryan" }, workExperienceSection: jobs })

/** What one rule says about a resume. */
function check(id: string, resume: Resume) {
  const rule = RULES.find((rule) => rule.id === id)!
  const report = runChecks(resume, { rules: [rule] })
  return { status: report.results[0].status, messages: report.findings.map((finding) => finding.message), findings: report.findings }
}

const bulletAt = (line: number, entry = 0) => ({ kind: "entry", section: "Work", entry, field: "workDescription", line })

describe("P1 periods at the end", () => {
  test("flags the bullets that end differently from most", () => {
    const resume = resumeWith(job(["Built the index.", "Led the team.", "Wrote the docs"]))
    expect(check("P1", resume).findings).toEqual([
      expect.objectContaining({ place: bulletAt(2), message: "No period at the end, unlike your other bullets" }),
    ])
    expect(check("P1", resumeWith(job(["Built the index", "Led the team", "Wrote the docs."]))).messages).toEqual([
      "Ends with a period, unlike your other bullets",
    ])
  })

  test("passes bullets that all end the same way", () => {
    expect(check("P1", resumeWith(job(["Built the index", "Led the team"]))).status).toBe("passed")
  })
})

describe("P2 a lowercase start", () => {
  test("flags it, with the word capitalized", () => {
    expect(check("P2", resumeWith(job(["built the search index", "Led the team"]))).findings).toEqual([
      expect.objectContaining({ place: bulletAt(0), message: "Starts with a lowercase letter", suggestion: "Start with “Built”." }),
    ])
  })

  test("leaves names written in lower case on purpose, and numbers", () => {
    const bullets = [
      "iOS app for 3,000 students",
      "npm package with 9k weekly downloads",
      "eBay listings scraper",
      "pandas pipeline for sales data",
      "50% fewer pages",
    ]
    expect(check("P2", resumeWith(job(bullets))).status).toBe("passed")
  })
})

describe("P3 states and degrees written one way", () => {
  test.each([
    ["Education", "educationSection", "schoolLocation"],
    ["Work", "workExperienceSection", "workLocation"],
    ["Volunteership", "volunteerExperienceSection", "volunteerLocation"],
    ["Leadership", "leadershipExperienceSection", "leadershipLocation"],
  ] as const)("still checks %s locations after sharing the fields with S10", (section, dataKey, field) => {
    const resume = {
      profileSection: { location: "Austin, TX" },
      [dataKey]: [
        { id: 1, [field]: "Seattle, WA" },
        { id: 2, [field]: "Boston, Massachusetts" },
      ],
    }
    expect(check("P3", resume).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section, entry: 1, field },
        message: "State written out, unlike your other places",
        suggestion: "Write it “Boston, MA”.",
      }),
    ])
  })

  test("flags a state written out among abbreviations, with the place rewritten", () => {
    const resume = {
      profileSection: { fullName: "Jake Ryan", location: "Austin, TX" },
      workExperienceSection: [
        job(["Built it"], { workLocation: "Seattle, WA" }),
        job(["Led it"], { workLocation: "Boston, Massachusetts" }),
      ],
    }
    expect(check("P3", resume).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Work", entry: 1, field: "workLocation" },
        message: "State written out, unlike your other places",
        suggestion: "Write it “Boston, MA”.",
      }),
    ])
  })

  test("flags a degree abbreviated without dots among ones with them", () => {
    const resume = {
      profileSection: { fullName: "Jake Ryan" },
      educationSection: [
        { id: 1, schoolName: "Georgia Tech", degree: "MS in Computer Science" },
        { id: 2, schoolName: "UT Austin", degree: "B.S. in Computer Science" },
        { id: 3, schoolName: "UT Austin", degree: "B.A. in Economics" },
      ],
    }
    expect(check("P3", resume).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Education", entry: 0, field: "degree" },
        message: "Degree abbreviated without dots, unlike your other degrees",
        suggestion: "Write it “M.S. in Computer Science”.",
      }),
    ])
  })

  test("doesn't take a country with a state's name for the state", () => {
    const resume = {
      profileSection: { fullName: "Jake Ryan", location: "Austin, TX" },
      workExperienceSection: [job(["Built it"], { workLocation: "Seattle, WA" }), job(["Led it"], { workLocation: "Tbilisi, Georgia" })],
    }
    expect(check("P3", resume).status).toBe("passed")
  })

  test("leaves places outside the US, MBAs, and anything written one way", () => {
    const resume = {
      profileSection: { fullName: "Jake Ryan", location: "London, UK" },
      workExperienceSection: [job(["Built it"], { workLocation: "Austin, TX" }), job(["Led it"], { workLocation: "Paris, France" })],
      educationSection: [
        { id: 1, schoolName: "Wharton", degree: "MBA" },
        { id: 2, schoolName: "UT Austin", degree: "B.S. in Economics" },
      ],
    }
    expect(check("P3", resume).status).toBe("skipped")
  })
})

describe("P4 spacing", () => {
  test("flags two spaces, a space before punctuation, and a missing space after a comma or period", () => {
    const resume = resumeWith(
      job(["Built the  index", "Led the team , then the org", "Used Python,SQL and Go", "Grew users.Built the app"]),
    )
    expect(check("P4", resume).findings.map(({ message, suggestion }) => [message, suggestion])).toEqual([
      ["Two spaces in a row", "Use one space."],
      ["A space before punctuation", "Write “team,”."],
      ["No space after a comma", "Write “Python, SQL”."],
      ["No space after a period", "Write “users. Built”."],
    ])
  })

  test("shows every kind of spacing problem in a text at once", () => {
    expect(check("P4", resumeWith(job(["Used  Python,SQL and Go"]))).messages).toEqual(["Two spaces in a row", "No space after a comma"])
  })

  test("leaves numbers, tech names, abbreviations and links alone", () => {
    const resume = {
      profileSection: { fullName: "Jake Ryan", personalWebsite: "jake.dev,blog" },
      workExperienceSection: [job(["Served 1,000 users on Node.js and ASP.NET", "Moved U.S. users to v2.1 of the API"])],
    }
    expect(check("P4", resume).status).toBe("passed")
  })
})

describe("P5 words in capitals", () => {
  test("flags ordinary capitalized prose while leaving official job titles alone", () => {
    const resume = resumeWith(job(["Built a MASSIVE cache"], { workRole: "SOFTWARE ENGINEER" }))
    expect(check("P5", resume).findings.map(({ message, suggestion }) => [message, suggestion])).toEqual([
      ["“MASSIVE” in capitals", "If this is ordinary prose, consider “massive”. Keep the case of names and acronyms."],
    ])
  })

  test("leaves acronyms, short ones, skills and the profile alone", () => {
    const resume = {
      profileSection: { fullName: "JAKE RYAN" },
      workExperienceSection: [job(["Wrote MATLAB and HTTPS tooling for NASA and AWS"])],
      skillsSection: [{ id: 1, skillName: "Tools", skillDetails: "ANSYS, SOLIDWORKS" }],
    }
    expect(check("P5", resume).status).toBe("passed")
  })
})

describe("P6 shorthand", () => {
  test.each([
    ["Design & build w/ React", "w/", "with"],
    ["Design & build w/o downtime", "w/o", "without"],
    ["Design & build tools for mgmt", "mgmt", "management"],
    ["Design & build approx. ten tools", "approx.", "about"],
    ["Design & build thru automation", "thru", "through"],
  ])("still flags shorthand in a bullet containing an ampersand: %s", (bullet, short, word) => {
    expect(check("P6", resumeWith(job([bullet]))).findings).toEqual([
      expect.objectContaining({ place: bulletAt(0), message: `“${short}” is shorthand`, suggestion: `Write “${word}”.` }),
    ])
  })

  test("allows repeated ampersands in prose across different sections", () => {
    const resume = {
      ...resumeWith(job(["Design & build & maintain APIs"])),
      projectsSection: [{ id: 1, projectName: "Tools", projectDescription: "• Parse & index documents" }],
      volunteerExperienceSection: [{ id: 1, volunteerOrg: "Library", volunteerDescription: "• Teach & mentor students" }],
      leadershipExperienceSection: [{ id: 1, leadershipOrg: "Club", leadershipDescription: "• Plan & organize meetings" }],
    }
    expect(check("P6", resume)).toMatchObject({ status: "passed", findings: [] })
  })

  test("flags shorthand, with the word to write", () => {
    const bullets = ["Built it w/ React", "Led the mgmt team", "Cut costs approx. 40%", "Cut builds from 10 hrs to 2"]
    expect(check("P6", resumeWith(job(bullets))).findings.map(({ message, suggestion }) => [message, suggestion])).toEqual([
      ["“w/” is shorthand", "Write “with”."],
      ["“mgmt” is shorthand", "Write “management”."],
      ["“approx.” is shorthand", "Write “about”."],
    ])
  })

  test("preserves official titles and skill terminology", () => {
    const resume = {
      ...resumeWith(job(["Built the index"], { workRole: "Project Mgr" })),
      skillsSection: [{ id: 1, skillName: "Business", skillDetails: "Project mgmt, budgeting" }],
    }
    expect(check("P6", resume).findings).toEqual([])
  })

  test("leaves an & alone, and names and acronyms with the same letters", () => {
    const bullets = [
      "Design & build the API",
      "Ran R&D for AT&T",
      "Partnered with Procter & Gamble",
      "Trained the HR team",
      "Wrote ESP32 firmware",
      "Worked with I/O drivers",
    ]
    expect(check("P6", resumeWith(job(bullets))).status).toBe("passed")
  })
})

describe("contextual polish advice", () => {
  test("keeps separate entries' punctuation styles and abbreviated endings", () => {
    const resume = resumeWith(job(["Built the index.", "Wrote the docs."]), job(["Led the team", "Coached interns", "Supported Acme Inc."]))
    expect(check("P1", resume).findings).toEqual([])
  })

  test("recognizes the resume's own organization and product names", () => {
    const resume = resumeWith(job(["UNIQLO retail integration", "bluestack handles store inventory"], { companyName: "UNIQLO" }))
    const named = { ...resume, projectsSection: [{ id: 1, projectName: "bluestack" }] }
    expect(check("P5", named).findings).toEqual([])
    expect(check("P2", named).findings).toEqual([])
  })

  test("preserves code, quoted terminology, units and deliberate alignment", () => {
    const resume = resumeWith(
      job([
        'Used `foo(bar,baz)` and "mgmt" labels',
        "Used 'mgmt' labels",
        "Latency    5 ms",
        "Saved 5  ms",
        "Ran for 2 hrs",
        "Ran for three hrs",
      ]),
    )
    expect(check("P4", resume).findings).toEqual([])
    expect(check("P6", resume).findings).toEqual([])
    expect(check("P2", resumeWith(job(['"bluestack" handles store inventory']))).findings).toEqual([])
  })

  test("allows words for numbers at the start of a sentence", () => {
    expect(check("P7", resumeWith(job(["Led 3 teams", "Ran 4 projects", "Five engineers joined the team"]))).findings).toEqual([])
  })
})

describe("P7 numbers written one way", () => {
  test("flags small numbers and percentages written the less usual way", () => {
    const bullets = [
      "Led 5 engineers",
      "Ran 3 sprints",
      "Mentored five interns",
      "Cut costs by 40%",
      "Grew users 30%",
      "Raised margins 12 percent",
    ]
    expect(check("P7", resumeWith(job(bullets))).findings.map(({ place, message, suggestion }) => [place, message, suggestion])).toEqual([
      [bulletAt(2), "“five” here, digits elsewhere", "Write “5”."],
      [bulletAt(5), "“12 percent” here, “%” elsewhere", "Write “12%”."],
    ])
  })

  test("leaves large numbers in digits next to small ones in words", () => {
    expect(check("P7", resumeWith(job(["Led five engineers", "Served 15 teams", "Grew sales 3x", "Shipped v2 of the app"]))).status).toBe(
      "passed",
    )
  })

  test("leaves versions and labels out, but counts a digit after the first word", () => {
    const versions = [
      "Upgraded Python 2 to Python 3",
      "Supported iOS 7 and later",
      "Shipped version 2 of the API",
      "Ran phase 3 trials",
      "Python 2 applications moved to new servers",
      "Java 8 services retired",
      "Led three engineers",
    ]
    expect(check("P7", resumeWith(job(versions))).status).toBe("passed")
    expect(check("P7", resumeWith(job(["Led 3 engineers", "Ran 4 sprints", "Mentored five interns"]))).messages).toEqual([
      "“five” here, digits elsewhere",
    ])
    // Labels written as words aren't counts either.
    expect(check("P7", resumeWith(job(["Led 3 engineers", "Ran phase three trials", "Shipped level two support"]))).status).toBe("passed")
  })

  test("flags a bullet with both a digit and a word, written the usual way", () => {
    expect(check("P7", resumeWith(job(["Led 5 engineers and mentored four interns", "Ran 3 sprints"]))).findings).toEqual([
      expect.objectContaining({ place: bulletAt(0), message: "“5” and “four” in one bullet", suggestion: "Write “4”." }),
    ])
    // With nothing else to go by, small counts go in words.
    expect(check("P7", resumeWith(job(["Led 5 engineers and mentored four interns", "Built the index"]))).findings).toEqual([
      expect.objectContaining({ suggestion: "Write “five”." }),
    ])
  })

  test("leaves measurements and sizes out, in digits or words", () => {
    const bullets = [
      "Mentor two junior engineers",
      "Cut latency to 9 ms",
      "Served 4 million users",
      "Took 2 minutes off each build",
      "Ran for six months",
      "Found two steps to cut, taking the wait from 9 days to 6 across 30 centers",
    ]
    expect(check("P7", resumeWith(job(bullets))).status).toBe("passed")
  })
})
