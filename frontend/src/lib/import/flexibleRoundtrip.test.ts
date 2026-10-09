import { expect, test } from "vitest"
import { readBack, render, samples } from "./testRender"
import { toResumeContent, unplacedKey } from "./parse"
import type { Resume } from "@/lib/resume"
import type { ExtraSection } from "@/lib/resumeSections"

const first = "11111111-1111-4111-8111-111111111111"
const second = "22222222-2222-4222-8222-222222222222"
const normal = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase()

test("heuristic PDFs retain optional content and repeated unsupported groups across every template", async () => {
  for (const sample of samples) {
    const input: Resume = {
      selectedTemplate: sample.selectedTemplate,
      profileSection: { fullName: "Mara Lin", summary: "Engineer building useful tools for curious people." },
      extraSections: {
        [first]: { kind: "text", heading: "Presentations", text: "First talk on accessible software." },
        [second]: { kind: "list", heading: "Presentations", bullets: "• Second talk on reliable systems." },
      },
      sectionOrder: [`extra:${first}`, `extra:${second}`],
    }
    const { parsed } = await readBack(await render(input))
    const groups = parsed.extraGroups ?? []
    expect(
      groups.map((group) => group.kind),
      sample.selectedTemplate,
    ).toEqual(["summary"])
    const presentations = parsed.unplaced.filter((group) => /^presentations$/i.test(group.heading))
    expect(presentations, sample.selectedTemplate).toHaveLength(2)
    expect(presentations[0].id).not.toBe(presentations[1].id)
    const keepAs = Object.fromEntries(parsed.unplaced.map((group, index) => [unplacedKey(group, index), "text" as const]))
    const kept = toResumeContent(parsed, new Set(), { keepAs })
    const sections: ExtraSection[] = Object.values(kept.extraSections ?? {})
    const body = [
      kept.profileSection.summary,
      ...sections.map((section) => (section.kind === "list" ? section.bullets : section.text)),
    ].join(" ")
    for (const expected of [
      "Engineer building useful tools for curious people.",
      "First talk on accessible software.",
      "Second talk on reliable systems.",
    ]) {
      expect(normal(body), `${sample.selectedTemplate}: ${expected}`).toContain(normal(expected))
    }
    expect(normal(body).match(/first talk on accessible software/g)).toHaveLength(1)
    expect(normal(body).match(/second talk on reliable systems/g)).toHaveLength(1)
  }
})

// Long enough to wrap in every template.
const summary =
  "Engineer who builds useful tools for curious people, from the first sketch on paper to the release that ships, and who writes down what was learned on the way."
const talk =
  "First talk on accessible software, given to a room of engineers who build tools for people with low vision and for people who use screen readers every day."
const bullet =
  "Second talk on reliable systems, about how a small team keeps a busy service running through its releases, its outages and the long nights in between."

test("lines that only wrapped in the PDF are joined back up, as they were typed", async () => {
  for (const sample of samples) {
    const input: Resume = {
      selectedTemplate: sample.selectedTemplate,
      profileSection: { fullName: "Mara Lin", summary },
      extraSections: {
        [first]: { kind: "text", heading: "Presentations", text: talk },
        [second]: { kind: "list", heading: "Talks", bullets: `• ${bullet}\n• Third talk.` },
      },
      sectionOrder: [`extra:${first}`, `extra:${second}`],
    }
    const { parsed } = await readBack(await render(input))
    const keepAs = Object.fromEntries(
      parsed.unplaced.map((group, index) => [unplacedKey(group, index), group.heading === "Talks" ? ("list" as const) : ("text" as const)]),
    )
    const kept = toResumeContent(parsed, new Set(), { keepAs })
    expect(kept.profileSection.summary, sample.selectedTemplate).toBe(summary)
    expect(Object.values(kept.extraSections ?? {}), sample.selectedTemplate).toEqual([
      { kind: "text", heading: "Presentations", text: talk },
      { kind: "list", heading: "Talks", bullets: `• ${bullet}\n• Third talk.` },
    ])
  }
})
