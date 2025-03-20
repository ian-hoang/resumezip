"use client"

import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import { useState, useEffect, useRef } from "react"
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Download,
  Loader2,
  FileText,
  Search,
  RotateCw,
} from "lucide-react"

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  pdfData: string | null
}

export default function PDFViewer({ pdfData }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchText, setSearchText] = useState("")

  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const baseWidth = 600 // Base width for the PDF

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    try {
      setNumPages(numPages)
      setIsLoading(false)
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortException") {
        console.error(error)
      }
    }
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2.5))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5))
  }

  const handleZoomReset = () => {
    setScale(1)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleDownload = () => {
    if (pdfData) {
      const link = document.createElement("a")
      link.href = pdfData
      link.download = "document.pdf"
      link.click()
    }
  }

  // Mouse wheel zoom
  useEffect(() => {
    const pdfContainer = pdfContainerRef.current
    if (!pdfContainer) return

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        event.deltaY < 0 ? handleZoomIn() : handleZoomOut()
      }
    }

    pdfContainer.addEventListener("wheel", handleWheel, { passive: false })
    return () => pdfContainer.removeEventListener("wheel", handleWheel)
  }, [])

  // Pinch-to-zoom
  useEffect(() => {
    const pdfContainer = pdfContainerRef.current
    if (!pdfContainer) return

    let initialDistance: number | null = null

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        initialDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        )
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && initialDistance !== null) {
        event.preventDefault()
        const currentDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        )
        const zoomFactor = currentDistance / initialDistance
        setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.5), 2.5))
        initialDistance = currentDistance
      }
    }

    pdfContainer.addEventListener("touchstart", handleTouchStart)
    pdfContainer.addEventListener("touchmove", handleTouchMove, { passive: false })
    return () => {
      pdfContainer.removeEventListener("touchstart", handleTouchStart)
      pdfContainer.removeEventListener("touchmove", handleTouchMove)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key) {
        case "ArrowLeft":
          setPageNumber((prev) => Math.max(prev - 1, 1))
          break
        case "ArrowRight":
          setPageNumber((prev) => Math.min(prev + 1, numPages || 1))
          break
        case "+":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomIn()
          }
          break
        case "-":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomOut()
          }
          break
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomReset()
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [numPages])

  return (
    <div
      ref={viewerRef}
      className="w-full max-w-full h-[600px] border border-gray-200 rounded-lg overflow-hidden shadow-lg bg-gray-50 flex flex-col"
    >
      {/* Enhanced Toolbar */}
      <div className="flex flex-col sm:flex-row sm:justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2 sm:mb-0">
          <div className="flex items-center bg-gray-100 rounded-md p-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              aria-label="Zoom out"
              title="Zoom out (Ctrl+-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <div className="px-2 text-sm font-medium">{Math.round(scale * 100)}%</div>

            <button
              onClick={handleZoomIn}
              className="p-1.5 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              aria-label="Zoom in"
              title="Zoom in (Ctrl++)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleZoomReset}
            className="p-1.5 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            aria-label="Reset zoom"
            title="Reset zoom (Ctrl+0)"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {pdfData && (
            <button
              onClick={handleDownload}
              className="p-1.5 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
              aria-label="Download PDF"
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
            disabled={pageNumber <= 1}
            className="p-1.5 text-gray-700 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Previous page"
            title="Previous page (Left arrow)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={pageNumber}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value)
                if (value >= 1 && value <= (numPages || 1)) {
                  setPageNumber(value)
                }
              }}
              className="w-12 text-center p-1 text-sm border border-gray-300 rounded"
              aria-label="Page number"
            />
            <span className="text-sm text-gray-600">/ {numPages || 1}</span>
          </div>

          <button
            onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages || 1))}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1.5 text-gray-700 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Next page"
            title="Next page (Right arrow)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div ref={pdfContainerRef} className="flex-1 overflow-auto bg-gray-200 relative">
        {pdfData ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                  <p className="text-sm text-gray-600">Loading PDF...</p>
                </div>
              </div>
            )}
            <div
              className="mx-auto"
              style={{
                width: baseWidth * scale,
                minHeight: baseWidth * 1.4142 * scale,
              }}
            >
              <Document
                key={pdfData}
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={() => setIsLoading(false)}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={baseWidth * scale}
                  className="shadow-lg"
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">No PDF Document</h3>
            <p className="text-sm text-gray-500 max-w-md">
              Upload or select a PDF document to view it here. You can zoom, navigate pages, and search within the
              document.
            </p>
          </div>
        )}
      </div>

      {/* Footer with keyboard shortcuts */}
      <div className="p-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-center">
        <div className="hidden sm:flex items-center gap-4">
          <span>
            Zoom: <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">Ctrl+Scroll</kbd>
          </span>
          <span>
            Navigate: <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">←</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">→</kbd>
          </span>
        </div>
        <div className="sm:hidden">Pinch to zoom, swipe to navigate</div>
      </div>
    </div>
  )
}

