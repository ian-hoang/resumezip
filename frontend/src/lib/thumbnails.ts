// Pictures of resumes' first pages, for the dashboard's cards
// (components/dashboard/ResumeCards.tsx). Each is made in this browser, as a
// preview is: Typst compiles the resume and pdf.js draws its first page on a
// canvas. They're kept in memory while the page is open, one per resume, and
// drawn again once what the resume prints changes.

import type { PDFWorker } from "pdfjs-dist"
import type { Resume } from "@/lib/resume"
import { compileResume, printedOf, Superseded } from "@/lib/typst/compile"

/** How wide a picture is drawn, in pixels: about twice a card's width, for sharp screens. */
const WIDTH = 640

interface Picture {
  /** What the resume printed when it was drawn, as printedOf's JSON. */
  printed: string
  /** The picture, as an object URL. */
  url: string
}

const pictures = new Map<string, Picture>()
// Drawn one at a time, in the order asked for: the compiler takes one resume
// at a time anyway, and the first cards on the page shouldn't wait for the rest.
let queue: Promise<unknown> = Promise.resolve()
// pdf.js's worker for the pictures, kept between them.
let pdfWorker: PDFWorker | null = null

/**
 * A picture of the resume's first page, as an object URL that stays the
 * resume's until a newer picture replaces it: don't revoke it. Rejects with
 * Superseded if `signal` aborts before its turn, so a page that's left
 * doesn't keep the compiler busy, and with the compiler's error if the resume
 * can't be compiled.
 */
export function thumbnailOf(id: string, resume: Resume, signal?: AbortSignal): Promise<string> {
  const printed = JSON.stringify(printedOf(resume))
  const drawn = pictures.get(id)
  if (drawn?.printed === printed) return Promise.resolve(drawn.url)
  const turn = queue.then(async () => {
    // Another request may have drawn it while this one waited.
    const latest = pictures.get(id)
    if (latest?.printed === printed) return latest.url
    if (signal?.aborted) throw new Superseded()
    const url = await draw(resume)
    pictures.set(id, { printed, url })
    if (latest) URL.revokeObjectURL(latest.url)
    return url
  })
  queue = turn.catch(() => {})
  return turn
}

/** The latest picture drawn of a resume, whatever it printed, to show while a fresher one is made. */
export const lastThumbnail = (id: string): string | undefined => pictures.get(id)?.url

/** Lets go of the pictures of resumes that aren't in `ids`, as deleted ones. */
export function keepThumbnails(ids: string[]) {
  for (const [id, { url }] of pictures) {
    if (ids.includes(id)) continue
    pictures.delete(id)
    URL.revokeObjectURL(url)
  }
}

async function draw(resume: Resume): Promise<string> {
  const pdf = await compileResume(resume)
  const { loadPdfjs } = await import("@/lib/import/open")
  const { getDocument, PDFWorker } = await loadPdfjs()
  if (!pdfWorker || pdfWorker.destroyed) pdfWorker = new PDFWorker()
  const task = getDocument({ data: pdf, isEvalSupported: false, worker: pdfWorker })
  try {
    const page = await (await task.promise).getPage(1)
    const viewport = page.getViewport({ scale: WIDTH / page.getViewport({ scale: 1 }).width })
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("The page couldn't be drawn")
    await page.render({ canvasContext: context, viewport }).promise
    // Safari can't make WebP, and makes a PNG instead.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9))
    if (!blob) throw new Error("The page couldn't be drawn")
    return URL.createObjectURL(blob)
  } finally {
    void task.destroy().catch(() => {})
  }
}
