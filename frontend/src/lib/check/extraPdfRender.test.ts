import { expect, test } from "vitest"
import { readBack, render, samples } from "@/lib/import/testRender"
import { readForChecks } from "@/lib/import/read"
import { pdfLayoutOf } from "./extraPdf"
import { viewOf } from "./resume"
import { runChecks } from "./engine"
import { RULES } from "./rules"

const first = "11111111-1111-4111-8111-111111111111"
const second = "22222222-2222-4222-8222-222222222222"
const third = "33333333-3333-4333-8333-333333333333"

test.each(samples.map((sample) => [sample.selectedTemplate as string, sample]))(
  "%s verifies actual new-section text without assigning it to builtin semantic sections",
  async (_template, sample) => {
    const resume = {
      ...sample,
      // Upstream shares builtin defaults across templates. Exercise those actual
      // headings as occurrence anchors rather than the samples' custom headings.
      headings: {},
      profileSection: { ...sample.profileSection, summary: "Curious engineer who builds reliable software.\n\nEnjoys **literal** prose." },
      extraSections: {
        [first]: { kind: "text", heading: "Experience", text: "Personal interests outside professional work." },
        [second]: {
          kind: "list",
          heading: "Interests",
          bullets: "○ Private reading\n• **Reading** classic fiction\n• *Hiking* in the mountains",
        },
        [third]: { kind: "text", heading: "Interests", text: "Additional personal interests." },
      },
      sectionOrder: [`extra:${first}`, "Work", `extra:${second}`, `extra:${third}`],
    }
    const raw = await readBack(await render(resume))
    const result = readForChecks(raw.parsed.lines, pdfLayoutOf(viewOf(resume)))
    expect(result.extras.sections.map(({ sectionId, status }) => [sectionId, status])).toEqual([
      [first, "matched"],
      [second, "matched"],
      [third, "matched"],
    ])
    const report = runChecks(resume, {
      rules: RULES.filter(({ id }) => ["R2", "R3", "R4"].includes(id)),
      pdf: { ...result, lines: result.parsed.lines, pages: raw.pages },
    })
    expect(
      report.findings.filter(({ place, text }) => "sectionId" in place || /personal interests|classic fiction|literal/.test(text)),
    ).toEqual([])
    expect(result.parsed.sections.find(({ name }) => name === "Work")?.entries.length).toBe(sample.workExperienceSection.length)
  },
)
