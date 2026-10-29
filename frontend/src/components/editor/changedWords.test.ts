import { describe, expect, test } from "vitest"
import { newWords, wordsIn } from "./changedWords"

const words = (text: string) => text.split(" ")

describe("the words a new preview lights up", () => {
  test("are where each word is in its run of text", () => {
    expect(wordsIn(" Built a  loom")).toEqual([
      { start: 1, end: 6 },
      { start: 7, end: 8 },
      { start: 10, end: 14 },
    ])
    expect(wordsIn("  ")).toEqual([])
  })

  test("are only the words typed, not the rest of the line", () => {
    expect(newWords(words("Built a fast parser"), words("Built a very fast parser"))).toEqual([false, false, true, false, false])
  })

  test("are a word that changed, as by bolding it, and not the words around it", () => {
    const before = ["regular Built", "regular a", "regular fast", "regular parser"]
    const after = ["regular Built", "regular a", "bold fast", "regular parser"]
    expect(newWords(before, after)).toEqual([false, false, true, false])
  })

  test("are none for words taken out, or moved along as others are", () => {
    expect(newWords(words("Built a fast parser"), words("Built a parser"))).toEqual([false, false, false])
    expect(newWords(words("a b c d"), words("x a b c d"))).toEqual([true, false, false, false, false])
  })

  test("are a second copy of words already there, not the first", () => {
    expect(newWords(words("Wrote the tests"), words("Wrote the tests Wrote the tests"))).toEqual([false, false, false, true, true, true])
  })

  test("are every word of a new page", () => {
    expect(newWords([], words("Ada Lovelace"))).toEqual([true, true])
  })
})
