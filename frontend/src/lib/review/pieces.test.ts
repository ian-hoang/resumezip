import { describe, expect, test } from "vitest"
import { textsOf, viewOf } from "@/lib/check/resume"
import { piecesOf, quotedNow, requestOf } from "./pieces"
import { LIMITS } from "./review"

const resume = {
  resumeTag: "professional",
  profileSection: { fullName: "Wendy Bailey", email: "w.bailey@example.com", phoneNumber: "123-456-7890", location: "Philadelphia, PA", linkedin: "linkedin.com/in/wendy" },
  headings: { work: "Where I worked" },
  sectionOrder: ["Work", "Projects", "Publications"],
  workExperienceSection: [
    {
      workRole: "Software Engineer",
      companyName: "Amazon",
      workLocation: "Philadelphia, PA",
      workStartDate: "2023",
      workDescription: "• Released 2 features, **growing subscriptions by 18%**\n• Used Trello to organize project tasks",
    },
  ],
  projectsSection: [{ projectName: "Gitlytics", projectGithub: "github.com/wendy/gitlytics", techStack: "Next.js" }],
  publicationsSection: [{ publicationTitle: "Sparse Attention", publicationAuthors: "W. Bailey, A. Smith" }],
}

describe("what's sent to be reviewed", () => {
  test("is the printed text of the entries, as printed, in order", () => {
    const pieces = piecesOf(viewOf(resume))
    expect(pieces.map(({ id, text }) => [id, text])).toEqual([
      ["t1", "Software Engineer"],
      ["t2", "Amazon"],
      ["t3", "2023"],
      ["t4", "Released 2 features, growing subscriptions by 18%"],
      ["t5", "Used Trello to organize project tasks"],
      ["t6", "Gitlytics"],
      ["t7", "Next.js"],
      ["t8", "Sparse Attention"],
    ])
    expect(pieces[3]).toMatchObject({
      where: "Where I worked → Amazon · bullet 1",
      place: { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 0 },
    })
  })

  test("never has the profile, links, places or other people's names", () => {
    const sent = JSON.stringify(requestOf(viewOf(resume), piecesOf(viewOf(resume))))
    for (const kept of ["Wendy Bailey", "w.bailey@example.com", "123-456-7890", "Philadelphia", "linkedin.com", "github.com", "A. Smith"]) {
      expect(sent).not.toContain(kept)
    }
  })

  test("is the resume's type and its pieces without their places, up to the limit", () => {
    const view = viewOf({ ...resume, resumeTag: "academic" })
    const request = requestOf(view, piecesOf(view))
    expect(request.type).toBe("academic")
    expect(request.pieces[0]).toEqual({ id: "t1", where: "Where I worked → Amazon · Role", text: "Software Engineer" })

    const long = viewOf({ workExperienceSection: [{ workDescription: Array.from({ length: 50 }, () => `• ${"x".repeat(1500)}`).join("\n") }] })
    const total = requestOf(long, piecesOf(long)).pieces.reduce((sum, piece) => sum + piece.text.length, 0)
    expect(total).toBeLessThanOrEqual(LIMITS.totalLength)
    expect(total).toBeGreaterThan(LIMITS.totalLength - 1500)
  })
})

describe("where a note's words are now", () => {
  const view = viewOf(resume)
  const texts = textsOf(view)
  const bullet = { kind: "entry", section: "Work", entry: 0, field: "workDescription", line: 0 } as const

  test("at its place, while they're there", () => {
    expect(quotedNow(texts, bullet, "growing subscriptions")).toEqual({ place: bullet, text: "Released 2 features, growing subscriptions by 18%", order: texts.findIndex(({ text }) => text.startsWith("Released")) })
    expect(quotedNow(texts, { ...bullet, field: "workRole", line: undefined }, "Software")).toMatchObject({ text: "Software Engineer" })
  })

  test("in another bullet of the field, once bullets have moved", () => {
    const moved = textsOf(viewOf({ ...resume, workExperienceSection: [{ ...resume.workExperienceSection[0], workDescription: "• New first bullet\n• Released 2 features, growing subscriptions by 18%" }] }))
    expect(quotedNow(moved, bullet, "growing subscriptions")).toEqual({
      place: { ...bullet, line: 1 },
      text: "Released 2 features, growing subscriptions by 18%",
      order: moved.findIndex(({ text }) => text.startsWith("Released")),
    })
  })

  test("nowhere once they're gone", () => {
    expect(quotedNow(texts, bullet, "Led a team of six")).toBeNull()
    expect(quotedNow(texts, { ...bullet, entry: 3 }, "growing subscriptions")).toBeNull()
  })
})
