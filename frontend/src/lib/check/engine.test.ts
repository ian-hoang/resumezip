import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import { SECTION_NAMES } from "@/components/editor/sections"
import { runChecks, type CheckInput, type Finding, type Outcome, type PdfReading, type Problem, type Rule } from "./engine"
import type { Place } from "./places"
import { textsOf } from "./resume"
import { RULES } from "./rules"
import { AUTOMATIC_PASSES, CATEGORIES, LEVELS, type CategoryId, type Level } from "./settings"
import { CHECK_FIELD, dismiss, readCheckState } from "./state"

const SAMPLES = path.resolve("src/lib/typst/preview-samples")
const samples = readdirSync(SAMPLES).map((file) => JSON.parse(readFileSync(path.join(SAMPLES, file), "utf8")))

const ada = {
  resumeTag: "professional",
  profileSection: { fullName: "Ada Lovelace", email: "ada@example" },
  workExperienceSection: [
    {
      id: 1,
      workRole: "Engineer",
      companyName: "Analytical Engines",
      workDescription: "• Responsible for the engine\n• Built a loom with 40% fewer parts\n\n• Helped with the notes",
    },
  ],
}

/** A rule for tests: a suggestion about bullets, unless told otherwise. */
function formRule(id: string, check: (input: CheckInput) => Outcome | null, more: { category?: CategoryId; level?: Level } = {}): Rule {
  return { id, category: "bullets", level: "look", title: `Check ${id}`, why: `Why ${id} matters`, reads: "form", check, ...more }
}

const bulletPlace = (entry: number, line: number): Place => ({ kind: "entry", section: "Work", entry, field: "workDescription", line })

// Flags bullets that start with "Responsible for" or "Helped".
const weakStarts = formRule("B1", ({ resume }) => {
  const bullets = resume.sections.Work.flatMap((entry) => entry.bullets.map((bullet) => ({ entry, bullet })))
  return {
    checked: bullets.length,
    problems: bullets
      .filter(({ bullet }) => /^(Responsible for|Helped)\b/.test(bullet.text))
      .map(({ entry, bullet }) => ({ place: bulletPlace(entry.index, bullet.line), message: "Weak start" })),
  }
})

// Flags an email address that isn't a whole one.
const realEmail = formRule(
  "C2",
  ({ resume }) => ({
    checked: 1,
    problems: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(resume.profile.email)
      ? []
      : [{ place: { kind: "profile", field: "email" }, message: "Not a whole email address" }],
  }),
  { category: "contact", level: "fix" },
)

const withCheck = (resume: Record<string, any>, check: unknown): Record<string, any> => ({ ...resume, [CHECK_FIELD]: check })
const dismissed = (resume: Record<string, any>, finding: Finding): Record<string, any> =>
  withCheck(resume, dismiss(readCheckState(resume), finding))

const reading = (pages = 1): PdfReading => ({
  lines: [],
  pages: Array.from({ length: pages }, () => ({ width: 612, height: 792 })),
  parsed: { lines: [], profile: {}, profileLines: [], sections: [], unplaced: [] },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("running the rules", () => {
  test("collects what each rule found, with the rule's level and reason, and the text it's about", () => {
    const report = runChecks(ada, { rules: [weakStarts, realEmail] })
    expect(report.findings).toEqual([
      {
        rule: "C2",
        level: "fix",
        category: "contact",
        place: { kind: "profile", field: "email" },
        message: "Not a whole email address",
        why: "Why C2 matters",
        text: "ada@example",
        key: expect.any(String),
        dismissed: false,
      },
      expect.objectContaining({ rule: "B1", place: bulletPlace(0, 0), text: "Responsible for the engine" }),
      // The blank line stays counted, so the editor finds the bullet where it is.
      expect.objectContaining({ rule: "B1", place: bulletPlace(0, 3), text: "Helped with the notes" }),
    ])
    expect(report.dismissed).toEqual([])
  })

  test("gives a rule credit for the share of what it checked that had no problem", () => {
    const [bullets, email] = runChecks(ada, { rules: [weakStarts, realEmail] }).results
    expect(bullets).toMatchObject({ status: "failed", checked: 3, credit: 1 / 3 })
    expect(email).toMatchObject({ status: "failed", checked: 1, credit: 0 })
    const fixed = { ...ada, profileSection: { ...ada.profileSection, email: "ada@example.com" } }
    expect(runChecks(fixed, { rules: [realEmail] }).results[0]).toMatchObject({ status: "passed", credit: 1, findings: [] })
  })

  test("takes a rule's own credit when it gives one, kept between 0 and 1", () => {
    const credit = (value: number) =>
      runChecks(ada, {
        rules: [formRule("B3", () => ({ checked: 4, credit: value, problems: [{ place: bulletPlace(0, 1), message: "Few numbers" }] }))],
      }).results[0].credit
    expect(credit(0.25)).toBe(0.25)
    expect(credit(1.5)).toBe(1)
    expect(credit(-1)).toBe(0)
    expect(credit(Number.NaN)).toBe(0)
  })

  test("skips a rule that doesn't apply, which counts neither for nor against the resume", () => {
    const report = runChecks(ada, { rules: [formRule("S6", () => null, { category: "sections" })] })
    expect(report.results[0]).toMatchObject({ status: "skipped", checked: 0, credit: 1, findings: [] })
  })

  test("has PDF rules wait for the preview to be read, then runs them", () => {
    const pages: Rule = {
      id: "L1",
      category: "length",
      level: "look",
      title: "One page",
      why: "Recruiters read one page.",
      reads: "pdf",
      check: ({ pdf }) => ({
        checked: 1,
        problems: pdf.pages.length > 1 ? [{ place: { kind: "page", page: 2 }, message: "Two pages", text: "2 pages" }] : [],
      }),
    }
    expect(runChecks(ada, { rules: [pages] }).results[0]).toMatchObject({ status: "waiting", credit: 1 })
    expect(runChecks(ada, { rules: [pages], pdf: reading(1) }).results[0].status).toBe("passed")
    const report = runChecks(ada, { rules: [pages], pdf: reading(2) })
    expect(report.findings).toEqual([expect.objectContaining({ rule: "L1", place: { kind: "page", page: 2 }, text: "2 pages" })])
  })

  test("leaves out a rule that breaks, and runs the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const broken = formRule("B2", () => {
      throw new Error("oops")
    })
    const report = runChecks(ada, { rules: [broken, weakStarts] })
    expect(report.results.map((result) => result.status)).toEqual(["error", "failed"])
    expect(report.results[0]).toMatchObject({ checked: 0, credit: 1, findings: [] })
    expect(report.findings).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test("leaves out what a rule found at a place that isn't on the resume", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const nowhere: Problem[] = [
      { place: { kind: "profile", field: "password" }, message: "No such field" },
      { place: { kind: "entry", section: "Work", entry: 1, field: "workRole" }, message: "No second entry" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "schoolName" }, message: "Not a Work field" },
      { place: bulletPlace(0, 2), message: "A blank line, not a bullet" },
      { place: { kind: "entry", section: "Work", entry: 0, field: "workRole", line: 0 }, message: "Not a bullet field" },
      { place: { kind: "page", page: 1 }, message: "No PDF has been read" },
    ]
    const report = runChecks(ada, { rules: [formRule("B4", () => ({ checked: 6, problems: nowhere }))] })
    expect(report.findings).toEqual([])
    expect(report.results[0].status).toBe("passed")
    expect(warn).toHaveBeenCalledTimes(nowhere.length)
  })

  test("puts fixes first, then categories in the rubric's order, then rules in their own order", () => {
    const flag = (id: string, category: CategoryId, level: Level) =>
      formRule(id, () => ({ checked: 1, problems: [{ place: { kind: "profile", field: "fullName" }, message: id }] }), {
        category,
        level,
      })
    const report = runChecks(ada, {
      rules: [flag("P1", "polish", "look"), flag("C5", "contact", "look"), flag("B9", "bullets", "fix"), flag("C3", "contact", "look")],
    })
    expect(report.findings.map((finding) => finding.rule)).toEqual(["B9", "C5", "C3", "P1"])
  })

  test("lists what the templates guarantee as passed", () => {
    expect(runChecks(ada, { rules: [] }).automatic).toEqual(AUTOMATIC_PASSES)
  })

  test.each(samples.map((sample) => [sample.selectedTemplate, sample]))(
    "can point at every field, bullet, entry, section and title on the %s sample",
    (_, sample) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      const everywhere = formRule("P4", ({ resume }) => {
        const places: Place[] = [
          ...textsOf(resume).map((text) => text.place),
          ...SECTION_NAMES.flatMap((section): Place[] => [
            { kind: "section", section },
            { kind: "heading", section },
            ...resume.sections[section].map((entry): Place => ({ kind: "entry", section, entry: entry.index })),
          ]),
          { kind: "page" },
        ]
        return { checked: places.length, problems: places.map((place) => ({ place, message: "Here" })) }
      })
      const report = runChecks(sample, { rules: [everywhere] })
      expect(warn).not.toHaveBeenCalled()
      expect(report.findings.length).toBeGreaterThan(SECTION_NAMES.length * 2)
    },
  )
})

describe("dismissing", () => {
  const [first] = runChecks(ada, { rules: [weakStarts] }).findings

  test("hides a suggestion, keeps it to bring back, and counts it as passing", () => {
    const report = runChecks(dismissed(ada, first), { rules: [weakStarts] })
    expect(report.findings.map((finding) => finding.text)).toEqual(["Helped with the notes"])
    expect(report.dismissed).toEqual([{ ...first, dismissed: true }])
    expect(report.results[0]).toMatchObject({ status: "failed", credit: 2 / 3 })
  })

  test("lasts until the text changes", () => {
    const edited = dismissed(ada, first)
    edited.workExperienceSection = [
      { ...ada.workExperienceSection[0], workDescription: ada.workExperienceSection[0].workDescription.replace("the engine", "the mill") },
    ]
    const report = runChecks(edited, { rules: [weakStarts] })
    expect(report.findings.map((finding) => finding.text)).toEqual(["Responsible for the mill", "Helped with the notes"])
    expect(report.dismissed).toEqual([])
  })

  test("stays when bullets are added above, moving it to another line", () => {
    const moved = dismissed(ada, first)
    moved.workExperienceSection = [
      { ...ada.workExperienceSection[0], workDescription: `• Designed the cards\n${ada.workExperienceSection[0].workDescription}` },
    ]
    const report = runChecks(moved, { rules: [weakStarts] })
    expect(report.dismissed).toEqual([expect.objectContaining({ text: "Responsible for the engine", place: bulletPlace(0, 1) })])
  })

  test("doesn't apply to fixes, even if one was saved as dismissed", () => {
    const [fix] = runChecks(ada, { rules: [realEmail] }).findings
    const state = readCheckState(ada)
    expect(dismiss(state, fix)).toBe(state)
    const report = runChecks(withCheck(ada, { dismissed: [fix.key] }), { rules: [realEmail] })
    expect(report.findings).toEqual([fix])
    expect(report.results[0].credit).toBe(0)
  })

  test("of everything a rule found counts as passing, even when the rule gives its own credit", () => {
    const fewNumbers = formRule("B3", () => ({ checked: 3, credit: 0.2, problems: [{ place: bulletPlace(0, 0), message: "Few numbers" }] }))
    const [finding] = runChecks(ada, { rules: [fewNumbers] }).findings
    expect(runChecks(dismissed(ada, finding), { rules: [fewNumbers] }).results[0]).toMatchObject({ status: "passed", credit: 1 })
  })
})

describe("the rules", () => {
  test("each have a unique ID, a known category and level, and say what they check and why", () => {
    const categories = new Set<string>(CATEGORIES.map((category) => category.id))
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(RULES.length)
    for (const rule of RULES) {
      expect(rule.id).toMatch(/^[A-Z]\d+$/)
      expect(categories.has(rule.category)).toBe(true)
      expect(Object.keys(LEVELS)).toContain(rule.level)
      expect(rule.title.trim()).not.toBe("")
      expect(rule.why.trim()).not.toBe("")
    }
  })

  test("add up to 100 points across the categories", () => {
    expect(CATEGORIES.reduce((sum, category) => sum + category.points, 0)).toBe(100)
  })
})
