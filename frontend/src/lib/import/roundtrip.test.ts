// Renders each template's sample resume to PDF with the real Typst templates,
// reads the PDF back the way "Open a file" does for PDFs from elsewhere (no
// resumezip attachment), and checks it prints the same resume.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { beforeAll, describe, expect, test } from "vitest"
import { CompileFormatEnum, createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler"
import { loadFonts } from "@myriaddreamin/typst.ts/options.init"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { cleanResume } from "@/lib/resumeFile"
import { toTemplateData } from "@/lib/typst/resumeData"
import { linesFromPdf } from "./lines"
import { parseResume, toResumeContent } from "./parse"

const TYPST = path.resolve("src/lib/typst")
const FONTS = path.resolve("public/fonts")
const WASM = path.resolve("node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm")

/**
 * Fields each template's sample doesn't read back yet, as paths into the
 * printed data. Fix one in parse.ts, then delete it here; anything that
 * starts differing and isn't listed fails the test.
 */
const KNOWN_GAPS: Record<string, string[]> = {
  // A comma inside an award's name reads as the start of the organization.
  jake: ["awards[0].name", "awards[0].organization"],
  levelsfyi: [],
  // The first job's company and role come back swapped.
  modernjack: ["work[0].company", "work[0].role"],
  // "Organization, City, ST" on one line all reads as the location, and a
  // comma or dash inside an award's name reads as the start of the organization.
  referme: [
    "education[0].school",
    "education[0].location",
    "work[0].company",
    "work[0].location",
    "work[2].company",
    "work[2].location",
    "volunteer[0].organization",
    "volunteer[0].location",
    "awards[0].name",
    "awards[0].organization",
    "awards[1].name",
    "awards[1].organization",
  ],
}

const samples = readdirSync(path.join(TYPST, "preview-samples")).map((file) => JSON.parse(readFileSync(path.join(TYPST, "preview-samples", file), "utf8")))

let compiler: TypstCompiler

beforeAll(async () => {
  compiler = createTypstCompiler()
  await compiler.init({
    getModule: () => readFileSync(WASM),
    beforeBuild: [loadFonts(readdirSync(FONTS).map((file) => new Uint8Array(readFileSync(path.join(FONTS, file)))), { assets: false })],
  })
  for (const file of readdirSync(path.join(TYPST, "templates"))) {
    compiler.addSource(`/${file}`, readFileSync(path.join(TYPST, "templates", file), "utf8"))
  }
})

async function render(resume: Record<string, unknown>): Promise<Uint8Array> {
  compiler.mapShadow("/resume.json", new TextEncoder().encode(JSON.stringify(toTemplateData(resume))))
  const { result, diagnostics } = await compiler.compile({
    mainFilePath: `/${resume.selectedTemplate}.typ`,
    format: CompileFormatEnum.pdf,
    diagnostics: "unix",
  })
  if (!result) throw new Error(diagnostics?.join("\n") || "Typst produced no output")
  return result
}

async function readBack(pdf: Uint8Array) {
  const doc = (await getDocument({ data: pdf, isEvalSupported: false, fontExtraProperties: true }).promise) as unknown as PDFDocumentProxy
  try {
    const parsed = parseResume((await linesFromPdf(doc)).lines)
    return { parsed, resume: toResumeContent(parsed) }
  } finally {
    await doc.destroy()
  }
}

// What a resume prints, minus differences that print the same or are
// deliberate: the parser writes GPAs without spaces ("3.9/4.0").
function printed(resume: Record<string, unknown>) {
  const data = toTemplateData(resume)
  for (const school of data.education) school.gpa = school.gpa.replace(/\s+/g, "")
  return data
}

/** Paths ("work[0].role") where two values differ. */
function differences(want: unknown, got: unknown, at = ""): string[] {
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

describe.each(samples.map((sample) => [sample.selectedTemplate as string, sample]))("the %s sample", (template, sample) => {
  test("reads back as it was printed", async () => {
    const { parsed, resume } = await readBack(await render(sample))
    const want = printed(cleanResume(sample))
    const got = printed(resume)

    expect(parsed.unplaced).toEqual([])
    // Sections are found in the order they're printed; empty ones aren't printed.
    expect(got.order.filter((name) => parsed.sections.some((section) => section.name === name))).toEqual(
      want.order.filter((name) => parsed.sections.some((section) => section.name === name)),
    )
    expect(differences({ ...want, order: [] }, { ...got, order: [] }).sort()).toEqual([...(KNOWN_GAPS[template] ?? [])].sort())
  })
})

test("every template's sample is checked", () => {
  expect(samples.map((sample) => sample.selectedTemplate).sort()).toEqual(Object.keys(KNOWN_GAPS).sort())
})

test("a DOI or link holding a year keeps it, and the citation's own date is found", async () => {
  const sample = samples.find((resume) => resume.selectedTemplate === "levelsfyi")
  const resume = {
    ...sample,
    publicationsSection: [
      { ...sample.publicationsSection[0], publicationLink: "10.1109/CVPR.2016.90", publicationDate: "June 2016" },
      { ...sample.publicationsSection[1], publicationLink: "arxiv.org/abs/2023.01234", publicationDate: "Mar. 2024" },
    ],
  }
  const got = printed((await readBack(await render(resume))).resume).publications
  expect(got.map(({ doi, link, date }) => ({ doi, link, date }))).toEqual([
    { doi: "10.1109/CVPR.2016.90", link: "", date: "June 2016" },
    { doi: "", link: "arxiv.org/abs/2023.01234", date: "Mar. 2024" },
  ])
})
