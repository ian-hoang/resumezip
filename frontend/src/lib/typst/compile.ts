// Compiles resumes to PDF in the browser. The Typst compiler (and its large
// WebAssembly download) is only loaded once a resume is about to be compiled
// (loadCompiler), or the first time one is.

import type { Resume } from "@/lib/resume"
import { toAttachment } from "@/lib/resumeFile"
import { fileNameOf } from "@/lib/saveFile"
import type { Fit, PrintedTune } from "@/lib/tune"
import { COMPILER_CDN_URL } from "./compilerSource"
import { templateIdOf, toTemplateData, type TemplateData, type TemplateId } from "./resumeData"

/** What a resume prints: its template and the data the template reads. Renaming a resume doesn't change it. */
export interface Printed {
  template: TemplateId
  data: TemplateData
}

/** What a resume, in the editor's format, prints. */
export const printedOf = (resume: Resume): Printed => ({
  template: templateIdOf(resume.selectedTemplate),
  data: toTemplateData(resume),
})

export interface CompileRequest extends Printed {
  id: number
  /** A copy of the resume to attach to the PDF (see lib/resumeFile.ts). */
  attachment?: string
}

/**
 * Why a PDF couldn't be made, which decides what the user is told to do:
 * - `connection`: the compiler or its fonts couldn't be downloaded, or stopped arriving.
 * - `resume`: Typst couldn't lay out this resume with its template.
 * - `crash`: the compiler broke or got stuck. The next request gets a fresh one.
 */
export type PdfFailure = "connection" | "resume" | "crash"

export class PdfError extends Error {
  constructor(
    message: string,
    readonly failure: PdfFailure,
  ) {
    super(message)
  }
}

/** A preview replaced by a newer one, or withdrawn, before it started, so it was never compiled. */
export class Superseded extends Error {
  constructor() {
    super("This preview was no longer needed")
    this.name = "Superseded"
  }
}

/** Why making a PDF failed, from what compileResume threw. */
export const failureOf = (error: unknown): PdfFailure => (error instanceof PdfError ? error.failure : "crash")

/**
 * A PDF, and, for a resume that asks to be kept to one page, what that took
 * (see fitOnePage in lib/tune.ts).
 */
interface Compiled {
  pdf: Uint8Array
  fit?: Fit
}

export type CompileResponse = ({ id: number } & Compiled) | { id: number; error: string; failure: PdfFailure }

/**
 * What the page sends the worker: a resume to compile; word to start
 * loading the compiler, and the fonts of the template likely to come first,
 * before one comes; or word to only download the compiler, for a later load.
 */
export type WorkerRequest = CompileRequest | { load: true; template?: TemplateId } | { prefetch: true }

/**
 * What the worker sends: an answer; word that it's getting on, with the share
 * of the compiler that has downloaded so far; or whether the compiler loaded.
 */
export type WorkerMessage = CompileResponse | { progress: true; downloaded: number } | { ready: boolean }

/** How far the compiler has got, for the preview to show while it waits. `downloaded` is the share of it that has arrived. */
export interface CompilerStatus {
  loaded: boolean
  downloaded: number
}

// The worker is taken to be stuck when it has work and goes this long without
// sending anything. While the compiler downloads, each bit that arrives
// counts, so a slow connection keeps going and a stalled one gives up. Time
// spent waiting behind other requests doesn't count against any of them.
const LOADING_MS = 30_000
const COMPILING_MS = 20_000

let worker: Worker | null = null
// Whether the current worker's compiler has loaded, and how much of it has arrived.
let status: CompilerStatus = { loaded: false, downloaded: 0 }
const statusListeners = new Set<() => void>()
let watchdog: ReturnType<typeof setTimeout> | undefined
let nextId = 0
const pending = new Map<number, { resolve: (compiled: Compiled) => void; reject: (error: Error) => void }>()

function setStatus(next: CompilerStatus) {
  if (next.loaded === status.loaded && next.downloaded === status.downloaded) return
  status = next
  for (const listener of statusListeners) listener()
}

/** How far the compiler has got loading. */
export const compilerStatus = (): CompilerStatus => status

/** Calls `listener` whenever compilerStatus changes, until the returned function is called. */
export function onCompilerStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

// Waits afresh for the worker's next sign of life, while it has work.
function watch() {
  clearTimeout(watchdog)
  watchdog = undefined
  if (pending.size === 0) return
  watchdog = setTimeout(
    () => restart(new PdfError("Making the PDF took too long", status.loaded ? "crash" : "connection")),
    status.loaded ? COMPILING_MS : LOADING_MS,
  )
}

// Fails everything in flight and drops the worker, so the next request starts
// a fresh one.
function restart(error: PdfError) {
  for (const { reject } of pending.values()) reject(error)
  pending.clear()
  previewWaiting?.reject(error)
  previewWaiting = null
  watch()
  worker?.terminate()
  worker = null
  setStatus({ loaded: false, downloaded: 0 })
}

function getWorker(): Worker {
  if (worker) return worker

  const created = new Worker(new URL("./typst.worker.ts", import.meta.url))
  // Messages and errors from a worker that was already replaced are left
  // alone, so they can't touch the new one.
  created.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
    if (worker !== created) return
    if ("id" in data) {
      const request = pending.get(data.id)
      pending.delete(data.id)
      if ("pdf" in data) {
        setStatus({ loaded: true, downloaded: 1 })
        request?.resolve({ pdf: data.pdf, fit: data.fit })
      } else {
        if (data.failure === "resume") setStatus({ loaded: true, downloaded: 1 })
        request?.reject(new PdfError(data.error, data.failure))
        // A broken compiler can't be trusted with the rest.
        if (data.failure === "crash") return restart(new PdfError(data.error, "crash"))
      }
    } else if ("ready" in data) {
      setStatus({ loaded: data.ready, downloaded: data.ready ? 1 : 0 })
    } else if (!status.loaded) {
      setStatus({ loaded: false, downloaded: data.downloaded })
    }
    watch()
  }
  // A worker that can't start, as when the page is left while its scripts
  // load, or that crashes, is replaced. That handles its error, so it isn't
  // also reported to the page as an uncaught one.
  created.onerror = (event) => {
    event.preventDefault()
    if (worker === created) restart(new PdfError(event.message || "The Typst worker failed", "crash"))
  }
  worker = created
  preconnect(COMPILER_CDN_URL)
  return created
}

// A new worker starts by downloading the compiler from jsDelivr. Connecting
// there takes a few round trips (DNS, TCP, TLS), which happen while the
// worker's own script loads instead of after it. The worker's requests share
// the page's connections; this one is anonymous, like the download. Chrome
// skips the hint in private windows, which browser tests run in.
function preconnect(url: string) {
  const link = document.createElement("link")
  link.rel = "preconnect"
  link.href = new URL(url).origin
  link.crossOrigin = "anonymous"
  document.head.append(link)
}

/**
 * Starts loading the compiler, if nothing has yet, so the first PDF doesn't
 * wait for it to download, along with the fonts of `template`, the one
 * likely to print next (the default if not given). Later PDFs use the
 * worker this starts. Once it's loading, a different template's fonts start
 * downloading too. It never throws: if the worker can't start (a browser can
 * block it), the first PDF fails and says why.
 */
export function loadCompiler(template?: TemplateId) {
  try {
    getWorker().postMessage({ load: true, template } satisfies WorkerRequest)
  } catch {
    // Left for the first PDF to report.
  }
}

/**
 * Downloads the compiler, without building it or its fonts, for a visitor
 * likely to write who hasn't started yet. loadCompiler, or the first PDF,
 * then builds it from that download, even one still under way. Does nothing
 * once anything has started the compiler. Like loadCompiler, it never throws.
 */
export function prefetchCompiler() {
  if (worker) return
  try {
    getWorker().postMessage({ prefetch: true } satisfies WorkerRequest)
  } catch {
    // Left for the first PDF to report.
  }
}

/** Whether the visitor has asked to save data or is on a very slow connection, so nothing should download before it's needed. */
export function savingData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return Boolean(connection?.saveData) || /2g/.test(connection?.effectiveType ?? "")
}

interface CompileOptions {
  /** Attach a copy of the resume so resumezip can open the PDF again. Downloads do; previews don't need to. */
  attach?: boolean
}

/** Compiles a resume, in the editor's format, to PDF bytes, kept to one page if it asks to be. */
export async function compileResume(resume: Resume, { attach = false }: CompileOptions = {}): Promise<Uint8Array> {
  return (await send(printedOf(resume), attach ? toAttachment(resume) : undefined)).pdf
}

function send(printed: Printed, attachment?: string): Promise<Compiled> {
  const request: CompileRequest = { id: nextId++, ...printed, attachment }
  return new Promise((resolve, reject) => {
    getWorker().postMessage(request satisfies WorkerRequest)
    pending.set(request.id, { resolve, reject })
    // A stuck worker can't hang a download forever. A wait that's already
    // running is kept, so new requests can't keep a stuck worker going.
    if (watchdog === undefined) watch()
  })
}

const toUrl = (pdf: Uint8Array) => URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }))

// Previews compile one at a time. While one runs, only the newest waits: an
// older one waiting is settled at once, as its result would be thrown away.
// Downloads don't wait here, so they're never replaced.
let previewRunning = false
let previewWaiting: {
  printed: Printed
  signal?: AbortSignal
  resolve: (url: string) => void
  reject: (error: Error) => void
} | null = null

/**
 * What keeping the preview to one page did, for Fine-tune to say: the
 * template and tune it was printed with, so the panel can tell it's about
 * what it shows, and the size it took.
 */
export interface PreviewFit {
  template: TemplateId
  tune: PrintedTune
  fit: Fit
}

let shownFit: PreviewFit | null = null
const fitListeners = new Set<() => void>()

/** What keeping the latest preview to one page did (see PreviewFit); null if it wasn't asked to. */
export const previewFit = (): PreviewFit | null => shownFit

/** Calls `listener` whenever previewFit changes, until the returned function is called. */
export function onPreviewFit(listener: () => void): () => void {
  fitListeners.add(listener)
  return () => fitListeners.delete(listener)
}

function showFit(printed: Printed, fit: Fit | undefined) {
  const next = fit ? { template: printed.template, tune: printed.data.tune, fit } : null
  if (JSON.stringify(next) === JSON.stringify(shownFit)) return
  shownFit = next
  for (const listener of fitListeners) listener()
}

/**
 * Compiles a preview and returns an object URL for the PDF. Revoke it when
 * done. Rejects with Superseded if a newer preview replaces it, or `signal`
 * withdraws it, before it starts.
 */
export function compilePreview(printed: Printed, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Superseded())
    previewWaiting?.reject(new Superseded())
    const entry = { printed, signal, resolve, reject }
    previewWaiting = entry
    signal?.addEventListener(
      "abort",
      () => {
        if (previewWaiting !== entry) return
        previewWaiting = null
        reject(new Superseded())
      },
      { once: true },
    )
    if (!previewRunning) startNextPreview()
  })
}

function startNextPreview() {
  const next = previewWaiting
  previewWaiting = null
  if (!next) return
  previewRunning = true
  send(next.printed)
    .then(({ pdf, fit }) => {
      // A preview withdrawn while it compiled isn't shown, so what it did isn't either.
      if (!next.signal?.aborted) showFit(next.printed, fit)
      return toUrl(pdf)
    })
    .then(next.resolve, next.reject)
    .finally(() => {
      previewRunning = false
      startNextPreview()
    })
}

/**
 * Compiles a resume to download, with the resume attached, and gives back what
 * saves it as "<title>.pdf". The editor saves it once its button has shown the
 * PDF being made.
 */
export async function makeDownload(resume: Resume): Promise<() => void> {
  const url = toUrl(await compileResume(resume, { attach: true }))
  return () => {
    const link = document.createElement("a")
    link.href = url
    link.download = fileNameOf(resume, "pdf")
    link.click()
    // Give the browser time to start the download before freeing the PDF.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/** Compiles a resume to hand to another app, as "<title>.pdf" with the resume attached. */
export async function makePdfFile(resume: Resume): Promise<File> {
  const pdf = await compileResume(resume, { attach: true })
  return new File([pdf as BlobPart], fileNameOf(resume, "pdf"), { type: "application/pdf" })
}

/** Compiles a resume and saves it as "<title>.pdf", with the resume attached. */
export async function downloadResume(resume: Resume): Promise<void> {
  const save = await makeDownload(resume)
  save()
}
