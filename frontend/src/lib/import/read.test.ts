import { describe, expect, test, vi } from "vitest"
import { pdfLayoutOf } from "@/lib/check/extraPdf"
import { viewOf } from "@/lib/check/resume"
import { line } from "@/lib/check/testPdf"
import type { Resume } from "@/lib/resume"
import { MAX_LINES } from "./limits"
import { parseResume } from "./parse"
import { readFile, readForChecks } from "./read"
import { wordFile } from "./testFiles"

// The parser as it is, counting its calls.
vi.mock("./parse", async (importOriginal) => {
  const parse = await importOriginal<typeof import("./parse")>()
  return { ...parse, parseResume: vi.fn(parse.parseResume) }
})

const docx = (paragraphs: string[]) => ({ kind: "docx" as const, data: new Uint8Array(wordFile(paragraphs)).buffer })
const numbered = (count: number) => Array.from({ length: count }, (_, i) => `Line ${i + 1}`)

describe("the import worker", () => {
  test(`reads a file of ${MAX_LINES} lines`, async () => {
    const result = await readFile(docx(["Mara Lin", ...numbered(MAX_LINES - 1)]))
    expect("parsed" in result && result.parsed.lines).toHaveLength(MAX_LINES)
  })

  test("says there's too much text past that", async () => {
    await expect(readFile(docx(numbered(MAX_LINES + 1)))).resolves.toEqual({ problem: "too much text" })
  })

  test("finds no text on a page with none", async () => {
    await expect(readFile({ kind: "pdf", pages: [{ width: 612, height: 792, items: [], links: [] }] })).resolves.toEqual({
      problem: "no text",
    })
  })

  test("doesn't blame the file when mammoth fails to download", async () => {
    vi.resetModules()
    vi.doMock("mammoth", () => {
      throw new TypeError("Failed to fetch dynamically imported module")
    })
    try {
      const { readFile: readWithoutMammoth } = await import("./read")
      await expect(readWithoutMammoth(docx(["Mara Lin"]))).resolves.toEqual({ failed: expect.any(String) })
    } finally {
      vi.doUnmock("mammoth")
    }
  })

  test("says when a Word file can't be read", async () => {
    await expect(readFile({ kind: "docx", data: new TextEncoder().encode("not a zip").buffer })).resolves.toEqual({ problem: "unreadable" })
  })
})

describe("reading a preview for the checks", () => {
  test("parses it once, whether or not it has sections the person added", () => {
    const source: Resume = {
      extraSections: { "11111111-1111-4111-8111-111111111111": { kind: "text", heading: "Interests", text: "Reading fiction" } },
    }
    const parse = vi.mocked(parseResume)
    for (const lines of [
      [line("Interests"), line("Reading fiction")],
      [line("Experience"), line("Engineer, Acme")],
    ]) {
      parse.mockClear()
      readForChecks(lines, pdfLayoutOf(viewOf(source)))
      expect(parse).toHaveBeenCalledTimes(1)
    }
  })
})
