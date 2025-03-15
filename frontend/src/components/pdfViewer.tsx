"use client";

import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { useState, useEffect, useRef } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfData: string | null;
}

export default function PDFViewer({ pdfData }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const baseWidth = 600; // Base width for the PDF

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    try {
      setNumPages(numPages);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortException") {
        console.error(error);
      }
    }
  }
  // Update your zoom handlers to use debounced versions
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2));
  }
  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  }

  // Mouse wheel zoom
  useEffect(() => {
    const pdfContainer = pdfContainerRef.current;
    if (!pdfContainer) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.deltaY < 0 ? handleZoomIn() : handleZoomOut();
      }
    };

    pdfContainer.addEventListener("wheel", handleWheel, { passive: false });
    return () => pdfContainer.removeEventListener("wheel", handleWheel);
  }, []);

  // Pinch-to-zoom
  useEffect(() => {
    const pdfContainer = pdfContainerRef.current;
    if (!pdfContainer) return;

    let initialDistance: number | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        initialDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && initialDistance !== null) {
        event.preventDefault();
        const currentDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );
        const zoomFactor = currentDistance / initialDistance;
        setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.5), 2));
      }
    };

    pdfContainer.addEventListener("touchstart", handleTouchStart);
    pdfContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      pdfContainer.removeEventListener("touchstart", handleTouchStart);
      pdfContainer.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <div className="w-full max-w-full h-[600px] border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-gray-50 flex flex-col">
      {/* Toolbar remains unchanged */}
      <div className="flex justify-between p-2 bg-gray-100 border-b border-gray-300">
        <div className="flex gap-2">
          <button onClick={handleZoomOut} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            Zoom Out
          </button>
          <button onClick={handleZoomIn} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            Zoom In
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
            disabled={pageNumber <= 1}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages || 1))}
            disabled={pageNumber >= (numPages || 1)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Updated PDF Viewer */}
      <div ref={pdfContainerRef} className="flex-1 overflow-auto bg-gray-300">
        {pdfData ? (
          <div 
            className="mx-auto" 
            style={{ width: baseWidth * scale,
                      minHeight: (baseWidth * 1.4142) * scale
             }} // Dynamic width based on scale
          >
            <Document key={pdfData} file={pdfData} onLoadSuccess={onDocumentLoadSuccess}>
              <Page 
                pageNumber={pageNumber} 
                width={baseWidth * scale} // Scale the PDF content
                className="bg-transparent"
              />
            </Document>
          </div>
        ) : (
          <p className="text-center text-gray-500">No PDF to display</p>
        )}
      </div>
    </div>
  );
}