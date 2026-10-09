import { describe, expect, test } from "vitest"
import { CORE_SECTIONS } from "@/components/editor/sections"
import { asSaved } from "@/lib/testResume"
import { toTemplateData } from "./resumeData"

const bulletsOf = (description: string) =>
  toTemplateData({ workExperienceSection: [{ id: 1, companyName: "Acme", workDescription: description }] }).work[0].bullets

const plain = (text: string) => ({ text, bold: false, italic: false })
const bold = (text: string) => ({ text, bold: true, italic: false })
const italic = (text: string) => ({ text, bold: false, italic: true })

describe("bold and italic words in bullets", () => {
  test("words in **double asterisks** are bold", () => {
    expect(bulletsOf("• Optimized a **Rust** engine to **125 ns** p99")).toEqual([
      [plain("Optimized a "), bold("Rust"), plain(" engine to "), bold("125 ns"), plain(" p99")],
    ])
  })

  test("words in *single asterisks* are italic, and ***three*** are both", () => {
    expect(bulletsOf("• Led *Project Atlas* to ***record*** sales")).toEqual([
      [plain("Led "), italic("Project Atlas"), plain(" to "), { text: "record", bold: true, italic: true }, plain(" sales")],
    ])
  })

  test("one-letter words in marks end at their own marker", () => {
    expect(bulletsOf("• Built in **C** and **Go**")).toEqual([[plain("Built in "), bold("C"), plain(" and "), bold("Go")]])
    expect(bulletsOf("• Hired ***5*** of *8* finalists")).toEqual([
      [plain("Hired "), { text: "5", bold: true, italic: true }, plain(" of "), italic("8"), plain(" finalists")],
    ])
  })

  test("marks can sit inside each other", () => {
    expect(bulletsOf("• **Shipped *v2* early**")).toEqual([[bold("Shipped "), { text: "v2", bold: true, italic: true }, bold(" early")]])
  })

  test("asterisks that don't touch words, or have no pair, are kept as typed", () => {
    expect(bulletsOf("• Raised 2 ** 10 requests")).toEqual([[plain("Raised 2 ** 10 requests")]])
    expect(bulletsOf("• Scored 2 * 3 * 4 points")).toEqual([[plain("Scored 2 * 3 * 4 points")]])
    expect(bulletsOf("• Rated 5* by users")).toEqual([[plain("Rated 5* by users")]])
  })

  test("each bullet is read on its own", () => {
    expect(bulletsOf("• **All bold**\n• none")).toEqual([[bold("All bold")], [plain("none")]])
  })
})

describe("section order", () => {
  test("sections missing from an older saved order are printed at the end", () => {
    // Saved before Publications existed.
    const data = toTemplateData({
      sectionOrder: ["Work", "Education", "Skills", "Projects", "Volunteership", "Leadership", "Awards"],
      publicationsSection: [{ id: 1, publicationTitle: "Fast Joins on Small Machines" }],
    })
    expect(data.publications).toHaveLength(1)
    // Its empty optional sections were only listed by default, and print nothing.
    expect(data.order).toEqual(["Work", "Education", "Skills", "Projects", "Publications"])
  })

  test("unknown names are ignored and no section is printed twice", () => {
    expect(toTemplateData(asSaved({ sectionOrder: ["Skills", "Hobbies", "Skills", 7, "Work"] })).order).toEqual([
      "Skills",
      "Work",
      "Education",
      "Projects",
    ])
  })

  test("without a saved order, the core sections are printed, and an optional one with entries", () => {
    expect(toTemplateData({}).order).toEqual(CORE_SECTIONS)
    expect(toTemplateData({ sectionOrder: [] }).order).toEqual(CORE_SECTIONS)
    expect(toTemplateData({ awardsSection: [{ id: 1, awardName: "Dean's List" }] }).order).toEqual([...CORE_SECTIONS, "Awards"])
  })
})

describe("what the person left out", () => {
  const words = (bullets: { text: string }[][]) => bullets.map((bullet) => bullet.map((run) => run.text).join(""))

  test("isn't printed", () => {
    const data = toTemplateData({
      workExperienceSection: [
        { id: 1, companyName: "Acme", workDescription: "• Built a loom\n○ Fed the cat" },
        { id: 2, companyName: "Initech", leftOut: true },
      ],
    })
    expect(data.work.map((job) => job.company)).toEqual(["Acme"])
    expect(words(data.work[0].bullets)).toEqual(["Built a loom"])
  })

  test("leaves a section with nothing to print, which the templates leave out, title and all", () => {
    const data = toTemplateData({ skillsSection: [{ id: 1, skillName: "Languages", leftOut: true }] })
    expect(data.skills).toEqual([])
  })
})
