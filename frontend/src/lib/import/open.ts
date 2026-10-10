// Opens a resume file someone picked or dropped, entirely in the browser. A
// PDF or Word file that resumezip made carries its resume (see
// lib/resumeFile.ts) and is restored exactly, as is a JSON file it saved;
// anything else is read and sorted into fields by parse.ts, in a worker
// (read.ts). Reading stops at the limits in limits.ts, when it's cancelled or
// when it runs out of time, and shuts down whatever it started.

import type { PDFDocumentProxy } from "pdfjs-dist"
import type { ResumeContent } from "@/lib/resume"
import {
  ATTACHMENT_NAME,
  AttachmentError,
  fromAttachment,
  fromJson,
  MAX_ENTRIES,
  MAX_LENGTH,
  MAX_RESUMES,
  TooLongError,
  WORD_DOCUMENT,
  type FileResume,
} from "@/lib/resumeFile"
import { storedFile, zipDirectory } from "@/lib/zip"
import { MAX_BYTES, MAX_PAGES, TIME_LIMIT_MS, TooMuchTextError } from "./limits"
import { readPdf, type Line, type PageSize, type PdfPage } from "./lines"
import type { ParsedResume } from "./parse"
import type { ReadRequest, ReadResult } from "./read"

export type OpenedFile =
  | {
      kind: "resumezip"
      resume: ResumeContent
      title: string
      /** Its tag in the list, from a JSON file that has one. */
      tag?: string
      /** A JSON file has everything; a PDF or Word file has only what it prints. */
      from: "pdf" | "docx" | "json"
    }
  /** A JSON file of several resumes, from "Download all". */
  | { kind: "all"; resumes: FileResume[] }
  | {
      kind: "parsed"
      parsed: ParsedResume
      lines: Line[]
      title: string
      fileName: string
      /** The PDF itself, for showing it beside what was found. Absent for Word files. */
      pdf?: { doc: PDFDocumentProxy; pages: PageSize[] }
    }

/** A problem with the file, worded for the person who picked it. */
export class OpenFileError extends Error {}

const TOO_MUCH_TEXT = "This file has too much text to be a resume."

let pdfjs: Promise<typeof import("pdfjs-dist")> | null = null

// pdf.js (and its worker) only download when a PDF is opened. A failed
// download (e.g. a network error) is forgotten, so the next PDF retries it.
export function loadPdfjs() {
  pdfjs ??= import("pdfjs-dist")
    .then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
      return module
    })
    .catch((error) => {
      pdfjs = null
      throw error
    })
  return pdfjs
}

function kindOf(file: File): "pdf" | "docx" | "json" | null {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return "pdf"
  if (/\.docx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx"
  if (/\.json$/i.test(file.name) || file.type === "application/json") return "json"
  return null
}

/** Waits for `promise`, or stops waiting as soon as `signal` aborts. */
export function until<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason)
    signal.addEventListener("abort", stop, { once: true })
    if (signal.aborted) stop()
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop))
  })
}

// A worker that answered a reading that asked to keep it, idle until the next one does.
let spare: Worker | null = null

/**
 * Reads in a worker of its own, which is ended once it answers, or as soon as
 * `signal` aborts. With `keep`, a worker that answered is kept for the next
 * reading with `keep`, instead of starting one each time, as the checker does
 * with each new preview (lib/check/preview.ts). One that's stopped or fails
 * is ended all the same.
 */
export function readInWorker(request: ReadRequest, signal: AbortSignal, { keep = false } = {}): Promise<ReadResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const worker = (keep && spare) || new Worker(new URL("./import.worker.ts", import.meta.url))
    if (worker === spare) spare = null
    const end = (settle: () => void, answered = false) => {
      signal.removeEventListener("abort", stop)
      worker.onmessage = worker.onerror = worker.onmessageerror = null
      if (keep && answered && !spare) spare = worker
      else worker.terminate()
      settle()
    }
    const stop = () => end(() => reject(signal.reason))
    signal.addEventListener("abort", stop, { once: true })
    worker.onmessage = ({ data }: MessageEvent<ReadResult>) => end(() => resolve(data), true)
    worker.onerror = (event) => end(() => reject(new Error(event.message || "The import worker failed")))
    worker.onmessageerror = () => end(() => reject(new Error("The import worker's answer couldn't be read")))
    try {
      worker.postMessage(request, request.kind === "docx" ? [request.data] : [])
    } catch (error) {
      end(() => reject(error))
    }
  })
}

/** The resume found, or the problem, worded for the person who picked the file. */
function found(result: ReadResult, noText: string): ParsedResume {
  if ("parsed" in result) return result.parsed
  if ("failed" in result) throw new Error(result.failed)
  throw new OpenFileError(
    result.problem === "too much text"
      ? TOO_MUCH_TEXT
      : result.problem === "no text"
        ? noText
        : "We couldn't read this Word file. Try saving it as a PDF and opening that.",
  )
}

const most = (count: number) => count.toLocaleString("en-US")

/** Reads a resumezip file's text with `read`, with any problem worded for the person who picked the file. */
function readSaved<T>(read: () => T, kind: "pdf" | "docx" | "json"): T {
  try {
    return read()
  } catch (error) {
    if (error instanceof AttachmentError) throw new OpenFileError(error.message)
    if (!(error instanceof TooLongError)) throw error
    throw new OpenFileError(
      kind !== "json"
        ? `This resume is longer than resumezip can open (more than ${most(MAX_ENTRIES)} entries or ${most(MAX_LENGTH)} characters).`
        : `This file is longer than resumezip can open (more than ${most(MAX_RESUMES)} resumes, ${most(MAX_ENTRIES)} entries in one, or ${most(MAX_LENGTH)} characters).`,
    )
  }
}

/** The resume a resumezip PDF carries, or null for a PDF from anywhere else. */
async function attachedResume(doc: PDFDocumentProxy, signal: AbortSignal): Promise<ResumeContent | null> {
  const attachments = (await until(
    doc.getAttachments().catch(() => null),
    signal,
  )) as Record<string, { content: Uint8Array }> | null
  const attached = attachments?.[ATTACHMENT_NAME]
  return attached ? readSaved(() => fromAttachment(new TextDecoder().decode(attached.content)), "pdf") : null
}

async function openPdf(data: ArrayBuffer, title: string, fileName: string, signal: AbortSignal): Promise<OpenedFile> {
  const { getDocument } = await until(loadPdfjs(), signal)
  const task = getDocument({ data: new Uint8Array(data), isEvalSupported: false, fontExtraProperties: true })
  // Closing the document ends pdf.js's worker, which stops whatever it's reading.
  const close = () => void task.destroy().catch(() => {})
  signal.addEventListener("abort", close, { once: true })
  let shown = false
  try {
    let doc: PDFDocumentProxy
    try {
      doc = await until(task.promise, signal)
    } catch (error) {
      signal.throwIfAborted()
      throw new OpenFileError(
        (error as { name?: string })?.name === "PasswordException"
          ? "This PDF is password-protected. Remove the password, then open it here."
          : "This file isn't a PDF we can read.",
      )
    }

    const resume = await attachedResume(doc, signal)
    if (resume) return { kind: "resumezip", resume, title, from: "pdf" }

    if (doc.numPages > MAX_PAGES) {
      throw new OpenFileError(`This PDF has ${doc.numPages} pages, too many for a resume. Open one with ${MAX_PAGES} pages or fewer.`)
    }
    let pages: PdfPage[]
    try {
      pages = await until(readPdf(doc, signal), signal)
    } catch (error) {
      throw error instanceof TooMuchTextError ? new OpenFileError(TOO_MUCH_TEXT) : error
    }
    const result = await readInWorker({ kind: "pdf", pages }, signal)
    const parsed = found(result, "This PDF has no text we can read. It's probably a scan or a picture of a resume.")
    shown = true
    return {
      kind: "parsed",
      parsed,
      lines: parsed.lines,
      title,
      fileName,
      pdf: { doc, pages: pages.map(({ width, height }) => ({ width, height })) },
    }
  } finally {
    signal.removeEventListener("abort", close)
    // The review shows the PDF, and closes it when it's done.
    if (!shown) close()
  }
}

/** A JSON file resumezip saved: one resume, named as it was if the file says, or all of them. */
function openJson(data: ArrayBuffer, title: string): OpenedFile {
  const resumes = readSaved(() => fromJson(new TextDecoder().decode(data)), "json")
  if (!resumes) throw new OpenFileError("This JSON file isn't from resumezip. Open one you downloaded here, or a PDF or Word file.")
  if (resumes.length === 0) throw new OpenFileError("There are no resumes in this file.")
  if (resumes.length > 1) return { kind: "all", resumes }
  const [{ resume, title: saved, tag }] = resumes
  return { kind: "resumezip", resume, title: saved ?? title, ...(tag && { tag }), from: "json" }
}

/**
 * The resume a resumezip Word file carries (see lib/word.ts), or null for a
 * Word file from anywhere else. Null too once another app has changed its
 * text, or zipped the file again compressed: resumezip leaves it uncompressed.
 */
export function wordFileResume(data: ArrayBuffer): ResumeContent | null {
  const files = zipDirectory(data)
  if (!Array.isArray(files)) return null
  const document = files.find((file) => file.name === WORD_DOCUMENT)
  const attached = files.find((file) => file.name === ATTACHMENT_NAME)
  const contents = document && attached && storedFile(data, attached)
  if (!document || !contents) return null
  return readSaved(() => fromAttachment(new TextDecoder().decode(contents), "Word file", { documentCrc32: document.crc }), "docx")
}

/** A Word file: resumezip's own is restored as it was; any other is read for its text. */
async function openWordFile(data: ArrayBuffer, title: string, fileName: string, signal: AbortSignal): Promise<OpenedFile> {
  const resume = wordFileResume(data)
  if (resume) return { kind: "resumezip", resume, title, from: "docx" }
  const parsed = found(await readInWorker({ kind: "docx", data }, signal), "This Word file has no text in it.")
  return { kind: "parsed", parsed, lines: parsed.lines, title, fileName }
}

/**
 * Opens a file. Aborting `signal` (Cancel) stops reading straight away, and
 * the promise rejects with its reason.
 */
export async function openResumeFile(file: File, { signal }: { signal?: AbortSignal } = {}): Promise<OpenedFile> {
  const kind = kindOf(file)
  if (!kind) {
    throw new OpenFileError(
      /\.doc$/i.test(file.name)
        ? "That's an older Word file. Save it as .docx or PDF, then open it here."
        : "Open a PDF, a Word (.docx) file, or a JSON file from resumezip.",
    )
  }
  if (file.size > MAX_BYTES) throw new OpenFileError("That file is too big to be a resume.")
  const title = file.name.replace(/\.(pdf|docx|json)$/i, "").trim() || "Imported resume"

  // Stops on Cancel, or once time runs out.
  const reading = new AbortController()
  const cancel = () => reading.abort(signal?.reason)
  signal?.addEventListener("abort", cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(
    () => reading.abort(new OpenFileError("This file took too long to read. Try a PDF or Word copy of just your resume.")),
    TIME_LIMIT_MS,
  )
  try {
    const data = await until(file.arrayBuffer(), reading.signal)
    if (kind === "json") return openJson(data, title)
    return kind === "docx"
      ? await openWordFile(data, title, file.name, reading.signal)
      : await openPdf(data, title, file.name, reading.signal)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", cancel)
  }
}
