import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { TEMPLATES } from "@/lib/templates"
import { printedTune, readTune, TEMPLATE_SETTINGS, withSetting } from "./tune"

describe("a saved tune", () => {
  test("is nothing when there's none, as in resumes from before Fine-tune", () => {
    expect(readTune(undefined)).toEqual({ tune: null, complete: true })
    expect(readTune(null)).toEqual({ tune: null, complete: true })
  })

  test("keeps every setting Fine-tune makes", () => {
    const tune = { size: 0.925, margin: 1.4, leading: 0.8, paper: "a4", onePage: true }
    expect(readTune(tune)).toEqual({ tune, complete: true })
  })

  test.each<[string, unknown]>([
    ["a list", [0.9]],
    ["a number", 0.9],
    ["text", "a4"],
  ])("that isn't an object is nothing, and not all of it (%s)", (_, value) => {
    expect(readTune(value)).toEqual({ tune: null, complete: false })
  })

  test("drops settings it doesn't know and values of the wrong type", () => {
    expect(readTune({ size: "1.1", margin: NaN, leading: null, paper: "legal", onePage: "yes", font: "Comic Sans", margin2: 1.2 })).toEqual(
      {
        tune: null,
        complete: false,
      },
    )
    expect(readTune({ size: 0.9, columns: 2 })).toEqual({ tune: { size: 0.9 }, complete: false })
  })

  test("brings multiples out of range to the nearest end of it", () => {
    expect(readTune({ size: 2, margin: 0, leading: -1 })).toEqual({ tune: { size: 1.15, margin: 0.6, leading: 0.8 }, complete: false })
    expect(readTune({ size: Infinity })).toEqual({ tune: null, complete: false })
  })

  test("leaves out the template's own settings", () => {
    expect(readTune({ size: 1, margin: 1, leading: 1, onePage: false })).toEqual({ tune: null, complete: true })
    expect(readTune({ size: 1, paper: "us-letter" })).toEqual({ tune: { paper: "us-letter" }, complete: true })
  })

  test("prints with every setting there, and the template's own for those not set", () => {
    expect(printedTune(undefined)).toEqual({ size: 1, margin: 1, leading: 1, paper: "", onePage: false })
    expect(printedTune({ size: 1.1, paper: "a4", font: "Comic Sans" })).toEqual({
      size: 1.1,
      margin: 1,
      leading: 1,
      paper: "a4",
      onePage: false,
    })
  })
})

describe("changing one setting", () => {
  test("keeps the others", () => {
    expect(withSetting({ size: 1.1 }, "paper", "a4")).toEqual({ size: 1.1, paper: "a4" })
  })

  test("drops one put back to the template's own, and leaves nothing once they all are", () => {
    expect(withSetting({ size: 1.1, paper: "a4" }, "size", 1)).toEqual({ paper: "a4" })
    expect(withSetting({ paper: "a4" }, "paper", undefined)).toBeNull()
    expect(withSetting(null, "onePage", false)).toBeNull()
  })

  test("keeps a step's float error out of what's saved", () => {
    expect(withSetting(null, "size", 1 - 0.025 * 3)).toEqual({ size: 0.925 })
  })
})

test("each template's own settings are the ones it sets", () => {
  for (const { id } of TEMPLATES) {
    const source = readFileSync(path.resolve(`src/lib/typst/templates/${id}.typ`), "utf8")
    const page = /^#set page\(paper: page-paper\("([^"]+)"\), margin: page-margin\((.+)\)\)$/m.exec(source)
    const size = /^#set text\(.*size: sized\(([\d.]+)pt\)/m.exec(source)
    expect(page, id).not.toBeNull()
    expect(size, id).not.toBeNull()
    // The left and right margins: `x`, or all four.
    const margin = /x: ([\d.]+)in/.exec(page![2])?.[1] ?? /^([\d.]+)in$/.exec(page![2])?.[1]
    expect({ size: Number(size![1]), margin: Number(margin), paper: page![1] }, id).toEqual(TEMPLATE_SETTINGS[id])
  }
})
