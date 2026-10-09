import { describe, expect, test } from "vitest"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { render } from "@/lib/import/testRender"
import { readPdf, linesFromPages } from "@/lib/import/lines"
import { TEMPLATES } from "@/lib/templates"
import { asSaved } from "@/lib/testResume"
import { toTemplateData } from "./resumeData"

const first = "b8911364-19cb-4f20-82c1-421bdbe40f7d"
const second = "db9ad07d-0694-4a0c-9962-b5fef66b1a77"
const empty = "05fb2807-bb55-45fd-a44a-376e408df6cc"
const hidden = "654f555c-269a-4c18-b89e-a396bf7d8391"
// With a section order that repeats and misses sections, as the editor never saves one.
const mixed = asSaved({
  profileSection: { fullName: "Ada Example", summary: "Summary first paragraph.\nSecond line.\n\nLiteral #strong[words] and *asterisks*." },
  workExperienceSection: [{ id: 1, companyName: "Legacy Company", workRole: "Engineer", workDescription: "• Legacy printed detail" }],
  extraSections: {
    [first]: { kind: "text", heading: "Work", text: "Custom first body." },
    [second]: { kind: "list", heading: "Work", bullets: "• Custom **bold** and *italic* detail\n○ OMITTED BULLET SENTINEL" },
    [empty]: { kind: "text", heading: "EMPTY HEADING SENTINEL", text: "   " },
    [hidden]: { kind: "text", heading: "OMITTED HEADING SENTINEL", text: "OMITTED SECTION SENTINEL", leftOut: true },
  },
  sectionOrder: ["Work", `extra:${first}`, `extra:${second}`, `extra:${first}`, "extra:missing"],
})

describe("optional section template data", () => {
  test("keeps built-in identity separate from repeated custom headings and literal prose", () => {
    const data = toTemplateData(mixed)
    expect(data.order.slice(0, 3)).toEqual(["Work", `extra:${first}`, `extra:${second}`])
    expect(data.summary).toEqual(["Summary first paragraph.\nSecond line.", "Literal #strong[words] and *asterisks*."])
    expect(data.extras[`extra:${first}`].heading).toBe("Work")
    expect(data.extras[`extra:${second}`].heading).toBe("Work")
    expect(data.work[0].company).toBe("Legacy Company")
  })

  test("omitted content and empty sections have no printable descriptor", () => {
    const serialized = JSON.stringify(toTemplateData(mixed))
    expect(serialized).not.toContain("OMITTED")
    expect(serialized).not.toContain("EMPTY HEADING")
  })
})

async function printed(resume: Record<string, unknown>) {
  const doc = (await getDocument({ data: await render(resume), isEvalSupported: false, fontExtraProperties: true })
    .promise) as unknown as PDFDocumentProxy
  try {
    const pages = await readPdf(doc)
    return { pages, lines: linesFromPages(pages) }
  } finally {
    await doc.destroy()
  }
}

describe.each(TEMPLATES)("$id optional sections", ({ id }) => {
  test("compiles mixed sections in order without omission leaks or evaluated markup", async () => {
    const { lines } = await printed({ ...mixed, selectedTemplate: id })
    const text = lines.map((line) => line.text).join("\n")
    const normalized = text.replace(/\s+/g, " ")
    for (const value of [
      "Summary first paragraph.",
      "Second line.",
      "Literal #strong[words] and *asterisks*.",
      "Legacy Company",
      "Custom first body.",
      "Custom bold and italic detail",
    ]) {
      expect(normalized.toLowerCase(), `${id}: ${value}`).toContain(value.toLowerCase())
    }
    expect(text).not.toContain("SENTINEL")
    const tokens = ["Summary first", "Legacy Company", "Custom first", "Custom bold"]
    const positions = tokens.map((token) => normalized.toLowerCase().indexOf(token.toLowerCase()))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    const marked = lines.find((line) => line.text.includes("Custom bold"))
    expect(marked?.parts.some((part) => part.runs.some((run) => run.bold))).toBe(true)
    expect(marked?.parts.some((part) => part.runs.some((run) => run.italic))).toBe(true)
  })

  test("flows long prose and lists across pages without losing text", async () => {
    const paragraphs = Array.from(
      { length: 35 },
      (_, index) =>
        `Paragraph ${index + 1}: This extended section explains practical experience with readable content and ordinary wording repeated to exercise automatic page flow.`,
    ).join("\n\n")
    const bullets = Array.from(
      { length: 35 },
      (_, index) =>
        `• Printed custom item ${index + 1}: a detailed achievement that wraps across lines without shrinking or being cut off.`,
    ).join("\n")
    const resume = {
      profileSection: mixed.profileSection,
      selectedTemplate: id,
      extraSections: {
        [first]: { kind: "text", heading: "Long narrative", text: paragraphs },
        [second]: { kind: "list", heading: "Long list", bullets },
      },
      sectionOrder: [`extra:${first}`, `extra:${second}`],
    }
    const { pages, lines } = await printed(resume)
    const text = lines
      .map((line) => line.text)
      .join(" ")
      .replace(/\s+/g, " ")
    expect(pages.length).toBeGreaterThan(1)
    for (let number = 1; number <= 35; number++) {
      expect(text).toContain(`Paragraph ${number}:`)
      expect(text).toContain(`Printed custom item ${number}:`)
    }
    for (const line of lines) {
      if (!line.box || !line.page) continue
      expect(line.box[0], `${id}: ${line.text}`).toBeGreaterThanOrEqual(0)
      expect(line.box[2], `${id}: ${line.text}`).toBeLessThanOrEqual(pages[line.page - 1].width + 1)
    }
  })
})
