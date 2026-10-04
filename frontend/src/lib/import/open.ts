// Opens a resume file someone picked or dropped, entirely in the browser. A
// PDF that resumezip made carries its resume (see lib/resumeFile.ts) and is
// restored exactly; anything else is read and sorted into fields by parse.ts.

import type { PDFDocumentProxy } from "pdfjs-dist"
import { ATTACHMENT_NAME, fromAttachment, type ResumeContent } from "@/lib/resumeFile"
import { linesFromDocx, linesFromPdf, type Line, type PageSize } from "./lines"
import { parseResume, type ParsedResume } from "./parse"

export type OpenedFile =
  | { kind: "resumezip"; resume: ResumeContent; title: string }
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

const MAX_BYTES = 20 * 1024 * 1024

let pdfjs: Promise<typeof import("pdfjs-dist")> | null = null

// pdf.js (and its worker) only download when a PDF is opened.
function loadPdfjs() {
  pdfjs ??= import("pdfjs-dist").then((module) => {
    module.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
    return module
  })
  return pdfjs
}

function kindOf(file: File): "pdf" | "docx" | null {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return "pdf"
  if (/\.docx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx"
  return null
}

export async function openResumeFile(file: File): Promise<OpenedFile> {
  const kind = kindOf(file)
  if (!kind) {
    throw new OpenFileError(/\.doc$/i.test(file.name) ? "That's an older Word file. Save it as .docx or PDF, then open it here." : "Open a PDF or a Word (.docx) file.")
  }
  if (file.size > MAX_BYTES) throw new OpenFileError("That file is too big to be a resume.")
  const title = file.name.replace(/\.(pdf|docx)$/i, "").trim() || "Imported resume"
  const data = await file.arrayBuffer()

  if (kind === "docx") {
    let lines: Line[]
    try {
      lines = await linesFromDocx({ arrayBuffer: data })
    } catch {
      throw new OpenFileError("We couldn't read this Word file. Try saving it as a PDF and opening that.")
    }
    if (lines.length === 0) throw new OpenFileError("This Word file has no text in it.")
    const parsed = parseResume(lines)
    return { kind: "parsed", parsed, lines: parsed.lines, title, fileName: file.name }
  }

  const { getDocument } = await loadPdfjs()
  let doc: PDFDocumentProxy
  try {
    doc = await getDocument({ data: new Uint8Array(data), isEvalSupported: false, fontExtraProperties: true }).promise
  } catch (error) {
    throw new OpenFileError(
      (error as { name?: string })?.name === "PasswordException"
        ? "This PDF is password-protected. Remove the password, then open it here."
        : "This file isn't a PDF we can read.",
    )
  }

  const attachments = (await doc.getAttachments().catch(() => null)) as Record<string, { content: Uint8Array }> | null
  const attached = attachments?.[ATTACHMENT_NAME]
  const resume = attached ? fromAttachment(new TextDecoder().decode(attached.content)) : null
  if (resume) {
    await doc.destroy()
    return { kind: "resumezip", resume, title }
  }

  const { lines, pages } = await linesFromPdf(doc)
  if (lines.length === 0) {
    await doc.destroy()
    throw new OpenFileError("This PDF has no text we can read. It's probably a scan or a picture of a resume.")
  }
  const parsed = parseResume(lines)
  return { kind: "parsed", parsed, lines: parsed.lines, title, fileName: file.name, pdf: { doc, pages } }
}
