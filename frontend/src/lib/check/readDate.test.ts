import { describe, expect, test } from "vitest"
import { compareDates, monthName, readDate, readDateRange, type ResumeDate } from "./readDate"

const read = (text: string) => {
  const date = readDate(text)
  return date && !date.present ? { year: date.year, month: date.month, style: date.style.kind } : date
}

describe("reading one date", () => {
  test("reads a month by its name, short or long, with or without a dot", () => {
    for (const [text, month] of [
      ["Jan 2024", 1],
      ["January 2024", 1],
      ["Sept 2024", 9],
      ["Sep 2024", 9],
      ["September 2024", 9],
      ["Aug. 2023", 8],
      ["may 2023", 5],
      ["June 2023", 6],
      ["Dec, 2022", 12],
      ["May 15, 2023", 5],
    ] as const) {
      expect(read(text), text).toEqual({ year: Number(text.slice(-4)), month, style: "name" })
    }
  })

  test("says how the month was spelled, for telling formats apart", () => {
    expect(readDate("Sept 2024")).toMatchObject({ style: { kind: "name", spelling: "sept", dotted: false } })
    expect(readDate("Aug. 2023")).toMatchObject({ style: { kind: "name", spelling: "aug", dotted: true } })
    expect(readDate("January 2024")).toMatchObject({ style: { kind: "name", spelling: "january", dotted: false } })
  })

  test("reads a month by its number", () => {
    expect(read("01/2024")).toEqual({ year: 2024, month: 1, style: "number" })
    expect(read("1/2024")).toEqual({ year: 2024, month: 1, style: "number" })
    expect(read("01-2024")).toEqual({ year: 2024, month: 1, style: "number" })
    expect(read("2024-01")).toEqual({ year: 2024, month: 1, style: "number" })
    expect(read("01/15/2024")).toEqual({ year: 2024, month: 1, style: "number" })
    expect(read("01/24")).toEqual({ year: 2024, month: 1, style: "number" })
    expect(read("1/99")).toEqual({ year: 1999, month: 1, style: "number" })
    expect(readDate("13/2024")).toBeNull()
    expect(readDate("13/24")).toBeNull()
  })

  test("reads a year on its own, and a season", () => {
    expect(read("2024")).toEqual({ year: 2024, month: undefined, style: "year" })
    expect(read("Fall 2023")).toEqual({ year: 2023, month: 9, style: "season" })
    expect(read("Spring 2024")).toEqual({ year: 2024, month: 3, style: "season" })
  })

  test("reads “Present” and the words like it, keeping the word as written", () => {
    for (const word of ["Present", "Current", "Now", "ongoing", "PRESENT"]) {
      expect(readDate(word), word).toEqual({ present: true, word })
    }
  })

  test("leaves out words around a date that aren't part of it", () => {
    for (const text of ["Expected May 2027", "Exp. May 2027", "Anticipated May 2027", "May 2027 (Expected)", "Graduation: May 2027"]) {
      expect(read(text), text).toEqual({ year: 2027, month: 5, style: "name" })
    }
    expect(read("Class of 2027")).toEqual({ year: 2027, month: undefined, style: "year" })
  })

  test("leaves out several of those words, and a “Date” after them", () => {
    for (const text of [
      "Expected Graduation: May 2027",
      "Anticipated Graduation: May 2027",
      "Graduation Date: May 2027",
      "Expected Graduation Date: May 2027",
      "expected graduation may 2027",
    ]) {
      expect(read(text), text).toEqual({ year: 2027, month: 5, style: "name" })
    }
    expect(read("Expected Graduation: Spring 2027")).toEqual({ year: 2027, month: 3, style: "season" })
    expect(readDate("Date: May 2027")).toBeNull()
  })

  test("reads a day before the month, as much of the world writes it", () => {
    for (const text of ["15 May 2023", "15th May 2023", "1 Sept. 2023", "15 May, 2023"]) {
      expect(read(text), text).toMatchObject({ year: 2023, style: "name" })
    }
    expect(read("15 May 2023")).toEqual({ year: 2023, month: 5, style: "name" })
    expect(readDate("15 2023")).toBeNull()
  })

  test("reads a year written with an apostrophe, and says so", () => {
    expect(readDate("Jan '21")).toMatchObject({ year: 2021, month: 1, shortYear: true })
    expect(readDate("Jan ’21")).toMatchObject({ year: 2021, shortYear: true })
    expect(readDate("Jan 2021")).toMatchObject({ shortYear: false })
  })

  test("reads a two-digit year as POSIX does: 69 to 99 in the 1900s, the rest in the 2000s", () => {
    expect(readDate("Jun '99")).toMatchObject({ year: 1999 })
    expect(readDate("Jun '69")).toMatchObject({ year: 1969 })
    expect(readDate("May '30")).toMatchObject({ year: 2030 })
    expect(readDate("'05")).toMatchObject({ year: 2005 })
  })

  test("can't read a misspelled month, a month without a year, or anything else", () => {
    for (const text of ["Jnu 2024", "Jan", "Spring", "Janu 2024", "June. 2024", "2024 Jan", "Jan 21", "soon", "", "1999-2000-01"]) {
      expect(readDate(text), text).toBeNull()
    }
  })
})

describe("reading a range in one field", () => {
  const range = (text: string) => {
    const read = readDateRange(text)
    const show = (date: ResumeDate) => (date.present ? date.word : [date.year, date.month].filter(Boolean).join("-"))
    return read && [read.start.text, show(read.start.date), read.end.text, show(read.end.date)]
  }

  test("reads two dates with a dash, “to” or “until” between them", () => {
    expect(range("Jan 2026 – Present")).toEqual(["Jan 2026", "2026-1", "Present", "Present"])
    expect(range("2023 – 2026")).toEqual(["2023", "2023", "2026", "2026"])
    expect(range("2023-2026")).toEqual(["2023", "2023", "2026", "2026"])
    expect(range("Sep 2024 - Dec 2024")).toEqual(["Sep 2024", "2024-9", "Dec 2024", "2024-12"])
    expect(range("01/2024 - 05/2024")).toEqual(["01/2024", "2024-1", "05/2024", "2024-5"])
    expect(range("01-2024 – 05-2024")).toEqual(["01-2024", "2024-1", "05-2024", "2024-5"])
    expect(range("01/24 - 05/24")).toEqual(["01/24", "2024-1", "05/24", "2024-5"])
    expect(range("June 2023 to Aug 2023")).toEqual(["June 2023", "2023-6", "Aug 2023", "2023-8"])
    expect(range("2024—Present")).toEqual(["2024", "2024", "Present", "Present"])
  })

  test("gives a first month without a year the end's year, or the year before", () => {
    expect(range("Jun – Aug 2025")).toEqual(["Jun", "2025-6", "Aug 2025", "2025-8"])
    expect(range("Nov – Feb 2025")).toEqual(["Nov", "2024-11", "Feb 2025", "2025-2"])
    expect(range("Spring – Summer 2024")).toEqual(["Spring", "2024-3", "Summer 2024", "2024-6"])
  })

  test("is null for one date, or when either side can't be read", () => {
    for (const text of ["Jan 2024", "2024-01", "Jnu – Aug 2025", "Present – 2024", "Jun – Aug", "Jan 2024 – soon"]) {
      expect(readDateRange(text), text).toBeNull()
    }
  })
})

describe("comparing dates", () => {
  const date = (text: string) => readDate(text)!

  test("goes by year, then by month when both have one, with Present the latest", () => {
    expect(compareDates(date("Jan 2024"), date("Mar 2024"))).toBeLessThan(0)
    expect(compareDates(date("Jan 2025"), date("Dec 2024"))).toBeGreaterThan(0)
    expect(compareDates(date("2024"), date("Mar 2024"))).toBe(0)
    expect(compareDates(date("Present"), date("Dec 2030"))).toBeGreaterThan(0)
    expect(compareDates(date("Current"), date("Present"))).toBe(0)
  })
})

describe("naming a month for a suggestion", () => {
  test("follows the resume's way of writing months", () => {
    expect(monthName(1)).toBe("Jan")
    expect(monthName(1, { long: true })).toBe("January")
    expect(monthName(9, { sept: true })).toBe("Sept")
    expect(monthName(8, { dotted: true })).toBe("Aug.")
    expect(monthName(5, { dotted: true })).toBe("May")
    expect(monthName(6)).toBe("Jun")
  })
})
