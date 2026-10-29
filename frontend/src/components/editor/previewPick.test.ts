import { describe, expect, test } from "vitest"
import type { Place } from "@/lib/check/places"
import { pickedIn, wordsIn } from "./previewPick"

const bullet = (line: number): Place => ({ kind: "entry", section: "Work", entry: 0, field: "workDescription", line })
const texts: { place: Place; text: string }[] = [
  { place: { kind: "profile", field: "fullName" }, text: "Jake Ryan" },
  { place: { kind: "entry", section: "Work", entry: 0, field: "companyName" }, text: "Google" },
  { place: { kind: "entry", section: "Work", entry: 0, field: "workStartDate" }, text: "Jan 2024" },
  { place: { kind: "entry", section: "Work", entry: 0, field: "workEndDate" }, text: "Present" },
  { place: bullet(0), text: "Built a search index in Python for 2 million pages" },
  { place: bullet(1), text: "Wrote Python tools the team used every day" },
  { place: { kind: "entry", section: "Skills", entry: 0, field: "skillDetails" }, text: "Python, Go" },
  { place: { kind: "entry", section: "Skills", entry: 1, field: "skillDetails" }, text: "Python, Go" },
]

// The preview's text as the templates print it: the name in capitals, dates
// together, a bullet wrapped with a hyphen, and the same skills twice.
const printed =
  "JAKE RYAN\nGoogle Jan 2024 – Present\nBuilt a search in-\ndex in Python for 2 million pages\nWrote Python tools the team used every day\nPython, Go\nPython, Go"

/** Picks `words`, the `nth` time they're printed as a whole word. */
function pick(words: string, nth = 0) {
  const at = [...printed.matchAll(new RegExp(`\\b${words}\\b`, "g"))][nth]?.index ?? -1
  return pickedIn(texts, printed, at, at + words.length)
}

describe("picking words on the preview", () => {
  test("finds the field that printed them, and where they are in it", () => {
    expect(pick("RYAN")).toEqual({ place: { kind: "profile", field: "fullName" }, text: "Jake Ryan", start: 5, end: 9 })
    expect(pick("Jan")).toMatchObject({ place: { field: "workStartDate" }, start: 0, end: 3 })
    expect(pick("Present")).toMatchObject({ place: { field: "workEndDate" } })
  })

  test("goes to the bullet a word was printed in, though another has it too", () => {
    expect(pick("Python", 0)).toMatchObject({ place: bullet(0), start: 24, end: 30 })
    expect(pick("Python", 1)).toMatchObject({ place: bullet(1), start: 6, end: 12 })
  })

  test("matches words across a line the template wrapped with a hyphen", () => {
    const at = printed.indexOf("search")
    expect(pickedIn(texts, printed, at, printed.indexOf("in Python"))).toMatchObject({
      place: bullet(0),
      start: 8,
      end: 20,
    })
  })

  test("tells the same text printed twice apart by its order", () => {
    expect(pick("Go", 0)).toMatchObject({ place: { section: "Skills", entry: 0 } })
    expect(pick("Go", 1)).toMatchObject({ place: { section: "Skills", entry: 1 } })
  })

  test("finds nothing for text no field printed, or for punctuation alone", () => {
    expect(pickedIn(texts, "Experience", 0, 10)).toBeNull()
    expect(pick("–")).toBeNull()
  })
})

describe("the picked words in the form", () => {
  test("are where they were printed when the field reads the same", () => {
    expect(wordsIn("Built a search index in Python for 2 million pages", { text: "Built a search index", start: 8, end: 14 })).toEqual({
      start: 8,
      end: 14,
    })
    // A word printed twice in a field is the one picked.
    expect(wordsIn("Go, Go", { text: "Go, Go", start: 4, end: 6 })).toEqual({ start: 4, end: 6 })
  })

  test("are found by their letters when the field has changed since", () => {
    expect(wordsIn("Now: built a search index", { text: "Built a search index", start: 8, end: 14 })).toEqual({ start: 13, end: 19 })
    expect(wordsIn("Something else", { text: "Built a search index", start: 8, end: 14 })).toBeNull()
  })
})
