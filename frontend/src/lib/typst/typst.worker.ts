// Compiles resumes to PDF with the Typst WebAssembly compiler, off the main
// thread so the editor stays responsive. Talk to it through compile.ts.

import { CompileFormatEnum, createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler"
import { loadFonts } from "@myriaddreamin/typst.ts/options.init"
import { ATTACHMENT_NAME } from "@/lib/resumeFile"
import { fontsOf, templateById } from "@/lib/templates"
import common from "./templates/common.typ"
import ian from "./templates/ian.typ"
import jake from "./templates/jake.typ"
import levelsfyi from "./templates/levelsfyi.typ"
import margin from "./templates/margin.typ"
import modernjack from "./templates/modernjack.typ"
import mono from "./templates/mono.typ"
import referme from "./templates/referme.typ"
import resumeworded from "./templates/resumeworded.typ"
import swiss from "./templates/swiss.typ"
import type { CompileRequest, CompileResponse, WorkerMessage, WorkerRequest } from "./compile"
import { COMPILER_CDN_URL, COMPILER_INTEGRITY, COMPILER_SIZE, compileChecked, downloadChecked } from "./compilerSource"
import { FONT_URLS, fontsFor, lazyFonts } from "./fontFiles"

const SOURCES: Record<string, string> = {
  "/common.typ": common,
  "/ian.typ": ian,
  "/jake.typ": jake,
  "/levelsfyi.typ": levelsfyi,
  "/margin.typ": margin,
  "/modernjack.typ": modernjack,
  "/mono.typ": mono,
  "/referme.typ": referme,
  "/resumeworded.typ": resumeworded,
  "/swiss.typ": swiss,
}

// Downloads wrap the template in a file that also attaches a copy of the
// resume, so templates don't need to know about it. Checked to leave every
// template's layout exactly as it was.
const withAttachment = (template: string) =>
  `#include "/${template}.typ"
#pdf.attach("/${ATTACHMENT_NAME}", relationship: "source", mime-type: "application/json", description: "This resume's content, so resumezip can open the PDF for editing again")
`

let compiler: Promise<TypstCompiler> | null = null

// How long jsDelivr can go without sending anything before the app's own
// copy is used instead.
const CDN_IDLE_MS = 15_000

// How much of the compiler has arrived, in bytes.
let compilerBytes = 0

// Tells the page the worker is getting on: some of the compiler or a font
// arrived (at most ten times a second), or a slow step is starting (`now`).
// The page only gives up when it hears nothing for a while (see compile.ts),
// so this keeps a slow connection or a long step from being taken for a
// stuck one. It also says how much of the compiler has arrived, which the
// preview shows while it waits.
let reportedAt = 0
function reportProgress(now = false) {
  if (!now && Date.now() - reportedAt < 100) return
  reportedAt = Date.now()
  postMessage({ progress: true, downloaded: Math.min(compilerBytes / COMPILER_SIZE, 1) } satisfies WorkerMessage)
}

const compilerArrived = (bytes: number) => {
  compilerBytes += bytes
  // The end is told at once, as the page starts its next download then (see PdfPreview.tsx).
  reportProgress(compilerBytes >= COMPILER_SIZE)
}

// fetch, calling `onData` with the number of bytes as the body arrives.
async function fetchReporting(url: string, onData: (bytes: number) => void = () => reportProgress()): Promise<Response> {
  const response = await fetch(url)
  if (!response.body) return response
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        onData(chunk.length)
        controller.enqueue(chunk)
      },
    }),
  )
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}

// The compiler's file, downloaded and checked ahead of time without being
// built (see prefetchCompiler in compile.ts), or null if that failed. Kept
// in memory rather than left to the browser's cache, which can be too small
// for it (as in private windows), so building it later never downloads it
// twice, even when that starts while this is still downloading.
let prefetched: Promise<Uint8Array<ArrayBuffer> | null> | null = null

function prefetch() {
  prefetched ??= downloadChecked(COMPILER_CDN_URL, COMPILER_INTEGRITY, CDN_IDLE_MS, compilerArrived).catch(() => null)
}

// The compiler from jsDelivr, or the app's own copy if that fails (offline,
// blocked, stalled, or not the expected file). A download ahead is the try
// at jsDelivr: one that stalled just before a resume needed the compiler
// isn't followed by a second wait for jsDelivr, long enough together for the
// page to give up (see compile.ts).
async function compilerModule(): Promise<WebAssembly.Module | Response> {
  if (prefetched) {
    const bytes = await prefetched
    // Once built, the file isn't needed.
    prefetched = null
    if (bytes) return WebAssembly.compile(bytes)
  } else {
    compilerBytes = 0
    try {
      return await compileChecked(COMPILER_CDN_URL, COMPILER_INTEGRITY, CDN_IDLE_MS, compilerArrived)
    } catch {
      // Fall through to the bundled copy.
    }
  }
  // The bundled copy's download starts from nothing.
  compilerBytes = 0
  return fetchReporting(
    new URL("@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm", import.meta.url).href,
    compilerArrived,
  )
}

// The font files downloaded so far, by name, and the downloads under way.
const fontData = new Map<string, Uint8Array>()
const fontDownloads = new Map<string, Promise<void>>()

// Downloads the font files that aren't here yet, alongside whatever else is
// downloading. A file that fails is tried again next time.
function fetchFonts(files: string[]): Promise<void> {
  const downloads = files.map((file) => {
    let download = fontDownloads.get(file)
    if (!download) {
      download = fetchReporting(FONT_URLS[file]).then(async (response) => {
        if (!response.ok) throw new Error(`${FONT_URLS[file]} answered ${response.status}`)
        fontData.set(file, new Uint8Array(await response.arrayBuffer()))
      })
      download.catch(() => fontDownloads.delete(file))
      fontDownloads.set(file, download)
    }
    return download
  })
  return Promise.all(downloads).then(() => undefined)
}

// A font's data, when Typst prints with it. The fonts a resume needs are
// downloaded before it's compiled (see fontsFor), so this is only a backstop:
// a font that isn't here is downloaded now, synchronously, which workers
// allow. If that fails too, Typst takes the font as missing and prints those
// characters with another, until the page is reloaded.
function fontBytes(file: string): Uint8Array {
  const data = fontData.get(file)
  if (data) return data
  reportProgress(true)
  const request = new XMLHttpRequest()
  request.open("GET", FONT_URLS[file], false)
  request.responseType = "arraybuffer"
  try {
    request.send()
  } catch {
    return new Uint8Array()
  }
  if (request.status !== 200) return new Uint8Array()
  const bytes = new Uint8Array(request.response as ArrayBuffer)
  fontData.set(file, bytes)
  return bytes
}

// Downloads the fonts a template's PDFs need, before the first is compiled.
const fetchFontsOf = (template: string | undefined, text = "") => fetchFonts(fontsFor(fontsOf(templateById(template)), text))

async function createCompiler(): Promise<TypstCompiler> {
  const instance = createTypstCompiler()
  await instance.init({
    getModule: compilerModule,
    // Every font is known from the start, and read only when it's printed
    // with (see fontFiles.ts). Building the compiler comes next.
    beforeBuild: [loadFonts(lazyFonts(fontBytes), { assets: false }), async () => reportProgress(true)],
  })
  for (const [path, source] of Object.entries(SOURCES)) instance.addSource(path, source)
  return instance
}

function getCompiler(): Promise<TypstCompiler> {
  // Forget a failed start (e.g. a network error) so the next request retries.
  compiler ??= createCompiler().then(
    (instance) => {
      postMessage({ ready: true } satisfies WorkerMessage)
      return instance
    },
    (error) => {
      compiler = null
      postMessage({ ready: false } satisfies WorkerMessage)
      throw error
    },
  )
  return compiler
}

addEventListener("message", ({ data: request }: MessageEvent<WorkerRequest>) => {
  // Downloading the compiler before anyone has asked for a PDF. Building it,
  // and the fonts, wait until someone starts writing.
  if ("prefetch" in request) prefetch()
  // Loading ahead of the first PDF, with the fonts its template needs. If
  // either fails, that PDF tries again.
  else if ("load" in request) {
    getCompiler().catch(() => {})
    fetchFontsOf(request.template).catch(() => {})
  } else void compile(request)
})

async function compile({ id, template, data, attachment }: CompileRequest) {
  let response: CompileResponse
  let typst: TypstCompiler | undefined
  try {
    const json = JSON.stringify(data)
    // The fonts download alongside the compiler, or before compiling when
    // the template or the text needs ones that aren't here yet.
    ;[typst] = await Promise.all([getCompiler(), fetchFontsOf(template, json)])
    // Compiling comes next.
    reportProgress(true)
    // Nothing is awaited between writing the data and compiling it, so
    // concurrent requests can't see each other's data.
    typst.mapShadow("/resume.json", new TextEncoder().encode(json))
    if (attachment !== undefined) {
      typst.mapShadow(`/${ATTACHMENT_NAME}`, new TextEncoder().encode(attachment))
      typst.addSource("/download.typ", withAttachment(template))
    }
    const { result, diagnostics } = await typst.compile({
      mainFilePath: attachment === undefined ? `/${template}.typ` : "/download.typ",
      format: CompileFormatEnum.pdf,
      diagnostics: "unix",
    })
    response = result ? { id, pdf: result } : { id, error: diagnostics?.join("\n") || "Typst produced no output", failure: "resume" }
  } catch (error) {
    // Without a compiler, it couldn't be downloaded. With one, the compiler
    // itself broke, and the page replaces this worker.
    const message = error instanceof Error ? error.message : String(error)
    response = { id, error: message, failure: typst === undefined ? "connection" : "crash" }
  }
  postMessage(response)
}
