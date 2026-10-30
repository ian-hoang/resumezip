// Renders resumes to PDF with the real Typst templates, and reads PDFs back
// the way "Open a file" does for PDFs from elsewhere, for any test that needs
// a resume printed, or a PDF read, as the site does it.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { CompileFormatEnum, createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler"
import { loadFonts } from "@myriaddreamin/typst.ts/options.init"
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentProxy } from "pdfjs-dist"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import { firstColumnOf, templateById } from "@/lib/templates"
import { printedSections, toTemplateData, type TemplateData } from "@/lib/typst/resumeData"
import { linesFromPages, readPdf, type PageSize, type PdfPage } from "./lines"
import { parseResume, toResumeContent } from "./parse"

const TYPST = path.resolve("src/lib/typst")
const FONTS = path.resolve("src/lib/typst/fonts")
const WASM = path.resolve("node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm")

/** The sample resume of each template, as the template gallery shows it. */
export const samples = readdirSync(path.join(TYPST, "preview-samples")).map((file) =>
  JSON.parse(readFileSync(path.join(TYPST, "preview-samples", file), "utf8")),
)

let compiler: Promise<TypstCompiler> | null = null

// One compiler for every test in a file, with the templates and fonts loaded once.
function typst(): Promise<TypstCompiler> {
  compiler ??= (async () => {
    const created = createTypstCompiler()
    await created.init({
      getModule: () => readFileSync(WASM),
      beforeBuild: [
        loadFonts(
          readdirSync(FONTS).map((file) => new Uint8Array(readFileSync(path.join(FONTS, file)))),
          { assets: false },
        ),
      ],
    })
    for (const file of readdirSync(path.join(TYPST, "templates"))) {
      created.addSource(`/${file}`, readFileSync(path.join(TYPST, "templates", file), "utf8"))
    }
    return created
  })()
  return compiler
}

/** A resume in the editor's format, printed with its template. */
export async function render(resume: Record<string, unknown>): Promise<Uint8Array> {
  const typstCompiler = await typst()
  typstCompiler.mapShadow("/resume.json", new TextEncoder().encode(JSON.stringify(toTemplateData(resume))))
  const { result, diagnostics } = await typstCompiler.compile({
    mainFilePath: `/${resume.selectedTemplate}.typ`,
    format: CompileFormatEnum.pdf,
    diagnostics: "unix",
  })
  if (!result) throw new Error(diagnostics?.join("\n") || "Typst produced no output")
  return result
}

/**
 * The headings a resume prints, sections the person added included, in the
 * order its PDF holds them: any column on the left first, then the summary,
 * then the other sections.
 */
export function printedHeadings(resume: Record<string, unknown>, data: TemplateData = toTemplateData(resume)): string[] {
  const sections = printedSections(data)
  const first = firstColumnOf(templateById(resume.selectedTemplate))
  return [
    ...sections.filter(({ name }) => first.includes(name)),
    ...(data.summary.length ? [{ name: "Summary", heading: "Summary" }] : []),
    ...sections.filter(({ name }) => !first.includes(name)),
  ].map(({ heading }) => heading)
}

/**
 * What a resume prints, minus differences that print the same or are
 * deliberate: the parser writes GPAs without spaces ("3.9/4.0").
 */
export function printedData(resume: Record<string, unknown>): TemplateData {
  const data = toTemplateData(resume)
  for (const school of data.education) school.gpa = school.gpa.replace(/\s+/g, "")
  return data
}

/** Paths ("work[0].role") where two values differ. */
export function differences(want: unknown, got: unknown, at = ""): string[] {
  if (Array.isArray(want) || Array.isArray(got)) {
    const a = Array.isArray(want) ? want : []
    const b = Array.isArray(got) ? got : []
    if (a.every((item) => typeof item !== "object") && b.every((item) => typeof item !== "object")) {
      return JSON.stringify(a) === JSON.stringify(b) ? [] : [at]
    }
    return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => differences(a[i], b[i], `${at}[${i}]`)).flat()
  }
  if (want && got && typeof want === "object" && typeof got === "object") {
    const keys = new Set([...Object.keys(want), ...Object.keys(got)])
    return [...keys].flatMap((key) =>
      differences((want as Record<string, unknown>)[key], (got as Record<string, unknown>)[key], at ? `${at}.${key}` : key),
    )
  }
  return want === got ? [] : [at]
}

/** `pdf` opened with pdf.js as "Open a file" opens it, for `read`, and closed after. */
async function withPdf<T>(pdf: Uint8Array, read: (doc: PDFDocumentProxy) => Promise<T>): Promise<T> {
  const doc = (await getDocument({ data: pdf, isEvalSupported: false, fontExtraProperties: true }).promise) as unknown as PDFDocumentProxy
  try {
    return await read(doc)
  } finally {
    await doc.destroy()
  }
}

/** A PDF's pages, as "Open a file" reads them before putting their text in lines. */
export const pagesOf = (pdf: Uint8Array): Promise<PdfPage[]> => withPdf(pdf, (doc) => readPdf(doc))

/** A PDF read back: its pages, what the resume reader found, and that as a resume. */
export async function readBack(pdf: Uint8Array) {
  const pdfPages = await pagesOf(pdf)
  const parsed = parseResume(linesFromPages(pdfPages))
  const pages: PageSize[] = pdfPages.map(({ width, height }) => ({ width, height }))
  return { parsed, pages, resume: toResumeContent(parsed) }
}

/** Each piece of text a PDF prints, with the font pdf.js says it's drawn in, without the subset's tag ("Lato-Bold"). */
export function textWithFonts(pdf: Uint8Array): Promise<{ text: string; font: string }[]> {
  return withPdf(pdf, async (doc) => {
    const pieces: { text: string; font: string }[] = []
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number)
      // The fonts' names are only there once the page's fonts are loaded.
      await page.getOperatorList()
      for (const item of (await page.getTextContent()).items as TextItem[]) {
        const name = String((page.commonObjs.get(item.fontName) as { name?: string }).name)
        pieces.push({ text: item.str, font: name.replace(/^[A-Z]{6}\+/, "") })
      }
    }
    return pieces
  })
}

/** How many shapes a PDF draws (rules, underlines, boxes), counted as pdf.js reads its paths. */
export function shapesOf(pdf: Uint8Array): Promise<number> {
  return withPdf(pdf, async (doc) => {
    let shapes = 0
    for (let number = 1; number <= doc.numPages; number++) {
      const { fnArray } = await (await doc.getPage(number)).getOperatorList()
      shapes += fnArray.filter((op) => op === OPS.constructPath).length
    }
    return shapes
  })
}

/** The letters in `text`, each once. */
export const lettersOf = (text: string) => [...new Set(text.match(/\p{L}/gu))]
