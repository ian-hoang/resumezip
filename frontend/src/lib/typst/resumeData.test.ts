import { describe, expect, test } from "vitest"
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
