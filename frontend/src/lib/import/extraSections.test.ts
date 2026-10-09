import { describe, expect, test, vi } from "vitest"
import { CORE_SECTIONS } from "@/components/editor/sections"
import { entryKey, extraGroupKey, parseResume, toResumeContent, unplacedKey } from "./parse"
import { readFile } from "./read"
import { wordFile } from "./testFiles"
import type { Line } from "./lines"

const line = (text: string, heading = false, bullet = false): Line => ({
  text,
  heading,
  bullet,
  parts: [{ text, x: 72, runs: [{ start: 0, end: text.length, bold: heading, italic: false }] }],
  left: 72,
  x: 72,
  size: heading ? 13 : 11,
  bold: heading,
  italic: false,
  links: [],
})
const parse = (...rows: (string | [string, boolean, boolean?])[]) =>
  parseResume(rows.map((row) => (typeof row === "string" ? line(row) : line(...row))))

describe("flexible section import review", () => {
  test("parsing gives stable heading occurrence addresses without generating editor UUIDs", () => {
    const uuid = vi.spyOn(crypto, "randomUUID")
    try {
      const rows: Line[] = [
        line("Mara Lin"),
        line("Summary", true),
        line("Engineer building useful tools."),
        line("Summary", true),
        line("Mentor and teacher."),
      ]
      const first = parseResume(rows)
      expect(parseResume(rows).occurrences).toEqual(first.occurrences)
      expect(first.extraGroups?.map((group) => group.id)).toEqual(["heading:1", "heading:3"])
      expect(first.extraGroups?.map((group) => group.sourceLines)).toEqual([
        [1, 2],
        [3, 4],
      ])
      expect(uuid).not.toHaveBeenCalled()
    } finally {
      uuid.mockRestore()
    }
  })

  test("a resume from a file has the core sections, and the optional ones with an entry ticked", () => {
    const parsed = parse("Mara Lin", ["Awards", true], "Dean's List, State University 2024")
    expect(toResumeContent(parsed).sectionOrder).toEqual(["Awards", ...CORE_SECTIONS])
    expect(toResumeContent(parsed, new Set([entryKey("Awards", 0)])).sectionOrder).toEqual(CORE_SECTIONS)
  })

  test("the summaries ticked go together in the profile's summary, in the file's order", () => {
    const parsed = parse(
      "Mara Lin",
      ["Summary", true],
      "First paragraph.",
      ["Work", true],
      "Engineer | Acme Inc",
      ["Professional Summary", true],
      "Second paragraph.",
    )
    const all = toResumeContent(parsed)
    expect(all.profileSection.summary).toBe("First paragraph.\n\nSecond paragraph.")
    expect(all.extraSections).toBeUndefined()
    const second = toResumeContent(parsed, new Set([extraGroupKey(parsed.extraGroups![0].id)]))
    expect(second.profileSection.summary).toBe("Second paragraph.")
    const none = toResumeContent(parsed, new Set(parsed.extraGroups!.map((group) => extraGroupKey(group.id))))
    expect(none.profileSection.summary).toBe("")
  })

  test("page-number removal retains original heading and body provenance", () => {
    const rows = [
      line("Mara Lin"),
      line("Summary", true),
      line("First paragraph."),
      line("1"),
      line("Summary", true),
      line("Second paragraph."),
      line("2"),
    ].map((row, index) => ({ ...row, page: index < 4 ? 1 : 2 }))
    const parsed = parseResume(rows)
    expect(parsed.lines.map((row) => row.text)).not.toContain("1")
    expect(parsed.lines.map((row) => row.text)).not.toContain("2")
    expect(parsed.extraGroups?.map((group) => group.sourceLines)).toEqual([
      [1, 2],
      [4, 5],
    ])
    expect(toResumeContent(parsed).profileSection.summary).toBe("First paragraph.\n\nSecond paragraph.")
  })

  test("summary prose keeps a literal circle and bullet summaries remain reviewable", () => {
    const prose = parse("Mara Lin", ["Summary", true], "○ This is literal prose.")
    expect(toResumeContent(prose).profileSection.summary).toBe("○ This is literal prose.")
    const bullets = parse("Mara Lin", ["Summary", true], ["Strong collaborator", false, true])
    expect(bullets.extraGroups).toEqual([])
    expect(bullets.unplaced[0].text).toEqual(["Strong collaborator"])
  })

  // Certifications are awards, as they are on the editor's Awards & Certifications.
  test.each([
    "Certifications",
    "Licenses and Certifications",
    "Awards & Certifications",
    "Honors & Certifications",
    "Certifications & Awards",
  ])("%s are read into Awards", (heading) => {
    const parsed = parse("Mara Lin", [heading, true], "Community Award, Example Org 2024")
    expect(parsed.sections.map((section) => section.name)).toEqual(["Awards"])
    expect(parsed.sections[0].entries[0].fields.awardName).toBe("Community Award")
    expect(parsed.unplaced).toEqual([])
    expect(parsed.extraGroups).toEqual([])
  })

  test.each([
    ["Education & Certifications", "Education"],
    ["Skills & Certifications", "Skills"],
  ])("%s are read into %s", (heading, section) => {
    const parsed = parse("Mara Lin", [heading, true], "University of Michigan, B.S. in Economics, 2024")
    expect(parsed.sections.map((found) => found.name)).toEqual([section])
    expect(parsed.unplaced).toEqual([])
  })

  test("a file that styles each job's title as a heading isn't split into sections at them", () => {
    const parsed = parse(
      "Mara Lin",
      ["Experience", true],
      ["Software Engineer", true],
      "Built the payments service for Acme Inc.",
      ["Data Analyst", true],
      "Wrote the monthly reports for Example Co.",
      ["Research Assistant", true],
      "Ran the lab's experiments at State University.",
      ["Education", true],
      "State University, B.S. in Economics, 2020",
    )
    expect(parsed.occurrences?.map((occurrence) => occurrence.heading)).toEqual(["Experience", "Education"])
  })

  test("text it couldn't place is tidied: no soft hyphens, doubled spaces or stray separators", () => {
    const parsed = parse("Mara Lin", ["Presentations", true], "• Talk on accessible soft\u00ADware  at Example Con |")
    expect(parsed.unplaced.map((group) => group.text)).toEqual([["Talk on accessible software at Example Con"]])
    const top = parse("Mara Lin", "Open-source  maintain\u00ADer |", ["Presentations", true], "First talk")
    expect(top.unplaced[0]).toMatchObject({ heading: "Top of the resume", text: ["Open-source maintainer"] })
  })

  test("repeated unsupported headings remain independently selectable with durable UUIDs only at confirmation", () => {
    const parsed = parse("Mara Lin", ["Presentations", true], "First talk", ["Presentations", true], "Second talk")
    expect(parsed.unplaced.map((group) => group.heading)).toEqual(["Presentations", "Presentations"])
    expect(parsed.unplaced[0].id).not.toBe(parsed.unplaced[1].id)
    expect(toResumeContent(parsed).extraSections).toBeUndefined()
    const keepAs = Object.fromEntries(
      parsed.unplaced.map((group, index) => [unplacedKey(group, index), index === 0 ? "text" : "list"]),
    ) as Record<string, "text" | "list">
    const content = toResumeContent(parsed, new Set(), { keepAs })
    expect(Object.keys(content.extraSections ?? {})).toHaveLength(2)
    expect(Object.values(content.extraSections ?? {})).toEqual([
      { kind: "text", heading: "Presentations", text: "First talk" },
      { kind: "list", heading: "Presentations", bullets: "• Second talk" },
    ])
    expect(content.sectionOrder.slice(0, 2)).toEqual(Object.keys(content.extraSections ?? {}).map((key) => `extra:${key}`))
  })

  test("Word parsing preserves recognized groups and uncertain leftover words for review", async () => {
    const paragraphs = ["Mara Lin", "SUMMARY", "Engineer building useful tools.", "PRESENTATIONS", "Talk on accessible software"]
    const result = await readFile({ kind: "docx", data: new Uint8Array(wordFile(paragraphs)).buffer })
    expect("parsed" in result).toBe(true)
    if (!("parsed" in result)) return
    expect(result.parsed.extraGroups?.map((group) => group.kind)).toEqual(["summary"])
    expect(result.parsed.unplaced.flatMap((group) => group.text)).toContain("Talk on accessible software")
  })
})
