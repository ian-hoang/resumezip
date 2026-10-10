import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { CompileRequest, CompileResponse, CompilerStatus, PdfError, WorkerMessage, WorkerRequest } from "./compile"

// Stands in for the Typst worker. Each test says how it answers (undefined
// means it never does) and how long it takes.
class FakeWorker {
  static made: FakeWorker[] = []
  /** Every request any worker was sent. */
  static received: CompileRequest[] = []
  static answer: (request: CompileRequest) => CompileResponse | undefined = () => undefined
  static delay: (request: CompileRequest) => number = () => 10
  /** What it sends, 10 ms apart, when asked to load the compiler ahead of a PDF. */
  static loading: WorkerMessage[] = []
  onmessage: ((event: { data: WorkerMessage }) => void) | null = null
  onerror: ((event: ReturnType<typeof workerError>) => void) | null = null
  terminated = false
  /** The requests to start loading the compiler. */
  loadRequests: Extract<WorkerRequest, { load: true }>[] = []
  /** How many times it was asked to download the compiler ahead, without building it. */
  prefetches = 0

  constructor() {
    FakeWorker.made.push(this)
  }

  postMessage(request: WorkerRequest) {
    if ("prefetch" in request) {
      this.prefetches++
      return
    }
    if ("load" in request) {
      this.loadRequests.push(request)
      FakeWorker.loading.forEach((message, index) => setTimeout(() => this.send(message), (index + 1) * 10))
      return
    }
    FakeWorker.received.push(request)
    const response = FakeWorker.answer(request)
    if (response) setTimeout(() => this.send(response), FakeWorker.delay(request))
  }

  send(message: WorkerMessage) {
    if (!this.terminated) this.onmessage?.({ data: message })
  }

  terminate() {
    this.terminated = true
  }
}

// An error from a worker, as the page gets it, saying whether the page handled it.
function workerError(message: string) {
  return {
    message,
    handled: false,
    preventDefault() {
      this.handled = true
    },
  }
}

const PDF = new Uint8Array([37, 80, 68, 70])
const makesPdf = ({ id }: CompileRequest) => ({ id, pdf: PDF })
const silent = () => undefined
const resume = { resumeTitle: "Test resume" }

let compileResume: typeof import("./compile").compileResume
let compilePreview: typeof import("./compile").compilePreview
let printedOf: typeof import("./compile").printedOf
let loadAhead: typeof import("./compile").loadCompiler
let prefetch: typeof import("./compile").prefetchCompiler
let compilerStatus: typeof import("./compile").compilerStatus
let onCompilerStatus: typeof import("./compile").onCompilerStatus
let savingData: typeof import("./compile").savingData
let previewFit: typeof import("./compile").previewFit
let onPreviewFit: typeof import("./compile").onPreviewFit
let forgetPreviewFit: typeof import("./compile").forgetPreviewFit

/** The elements the page added to its head. */
let addedToHead: object[] = []

beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal("Worker", FakeWorker)
  addedToHead = []
  vi.stubGlobal("document", { createElement: () => ({}), head: { append: (element: object) => addedToHead.push(element) } })
  FakeWorker.made = []
  FakeWorker.received = []
  FakeWorker.answer = makesPdf
  FakeWorker.delay = () => 10
  FakeWorker.loading = []
  // A fresh module each time, so no worker carries over.
  vi.resetModules()
  ;({
    compileResume,
    compilePreview,
    printedOf,
    loadCompiler: loadAhead,
    prefetchCompiler: prefetch,
    compilerStatus,
    onCompilerStatus,
    savingData,
    previewFit,
    onPreviewFit,
    forgetPreviewFit,
  } = await import("./compile"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// A compile that can be checked without waiting for it, as { value } or { error }.
function track<T>(promise: Promise<T>) {
  const result: { value?: T; error?: PdfError; settled: boolean } = { settled: false }
  promise.then(
    (value) => Object.assign(result, { value, settled: true }),
    (error: PdfError) => Object.assign(result, { error, settled: true }),
  )
  return result
}

// Loads the compiler by making one PDF.
async function loadCompiler() {
  const first = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(first.value).toEqual(PDF)
}

test("an ordinary compile returns the worker's PDF", async () => {
  const result = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(result.value).toEqual(PDF)
})

test("a resume Typst can't lay out rejects with Typst's error", async () => {
  FakeWorker.answer = ({ id }) => ({ id, error: "unknown variable: foo", failure: "resume" })
  const result = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(result.error?.message).toBe("unknown variable: foo")
  expect(result.error?.failure).toBe("resume")
  expect(FakeWorker.made[0].terminated).toBe(false)
})

test("a download that stops gives up after 30 s, and trying again starts a fresh worker", async () => {
  FakeWorker.answer = silent
  const first = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(29_999)
  expect(first.settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(first.error?.message).toBe("Making the PDF took too long")
  expect(first.error?.failure).toBe("connection")
  expect(FakeWorker.made[0].terminated).toBe(true)

  FakeWorker.answer = makesPdf
  const next = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(next.value).toEqual(PDF)
  expect(FakeWorker.made).toHaveLength(2)
})

test("a compiler that couldn't be downloaded is tried again in the same worker", async () => {
  FakeWorker.answer = ({ id }) => ({ id, error: "Failed to fetch", failure: "connection" })
  const offline = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(offline.error?.failure).toBe("connection")
  expect(FakeWorker.made[0].terminated).toBe(false)

  // Still loading, so the next try gets the loading wait, not the 20 s one.
  FakeWorker.answer = silent
  const stalled = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(20_000)
  expect(stalled.settled).toBe(false)
  FakeWorker.made[0].send({ id: 1, pdf: PDF })
  await vi.advanceTimersByTimeAsync(0)
  expect(stalled.value).toEqual(PDF)
  expect(FakeWorker.made).toHaveLength(1)
})

test("a slow download that keeps arriving isn't given up on", async () => {
  FakeWorker.answer = silent
  const result = track(compileResume(resume))
  // Five minutes of a little arriving every 20 s.
  for (let i = 0; i < 15; i++) {
    await vi.advanceTimersByTimeAsync(20_000)
    FakeWorker.made[0].send({ progress: true, downloaded: i / 15 })
  }
  expect(result.settled).toBe(false)
  FakeWorker.made[0].send({ id: 0, pdf: PDF })
  await vi.advanceTimersByTimeAsync(0)
  expect(result.value).toEqual(PDF)
})

test("once the compiler has loaded, a stuck PDF gives up after 20 s", async () => {
  await loadCompiler()
  FakeWorker.answer = silent
  const result = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(19_999)
  expect(result.settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(result.error?.failure).toBe("crash")
  expect(FakeWorker.made[0].terminated).toBe(true)
})

test("after a Typst error, the compiler has loaded, so a stuck PDF gives up after 20 s", async () => {
  FakeWorker.answer = ({ id }) => ({ id, error: "unknown variable: foo", failure: "resume" })
  await vi.advanceTimersByTimeAsync(10)
  track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  FakeWorker.answer = silent
  const result = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(20_000)
  expect(result.error?.failure).toBe("crash")
})

test("a long queue of PDFs that keep coming back isn't given up on", async () => {
  await loadCompiler()
  // 40 requests, answered one a second: the last after 40 s.
  FakeWorker.delay = ({ id }) => id * 1_000
  const results = Array.from({ length: 40 }, () => track(compileResume(resume)))
  await vi.advanceTimersByTimeAsync(40_000)
  expect(results.every((result) => result.value === PDF)).toBe(true)
  expect(FakeWorker.made).toHaveLength(1)
})

test("new requests don't keep a stuck worker going", async () => {
  await loadCompiler()
  FakeWorker.answer = silent
  const results = [track(compileResume(resume))]
  for (let i = 0; i < 3; i++) {
    await vi.advanceTimersByTimeAsync(5_000)
    results.push(track(compileResume(resume)))
  }
  await vi.advanceTimersByTimeAsync(5_000)
  expect(results.map((result) => result.error?.failure)).toEqual(["crash", "crash", "crash", "crash"])
})

test("a compiler that breaks fails everything in flight, and the next request starts a fresh worker", async () => {
  await loadCompiler()
  FakeWorker.answer = ({ id }) => (id === 1 ? { id, error: "RuntimeError: unreachable", failure: "crash" } : undefined)
  const broken = track(compileResume(resume))
  const waiting = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(broken.error?.message).toBe("RuntimeError: unreachable")
  expect(waiting.error?.failure).toBe("crash")
  expect(FakeWorker.made[0].terminated).toBe(true)

  FakeWorker.answer = makesPdf
  const next = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(next.value).toEqual(PDF)
  expect(FakeWorker.made).toHaveLength(2)
})

test("a broken worker fails everything in flight, and the next request starts a fresh worker", async () => {
  FakeWorker.answer = silent
  const both = [track(compileResume(resume)), track(compileResume(resume))]
  FakeWorker.made[0].onerror?.(workerError("out of memory"))
  await vi.advanceTimersByTimeAsync(0)
  expect(both.map((result) => result.error?.message)).toEqual(["out of memory", "out of memory"])

  FakeWorker.answer = makesPdf
  const next = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(next.value).toEqual(PDF)
  expect(FakeWorker.made).toHaveLength(2)
})

test("a worker that can't start is replaced, and its error isn't also left to the page as an uncaught one", () => {
  loadAhead()
  // As WebKit reports a worker whose scripts were cut short as the page was left.
  const error = workerError("Load failed")
  FakeWorker.made[0].onerror?.(error)
  expect(error.handled).toBe(true)
  expect(FakeWorker.made[0].terminated).toBe(true)
})

test("an error from a worker that was already replaced leaves the new one alone", async () => {
  FakeWorker.answer = silent
  track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(30_000)

  FakeWorker.answer = makesPdf
  const next = track(compileResume(resume))
  FakeWorker.made[0].onerror?.(workerError("late error"))
  await vi.advanceTimersByTimeAsync(10)
  expect(next.value).toEqual(PDF)
  expect(FakeWorker.made[1].terminated).toBe(false)
})

test("a request that can't be sent fails alone, and doesn't restart the worker later", async () => {
  await loadCompiler()
  FakeWorker.answer = () => {
    throw new DOMException("could not be cloned", "DataCloneError")
  }
  const unsendable = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(0)
  expect(unsendable.error?.name).toBe("DataCloneError")

  await vi.advanceTimersByTimeAsync(60_000)
  expect(FakeWorker.made[0].terminated).toBe(false)
})

// A resume printing `name`, as a preview request.
const printing = (name: string) => printedOf({ profileSection: { fullName: name } })
const namesReceived = () => FakeWorker.received.map((request) => request.data.profile.name)

test("renaming a resume doesn't change what it prints", () => {
  const resume = { resumeTitle: "Old name", profileSection: { fullName: "Ada Lovelace" } }
  expect(printedOf({ ...resume, resumeTitle: "New name" })).toEqual(printedOf(resume))
  expect(printedOf({ ...resume, profileSection: { fullName: "Ada King" } })).not.toEqual(printedOf(resume))
})

test("changing Fine-tune's settings changes what a resume prints", () => {
  const resume = { profileSection: { fullName: "Ada Lovelace" } }
  expect(printedOf({ ...resume, tune: { size: 1.1 } })).not.toEqual(printedOf(resume))
  expect(printedOf({ ...resume, tune: { onePage: true } })).not.toEqual(printedOf(resume))
  expect(printedOf({ ...resume, tune: null })).toEqual(printedOf(resume))
})

describe("what keeping the preview to one page took", () => {
  const onePage = (name: string) => printedOf({ profileSection: { fullName: name }, tune: { size: 1.1, onePage: true } })
  const fitted = { size: 1.05, fits: true }

  test("is told once the preview that did it is ready, with what it printed", async () => {
    FakeWorker.answer = ({ id, data }) => (data.tune.onePage ? { id, pdf: PDF, fit: fitted } : { id, pdf: PDF })
    const heard = vi.fn()
    onPreviewFit(heard)
    expect(previewFit()).toBeNull()

    const preview = track(compilePreview(onePage("Ada")))
    await vi.advanceTimersByTimeAsync(10)
    expect(preview.value).toMatch(/^blob:/)
    expect(previewFit()).toEqual({ template: "jake", tune: { size: 1.1, margin: 1, leading: 1, paper: "", onePage: true }, fit: fitted })
    expect(heard).toHaveBeenCalledTimes(1)

    // A preview that isn't kept to one page has nothing to tell.
    track(compilePreview(printing("Ada")))
    await vi.advanceTimersByTimeAsync(10)
    expect(previewFit()).toBeNull()
    expect(heard).toHaveBeenCalledTimes(2)
  })

  test("isn't told for a preview withdrawn while it compiled, which isn't shown", async () => {
    FakeWorker.answer = ({ id }) => ({ id, pdf: PDF, fit: fitted })
    const wanted = new AbortController()
    const preview = track(compilePreview(onePage("Ada"), wanted.signal))
    await vi.advanceTimersByTimeAsync(5)
    wanted.abort()
    await vi.advanceTimersByTimeAsync(10)
    expect(preview.value).toMatch(/^blob:/)
    expect(previewFit()).toBeNull()
  })

  test("is forgotten when a preview can't be built, and when the editor opens another resume", async () => {
    FakeWorker.answer = ({ id }) => ({ id, pdf: PDF, fit: fitted })
    track(compilePreview(onePage("Ada")))
    await vi.advanceTimersByTimeAsync(10)
    expect(previewFit()).not.toBeNull()

    FakeWorker.answer = ({ id }) => ({ id, error: "unknown variable: foo", failure: "resume" })
    track(compilePreview(onePage("Ada Lovelace")))
    await vi.advanceTimersByTimeAsync(10)
    expect(previewFit()).toBeNull()

    FakeWorker.answer = ({ id }) => ({ id, pdf: PDF, fit: fitted })
    track(compilePreview(onePage("Ada")))
    await vi.advanceTimersByTimeAsync(10)
    const heard = vi.fn()
    onPreviewFit(heard)
    forgetPreviewFit()
    expect(previewFit()).toBeNull()
    expect(heard).toHaveBeenCalledTimes(1)
  })

  test("isn't told for a download", async () => {
    FakeWorker.answer = ({ id }) => ({ id, pdf: PDF, fit: fitted })
    await Promise.all([compileResume({ tune: { onePage: true } }), vi.advanceTimersByTimeAsync(10)])
    expect(previewFit()).toBeNull()
  })
})

test("while previews keep coming, one compiles and only the newest waits", async () => {
  FakeWorker.delay = () => 100
  const previews = ["A", "Ad", "Ada", "Ada L", "Ada Lo"].map((name) => track(compilePreview(printing(name))))
  await vi.advanceTimersByTimeAsync(0)
  expect(previews.slice(1, 4).map((preview) => preview.error?.name)).toEqual(["Superseded", "Superseded", "Superseded"])

  await vi.advanceTimersByTimeAsync(200)
  expect(previews[0].value).toMatch(/^blob:/)
  expect(previews[4].value).toMatch(/^blob:/)
  // The first, then the latest. The ones in between were never compiled.
  expect(namesReceived()).toEqual(["A", "Ada Lo"])
})

test("downloads are never replaced by previews", async () => {
  FakeWorker.delay = () => 100
  const first = track(compilePreview(printing("A")))
  const download = track(compileResume({ profileSection: { fullName: "Download" } }))
  const replaced = track(compilePreview(printing("Ad")))
  const latest = track(compilePreview(printing("Ada")))
  await vi.advanceTimersByTimeAsync(300)
  expect(download.value).toEqual(PDF)
  expect(replaced.error?.name).toBe("Superseded")
  expect([first.value, latest.value]).toEqual([expect.stringMatching(/^blob:/), expect.stringMatching(/^blob:/)])
  expect(namesReceived()).toEqual(["A", "Download", "Ada"])
})

test("a stuck worker fails the waiting preview too", async () => {
  await loadCompiler()
  FakeWorker.answer = silent
  const running = track(compilePreview(printing("A")))
  const waiting = track(compilePreview(printing("Ad")))
  await vi.advanceTimersByTimeAsync(20_000)
  expect([running.error?.failure, waiting.error?.failure]).toEqual(["crash", "crash"])
  // After the PDF that loaded the compiler, only the running one was sent.
  expect(namesReceived()).toEqual(["", "A"])
})

test("a preview withdrawn while it waits is never compiled", async () => {
  FakeWorker.delay = () => 100
  const running = track(compilePreview(printing("A")))
  const wanted = new AbortController()
  const withdrawn = track(compilePreview(printing("Ad"), wanted.signal))
  wanted.abort()
  await vi.advanceTimersByTimeAsync(0)
  expect(withdrawn.error?.name).toBe("Superseded")

  await vi.advanceTimersByTimeAsync(200)
  expect(running.value).toMatch(/^blob:/)
  expect(namesReceived()).toEqual(["A"])
})

test("a preview whose PDF can't be turned into a link still settles", async () => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
    throw new Error("out of memory")
  })
  const preview = track(compilePreview(printing("A")))
  await vi.advanceTimersByTimeAsync(10)
  expect(preview.error?.message).toBe("out of memory")

  // The next preview isn't held up.
  vi.restoreAllMocks()
  const next = track(compilePreview(printing("Ad")))
  await vi.advanceTimersByTimeAsync(10)
  expect(next.value).toMatch(/^blob:/)
})

test("the compiler can start loading before the first PDF, which then uses the same worker", async () => {
  FakeWorker.loading = [{ progress: true, downloaded: 0.5 }, { progress: true, downloaded: 1 }, { ready: true }]
  loadAhead("resumeworded")
  loadAhead("jake")
  expect(FakeWorker.made).toHaveLength(1)
  // With the fonts of each template asked for.
  expect(FakeWorker.made[0].loadRequests).toEqual([
    { load: true, template: "resumeworded" },
    { load: true, template: "jake" },
  ])
  await vi.advanceTimersByTimeAsync(10)
  expect(compilerStatus()).toEqual({ loaded: false, downloaded: 0.5 })
  await vi.advanceTimersByTimeAsync(20)
  expect(compilerStatus()).toEqual({ loaded: true, downloaded: 1 })

  const result = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(10)
  expect(result.value).toEqual(PDF)
  expect(FakeWorker.made).toHaveLength(1)
})

test("the compiler can download ahead without being built, in the worker that later builds it", () => {
  prefetch()
  loadAhead("jake")
  expect(FakeWorker.made).toHaveLength(1)
  expect(FakeWorker.made[0].prefetches).toBe(1)
  expect(FakeWorker.made[0].loadRequests).toEqual([{ load: true, template: "jake" }])
})

test("downloading ahead does nothing once the compiler has started", () => {
  loadAhead()
  prefetch()
  track(compileResume(resume))
  prefetch()
  expect(FakeWorker.made).toHaveLength(1)
  expect(FakeWorker.made[0].prefetches).toBe(0)
})

test("the connection for the compiler's download opens as its worker starts, anonymous like the download", () => {
  loadAhead()
  loadAhead("jake")
  track(compileResume(resume))
  expect(FakeWorker.made).toHaveLength(1)
  expect(addedToHead).toEqual([{ rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" }])
})

test("the page hears how much of the compiler has downloaded, and when it's ready", () => {
  const heard: CompilerStatus[] = []
  onCompilerStatus(() => heard.push(compilerStatus()))
  loadAhead()
  const worker = FakeWorker.made[0]
  worker.send({ progress: true, downloaded: 0.25 })
  worker.send({ progress: true, downloaded: 0.25 })
  worker.send({ progress: true, downloaded: 1 })
  worker.send({ ready: true })
  // Compiling also counts as getting on, but changes nothing here.
  worker.send({ progress: true, downloaded: 1 })
  expect(heard).toEqual([
    { loaded: false, downloaded: 0.25 },
    { loaded: false, downloaded: 1 },
    { loaded: true, downloaded: 1 },
  ])
})

test("a compiler that couldn't load starts over from nothing", () => {
  loadAhead()
  FakeWorker.made[0].send({ progress: true, downloaded: 0.5 })
  FakeWorker.made[0].send({ ready: false })
  expect(compilerStatus()).toEqual({ loaded: false, downloaded: 0 })
})

test("a stuck download starts over from nothing in the next worker", async () => {
  FakeWorker.answer = silent
  track(compileResume(resume))
  FakeWorker.made[0].send({ progress: true, downloaded: 0.5 })
  await vi.advanceTimersByTimeAsync(30_000)
  expect(FakeWorker.made[0].terminated).toBe(true)
  expect(compilerStatus()).toEqual({ loaded: false, downloaded: 0 })
})

test("once a compiler loaded ahead is ready, a stuck PDF gives up after 20 s", async () => {
  loadAhead()
  FakeWorker.made[0].send({ ready: true })
  FakeWorker.answer = silent
  const result = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(20_000)
  expect(result.error?.failure).toBe("crash")
})

test("nothing loads ahead for visitors saving data or on a very slow connection", () => {
  const on = (connection?: object) => {
    vi.stubGlobal("navigator", { connection })
    return savingData()
  }
  expect(on({ saveData: true, effectiveType: "4g" })).toBe(true)
  expect(on({ effectiveType: "slow-2g" })).toBe(true)
  expect(on({ effectiveType: "2g" })).toBe(true)
  expect(on({ effectiveType: "3g" })).toBe(false)
  expect(on(undefined)).toBe(false)
})

test("a worker the browser won't start doesn't stop the page, and the first PDF says why", async () => {
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        throw new Error("Blocked by the page's security policy")
      }
    },
  )
  expect(() => loadAhead()).not.toThrow()
  const result = track(compileResume(resume))
  await vi.advanceTimersByTimeAsync(0)
  expect(result.error?.message).toBe("Blocked by the page's security policy")
})
