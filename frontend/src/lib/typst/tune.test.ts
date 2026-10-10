// Fine-tune's settings as each template prints them (lib/tune.ts,
// templates/common.typ), checked on the printed page.

import { readFileSync } from "node:fs"
import path from "node:path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { describe, expect, test } from "vitest"
import { readPdf, type PdfPage } from "@/lib/import/lines"
import { readBack, render, samples } from "@/lib/import/testRender"
import { TEMPLATES } from "@/lib/templates"
import { fitOnePage, pageCount, tighterSteps, type Fitted, type Tune } from "@/lib/tune"
import { toTemplateData } from "./resumeData"

const ids = TEMPLATES.map((template) => template.id)
const sampleOf = (id: string): Record<string, unknown> => samples.find((sample) => sample.selectedTemplate === id)
// The Modern Jake's sample runs onto a second page in Jake's and in Harvard.
const twoPages = JSON.parse(readFileSync(path.resolve("src/lib/typst/preview-samples/modernjack.json"), "utf8"))

async function pagesOf(pdf: Uint8Array): Promise<PdfPage[]> {
  const doc = (await getDocument({ data: pdf, isEvalSupported: false, fontExtraProperties: true }).promise) as unknown as PDFDocumentProxy
  try {
    return await readPdf(doc)
  } finally {
    await doc.destroy()
  }
}

const tuned = async (id: string, tune?: Tune) => pagesOf(await render({ ...sampleOf(id), tune }))
const items = (pages: PdfPage[]) => pages.flatMap((page) => page.items)
const largest = (pages: PdfPage[]) => Math.max(...items(pages).map((item) => item.size))
// The size most of the text is set in.
function body(pages: PdfPage[]): number {
  const chars = new Map<number, number>()
  for (const item of items(pages)) chars.set(item.size, (chars.get(item.size) ?? 0) + item.text.length)
  return [...chars].sort(([, a], [, b]) => b - a)[0][0]
}
const leftmost = (pages: PdfPage[]) => Math.min(...items(pages).map((item) => item.x))
// How far down the first page the text goes, from its top.
const depth = ([page]: PdfPage[]) => page.height - Math.min(...page.items.map((item) => item.baseline))

describe("the template data", () => {
  test("has every setting, the template's own without a tune", () => {
    expect(toTemplateData({}).tune).toEqual({ size: 1, margin: 1, leading: 1, gap: 1, paper: "", onePage: false })
  })

  test("has the resume's tune, read defensively", () => {
    expect(toTemplateData({ tune: { size: 1.1, paper: "a4", onePage: true } }).tune).toEqual({
      size: 1.1,
      margin: 1,
      leading: 1,
      gap: 1,
      paper: "a4",
      onePage: true,
    })
    expect(toTemplateData({ tune: { size: 9, margin: "wide" } as unknown as Tune }).tune).toMatchObject({ size: 1.15, margin: 1 })
  })
})

describe.each(ids)("%s", (id) => {
  test("sets every text size by the text size", async () => {
    const [plain, bigger] = await Promise.all([tuned(id), tuned(id, { size: 1.15 })])
    expect(largest(bigger) / largest(plain)).toBeCloseTo(1.15, 2)
    // The body text too, not only the name.
    expect(body(bigger) / body(plain)).toBeCloseTo(1.15, 2)
  })

  test("sets the margins by the margins", async () => {
    const [plain, wider] = await Promise.all([tuned(id), tuned(id, { margin: 1.4 })])
    expect(leftmost(wider) / leftmost(plain)).toBeCloseTo(1.4, 1)
  })

  test("spaces lines out by the line spacing", async () => {
    const [plain, looser, tighter] = await Promise.all([tuned(id), tuned(id, { leading: 1.3 }), tuned(id, { leading: 0.8 })])
    expect(looser.length > plain.length || depth(looser) > depth(plain)).toBe(true)
    expect(depth(tighter)).toBeLessThan(depth(plain))
  })

  test("spaces sections out by the space between sections, without changing the text", async () => {
    const [plain, wider, tighter] = await Promise.all([tuned(id), tuned(id, { gap: 1.7 }), tuned(id, { gap: 0.3 })])
    expect(wider.length > plain.length || depth(wider) > depth(plain)).toBe(true)
    expect(depth(tighter)).toBeLessThan(depth(plain))
    // Only the space between sections: the text is the same size.
    expect(body(tighter)).toBe(body(plain))
  })

  test("prints on A4", async () => {
    const [page] = await tuned(id, { paper: "a4" })
    expect([page.width, page.height].map(Math.round)).toEqual([595, 842])
  })

  test.each<[string, Tune]>([
    ["at the largest", { size: 1.15, margin: 1.4, leading: 1.3, gap: 1.7, paper: "a4" }],
    ["at the smallest", { size: 0.85, margin: 0.6, leading: 0.8, gap: 0.3 }],
  ])("prints all its text, in reading order, tuned %s", async (_, tune) => {
    // What hiring software reads: the characters in order, wherever lines
    // wrap, and wherever a word is hyphenated across two.
    const text = async (resume: Record<string, unknown>) =>
      (await readBack(await render(resume))).parsed.lines
        .map((line) => line.text)
        .join("")
        .replace(/[\s-]/g, "")
    const sample = sampleOf(id)
    expect(await text({ ...sample, tune })).toBe(await text(sample))
  })
})

describe("keeping to one page", () => {
  const own: Fitted = { size: 1, margin: 1, leading: 1, gap: 1 }
  const printAt = (resume: Record<string, unknown>) => async (fitted: Fitted) => {
    const pdf = await render({ ...resume, tune: { ...fitted, onePage: true } })
    return { pages: pageCount(pdf), printed: pdf }
  }

  test.each(["jake", "resumeworded"])("fits a resume two pages long in %s, by the loosest settings that do", async (id) => {
    const resume = { ...twoPages, selectedTemplate: id }
    expect((await readBack(await render(resume))).pages).toHaveLength(2)

    const { fit, printed } = await fitOnePage(own, printAt(resume))
    expect(fit.fits).toBe(true)
    expect((await readBack(printed)).pages).toHaveLength(1)
    // The spacing gave way before the text did.
    expect(fit.gap).toBeLessThan(1)
    // A step looser, in the order it tightens in, runs over.
    const steps = tighterSteps(own)
    const index = steps.findIndex(
      (step) => step.size === fit.size && step.margin === fit.margin && step.leading === fit.leading && step.gap === fit.gap,
    )
    expect((await printAt(resume)(steps[index - 1] ?? own)).pages).toBe(2)
  })

  test("keeps the text at the template's size when tighter spacing is enough", async () => {
    // A resume a few lines over: with the gaps squeezed, it fits.
    const resume = { ...twoPages, selectedTemplate: "jake" }
    const { fit } = await fitOnePage(own, printAt(resume))
    expect(fit.size).toBe(1)
  })

  test("says when even the tightest settings run over", async () => {
    const work = Array.from({ length: 12 }, (_, i) => ({ ...twoPages.workExperienceSection[0], id: i + 1 }))
    const resume = { ...twoPages, selectedTemplate: "jake", workExperienceSection: work }
    const { fit, printed } = await fitOnePage(own, printAt(resume))
    expect(fit).toEqual({ size: 0.85, margin: 0.6, leading: 0.8, gap: 0.3, fits: false })
    expect((await readBack(printed)).pages.length).toBeGreaterThan(1)
  })

  test("counts the pages Typst prints, whatever the name on them", async () => {
    for (const fullName of ["Maya Okafor", "A (/Type /Page) /Count 9"]) {
      for (const id of ["jake", "modernjack"]) {
        const pdf = await render({ ...twoPages, selectedTemplate: id, profileSection: { ...twoPages.profileSection, fullName } })
        expect(pageCount(pdf)).toBe((await readBack(pdf)).pages.length)
      }
    }
  })
})
