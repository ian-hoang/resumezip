// Pictures of each resume's first page, for the dashboard. A resume is
// compiled with its own template (lib/typst/compile.ts), one at a time and
// only while its picture is on screen, and pdf.js draws page 1 small. The
// pictures stay in memory while the page is open, never in storage, and one
// is drawn again once what its resume prints changes. Until one is ready, the
// template's own picture stands in (PagePicture.tsx).
//
// Nothing is drawn until the dashboard calls startPictures, once it has
// settled: the compiler is a large download, which visitors saving data only
// get when they open a resume.

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import type { PDFWorker } from "pdfjs-dist"
import type { Resume } from "@/lib/resume"
import { compileResume, failureOf, printedOf } from "@/lib/typst/compile"

/** How wide the page is drawn, in pixels: twice the widest tile, so it's sharp on high-density screens. */
const DRAWN_WIDTH = 560

export interface Picture {
  /** What the resume printed when it was drawn (printedKey). */
  printed: string
  url: string
}

// The latest picture of each resume, by id, even once it's out of date: an
// old picture stands in better than the template's while the new one is drawn.
const pictures = new Map<string, Picture>()
// The resumes whose pictures are on screen, by id, in the order they came
// into view, and how many places show each (a tile, and the Recent list).
const wanted = new Map<string, { resume: Resume; places: number }>()
// What printed resumes couldn't be laid out by their template; not tried again until they change.
const unprintable = new Set<string>()
// What each resume prints, as text; null if it can't be read. Kept per resume object, which is new with every change.
const printedKeys = new WeakMap<Resume, string | null>()
const listeners = new Set<() => void>()

let started = false
// Set when the compiler can't be downloaded or keeps breaking: the template pictures stay for this visit.
let stopped = false
let drawing = false
let pdfWorker: PDFWorker | null = null

function printedKey(resume: Resume): string | null {
  if (printedKeys.has(resume)) return printedKeys.get(resume)!
  let key: string | null = null
  try {
    key = JSON.stringify(printedOf(resume))
  } catch {
    // Saved data too odd to print keeps the template's picture; the editor says what's wrong.
  }
  printedKeys.set(resume, key)
  return key
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setPicture(id: string, picture: Picture) {
  const old = pictures.get(id)
  pictures.set(id, picture)
  // A copy of a resume shares its picture, so an old one is only freed once nothing shows it.
  if (old && old.url !== picture.url && ![...pictures.values()].some(({ url }) => url === old.url)) URL.revokeObjectURL(old.url)
  for (const listener of listeners) listener()
}

/**
 * Which pictures to let go of, keeping only those of `kept` resumes: their
 * ids, and the object URLs no kept picture shares (a copy of a resume shares
 * its picture until either changes).
 */
export function picturesToForget(all: ReadonlyMap<string, Picture>, kept: ReadonlySet<string>): { ids: string[]; urls: string[] } {
  const ids = [...all.keys()].filter((id) => !kept.has(id))
  const stillShown = new Set([...all].filter(([id]) => kept.has(id)).map(([, { url }]) => url))
  const urls = [...new Set(ids.map((id) => all.get(id)!.url))].filter((url) => !stillShown.has(url))
  return { ids, urls }
}

/**
 * Lets go of the pictures of resumes that are gone, as once deleted: without
 * this they'd stay in memory, image and all, until the tab closes. The
 * dashboard calls it with every resume it has, as they change.
 */
export function keepPictures(ids: Iterable<string>) {
  const { ids: gone, urls } = picturesToForget(pictures, new Set(ids))
  if (gone.length === 0) return
  for (const id of gone) pictures.delete(id)
  for (const url of urls) URL.revokeObjectURL(url)
  for (const listener of listeners) listener()
}

/** Starts drawing the pictures on screen, and those that come into view later. */
export function startPictures() {
  started = true
  void drawWanted()
}

// The next picture to draw: the first one on screen that's missing or out of date.
function next(): [string, Resume, string] | undefined {
  for (const [id, { resume }] of wanted) {
    const printed = printedKey(resume)
    if (printed !== null && pictures.get(id)?.printed !== printed && !unprintable.has(printed)) return [id, resume, printed]
  }
  return undefined
}

async function drawWanted() {
  if (drawing || !started || stopped) return
  drawing = true
  try {
    for (let item = next(); item && !stopped; item = next()) {
      const [id, resume, printed] = item
      // A copy, or a resume put back as it was, may print just what another picture shows.
      const same = [...pictures.values()].find((picture) => picture.printed === printed)
      if (same) {
        setPicture(id, same)
        continue
      }
      try {
        setPicture(id, { printed, url: await draw(resume) })
      } catch (error) {
        // A resume its template can't lay out is left for the editor to explain. When the
        // compiler can't download, or breaks, the rest would only fail too.
        if (failureOf(error) === "resume") unprintable.add(printed)
        else stopped = true
      }
    }
  } finally {
    drawing = false
    // Nothing's on screen, as when the dashboard was left: pdf.js's worker isn't needed till it's back.
    if (wanted.size === 0) {
      pdfWorker?.destroy()
      pdfWorker = null
    }
  }
}

/** Compiles a resume and draws its first page, as an object URL of a picture. */
async function draw(resume: Resume): Promise<string> {
  const pdf = await compileResume(resume)
  const { loadPdfjs } = await import("@/lib/import/open")
  const { getDocument, PDFWorker } = await loadPdfjs()
  // One pdf.js worker for every picture: given none, pdf.js starts one per PDF.
  if (!pdfWorker || pdfWorker.destroyed) pdfWorker = new PDFWorker()
  const task = getDocument({ data: pdf, isEvalSupported: false, worker: pdfWorker })
  try {
    const page = await (await task.promise).getPage(1)
    const viewport = page.getViewport({ scale: DRAWN_WIDTH / page.getViewport({ scale: 1 }).width })
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No canvas to draw on")
    await page.render({ canvasContext: context, viewport }).promise
    // WebP where the browser can write it (Safari writes PNG instead).
    const picture = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86))
    if (!picture) throw new Error("The page couldn't be drawn")
    return URL.createObjectURL(picture)
  } finally {
    void task.destroy()
  }
}

/**
 * The picture of a resume's first page, once it's drawn, while `element`,
 * its place on the page, is on screen or about to be. Undefined until then.
 */
export function usePagePicture(id: string, resume: Resume, element: RefObject<HTMLElement | null>): string | undefined {
  const url = useSyncExternalStore(
    subscribe,
    () => pictures.get(id)?.url,
    () => undefined,
  )
  const [onScreen, setOnScreen] = useState(false)
  useEffect(() => {
    const target = element.current
    if (!target || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "300px 0px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [element])
  useEffect(() => {
    if (!onScreen) return
    const place = wanted.get(id)
    if (place) {
      place.resume = resume
      place.places++
    } else wanted.set(id, { resume, places: 1 })
    void drawWanted()
    return () => {
      const place = wanted.get(id)
      if (place && --place.places === 0) wanted.delete(id)
    }
  }, [id, resume, onScreen])
  return url
}

/** Whether a picture was just drawn while this was showing, so it can fade in rather than appear. */
export function useArrived(url: string | undefined): boolean {
  const first = useRef(url)
  return url !== undefined && first.current === undefined
}
