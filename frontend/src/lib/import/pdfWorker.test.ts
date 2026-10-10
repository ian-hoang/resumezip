import type { PDFWorker } from "pdfjs-dist"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { startPdfWorker } from "./pdfWorker"

// Stands in for a worker loading pdf.js's script: a test says when it has
// loaded (ready) or failed to (fail), as a real one does with a message or an
// error event.
class FakeWorker extends EventTarget {
  ended = false
  constructor(
    readonly url: string,
    readonly options: WorkerOptions,
  ) {
    super()
    workers.push(this)
  }
  ready() {
    this.dispatchEvent(new MessageEvent("message", { data: { sourceName: "worker", targetName: "main", action: "ready", data: null } }))
  }
  fail() {
    this.dispatchEvent(new Event("error"))
  }
  terminate() {
    this.ended = true
  }
}

// Stands in for pdf.js's PDFWorker, handed a worker that has started.
class FakePdfWorker {
  destroyed = false
  constructor(readonly port: FakeWorker) {}
  static fromPort({ port }: { port: FakeWorker }) {
    return new FakePdfWorker(port)
  }
  destroy() {
    this.destroyed = true
  }
}
const PdfWorker = FakePdfWorker as unknown as typeof PDFWorker

let workers: FakeWorker[]

beforeEach(() => {
  workers = []
  vi.stubGlobal("Worker", FakeWorker)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Lets the promises waiting on what just happened go on. */
const settle = () => vi.advanceTimersByTimeAsync(0)

test("hands pdf.js a worker that has loaded pdf.js's script", async () => {
  const starting = startPdfWorker(PdfWorker)
  expect(workers).toHaveLength(1)
  expect(workers[0].url).toMatch(/pdf\.worker\.min\.mjs$/)
  expect(workers[0].options).toEqual({ type: "module" })
  workers[0].ready()
  const pdfWorker = (await starting) as unknown as FakePdfWorker
  expect(pdfWorker.port).toBe(workers[0])
  expect(workers[0].ended).toBe(false)
})

test("starts a worker again when the first can't load pdf.js's script", async () => {
  const starting = startPdfWorker(PdfWorker)
  workers[0].fail()
  await settle()
  expect(workers[0].ended).toBe(true)
  // It waits a moment, for a connection that dropped to come back.
  expect(workers).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1000)
  expect(workers).toHaveLength(2)
  workers[1].ready()
  const pdfWorker = (await starting) as unknown as FakePdfWorker
  expect(pdfWorker.port).toBe(workers[1])
})

test("gives up once the second worker fails too", async () => {
  const starting = startPdfWorker(PdfWorker)
  const failed = expect(starting).rejects.toThrow("pdf.js's worker couldn't start")
  workers[0].fail()
  await vi.advanceTimersByTimeAsync(1000)
  workers[1].fail()
  await failed
  expect(workers.map(({ ended }) => ended)).toEqual([true, true])
})

test("ends its worker when it's destroyed, as pdf.js leaves running a worker it was handed", async () => {
  const starting = startPdfWorker(PdfWorker)
  workers[0].ready()
  const pdfWorker = await starting
  pdfWorker.destroy()
  expect((pdfWorker as unknown as FakePdfWorker).destroyed).toBe(true)
  expect(workers[0].ended).toBe(true)
})

test("stops starting a worker once it's no longer wanted", async () => {
  const stop = new AbortController()
  const starting = startPdfWorker(PdfWorker, stop.signal)
  const failed = expect(starting).rejects.toThrow("Closed")
  stop.abort(new Error("Closed"))
  await failed
  expect(workers[0].ended).toBe(true)
  await vi.advanceTimersByTimeAsync(1000)
  expect(workers).toHaveLength(1)
})
