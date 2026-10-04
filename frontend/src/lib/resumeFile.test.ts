import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { cleanResume, fromAttachment, toAttachment } from "./resumeFile"

const SAMPLES = path.resolve("src/lib/typst/preview-samples")
const samples = readdirSync(SAMPLES).map((file) => JSON.parse(readFileSync(path.join(SAMPLES, file), "utf8")))

describe("the attachment in a downloaded PDF", () => {
  test.each(samples.map((sample) => [sample.selectedTemplate, sample]))("restores the %s sample exactly", (_, sample) => {
    expect(fromAttachment(toAttachment(sample))).toEqual(cleanResume(sample))
  })

  test("leaves out the resume's name and tag", () => {
    const { resume } = JSON.parse(toAttachment(samples[0]))
    expect(resume).not.toHaveProperty("resumeTitle")
    expect(resume).not.toHaveProperty("resumeTag")
  })

  test("isn't read from other JSON or from newer versions", () => {
    expect(fromAttachment("not json")).toBeNull()
    expect(fromAttachment(JSON.stringify({ format: "something-else", version: 1, resume: {} }))).toBeNull()
    expect(fromAttachment(JSON.stringify({ format: "resumezip", version: 2, resume: {} }))).toBeNull()
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
    expect(clean.profileSection.email).toBe("")
    expect(clean.workExperienceSection[0]).toMatchObject({ id: 1, companyName: "Acme" })
    expect(clean.workExperienceSection[0]).not.toHaveProperty("extra")
    expect(clean.workExperienceSection[1].id).toBe(2)
    expect(clean.sectionOrder[0]).toBe("Work")
    expect(clean.sectionOrder).not.toContain("Hacking")
    expect(new Set(clean.sectionOrder).size).toBe(clean.sectionOrder.length)
  })

  test("caps long text and long lists", () => {
    const clean = cleanResume({
      profileSection: { fullName: "x".repeat(5000) },
      skillsSection: Array.from({ length: 500 }, () => ({ skillName: "Go" })),
    })
    expect(clean.profileSection.fullName).toHaveLength(500)
    expect(clean.skillsSection).toHaveLength(100)
  })
})
