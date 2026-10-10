// How the templates lay out a line with text on the left and dates or a GPA
// flush right, checked on the printed page: however long the text gets, it
// never runs into them or over them.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { expect, test } from "vitest"
import { readPdf, type PdfPage } from "@/lib/import/lines"
import { render } from "@/lib/import/testRender"
import { TEMPLATES } from "@/lib/templates"

const TEXT = "Senior Software Engineering Intern on the Payments Platform and Data Infrastructure Reliability Team for Cloud Services"

// The text a letter longer in each entry, so in one of them it fills its line
// exactly. Each entry's dates and GPA are told apart by their year.
const entries = Array.from({ length: TEXT.length - 29 }, (_, i) => ({ text: TEXT.slice(0, 30 + i).trim(), year: 1930 + i }))

async function pagesOf(pdf: Uint8Array): Promise<PdfPage[]> {
  const doc = (await getDocument({ data: pdf, isEvalSupported: false, fontExtraProperties: true }).promise) as unknown as PDFDocumentProxy
  try {
    return await readPdf(doc)
  } finally {
    await doc.destroy()
  }
}

type Item = PdfPage["items"][number]

/** The printed piece of text holding `text`, with the rest of its page. Throws if it's split, say across two lines. */
function find(pages: PdfPage[], text: string): { item: Item; items: Item[] } {
  for (const { items } of pages) {
    const item = items.find((item) => item.text.includes(text))
    if (item) return { item, items }
  }
  throw new Error(`"${text}" isn't printed in one piece`)
}

/**
 * How far `text` starts after what's printed before it on its line, in ems:
 * 0 if it's run into that text, below 0 if the two overlap. Throws if nothing
 * is printed before it, as then it has come off its entry's line.
 */
function gapBefore(pages: PdfPage[], text: string): number {
  const { item, items } = find(pages, text)
  if (!item.text.trimStart().startsWith(text)) return 0
  const before = items.filter((other) => other !== item && Math.abs(other.baseline - item.baseline) <= 0.45 * item.size && other.x < item.x)
  if (before.length === 0) throw new Error(`nothing is printed before "${text}" on its line`)
  return (item.x - Math.max(...before.map((other) => other.right))) / item.size
}

test("text run into the dates leaves no gap before them, and text run over them less than none", () => {
  const line = (...items: [text: string, x: number, right: number][]): PdfPage[] => [
    {
      width: 612,
      height: 792,
      links: [],
      items: items.map(([text, x, right]) => ({ text, x, right, baseline: 700, size: 10, bold: false, italic: false })),
    },
  ]
  expect(gapBefore(line(["Senior Engineer", 36, 300], ["May 2024", 310, 350]), "May 2024")).toBeCloseTo(1)
  expect(gapBefore(line(["Senior EngineerMay 2024", 36, 350]), "May 2024")).toBe(0)
  expect(gapBefore(line(["A long company name", 36, 330], ["May 2024", 310, 350]), "May 2024")).toBeCloseTo(-2)
  expect(() => gapBefore(line(["May 2024", 310, 350]), "May 2024")).toThrow("nothing is printed before")
})

// Templates that print dates at the start of a line of their own, under the
// entry's name, rather than flush right: nothing comes before them to run into.
const DATES_FIRST = new Set(["deedy"])

/**
 * Whether `text` starts its line, with nothing printed just before it. Text
 * further left, an em or more away, is another column's.
 */
function startsLine(pages: PdfPage[], text: string): boolean {
  const { item, items } = find(pages, text)
  return (
    item.text.trimStart().startsWith(text) &&
    !items.some(
      (other) =>
        other !== item &&
        Math.abs(other.baseline - item.baseline) <= 0.45 * item.size &&
        other.x < item.x &&
        other.right > item.x - item.size,
    )
  )
}

test.each(TEMPLATES.map((template) => template.id))("%s keeps dates apart from the text before them, however long it is", async (id) => {
  const pages = await pagesOf(
    await render({
      selectedTemplate: id,
      profileSection: { fullName: "Alex Kim" },
      educationSection: entries.map(({ text, year }) => ({
        schoolName: text,
        degree: text,
        gpa: `4.${year}`,
        schoolStartDate: `Sep ${year}`,
      })),
      workExperienceSection: entries.map(({ text, year }) => ({
        companyName: "Google",
        workLocation: "Mountain View, CA",
        workRole: text,
        workStartDate: `May ${year}`,
      })),
      projectsSection: entries.map(({ text, year }) => ({ projectName: text, projectDate: `Jan ${year}` })),
      awardsSection: entries.map(({ text, year }) => ({ awardName: text, awardDate: `Mar ${year}` })),
    }),
  )
  for (const { text, year } of entries) {
    for (const dates of [`Sep ${year}`, `May ${year}`, `Jan ${year}`, `Mar ${year}`]) {
      if (DATES_FIRST.has(id)) expect(startsLine(pages, dates), `${dates} under "${text}"`).toBe(true)
      else expect(gapBefore(pages, dates), `${dates} after "${text}"`).toBeGreaterThanOrEqual(0.5)
    }
    // Some templates print the GPA in the degree's line or a line of its own;
    // where it's flush right, like the dates, it's kept apart the same way.
    const gpa = `GPA: 4.${year}`
    if (Math.abs(find(pages, `4.${year}`).item.right - find(pages, `Sep ${year}`).item.right) <= 1) {
      expect(gapBefore(pages, gpa), `${gpa} after "${text}"`).toBeGreaterThanOrEqual(0.5)
    }
  }
})
