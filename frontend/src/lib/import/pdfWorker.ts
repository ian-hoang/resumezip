// pdf.js's worker, which reads and draws PDFs off the page's thread, started
// here rather than by pdf.js. When a worker pdf.js starts fails to load its
// script (a dropped connection, a download cut short), pdf.js gives up on
// workers for the rest of the visit and imports the script into the page
// instead. That import usually fails as well, and pdf.js keeps the failure: no
// PDF can be read or drawn until the page is reloaded. A worker started here
// is tried once more if it fails, and pdf.js is handed one that has started.
//
// There's no fallback after that: the page would only import the same script.

import type { PDFWorker } from "pdfjs-dist"

// The worker is bundled with the app. pdfjs-dist is pinned to react-pdf's
// version so both share one copy and the worker matches the library.
export const PDF_WORKER_URL = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

const TRIES = 2
// How long to wait before trying again, so a connection that dropped has a moment to come back.
const RETRY_MS = 1000

/**
 * Starts a pdf.js worker to give `getDocument`, trying again once if it fails
 * to start. Destroying it ends the worker. Rejects if neither try starts it, or
 * once `signal` aborts.
 */
export async function startPdfWorker(PdfWorker: typeof PDFWorker, signal?: AbortSignal): Promise<PDFWorker> {
  for (let tried = 1; ; tried++) {
    try {
      const worker = await started(signal)
      const pdfWorker: PDFWorker = PdfWorker.fromPort({ port: worker })
      // pdf.js leaves running a worker it was handed.
      const destroy = pdfWorker.destroy.bind(pdfWorker)
      pdfWorker.destroy = () => {
        destroy()
        worker.terminate()
      }
      return pdfWorker
    } catch (error) {
      if (tried === TRIES || signal?.aborted) throw error
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
    }
  }
}

// A new worker, once its script has loaded and it says it's ready.
function started(signal?: AbortSignal): Promise<Worker> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const worker = new Worker(PDF_WORKER_URL, { type: "module" })
    const waiting = new AbortController()
    const fail = (reason: unknown) => {
      waiting.abort()
      worker.terminate()
      reject(reason)
    }
    worker.addEventListener(
      "message",
      ({ data }) => {
        if (data?.action !== "ready") return
        waiting.abort()
        resolve(worker)
      },
      { signal: waiting.signal },
    )
    worker.addEventListener("error", () => fail(new Error("pdf.js's worker couldn't start")), { signal: waiting.signal })
    signal?.addEventListener("abort", () => fail(signal.reason), { signal: waiting.signal })
  })
}
