"use client"

import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import PrintingPage from "./PrintingPage"

// The worker is bundled with the app, like the one lib/import/open.ts uses.
// pdfjs-dist is pinned to react-pdf's version so both share one copy and the
// worker matches the library.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

// A PDF being shown or loaded in the background. A new PDF stays hidden until
// all its pages have rendered, so live previews swap in without flashing.
interface LoadedDocument {
  file: string
  pages: number | null
  /** The page numbers drawn so far. */
  rendered: number[]
  ready: boolean
}

const MAX_PAGE_WIDTH = 640
const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
// Space between pages, matching gap-4.
const PAGE_GAP = 16
// How long the stand-in page takes to fade out over the first preview.
const FADE_MS = 300

interface PdfPreviewProps {
  /** Object URL of the latest compiled PDF. */
  pdfUrl: string | null
  error?: string | null
  /** A new PDF is being built in another template, so the one on screen is out of date. */
  updating?: boolean
  /** Drawn around the pages, behind them, with room left for it above them. */
  frame?: ReactNode
  /** Drawn over the pages, which it can measure by their text (`[data-preview-shown] .react-pdf__Page__textContent`). */
  overlay?: ReactNode
}

export default function PdfPreview({ pdfUrl, error, updating = false, frame, overlay }: PdfPreviewProps) {
  const [documents, setDocuments] = useState<LoadedDocument[]>([])
  const [zoom, setZoom] = useState(1)
  const [loadError, setLoadError] = useState(false)
  const [availableWidth, setAvailableWidth] = useState(MAX_PAGE_WIDTH)
  const scrollerRef = useRef<HTMLDivElement>(null)

  // Keep the PDF on screen while the new one loads; drop older pending ones.
  useEffect(() => {
    setLoadError(false)
    setDocuments((docs) => {
      if (!pdfUrl) return []
      if (docs.some((doc) => doc.file === pdfUrl)) return docs
      const shown = docs.filter((doc) => doc.ready).slice(-1)
      return [...shown, { file: pdfUrl, pages: null, rendered: [], ready: false }]
    })
  }, [pdfUrl])

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

  // Ctrl/Cmd + scroll zooms.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setZoom((z) => clampZoom(z + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)))
    }
    scroller.addEventListener("wheel", onWheel, { passive: false })
    return () => scroller.removeEventListener("wheel", onWheel)
  }, [])

  const shownDocument = documents.findLast((doc) => doc.ready) ?? documents[documents.length - 1]
  const numPages = shownDocument?.pages ?? 1
  const waiting = !documents.some((doc) => doc.ready)
  const pageWidth = Math.min(availableWidth, MAX_PAGE_WIDTH) * zoom

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

  function onLoadSuccess(file: string, pages: number) {
    setDocuments((docs) => docs.map((doc) => (doc.file === file ? { ...doc, pages } : doc)))
  }

  // Once every page of a PDF has rendered, it's shown and the older ones are dropped.
  function onRenderSuccess(file: string, page: number) {
    setDocuments((docs) => {
      const index = docs.findIndex((doc) => doc.file === file)
      if (index === -1 || docs[index].ready) return docs
      const doc = docs[index]
      const rendered = doc.rendered.includes(page) ? doc.rendered : [...doc.rendered, page]
      if (doc.pages === null || rendered.length < doc.pages) {
        return docs.map((other, i) => (i === index ? { ...other, rendered } : other))
      }
      return docs.slice(index).map((other, i) => (i === 0 ? { ...other, rendered, ready: true } : other))
    })
  }

  function onLoadError(file: string) {
    setDocuments((docs) => docs.filter((doc) => doc.file !== file))
    if (file === pdfUrl) setLoadError(true)
  }

  // At the smallest or largest zoom, its button stays focusable but does nothing, as MoveButtons do.
  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center text-ink-2 transition-colors hover:text-ink aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:text-ink-2"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
        <span className="label-mono text-ink-2">{updating ? "Preview · updating…" : "Preview · updates as you type"}</span>
        <div className="flex items-center font-mono text-xs text-ink-2">
          <button
            type="button"
            aria-label="Zoom out"
            aria-disabled={zoom <= MIN_ZOOM || undefined}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            className={iconButton}
          >
            −
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom" className="w-12 text-center hover:text-ink">
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            aria-disabled={zoom >= MAX_ZOOM || undefined}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            className={iconButton}
          >
            +
          </button>
          {numPages > 1 && <span className="ml-3">{numPages} pages</span>}
        </div>
      </div>

      {/* Focusable, so the preview can be scrolled from the keyboard. */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        onCopy={copyPlainText}
        className="relative min-h-[480px] flex-1 overflow-auto px-5 pb-10 focus-visible:outline-offset-[-2px] md:px-8"
      >
        {loadError || (error && documents.length === 0) ? (
          <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-ink-2">
            The preview couldn&apos;t be built.
          </div>
        ) : (
          // The out-of-date page fades a little, after a moment, so a quick switch doesn't flicker.
          <div
            className={`relative isolate mx-auto transition-[opacity,margin] duration-300 ${frame ? "mt-11" : ""} ${updating ? "opacity-50 delay-150" : ""}`}
            style={{ width: pageWidth, minHeight: numPages * pageWidth * (11 / 8.5) + (numPages - 1) * PAGE_GAP }}
          >
            {frame}
            {!faded && <PrintingPage width={pageWidth} leaving={!waiting} />}
            {documents.map((doc) => (
              <div
                key={doc.file}
                data-preview-shown={doc === shownDocument || undefined}
                className={doc === shownDocument ? "" : "invisible absolute inset-0"}
              >
                <Document
                  file={doc.file}
                  // A link in the preview, such as the person's LinkedIn, opens in a new tab rather than leaving the editor.
                  externalLinkTarget="_blank"
                  onLoadSuccess={({ numPages }) => onLoadSuccess(doc.file, numPages)}
                  onLoadError={() => onLoadError(doc.file)}
                  loading={null}
                  className="flex flex-col gap-4"
                >
                  {/* Every page, one under the other; the panel scrolls through them. */}
                  {Array.from({ length: doc.pages ?? 0 }, (_, index) => (
                    <Page
                      key={index}
                      pageNumber={index + 1}
                      width={pageWidth}
                      loading={null}
                      className="shadow-[0_1px_2px_rgba(17,19,24,0.06),0_18px_40px_-16px_rgba(17,19,24,0.22)]"
                      // The text layer, for selecting and copying, is the costliest
                      // part. It's drawn once a PDF is on screen, not for one
                      // loading out of sight that a newer one may replace.
                      renderTextLayer={doc.ready && doc === shownDocument}
                      renderAnnotationLayer
                      onRenderSuccess={() => onRenderSuccess(doc.file, index + 1)}
                    />
                  ))}
                </Document>
              </div>
            ))}
            {overlay}
          </div>
        )}
      </div>

      {error && (
        <p role="status" className="border-t border-rule px-5 py-2 text-xs text-[#b42318] md:px-8">
          Couldn&apos;t update the preview: {error}
        </p>
      )}
    </div>
  )
}

// Copying from the preview gives plain text, as pdf.js's own viewer does. The
// selected text is the invisible copy over the canvas, so the browser's usual
// rich copy would carry its transparent color and placeholder font into
// whatever it's pasted into. The text is normalized the same way too, so a
// ligature such as "ﬁ" would paste as "fi".
function copyPlainText(event: ClipboardEvent) {
  const text = window.getSelection()?.toString()
  if (!text) return
  event.clipboardData.setData("text/plain", pdfjs.normalizeUnicode(text))
  event.preventDefault()
}

function clampZoom(zoom: number) {
  return Math.round(Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM) * 10) / 10
}
