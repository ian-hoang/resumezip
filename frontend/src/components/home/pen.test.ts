import { describe, expect, it } from "vitest"
import { type Stroke, arrowStrokes, loopStroke, penStroke, underStroke } from "./pen"

// The points of an SVG path made of M and L commands.
const pointsOf = (path: string) =>
  [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => [Number(x), Number(y)] as const)

const bounds = (stroke: Stroke) => {
  const points = pointsOf(stroke.outline)
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
}

describe("a pen stroke", () => {
  it("is a closed outline round its line, about as wide as the pen", () => {
    const stroke = penStroke(
      [
        [0, 0],
        [100, 0],
      ],
      4,
      0.1,
    )
    expect(stroke.outline.endsWith("Z")).toBe(true)
    const box = bounds(stroke)
    expect(box.bottom - box.top).toBeGreaterThan(3)
    expect(box.bottom - box.top).toBeLessThan(5)
    expect(pointsOf(stroke.center)[0]).toEqual([0, 0])
    expect(pointsOf(stroke.center).at(-1)).toEqual([100, 0])
  })

  it("narrows where the pen lands and lifts", () => {
    const outline = pointsOf(
      penStroke(
        [
          [0, 0],
          [100, 0],
        ],
        4,
        0.2,
      ).outline,
    )
    // The outline's first point is beside the start; the widest is near the middle.
    const widest = Math.max(...outline.map(([, y]) => Math.abs(y)))
    expect(Math.abs(outline[0][1])).toBeLessThan(widest / 2)
  })
})

describe("a loop round a word", () => {
  it("goes all the way round it, and no further than a pen's width or so", () => {
    const word = [100, 50, 160, 63] as const
    const box = bounds(loopStroke(word, 1.14, 0.04, 3.7))
    expect(box.left).toBeLessThan(word[0])
    expect(box.right).toBeGreaterThan(word[2])
    expect(box.top).toBeLessThan(word[1])
    expect(box.bottom).toBeGreaterThan(word[3])
    // Loose, but not reaching the lines above and below, about 10px away.
    expect(word[1] - box.top).toBeLessThan(12)
    expect(box.bottom - word[3]).toBeLessThan(12)
  })
})

describe("a line under words", () => {
  it("runs the words' length, close under them, drifting up a little as a hand does", () => {
    const box = bounds(underStroke(50, 250, 100, 3.7))
    expect(box.left).toBeLessThanOrEqual(50)
    expect(box.right).toBeGreaterThanOrEqual(249)
    expect(box.top).toBeGreaterThan(93)
    expect(box.bottom).toBeLessThan(104)
  })
})

describe("an arrow", () => {
  it("is a curve and a two-stroke head, ending where it points", () => {
    const strokes = arrowStrokes([300, 200], [100, 210], -18, 3.7)
    expect(strokes).toHaveLength(3)
    const [x, y] = pointsOf(strokes[0].center).at(-1)!
    expect(x).toBeCloseTo(100, 0)
    expect(y).toBeCloseTo(210, 0)
    for (const barb of strokes.slice(1)) expect(pointsOf(barb.center)[0]).toEqual([100, 210])
  })
})
