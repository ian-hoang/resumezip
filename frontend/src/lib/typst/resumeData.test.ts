import { describe, expect, test } from "vitest"
import { toTemplateData } from "./resumeData"

const bulletsOf = (description: string) =>
  toTemplateData({ workExperienceSection: [{ id: 1, companyName: "Acme", workDescription: description }] }).work[0].bullets

describe("bold words in bullets", () => {
  test("words in **double asterisks** are bold", () => {
    expect(bulletsOf("• Optimized a **Rust** engine to **125 ns** p99")).toEqual([
      [
        { text: "Optimized a ", bold: false },
        { text: "Rust", bold: true },
        { text: " engine to ", bold: false },
        { text: "125 ns", bold: true },
        { text: " p99", bold: false },
      ],
    ])
  })

  test("a lone ** is kept as typed", () => {
    expect(bulletsOf("• Raised 2 ** 10 requests")).toEqual([[{ text: "Raised 2 ** 10 requests", bold: false }]])
  })

  test("each bullet is read on its own", () => {
    expect(bulletsOf("• **All bold**\n• none")).toEqual([[{ text: "All bold", bold: true }], [{ text: "none", bold: false }]])
  })
})
