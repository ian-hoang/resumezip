// The blue marker on the home page's editor (HomeStory.tsx): loops round
// what a note is about, a line under it, arrows from the notes. Each stroke is
// a filled outline whose width swells in the middle and thins where the pen
// lands and lifts, as a felt tip does, and the line down its middle, which a
// mask draws along to make it look written.

export type Point = readonly [number, number]

export interface Stroke {
  /** The ink: a closed outline, as an SVG path. */
  outline: string
  /** The pen's path down the middle, as an SVG path, for the mask that draws the ink in. */
  center: string
  /** How wide the pen is, in pixels. */
  width: number
}

const SAMPLES_PER_SEGMENT = 13

// Catmull-Rom through the points, sampled densely, so a few points make a smooth line.
function smoothLine(points: readonly Point[]): Point[] {
  const dense: Point[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    for (let step = 0; step < SAMPLES_PER_SEGMENT; step++) {
      const t = step / SAMPLES_PER_SEGMENT
      const t2 = t * t
      const t3 = t2 * t
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
      dense.push([at(0), at(1)])
    }
  }
  dense.push(points[points.length - 1])
  return dense
}

const pathOf = (points: readonly Point[]) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`

/**
 * A stroke through `points`. `taper` is how much of each end, as a share of the
 * stroke, narrows to where the pen lands or lifts.
 */
export function penStroke(points: readonly Point[], width: number, taper: number): Stroke {
  const line = smoothLine(points)
  const n = line.length
  const left: Point[] = []
  const right: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(i - 1, 0)]
    const b = line[Math.min(i + 1, n - 1)]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const dx = (b[0] - a[0]) / length
    const dy = (b[1] - a[1]) / length
    const u = i / (n - 1)
    const ends = Math.min(1, u / taper, (1 - u) / taper)
    // A slight swell and thinning along the stroke, as a hand presses unevenly.
    const half = (width / 2) * (0.35 + 0.65 * Math.sqrt(Math.max(ends, 0))) * (0.92 + 0.16 * Math.sin(u * 9.1))
    left.push([line[i][0] - dy * half, line[i][1] + dx * half])
    right.push([line[i][0] + dy * half, line[i][1] - dx * half])
  }
  return { outline: `${pathOf([...left, ...right.reverse()])} Z`, center: pathOf(line), width }
}

/**
 * A loose loop round a box (x0, y0, x1, y1): a little more than one turn
 * (`turns`), wobbling, not quite closing where it started, tilted by `tilt`
 * radians. A wider pen draws it a little further out.
 */
export function loopStroke(
  [x0, y0, x1, y1]: readonly [number, number, number, number],
  turns: number,
  tilt: number,
  width: number,
): Stroke {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2 + (9 * width) / 3.7
  const ry = (y1 - y0) / 2 + (5.5 * width) / 3.7
  const points: Point[] = []
  for (let t = 0; t <= turns * Math.PI * 2; t += 0.22) {
    const angle = 2.6 + t
    const wobble = 1 + 0.035 * Math.sin(3 * t + 1) + 0.05 * (t / (Math.PI * 2))
    const x = Math.cos(angle) * rx * wobble
    const y = Math.sin(angle) * ry * wobble * (1 + 0.06 * Math.sin(2 * t))
    points.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt) + t * 0.12 - 0.4])
  }
  return penStroke(points, width, 0.06)
}

/** A line under words from x0 to x1 at y, wavering a little and drifting up as a hand does. */
export function underStroke(x0: number, x1: number, y: number, width: number): Stroke {
  const points: Point[] = []
  for (let i = 0; i <= 8; i++) {
    const x = x0 + ((x1 - x0) * i) / 8
    points.push([x, y + Math.sin(x * 0.05) * 1.2 + (x - x0) * -0.012])
  }
  return penStroke(points, width, 0.08)
}

/**
 * An arrow from `from` to `to`: a soft curve bent `bend` pixels to one side,
 * then a two-stroke head at `to`.
 */
export function arrowStrokes(from: Point, to: Point, bend: number, width: number): Stroke[] {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
  const control: Point = [
    (from[0] + to[0]) / 2 - ((to[1] - from[1]) / length) * bend,
    (from[1] + to[1]) / 2 + ((to[0] - from[0]) / length) * bend,
  ]
  const curve: Point[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const k = (a: number, c: number, b: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b
    curve.push([k(from[0], control[0], to[0]), k(from[1], control[1], to[1])])
  }
  const end = curve[curve.length - 1]
  const before = curve[curve.length - 3]
  const angle = Math.atan2(end[1] - before[1], end[0] - before[0])
  const barb = (turn: number): Point[] => [end, [end[0] - 15 * Math.cos(angle + turn), end[1] - 15 * Math.sin(angle + turn)]]
  return [penStroke(curve, width * 0.76, 0.1), penStroke(barb(0.5), width * 0.7, 0.3), penStroke(barb(-0.55), width * 0.7, 0.3)]
}
