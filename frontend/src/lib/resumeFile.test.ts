import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { PROFILE_FIELDS, SECTION_NAMES, SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Resume, ResumeContent } from "./resume"
import { AttachmentError, cleanResume, fromAttachment, MAX_ENTRIES, MAX_LENGTH, toAttachment, TooLongError } from "./resumeFile"

const SAMPLES = path.resolve("src/lib/typst/preview-samples")
const samples = readdirSync(SAMPLES).map((file) => JSON.parse(readFileSync(path.join(SAMPLES, file), "utf8")))

/** `count` entries for a section, in the editor's shape, each field `length` characters long. */
const entries = (name: SectionName, count: number, length = 10) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    ...Object.fromEntries(SECTIONS[name].fields.map((field) => [field.key, "x".repeat(length)])),
  }))

/**
 * A resume in the editor's shape, so what's restored can be compared with it
 * as it is: `count` entries in every section, and every heading, profile
 * field and entry field `length` characters long.
 */
const editorResume = ({ count = 1, length = 10 }): ResumeContent => ({
  id: "a",
  updatedAt: "2026-10-06T12:00:00.000Z",
  selectedTemplate: "jake",
  sectionOrder: [...SECTION_NAMES],
  sectionsChosen: true,
  headings: Object.fromEntries(SECTION_NAMES.map((name) => [SECTIONS[name].headingKey, "x".repeat(length)])),
  profileSection: Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, "x".repeat(length)])),
  ...Object.fromEntries(SECTION_NAMES.map((name) => [SECTIONS[name].dataKey, entries(name, count, length)])),
})

describe("the attachment in a downloaded PDF", () => {
  test.each(samples.map((sample) => [sample.selectedTemplate, sample]))("restores the %s sample exactly", (_, sample) => {
    expect(fromAttachment(toAttachment(sample))).toEqual(cleanResume(sample))
  })

  test("leaves out what the person left out, so whoever gets the PDF can't read it", () => {
    const tailored: Resume = {
      ...editorResume({}),
      workExperienceSection: [
        { id: 1, workRole: "Engineer", workDescription: "• Built a loom\n○ Fed the cat" },
        { id: 2, workRole: "Secret agent", leftOut: true },
      ],
    }
    const attachment = toAttachment(tailored)
    expect(attachment).not.toContain("Fed the cat")
    expect(attachment).not.toContain("Secret agent")
    expect(attachment).not.toContain("leftOut")
    // Opening the PDF again brings back what was printed.
    expect(fromAttachment(attachment)!.workExperienceSection).toEqual([
      expect.objectContaining({ id: 1, workRole: "Engineer", workDescription: "• Built a loom" }),
    ])
  })

  test("leaves out the resume's name and tag", () => {
    const { resume } = JSON.parse(toAttachment(samples[0]))
    expect(resume).not.toHaveProperty("resumeTitle")
    expect(resume).not.toHaveProperty("resumeTag")
  })

  // Earlier versions cut sections to 100 entries, headings to 200
  // characters, profile fields to 500 and everything else to 10,000.
  test.each([99, 100, 101])("restores all %i entries in each section", (count) => {
    const resume = editorResume({ count })
    expect(fromAttachment(toAttachment(resume))).toEqual(resume)
  })

  test.each([199, 200, 201, 499, 500, 501, 9_999, 10_000, 10_001])("restores all %i characters of every field", (length) => {
    const resume = editorResume({ length })
    expect(fromAttachment(toAttachment(resume))).toEqual(resume)
  })

  test("restores as many entries as it can open, and won't open more rather than cut them off", () => {
    const resume: ResumeContent = { ...editorResume({ count: 0 }), publicationsSection: entries("Publications", MAX_ENTRIES) }
    expect(fromAttachment(toAttachment(resume))).toEqual(resume)
    resume.workExperienceSection = entries("Work", 1)
    expect(() => fromAttachment(toAttachment(resume))).toThrow(TooLongError)
  })

  test("restores as many characters as it can open, and won't open more rather than cut them off", () => {
    const resume = editorResume({})
    const [work] = resume.workExperienceSection!
    work.workDescription = ""
    work.workDescription = "x".repeat(MAX_LENGTH - toAttachment(resume).length)
    expect(toAttachment(resume)).toHaveLength(MAX_LENGTH)
    expect(fromAttachment(toAttachment(resume))).toEqual(resume)
    work.workDescription += "x"
    expect(() => fromAttachment(toAttachment(resume))).toThrow(TooLongError)
  })

  test("ignores other JSON and explains recognized unsupported versions", () => {
    expect(fromAttachment("not json")).toBeNull()
    expect(fromAttachment(JSON.stringify({ format: "something-else", version: 1, resume: {} }))).toBeNull()
    expect(() => fromAttachment(JSON.stringify({ format: "resumezip", version: 3, resume: {} }))).toThrow(AttachmentError)
    // Not even one too long to open, so the PDF is read like any other.
    expect(fromAttachment(JSON.stringify({ format: "something-else", notes: "x".repeat(MAX_LENGTH) }))).toBeNull()
    expect(fromAttachment("x".repeat(MAX_LENGTH + 1))).toBeNull()
  })
})

describe("cleanResume", () => {
  test("keeps only known fields, as strings, and numbers entries", () => {
    const clean = cleanResume({
      selectedTemplate: "no-such-template",
      profileSection: { fullName: "Ada", password: "hunter2", email: 42 },
      workExperienceSection: [{ id: 99, companyName: "Acme", extra: "x" }, "junk"],
      sectionOrder: ["Work", "Work", "Hacking"],
    })
    expect(clean.selectedTemplate).toBe("jake")
    expect(clean.profileSection).not.toHaveProperty("password")
    expect(clean.profileSection?.email).toBe("")
    expect(clean.workExperienceSection?.[0]).toMatchObject({ id: 1, companyName: "Acme" })
    expect(clean.workExperienceSection?.[0]).not.toHaveProperty("extra")
    expect(clean.workExperienceSection?.[1].id).toBe(2)
    expect(clean.sectionOrder?.[0]).toBe("Work")
    expect(clean.sectionOrder).not.toContain("Hacking")
    expect(new Set(clean.sectionOrder).size).toBe(clean.sectionOrder?.length)
  })

  test("keeps the saved order, with the core sections, and an optional one only with entries", () => {
    expect(cleanResume({ sectionOrder: ["Projects", "Work"] }).sectionOrder).toEqual(["Projects", "Work", "Education", "Skills"])
    const filled = cleanResume({ sectionOrder: ["Work"], awardsSection: [{ awardName: "Prize" }] })
    expect(filled.sectionOrder).toEqual(["Work", "Education", "Skills", "Projects", "Awards"])
    // A section the person added stays, even empty.
    expect(cleanResume({ sectionOrder: ["Awards"], sectionsChosen: true }).sectionOrder).toEqual([
      "Awards",
      "Education",
      "Work",
      "Skills",
      "Projects",
    ])
  })

  test("a PDF from before sections were added from the list keeps only those with entries, and is then marked", () => {
    // Its order listed every section, whether the person used it or not.
    const old = cleanResume({ sectionOrder: [...SECTION_NAMES].reverse(), awardsSection: [{ awardName: "Prize" }] })
    expect(old.sectionOrder).toEqual(["Awards", "Projects", "Skills", "Work", "Education"])
    expect(old.sectionsChosen).toBe(true)
  })

  test("turns bullets an earlier version kept as a list into lines, all of them", () => {
    const lines = Array.from({ length: 2000 }, (_, index) => `Shipped release ${index + 1}`)
    const clean = cleanResume({ workExperienceSection: [{ workDescription: lines }] })
    expect(clean.workExperienceSection?.[0].workDescription).toBe(lines.map((line) => `• ${line}`).join("\n"))
  })
})
