import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { TEMPLATES } from "@/lib/templates"
import { fitOnePage, pageCount, printedTune, readTune, tighterSteps, TEMPLATE_SETTINGS, withSetting, type Fitted } from "./tune"

describe("a saved tune", () => {
  test("is nothing when there's none, as in resumes from before Fine-tune", () => {
    expect(readTune(undefined)).toEqual({ tune: null, complete: true })
    expect(readTune(null)).toEqual({ tune: null, complete: true })
  })

  test("keeps every setting Fine-tune makes", () => {
    const tune = { size: 0.925, margin: 1.4, leading: 0.8, gap: 0.45, paper: "a4", onePage: true }
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
    expect(
      readTune({ size: "1.1", margin: NaN, leading: null, gap: "tight", paper: "legal", onePage: "yes", font: "Comic Sans", margin2: 1.2 }),
    ).toEqual({
      tune: null,
      complete: false,
    })
    expect(readTune({ size: 0.9, columns: 2 })).toEqual({ tune: { size: 0.9 }, complete: false })
  })

  test("brings multiples out of range to the nearest end of it", () => {
    expect(readTune({ size: 2, margin: 0, leading: -1, gap: 9 })).toEqual({
      tune: { size: 1.15, margin: 0.6, leading: 0.8, gap: 1.7 },
      complete: false,
    })
    expect(readTune({ size: Infinity })).toEqual({ tune: null, complete: false })
  })

  test("leaves out the template's own settings", () => {
    expect(readTune({ size: 1, margin: 1, leading: 1, gap: 1, onePage: false })).toEqual({ tune: null, complete: true })
    expect(readTune({ size: 1, paper: "us-letter" })).toEqual({ tune: { paper: "us-letter" }, complete: true })
  })

  test("prints with every setting there, and the template's own for those not set", () => {
    expect(printedTune(undefined)).toEqual({ size: 1, margin: 1, leading: 1, gap: 1, paper: "", onePage: false })
    expect(printedTune({ size: 1.1, paper: "a4", font: "Comic Sans" })).toEqual({
      size: 1.1,
      margin: 1,
      leading: 1,
      gap: 1,
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

describe("keeping to one page", () => {
  const own: Fitted = { size: 1, margin: 1, leading: 1, gap: 1 }

  test("tightens the space between sections first, then margins, line spacing and the text", () => {
    const steps = tighterSteps(own)
    expect(steps[0]).toEqual({ ...own, gap: 0.95 })
    // Each step is tighter than the one before, in one setting.
    for (const [index, step] of steps.entries()) {
      const before = steps[index - 1] ?? own
      const lower = (Object.keys(own) as (keyof Fitted)[]).filter((key) => step[key] < before[key])
      expect(lower, `step ${index}`).toHaveLength(1)
      expect((Object.keys(own) as (keyof Fitted)[]).filter((key) => step[key] > before[key])).toEqual([])
    }
    // The text isn't touched until the spacing and margins are at their floors, and margins no further than 0.75 before it.
    const firstSmaller = steps.findIndex((step) => step.size < 1)
    expect(steps[firstSmaller - 1]).toEqual({ size: 1, margin: 0.75, leading: 0.9, gap: 0.5 })
    expect(steps.at(-1)).toEqual({ size: 0.85, margin: 0.6, leading: 0.8, gap: 0.3 })
  })

  test("goes down in the sliders' own steps, to their floors", () => {
    expect(tighterSteps({ size: 0.85, margin: 0.6, leading: 0.8, gap: 0.55 })).toEqual([
      { size: 0.85, margin: 0.6, leading: 0.8, gap: 0.5 },
      ...[0.45, 0.4, 0.35, 0.3].map((gap) => ({ size: 0.85, margin: 0.6, leading: 0.8, gap })),
    ])
    expect(tighterSteps({ size: 0.85, margin: 0.6, leading: 0.8, gap: 0.3 })).toEqual([])
  })

  test("leaves what's already tighter than a floor as it is, until the last stage", () => {
    const steps = tighterSteps({ ...own, margin: 0.7 })
    expect(steps.every((step) => step.margin === 0.7 || step.size === 0.85)).toBe(true)
    expect(steps.some((step) => step.margin < 0.7)).toBe(true)
  })

  // A resume that fits on one page once `fits` says so of what it's printed at, counting the prints.
  const resume = (fits: (fitted: Fitted) => boolean) => {
    const prints: Fitted[] = []
    const print = async (fitted: Fitted) => {
      prints.push(fitted)
      return { pages: fits(fitted) ? 1 : 2, printed: JSON.stringify(fitted) }
    }
    return { prints, print }
  }

  test("leaves a resume that fits as it is, printed once", async () => {
    const { prints, print } = resume(() => true)
    const start = { ...own, size: 1.1 }
    expect(await fitOnePage(start, print)).toEqual({ fit: { ...start, fits: true }, printed: JSON.stringify(start) })
    expect(prints).toEqual([start])
  })

  test.each([0, 4, 9, 10, 14, 20, 30])("finds the loosest step that fits (%s), in fewer prints than trying each", async (index) => {
    const steps = tighterSteps(own)
    const target = steps[index]
    // Fits from the target on, down the list of steps.
    const { prints, print } = resume((fitted) => steps.findIndex((step) => JSON.stringify(step) === JSON.stringify(fitted)) >= index)
    expect(await fitOnePage(own, print)).toEqual({ fit: { ...target, fits: true }, printed: JSON.stringify(target) })
    expect(prints.length).toBeLessThan(1 + steps.length)
    // None is printed twice.
    expect(new Set(prints.map((fitted) => JSON.stringify(fitted))).size).toBe(prints.length)
  })

  test("a resume a little over takes one print more, and only the spacing changes", async () => {
    const { prints, print } = resume((fitted) => fitted.gap <= 0.95)
    const { fit } = await fitOnePage(own, print)
    expect(prints).toEqual([own, { ...own, gap: 0.95 }])
    expect(fit).toEqual({ ...own, gap: 0.95, fits: true })
  })

  test("keeps the text as it was when tighter spacing and margins are enough", async () => {
    const { print } = resume((fitted) => fitted.gap <= 0.5 && fitted.margin <= 0.9)
    const { fit } = await fitOnePage({ ...own, size: 1.1 }, print)
    expect(fit).toEqual({ size: 1.1, margin: 0.9, leading: 1, gap: 0.5, fits: true })
  })

  test("prints one that doesn't fit even at the tightest at that, and says so", async () => {
    const { print } = resume(() => false)
    const tightest = { size: 0.85, margin: 0.6, leading: 0.8, gap: 0.3 }
    expect(await fitOnePage(own, print)).toEqual({ fit: { ...tightest, fits: false }, printed: JSON.stringify(tightest) })
    // Already as tight as it goes.
    expect(await fitOnePage(tightest, print)).toEqual({ fit: { ...tightest, fits: false }, printed: JSON.stringify(tightest) })
  })
})

describe("counting a PDF's pages", () => {
  const pdf = (text: string) => new TextEncoder().encode(text)

  test("reads the page tree Typst writes first", () => {
    expect(pageCount(pdf("%PDF-1.7\n%\x80\x80\x80\x80\n\n1 0 obj\n<<\n  /Type /Pages\n  /Count 2\n  /Kids [3 0 R 4 0 R]\n>>"))).toBe(2)
  })

  test("can't tell from anything else", () => {
    expect(pageCount(pdf("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\n2 0 obj\n<< /Type /Pages /Count 2 >>"))).toBeNaN()
    expect(pageCount(pdf("not a PDF"))).toBeNaN()
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
