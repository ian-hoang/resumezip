import { describe, expect, test } from "vitest"
import { fold, locate, spanOf } from "./match"

describe("finding words the way a resume prints them", () => {
  test("compares letters and digits only, without case or accents", () => {
    expect(fold("Café — São Paulo, 18%!").text).toBe("cafesaopaulo18")
    expect(fold("Strauß").text).toBe(fold("STRAUSS").text)
  })

  test("knows where each compared character came from, ligatures included", () => {
    const folded = fold("a ﬁt")
    expect(folded.text).toBe("afit")
    expect(folded.from).toEqual([0, 2, 2, 3])
    expect(folded.to).toEqual([1, 3, 3, 4])
  })

  test("gives back the words as they were typed", () => {
    const text = "Released 2 features, growing user subscriptions by 18% within three months."
    const span = spanOf(text, "growing user subscriptions by 18%")
    expect(span && text.slice(...span)).toBe("growing user subscriptions by 18%")
    // Punctuation and case don't count, so a quote with them changed is still found.
    const loose = spanOf(text, "Growing user-subscriptions by 18")
    expect(loose && text.slice(...loose)).toBe("growing user subscriptions by 18")
    expect(spanOf(text, "grew subscriptions")).toBeNull()
    expect(spanOf(text, " — ")).toBeNull()
  })
})

describe("finding quotes in the printed resume", () => {
  // As the preview prints it: wrapped, with a word broken by a hyphen.
  const printed = "Amazon Software Engineer\nCut manual testing by 6\nhours. Grew sub-\nscriptions by 18%.\nDuolingo\nCut manual testing by 6 hours a week."

  test("finds a quote across lines and a broken word", () => {
    const [span] = locate(printed, [{ piece: "Grew subscriptions by 18%.", quote: "subscriptions by 18%" }])
    expect(span && printed.slice(...span)).toBe("sub-\nscriptions by 18%")
  })

  test("finds words printed more than once where their piece is", () => {
    const quote = "Cut manual testing by 6 hours"
    const [first, second] = locate(printed, [
      { piece: "Cut manual testing by 6 hours.", quote },
      { piece: "Cut manual testing by 6 hours a week.", quote },
    ])
    expect(first![0]).toBe(printed.indexOf("Cut"))
    expect(second![0]).toBe(printed.lastIndexOf("Cut"))
  })

  test("finds a piece printed before the last one, as fields in another order are", () => {
    const [later, earlier] = locate(printed, [
      { piece: "Duolingo", quote: "Duolingo" },
      { piece: "Amazon", quote: "Amazon" },
    ])
    expect(later![0]).toBe(printed.indexOf("Duolingo"))
    expect(earlier![0]).toBe(0)
  })

  test("finds the quote on its own when its piece isn't printed as typed, and nothing when it isn't printed", () => {
    const [moved, gone] = locate(printed, [
      { piece: "Software Engineer (Jan 2023 – Present)", quote: "Software Engineer" },
      { piece: "Led a team of 6", quote: "Led a team" },
    ])
    expect(moved && printed.slice(...moved)).toBe("Software Engineer")
    expect(gone).toBeNull()
  })
})
