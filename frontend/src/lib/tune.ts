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
  margin:       { size: 9.6,  margin: 0.55, paper: "us-letter" },
  swiss:        { size: 9.2,  margin: 0.55, paper: "us-letter" },
  mono:         { size: 8.4,  margin: 0.55, paper: "us-letter" },
  accent:       { size: 10.5, margin: 0.6,  paper: "us-letter" },
  deedy:        { size: 10.3, margin: 0.5,  paper: "us-letter" },
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

/** The text size multiples "Keep it to one page" tries, largest first: down from `size` a step at a time, to the smallest. */
export function smallerSizes(size: number): number[] {
  const { min, step } = SCALES.size
  const sizes: number[] = []
  for (let next = round(size - step); next > min; next = round(next - step)) sizes.push(next)
  if (size > min) sizes.push(min)
  return sizes
}

/** What keeping to one page did: the text size multiple it printed at, and whether that fits. */
export interface Fit {
  size: number
  fits: boolean
}

/**
 * Prints a resume that's meant to fit on one page, and says how it went.
 * `print` prints it at a text size multiple and counts its pages. Past one
 * page at `size`, it looks for the largest of the smaller sizes (see
 * smallerSizes) that fits: a step down, then two more, four more, and so on,
 * then halves the last gap. So a resume a few lines over takes a print or
 * two more, and one far over only a few. If even the smallest doesn't fit,
 * it's printed at that, as near to one page as it goes.
 */
export async function fitOnePage<Printed>(
  size: number,
  print: (size: number) => Promise<{ pages: number; printed: Printed }>,
): Promise<{ fit: Fit; printed: Printed }> {
  const first = await print(size)
  if (first.pages <= 1) return { fit: { size, fits: true }, printed: first.printed }
  const sizes = smallerSizes(size)
  if (sizes.length === 0) return { fit: { size, fits: false }, printed: first.printed }
  const tried = new Map<number, { pages: number; printed: Printed }>()
  const at = async (index: number) => {
    let result = tried.get(index)
    if (!result) {
      result = await print(sizes[index])
      tried.set(index, result)
    }
    return result
  }
  const last = sizes.length - 1
  // The index of the largest size known to run over (-1 for `size` itself), and of the first known to fit.
  let over = -1
  let fits = -1
  for (let stride = 1; fits < 0 && over < last; stride *= 2) {
    const index = Math.min(over + stride, last)
    if ((await at(index)).pages <= 1) fits = index
    else over = index
  }
  if (fits < 0) return { fit: { size: sizes[last], fits: false }, printed: (await at(last)).printed }
  while (fits - over > 1) {
    const middle = Math.floor((over + fits) / 2)
    if ((await at(middle)).pages <= 1) fits = middle
    else over = middle
  }
  return { fit: { size: sizes[fits], fits: true }, printed: (await at(fits)).printed }
}

/**
 * How many pages a PDF from Typst has, or NaN if it can't tell. Typst writes
 * the page tree's root as the file's first object, ahead of anything the
 * person wrote (their name is the PDF's title, further on), and doesn't
 * compress it.
 */
export function pageCount(pdf: Uint8Array): number {
  const start = new TextDecoder("latin1").decode(pdf.subarray(0, 1024))
  // After the version, a comment line of bytes over 127 marks the file as binary.
  const count = /^%PDF-[\d.]+\s+(?:%[^\n]*\n\s*)?1 0 obj\s*<<\s*\/Type\s*\/Pages\s*\/Count\s+(\d+)/.exec(start)?.[1]
  return count === undefined ? NaN : Number(count)
}
