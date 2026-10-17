// The home page's story (HomeStory.tsx) is played by the scroll: how far down
// the story the page is, in "story vh" (100 is one screen of scrolling), and
// when each part of it happens.

export const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value))
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** How far `value` is through `[from, to]`, 0 to 1. */
export const span = (value: number, [from, to]: readonly [number, number]) => clamp((value - from) / (to - from))

// Easings, each from 0 to 1. `out3` starts fast and settles; `inOut` and
// `smooth` ease both ends.
export const out3 = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
export const inOut = (t: number) => {
  const c = clamp(t)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}
export const smooth = (t: number) => {
  const c = clamp(t)
  return c * c * (3 - 2 * c)
}

type Range = readonly [number, number]

/** How many things the editor is marked with (MARKS in stage.ts). */
const NOTE_COUNT = 3
const FIRST_NOTE = 150
// Each mark (with its menu opened first, if it's in one) is drawn and its note
// written over NOTE_IN, then held, and the next starts NOTE_STEP after it: most
// of a screen of scrolling each, so a flick of the wheel doesn't skip one, and
// each note shows whole for a while before it makes way for the next.
const NOTE_IN = 40
const NOTE_STEP = 80
/** Where the last note starts. */
const LAST_NOTE = FIRST_NOTE + (NOTE_COUNT - 1) * NOTE_STEP

/** The way in starts as long after the last note is written as the others are held. */
const WAY_IN = LAST_NOTE + NOTE_IN + 34

/** The story's length: from the first screen at rest to the way in, at the end. */
export const STORY_LENGTH = WAY_IN + 60

/**
 * When each part happens, in story vh. The first screen lifts away as the
 * editor rises out of the grass; once it has settled, it's marked one thing at
 * a time, each with its note, which makes way for the next; then the last steps
 * back for the way in.
 */
export const BEATS = {
  hero: [0, 70] as Range,
  /** The camera eases toward the meadow while the editor rises. */
  push: [0, 180] as Range,
  editor: [20, 130] as Range,
  notes: Array.from({ length: NOTE_COUNT }, (_, i): Range => [FIRST_NOTE + i * NOTE_STEP, FIRST_NOTE + i * NOTE_STEP + NOTE_IN]),
  /** The last note steps back, and the editor softens, for the way in. */
  wrap: [WAY_IN, WAY_IN + 30] as Range,
  cta: [WAY_IN + 10, WAY_IN + 54] as Range,
}

type Share = readonly [number, number]

/**
 * Within a mark's beat, when one of the editor's menus is opened for it, as a
 * click would: the pointer comes to its button and clicks it, the menu opens,
 * the pointer leaves, then the mark is drawn in the menu and its note written.
 */
export const CLICK: { glide: Share; press: Share; open: Share; leave: Share; ink: Share } = {
  glide: [0.02, 0.22],
  press: [0.22, 0.3],
  open: [0.26, 0.38],
  leave: [0.3, 0.42],
  ink: [0.38, 1],
}

/**
 * How far down the story the page is: 0 while the story's top is at the top of
 * the screen, STORY_LENGTH once its last screen is all that's left of it.
 */
export function storyAt(top: number, height: number, screen: number): number {
  return clamp(-top / Math.max(1, height - screen)) * STORY_LENGTH
}

/**
 * The next frame's position, eased toward where the scroll is, so a mouse
 * wheel's steps glide rather than jump. `dt` is the time since the last frame,
 * in milliseconds; it's close enough to call it there once it's under 0.05.
 * The easing is short: anything that trails the scroll by more than a tenth
 * of a screen feels slow to answer.
 */
export function glide(shown: number, target: number, dt: number): number {
  const next = shown + (target - shown) * (1 - Math.exp(-dt / 30))
  return Math.abs(target - next) < 0.05 ? target : next
}
