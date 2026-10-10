// Makes a Word file of each template's sample resume, reads its text back the
// way "Open a file" does for Word files from elsewhere, as after Word saves it
// without the resume attached, and checks it has the same resume.

import { describe, expect, test } from "vitest"
import { cleanResume } from "@/lib/resumeFile"
import { toTemplateData } from "@/lib/typst/resumeData"
import { toWordFile } from "@/lib/word"
import { linesFromDocx } from "./lines"
import { parseResume, toResumeContent, unplacedKey } from "./parse"
import { differences, samples } from "./testRender"

const first = "11111111-1111-4111-8111-111111111111"
const second = "22222222-2222-4222-8222-222222222222"

/**
 * Fields each template's sample doesn't read back yet, as paths into the
 * printed data. Every template's Word file has the same layout, so these
 * come from what's in the samples. Fix one in parse.ts, then delete it
 * here; anything that starts differing and isn't listed fails the test.
 */
const KNOWN_GAPS: Record<string, string[]> = {
  ian: [],
  // A comma inside an award's name reads as the start of the organization.
  jake: ["awards[0].name", "awards[0].organization"],
  levelsfyi: [],
  modernjack: [],
  // A comma or dash inside an award's name reads as the start of the organization.
  referme: ["awards[0].name", "awards[0].organization", "awards[1].name", "awards[1].organization"],
  resumeworded: [],
}

// What a resume prints, minus differences that print the same or are
// deliberate: the parser writes GPAs without spaces ("3.9/4.0").
function printed(resume: Record<string, unknown>) {
  const data = toTemplateData(resume)
  for (const school of data.education) school.gpa = school.gpa.replace(/\s+/g, "")
  return data
}

async function readBack(resume: Record<string, unknown>) {
  const parsed = parseResume(await linesFromDocx(toWordFile(resume).buffer))
  return { parsed, resume: toResumeContent(parsed) }
}

describe.each(samples.map((sample) => [sample.selectedTemplate as string, sample]))("the %s sample's Word file", (template, sample) => {
  test("reads back as it was written", async () => {
    const { parsed, resume } = await readBack(sample)
    const want = printed(cleanResume(sample))
    const got = printed(resume)

    expect(parsed.unplaced).toEqual([])
    expect(got.order.filter((name) => parsed.sections.some((section) => section.name === name))).toEqual(
      want.order.filter((name) => parsed.sections.some((section) => section.name === name)),
    )
    expect(differences({ ...want, order: [] }, { ...got, order: [] }).sort()).toEqual([...(KNOWN_GAPS[template] ?? [])].sort())
  })
})

test("every template's sample is checked", () => {
  expect(samples.map((sample) => sample.selectedTemplate).sort()).toEqual(Object.keys(KNOWN_GAPS).sort())
})

test("bold and italic words in bullets come back marked", async () => {
  const bullet = "Led **Project Atlas** to a *record* quarter with ***zero*** outages, plus a plain ending"
  const [first, ...rest] = samples[0].workExperienceSection
  const { resume } = await readBack({ ...samples[0], workExperienceSection: [{ ...first, workDescription: `• ${bullet}` }, ...rest] })
  expect(resume.workExperienceSection?.[0].workDescription).toBe(`• ${bullet}`)
})

test("the summary comes back, and added sections can be kept as they were", async () => {
  const talk = "First talk on accessible software.\nGiven twice."
  const { parsed } = await readBack({
    selectedTemplate: "jake",
    profileSection: { fullName: "Mara Lin", summary: "Builds useful tools, and writes about them." },
    extraSections: {
      [first]: { kind: "text", heading: "Presentations", text: talk },
      [second]: { kind: "list", heading: "Talks", bullets: "• Second talk on reliable systems.\n• Third talk." },
    },
    sectionOrder: [`extra:${first}`, `extra:${second}`],
  })
  const keepAs = Object.fromEntries(
    parsed.unplaced.map((group, index) => [unplacedKey(group, index), group.heading === "Talks" ? ("list" as const) : ("text" as const)]),
  )
  const kept = toResumeContent(parsed, new Set(), { keepAs })
  expect(kept.profileSection.summary).toBe("Builds useful tools, and writes about them.")
  expect(Object.values(kept.extraSections ?? {})).toEqual([
    { kind: "text", heading: "Presentations", text: talk },
    { kind: "list", heading: "Talks", bullets: "• Second talk on reliable systems.\n• Third talk." },
  ])
})
