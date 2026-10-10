import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { PROFILE_FIELDS, SECTION_NAMES, SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Resume, ResumeContent } from "./resume"
import {
  AttachmentError,
  cleanResume,
  fromAttachment,
  fromJson,
  MAX_ENTRIES,
  MAX_LENGTH,
  MAX_RESUMES,
  toAttachment,
  toJson,
  toJsonOfAll,
  TooLongError,
} from "./resumeFile"
import { asSaved } from "./testResume"

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

describe("a JSON file", () => {
  const hobbies = "00000000-0000-4000-8000-000000000001"
  /** A resume in the editor's shape with something left out of every kind, and checker state. */
  const tailored = (): ResumeContent => ({
    ...editorResume({}),
    workExperienceSection: [
      { ...entries("Work", 1)[0], workDescription: "• Built a loom\n○ Fed the cat" },
      { ...entries("Work", 2)[1], workRole: "Secret agent", leftOut: true },
    ],
    extraSections: { [hobbies]: { kind: "text", heading: "Hobbies", text: "Chess", leftOut: true } },
    sectionOrder: [...SECTION_NAMES, `extra:${hobbies}`],
    check: { dismissed: ["rule|profile.email|abc"], words: ["Lovelace"], grammarLanguage: "english" },
  })

  test("restores a resume exactly, with its name and tag and everything left out of the PDF", () => {
    const resume = tailored()
    const text = toJson({ ...resume, resumeTitle: "Ada at Google", resumeTag: "professional" })
    expect(text).toContain("Secret agent")
    expect(fromJson(text)).toEqual([{ resume, title: "Ada at Google", tag: "professional" }])
  })

  test("is laid out to be read, a field to a line", () => {
    const text = toJson({ ...editorResume({}), resumeTitle: "Ada" })
    expect(text.split("\n").slice(0, 6)).toEqual([
      "{",
      '  "format": "resumezip",',
      '  "version": 2,',
      '  "resume": {',
      '    "id": "a",',
      '    "resumeTitle": "Ada",',
    ])
  })

  test("of every resume restores them all, in order", () => {
    const ada = { ...tailored(), resumeTitle: "Ada", resumeTag: "academic" }
    const grace = { ...editorResume({ count: 3 }), id: "g", resumeTitle: "Grace" }
    const untitled = { ...editorResume({ count: 0 }), id: "u" }
    const { resumeTitle: _, resumeTag: __, ...adaContent } = ada
    const { resumeTitle: ___, ...graceContent } = grace
    expect(fromJson(toJsonOfAll([ada, grace, untitled]))).toEqual([
      { resume: adaContent, title: "Ada", tag: "academic" },
      { resume: { ...graceContent, extraSections: {} }, title: "Grace" },
      { resume: { ...untitled, extraSections: {} } },
    ])
  })

  test("from a PDF's attachment opens too, without a name", () => {
    const resume = editorResume({})
    expect(fromJson(toAttachment(resume))).toEqual([{ resume: fromAttachment(toAttachment(resume)) }])
  })

  test("keeps only names and tags the dashboard can show, and checker state it can read", () => {
    const file = (saved: Record<string, unknown>) =>
      JSON.stringify({ format: "resumezip", version: 2, resume: { extraSections: {}, ...saved } })
    expect(fromJson(file({ resumeTitle: "   ", resumeTag: "secret" }))?.[0]).not.toHaveProperty("title")
    expect(fromJson(file({ resumeTitle: 42, resumeTag: "secret" }))?.[0]).not.toHaveProperty("tag")
    expect(fromJson(file({ check: { dismissed: [7, "kept"], words: "Lovelace", token: "x" } }))?.[0].resume.check).toEqual({
      dismissed: ["kept"],
      words: [],
    })
    expect(fromJson(file({}))?.[0].resume).not.toHaveProperty("check")
  })

  test("that isn't from resumezip isn't read, and a damaged one says so", () => {
    expect(fromJson(JSON.stringify({ basics: { name: "Ada Lovelace" } }))).toBeNull()
    expect(fromJson("[]")).toBeNull()
    expect(fromJson("not json")).toBeNull()
    for (const damaged of [
      '{\n  "format": "resumezip",\n  "version": 2,',
      JSON.stringify({ format: "resumezip", version: 2, resumes: { a: {} } }),
      JSON.stringify({ format: "resumezip", version: 2, resumes: [{ extraSections: {} }, "junk"] }),
      JSON.stringify({ format: "resumezip", version: 2 }),
    ])
      expect(() => fromJson(damaged)).toThrow("The resume data in this file is damaged. Try another saved file.")
    expect(() => fromJson(JSON.stringify({ format: "resumezip", version: 3, resume: {} }))).toThrow("This file needs a newer resumezip.")
  })

  test("won't open more resumes, or entries in one, than it can, rather than cut them off", () => {
    const empty = asSaved({})
    expect(fromJson(toJsonOfAll(Array(MAX_RESUMES).fill(empty)))).toHaveLength(MAX_RESUMES)
    expect(() => fromJson(toJsonOfAll(Array(MAX_RESUMES + 1).fill(empty)))).toThrow(TooLongError)
    const long: ResumeContent = { ...editorResume({ count: 0 }), publicationsSection: entries("Publications", MAX_ENTRIES) }
    expect(fromJson(toJsonOfAll([long, long]))).toHaveLength(2)
    long.workExperienceSection = entries("Work", 1)
    expect(() => fromJson(toJsonOfAll([empty, long]))).toThrow(TooLongError)
  })

  test("too long laid out is written on one line, so it opens again", () => {
    // As long as can be opened, on one line.
    const resume = editorResume({})
    const [work] = resume.workExperienceSection!
    work.workDescription = ""
    work.workDescription = "x".repeat(MAX_LENGTH - JSON.stringify(JSON.parse(toJson(resume))).length)
    const text = toJson(resume)
    expect(text).toHaveLength(MAX_LENGTH)
    expect(text).not.toContain("\n")
    expect(fromJson(text)?.[0].resume).toEqual({ ...resume, extraSections: {} })
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
    // Once sections are chosen, one the person added stays, even empty, and one they deleted stays deleted.
    expect(cleanResume({ sectionOrder: ["Awards", "Work"], sectionsChosen: true }).sectionOrder).toEqual(["Awards", "Work"])
  })

  test("a PDF from before sections were added from the list keeps only those with entries, and is then marked", () => {
    // Its order listed every section, whether the person used it or not.
    const old = cleanResume({ sectionOrder: [...SECTION_NAMES].reverse(), awardsSection: [{ awardName: "Prize" }] })
    expect(old.sectionOrder).toEqual(["Awards", "Projects", "Skills", "Work", "Education"])
    expect(old.sectionsChosen).toBe(true)
  })

  test("keeps what's left out of the PDF, marked as the editor marks it", () => {
    const hobbies = "00000000-0000-4000-8000-000000000001"
    const clean = cleanResume({
      workExperienceSection: [
        { workRole: "Engineer", workDescription: "• Built a loom\n○ Fed the cat" },
        { workRole: "Secret agent", leftOut: true },
        { workRole: "Clerk", leftOut: "yes" },
      ],
      extraSections: { [hobbies]: { kind: "text", heading: "Hobbies", text: "Chess", leftOut: true } },
    })
    expect(clean.workExperienceSection).toEqual([
      expect.objectContaining({ id: 1, workDescription: "• Built a loom\n○ Fed the cat" }),
      expect.objectContaining({ id: 2, workRole: "Secret agent", leftOut: true }),
      expect.not.objectContaining({ leftOut: expect.anything() }),
    ])
    expect(clean.extraSections?.[hobbies]).toEqual({ kind: "text", heading: "Hobbies", text: "Chess", leftOut: true })
  })

  test("turns bullets an earlier version kept as a list into lines, all of them", () => {
    const lines = Array.from({ length: 2000 }, (_, index) => `Shipped release ${index + 1}`)
    const clean = cleanResume({ workExperienceSection: [{ workDescription: lines }] })
    expect(clean.workExperienceSection?.[0].workDescription).toBe(lines.map((line) => `• ${line}`).join("\n"))
  })
})
