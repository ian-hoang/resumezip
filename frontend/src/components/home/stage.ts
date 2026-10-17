// Where the home page's story (HomeStory.tsx) puts things on the screen, and
// the marker's strokes, worked out here so the page only has to apply them.
import { BEATS, clamp, inOut, span } from "./motion"
import { type Point, type Stroke, arrowStrokes, loopStroke } from "./pen"

export interface Size {
  width: number
  height: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The editor's picture, public/home/editor.webp: its frame at a 1440 × 900
 * window, at 1.5×, with resumezip's own resume. Its menus' pictures (Menu) were
 * taken in the same window, so they lie exactly over it.
 */
export const EDITOR = { width: 2088, height: 1278, src: "/home/editor.webp" }
const EDITOR_RATIO = EDITOR.height / EDITOR.width

type Rect = readonly [left: number, top: number, right: number, bottom: number]

/** A picture laid over the editor's picture, and where it lies on it. */
export interface Overlay {
  src: string
  box: Rect
}

/**
 * A menu of the editor's that the story opens, as a click would: where the
 * click lands, and its button as it looks pressed and the menu open, each a
 * picture of just what changes, laid over the editor's picture.
 */
export interface Menu {
  click: Point
  button: Overlay
  open: Overlay
}

/** What's marked on the editor, and the note written by it. Boxes are shares of the editor's picture. */
export interface Mark {
  /** What it says, for screen readers: the story shows it as handwriting. */
  said: string
  /** The handwritten note, a line at a time. */
  note: readonly string[]
  /** What's looped round: a word or a button in the editor's top bar. The note is written over it. */
  box: Rect
  /** What a phone zooms in on: the mark, and the menu it opens. */
  view: Rect
  /** The menu the button opens, clicked open as it's marked. */
  menu?: Menu
}

// What the editor is marked with, left to right, as it's read: where the resume
// is kept, then the template picker and the download button, each clicked to
// show its menu. Each note has to stay true of the app, and sound like someone
// scribbled it. Words on the site don't say how many templates there are
// (CONTRIBUTING.md). The boxes were measured on the pictures.
export const MARKS: readonly Mark[] = [
  {
    said: "Saved in your browser. We never see your resume.",
    note: ["saved in your browser,", "we never see it"],
    // The top bar's Saved.
    box: [0.1332, 0.0452, 0.1617, 0.0698],
    view: [0.02, 0, 0.32, 0.16],
  },
  {
    said: "Pick any template. They’re all free.",
    note: ["pick any template,", "they’re all free"],
    // The template picker.
    box: [0.7427, 0.034, 0.8253, 0.081],
    view: [0.41, 0, 0.84, 0.46],
    menu: {
      click: [0.784, 0.058],
      button: { src: "/home/templates-button.webp", box: [0.7404, 0.0305, 0.8276, 0.0876] },
      open: { src: "/home/templates-menu.webp", box: [0.4104, 0.0892, 0.8381, 1] },
    },
  },
  {
    said: "Download a PDF, a Word file or LaTeX, or send the PDF to your Google Drive.",
    note: ["get a PDF, Word or LaTeX,", "or send it to your Drive"],
    // Download PDF and its ▾, which the click opens.
    box: [0.8361, 0.034, 0.9806, 0.081],
    view: [0.6, 0, 0.995, 0.48],
    menu: {
      click: [0.966, 0.058],
      button: { src: "/home/download-button.webp", box: [0.8396, 0.0305, 0.9828, 0.0876] },
      open: { src: "/home/download-menu.webp", box: [0.7605, 0.0876, 0.9938, 0.493] },
    },
  },
]

/** The header's strip (SiteHeader.tsx), which the stage's things keep under: 76px, 84px from md. */
export const headerHeight = (screen: Size) => (screen.width >= 768 ? 84 : 76)

/** The room each side of the editor on a wide screen: sky, where the meadow shows. */
const SIDE_ROOM = 280
/** How far a note is above the editor: room for its arrow, down onto what it's about. */
const ARROW_ROOM = 44
/** How far under the header the notes are written. */
const UNDER_HEADER = 10
/** How far a phone's camera zooms into the editor, at most, to what's being marked. */
const ZOOM = 2.1

/** The camera on the editor's picture: scaled about its top left corner, then moved. */
export interface Camera {
  x: number
  y: number
  scale: number
}

export const AT_REST: Camera = { x: 0, y: 0, scale: 1 }

/** A note as it's written on the screen. */
export interface WrittenNote {
  /** Where its first line starts down, and across: its lines start at x, are centred on it, or end at it. */
  x: number
  y: number
  align: "left" | "center" | "right"
  size: number
  /** How far it's turned, in degrees, as a hand writes. */
  turn: number
}

export interface StageLayout {
  /** The editor is shown whole; otherwise its camera moves in on each mark. */
  beside: boolean
  editor: Box
  /** Where the camera is on the editor while each mark is drawn. */
  cameras: Camera[]
  notes: WrittenNote[]
  /** Each note's arrow to its mark: the curve, then the head's two strokes. */
  arrows: Stroke[][]
}

/**
 * The editor, and each note and its arrow. Each note is written over the
 * editor, above what it's about, and its arrow comes straight down onto its
 * loop: never across the words beside it, nor the menu that opens under it.
 * Anything narrower than a wide screen has the editor's camera zoomed in on
 * the mark each note is about.
 */
export function layoutStage(screen: Size): StageLayout {
  const { width: vw, height: vh } = screen
  const header = headerHeight(screen)
  const beside = vw >= 1180 && vh >= 600
  const size = beside ? 27 : 23
  const twoLines = 2 * size * 1.02

  let editor: Box
  // Room above the editor for the notes and their arrows. On a wide screen its foot is a little
  // behind the grass, which covers the screen's last few dozen pixels.
  const above = UNDER_HEADER + twoLines + ARROW_ROOM
  if (beside) {
    const width = Math.min(1000, vw - 2 * SIDE_ROOM, (vh - header - above - 40) / EDITOR_RATIO)
    const height = width * EDITOR_RATIO
    editor = { x: (vw - width) / 2, y: header + above + Math.max(0, (vh - header - above - 40 - height) / 2), width, height }
  } else {
    const width = Math.max(160, Math.min(vw - 24, 760, (vh - header - above - 40) / EDITOR_RATIO))
    editor = { x: (vw - width) / 2, y: header + above, width, height: width * EDITOR_RATIO }
  }

  // The camera on each mark: none beside the editor; on a phone, zoomed in on what's in view for
  // it, in the middle, never past the picture's edges.
  const cameras = MARKS.map(({ view: [left, top, right, bottom] }): Camera => {
    if (beside) return AT_REST
    const scale = Math.min(ZOOM, 1 / (right - left), 1 / (bottom - top))
    const { width, height } = editor
    return {
      x: clamp(width / 2 - ((left + right) / 2) * width * scale, width - width * scale, 0),
      y: clamp(height / 2 - ((top + bottom) / 2) * height * scale, height - height * scale, 0),
      scale,
    }
  })
  // Where a share of the picture is on the screen, under a camera.
  const on = (camera: Camera, fx: number, fy: number): Point => [
    editor.x + camera.x + fx * editor.width * camera.scale,
    editor.y + camera.y + fy * editor.height * camera.scale,
  ]

  // Over each mark, kept on the screen: a note's about a third of its size across a letter.
  const over = editor.y - twoLines - ARROW_ROOM
  const middles = MARKS.map(({ box }, i) => (on(cameras[i], box[0], box[1])[0] + on(cameras[i], box[2], box[3])[0]) / 2)
  const notes = MARKS.map(({ note }, i): WrittenNote => {
    const half = (Math.max(...note.map((line) => line.length)) * size * 0.36) / 2
    return { x: clamp(middles[i], half + 12, vw - half - 12), y: over, align: "center", size, turn: i % 2 ? 1.5 : -1.5 }
  })

  // Down from under its note, as near over its mark as the note reaches, to just short of the
  // loop's top: a loop is drawn a few pixels outside its box.
  const pen = beside ? 3 : 2.2
  const arrows = MARKS.map(({ box }, i) => {
    const note = notes[i]
    const top = on(cameras[i], box[0], box[1])[1]
    const from: Point = [clamp(middles[i], note.x - 50, note.x + 50), note.y + twoLines + 4]
    return arrowStrokes(from, [middles[i], top - GAP], i % 2 ? 4 : -4, pen)
  })

  return { beside, editor, cameras, notes, arrows }
}

/** The marks on the editor's picture, at its own size: a loop round each box. */
export function marksOnPicture(): Stroke[] {
  return MARKS.map(({ box: [left, top, right, bottom] }, i) =>
    loopStroke([left * EDITOR.width, top * EDITOR.height, right * EDITOR.width, bottom * EDITOR.height], 1.14, i % 2 ? 0.04 : -0.03, 7),
  )
}

/**
 * How much of a mark's drawing each of its strokes takes: the mark itself the
 * most, its arrow's curve some, the arrow's head a moment. Returned as each
 * stroke's [from, to] share of the pen's time.
 */
export function strokeTimes(count: number): [number, number][] {
  const weights = Array.from({ length: count }, (_, j) => (j === 0 ? 0.6 : j === 1 ? 0.3 : 0.05))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let at = 0
  return weights.map((weight) => {
    const from = at
    at += weight / total
    return [from, at]
  })
}

/**
 * The way in, at the story's end, `height` tall: over the editor's lower
 * middle beside it, or under the editor in place of the notes; always wholly
 * on the screen, under the header.
 */
export function wayInAt(layout: StageLayout, screen: Size, height: number): Box {
  const { editor } = layout
  const width = layout.beside ? 560 : Math.min(420, screen.width - 32)
  const top = layout.beside ? editor.y + editor.height * 0.6 - height / 2 : editor.y + editor.height + 16
  const highest = headerHeight(screen) + 8
  const lowest = screen.height - 16 - height
  return { x: (screen.width - width) / 2, y: Math.max(highest, Math.min(top, lowest)), width, height }
}

/** How far short of its loop's box an arrow's head stops: past the loop, which is drawn a few pixels outside it. */
export const GAP = 11

const mix = (a: Camera, b: Camera, t: number): Camera => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  scale: a.scale + (b.scale - a.scale) * t,
})

/**
 * Where the camera is on the editor at `v`, in story vh: at rest until the
 * first mark, when it moves in on it, then on to each mark in the moment
 * before it's drawn, and back out to the whole editor for the way in.
 */
export function cameraAt(v: number, cameras: readonly Camera[]): Camera {
  const [first] = BEATS.notes
  let camera = mix(AT_REST, cameras[0], inOut(span(v, [first[0] - 24, first[0] - 4])))
  BEATS.notes.forEach((beat, i) => {
    if (i > 0) camera = mix(camera, cameras[i], inOut(span(v, [beat[0] - 7, beat[0]])))
  })
  return mix(camera, AT_REST, inOut(span(v, [BEATS.wrap[0], BEATS.wrap[0] + 20])))
}
