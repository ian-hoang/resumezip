import { expect, test, vi } from "vitest"
import { memoryStorage } from "@/lib/memoryStorage"
import { hasSavedResumes } from "@/lib/resumeKeys"
import { closeNews, NEWS, NEWS_CLOSED_KEY, newsClosed } from "./news"

test("the news stays closed once closed, until there's other news", () => {
  const storage = memoryStorage()
  expect(newsClosed(storage)).toBe(false)
  closeNews(storage)
  expect(newsClosed(storage)).toBe(true)
  expect(newsClosed(storage, `${NEWS.id}-next`)).toBe(false)
})

test("without storage, or with storage that throws, the news shows and closing it doesn't throw", () => {
  expect(newsClosed(null)).toBe(false)
  expect(() => closeNews(null)).not.toThrow()

  const storage = memoryStorage()
  const denied = () => {
    throw new DOMException("Access is denied for this document.", "SecurityError")
  }
  vi.spyOn(storage, "getItem").mockImplementation(denied)
  vi.spyOn(storage, "setItem").mockImplementation(denied)
  expect(newsClosed(storage)).toBe(false)
  expect(() => closeNews(storage)).not.toThrow()
})

test("closing the news isn't taken for a saved resume", () => {
  expect(hasSavedResumes(memoryStorage({ [NEWS_CLOSED_KEY]: NEWS.id }))).toBe(false)
})
