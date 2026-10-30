"use client"

import type { PDFDocumentProxy, PDFPageProxy, PDFWorker } from "pdfjs-dist"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent } from "react"
// react-pdf's styles are in the page's first download, though its code isn't
// (see below). Next loads a later chunk's CSS as a React stylesheet resource,
// and React suspends renders until it's in, so what's typed into the form
// meanwhile would be lost: React resets each field to the value it last rendered.
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import { PDFJS_WORKER_URL } from "@/lib/pdfjsWorker"
import { compilerStatus, onCompilerStatus } from "@/lib/typst/compile"
import { reducedMotion, scrollerOf, uncovered } from "./layout"
import PrintingPage from "./PrintingPage"
import LiquidLens from "@/components/LiquidLens"
import { useCheckActions } from "./CheckContext"
import { OPEN_NAME } from "@/components/dashboard/viewSwitch"
import { PreviewGaze, PreviewMarks } from "./MarksContext"
import { PickedToolbar } from "./PickedToolbar"
import type { SelectedWords } from "./SelectionToolbar"
import { newWords, wordsIn, type Word } from "./changedWords"

type ReactPdf = typeof import("./reactPdf")

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
  fetch(PDFJS_WORKER_URL)
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
// How long the zoom, or the page's size, stays put before the pages are drawn again at it.
const SETTLE_MS = 150
// How long the pages take to grow or shrink to a zoom chosen with the buttons or Fit.
const ZOOM_MS = 240
// How long the widest the page may be takes to change, as the form slides away or back (useFold).
const RESIZE_MS = 300
// The most stretches of words a new preview lights up, each within one run of
// text on the page. Typing or styling changes one or two (part of a line, and
// the next if it wraps); more is a new template, a file opened over the resume
// or an undo, where lighting up the page is just noise.
const MAX_LIT = 6

interface PdfPreviewProps {
  /** Object URL of the latest compiled PDF. */
  pdfUrl: string | null
  error: string | null
  /** A new PDF is being built in another template, so the one on screen is out of date. */
  updating: boolean
  /** The template `pdfUrl` is printed in. */
  template: string | null
  /** The widest the page is drawn at 100%: MAX_PAGE_WIDTH, or more while the form is folded away. */
  maxPageWidth?: number
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

function PdfPreview({ pdfUrl, error, updating, template, maxPageWidth = MAX_PAGE_WIDTH }: PdfPreviewProps) {
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
  // Set by the zoom buttons and Fit, whose change of size eases in; and the zoom the pages were last shown at.
  const easeZoom = useRef(false)
  const zoomShown = useRef(zoom)
  const heldRef = useRef<HeldAnchor | null>(null)
  // The drawing on screen and its pages, each PDF loaded, and the words the
  // shown one printed, page by page, to light up what the next one changes
  // (lightUpChanges).
  const shownRef = useRef<Drawing | null>(null)
  const shownPagesRef = useRef<(HTMLDivElement | null)[]>([])
  const loadedRef = useRef(new Map<string, PDFDocumentProxy>())
  const printedRef = useRef<{
    file: string
    template: string | null
    pages: number
    /** Each page's words once they're read, and null while they are. */
    words: Map<number, PrintedWord[] | null>
  } | null>(null)
  /** The words of the last PDF read in full, to compare the next with. */
  const beforeRef = useRef<{ template: string | null; words: string[] } | null>(null)

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

  // The widest the page may be, moving to maxPageWidth as the form slides, so the page grows or shrinks with it.
  const [widest, setWidest] = useState(maxPageWidth)
  const widestRef = useRef(widest)
  widestRef.current = widest
  useEffect(() => {
    const from = widestRef.current
    if (from === maxPageWidth) return
    if (reducedMotion()) {
      setWidest(maxPageWidth)
      return
    }
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      // A frame's time is when it began, which can be just before `start`.
      const done = Math.min(1, Math.max(0, (now - start) / RESIZE_MS))
      // Close to ease-glide, which the form slides by.
      setWidest(from + (maxPageWidth - from) * (1 - (1 - done) ** 4))
      if (done < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [maxPageWidth])

  const fitWidth = Math.min(availableWidth, widest)
  const pageWidth = fitWidth * zoom
  // The size the pages are drawn at catches up once the page stops changing size, as while the form
  // slides or the window is resized, rather than drawing them every frame; what's drawn is stretched
  // meanwhile. The first drawing doesn't wait.
  const [drawnFit, setDrawnFit] = useState(fitWidth)
  const drawn = drawings.length > 0
  useEffect(() => {
    if (drawnFit === fitWidth) return
    if (!drawn) {
      setDrawnFit(fitWidth)
      return
    }
    const timer = setTimeout(() => setDrawnFit(fitWidth), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [fitWidth, drawnFit, drawn])
  const drawWidth = drawnFit * drawnZoom

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
  // back under where it was before the browser paints. From the buttons and
  // Fit, they then ease from their old size to the new one around that point
  // (the top's middle for Fit), rather than snapping to it; Ctrl + scroll and
  // pinches come in small steps of their own, which follow the hand.
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const pages = pagesRef.current
    anchorRef.current = null
    const from = zoomShown.current
    zoomShown.current = zoom
    const ease = easeZoom.current
    easeZoom.current = false
    if (toTopRef.current && scrollerRef.current) {
      toTopRef.current = false
      scrollerRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" })
    } else if (anchor && pages && scrollerRef.current) {
      const at = onScreen(anchor, pages.getBoundingClientRect(), ratioRef.current)
      // Across, the panel scrolls. Up and down, the panel does on wide screens and
      // the page on small ones, which would scroll smoothly without "instant".
      // Rounded, as WebKit would drop the fraction of a pixel instead.
      scrollerRef.current.scrollBy({ left: Math.round(at.x - anchor.clientX), behavior: "instant" })
      scrollerOf(pages).scrollBy({ top: Math.round(at.y - anchor.clientY), behavior: "instant" })
      heldRef.current = { anchor, box: pages.getBoundingClientRect() }
    }
    if (!ease || !pages || from === zoom || reducedMotion()) return
    const box = pages.getBoundingClientRect()
    const origin = anchor ? `${anchor.clientX - box.left}px ${anchor.clientY - box.top}px` : "50% 0"
    pages.animate(
      { transform: [`scale(${from / zoom})`, "none"], transformOrigin: [origin, origin] },
      { duration: ZOOM_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    )
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
    easeZoom.current = true
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
      easeZoom.current = true
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
    loadedRef.current.set(file, loaded)
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
   * Lights up the words that the PDF before didn't print, so what was just
   * typed or styled stands out for a moment (`[data-changed]` in globals.css).
   * Words are compared in order, each with its font, so bolding a word lights
   * up that word alone, and a word moved to the next line isn't new.
   * It's called as each page's text layer is drawn, and reads every page drawn
   * since; once all of them are read, it compares. The first preview has
   * nothing to compare with, the same PDF drawn again at another zoom lit up
   * already, and a new template moves and restyles everything rather than
   * changing it. One function for every page, made once: react-pdf draws a
   * text layer again whenever it's given a new one, which would also put out
   * the light.
   */
  const lightUpChanges = useCallback(() => {
    const shown = shownRef.current
    const loaded = shown && loadedRef.current.get(shown.file)
    if (!shown || !loaded) return
    let printed = printedRef.current
    if (printed?.file !== shown.file) {
      printed = printedRef.current = { file: shown.file, template: shown.template, pages: loaded.numPages, words: new Map() }
    }
    const { words } = printed
    shownPagesRef.current.forEach((box, index) => {
      const layer = box?.querySelector(".textLayer")
      // react-pdf ends a text layer with this once it's all drawn.
      if (!layer?.querySelector(":scope > .endOfContent") || words.has(index)) return
      words.set(index, null)
      wordsOnPage(loaded, index + 1, layer).then(
        (read) => {
          if (printedRef.current !== printed) return
          words.set(index, read)
          const pages = Array.from({ length: printed.pages }, (_, page) => words.get(page))
          if (pages.some((page) => !page)) return
          const all = pages.flatMap((page) => page ?? [])
          const before = beforeRef.current
          beforeRef.current = { template: printed.template, words: all.map((word) => word.key) }
          if (before?.template === printed.template) lightUp(all, before.words)
        },
        // The PDF closed first, as when a newer one replaced it.
        () => {},
      )
    })
  }, [])

  // Selecting words on the page, by double- or triple-clicking or dragging,
  // opens the field that printed them, with them lit up and still selected
  // here, to copy. Where the preview hides the form, as on a phone, a double-click
  // opens the form with the word selected, to edit. Only once the button's
  // up, so a drag isn't cut short; a click selects nothing.
  const { pick } = useCheckActions()
  // Where the words picked are on the page, for the toolbar that styles them,
  // until the page scrolls under it.
  const [pickedAt, setPickedAt] = useState<Omit<SelectedWords, "style" | "link"> | null>(null)
  function pickSelected(event: MouseEvent) {
    if (event.button !== 0) return
    const selection = window.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed) return
    const layers = [...(pagesRef.current?.querySelectorAll<HTMLElement>(".textLayer") ?? [])]
    const layer = layers.find((layer) => layer.contains(selection.getRangeAt(0).startContainer))
    if (!layer) return
    if (event.detail === 3) selectLine(selection, layer)
    const range = selection.getRangeAt(0)
    // Offsets in all the pages' text, as one string. A range's text is its
    // text nodes' as textContent joins them, so the two line up.
    const texts = layers.map((layer) => layer.textContent)
    const before = texts.slice(0, layers.indexOf(layer)).join("").length
    const offset = (node: Node, at: number) => {
      const upTo = document.createRange()
      upTo.setStart(layer, 0)
      upTo.setEnd(node, at)
      return before + upTo.toString().length
    }
    const end = layer.contains(range.endContainer) ? offset(range.endContainer, range.endOffset) : before + layer.textContent.length
    if (!pick(texts.join(""), offset(range.startContainer, range.startOffset), end, event.detail === 2)) return setPickedAt(null)
    const words = range.getBoundingClientRect()
    const sides = scrollerRef.current!.getBoundingClientRect()
    const at = { top: words.top, bottom: words.bottom, left: words.left, right: words.right, boxLeft: sides.left, boxRight: sides.right }
    // Not where a word picked to edit shows the form instead, hiding the preview.
    requestAnimationFrame(() => setPickedAt(scrollerRef.current?.offsetParent ? at : null))
  }

  // A PDF no drawing shows any more is closed by react-pdf, and forgotten here.
  useEffect(() => {
    for (const file of loadedRef.current.keys()) if (!files.includes(file)) loadedRef.current.delete(file)
  })

  function onLoadError(file: string) {
    loadedRef.current.delete(file)
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
      {pickedAt && <PickedToolbar at={pickedAt} />}
      {/* On wide screens the zoom is in a pill of its own floating over the foot of the page, below, and the page has this room. */}
      <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-3 md:px-8 xl:hidden">
        <div className="flex items-center font-mono text-xs text-ink-2">
          {zoomControls}
          {numPages > 1 && <span className="ml-3">{numPages} pages</span>}
        </div>
      </div>

      {/* Focusable, so the preview can be scrolled from the keyboard. On wide
          screens the pages scroll the panel's whole height, under soft edges
          (.preview-canvas in styles/editor.css) and the zoom pill, and can scroll
          clear of the pill at the end. */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        onCopy={(event) => pdf && copyPlainText(event, pdf.pdfjs)}
        onMouseUp={(event) => pickSelected(event.nativeEvent)}
        onScroll={() => setPickedAt(null)}
        className="preview-canvas relative min-h-[480px] flex-1 overflow-auto rounded-[inherit] px-5 pb-10 focus-visible:outline-offset-[-2px] md:px-8 xl:min-h-0 xl:px-3 xl:pb-20 xl:pt-5"
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
                            // A section's Delete finds the shown page's lines by it (penStrike.ts).
                            data-preview-page={drawing === shownDrawing ? index + 1 : undefined}
                            ref={
                              drawing === shownDrawing
                                ? (element) => {
                                    shownPagesRef.current[index] = element
                                  }
                                : undefined
                            }
                            className="relative bg-sheet shadow-[0_1px_3px_rgba(17,19,24,0.08),0_32px_64px_-24px_rgba(24,44,110,0.4)]"
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
                            {/* In Check mode, the checks' or the AI's pen marks, over the page that's shown, and a recruiter's eyes while the AI is asked. */}
                            {drawing === shownDrawing && drawing.ready && (
                              <>
                                <PreviewMarks page={index + 1} file={drawing.file} />
                                <PreviewGaze page={index + 1} file={drawing.file} />
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                </pdf.Document>
              ))}
          </div>
        )}
      </div>

      {/* On wide screens, the zoom in a pill of liquid glass floating over the foot of the page, which bends at its rim. */}
      <div className="glass glass-liquid zoom-glass absolute bottom-4 left-1/2 z-10 hidden h-10 -translate-x-1/2 items-center gap-1 rounded-full px-2 font-mono text-[14px] text-ink xl:flex">
        <LiquidLens bevel={16} strength={1} />
        {zoomControls}
        <span aria-hidden="true" className="mx-2 h-5 w-px bg-ink/10" />
        <button
          type="button"
          onClick={fit}
          title="Show the whole page"
          className="h-8 rounded-full px-3 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-fill"
        >
          Fit
        </button>
      </div>

      {error && (
        <p
          role="status"
          className="border-t border-rule px-5 py-2 text-xs text-alert md:px-8 xl:absolute xl:left-1/2 xl:top-9 xl:w-max xl:max-w-[90%] xl:-translate-x-1/2 xl:rounded-full xl:border-0 xl:bg-sheet xl:px-4 xl:shadow-[0_8px_24px_-12px_rgba(17,19,24,0.35)]"
        >
          Couldn&apos;t update the preview: {error}
        </p>
      )}
    </div>
  )
}

/** The zoom's − 100% + buttons: in the bar over the preview, or in the pill under the page on wide screens. */
function ZoomControls({ zoom, onOut, onReset, onIn }: { zoom: number; onOut: () => void; onReset: () => void; onIn: () => void }) {
  // At the smallest or largest zoom, its button stays focusable but does nothing, so the focus isn't lost.
  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-full text-[18px] text-ink-2 transition-colors hover:bg-fill hover:text-ink aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:bg-transparent aria-disabled:hover:text-ink-2"
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

/**
 * Widens a triple-click's selection to the whole printed line. pdf.js prints
 * a line as a run of text for each font in it, each placed on its own, so the
 * browser's triple-click selects one run and stops where a bold or italic
 * word starts.
 */
function selectLine(selection: Selection, layer: HTMLElement) {
  const start = selection.getRangeAt(0).startContainer
  const run = (start instanceof Element ? start : start.parentElement)?.closest<HTMLElement>('span[role="presentation"]')
  if (!run || !layer.contains(run)) return
  const runs = [...layer.querySelectorAll<HTMLElement>('span[role="presentation"]')]
  const line = run.getBoundingClientRect()
  const onLine = (other: HTMLElement) => {
    const { top, bottom } = other.getBoundingClientRect()
    return (top + bottom) / 2 > line.top && (top + bottom) / 2 < line.bottom
  }
  let first = runs.indexOf(run)
  let last = first
  while (first > 0 && onLine(runs[first - 1])) first--
  while (last < runs.length - 1 && onLine(runs[last + 1])) last++
  selection.setBaseAndExtent(runs[first], 0, runs[last], runs[last].childNodes.length)
}

/** A word a page prints, keyed by its font and itself, and where it is in its run of text on screen. */
interface PrintedWord extends Word {
  key: string
  run: HTMLElement
}

/** The words of a page whose text layer is drawn, or none if the layer isn't as pdf.js reads the page. */
async function wordsOnPage(loaded: PDFDocumentProxy, pageNumber: number, layer: Element): Promise<PrintedWord[]> {
  const page = await loaded.getPage(pageNumber)
  const { items } = await page.getTextContent()
  // pdf.js draws a span for each item of text that isn't empty, in order.
  const texts = items.filter((item): item is TextItem => "str" in item && item.str !== "")
  const runs = layer.querySelectorAll<HTMLElement>('span[role="presentation"]')
  if (runs.length !== texts.length || texts.some((item, index) => runs[index].textContent !== item.str)) return []
  return texts.flatMap((item, index) => {
    const font = fontName(page, item.fontName)
    return wordsIn(item.str).map((word) => ({ ...word, key: `${font} ${item.str.slice(word.start, word.end)}`, run: runs[index] }))
  })
}

/**
 * A font's own name, as "LibertinusSerif-Semibold". pdf.js's name for it is
 * numbered for each PDF, in the order its fonts are first used, so it can't be
 * compared from one PDF to the next. A subset's tag, as "ABCDEF+", is left
 * off, since it can change with the letters used.
 */
function fontName(page: PDFPageProxy, loadedName: string): string {
  if (!page.commonObjs.has(loadedName)) return loadedName
  const font: { name?: unknown } = page.commonObjs.get(loadedName)
  return typeof font.name === "string" ? font.name.replace(/^[A-Z]{6}\+/, "") : loadedName
}

/**
 * Lights up the words of `words` that aren't in `before`, a stretch of them
 * in a run at a time; a run that's new as a whole lights up itself.
 */
function lightUp(words: readonly PrintedWord[], before: readonly string[]) {
  const added = newWords(
    before,
    words.map((word) => word.key),
  )
  const stretches = new Map<HTMLElement, Word[]>()
  let count = 0
  words.forEach((word, index) => {
    if (!added[index]) return
    const inRun = stretches.get(word.run) ?? []
    const last = inRun[inRun.length - 1]
    if (last && added[index - 1] && words[index - 1].run === word.run) last.end = word.end
    else {
      inRun.push({ start: word.start, end: word.end })
      stretches.set(word.run, inRun)
      count++
    }
  })
  if (count > MAX_LIT) return
  stretches.forEach((inRun, run) => {
    const text = run.textContent
    if (inRun.length === 1 && !text.slice(0, inRun[0].start).trim() && !text.slice(inRun[0].end).trim()) {
      run.dataset.changed = ""
      return
    }
    const parts: (string | HTMLElement)[] = []
    let at = 0
    for (const { start, end } of inRun) {
      const lit = document.createElement("span")
      lit.dataset.changed = ""
      lit.textContent = text.slice(start, end)
      parts.push(text.slice(at, start), lit)
      at = end
    }
    run.replaceChildren(...parts, text.slice(at))
  })
}

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
function clampZoom(zoom: number, from: number) {
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
