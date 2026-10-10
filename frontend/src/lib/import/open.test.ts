import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { ATTACHMENT_NAME, cleanResume, MAX_LENGTH, toAttachment, toJson, toJsonOfAll } from "@/lib/resumeFile"
import { toWordFile } from "@/lib/word"
import { crc32, storedFile, zip, zipDirectory, type ZipEntry } from "@/lib/zip"
import { MAX_CHARACTERS, MAX_PAGES, TIME_LIMIT_MS } from "./limits"
import { readFile, type ReadRequest } from "./read"
import { wordFile } from "./testFiles"

const resume = { selectedTemplate: "jake", profileSection: { fullName: "Mara Lin" } }
const pdf = () => new File(["%PDF-1.7"], "Mara Lin.pdf", { type: "application/pdf" })
const never = new Promise<never>(() => {})

/** The name of what `promise` rejects with, like "AbortError". */
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => "nothing: it worked",
    (error: Error) => error.name,
  )

/** A line of text as pdf.js reads it, `index` lines down its page. */
const textItem = (str: string, index: number) => ({
  str,
  transform: [12, 0, 0, 12, 72, 720 - 16 * index],
  width: str.length * 6,
  height: 12,
  fontName: "F1",
})

/** A page of text, a line per entry, as pdf.js reads it: a line at a time. */
const page = (lines: string[]) => ({
  view: [0, 0, 612, 792],
  streamTextContent: () =>
    new ReadableStream({
      start(controller) {
        lines.forEach((line, index) => controller.enqueue({ items: [textItem(line, index)] }))
        controller.close()
      },
    }),
  getOperatorList: async () => ({}),
  commonObjs: { get: () => ({ name: "Helvetica" }) },
  getAnnotations: async () => [],
})
const RESUME_PAGE = page(["Mara Lin", "mara@example.com", "EDUCATION", "State University", "B.S. in Biology"])

let openResumeFile: typeof import("./open").openResumeFile
let OpenFileError: typeof import("./open").OpenFileError
let downloads: number
let failures: number
// Each page of the PDF opened, or a promise for one that's slow to read.
let pages: (ReturnType<typeof page> | Promise<ReturnType<typeof page>>)[]
let pagesRead: number
// What's attached to the PDF; null for a PDF from another app.
let attachment: string | null
// Each PDF opened, and whether it's been closed.
let opened: { closed: boolean }[]
// Holds back pdf.js's download until it resolves.
let download: Promise<void>
// Holds back the workers' answers, once they've done their work, until it resolves.
let answer: Promise<void>
let workers: FakeWorker[]

/**
 * Stands in for the import worker: does its job here, and answers unless it's
 * been ended by then, as a real worker can't answer once it's ended.
 */
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror = null
  onmessageerror = null
  started = false
  answered = false
  ended = false

  constructor() {
    workers.push(this)
  }

  postMessage(request: ReadRequest) {
    this.started = true
    void readFile(request).then(async (data) => {
      await answer
      if (this.ended) return
      this.answered = true
      this.onmessage?.({ data })
    })
  }

  terminate() {
    this.ended = true
  }
}

// A fresh page each time, with nothing downloaded yet. pdf.js is stood in
// for: each import of it counts as a download, and the first `failures` of
// them fail as on a dropped connection. Every PDF is a resumezip PDF with
// `attachment` attached, a copy of `resume`, unless a test changes them.
beforeEach(async () => {
  downloads = 0
  failures = 0
  pages = [RESUME_PAGE]
  pagesRead = 0
  attachment = toAttachment(resume)
  opened = []
  download = Promise.resolve()
  answer = Promise.resolve()
  workers = []
  vi.stubGlobal("Worker", FakeWorker)
  vi.resetModules()
  vi.doMock("pdfjs-dist", async () => {
    downloads++
    await download
    if (failures > 0) {
      failures--
      throw new TypeError("Failed to fetch dynamically imported module")
    }
    return {
      GlobalWorkerOptions: {},
      getDocument: () => {
        const file = { closed: false }
        opened.push(file)
        const doc = {
          numPages: pages.length,
          getAttachments: async () =>
            attachment === null ? null : { [ATTACHMENT_NAME]: { content: new TextEncoder().encode(attachment) } },
          getPage: async (number: number) => {
            pagesRead++
            return pages[number - 1]
          },
        }
        return {
          promise: Promise.resolve(doc),
          destroy: async () => {
            file.closed = true
          },
        }
      },
    }
  })
  ;({ openResumeFile, OpenFileError } = await import("./open"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("a resumezip PDF", () => {
  test("restores its resume, and is closed", async () => {
    await expect(openResumeFile(pdf())).resolves.toEqual({ kind: "resumezip", resume: cleanResume(resume), title: "Mara Lin", from: "pdf" })
    expect(opened).toEqual([{ closed: true }])
    expect(workers).toEqual([])
  })

  test("too long to open says so, instead of opening with parts cut off", async () => {
    attachment = JSON.stringify({
      format: "resumezip",
      version: 1,
      resume: { ...resume, profileSection: { fullName: "x".repeat(MAX_LENGTH) } },
    })
    const opening = openResumeFile(pdf())
    await expect(opening).rejects.toThrow(OpenFileError)
    await expect(opening).rejects.toThrow(
      "This resume is longer than resumezip can open (more than 10,000 entries or 10,000,000 characters).",
    )
    expect(opened).toEqual([{ closed: true }])
  })

  test.each([
    ['{"format":"resumezip","version":99,"resume":{}}', "newer version"],
    ['{"format":"resumezip","version":2,"resume":{"extraSections":{"summary":{"kind":"summary","text":"secret"}}}}', "damaged"],
    ['{"format":"resumezip",', "damaged"],
  ])("a recognized unusable attachment stops opening without a heuristic fallback", async (content, message) => {
    attachment = content
    await expect(openResumeFile(pdf())).rejects.toThrow(OpenFileError)
    await expect(openResumeFile(pdf())).rejects.toThrow(message)
    expect(pagesRead).toBe(0)
    expect(workers).toEqual([])
    expect(opened.every((doc) => doc.closed)).toBe(true)
  })
})

describe("a PDF from another app", () => {
  beforeEach(() => {
    attachment = null
  })

  test("is sorted into fields in a worker, which is ended, and stays open for the review", async () => {
    const file = await openResumeFile(pdf())
    expect(file).toMatchObject({
      kind: "parsed",
      title: "Mara Lin",
      fileName: "Mara Lin.pdf",
      pdf: { pages: [{ width: 612, height: 792 }] },
    })
    expect(file.kind === "parsed" && file.parsed.profile).toMatchObject({ fullName: "Mara Lin", email: "mara@example.com" })
    expect(workers.map((worker) => worker.ended)).toEqual([true])
    expect(opened).toEqual([{ closed: false }])
  })

  test(`over ${MAX_PAGES} pages says so before reading any`, async () => {
    pages = Array.from({ length: MAX_PAGES + 1 }, () => RESUME_PAGE)
    await expect(openResumeFile(pdf())).rejects.toThrow(
      new OpenFileError(`This PDF has ${MAX_PAGES + 1} pages, too many for a resume. Open one with ${MAX_PAGES} pages or fewer.`),
    )
    expect(pagesRead).toBe(0)
    expect(opened).toEqual([{ closed: true }])
    expect(workers).toEqual([])
  })

  test(`of ${MAX_PAGES} pages opens`, async () => {
    pages = Array.from({ length: MAX_PAGES }, () => RESUME_PAGE)
    await expect(openResumeFile(pdf())).resolves.toMatchObject({ kind: "parsed" })
    expect(pagesRead).toBe(MAX_PAGES)
  })

  test("with too much text stops reading at the page that goes over", async () => {
    pages = [RESUME_PAGE, page(["x".repeat(MAX_CHARACTERS)]), RESUME_PAGE]
    await expect(openResumeFile(pdf())).rejects.toThrow(new OpenFileError("This file has too much text to be a resume."))
    expect(pagesRead).toBe(2)
    expect(opened).toEqual([{ closed: true }])
    expect(workers).toEqual([])
  })

  test("with endless text stops reading partway through the page", async () => {
    let lines = 0
    const endless = new ReadableStream({
      pull(controller) {
        // Gives up eventually, so reading that doesn't stop fails the test rather than hanging it.
        if (lines > (10 * MAX_CHARACTERS) / 1000) controller.error(new Error("Kept reading"))
        else controller.enqueue({ items: [textItem("x".repeat(1000), lines++ % 40)] })
      },
    })
    pages = [{ ...RESUME_PAGE, streamTextContent: () => endless }]
    await expect(openResumeFile(pdf())).rejects.toThrow(new OpenFileError("This file has too much text to be a resume."))
    // The line that went over, and the few pdf.js had sent ahead.
    expect(lines).toBeGreaterThan(MAX_CHARACTERS / 1000)
    expect(lines).toBeLessThan(MAX_CHARACTERS / 1000 + 5)
    expect(opened).toEqual([{ closed: true }])
  })

  test("with no text says it's probably a scan, and is closed", async () => {
    pages = [page([])]
    await expect(openResumeFile(pdf())).rejects.toThrow(
      new OpenFileError("This PDF has no text we can read. It's probably a scan or a picture of a resume."),
    )
    expect(opened).toEqual([{ closed: true }])
    expect(workers.map((worker) => worker.ended)).toEqual([true])
  })

  test("is closed when a page can't be read", async () => {
    const bad = new ReadableStream({ start: (controller) => controller.error(new Error("Bad page")) })
    pages = [RESUME_PAGE, { ...RESUME_PAGE, streamTextContent: () => bad }]
    await expect(openResumeFile(pdf())).rejects.toThrow("Bad page")
    expect(opened).toEqual([{ closed: true }])
  })
})

describe("cancelling", () => {
  beforeEach(() => {
    attachment = null
  })

  test("stops reading pages straight away and closes the PDF", async () => {
    pages = [RESUME_PAGE, never, RESUME_PAGE]
    const cancel = new AbortController()
    const opening = openResumeFile(pdf(), { signal: cancel.signal })
    await vi.waitFor(() => expect(pagesRead).toBe(2))
    cancel.abort()
    expect(await failure(opening)).toBe("AbortError")
    expect(pagesRead).toBe(2)
    expect(opened).toEqual([{ closed: true }])
    expect(workers).toEqual([])
  })

  test("ends the worker while it's sorting the text, so its answer never comes", async () => {
    let finish!: () => void
    answer = new Promise((resolve) => (finish = resolve))
    const cancel = new AbortController()
    const opening = openResumeFile(pdf(), { signal: cancel.signal })
    await vi.waitFor(() => expect(workers.map((worker) => worker.started)).toEqual([true]))
    cancel.abort()
    expect(await failure(opening)).toBe("AbortError")

    finish()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(workers.map(({ ended, answered }) => ({ ended, answered }))).toEqual([{ ended: true, answered: false }])
    expect(opened).toEqual([{ closed: true }])
  })

  test("while pdf.js downloads means the PDF is never opened", async () => {
    let finishDownload!: () => void
    download = new Promise((resolve) => (finishDownload = resolve))
    const cancel = new AbortController()
    const opening = openResumeFile(pdf(), { signal: cancel.signal })
    await vi.waitFor(() => expect(downloads).toBe(1))
    cancel.abort()
    expect(await failure(opening)).toBe("AbortError")
    finishDownload()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(opened).toEqual([])
  })

  test("leaves the next file to open as usual", async () => {
    pages = [never]
    const cancel = new AbortController()
    const opening = openResumeFile(pdf(), { signal: cancel.signal })
    await vi.waitFor(() => expect(pagesRead).toBe(1))
    cancel.abort()
    expect(await failure(opening)).toBe("AbortError")

    pages = [RESUME_PAGE]
    await expect(openResumeFile(pdf())).resolves.toMatchObject({ kind: "parsed" })
    expect(opened).toEqual([{ closed: true }, { closed: false }])
  })
})

test(`reading stops after ${TIME_LIMIT_MS / 1000} seconds`, async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  attachment = null
  pages = [never]
  const opening = openResumeFile(pdf())
  const failed = expect(opening).rejects.toThrow(
    new OpenFileError("This file took too long to read. Try a PDF or Word copy of just your resume."),
  )
  await vi.advanceTimersByTimeAsync(TIME_LIMIT_MS)
  await failed
  expect(opened).toEqual([{ closed: true }])
})

describe("a Word file", () => {
  const docx = (data: Uint8Array) =>
    new File([new Uint8Array(data)], "Mara Lin.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
  // A Word file from resumezip with `attachment` in it, its text and links unchanged since.
  const document = "<w:document/>"
  const relationships = "<Relationships/>"
  const crc = (text: string) => crc32(new TextEncoder().encode(text))
  const carrying = (attachment: object) =>
    zip({
      "word/document.xml": document,
      "word/_rels/document.xml.rels": relationships,
      [ATTACHMENT_NAME]: JSON.stringify({ ...attachment, documentCrc32: crc(document), relationshipsCrc32: crc(relationships) }),
    })

  test("that resumezip made restores its resume, without reading its text", async () => {
    await expect(openResumeFile(docx(toWordFile(resume)))).resolves.toEqual({
      kind: "resumezip",
      resume: cleanResume(resume),
      title: "Mara Lin",
      from: "docx",
    })
    expect(workers).toEqual([])
    expect(downloads).toBe(0)
  })

  test("that resumezip made, whose text another app has changed since, is read for its text", async () => {
    const made = toWordFile(resume)
    const files = Object.fromEntries(
      (zipDirectory(made.buffer) as ZipEntry[]).map((entry) => [entry.name, storedFile(made.buffer, entry)!]),
    )
    // Another app changed the name, and kept the attachment as it was.
    const text = new TextDecoder().decode(files["word/document.xml"]).replace("Mara Lin", "Mara Lin-Chen")
    const changed = zip({ ...files, "word/document.xml": text })
    const file = await openResumeFile(docx(changed))
    expect(file.kind === "parsed" && file.parsed.profile.fullName).toBe("Mara Lin-Chen")
    expect(workers.map((worker) => worker.ended)).toEqual([true])
  })

  test("that resumezip made, with its resume damaged or from a newer resumezip, says so", async () => {
    await expect(openResumeFile(docx(carrying({ format: "resumezip", version: 2, resume: "nope" })))).rejects.toThrow(
      new OpenFileError("The resume data in this Word file is damaged. Try another saved Word file."),
    )
    await expect(openResumeFile(docx(carrying({ format: "resumezip", version: 3, resume: {} })))).rejects.toThrow(
      new OpenFileError("This Word file needs a newer resumezip. Refresh the app and try again, or open it with a newer version."),
    )
    expect(workers).toEqual([])
  })

  test("is read in a worker, without pdf.js", async () => {
    const file = await openResumeFile(docx(wordFile(["Mara Lin", "mara@example.com", "Education", "State University"])))
    expect(file.kind === "parsed" && file.parsed.profile).toMatchObject({ fullName: "Mara Lin", email: "mara@example.com" })
    expect(workers.map((worker) => worker.ended)).toEqual([true])
    expect(downloads).toBe(0)
  })

  test("that unzips to too much text says so", async () => {
    await expect(openResumeFile(docx(wordFile(["Mara Lin"], { padding: 11 * 1024 * 1024 })))).rejects.toThrow(
      new OpenFileError("This file has too much text to be a resume."),
    )
  })

  test("that isn't one says so", async () => {
    await expect(openResumeFile(docx(Buffer.from("not a zip")))).rejects.toThrow(
      new OpenFileError("We couldn't read this Word file. Try saving it as a PDF and opening that."),
    )
  })
})

describe("a JSON file", () => {
  const json = (text: string, name = "Mara Lin.json") => new File([text], name, { type: "application/json" })
  const saved = { ...resume, id: "mara", updatedAt: "2026-10-06T12:00:00.000Z" }

  test("of a resume restores it, named and tagged as it was, without pdf.js", async () => {
    const file = json(toJson({ ...saved, resumeTitle: "Mara at Google", resumeTag: "professional" }), "backup.json")
    await expect(openResumeFile(file)).resolves.toEqual({
      kind: "resumezip",
      resume: { ...cleanResume(saved), extraSections: {} },
      title: "Mara at Google",
      tag: "professional",
      from: "json",
    })
    expect(downloads).toBe(0)
    expect(workers).toEqual([])
  })

  test("without a name is named after the file, as a PDF is", async () => {
    await expect(openResumeFile(json(toAttachment(saved)))).resolves.toMatchObject({ title: "Mara Lin", from: "json" })
  })

  test("of every resume has them all", async () => {
    const all = await openResumeFile(json(toJsonOfAll([saved, { ...saved, id: "ada" }]), "resumezip-resumes.json"))
    expect(all.kind === "all" && all.resumes.map((file) => file.resume.id)).toEqual(["mara", "ada"])
    // One resume in it opens as that resume.
    await expect(openResumeFile(json(toJsonOfAll([saved])))).resolves.toMatchObject({ kind: "resumezip", from: "json" })
  })

  test.each([
    [
      JSON.stringify({ basics: { name: "Mara Lin" } }),
      "This JSON file isn't from resumezip. Open one you downloaded here, or a PDF or Word file.",
    ],
    ["not json", "This JSON file isn't from resumezip."],
    ['{"format":"resumezip","version":2,"resumes":[]}', "There are no resumes in this file."],
    ['{"format":"resumezip","version":2,"resume":[]}', "The resume data in this file is damaged. Try another saved file."],
    ['{"format":"resumezip","version":9,"resume":{}}', "This file needs a newer resumezip."],
    [
      JSON.stringify({ format: "resumezip", version: 2, resume: { notes: "x".repeat(MAX_LENGTH) } }),
      "This file is longer than resumezip can open (more than 1,000 resumes, 10,000 entries in one, or 10,000,000 characters).",
    ],
  ])("that can't be opened says why: %#", async (text, message) => {
    const opening = openResumeFile(json(text))
    await expect(opening).rejects.toThrow(OpenFileError)
    await expect(opening).rejects.toThrow(message)
  })

  test("is known by its name, or by its type", async () => {
    await expect(openResumeFile(new File([toAttachment(saved)], "Mara Lin.JSON"))).resolves.toMatchObject({ kind: "resumezip" })
    await expect(openResumeFile(json(toAttachment(saved), "Mara Lin"))).resolves.toMatchObject({ kind: "resumezip" })
    await expect(openResumeFile(new File(["{}"], "Mara Lin.txt"))).rejects.toThrow(
      "Open a PDF, a Word (.docx) file, or a JSON file from resumezip.",
    )
  })
})

describe("downloading pdf.js", () => {
  test("a failed download is tried again for the next PDF", async () => {
    failures = 1
    await expect(openResumeFile(pdf())).rejects.toThrow()
    await expect(openResumeFile(pdf())).resolves.toEqual({ kind: "resumezip", resume: cleanResume(resume), title: "Mara Lin", from: "pdf" })
    expect(downloads).toBe(2)
  })

  test("PDFs opened at the same time share one download, and later ones reuse it", async () => {
    await Promise.all([openResumeFile(pdf()), openResumeFile(pdf())])
    await openResumeFile(pdf())
    expect(downloads).toBe(1)
  })
})

describe("reading in a worker", () => {
  const request: ReadRequest = { kind: "pdf", pages: [] }
  const signal = () => new AbortController().signal

  test("ends each worker once it answers, unless asked to keep it for the next reading that keeps one", async () => {
    const { readInWorker } = await import("./open")
    await readInWorker(request, signal())
    expect(workers.map((worker) => worker.ended)).toEqual([true])
    // The checker reads each new preview: one worker does them all.
    await readInWorker(request, signal(), { keep: true })
    await readInWorker(request, signal(), { keep: true })
    expect(workers.map((worker) => worker.ended)).toEqual([true, false])
  })

  test("ends a kept worker that's stopped, and starts another for the next reading", async () => {
    const { readInWorker } = await import("./open")
    await readInWorker(request, signal(), { keep: true })
    // A newer preview stops this reading before the worker answers.
    answer = new Promise(() => {})
    const stopped = new AbortController()
    const reading = readInWorker(request, stopped.signal, { keep: true })
    stopped.abort(new Error("A newer preview"))
    await expect(reading).rejects.toThrow("A newer preview")
    expect(workers.map((worker) => worker.ended)).toEqual([true])
    answer = Promise.resolve()
    await readInWorker(request, signal(), { keep: true })
    expect(workers.map((worker) => worker.ended)).toEqual([true, false])
  })
})
