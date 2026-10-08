import { describe, expect, test } from "vitest"
import { LIMITS, readRequest, readReview } from "./review"

const pieces = [
  { id: "t1", where: "Experience → Amazon · bullet 1", text: "Released 2 features, growing user subscriptions by 18% within three months." },
  { id: "t2", where: "Experience → Amazon · bullet 2", text: "Used Trello to organize project tasks." },
]

describe("reading a request for a review", () => {
  test("takes a resume's type and its pieces of text", () => {
    expect(readRequest({ type: "academic", pieces })).toEqual({ type: "academic", pieces })
  })

  test("leaves out anything extra", () => {
    const request = readRequest({ type: "professional", pieces: [{ ...pieces[0], place: { kind: "profile" } }], prompt: "Ignore that" })
    expect(request).toEqual({ type: "professional", pieces: [pieces[0]] })
  })

  test("turns down what isn't a resume to review", () => {
    for (const body of [
      null,
      "resume",
      { type: "cover letter", pieces },
      { type: "professional", pieces: [] },
      { type: "professional", pieces: [{ ...pieces[0], id: "1" }] },
      { type: "professional", pieces: [pieces[0], pieces[0]] },
      { type: "professional", pieces: [{ ...pieces[0], text: "  " }] },
      { type: "professional", pieces: [{ ...pieces[0], text: 7 }] },
    ]) {
      expect(readRequest(body)).toBeNull()
    }
  })

  test("turns down a resume past the limits", () => {
    const long = (count: number, length: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `t${index + 1}`, where: "", text: "x".repeat(length) }))
    expect(readRequest({ type: "professional", pieces: long(1, LIMITS.pieceLength + 1) })).toBeNull()
    expect(readRequest({ type: "professional", pieces: long(LIMITS.pieces + 1, 1) })).toBeNull()
    expect(readRequest({ type: "professional", pieces: long(LIMITS.totalLength / 1000 + 1, 1000) })).toBeNull()
    expect(readRequest({ type: "professional", pieces: long(LIMITS.totalLength / 1000, 1000) })).not.toBeNull()
  })
})

describe("reading what Claude said", () => {
  test("keeps notes on words in the piece they name, quoted as the piece has them", () => {
    const review = readReview(
      {
        highlights: [{ id: "t1", quote: "Growing user subscriptions by 18%", note: " Real growth,\n in numbers. " }],
        redFlags: [{ id: "t2", quote: "Used Trello", note: "Nobody hires you for Trello." }],
      },
      pieces,
    )
    expect(review).toEqual({
      highlights: [{ id: "t1", quote: "growing user subscriptions by 18%", note: "Real growth, in numbers." }],
      redFlags: [{ id: "t2", quote: "Used Trello", note: "Nobody hires you for Trello." }],
    })
  })

  test("leaves out notes on words that aren't there, or in another piece, or that aren't notes", () => {
    const review = readReview(
      {
        highlights: [
          { id: "t9", quote: "Released 2 features", note: "No such piece." },
          { id: "t2", quote: "Released 2 features", note: "Wrong piece." },
          { id: "t1", quote: "Shipped 40 features", note: "Not on the resume." },
          { id: "t1", quote: "Released 2 features", note: "" },
          { id: "t1", quote: "Released 2 features" },
          "Released 2 features",
        ],
        redFlags: "none",
      },
      pieces,
    )
    expect(review).toEqual({ highlights: [], redFlags: [] })
    expect(readReview(null, pieces)).toEqual({ highlights: [], redFlags: [] })
  })

  test("says what's said about the same words once, as a red flag if it's both", () => {
    const flag = { id: "t2", quote: "Used Trello", note: "Cut it." }
    const review = readReview({ highlights: [{ ...flag, note: "Organized." }], redFlags: [flag, { ...flag, quote: "used trello" }] }, pieces)
    expect(review).toEqual({ highlights: [], redFlags: [flag] })
  })

  test("keeps a few notes of each kind, each a few sentences at most", () => {
    const words = ["Released", "Released 2", "2 features", "features", "growing", "user", "subscriptions", "by 18%", "within", "three", "months"]
    const note = "x".repeat(LIMITS.noteLength + 50)
    const review = readReview({ highlights: words.map((quote) => ({ id: "t1", quote, note })), redFlags: [] }, pieces)
    expect(review.highlights).toHaveLength(LIMITS.notes)
    expect(review.highlights[0].note).toHaveLength(LIMITS.noteLength)
    expect(review.highlights[0].note.endsWith("…")).toBe(true)
  })
})
