import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { runChecks } from "@/lib/check/engine"
import type { Resume } from "@/lib/resume"
import { isReady } from "./readyCheck"

const SAMPLES = path.resolve("src/lib/typst/preview-samples")
const sample = (file: string): Resume => JSON.parse(readFileSync(path.join(SAMPLES, file), "utf8"))

describe("a resume's Ready stamp", () => {
  test.each(readdirSync(SAMPLES))("each template's sample is ready: %s", (file) => {
    expect(isReady(sample(file))).toBe(true)
  })

  test("a resume with only a name isn't, as there's nothing to check yet", () => {
    expect(isReady({ profileSection: { fullName: "Ada Lovelace" } })).toBe(false)
  })

  test("one with something the checker says must be fixed isn't", () => {
    const resume = sample("jake.json")
    expect(isReady({ ...resume, profileSection: { ...resume.profileSection, email: undefined } })).toBe(false)
  })

  test("suggestions don't hold it back, as they don't hold the score down", () => {
    const resume = sample("jake.json")
    const [job, ...jobs] = resume.workExperienceSection ?? []
    // A duty rather than what was done (B1) is a suggestion.
    const duty = { ...job, workDescription: `• Responsible for the team's weekly reports\n${job.workDescription ?? ""}` }
    const withDuty = { ...resume, workExperienceSection: [duty, ...jobs] }
    expect(runChecks(withDuty).findings).toContainEqual(expect.objectContaining({ rule: "B1", level: "look" }))
    expect(isReady(withDuty)).toBe(true)
  })
})
