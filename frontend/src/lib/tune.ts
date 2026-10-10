// The person's adjustments to how their template sets the page (the editor's
// Fine-tune panel): sizes and spacing as multiples of the template's own, so
// every template keeps its proportions. Printed with the resume.

import type { TemplateId } from "@/lib/templates"

export type Paper = "us-letter" | "a4"

/** What Fine-tune can change. Unset means the template's own setting. */
export interface Tune {
  /** Text size, as a multiple of the template's: 0.85 to 1.15. */
  size?: number
  /** Page margins, as a multiple of the template's: 0.6 to 1.4. */
  margin?: number
  /** Space between lines, as a multiple of the template's: 0.8 to 1.3. */
  leading?: number
  paper?: Paper
  /** Shrink the text a little at a time until the resume fits on one page. */
  onePage?: boolean
}

export type TuneScale = "size" | "margin" | "leading"

/** The lowest and highest multiple of each, and the step the panel's sliders move in. */
// prettier-ignore
export const SCALES: Record<TuneScale, { min: number; max: number; step: number }> = {
  size:    { min: 0.85, max: 1.15, step: 0.025 },
  margin:  { min: 0.6,  max: 1.4,  step: 0.05 },
  leading: { min: 0.8,  max: 1.3,  step: 0.05 },
}

export const PAPERS: readonly Paper[] = ["us-letter", "a4"]

/**
 * Each template's own settings, which the panel shows the multiples against:
 * its text size in points (its `#set text(size:)`), its left and right
 * margins in inches, and its paper. tune.test.ts checks them against the
 * templates.
 */
// prettier-ignore
export const TEMPLATE_SETTINGS: Record<TemplateId, { size: number; margin: number; paper: Paper }> = {
  jake:         { size: 11,   margin: 0.4,  paper: "us-letter" },
  modernjack:   { size: 11,   margin: 0.4,  paper: "us-letter" },
  levelsfyi:    { size: 10,   margin: 0.4,  paper: "us-letter" },
  referme:      { size: 10,   margin: 0.5,  paper: "us-letter" },
  ian:          { size: 9.96, margin: 0.35, paper: "us-letter" },
  resumeworded: { size: 10.8, margin: 0.6,  paper: "us-letter" },
}

/** A tune as the templates read it (see templates/common.typ): every multiple, 1 when unset, and "" for the template's own paper. */
export interface PrintedTune {
  size: number
  margin: number
  leading: number
  paper: Paper | ""
  onePage: boolean
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

// Multiples are kept to three decimals, so a step's float error (1 - 0.025 * 3)
// can't print a size other than the one the panel shows.
const round = (value: number) => Math.round(value * 1000) / 1000

/**
 * A saved tune as the editor and the templates can use it, and whether that's
 * all of it. Saved data and files are untrusted: unknown keys and values of
 * the wrong type are dropped, and multiples out of range are brought to the
 * nearest end of it. Null if there's nothing to keep, as for a value that
 * isn't an object, or one with only the template's own settings.
 */
export function readTune(value: unknown): { tune: Tune | null; complete: boolean } {
  if (value == null) return { tune: null, complete: true }
  if (!isObject(value)) return { tune: null, complete: false }
  const tune: Tune = {}
  let complete = true
  for (const [key, field] of Object.entries(value)) {
    if (key === "size" || key === "margin" || key === "leading") {
      if (typeof field !== "number" || !Number.isFinite(field)) {
        complete = false
        continue
      }
      const { min, max } = SCALES[key]
      const within = round(Math.min(max, Math.max(min, field)))
      if (within !== field) complete = false
      if (within !== 1) tune[key] = within
    } else if (key === "paper") {
      if (PAPERS.includes(field as Paper)) tune.paper = field as Paper
      else complete = false
    } else if (key === "onePage") {
      if (typeof field !== "boolean") complete = false
      else if (field) tune.onePage = true
    } else {
      complete = false
    }
  }
  return { tune: Object.keys(tune).length > 0 ? tune : null, complete }
}

/** The tune with one setting changed, or back to the template's own when `value` is undefined; null once all of them are. */
export function withSetting<Key extends keyof Tune>(tune: Tune | null | undefined, key: Key, value: Tune[Key]): Tune | null {
  const next: Tune = { ...readTune(tune).tune }
  if (value === undefined) delete next[key]
  else next[key] = value
  return readTune(next).tune
}

/** A saved tune as the templates print it: every setting there, read defensively. */
export function printedTune(saved: unknown): PrintedTune {
  const tune = readTune(saved).tune ?? {}
  return {
    size: tune.size ?? 1,
    margin: tune.margin ?? 1,
    leading: tune.leading ?? 1,
    paper: tune.paper ?? "",
    onePage: tune.onePage === true,
  }
}
