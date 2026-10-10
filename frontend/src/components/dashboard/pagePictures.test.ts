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
