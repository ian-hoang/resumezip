import { describe, expect, test } from "vitest"
import type { Entry } from "@/lib/resume"
import { datesOf, newestFirst } from "./entryCards"

const job = (id: number, start: string, end: string, more: Partial<Entry> = {}): Entry => ({
  id,
  workStartDate: start,
  workEndDate: end,
  ...more,
})

describe("datesOf", () => {
  test("leaves the year off the start when both dates are in one year", () => {
    expect(datesOf("Work", job(1, "May 2025", "Aug 2025"))).toBe("May – Aug 2025")
    expect(datesOf("Work", job(1, "Sep 2024", "Dec 2025"))).toBe("Sep 2024 – Dec 2025")
    expect(datesOf("Work", job(1, "Jan 2026", "Present"))).toBe("Jan 2026 – Present")
  })

  test("shows one date alone, and a date it can't read as written", () => {
    expect(datesOf("Work", job(1, "May 2025", ""))).toBe("May 2025")
    expect(datesOf("Work", job(1, "", "Aug 2025"))).toBe("Aug 2025")
    expect(datesOf("Work", job(1, "2024", "2025"))).toBe("2024 – 2025")
    expect(datesOf("Work", job(1, "Summer", "Fall 2025"))).toBe("Summer – Fall 2025")
  })

  test("shows a section's one date field as it's written, and nothing for a section without dates", () => {
    expect(datesOf("Projects", { id: 1, projectDate: "Jun – Aug 2025" })).toBe("Jun – Aug 2025")
    expect(datesOf("Skills", { id: 1, skillName: "Languages" })).toBe("")
  })
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
