import { afterEach, describe, expect, test, vi } from "vitest"
import { keepDrawn, keepPictures, picturesToForget, type Picture } from "./pagePictures"

const picture = (url: string): Picture => ({ printed: url, url })

describe("picturesToForget", () => {
  test("lets go of the pictures of resumes that are gone, and keeps the rest", () => {
    const all = new Map([
      ["a", picture("blob:a")],
      ["b", picture("blob:b")],
    ])
    expect(picturesToForget(all, new Set(["a"]))).toEqual({ ids: ["b"], urls: ["blob:b"] })
  })

  test("keeps a picture a copy still shows, while forgetting the deleted one's place", () => {
    // "b" is a copy of "a", drawn once and shared.
    const all = new Map([
      ["a", picture("blob:a")],
      ["b", picture("blob:a")],
    ])
    expect(picturesToForget(all, new Set(["b"]))).toEqual({ ids: ["a"], urls: [] })
    expect(picturesToForget(all, new Set())).toEqual({ ids: ["a", "b"], urls: ["blob:a"] })
  })

  test("has nothing to let go of while every resume is still here", () => {
    expect(picturesToForget(new Map([["a", picture("blob:a")]]), new Set(["a"]))).toEqual({ ids: [], urls: [] })
  })
})

describe("keepDrawn", () => {
  afterEach(() => vi.restoreAllMocks())

  test("lets go at once of a picture finished for a resume deleted while it was drawn", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    keepPictures(["a"])
    expect(keepDrawn("a", "blob:a")).toBe(true)
    expect(revoke).not.toHaveBeenCalled()
    expect(keepDrawn("gone", "blob:gone")).toBe(false)
    expect(revoke).toHaveBeenCalledWith("blob:gone")
  })
})

describe("a picture being drawn when its resume is deleted", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.doUnmock("@/lib/typst/compile")
    vi.doUnmock("@/lib/import/open")
    vi.doUnmock("@/lib/import/pdfWorker")
  })

  test("isn't stored once it's drawn, and its URL is let go of", async () => {
    // The compile waits until the test lets it finish; pdf.js and the canvas are stand-ins.
    let finishCompile = () => {}
    vi.doMock("@/lib/typst/compile", () => ({
      compileResume: () => new Promise<Uint8Array>((resolve) => (finishCompile = () => resolve(new Uint8Array()))),
      failureOf: () => "compiler",
      printedOf: (resume: object) => resume,
    }))
    const page = { getViewport: () => ({ width: 100, height: 130 }), render: () => ({ promise: Promise.resolve() }) }
    vi.doMock("@/lib/import/open", () => ({
      loadPdfjs: async () => ({
        getDocument: () => ({ promise: Promise.resolve({ getPage: async () => page }), destroy: async () => {} }),
        PDFWorker: class {},
      }),
    }))
    vi.doMock("@/lib/import/pdfWorker", () => ({ startPdfWorker: async () => ({ destroy() {} }) }))
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => ({}), toBlob: (done: (blob: Blob) => void) => done(new Blob()) }),
    })
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:drawn")
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    vi.resetModules()
    const pictures = await import("./pagePictures")

    pictures.keepPictures(["ada"])
    pictures.startPictures()
    pictures.want("ada", { resumeTitle: "Ada" })
    // Deleted while it's drawn.
    pictures.keepPictures([])
    finishCompile()
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:drawn"))
    expect(pictures.pictureOf("ada")).toBeUndefined()
  })
})
