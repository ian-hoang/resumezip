import { describe, expect, test } from "vitest"
import { CORE_SECTIONS } from "@/components/editor/sections"
import type { Resume } from "@/lib/resume"
import { asSaved } from "@/lib/testResume"
import { findingKey, placeExists, ruleOfKey, textAt, type Place } from "./places"
import { runChecks } from "./engine"
import { describePlace } from "./labels"
import { resumeTypeOf, textsOf, viewOf } from "./resume"

const ada = asSaved({
  resumeTag: "academic",
  profileSection: { fullName: "  Ada Lovelace ", email: "ada@example.com", phoneNumber: null },
  headings: { work: " Engines ", edu: "" },
  sectionOrder: ["Work", "Nope", "Work", "Education"],
  workExperienceSection: [
    {
      id: 1,
      workRole: "Engineer",
      companyName: "Analytical Engines",
      workDescription: "• **Built** a *faster* loom\n\n•   \n• Wrote the notes\n",
    },
    { id: 2 },
  ],
  educationSection: [{ id: 1, schoolName: "University of London", degree: "B.A. in Mathematics" }],
})

describe("reading a resume for the checks", () => {
  test("reads each field as trimmed text, and missing or empty ones as ''", () => {
    const view = viewOf(ada)
    expect(view.profile).toEqual({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phoneNumber: "",
      location: "",
      linkedin: "",
      profileGithub: "",
      personalWebsite: "",
      summary: "",
    })
    expect(view.sections.Work[0].values).toMatchObject({ workRole: "Engineer", workLocation: "", workStartDate: "" })
    expect(view.sections.Projects).toEqual([])
  })

  test("reads bullets one at a time, with the line each is on, without the bullet or bold and italic marks", () => {
    expect(viewOf(ada).sections.Work[0].bullets).toEqual([
      { field: "workDescription", line: 0, number: 1, raw: "**Built** a *faster* loom", text: "Built a faster loom" },
      { field: "workDescription", line: 3, number: 2, raw: "Wrote the notes", text: "Wrote the notes" },
    ])
  })

  test("reads bullets saved as a list, as older resumes did", () => {
    const old = asSaved({ workExperienceSection: [{ workDescription: ["Built a loom", "", "Wrote the notes"] }] })
    expect(viewOf(old).sections.Work[0].bullets.map((bullet) => [bullet.line, bullet.text])).toEqual([
      [0, "Built a loom"],
      [2, "Wrote the notes"],
    ])
  })

  test("knows an entry that was added but never filled in", () => {
    const [filled, blank] = viewOf(ada).sections.Work
    expect([filled.blank, blank.blank]).toEqual([false, true])
    expect(blank).toMatchObject({ section: "Work", index: 1, bullets: [] })
    const bare = viewOf({ workExperienceSection: [{ id: 1, workRole: " ", workDescription: "• \n•" }] })
    expect(bare.sections.Work[0].blank).toBe(true)
  })

  test("reads renamed section titles, and the order the sections are printed in", () => {
    const view = viewOf(ada)
    expect(view.headings.Work).toBe("Engines")
    expect(view.headings.Education).toBe("")
    expect(view.order.slice(0, 2)).toEqual(["Work", "Education"])
    expect([...view.order].sort()).toEqual([...CORE_SECTIONS].sort())
  })

  test("doesn't break on fields in shapes the editor doesn't save", () => {
    const view = viewOf(
      asSaved({ profileSection: "Ada", headings: [], workExperienceSection: { companyName: "Acme" }, educationSection: [null, "junk"] }),
    )
    expect(view.profile.fullName).toBe("")
    expect(view.sections.Work).toEqual([])
    expect(view.sections.Education.map((entry) => entry.blank)).toEqual([true, true])
  })

  test("counts resumes without a type, or with one it doesn't know, as Professional", () => {
    expect(resumeTypeOf({ resumeTag: "academic" })).toBe("academic")
    expect(resumeTypeOf({ resumeTag: "personal" })).toBe("personal")
    expect(resumeTypeOf({ resumeTag: "professional" })).toBe("professional")
    expect(resumeTypeOf({})).toBe("professional")
    expect(resumeTypeOf({ resumeTag: "student" })).toBe("professional")
  })

  test("lists every typed text where it's printed, in order", () => {
    expect(textsOf(viewOf(ada))).toEqual([
      { place: { kind: "profile", field: "fullName" }, text: "Ada Lovelace" },
      { place: { kind: "profile", field: "email" }, text: "ada@example.com" },
      { place: { kind: "heading", section: "Work" }, text: "Engines" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "workRole" }, text: "Engineer" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "companyName" }, text: "Analytical Engines" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 0 }, text: "Built a faster loom" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 3 }, text: "Wrote the notes" },
      { place: { kind: "entry", section: "Education", entry: 0, field: "schoolName" }, text: "University of London" },
      { place: { kind: "entry", section: "Education", entry: 0, field: "degree" }, text: "B.A. in Mathematics" },
    ])
  })
})

describe("places on a resume", () => {
  const view = viewOf(ada)
  const bullet: Place = { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 3 }

  test("give the text there, as typed", () => {
    expect(textAt(view, { kind: "profile", field: "email" })).toBe("ada@example.com")
    expect(textAt(view, { kind: "heading", section: "Work" })).toBe("Engines")
    expect(textAt(view, bullet)).toBe("Wrote the notes")
    expect(textAt(view, { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 0 })).toBe("**Built** a *faster* loom")
    expect(textAt(view, { kind: "entry", section: "Work", entry: 0, field: "workRole" })).toBe("Engineer")
    // A whole entry reads as it does when collapsed in the editor.
    expect(textAt(view, { kind: "entry", section: "Work", entry: 0 })).toBe("Engineer, Analytical Engines")
    expect(textAt(view, { kind: "section", section: "Skills" })).toBe("")
  })

  test("are only on the resume if the editor can open them", () => {
    expect(placeExists(view, bullet)).toBe(true)
    expect(placeExists(view, { kind: "entry", section: "Work", entry: 1 })).toBe(true)
    expect(placeExists(view, { kind: "entry", section: "Work", entry: 2 })).toBe(false)
    expect(placeExists(view, { kind: "entry", section: "Work", entry: 0, line: 0 })).toBe(false)
    expect(placeExists(view, { kind: "entry", section: "Nope" as never, entry: 0 })).toBe(false)
    expect(placeExists(view, { kind: "profile", field: "password" as never })).toBe(false)
    expect(placeExists(view, { kind: "page" })).toBe(true)
    expect(placeExists(view, { kind: "page", page: 2 }, 2)).toBe(true)
    expect(placeExists(view, { kind: "page", page: 3 }, 2)).toBe(false)
  })

  test("tell findings apart by rule, field and text, but not by which line a bullet is on", () => {
    const key = findingKey("B1", bullet, "Wrote the notes")
    expect(findingKey("B1", { ...bullet, line: 7 }, "Wrote the notes")).toBe(key)
    expect(findingKey("B1", bullet, "Wrote  the notes ")).toBe(key)
    expect(findingKey("B1", bullet, "Wrote the guide")).not.toBe(key)
    expect(findingKey("B2", bullet, "Wrote the notes")).not.toBe(key)
    expect(findingKey("B1", { ...bullet, entry: 1 }, "Wrote the notes")).not.toBe(key)
    expect(ruleOfKey(key)).toBe("B1")
    expect(ruleOfKey("junk")).toBe("")
  })

  test("tell pages apart, even when they have the same text or none", () => {
    const first = findingKey("L3", { kind: "page", page: 1 }, "")
    expect(findingKey("L3", { kind: "page", page: 2 }, "")).not.toBe(first)
    expect(findingKey("L3", { kind: "page" }, "")).not.toBe(first)
    expect(findingKey("L3", { kind: "page", page: 1 }, "")).toBe(first)
  })
})

describe("what the person left out", () => {
  const tailored: Resume = {
    workExperienceSection: [
      { id: 1, workRole: "Intern", companyName: "Initech", leftOut: true },
      {
        id: 2,
        workRole: "Engineer",
        companyName: "Analytical Engines",
        workDescription: "• Built a loom\n○ Fed the cat\n• Wrote the notes",
      },
    ],
  }
  const view = viewOf(tailored)

  test("isn't read, and what is keeps its place in the editor", () => {
    expect(view.sections.Work.map((entry) => entry.index)).toEqual([1])
    expect(view.sections.Work[0].bullets.map(({ line, text }) => ({ line, text }))).toEqual([
      { line: 0, text: "Built a loom" },
      { line: 2, text: "Wrote the notes" },
    ])
    expect(view.sections.Work[0].values.workDescription).not.toContain("Fed the cat")
    expect(textsOf(view).map((found) => found.text)).not.toContain("Intern")
  })

  test("isn't on the resume as far as findings go, and entries after it are found by their place in the editor", () => {
    expect(textAt(view, { kind: "entry", section: "Work", entry: 1, field: "workRole" })).toBe("Engineer")
    expect(textAt(view, { kind: "entry", section: "Work", entry: 1, field: "workDescription", line: 2 })).toBe("Wrote the notes")
    expect(placeExists(view, { kind: "entry", section: "Work", entry: 1, field: "workDescription", line: 2 })).toBe(true)
    expect(placeExists(view, { kind: "entry", section: "Work", entry: 0 })).toBe(false)
    expect(placeExists(view, { kind: "entry", section: "Work", entry: 1, field: "workDescription", line: 1 })).toBe(false)
    // Numbered as the editor numbers them, left-out bullets included.
    expect(describePlace(view, { kind: "entry", section: "Work", entry: 1, field: "workDescription", line: 2 })).toBe(
      "Experience → Analytical Engines · bullet 3",
    )
  })

  test("leaves out a section's renamed title when nothing in the section is printed", () => {
    const renamed = viewOf({ ...tailored, headings: { work: "Jobs & mgmt" } })
    expect(textsOf(renamed).some((found) => found.place.kind === "heading")).toBe(true)
    const allLeftOut = viewOf({
      headings: { work: "Jobs & mgmt" },
      workExperienceSection: tailored.workExperienceSection?.map((entry) => ({ ...entry, leftOut: true as const })),
    })
    expect(textsOf(allLeftOut).some((found) => found.place.kind === "heading")).toBe(false)
  })

  test("isn't flagged by the rules", () => {
    const bullets = (count: number, marker: string) =>
      Array.from({ length: count }, (_, index) => `${marker} Built feature ${index + 1} for 40% more users`)
    const job = { id: 1, workRole: "Engineer", companyName: "Analytical Engines", workStartDate: "Jan 2020", workEndDate: "Present" }
    // An intern job with no bullets, which B8 would flag if it were printed.
    const internship = { id: 2, workRole: "Intern", companyName: "Initech" }
    const tooMany = (resume: Record<string, unknown>) =>
      runChecks({ profileSection: { fullName: "Ada Lovelace" }, ...resume }).findings.filter((finding) => finding.rule === "B8")

    // 6 bullets printed and 2 left out is no more than 6; a left-out job isn't missing bullets.
    const tailored = tooMany({
      workExperienceSection: [
        { ...job, workDescription: [...bullets(6, "•"), ...bullets(2, "○")].join("\n") },
        { ...internship, leftOut: true },
      ],
    })
    expect(tailored).toEqual([])
    // Printed, the same resume has too many bullets in one job and none in the other.
    const whole = tooMany({ workExperienceSection: [{ ...job, workDescription: bullets(8, "•").join("\n") }, internship] })
    expect(whole.map((finding) => finding.message)).toEqual(["8 bullets to review", "No description"])
  })
})
