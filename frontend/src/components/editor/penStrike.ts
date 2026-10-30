// While a section's Delete asks, a pen line is drawn through each of the
// section's lines on the preview, in the blue of the editor's notes, so the
// page shows what would go. The lines are found in the preview's text layer
// (react-pdf's spans over each page) rather than the checker's reading of the
// PDF, which is only made once Check has been opened.

import { reducedMotion, scrollerOf } from "./layout"

/** A line printed on a preview page, in that page's own pixels. */
interface Printed {
  page: HTMLElement
  text: string
  left: number
  right: number
  top: number
  bottom: number
}

// How long one line takes to strike, and the most they all take, one after another.
const LINE_MS = 260
const ALL_MS = 620
const LIFT_MS = 200
// The page's width at 100%, where the pen is 1.6px wide (PdfPreview's MAX_PAGE_WIDTH).
const PAGE_WIDTH = 640

/** A heading as text to compare, however the template sets it: in capitals, letter-spaced, or with punctuation. */
const bare = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")

/**
 * The preview's printed lines, page by page, top to bottom. Spans at one
 * height are one line, unless a wide gap parts them, as two columns do.
 */
function printedLines(): Printed[] {
  const lines: Printed[] = []
  for (const page of document.querySelectorAll<HTMLElement>("[data-preview-page]")) {
    const box = page.getBoundingClientRect()
    // Hidden, as the preview is on a phone while the form shows.
    if (box.width === 0) continue
    const parts = [...page.querySelectorAll<HTMLElement>(".textLayer span")]
      .filter((span) => !span.firstElementChild && span.textContent?.trim())
      .map((span) => {
        const r = span.getBoundingClientRect()
        return {
          text: span.textContent!,
          left: r.left - box.left,
          right: r.right - box.left,
          top: r.top - box.top,
          bottom: r.bottom - box.top,
        }
      })
      .sort((a, b) => a.top - b.top || a.left - b.left)
    const rows: Printed[] = []
    for (const part of parts) {
      const height = part.bottom - part.top
      const middle = (part.top + part.bottom) / 2
      const row = rows.find(
        (row) =>
          Math.abs((row.top + row.bottom) / 2 - middle) < height / 2 &&
          part.left - row.right < height * 2.5 &&
          row.left - part.right < height * 2.5,
      )
      if (!row) {
        rows.push({ page, ...part })
        continue
      }
      row.text = part.left < row.left ? `${part.text} ${row.text}` : `${row.text} ${part.text}`
      row.left = Math.min(row.left, part.left)
      row.right = Math.max(row.right, part.right)
      row.top = Math.min(row.top, part.top)
      row.bottom = Math.max(row.bottom, part.bottom)
    }
    lines.push(...rows.sort((a, b) => a.top - b.top || a.left - b.left))
  }
  return lines
}

/**
 * The lines of the section at `index` among `titles` (every section's, in
 * the order the PDF prints them): from its heading down to the next section's.
 * Each heading is looked for after the last one found, so two sections with
 * the same title are told apart; one that isn't printed is skipped.
 */
function sectionLines(lines: readonly Printed[], titles: readonly string[], index: number): Printed[] {
  let from = 0
  let start = -1
  for (const [at, title] of titles.entries()) {
    const found = lines.findIndex((line, n) => n >= from && bare(line.text) === bare(title))
    if (found < 0) continue
    if (at === index) start = found
    else if (at > index && start >= 0) return lines.slice(start, found)
    from = found + 1
  }
  return start < 0 ? [] : lines.slice(start)
}

/**
 * Strikes out the section at `index` among `titles` on the preview, bringing
 * its heading into view, and gives a function that lifts the pen off again;
 * null when the section isn't on the page (it's empty, or the preview's hidden).
 */
export function strikeOnPreview(titles: readonly string[], index: number): (() => void) | null {
  const lines = sectionLines(printedLines(), titles, index)
  if (lines.length === 0) return null
  const drawings = new Map<HTMLElement, SVGSVGElement>()
  const paths: SVGPathElement[] = []
  for (const [n, line] of lines.entries()) {
    let drawing = drawings.get(line.page)
    if (!drawing) {
      const { width, height } = line.page.getBoundingClientRect()
      drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      drawing.setAttribute("viewBox", `0 0 ${width} ${height}`)
      drawing.setAttribute("aria-hidden", "true")
      drawing.classList.add("pen-strike")
      drawing.style.strokeWidth = String((1.6 * width) / PAGE_WIDTH)
      line.page.append(drawing)
      drawings.set(line.page, drawing)
    }
    // Drawn by hand: a little past each end, and a little off straight, each line its own way.
    const y = line.top + (line.bottom - line.top) * 0.56
    const sway = Math.sin(n * 2.1) * 1.2
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("pathLength", "1")
    path.setAttribute("d", `M${line.left - 2} ${y + 0.6} Q${(line.left + line.right) / 2} ${y - 1 + sway} ${line.right + 2} ${y - 0.4}`)
    drawing.append(path)
    paths.push(path)
  }

  const reduced = reducedMotion()
  const step = Math.min(55, (ALL_MS - LINE_MS) / paths.length)
  paths.forEach((path, n) =>
    path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: reduced ? 0 : LINE_MS,
      delay: reduced ? 0 : n * step,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "both",
    }),
  )

  // Its heading in view, if the preview is scrolled away from it.
  const first = lines[0]
  const scroller = scrollerOf(first.page)
  const seen = scroller.getBoundingClientRect()
  const top = first.page.getBoundingClientRect().top + first.top
  if (top < seen.top || top > seen.bottom - 80) {
    scroller.scrollBy({ top: top - seen.top - seen.height / 4, behavior: reduced ? "auto" : "smooth" })
  }

  return () => {
    for (const path of paths) {
      path.getAnimations().forEach((animation) => animation.cancel())
      path.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }], {
        duration: reduced ? 0 : LIFT_MS,
        easing: "ease-in",
        fill: "forwards",
      })
    }
    setTimeout(() => drawings.forEach((drawing) => drawing.remove()), reduced ? 0 : LIFT_MS)
  }
}
