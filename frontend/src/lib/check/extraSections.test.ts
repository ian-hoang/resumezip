import { describe, expect, test } from "vitest"
import type { Resume } from "@/lib/resume"
import type { ExtraSection } from "@/lib/resumeSections"
import { asSaved } from "@/lib/testResume"
import { readForChecks } from "@/lib/import/read"
import { viewOf, textsOf } from "./resume"
import { hasEnoughToCheck, describePlace } from "./labels"
import { findingKey, placeExists, textAt, type Place } from "./places"
import { grammarTexts } from "./spelling"
import { matchExtraPdf, pdfLayoutOf } from "./extraPdf"
import { line, reading } from "./testPdf"
import { runChecks } from "./engine"
import { RULES } from "./rules"
import { printedLayoutBullets } from "./pdf"

const first = "11111111-1111-4111-8111-111111111111"
const second = "22222222-2222-4222-8222-222222222222"
const third = "33333333-3333-4333-8333-333333333333"
const about = { kind: "text", heading: "About", text: "Literal **prose**.\n\nAnother paragraph." } as const satisfies ExtraSection
const interests = {
  kind: "list",
  heading: "Interests",
  bullets: "○ Secret\n\n• **Reading** fiction\n• Hiking",
} as const satisfies ExtraSection
const hidden = { kind: "text", heading: "Private", text: "Hidden", leftOut: true } as const satisfies ExtraSection
const resume: Resume = {
  profileSection: { fullName: "Ada Lovelace" },
  extraSections: { [third]: about, [first]: interests, [second]: hidden },
  sectionOrder: [`extra:${first}`, `extra:${third}`],
}

describe("extra checker views and stable editor addresses", () => {
  test("keeps builtin semantic order separate, privacy intact and original list offsets", () => {
    const view = viewOf(resume)
    expect(view.order.every((name) => !name.startsWith("extra:"))).toBe(true)
    expect(hasEnoughToCheck(view)).toBe(true)
    expect(view.extras[first].bullets.map(({ line, number, text }) => ({ line, number, text }))).toEqual([
      { line: 2, number: 2, text: "Reading fiction" },
      { line: 3, number: 3, text: "Hiking" },
    ])
    expect(
      textsOf(view)
        .map(({ text }) => text)
        .join(" "),
    ).not.toMatch(/Secret|Hidden|Private/)
    expect(JSON.stringify(runChecks(resume).view)).not.toMatch(/Secret|Hidden|Private/)
    expect(textsOf(view).find(({ place }) => place.kind === "extra-text" && place.sectionId === third)?.text).toContain("**prose**")
    expect(hasEnoughToCheck(viewOf({ profileSection: resume.profileSection, extraSections: { [second]: hidden } }))).toBe(false)
  })

  test("targets a custom bullet by identity and rejects removed or omitted targets", () => {
    const view = viewOf(resume)
    const place: Place = { kind: "extra-text", sectionId: first, field: "bullets", line: 2 }
    expect(placeExists(view, place)).toBe(true)
    expect(textAt(view, place)).toBe("**Reading** fiction")
    expect(describePlace(view, place)).toBe("Interests · bullet 2")
    expect(placeExists(view, { ...place, line: 0 })).toBe(false)
    expect(placeExists(view, { ...place, sectionId: second })).toBe(false)
    const moved = viewOf({ ...resume, sectionOrder: [`extra:${third}`, `extra:${first}`] })
    expect(findingKey("G1", place, textAt(view, place))).toBe(findingKey("G1", place, textAt(moved, place)))
  })

  test("checks prose and lists for grammar", () => {
    const texts = grammarTexts(viewOf(resume))
    expect(texts.some(({ place }) => place.kind === "extra-text" && place.sectionId === third)).toBe(true)
    expect(texts.some(({ place }) => place.kind === "extra-text" && place.field === "bullets")).toBe(true)
    const report = runChecks(resume, { rules: RULES.filter(({ id }) => /^(B|P)[0-9]/.test(id)) })
    expect(report.findings.filter(({ place }) => "sectionId" in place)).toEqual([])
  })
})

describe("actual extra PDF occurrences", () => {
  test("matches identical repeated headings and bodies one-to-one", () => {
    const source: Resume = {
      extraSections: {
        [first]: { kind: "text", heading: "Interests", text: "Reading fiction" },
        [second]: { kind: "text", heading: "Interests", text: "Reading fiction" },
      },
    }
    const result = matchExtraPdf(
      [line("Interests"), line("Reading fiction"), line("Interests"), line("Reading fiction")],
      pdfLayoutOf(viewOf(source)),
    )
    expect(result.sections.map(({ sectionId, status, lines }) => ({ sectionId, status, lines }))).toEqual([
      { sectionId: first, status: "matched", lines: [0, 1] },
      { sectionId: second, status: "matched", lines: [2, 3] },
    ])
  })

  test("missing or changed text is a problem, and ambiguous text only makes R3 partial", () => {
    const source: Resume = { extraSections: { [first]: { kind: "text", heading: "Interests", text: "Reading fiction" } } }
    for (const lines of [
      [line("Interests"), line("Unexpected text")],
      [line("Interests"), line("Reading fiction"), line("Interests"), line("Reading fiction")],
      [],
    ]) {
      const result = readForChecks(lines, pdfLayoutOf(viewOf(source)))
      expect(result.extras.excludedLines).toEqual([])
      const report = runChecks(source, { rules: RULES.filter(({ id }) => id === "R3"), pdf: { ...reading(lines), ...result } })
      const ambiguous = result.extras.sections[0].status === "ambiguous"
      expect(!!report.results[0].partial).toBe(ambiguous)
      expect(report.findings.map(({ place }) => place)).toEqual(ambiguous ? [] : [{ kind: "extra-heading", sectionId: first }])
    }
  })

  test("does not attribute extraction order inversions to precise custom IDs", () => {
    const source: Resume = {
      extraSections: {
        [first]: { kind: "text", heading: "First", text: "One" },
        [second]: { kind: "text", heading: "Second", text: "Two" },
      },
    }
    const result = matchExtraPdf([line("Second"), line("Two"), line("First"), line("One")], pdfLayoutOf(viewOf(source)))
    expect(result.sections.map(({ status }) => status)).toEqual(["ambiguous", "ambiguous"])
    expect(result.excludedLines).toEqual([])
  })

  test("literal prose containing a standalone builtin heading keeps its own occurrence", () => {
    const source = asSaved({
      extraSections: { [first]: { kind: "text", heading: "Interests", text: "Reading fiction\nAwards\nMore prose" } },
      awardsSection: [{ awardName: "Prize" }],
      sectionOrder: [`extra:${first}`, "Awards"],
      headings: { awards: "Awards" },
    })
    const result = matchExtraPdf(
      [line("Interests"), line("Reading fiction"), line("Awards"), line("More prose"), line("Awards"), line("Prize")],
      pdfLayoutOf(viewOf(source)),
    )
    expect(result.sections[0].status).toBe("matched")
    expect(result.excludedLines).toEqual([0, 1, 2, 3])
  })

  test("a matching prose suffix cannot swallow the only required builtin heading occurrence", () => {
    const source = asSaved({
      extraSections: { [first]: { kind: "text", heading: "Interests", text: "Reading fiction\nAwards\nPrize" } },
      awardsSection: [{ awardName: "Prize" }],
      sectionOrder: [`extra:${first}`, "Awards"],
      headings: { awards: "Awards" },
    })
    const result = matchExtraPdf([line("Interests"), line("Reading fiction"), line("Awards"), line("Prize")], pdfLayoutOf(viewOf(source)))
    expect(result.sections[0].status).toBe("ambiguous")
    expect(result.excludedLines).toEqual([])
  })

  test("shared builtin defaults bound the preceding custom section", () => {
    for (const selectedTemplate of ["jake", "referme", "ian"]) {
      const source = asSaved({
        selectedTemplate,
        extraSections: { [first]: { kind: "text", heading: "Interests", text: "Reading fiction" } },
        leadershipExperienceSection: [{ leadershipRole: "President", leadershipOrg: "Student Council" }],
        sectionOrder: [`extra:${first}`, "Leadership"],
      })
      const result = matchExtraPdf(
        [line("Interests"), line("Reading fiction"), line("Leadership"), line("Student Council"), line("President")],
        pdfLayoutOf(viewOf(source)),
      )
      expect(result.sections[0].status).toBe("matched")
    }
  })

  test("unresolved custom builtin-name collisions cannot invent builtin field failures", () => {
    const source = asSaved({
      extraSections: { [first]: { kind: "text", heading: "Experience", text: "Personal interests" } },
      workExperienceSection: [{ workRole: "Engineer", companyName: "Example" }],
      sectionOrder: [`extra:${first}`, "Work"],
    })
    const lines = [
      line("Experience", { size: 14 }),
      line("Wrong extracted text"),
      line("Experience", { size: 14 }),
      line("Engineer, Example"),
    ]
    const result = readForChecks(lines, pdfLayoutOf(viewOf(source)))
    const report = runChecks(source, {
      rules: RULES.filter(({ id }) => ["R2", "R3", "R4"].includes(id)),
      pdf: { ...reading(lines), ...result },
    })
    expect(report.findings.every(({ place }) => place.kind !== "entry" && place.kind !== "heading" && place.kind !== "section")).toBe(true)
    expect(report.results.filter(({ rule }) => ["R2", "R3", "R4"].includes(rule.id)).every(({ partial }) => partial)).toBe(true)
  })

  test("an unresolved custom heading alias cannot invent builtin entry counts either", () => {
    const source = asSaved({
      profileSection: { fullName: "Ada Lovelace" },
      extraSections: { [first]: { kind: "text", heading: "Work Experience", text: "Reading fiction" } },
      workExperienceSection: [{ workRole: "Engineer", companyName: "Acme" }],
      sectionOrder: [`extra:${first}`, "Work"],
    })
    const lines = [
      line("Ada Lovelace", { size: 20 }),
      line("Work Experience", { size: 14 }),
      line("Reader, Library"),
      line("Experience", { size: 14 }),
      line("Engineer, Acme"),
    ]
    const result = readForChecks(lines, pdfLayoutOf(viewOf(source)))
    const report = runChecks(source, { rules: RULES.filter(({ id }) => ["R2", "R3"].includes(id)), pdf: { ...reading(lines), ...result } })
    expect(report.findings.map(({ place }) => place)).toEqual([{ kind: "extra-heading", sectionId: first }])
    expect(report.results.every(({ partial }) => partial)).toBe(true)
  })

  test("a custom Experience heading cannot create a builtin job; remaining original line indexes survive", () => {
    const source = asSaved({
      profileSection: { fullName: "Ada Lovelace" },
      extraSections: { [first]: { kind: "text", heading: "Experience", text: "My personal interests" } },
      sectionOrder: [`extra:${first}`, "Work"],
      workExperienceSection: [{ companyName: "Example", workRole: "Engineer" }],
    })
    const lines = [
      line("Ada Lovelace", { size: 20 }),
      line("Experience", { size: 14 }),
      line("My personal interests"),
      line("Experience", { size: 14 }),
      line("Engineer, Example"),
      line("2024 - Present"),
    ]
    const result = readForChecks(lines, pdfLayoutOf(viewOf(source)))
    expect(result.extras.sections[0].status).toBe("matched")
    expect(result.parsed.lines).toHaveLength(lines.length)
    expect(result.parsed.sections.find(({ name }) => name === "Work")?.entries).toHaveLength(1)
    expect(result.parsed.sections.flatMap(({ entries }) => entries.flatMap(({ lines }) => lines))).not.toContain(2)
    expect(result.parsed.sections.flatMap(({ entries }) => entries.flatMap(({ lines }) => lines))).toContain(4)
    const report = runChecks(source, { rules: RULES.filter(({ id }) => id === "R4"), pdf: { ...reading(lines), ...result } })
    expect(report.findings.some(({ text }) => text.includes("personal interests"))).toBe(false)
  })

  test("a wrapped custom list retains original editor offset in physical layout checks", () => {
    const source: Resume = {
      extraSections: { [first]: { kind: "list", heading: "Interests", bullets: "○ Secret\n• Reading classic fiction" } },
    }
    const lines = [line("Interests"), line("Reading classic"), line("fiction")]
    const result = readForChecks(lines, pdfLayoutOf(viewOf(source)))
    const bullets = printedLayoutBullets(viewOf(source), { ...reading(lines), ...result })
    expect(bullets[0].place).toEqual({ kind: "extra-text", sectionId: first, field: "bullets", line: 1 })
    expect(bullets[0].printed.lines.map(({ text }) => text)).toEqual(["Reading classic", "fiction"])
  })
})
