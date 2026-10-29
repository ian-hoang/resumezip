import { describe, expect, test } from "vitest"
import type { Entry } from "@/lib/resume"
import { newestFirst } from "./entryCards"

const job = (id: number, start: string, end: string, more: Partial<Entry> = {}): Entry => ({
  id,
  workStartDate: start,
  workEndDate: end,
  ...more,
})

describe("newestFirst", () => {
  test("is true when no entry is newer than the one above it", () => {
    expect(newestFirst("Work", [job(1, "May 2026", "Aug 2026"), job(2, "May 2025", "Aug 2025"), job(3, "Sep 2024", "Dec 2025")])).toBe(true)
  })

  test("is false when one is newer than the one above it", () => {
    expect(newestFirst("Work", [job(1, "May 2025", "Aug 2025"), job(2, "May 2026", "Aug 2026")])).toBe(false)
  })

  test("leaves out what's left out of the PDF, as the checker does", () => {
    expect(newestFirst("Work", [job(1, "May 2025", "Aug 2025"), job(2, "May 2026", "Aug 2026", { leftOut: true })])).toBe(null)
  })

  test("is null with nothing to compare", () => {
    expect(newestFirst("Work", [job(1, "May 2025", "Aug 2025")])).toBe(null)
    expect(newestFirst("Work", [job(1, "", ""), job(2, "", "")])).toBe(null)
    expect(newestFirst("Skills", [{ id: 1 }, { id: 2 }])).toBe(null)
  })
})
