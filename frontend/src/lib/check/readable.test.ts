import { describe, expect, test } from "vitest"
import type { Resume } from "@/lib/resume"
import type { PdfReading } from "./engine"
import { runChecks } from "./engine"
import { RULES } from "./rules"
import { line, reading } from "./testPdf"

const jake = {
  profileSection: { fullName: "Jake Ryan", email: "jake@gmail.com", phoneNumber: "(512) 555-0142" },
  workExperienceSection: [
    {
      id: 1,
      workRole: "Software Engineer II",
      companyName: "Stripe",
      workStartDate: "Jan 2024",
      workEndDate: "Present",
      workDescription: "• Built the ledger",
    },
  ],
}

// What the reader finds in Jake's PDF when it reads everything right.
const found = {
  profile: { fullName: "JAKE RYAN", email: "jake@gmail.com", phoneNumber: "512.555.0142" },
  sections: [
    {
      name: "Work" as const,
      entries: [
        {
          fields: { workRole: "Software Engineer II", companyName: "Stripe", workStartDate: "Jan 2024", workEndDate: "Present" },
          lines: [],
        },
      ],
    },
  ],
}

/** What one rule says about a resume and its PDF. */
function check(id: string, resume: Resume, pdf: PdfReading = reading([], found)) {
  const rule = RULES.find((rule) => rule.id === id)!
  const report = runChecks(resume, { rules: [rule], pdf })
  const [result] = report.results
  return {
    status: result.status,
    checked: result.checked,
    partial: result.partial ?? false,
    messages: report.findings.map((finding) => finding.message),
    findings: report.findings,
  }
}

test("a PDF that reads back as typed passes every readability rule", () => {
  for (const id of ["R1", "R2", "R3", "R4", "R5", "R6", "R8"]) expect(check(id, jake).status, id).toBe("passed")
})

describe("R1 contact details", () => {
  test("is a fix for each one the reader can't find, ignoring case and how a phone is written", () => {
    const pdf = reading([], { ...found, profile: { fullName: "Jake Ryan", phoneNumber: "512 555 0142" } })
    expect(check("R1", jake, pdf).findings).toEqual([
      expect.objectContaining({
        level: "fix",
        place: { kind: "profile", field: "email" },
        message: "Hiring software can't find your email in the PDF",
      }),
    ])
  })

  test("finds a phone number written as other countries write them, wherever the PDF prints it", () => {
    // The resume reader only knows North American numbers, so it finds none of these.
    for (const phoneNumber of ["07911 123456", "030 12345678", "06 12 34 56 78", "0412 345 678", "+44 20 7946 0958", "555-0134"]) {
      const resume = { ...jake, profileSection: { ...jake.profileSection, phoneNumber } }
      const pdf = reading([line(`Austin, TX | ${phoneNumber} | jake@gmail.com`)], {
        ...found,
        profile: { ...found.profile, phoneNumber: "" },
      })
      expect(check("R1", resume, pdf).status, phoneNumber).toBe("passed")
    }
  })

  test("is a fix for a phone number the PDF doesn't print", () => {
    const pdf = reading([line("Austin, TX | jake@gmail.com")], { ...found, profile: { ...found.profile, phoneNumber: "" } })
    expect(check("R1", jake, pdf).findings).toEqual([
      expect.objectContaining({
        level: "fix",
        place: { kind: "profile", field: "phoneNumber" },
        message: "Hiring software can't find your phone number in the PDF",
      }),
    ])
  })

  // pdf.js reads U+0000 for each character no font has.
  test("looks only for the part of a contact detail that prints, and leaves one with none of it to R8", () => {
    const resume = { ...jake, profileSection: { ...jake.profileSection, fullName: "Jake Ryan 杰克" } }
    const pdf = reading([], { ...found, profile: { ...found.profile, fullName: "JAKE RYAN \0\0" } })
    expect(check("R1", resume, pdf)).toMatchObject({ status: "passed", checked: 3 })

    const chinese = { ...jake, profileSection: { ...jake.profileSection, fullName: "杰克" } }
    const unprinted = reading([], { ...found, profile: { ...found.profile, fullName: "\0\0" } })
    expect(check("R1", chinese, unprinted)).toMatchObject({ status: "passed", checked: 2 })
  })

  test("finds a name a template prints in capitals, ß and all", () => {
    const resume = { ...jake, profileSection: { ...jake.profileSection, fullName: "Max Strauß" } }
    for (const fullName of ["MAX STRAUSS", "MAX STRAUẞ", "Max Strauß"]) {
      expect(check("R1", resume, reading([], { ...found, profile: { ...found.profile, fullName } })).status, fullName).toBe("passed")
    }
  })
})

describe("R2 section headings", () => {
  test("is a fix for a printed section the reader doesn't find, naming its heading", () => {
    const resume = { ...jake, headings: { work: "My Journey" } }
    expect(check("R2", resume, reading([], { ...found, sections: [] })).findings).toEqual([
      expect.objectContaining({
        level: "fix",
        place: { kind: "heading", section: "Work" },
        message: "Hiring software may not know “My Journey” as a heading",
        suggestion: "Use a usual one, like “Experience”.",
      }),
    ])
  })
})

describe("R3 entries read as typed", () => {
  test("takes values the reader puts in a neighbouring field of the same entry", () => {
    const swapped = {
      ...found,
      sections: [
        {
          name: "Work" as const,
          entries: [
            {
              fields: { workRole: "Stripe", companyName: "Software Engineer II", workStartDate: "Jan 2024", workEndDate: "Present" },
              lines: [],
            },
          ],
        },
      ],
    }
    expect(check("R3", jake, reading([], swapped)).status).toBe("passed")
  })

  test("flags a value the entry doesn't have at all", () => {
    const missing = {
      ...found,
      sections: [
        {
          name: "Work" as const,
          entries: [{ fields: { workRole: "Software Engineer II", companyName: "Stripe", workStartDate: "Jan 2024" }, lines: [] }],
        },
      ],
    }
    expect(check("R3", jake, reading([], missing)).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Work", entry: 0, field: "workEndDate" },
        message: "Hiring software may not read the end date with this entry",
      }),
    ])
  })

  test("matches whole words, so “IT” isn't found inside “Digital”", () => {
    const resume = { ...jake, workExperienceSection: [{ ...jake.workExperienceSection[0], workRole: "IT" }] }
    const digital = {
      ...found,
      sections: [
        {
          name: "Work" as const,
          entries: [
            { fields: { workRole: "Digital", companyName: "Stripe", workStartDate: "Jan 2024", workEndDate: "Present" }, lines: [] },
          ],
        },
      ],
    }
    expect(check("R3", resume, reading([], digital)).findings.map(({ place }) => place)).toEqual([
      { kind: "entry", section: "Work", entry: 0, field: "workRole" },
    ])
  })

  test("checks awards, papers and skills too", () => {
    const resume = { ...jake, awardsSection: [{ id: 1, awardName: "Dean's List", awardDate: "2024" }] }
    const awards = {
      ...found,
      sections: [
        ...found.sections,
        { name: "Awards" as const, entries: [{ fields: { awardName: "Deans", awardDate: "2024" }, lines: [] }] },
      ],
    }
    expect(check("R3", resume, reading([], awards)).findings.map(({ place }) => place)).toEqual([
      { kind: "entry", section: "Awards", entry: 0, field: "awardName" },
    ])
  })

  test("says what in the value may trip hiring software up, and says less when nothing does", () => {
    const unread = (workRole: string) => {
      const resume = { ...jake, workExperienceSection: [{ ...jake.workExperienceSection[0], workRole }] }
      const noRole = {
        ...found,
        sections: [
          {
            name: "Work" as const,
            entries: [{ fields: { companyName: "Stripe", workStartDate: "Jan 2024", workEndDate: "Present" }, lines: [] }],
          },
        ],
      }
      return check("R3", resume, reading([], noRole)).findings.map(({ message, suggestion }) => ({ message, suggestion }))
    }
    expect(unread("Engineer, Payments")).toEqual([
      {
        message: "Hiring software doesn't read the role with this entry",
        suggestion: expect.stringContaining("split it at a comma or a dash"),
      },
    ])
    expect(unread("Engineer since Jan 2024")).toEqual([
      { message: "Hiring software doesn't read the role with this entry", suggestion: "Move the date to the entry's date fields." },
    ])
    expect(unread("Staff Engineer")).toEqual([
      { message: "Hiring software may not read the role with this entry", suggestion: expect.stringContaining("dismiss this") },
    ])

    // A date written the usual way has nothing to change; one written another way does.
    const noStart = (workStartDate: string) => {
      const resume = { ...jake, workExperienceSection: [{ ...jake.workExperienceSection[0], workStartDate }] }
      const missing = {
        ...found,
        sections: [
          {
            name: "Work" as const,
            entries: [{ fields: { workRole: "Software Engineer II", companyName: "Stripe", workEndDate: "Present" }, lines: [] }],
          },
        ],
      }
      return check("R3", resume, reading([], missing)).findings.map(({ message, suggestion }) => ({ message, suggestion }))
    }
    expect(noStart("Jan 2024")).toEqual([
      { message: "Hiring software may not read the start date with this entry", suggestion: expect.stringContaining("dismiss this") },
    ])
    expect(noStart("Q1 of 2024")).toEqual([
      {
        message: "Hiring software doesn't read the start date with this entry",
        suggestion: "Write it the usual way, like “Jan 2024”, “2024” or “Present”.",
      },
    ])
  })

  test("flags a section where the reader finds a different number of entries", () => {
    const merged = { ...found, sections: [{ name: "Work" as const, entries: [] }] }
    expect(check("R3", jake, reading([], merged)).findings).toEqual([
      expect.objectContaining({ place: { kind: "section", section: "Work" }, message: "Hiring software reads 0 entries here, not 1" }),
    ])
  })

  test("asks only for a name on each project, which has no role or place and needn't have a date", () => {
    const resume = {
      ...jake,
      projectsSection: [
        { id: 1, projectName: "Inkwell" },
        { id: 2, projectName: "Ferry" },
      ],
    }
    const merged = {
      ...found,
      sections: [...found.sections, { name: "Projects" as const, entries: [{ fields: { projectName: "Inkwell" }, lines: [] }] }],
    }
    expect(check("R3", resume, reading([], merged)).findings).toEqual([
      expect.objectContaining({
        place: { kind: "section", section: "Projects" },
        message: "Hiring software reads 1 entry here, not 2",
        suggestion: "A project may be running into the next one. Check each has its own name.",
      }),
    ])
  })
})

describe("R4 text the reader can't place", () => {
  test("points at the field it came from, or else its page", () => {
    const lines = [line("Built the ledger"), line("Stray words", { page: 1 })]
    const pdf = reading(lines, {
      ...found,
      unplaced: [
        { id: "unplaced:0:0", heading: "", headingLine: 0, lines: [0], text: ["Built the ledger"] },
        { id: "unplaced:1:1", heading: "", headingLine: 1, lines: [1], text: ["Stray words"] },
      ],
    })
    expect(check("R4", jake, pdf).findings.map(({ place }) => place)).toEqual([
      { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 0 },
      { kind: "page", page: 1 },
    ])
  })

  test("points a line with two fields on it at the one that makes up most of it", () => {
    const degree = "B.S. in Computer Science and Economics, Minor in Statistics"
    const resume = {
      ...jake,
      profileSection: { ...jake.profileSection, location: "Ann Arbor, MI" },
      educationSection: [{ id: 1, schoolName: "University of Michigan", schoolLocation: "Ann Arbor, MI", degree }],
    }
    const text = `${degree} Ann Arbor, MI`
    const pdf = reading([line(text)], {
      ...found,
      unplaced: [{ id: "unplaced:0:0", heading: "Education", headingLine: 0, lines: [0], text: [text] }],
    })
    expect(check("R4", resume, pdf).findings.map(({ place }) => place)).toEqual([
      { kind: "entry", section: "Education", entry: 0, field: "degree" },
    ])
  })

  test("points a line at a field in the section it was found under, before a longer one elsewhere", () => {
    const resume = {
      ...jake,
      profileSection: { ...jake.profileSection, location: "San Francisco Bay Area, California" },
      educationSection: [{ id: 1, schoolName: "Stanford University", schoolLocation: "Stanford, California" }],
    }
    // Both the profile's location and the school's place are on the line; it's under Education.
    const text = "Stanford, California · San Francisco Bay Area, California"
    const pdf = reading([line(text)], {
      ...found,
      unplaced: [{ id: "unplaced:0:0", heading: "Education", headingLine: 0, lines: [0], text: [text] }],
    })
    expect(check("R4", resume, pdf).findings.map(({ place }) => place)).toEqual([
      { kind: "entry", section: "Education", entry: 0, field: "schoolLocation" },
    ])
  })

  test("points a line at the field in the section it was found under, before the same text elsewhere", () => {
    const resume = {
      ...jake,
      projectsSection: [{ id: 1, projectName: "Ledger", projectDescription: "• Built the ledger" }],
    }
    const pdf = reading([line("Built the ledger")], {
      ...found,
      unplaced: [{ id: "unplaced:0:0", heading: "Projects", headingLine: 0, lines: [0], text: ["Built the ledger"] }],
    })
    expect(check("R4", resume, pdf).findings.map(({ place }) => place)).toEqual([
      { kind: "entry", section: "Projects", entry: 0, field: "projectDescription", line: 0 },
    ])
  })

  test("points text with no letters or digits at its page", () => {
    const pdf = reading([line("— · —", { page: 1 })], {
      ...found,
      unplaced: [{ id: "unplaced:0:0", heading: "", headingLine: 0, lines: [0], text: ["— · —"] }],
    })
    expect(check("R4", jake, pdf).findings.map(({ place }) => place)).toEqual([{ kind: "page", page: 1 }])
  })

  test("leaves out text read with characters that didn't print, as a place in a script no font has", () => {
    const resume = { ...jake, profileSection: { ...jake.profileSection, location: "دبي, UAE" } }
    const pdf = reading([line("\0\0\0, UAE")], {
      ...found,
      unplaced: [{ id: "unplaced:0:0", heading: "Top of the resume", headingLine: 0, lines: [0], text: ["\0\0\0, UAE"] }],
    })
    expect(check("R4", resume, pdf)).toMatchObject({ status: "passed", partial: true, messages: [] })
  })
})

describe("R2–R4 while a section's text doesn't print", () => {
  // The role reads as nothing, so the reader doesn't find the job where it is.
  const resume = { ...jake, workExperienceSection: [{ ...jake.workExperienceSection[0], workRole: "软件工程师" }] }
  const pdf = reading([line("\0\0\0\0\0 Jan 2024 - Present"), line("Stripe")], {
    ...found,
    sections: [],
    unplaced: [{ id: "unplaced:0:0", heading: "", headingLine: 0, lines: [0, 1], text: ["\0\0\0\0\0 Jan 2024 - Present", "Stripe"] }],
  })

  test("find nothing until it does, as it may be what threw the reading out, and R8 says what to change", () => {
    for (const id of ["R2", "R3", "R4"]) expect(check(id, resume, pdf), id).toMatchObject({ status: "passed", partial: true, messages: [] })
    expect(check("R8", resume, pdf).messages).toEqual(["“软件工程师” doesn't print"])
  })

  test("still check a resume whose name is all that doesn't print", () => {
    const named = { ...jake, profileSection: { ...jake.profileSection, fullName: "杰克" } }
    const noWork = reading([], { ...found, profile: { ...found.profile, fullName: "\0\0" }, sections: [] })
    expect(check("R2", named, noWork).messages).toEqual(["Hiring software may not know “Experience” as a heading"])
  })
})

describe("R5 symbols and emoji", () => {
  test("flags emoji, arrows and stars, wherever they're typed", () => {
    const resume = {
      ...jake,
      workExperienceSection: [
        { ...jake.workExperienceSection[0], workRole: "Engineer ★", workDescription: "• Shipped it 🚀\n• Cut costs → saved $2M" },
      ],
    }
    expect(check("R5", resume).messages).toEqual(["“★” may not come through", "“🚀” may not come through", "“→” may not come through"])
  })

  test("takes normal punctuation, ©, ® and ™, and leaves a typed bullet to R6", () => {
    const resume = {
      ...jake,
      workExperienceSection: [
        { ...jake.workExperienceSection[0], workDescription: "• Built “Atlas” — Microsoft® Office™, 2020–2024…\n• ◦ Led the team" },
      ],
    }
    expect(check("R5", resume).status).toBe("passed")
  })
})

describe("R8 text no font has", () => {
  test("is a fix naming what doesn't print, wherever it's typed, and says it's the fonts, not the typing", () => {
    const resume = {
      ...jake,
      profileSection: { ...jake.profileSection, fullName: "王小明" },
      headings: { work: "工作经历" },
      workExperienceSection: [
        { ...jake.workExperienceSection[0], workRole: "软件工程师", workDescription: "• Built the ledger\n• 优化了数据库" },
      ],
    }
    const { findings } = check("R8", resume)
    expect(findings.map(({ level, place, message }) => ({ level, place, message }))).toEqual([
      { level: "fix", place: { kind: "profile", field: "fullName" }, message: "“王小明” doesn't print" },
      { level: "fix", place: { kind: "heading", section: "Work" }, message: "“工作经历” doesn't print" },
      { level: "fix", place: { kind: "entry", section: "Work", entry: 0, field: "workRole" }, message: "“软件工程师” doesn't print" },
      {
        level: "fix",
        place: { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 1 },
        message: "“优化了数据库” doesn't print",
      },
    ])
    expect(findings[0]).toMatchObject({
      why: "The templates' fonts don't have these characters, so the PDF leaves them out or prints boxes, and hiring software can't read them.",
      suggestion: "Your typing is fine. For now, write it in Latin letters.",
    })
  })

  test("names words that don't print together, and lists the stretches of a line that mixes them with ones that do", () => {
    const resume = {
      ...jake,
      profileSection: { ...jake.profileSection, fullName: "محمد علي", location: "Bangkok กรุงเทพ, Thailand" },
      workExperienceSection: [
        {
          ...jake.workExperienceSection[0],
          workDescription: "• 使用React和TypeScript开发\n• 一 a 二 b 三 c 四",
        },
      ],
    }
    expect(check("R8", resume).messages).toEqual([
      "“محمد علي” doesn't print",
      "“กรุงเทพ” doesn't print",
      "“使用”, “和” and “开发” don't print",
      "“一”, “二” and 2 more don't print",
    ])
  })

  test("leaves letters some font has alone: accents, Vietnamese, Cyrillic, Greek and Hebrew", () => {
    const resume = {
      ...jake,
      profileSection: { ...jake.profileSection, fullName: "Nguyễn Thị Ánh", location: "Łódź · Москва · Αθήνα · תל אביב" },
    }
    expect(check("R8", resume).status).toBe("passed")
  })

  test("says to type letters in a style pasted in as plain ones, which print", () => {
    const resume = {
      ...jake,
      profileSection: { ...jake.profileSection, location: "Ｓｈａｎｇｈａｉ" },
      workExperienceSection: [{ ...jake.workExperienceSection[0], workRole: "𝐒𝐞𝐧𝐢𝐨𝐫 Engineer" }],
    }
    expect(check("R8", resume).findings.map(({ message, suggestion }) => [message, suggestion])).toEqual([
      ["“Ｓｈａｎｇｈａｉ” doesn't print", "These look like letters but aren't, so no font has them. Type them as plain letters."],
      ["“𝐒𝐞𝐧𝐢𝐨𝐫” doesn't print", "These look like letters but aren't, so no font has them. Type them as plain letters."],
    ])
  })

  test("leaves emoji and symbols to R5, and spaces and invisible characters alone", () => {
    const resume = {
      ...jake,
      workExperienceSection: [{ ...jake.workExperienceSection[0], workDescription: "• Shipped it 🚀\n• Led the\u3000team\u200D of 5" }],
    }
    expect(check("R8", resume).status).toBe("passed")
    expect(check("R5", resume).messages).toEqual(["“🚀” may not come through"])
  })

  test("leaves out a project's links behind its name, which aren't printed as text", () => {
    const withLinks = (projectLinks: string) => ({
      ...jake,
      projectLinks,
      projectsSection: [{ id: 2, projectName: "Ledger", additionalLink: "zh.wikipedia.org/wiki/项目" }],
    })
    expect(check("R8", withLinks("title")).status).toBe("passed")
    expect(check("R4", withLinks("title")).partial).toBe(false)
    // Printed as text, the link has letters no font has, as any field can.
    expect(check("R8", withLinks("show")).messages).toEqual(["“项目” doesn't print"])
    expect(check("R4", withLinks("show")).partial).toBe(true)
  })
})

describe("R7 project links printed as text", () => {
  const withProjects = (projectLinks: string) => ({
    ...jake,
    projectLinks,
    projectsSection: [
      { id: 1, projectName: "Gitlytics", projectGithub: "github.com/jake/gitlytics" },
      { id: 2, projectName: "Raft", projectGithub: "github.com/jake/raft", additionalLink: "raft.dev" },
      { id: 3, projectName: "Notes" },
    ],
  })

  test("flags a link only behind the project's name, and a website left out next to it", () => {
    expect(check("R7", withProjects("title")).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Projects", entry: 0, field: "projectGithub" },
        message: "Link not printed",
      }),
      expect.objectContaining({
        place: { kind: "entry", section: "Projects", entry: 1, field: "projectGithub" },
        message: "Link not printed, and its website left out",
      }),
    ])
  })

  test("skips links printed as text", () => {
    expect(check("R7", withProjects("show")).status).toBe("skipped")
    expect(check("R7", jake).status).toBe("skipped")
  })
})

describe("R6 bullet characters typed into bullets", () => {
  test("is a fix for a bullet that starts with one", () => {
    const resume = {
      ...jake,
      workExperienceSection: [{ ...jake.workExperienceSection[0], workDescription: "• • Built it\n• - Led it\n• ◦ Ran it\n• -5% churn" }],
    }
    expect(check("R6", resume).findings.map(({ level, message }) => [level, message])).toEqual([
      ["fix", "Starts with “•”, so it shows two bullets"],
      ["fix", "Starts with “-”, so it shows two bullets"],
      ["fix", "Starts with “◦”, so it shows two bullets"],
    ])
  })
})
