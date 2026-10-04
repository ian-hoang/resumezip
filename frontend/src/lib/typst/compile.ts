// Compiles resumes to PDF in the browser. The Typst compiler (and its ~7 MB
// WebAssembly download) is only loaded the first time a resume is compiled.

import { toAttachment } from "@/lib/resumeFile"
import { templateIdOf, toTemplateData, type TemplateData, type TemplateId } from "./resumeData"

export interface CompileRequest {
  id: number
  template: TemplateId
  data: TemplateData
  /** A copy of the resume to attach to the PDF (see lib/resumeFile.ts). */
  attachment?: string
}

export type CompileResponse = { id: number; pdf: Uint8Array } | { id: number; error: string }

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (pdf: Uint8Array) => void; reject: (error: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker

  worker = new Worker(new URL("./typst.worker.ts", import.meta.url))
  worker.onmessage = ({ data }: MessageEvent<CompileResponse>) => {
    const request = pending.get(data.id)
    pending.delete(data.id)
    if ("pdf" in data) request?.resolve(data.pdf)
    else request?.reject(new Error(data.error))
  }
  worker.onerror = (event) => {
    // The worker itself broke: fail everything in flight and start a fresh
    // worker on the next request.
    for (const { reject } of pending.values()) reject(new Error(event.message || "The Typst worker failed"))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

interface CompileOptions {
  /** Attach a copy of the resume so resumezip can open the PDF again. Downloads do; previews don't need to. */
  attach?: boolean
}

/** Compiles a resume, in the editor's format, to PDF bytes. */
export function compileResume(resume: Record<string, any>, { attach = false }: CompileOptions = {}): Promise<Uint8Array> {
  const request: CompileRequest = {
    id: nextId++,
    template: templateIdOf(resume.selectedTemplate),
    data: toTemplateData(resume),
    attachment: attach ? toAttachment(resume) : undefined,
  }
  return new Promise((resolve, reject) => {
    pending.set(request.id, { resolve, reject })
    getWorker().postMessage(request)
  })
}

/** Compiles a resume and returns an object URL for the PDF. Revoke it when done. */
export async function compileResumeUrl(resume: Record<string, any>, options?: CompileOptions): Promise<string> {
  const pdf = await compileResume(resume, options)
  return URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }))
}

/** Compiles a resume and saves it as "<title>.pdf", with the resume attached. */
export async function downloadResume(resume: Record<string, any>): Promise<void> {
  const url = await compileResumeUrl(resume, { attach: true })
  const link = document.createElement("a")
  link.href = url
  link.download = `${resume.resumeTitle?.trim() || "resume"}.pdf`
  link.click()
  // Give the browser time to start the download before freeing the PDF.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
