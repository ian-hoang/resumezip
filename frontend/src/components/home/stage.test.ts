import { describe, expect, it } from "vitest"
import { BEATS } from "./motion"
import {
  AT_REST,
  type Camera,
  EDITOR,
  GAP,
  MARKS,
  type StageLayout,
  cameraAt,
  headerHeight,
  layoutStage,
  marksOnPicture,
  wayInAt,
} from "./stage"

const WIDE = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1180, height: 680 },
  { width: 1280, height: 600 },
]
const NARROW = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
]

// The points of an SVG path made of M and L commands.
const pointsOf = (path: string) =>
  [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => [Number(x), Number(y)] as const)

/** Where a box on the editor's picture is on the screen, under a camera. */
function onScreen({ editor }: StageLayout, camera: Camera, [left, top, right, bottom]: readonly number[]) {
  const x = (f: number) => editor.x + camera.x + f * editor.width * camera.scale
  const y = (f: number) => editor.y + camera.y + f * editor.height * camera.scale
  return { left: x(left), top: y(top), right: x(right), bottom: y(bottom) }
}

/** About how wide a note's longest line is: Caveat's letters are about a third of its size across, measured on the page. */
const widthOf = (lines: readonly string[], size: number) => Math.max(...lines.map((line) => line.length)) * size * 0.36

describe("each note", () => {
  it("is written over the editor, over what it's about, under the header and wholly on the screen", () => {
    for (const screen of [...WIDE, ...NARROW]) {
      const layout = layoutStage(screen)
      layout.notes.forEach((note, i) => {
        const lines = MARKS[i].note
        const width = widthOf(lines, note.size)
        expect(note.align).toBe("center")
        expect(note.y).toBeGreaterThan(headerHeight(screen))
        expect(note.y + 2 * note.size).toBeLessThan(layout.editor.y)
        expect(note.x - width / 2, lines[0]).toBeGreaterThanOrEqual(0)
        expect(note.x + width / 2, lines[0]).toBeLessThanOrEqual(screen.width)
        // Over its mark, unless the screen's edge keeps it from being.
        const box = onScreen(layout, layout.cameras[i], MARKS[i].box)
        const middle = (box.left + box.right) / 2
        if (middle - width / 2 > 12 && middle + width / 2 < screen.width - 12) expect(note.x).toBeCloseTo(middle)
      })
    }
  })
})

describe("on a wide screen", () => {
  it("keeps the camera still", () => {
    for (const screen of WIDE) expect(layoutStage(screen).cameras.every((camera) => camera === AT_REST)).toBe(true)
  })
})

// The arrows have to land on what they're about, at every size: a head that stops in the wrong place,
// or comes at its loop sideways, points at something else.
describe("each arrow", () => {
  for (const screen of [...WIDE, ...NARROW]) {
    it(`at ${screen.width}×${screen.height}, starts by its note and ends just short of its loop, pointing at it`, () => {
      const layout = layoutStage(screen)
      layout.arrows.forEach(([curve], i) => {
        const points = pointsOf(curve.center)
        const [start, before, end] = [points[0], points[points.length - 4], points[points.length - 1]]
        const note = layout.notes[i]
        expect(Math.hypot(start[0] - note.x, start[1] - note.y), MARKS[i].note[0]).toBeLessThan(note.size * 3.5)
        // Its head is past the loop, which is drawn a few pixels outside its box, and close to it.
        const box = onScreen(layout, layout.cameras[i], MARKS[i].box)
        const dx = Math.max(box.left - end[0], 0, end[0] - box.right)
        const dy = Math.max(box.top - end[1], 0, end[1] - box.bottom)
        expect(Math.hypot(dx, dy), MARKS[i].note[0]).toBeGreaterThanOrEqual(GAP - 1)
        expect(Math.hypot(dx, dy), MARKS[i].note[0]).toBeLessThanOrEqual(GAP + 1)
        // Its last stretch heads for the box: carried on, it runs into it.
        const heading = Math.atan2(end[1] - before[1], end[0] - before[0])
        const hits = Array.from({ length: 40 }, (_, step) => [end[0] + Math.cos(heading) * step, end[1] + Math.sin(heading) * step]).some(
          ([x, y]) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
        )
        expect(hits, MARKS[i].note[0]).toBe(true)
      })
    })

    it(`at ${screen.width}×${screen.height}, keeps off the menu its mark opens`, () => {
      const layout = layoutStage(screen)
      layout.arrows.forEach((arrow, i) => {
        const menu = MARKS[i].menu
        if (!menu) return
        const box = onScreen(layout, layout.cameras[i], menu.open.box)
        for (const stroke of arrow)
          for (const [x, y] of pointsOf(stroke.center))
            expect(x >= box.left && x <= box.right && y >= box.top && y <= box.bottom, MARKS[i].note[0]).toBe(false)
      })
    })
  }
})

describe("on a phone or a tablet", () => {
  it("has the whole editor on the screen", () => {
    for (const screen of NARROW) {
      const { beside, editor } = layoutStage(screen)
      expect(beside, `${screen.width}×${screen.height}`).toBe(false)
      expect(editor.y + editor.height).toBeLessThan(screen.height)
    }
  })

  it("zooms the camera in on each mark, keeping it in sight and the picture's edges out of it", () => {
    for (const screen of NARROW) {
      const { editor, cameras } = layoutStage(screen)
      cameras.forEach((camera, i) => {
        expect(camera.scale).toBeGreaterThan(1.5)
        expect(camera.x).toBeLessThanOrEqual(0)
        expect(camera.x + editor.width * camera.scale).toBeGreaterThanOrEqual(editor.width - 0.01)
        const [left, top, right, bottom] = MARKS[i].box
        expect(camera.x + left * editor.width * camera.scale).toBeGreaterThanOrEqual(0)
        expect(camera.x + right * editor.width * camera.scale).toBeLessThanOrEqual(editor.width)
        expect(camera.y + top * editor.height * camera.scale).toBeGreaterThanOrEqual(0)
        expect(camera.y + bottom * editor.height * camera.scale).toBeLessThanOrEqual(editor.height)
      })
    }
  })

  it("moves the camera in for the first mark, onto each in turn, and back out for the way in", () => {
    const { cameras } = layoutStage({ width: 390, height: 844 })
    expect(cameraAt(0, cameras)).toEqual(AT_REST)
    BEATS.notes.forEach((beat, i) => expect(cameraAt(beat[0], cameras)).toEqual(cameras[i]))
    expect(cameraAt(BEATS.cta[1], cameras)).toEqual(AT_REST)
  })
})

describe("the way in", () => {
  it("is wholly on the screen, under the header, however tall its words make it", () => {
    for (const screen of [...WIDE, ...NARROW]) {
      const layout = layoutStage(screen)
      for (const height of [300, 380, 460]) {
        const box = wayInAt(layout, screen, height)
        expect(box.y).toBeGreaterThanOrEqual(headerHeight(screen))
        expect(box.y + height).toBeLessThanOrEqual(screen.height)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(screen.width)
      }
    }
  })
})

describe("the marks", () => {
  it("each have a beat of the story to be drawn in", () => {
    expect(BEATS.notes).toHaveLength(MARKS.length)
  })

  it("are each on the editor's picture", () => {
    for (const stroke of marksOnPicture()) {
      for (const [x, y] of pointsOf(stroke.outline)) {
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThan(EDITOR.width)
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(EDITOR.height)
      }
    }
  })

  it("go left to right across the editor, as it's read", () => {
    const lefts = MARKS.map((mark) => (mark.menu ? mark.menu.click[0] : mark.box[0]))
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b))
  })

  it("with a menu, are round the button that opens it, where it's clicked", () => {
    const inside = ([x, y]: readonly [number, number], [left, top, right, bottom]: readonly number[]) =>
      x >= left && x <= right && y >= top && y <= bottom
    for (const { menu, box } of MARKS) {
      if (!menu) continue
      expect(inside(menu.click, box)).toBe(true)
      expect(inside(menu.click, menu.button.box)).toBe(true)
    }
  })

  // Small loops round what's clicked, not big ones round whole menus.
  it("are each round a button or a word in the editor's top bar", () => {
    for (const { box } of MARKS) {
      expect(box[3]).toBeLessThan(0.1)
      expect(box[2] - box[0]).toBeLessThan(0.16)
    }
  })

  it("are each in what a phone zooms in on for them", () => {
    for (const { view, box } of MARKS) {
      expect(box[0]).toBeGreaterThanOrEqual(view[0])
      expect(box[1]).toBeGreaterThanOrEqual(view[1])
      expect(box[2]).toBeLessThanOrEqual(view[2])
      expect(box[3]).toBeLessThanOrEqual(view[3])
    }
  })

  // Scribbled, not written up: no dashes a hand wouldn't bother with.
  it("are written casually, without dashes", () => {
    for (const mark of MARKS) expect(`${mark.said} ${mark.note.join(" ")}`).not.toMatch(/[—–]/)
  })

  // CONTRIBUTING.md: words on the site don't say how many templates there are, as that keeps changing.
  it("never count the templates", () => {
    for (const mark of MARKS) expect(`${mark.said} ${mark.note.join(" ")}`).not.toMatch(/\d+\s+(free\s+)?templates/i)
  })
})
