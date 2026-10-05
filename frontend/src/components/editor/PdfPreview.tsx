"use client"

import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import { Loader2 } from "lucide-react"

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
// Space between pages, matching gap-4.
const PAGE_GAP = 16

interface PdfPreviewProps {
  /** Object URL of the latest compiled PDF. */
  pdfUrl: string | null
  error?: string | null
}

export default function PdfPreview({ pdfUrl, error }: PdfPreviewProps) {
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
  const isLoading = documents.length > 0 && !documents.some((doc) => doc.ready)
  const pageWidth = Math.min(availableWidth, MAX_PAGE_WIDTH) * zoom

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

  const iconButton = "inline-flex h-8 w-8 items-center justify-center text-ink-2 transition-colors hover:text-ink disabled:opacity-30"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
        <span className="label-mono text-ink-2">Preview · updates as you type</span>
        <div className="flex items-center font-mono text-xs text-ink-2">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))} className={iconButton}>
            −
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom" className="w-12 text-center hover:text-ink">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))} className={iconButton}>
            +
          </button>
          {numPages > 1 && <span className="ml-3">{numPages} pages</span>}
        </div>
      </div>

      <div ref={scrollerRef} className="relative min-h-[480px] flex-1 overflow-auto px-5 pb-10 md:px-8">
        {documents.length === 0 || loadError ? (
          <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-ink-2">
            {loadError || error ? "The preview couldn't be built." : "Your resume will appear here."}
          </div>
        ) : (
          <div
            className="relative mx-auto"
            style={{ width: pageWidth, minHeight: numPages * pageWidth * (11 / 8.5) + (numPages - 1) * PAGE_GAP }}
          >
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-sheet">
                <Loader2 className="h-5 w-5 animate-spin text-ink-2" aria-label="Loading preview" />
              </div>
            )}
            {documents.map((doc) => (
              <div key={doc.file} className={doc === shownDocument ? "" : "invisible absolute inset-0"}>
                <Document
                  file={doc.file}
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
                      renderTextLayer
                      renderAnnotationLayer
                      onRenderSuccess={() => onRenderSuccess(doc.file, index + 1)}
                    />
                  ))}
                </Document>
              </div>
            ))}
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

function clampZoom(zoom: number) {
  return Math.round(Math.min(Math.max(zoom, 0.5), 2.5) * 10) / 10
}
