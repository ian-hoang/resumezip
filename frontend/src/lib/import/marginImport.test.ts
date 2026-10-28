// Margin sets each section's heading in a column of its own, left of the
// text, and wraps or hyphenates one too long for it (templates/margin.typ).
// Opened without the resume it carries, the headings are found by where they
// sit, so one the importer doesn't know by name still starts its section.

import { describe, expect, test } from "vitest"
import { cleanResume } from "@/lib/resumeFile"
import { differences, printedData, readBack, render, samples } from "./testRender"

const sample = samples.find((resume) => resume.selectedTemplate === "margin")

// What a resume prints, as roundtrip.test.ts compares it, without the
// sections' order and headings, which aren't read back for a section under a
// heading the importer doesn't know.
const printed = (resume: Record<string, unknown>) => ({ ...printedData(resume), order: [], headings: {} })

async function read(resume: Record<string, unknown>) {
  const { parsed, resume: got } = await readBack(await render(resume))
  return { parsed, wrong: differences(printed(cleanResume(resume)), printed(got)) }
}

describe("a Margin PDF opened without its resume", () => {
  test("reads a single award beside the wrapped Awards & Certifications heading", async () => {
    // "Certifications" has nothing beside it, and starts further left than
    // any heading with text beside it.
    const { parsed, wrong } = await read({ ...sample, awardsSection: sample.awardsSection.slice(0, 1) })
    expect(parsed.unplaced).toEqual([])
    expect(parsed.sections.map((section) => section.name)).toEqual([
      "Work",
      "Education",
      "Projects",
      "Skills",
      "Leadership",
      "Volunteership",
      "Awards",
    ])
    expect(wrong).toEqual([])
  })

  test("starts a section at a heading it doesn't know by name, and keeps that section's text under it", async () => {
    const { parsed, wrong } = await read({ ...sample, headings: { projects: "Things I Built" } })
    expect(parsed.sections.map((section) => section.name)).toEqual(["Work", "Education", "Skills", "Leadership", "Volunteership", "Awards"])
    // The project is the custom section's text, for the review to keep as one.
    expect(parsed.unplaced.map((group) => group.heading)).toEqual(["Things I Built"])
    expect(parsed.unplaced[0].text.join(" ")).toContain("Tabsplit")
    expect(wrong.filter((field) => !field.startsWith("projects"))).toEqual([])
  })

  test("reads a heading it doesn't know that wraps, beside a single award", async () => {
    const { parsed, wrong } = await read({
      ...sample,
      awardsSection: sample.awardsSection.slice(0, 1),
      headings: { projects: "Open Source Contributions" },
    })
    expect(parsed.unplaced.map((group) => group.heading)).toEqual(["Open Source Contributions"])
    expect(wrong.filter((field) => !field.startsWith("projects"))).toEqual([])
  })

  test("reads headings hyphenated to fit the column as whole words", async () => {
    // Words wider than the column, as in src/lib/typst/margin.test.ts.
    const headings = {
      work: "Internationalization",
      leadership: "Extracurriculars",
      volunteer: "Responsibilities",
      projects: "Veröffentlichungen",
      skills: "Programmierkenntnisse",
    }
    const { parsed, wrong } = await read({ ...sample, headings })
    expect(parsed.occurrences.map((occurrence) => occurrence.heading)).toEqual([
      "Summary",
      "Internationalization",
      "Education",
      "Veröffentlichungen",
      "Programmierkenntnisse",
      "Extracurriculars",
      "Responsibilities",
      "Awards & Certifications",
    ])
    // Extracurriculars is a name for Leadership; the others are sections of the person's own.
    expect(parsed.sections.map((section) => section.name)).toEqual(["Education", "Leadership", "Awards"])
    expect(parsed.unplaced.map((group) => group.heading)).toEqual([
      "Internationalization",
      "Veröffentlichungen",
      "Programmierkenntnisse",
      "Responsibilities",
    ])
    expect(wrong.filter((field) => /^(?:education|leadership|awards|profile)\b/.test(field))).toEqual([])
  })

  test("reads a heading longer than its section, kept with it on the next page", async () => {
    const { parsed, wrong } = await read({
      ...sample,
      headings: { awards: "Honors, Awards, Grants, Prizes, Fellowships and Certifications" },
    })
    expect(parsed.unplaced).toEqual([])
    expect(parsed.occurrences.at(-1)?.heading).toBe("Honors, Awards, Grants, Prizes, Fellowships and Certifications")
    expect(wrong).toEqual([])
  })

  test("reads an undated project beside the Projects heading as a project, not a heading", async () => {
    // Without its date, the project's title is all that's beside the heading,
    // short enough to be one.
    const projectsSection = sample.projectsSection.map((project: Record<string, unknown>) => ({ ...project, projectDate: "" }))
    const { parsed, wrong } = await read({ ...sample, projectsSection })
    expect(parsed.unplaced).toEqual([])
    expect(parsed.sections.find((section) => section.name === "Projects")?.entries).toHaveLength(1)
    expect(wrong).toEqual([])
  })
})
