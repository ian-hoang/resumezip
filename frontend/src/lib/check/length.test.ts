import { describe, expect, test } from "vitest"
import type { Resume } from "@/lib/resume"
import type { PdfReading } from "./engine"
import { runChecks } from "./engine"
import { RULES } from "./rules"
import { line, reading } from "./testPdf"

const resumeWith = (bullets: string[], resumeTag = "professional") => ({
  resumeTag,
  profileSection: { fullName: "Jake Ryan" },
  workExperienceSection: [
    { id: 1, workRole: "Engineer", companyName: "Google", workDescription: bullets.map((bullet) => `• ${bullet}`).join("\n") },
  ],
})

// Lines down a page from the top, one every 14 points.
const lines = (count: number, { page = 1, from = 40 } = {}) =>
  Array.from({ length: count }, (_, i) => line(`Line ${i + 1}`, { page, top: from + i * 14 }))

/** What one rule says about a resume and its PDF. */
function check(id: string, resume: Resume, pdf: PdfReading) {
  const rule = RULES.find((rule) => rule.id === id)!
  const report = runChecks(resume, { rules: [rule], pdf })
  return { status: report.results[0].status, messages: report.findings.map((finding) => finding.message), findings: report.findings }
}

// A full single page, with the bullet on it.
const full = (bullet: ReturnType<typeof line>[]) => reading([...lines(40), ...bullet, line("Last line", { top: 700 })])

describe("L1 pages", () => {
  test("flags more than one page, unless it's an academic CV", () => {
    const twoPages = reading([...lines(50), ...lines(20, { page: 2 })], {}, 2)
    expect(check("L1", resumeWith(["Built it"]), twoPages).findings).toEqual([
      expect.objectContaining({ place: { kind: "page", page: 2 }, message: "2 pages" }),
    ])
    expect(check("L1", resumeWith(["Built it"], "academic"), twoPages).status).toBe("skipped")
    expect(check("L1", resumeWith(["Built it"]), full([])).status).toBe("passed")
  })

  test("a dismissal lasts while the page count does", () => {
    const keyAt = (count: number) => {
      const pages = Array.from({ length: count }, (_, i) => lines(30, { page: i + 1 })).flat()
      return check("L1", resumeWith(["Built it"]), reading(pages, {}, count)).findings[0].key
    }
    expect(keyAt(2)).toBe(keyAt(2))
    expect(keyAt(3)).not.toBe(keyAt(2))
  })
})

describe("L2 a few lines on the last page", () => {
  test("flags 5 lines or fewer on the last page", () => {
    expect(check("L2", resumeWith(["Built it"]), reading([...lines(50), ...lines(3, { page: 2 })], {}, 2)).messages).toEqual([
      "Only 3 lines on page 2",
    ])
    expect(check("L2", resumeWith(["Built it"]), reading([...lines(50), ...lines(20, { page: 2 })], {}, 2)).status).toBe("passed")
    expect(check("L2", resumeWith(["Built it"]), full([])).status).toBe("skipped")
  })
})

describe("L3 and L4 how a bullet wraps", () => {
  const bullet = "Built a search index that cut query time by 40% for the whole team"

  test("L3 flags a bullet whose last line has 1 to 3 words", () => {
    const pdf = full([
      line("Built a search index that cut query time by 40% for the", { bullet: true, top: 600 }),
      line("whole team", { top: 612 }),
    ])
    expect(check("L3", resumeWith([bullet]), pdf).findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 0 },
        message: "2 words on its last line",
      }),
    ])
  })

  test("L3 leaves one-line bullets and last lines with more words", () => {
    expect(check("L3", resumeWith([bullet]), full([line(bullet, { bullet: true, top: 600 })])).status).toBe("passed")
    const pdf = full([
      line("Built a search index that cut query time by 40%", { bullet: true, top: 600 }),
      line("for the whole team", { top: 612 }),
    ])
    expect(check("L3", resumeWith([bullet]), pdf).status).toBe("passed")
  })

  test("L4 flags a bullet that runs 3 lines or more", () => {
    const pdf = full([
      line("Built a search index that", { bullet: true, top: 600 }),
      line("cut query time by 40% for", { top: 612 }),
      line("the whole team", { top: 624 }),
    ])
    expect(check("L4", resumeWith([bullet]), pdf).messages).toEqual(["Runs 3 lines"])
  })
})

describe("L5 a full page", () => {
  test("flags a one-page resume that ends above 75% of the page", () => {
    expect(check("L5", resumeWith(["Built it"]), reading(lines(20))).messages).toEqual(["The page is 40% full"])
    expect(check("L5", resumeWith(["Built it"]), full([])).status).toBe("passed")
    expect(check("L5", resumeWith(["Built it"]), reading([...lines(50), ...lines(20, { page: 2 })], {}, 2)).status).toBe("skipped")
  })
})
