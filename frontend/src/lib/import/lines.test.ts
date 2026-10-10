import { readFileSync } from "node:fs"
import { describe, expect, test, vi } from "vitest"
import { convertToHtml } from "mammoth"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { MAX_CHARACTERS, MAX_PAGES, MAX_WORD_XML_BYTES, TooMuchTextError } from "./limits"
import { cleanLink, linesFromDocx, linesFromPages, readPdf, UnreadableWordFileError, unzippedXmlSize } from "./lines"
import { pdfOf, textPdf, wordFile } from "./testFiles"

// mammoth as it is, with its converter watched.
vi.mock("mammoth", async (importOriginal) => {
  const mammoth = await importOriginal<typeof import("mammoth")>()
  return { ...mammoth, convertToHtml: vi.fn(mammoth.convertToHtml) }
})

const bytes = (buffer: Buffer) => new Uint8Array(buffer).buffer

/** A zip whose directory keeps `name`'s unzipped size elsewhere, as ZIP64 does: there, it says 0xFFFFFFFF. */
function sizeKeptElsewhere(zip: Buffer, name: string): Buffer {
  const copy = Buffer.from(zip)
  for (let at = copy.indexOf("PK\x01\x02", 0, "latin1"); at >= 0; at = copy.indexOf("PK\x01\x02", at + 4, "latin1")) {
    if (copy.toString("latin1", at + 46, at + 46 + copy.readUInt16LE(at + 28)) === name) copy.writeUInt32LE(0xffffffff, at + 24)
  }
  return copy
}

/** A zip marked as ZIP64 by the record a ZIP64 file has just before its directory's end. */
function zip64(zip: Buffer): Buffer {
  const locator = Buffer.alloc(20)
  locator.writeUInt32LE(0x07064b50)
  return Buffer.concat([zip.subarray(0, -22), locator, zip.subarray(-22)])
}

async function withPdf(pdf: Buffer, check: (doc: PDFDocumentProxy) => Promise<void>) {
  const doc = (await getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, fontExtraProperties: true })
    .promise) as unknown as PDFDocumentProxy
  try {
    await check(doc)
  } finally {
    await doc.destroy()
  }
}

describe("cleanLink", () => {
  test("drops what pdf.js adds to a LaTeX link written without https://", () => {
    expect(cleanLink('www.linkedin.com/in/someone/.pdf#[0,{"name":"Fit"}]')).toBe("www.linkedin.com/in/someone")
    expect(cleanLink("http://www.linkedin.com/in/someone/.pdf#[0,{%22name%22:%22Fit%22}]")).toBe("http://www.linkedin.com/in/someone")
  })

  test("leaves real links alone, including links to PDFs", () => {
    expect(cleanLink("https://github.com/someone")).toBe("https://github.com/someone")
    expect(cleanLink("https://example.com/paper.pdf#page=2")).toBe("https://example.com/paper.pdf#page=2")
    expect(cleanLink("mailto:someone@example.com")).toBe("mailto:someone@example.com")
  })
})

describe("reading a PDF", () => {
  test(`one of ${MAX_PAGES} full pages comes back whole, in order`, async () => {
    const pages = Array.from({ length: MAX_PAGES }, (_, page) =>
      Array.from({ length: 45 }, (_, line) => `Page ${page + 1}, line ${line + 1}`),
    )
    await withPdf(textPdf(pages), async (doc) => {
      const lines = linesFromPages(await readPdf(doc))
      expect(lines.map((line) => line.text)).toEqual(pages.flat())
      expect(lines.map((line) => line.page)).toEqual(pages.flatMap((page, index) => page.map(() => index + 1)))
    })
  })

  test("stops at the page that takes it over the text limit", async () => {
    // A page of 1-point text, with room for more than the limit.
    const tiny = Array.from({ length: MAX_CHARACTERS / 1000 + 1 }, () => "x".repeat(1000))
    await withPdf(textPdf([["Mara Lin"], tiny, ["Never read"]], { size: 1 }), async (doc) => {
      const getPage = vi.spyOn(doc, "getPage")
      await expect(readPdf(doc)).rejects.toThrow(TooMuchTextError)
      expect(getPage.mock.calls.map(([number]) => number)).toEqual([1, 2])
    })
  })

  test("reads no further once cancelled", async () => {
    await withPdf(textPdf([["Mara Lin"], ["Never read"]]), async (doc) => {
      // Cancelled while the first page is being read.
      const cancel = new AbortController()
      const getPage = doc.getPage.bind(doc)
      const reads = vi.spyOn(doc, "getPage").mockImplementation((number) => {
        cancel.abort()
        return getPage(number)
      })
      await expect(readPdf(doc, cancel.signal)).rejects.toSatisfy((error: Error) => error.name === "AbortError")
      expect(reads).toHaveBeenCalledTimes(1)
    })
  })
})

describe("reading a Word file", () => {
  test("its unzipped size is read from the zip's directory", () => {
    const size = (padding: number) => unzippedXmlSize(bytes(wordFile(["Mara Lin"], { padding })))
    expect(size(5000)! - size(0)!).toBe(5000)
  })

  test("a file that isn't a zip has no size to read", () => {
    expect(unzippedXmlSize(bytes(Buffer.from("not a zip")))).toBeNull()
  })

  test("one that unzips to too much text isn't converted", async () => {
    vi.mocked(convertToHtml).mockClear()
    await expect(linesFromDocx(bytes(wordFile(["Mara Lin"], { padding: MAX_WORD_XML_BYTES })))).rejects.toThrow(TooMuchTextError)
    expect(convertToHtml).not.toHaveBeenCalled()
  })

  test("one whose zip keeps the size elsewhere (ZIP64) isn't converted either", async () => {
    vi.mocked(convertToHtml).mockClear()
    for (const file of [sizeKeptElsewhere(wordFile(["Mara Lin"]), "word/document.xml"), zip64(wordFile(["Mara Lin"]))]) {
      expect(unzippedXmlSize(bytes(file))).toBe(Infinity)
      await expect(linesFromDocx(bytes(file))).rejects.toThrow(TooMuchTextError)
    }
    expect(convertToHtml).not.toHaveBeenCalled()
  })

  test("one with something else before the zip is measured all the same", async () => {
    vi.mocked(convertToHtml).mockClear()
    const prefixed = (zip: Buffer) => Buffer.concat([Buffer.from("Something else first. "), zip])
    expect(unzippedXmlSize(bytes(prefixed(wordFile(["Mara Lin"]))))).toBe(unzippedXmlSize(bytes(wordFile(["Mara Lin"]))))
    await expect(linesFromDocx(bytes(prefixed(wordFile(["Mara Lin"], { padding: MAX_WORD_XML_BYTES }))))).rejects.toThrow(TooMuchTextError)
    expect(convertToHtml).not.toHaveBeenCalled()
  })

  test("a damaged zip is left to mammoth, which can't read it", async () => {
    const file = wordFile(["Mara Lin"])
    // Says the directory is bigger than the whole file.
    file.writeUInt32LE(file.length, file.length - 22 + 12)
    expect(unzippedXmlSize(bytes(file))).toBeNull()
    await expect(linesFromDocx(bytes(file))).rejects.toThrow(UnreadableWordFileError)
  })

  test("its paragraphs become lines", async () => {
    vi.mocked(convertToHtml).mockClear()
    await expect(linesFromDocx(bytes(wordFile(["Mara Lin", "mara@example.com"])))).resolves.toMatchObject([
      { text: "Mara Lin" },
      { text: "mara@example.com" },
    ])
    expect(convertToHtml).toHaveBeenCalledTimes(1)
  })
})

describe("hyphens", () => {
  test("one a typesetter added to break a word at the end of a line comes back as a soft hyphen", async () => {
    // Typst marks those hyphens as soft ones; a hyphen in "motion-capture" is part of the word.
    await withPdf(readFileSync("src/lib/import/corpus/marcus/typst-academic.pdf"), async (doc) => {
      const texts = linesFromPages(await readPdf(doc)).map((line) => line.text)
      expect(texts.some((text) => text.endsWith(" coor\u00AD"))).toBe(true)
      expect(texts.some((text) => text.endsWith(" motion-"))).toBe(true)
    })
  })

  test("one alone in a span is soft however many spans are around it, and one sharing a span isn't", async () => {
    const depth = 5000
    const content = [
      "BT /F1 12 Tf 72 720 Td",
      "/P << >> BDC ".repeat(depth),
      "(It helps coor) Tj /Span << /ActualText <FEFF00AD> >> BDC (-) Tj EMC",
      "0 -16 Td (dinate the team) Tj",
      // A hyphen in a span with a span of text in it isn't alone.
      "0 -16 Td (Not so well) Tj /Span << >> BDC (-) Tj 0 -16 Td /Span << >> BDC (known) Tj EMC EMC",
      "EMC ".repeat(depth),
      "ET",
    ].join(" ")
    await withPdf(pdfOf([content]), async (doc) => {
      const texts = linesFromPages(await readPdf(doc)).map((line) => line.text)
      expect(texts).toEqual(["It helps coor\u00AD", "dinate the team", "Not so well-", "known"])
    })
  })

  test("one alone in a span that's part of the document's structure, or has nothing to say about it, is a hyphen", async () => {
    const content = [
      "BT /F1 12 Tf 72 720 Td",
      // A span in the document's structure, numbered by an MCID.
      "(A well) Tj /Span << /MCID 3 >> BDC (-) Tj EMC",
      "0 -16 Td (known name) Tj",
      // A span with no properties, which can't say what it stands for.
      "0 -16 Td (A long) Tj /Span BMC (-) Tj EMC",
      "0 -16 Td (term plan) Tj",
      "ET",
    ].join(" ")
    await withPdf(pdfOf([content]), async (doc) => {
      const texts = linesFromPages(await readPdf(doc)).map((line) => line.text)
      expect(texts).toEqual(["A well-", "known name", "A long-", "term plan"])
    })
  })
})

/** Text on a page, half its size wide a letter, as pdf.js gives it. */
const item = (text: string, x: number, baseline: number, size = 10) => ({
  text,
  x,
  right: x + text.length * size * 0.5,
  baseline,
  size,
  bold: false,
  italic: false,
})
const page = (items: ReturnType<typeof item>[]) => ({ width: 612, height: 792, items, links: [] })

describe("bullets", () => {
  test("a dash set apart from its text starts a bullet, as a dot does", () => {
    const lines = linesFromPages([
      page([item("-", 40, 700), item("Ran the storefront cache", 56, 700), item("-", 40, 688), item("Led incident reviews", 56, 688)]),
    ])
    expect(lines.map(({ bullet, text, x }) => ({ bullet, text, x }))).toEqual([
      { bullet: true, text: "Ran the storefront cache", x: 56 },
      { bullet: true, text: "Led incident reviews", x: 56 },
    ])
  })
})

describe("columns", () => {
  // A narrow column on the left and a wider one on the right, their lines
  // level with each other, under a name across both.
  const name = item("Dana Cole", 150, 740, 24)
  const left = ["Education", "State University", "B.S. in Cell Biology, 2022", "Skills", "Python, R, SQL, ImageJ", "Lab safety, PCR"]
  const right = [
    "Experience",
    "Acme Labs | Research Assistant",
    "Jun 2022 - Present | Boston, MA",
    "Ran 300 assays a week for the drug screening team and kept",
    "the lab's sample records up to date in its tracking system",
    "Wrote the scripts that turned plate readings into reports",
    "Trained six new assistants on the plate readers and robots",
    "Ordered the lab's supplies and kept its budget each quarter",
    "Kept the freezer inventory and logged where each sample was",
    "Presented results at the team's weekly meeting with the leads",
  ]
  const leftItems = left.map((text, i) => item(text, 36, 700 - 12 * i))
  const rightItems = right.map((text, i) => item(text, 230, 700 - 12 * i))

  test("one written whole before the other is read as a column, however narrow", () => {
    const texts = linesFromPages([page([name, ...leftItems, ...rightItems])]).map((line) => line.text)
    expect(texts).toEqual(["Dana Cole", ...left, ...right])
  })

  test("text written line by line across both, like dates beside entries, isn't", () => {
    const written = rightItems.flatMap((rightItem, i) => (leftItems[i] ? [leftItems[i], rightItem] : [rightItem]))
    const texts = linesFromPages([page([name, ...written])]).map((line) => line.text)
    expect(texts).toEqual(["Dana Cole", ...right.map((text, i) => (left[i] ? `${left[i]} ${text}` : text))])
  })
})

describe("where a line sits", () => {
  test("is where most of its text sits, not a heading in the margin set a little higher", () => {
    const [line] = linesFromPages([page([item("AWARDS", 60, 700.5, 8), item("Dean's List, State University", 125, 698)])])
    // Boxes measure down from the top of the 792-point page: the text's baseline is 94 down.
    expect(line.box?.[3]).toBeCloseTo(94 + 0.3 * 10)
  })
})
