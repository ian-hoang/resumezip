"use client"

import type { PDFDocumentProxy, PDFWorker } from "pdfjs-dist"
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent } from "react"
// react-pdf's styles are in the page's first download, though its code isn't
// (see below). Next loads a later chunk's CSS as a React stylesheet resource,
// and React suspends renders until it's in: what was typed into the form
// meanwhile was lost, as React reset each field to the value it last rendered.
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import { compilerStatus, onCompilerStatus } from "@/lib/typst/compile"
import { scrollerOf, uncovered } from "./layout"
import PrintingPage from "./PrintingPage"
import { OPEN_NAME } from "@/components/dashboard/viewSwitch"

type ReactPdf = typeof import("./reactPdf")

// The worker is bundled with the app, like the one lib/import/open.ts uses.
// pdfjs-dist is pinned to react-pdf's version so both share one copy and the
// worker matches the library. reactPdf.ts points pdf.js at the same file.
const WORKER_URL = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

// Every preview is loaded in one pdf.js worker, started with the first. Given
// none, pdf.js starts a worker for each PDF, which loads its script again, and
// ends it when the PDF closes; a worker it was given is left running. react-pdf
// loads a PDF again when its options change, so they stay one object.
let documentOptions: { worker: PDFWorker } | null = null
const previewOptions = (pdfjs: ReactPdf["pdfjs"]) => (documentOptions ??= { worker: new pdfjs.PDFWorker() })

// The worker only starts with the first PDF, so the first preview would wait
// for it to download once Typst's PDF is ready. Instead it's fetched into the
// browser's cache as soon as the compiler has downloaded: Typst still has to
// build and compile, and the connection is free meanwhile. If that fails,
// pdf.js downloads it as it would have.
let workerFetched = false
function fetchWorker() {
  if (workerFetched) return
  workerFetched = true
  fetch(WORKER_URL)
    .then((response) => response.arrayBuffer())
    .catch(() => {})
}

const compilerDownloaded = () => compilerStatus().downloaded === 1

// A PDF's pages drawn at one width, on screen or drawing out of sight. A new
// drawing stays hidden until all its pages have rendered, so a new PDF, or the
// same one at a new zoom, swaps in without flashing.
interface Drawing {
  file: string
  /** The template it's printed in. */
  template: string | null
  width: number
  pages: number | null
  /** Its pages' height over their width, once read from the PDF. */
  ratio: number | null
  /** The page numbers drawn so far. */
  rendered: number[]
  ready: boolean
}

const MAX_PAGE_WIDTH = 640
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
// The least Fit goes to, below MIN_ZOOM: a short, wide window can need it to show the whole page.
const MIN_FIT = 0.2
// The most one Ctrl + scroll zooms by, as a factor: a mouse wheel's notch.
const WHEEL_STEP = 1.1
// Height over width of US Letter, which every template prints on unless the
// person picks another paper. A PDF's own is read as it loads (pageRatioOf).
const PAGE_RATIO = 11 / 8.5
// Space between pages, matching gap-4.
const PAGE_GAP = 16
// How long the stand-in page takes to fade out over the first preview.
const FADE_MS = 300
// How long the zoom stays put before the pages are drawn again at its size.
const SETTLE_MS = 150
// The most runs of text a new preview lights up on a page. Typing changes one
// or two (a line, and the next if it wraps); more is a new template, a file
// opened over the resume or an undo, where lighting up the page is just noise.
const MAX_LIT = 6

interface PdfPreviewProps {
  /** Object URL of the latest compiled PDF. */
  pdfUrl: string | null
  error?: string | null
  /** A new PDF is being built in another template, so the one on screen is out of date. */
  updating?: boolean
  /** The template `pdfUrl` is printed in. */
  template?: string | null
}

/**
 * A point that stays where it is on screen while the zoom changes: the
 * cursor, or the middle of the panel for the buttons. It's kept as a place on
 * one page, since the gaps between pages don't grow with the zoom.
 */
interface ZoomAnchor {
  clientX: number
  clientY: number
  /** The page it's on, from 0. */
  page: number
  /** Where it is across and down that page, as shares of the page's width and height. */
  x: number
  y: number
}

/** The last zoom's anchor, and where it left the pages on screen. */
interface HeldAnchor {
  anchor: ZoomAnchor
  box: DOMRect
}

function PdfPreview({ pdfUrl, error, updating = false, template = null }: PdfPreviewProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [zoom, setZoom] = useState(1)
  // Catches up with the zoom once it settles. Until then, the pages on screen
  // are stretched to the zoom's size, so a run of steps doesn't draw them again
  // at every one.
  const [drawnZoom, setDrawnZoom] = useState(zoom)
  const [loadError, setLoadError] = useState(false)
  const [availableWidth, setAvailableWidth] = useState(MAX_PAGE_WIDTH)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  // Set just before the zoom changes, and used up once the pages have their new size.
  const anchorRef = useRef<ZoomAnchor | null>(null)
  // Set by Fit, which shows the first page from its top rather than keeping a point in place.
  const toTopRef = useRef(false)
  const heldRef = useRef<HeldAnchor | null>(null)
  // The drawing on screen and its pages, and the text each PDF printed, page
  // by page, to light up what the next one changes (lightUpChanges).
  const shownRef = useRef<Drawing | null>(null)
  const shownPagesRef = useRef<(HTMLDivElement | null)[]>([])
  const printedRef = useRef<{
    file: string
    template: string | null
    pages: Map<number, string[]>
    /** How many of each run of text the PDF before printed that this one's pages haven't matched yet. */
    unmatched: Map<string, number>
  } | null>(null)
  const beforeRef = useRef<{ template: string | null; text: string[] } | null>(null)

  // react-pdf and pdf.js are a third of the editor's code, so they aren't in
  // the page's first download: the form can be used sooner, and the stand-in
  // page shows meanwhile. They load as soon as the editor opens rather than
  // with the first PDF, so a returning visitor, whose compiler is cached,
  // doesn't wait for them after it. A failed download is tried again with the
  // next PDF, and only said once there's a PDF to show.
  const [pdf, setPdf] = useState<ReactPdf | null>(null)
  useEffect(() => {
    if (pdf) return
    let live = true
    import("./reactPdf").then(
      (module) => {
        if (live) setPdf(module)
      },
      () => {
        if (live && pdfUrl) setLoadError(true)
      },
    )
    return () => {
      live = false
    }
  }, [pdf, pdfUrl])

  const downloaded = useSyncExternalStore(onCompilerStatus, compilerDownloaded, () => false)
  useEffect(() => {
    if (downloaded) fetchWorker()
  }, [downloaded])

  const fitWidth = Math.min(availableWidth, MAX_PAGE_WIDTH)
  const pageWidth = fitWidth * zoom
  const drawWidth = fitWidth * drawnZoom

  const shownDrawing = drawings.findLast((drawing) => drawing.ready) ?? drawings[drawings.length - 1]
  const numPages = shownDrawing?.pages ?? 1
  const ratio = shownDrawing?.ratio ?? PAGE_RATIO
  // For the zoom's anchor, which is worked out in event handlers and effects.
  const ratioRef = useRef(ratio)
  useLayoutEffect(() => {
    ratioRef.current = ratio
  })

  useEffect(() => {
    const timer = setTimeout(() => setDrawnZoom(zoom), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [zoom])

  useEffect(() => {
    setLoadError(false)
  }, [pdfUrl])

  // Keep what's on screen while the latest PDF is drawn at the latest size;
  // drop drawings that are no longer wanted.
  useEffect(() => {
    setDrawings((drawings) => {
      if (!pdfUrl) return []
      const shown = drawings.findLast((drawing) => drawing.ready)
      const wanted = drawings.find((drawing) => drawing.file === pdfUrl && drawing.width === drawWidth) ?? {
        file: pdfUrl,
        template,
        width: drawWidth,
        // Known already if this PDF is drawn at another size.
        pages: drawings.find((drawing) => drawing.file === pdfUrl)?.pages ?? null,
        ratio: drawings.find((drawing) => drawing.file === pdfUrl)?.ratio ?? null,
        rendered: [],
        ready: false,
      }
      return shown && shown !== wanted ? [shown, wanted] : [wanted]
    })
  }, [pdfUrl, drawWidth, template])

  // Fit the page to the panel.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    // A hidden panel (the form's showing, on small screens) keeps its last width.
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setAvailableWidth(entry.contentRect.width)
    })
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  // Ctrl/Cmd + scroll zooms around the cursor. Outside Safari, pinching a
  // trackpad comes as this too.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const pages = pagesRef.current
      if (pages) anchorRef.current = anchorAt(pages, event.clientX, event.clientY, heldRef.current, ratioRef.current)
      const factor = wheelZoom(event)
      setZoom((z) => clampZoom(z * factor, z))
    }
    scroller.addEventListener("wheel", onWheel, { passive: false })
    return () => scroller.removeEventListener("wheel", onWheel)
  }, [])

  // The pages grow or shrink from their top left corner, so scroll the anchor
  // back under where it was before the browser paints.
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const pages = pagesRef.current
    anchorRef.current = null
    if (toTopRef.current && scrollerRef.current) {
      toTopRef.current = false
      scrollerRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" })
      return
    }
    if (!anchor || !pages || !scrollerRef.current) return
    const at = onScreen(anchor, pages.getBoundingClientRect(), ratioRef.current)
    // Across, the panel scrolls. Up and down, the panel does on wide screens and
    // the page on small ones, which would scroll smoothly without "instant".
    // Rounded, as WebKit would drop the fraction of a pixel instead.
    scrollerRef.current.scrollBy({ left: Math.round(at.x - anchor.clientX), behavior: "instant" })
    scrollerOf(pages).scrollBy({ top: Math.round(at.y - anchor.clientY), behavior: "instant" })
    heldRef.current = { anchor, box: pages.getBoundingClientRect() }
  }, [zoom])

  // The buttons zoom around the middle of what's showing of the panel.
  function zoomFromMiddle(change: (zoom: number) => number) {
    const scroller = scrollerRef.current
    const pages = pagesRef.current
    if (scroller && pages) {
      const box = scroller.getBoundingClientRect()
      const view = uncovered()
      const middle = (Math.max(box.top, view.top) + Math.min(box.top + scroller.clientHeight, view.bottom)) / 2
      anchorRef.current = anchorAt(pages, box.left + scroller.clientWidth / 2, middle, heldRef.current, ratioRef.current)
    }
    setZoom(change)
  }

  // Fit: the whole of the first page in view, from its top, at most at the
  // usual size. On wide screens the panel scrolls, so its height is what shows.
  function fit() {
    const scroller = scrollerRef.current
    if (!scroller) return
    const style = getComputedStyle(scroller)
    const room = scroller.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    const fitted = Math.max(MIN_FIT, Math.min(1, room / (fitWidth * ratio)))
    // Scrolled to the top once the pages have their new size; at that size already, now.
    if (fitted !== zoom) {
      anchorRef.current = null
      toTopRef.current = true
      setZoom(fitted)
    }
    scroller.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }

  const waiting = !drawings.some((drawing) => drawing.ready)
  const files = [...new Set(drawings.map((drawing) => drawing.file))]

  // Once the first preview is on screen, the stand-in page fades out over it, then goes.
  const [faded, setFaded] = useState(false)
  useEffect(() => {
    if (waiting) {
      setFaded(false)
      return
    }
    const timer = setTimeout(() => setFaded(true), FADE_MS)
    return () => clearTimeout(timer)
  }, [waiting])

  function onLoadSuccess(file: string, loaded: PDFDocumentProxy) {
    const pages = loaded.numPages
    setDrawings((drawings) => drawings.map((drawing) => (drawing.file === file ? { ...drawing, pages } : drawing)))
    pageRatioOf(loaded).then(
      (ratio) => setDrawings((drawings) => drawings.map((drawing) => (drawing.file === file ? { ...drawing, ratio } : drawing))),
      // The PDF closed first, as when a newer one replaced it.
      () => {},
    )
  }

  // Once every page of a drawing has rendered, it's shown and the older ones are dropped.
  function onRenderSuccess({ file, width }: Drawing, page: number) {
    setDrawings((drawings) => {
      const index = drawings.findIndex((drawing) => drawing.file === file && drawing.width === width)
      if (index === -1 || drawings[index].ready) return drawings
      const drawing = drawings[index]
      const rendered = drawing.rendered.includes(page) ? drawing.rendered : [...drawing.rendered, page]
      if (drawing.pages === null || rendered.length < drawing.pages) {
        return drawings.map((other, i) => (i === index ? { ...other, rendered } : other))
      }
      return drawings.slice(index).map((other, i) => (i === 0 ? { ...other, rendered, ready: true } : other))
    })
  }

  useLayoutEffect(() => {
    shownRef.current = shownDrawing ?? null
  })

  /**
   * Lights up the runs of text that the PDF before didn't print, so the line
   * just typed in stands out for a moment (`[data-changed]` in globals.css).
   * Runs are matched one for one, so a second copy of a line the PDF already
   * had lights up too.
   * It's called as each page's text layer is drawn, and looks at every page
   * drawn since. The first preview has nothing to compare with, the same PDF
   * drawn again at another zoom lit up already, and a new template moves and
   * restyles everything rather than changing it. One function for every
   * page, made once: react-pdf draws a text layer again whenever it's given a
   * new one, which would also put out the light.
   */
  const lightUpChanges = useCallback(() => {
    const shown = shownRef.current
    if (!shown) return
    let printed = printedRef.current
    if (printed?.file !== shown.file) {
      // If none of the last PDF's text was drawn (it was replaced first), the one before it is still what to compare with.
      if (printed?.pages.size) beforeRef.current = { template: printed.template, text: [...printed.pages.values()].flat() }
      const unmatched = new Map<string, number>()
      for (const text of beforeRef.current?.text ?? []) unmatched.set(text, (unmatched.get(text) ?? 0) + 1)
      printed = printedRef.current = { file: shown.file, template: shown.template, pages: new Map(), unmatched }
    }
    const { pages, template, unmatched } = printed
    shownPagesRef.current.forEach((box, page) => {
      const layer = box?.querySelector(".textLayer")
      // react-pdf ends a text layer with this once it's all drawn.
      if (!layer?.querySelector(":scope > .endOfContent") || pages.has(page)) return
      // Runs of text, not the empty spans pdf.js wraps some of them in.
      const runs = [...layer.querySelectorAll<HTMLElement>("span")].filter(
        (span) => span.childElementCount === 0 && span.textContent?.trim(),
      )
      pages.set(
        page,
        runs.map((run) => run.textContent ?? ""),
      )
      if (beforeRef.current?.template !== template) return
      const changed = runs.filter((run) => {
        const text = run.textContent ?? ""
        const left = unmatched.get(text) ?? 0
        if (left > 0) unmatched.set(text, left - 1)
        return left === 0
      })
      if (changed.length <= MAX_LIT) for (const run of changed) run.dataset.changed = ""
    })
  }, [])

  function onLoadError(file: string) {
    setDrawings((drawings) => drawings.filter((drawing) => drawing.file !== file))
    if (file === pdfUrl) setLoadError(true)
  }

  const zoomControls = (
    <ZoomControls
      zoom={zoom}
      onOut={() => zoomFromMiddle((z) => stepZoom(z, -1))}
      onReset={() => zoomFromMiddle(() => 1)}
      onIn={() => zoomFromMiddle((z) => stepZoom(z, 1))}
    />
  )

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* On wide screens the zoom is in a pill of its own under the page, below, and the page has this room. */}
      <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-3 md:px-8 xl:hidden">
        <div className="flex items-center font-mono text-xs text-ink-2">
          {zoomControls}
          {numPages > 1 && <span className="ml-3">{numPages} pages</span>}
        </div>
      </div>

      {/* Focusable, so the preview can be scrolled from the keyboard. On wide
          screens the pages scroll in the space above the zoom
          pill, under soft edges (.preview-canvas in styles/editor.css). */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        onCopy={(event) => pdf && copyPlainText(event, pdf.pdfjs)}
        className="preview-canvas relative min-h-[480px] flex-1 overflow-auto px-5 pb-10 focus-visible:outline-offset-[-2px] md:px-8 xl:min-h-0 xl:px-2 xl:pb-4 xl:pt-3"
      >
        {loadError || (error && drawings.length === 0) ? (
          <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-ink-2">
            The preview couldn&apos;t be built.
          </div>
        ) : (
          // The out-of-date page fades a little, after a moment, so a quick switch doesn't flicker.
          // A resume's page on the dashboard grows into this one as it's opened (viewSwitch.ts).
          <div
            ref={pagesRef}
            data-open-target=""
            className={`relative mx-auto transition-opacity duration-300 ${updating ? "opacity-50 delay-150" : ""}`}
            style={{ viewTransitionName: OPEN_NAME, width: pageWidth, minHeight: numPages * pageWidth * ratio + (numPages - 1) * PAGE_GAP }}
          >
            {!faded && <PrintingPage width={pageWidth} leaving={!waiting} />}
            {/* A <Document> loads and parses its file, so the drawings of a PDF share one.
                react-pdf then keeps one page per page number for links within the PDF, and drops
                it when an older drawing goes; the templates only link out. */}
            {pdf &&
              files.map((file) => (
                <pdf.Document
                  key={file}
                  file={file}
                  options={previewOptions(pdf.pdfjs)}
                  // A link in the preview, such as the person's LinkedIn, opens in a new tab rather than leaving the editor.
                  externalLinkTarget="_blank"
                  onLoadSuccess={(loaded) => onLoadSuccess(file, loaded)}
                  onLoadError={() => onLoadError(file)}
                  loading={null}
                >
                  {drawings
                    .filter((drawing) => drawing.file === file)
                    .map((drawing) => (
                      <div
                        key={drawing.width}
                        className={`flex flex-col gap-4 ${drawing === shownDrawing ? "" : "invisible absolute inset-0"}`}
                      >
                        {/* Every page, one under the other; the panel scrolls through them. Each
                            takes the zoom's size straight away, and what's drawn is stretched
                            to fit until it's drawn again at that size. */}
                        {Array.from({ length: drawing.pages ?? 0 }, (_, index) => (
                          <div
                            key={index}
                            ref={
                              drawing === shownDrawing
                                ? (element) => {
                                    shownPagesRef.current[index] = element
                                  }
                                : undefined
                            }
                            className="bg-sheet shadow-[0_1px_3px_rgba(17,19,24,0.08),0_32px_64px_-24px_rgba(24,44,110,0.4)]"
                            style={{ width: pageWidth, height: pageHeight(pageWidth, drawing.ratio ?? PAGE_RATIO) }}
                          >
                            <div
                              className="origin-top-left"
                              style={{ width: drawing.width, transform: `scale(${pageWidth / drawing.width})` }}
                            >
                              <pdf.Page
                                pageNumber={index + 1}
                                width={drawing.width}
                                loading={null}
                                // The text layer, for selecting and copying, is the costliest
                                // part. It's drawn once a drawing is on screen, not for one
                                // out of sight that a newer one may replace.
                                renderTextLayer={drawing.ready && drawing === shownDrawing}
                                renderAnnotationLayer
                                onRenderSuccess={() => onRenderSuccess(drawing, index + 1)}
                                onRenderTextLayerSuccess={lightUpChanges}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </pdf.Document>
              ))}
          </div>
        )}
      </div>

      {/* On wide screens, the zoom in a glass pill under the page. */}
      <div className="glass glass-frost mt-2 hidden h-11 shrink-0 items-center gap-1 self-center rounded-full px-2 font-mono text-xs text-ink-2 xl:flex">
        {zoomControls}
        <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-ink/10" />
        <button
          type="button"
          onClick={fit}
          title="Show the whole page"
          className="h-8 rounded-full px-3 font-sans text-[13px] text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          Fit
        </button>
      </div>

      {error && (
        <p
          role="status"
          className="border-t border-rule px-5 py-2 text-xs text-[#b42318] md:px-8 xl:absolute xl:left-1/2 xl:top-9 xl:w-max xl:max-w-[90%] xl:-translate-x-1/2 xl:rounded-full xl:border-0 xl:bg-sheet xl:px-4 xl:shadow-[0_8px_24px_-12px_rgba(17,19,24,0.35)]"
        >
          Couldn&apos;t update the preview: {error}
        </p>
      )}
    </div>
  )
}

/** The zoom's − 100% + buttons: in the bar over the preview, or in the pill under the page on wide screens. */
function ZoomControls({ zoom, onOut, onReset, onIn }: { zoom: number; onOut: () => void; onReset: () => void; onIn: () => void }) {
  // At the smallest or largest zoom, its button stays focusable but does nothing, as MoveButtons do.
  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-ink aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:text-ink-2"
  return (
    <>
      <button type="button" aria-label="Zoom out" aria-disabled={zoom <= MIN_ZOOM || undefined} onClick={onOut} className={iconButton}>
        −
      </button>
      <button type="button" onClick={onReset} title="Reset zoom" className="w-12 text-center tabular-nums hover:text-ink">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" aria-label="Zoom in" aria-disabled={zoom >= MAX_ZOOM || undefined} onClick={onIn} className={iconButton}>
        +
      </button>
    </>
  )
}

// Re-renders with a new PDF, and not with the rest of the editor.
export default memo(PdfPreview)

// Copying from the preview gives plain text, as pdf.js's own viewer does. The
// selected text is the invisible copy over the canvas, so the browser's usual
// rich copy would carry its transparent color and placeholder font into
// whatever it's pasted into. The text is normalized the same way too, so a
// ligature such as "ﬁ" would paste as "fi".
function copyPlainText(event: ClipboardEvent, pdfjs: ReactPdf["pdfjs"]) {
  const text = window.getSelection()?.toString()
  if (!text) return
  event.clipboardData.setData("text/plain", pdfjs.normalizeUnicode(text))
  event.preventDefault()
}

/**
 * A zoom within the limits. `from`, the zoom it changes from, can be below
 * MIN_ZOOM after Fit: zooming out from there stays put rather than jumping up to MIN_ZOOM.
 */
function clampZoom(zoom: number, from = MIN_ZOOM) {
  return Math.min(Math.max(zoom, Math.min(MIN_ZOOM, from)), MAX_ZOOM)
}

/**
 * How much a Ctrl + scroll zooms by, as a factor. Chrome and Firefox report
 * pinching a trackpad as a scroll of -100 × ln(scale) pixels, a few at a time,
 * so following that keeps the page under the fingers. A mouse wheel's notch
 * scrolls much further at once (100 pixels in Chrome on Windows) and zooms a
 * step, as does a notch of a wheel that counts in lines or pages.
 */
function wheelZoom({ deltaY, deltaMode }: WheelEvent) {
  if (deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return WHEEL_STEP ** -Math.sign(deltaY)
  return Math.min(Math.max(Math.exp(-deltaY / 100), 1 / WHEEL_STEP), WHEEL_STEP)
}

/**
 * The buttons go to the next tenth, as from a pinch's 143% to 150% or 140%.
 * They count from the percentage shown, so a click always changes it.
 */
function stepZoom(zoom: number, direction: 1 | -1) {
  const tenths = Math.round(zoom * 100) / 10
  return clampZoom((direction > 0 ? Math.floor(tenths) + 1 : Math.ceil(tenths) - 1) / 10, zoom)
}

// In whole pixels, as react-pdf sizes a page's canvas.
const pageHeight = (width: number, ratio: number) => Math.floor(width * ratio)

/** The first page's height over its width, from its size in the PDF. */
async function pageRatioOf(loaded: PDFDocumentProxy): Promise<number> {
  const [left, bottom, right, top] = (await loaded.getPage(1)).view
  return (top - bottom) / (right - left) || PAGE_RATIO
}

/**
 * Where a point on screen falls on the pages. Zooming again around the same
 * point, with nothing moved since, keeps to the last zoom's anchor: browsers
 * scroll by whole pixels, and measuring the point afresh each time would add
 * up the rounding until it crept away from the cursor.
 */
function anchorAt(pages: HTMLElement, clientX: number, clientY: number, held: HeldAnchor | null, ratio: number): ZoomAnchor {
  const box = pages.getBoundingClientRect()
  const still = held && held.box.left === box.left && held.box.top === box.top && held.box.width === box.width
  if (still && held.anchor.clientX === clientX && held.anchor.clientY === clientY) return held.anchor
  const pitch = pageHeight(box.width, ratio) + PAGE_GAP
  const down = clientY - box.top
  const page = Math.max(0, Math.floor(down / pitch))
  return { clientX, clientY, page, x: (clientX - box.left) / box.width, y: (down - page * pitch) / pageHeight(box.width, ratio) }
}

/** Where an anchor is on screen with the pages laid out in `box`. */
function onScreen(anchor: ZoomAnchor, box: DOMRect, ratio: number) {
  const height = pageHeight(box.width, ratio)
  return { x: box.left + anchor.x * box.width, y: box.top + anchor.page * (height + PAGE_GAP) + anchor.y * height }
}
