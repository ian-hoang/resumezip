"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { locate } from "@/lib/review/match"
import { LENSES, TONES, useAiReview, type PlacedNote } from "./AiReview"
import { WIDE_SCREEN } from "./layout"
import PdfPreview from "./PdfPreview"

/** The live preview, with the AI review drawn on it while Check is open. */
export function ReviewedPreview(props: Omit<React.ComponentProps<typeof PdfPreview>, "frame" | "overlay">) {
  const { shown, lens } = useAiReview()
  // The marks come in again when the notes shown change.
  return <PdfPreview {...props} frame={shown ? <ReviewFrame /> : null} overlay={shown ? <ReviewMarks key={lens} /> : null} />
}

/** A line of text on the preview, in pixels from the pages' top left. */
interface Line {
  x: number
  y: number
  w: number
  h: number
}

/** A note's words on the preview: the lines they're printed on. */
interface Mark {
  key: string
  lines: Line[]
}

// The tooltip's widest, in pixels.
const TIP_WIDTH = 272

/**
 * The tinted frame around the pages, with which notes to show along its top,
 * as the Check panel has too.
 */
function ReviewFrame() {
  const { lens, setLens, notes } = useAiReview()
  return (
    <>
      <div
        data-review
        aria-hidden="true"
        className={`absolute -inset-x-2.5 -bottom-2.5 -top-11 -z-10 rounded-[14px] transition-colors duration-300 ${TONES[lens].frame}`}
      />
      <div data-review role="group" aria-label="AI review on the preview" className="absolute -top-9 left-0 z-20 flex gap-1">
        {LENSES.map((option) => {
          const { name, icon: Icon } = TONES[option]
          const selected = option === lens
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setLens(option)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors ${
                selected ? `bg-sheet shadow-[0_1px_2px_rgba(17,19,24,0.08)] ${TONES[option].ink}` : "text-ink-2 hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {name}
              <span className="tabular-nums">· {notes.filter((note) => note.kind === option).length}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

/**
 * The notes being shown, drawn over the pages: a pen stroke under each one's
 * words, and its note beside them while it's pointed at or chosen, from here
 * or from the Check panel. Choosing one opens its section in the form, where
 * the form is beside the preview. The panel
 * lists the same notes, for keyboards and screen readers, so this is hidden
 * from them.
 */
function ReviewMarks() {
  const { notes, lens, active, point, pin, pointedFrom, open } = useAiReview()
  const shown = useMemo(() => notes.filter((note) => note.kind === lens), [notes, lens])
  const layer = useRef<HTMLDivElement>(null)
  const [marks, setMarks] = useState<Mark[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Measured again whenever the preview's text is drawn again, as after typing or zooming.
  useEffect(() => {
    const overlay = layer.current
    const pages = overlay?.parentElement
    if (!overlay || !pages) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = overlay.getBoundingClientRect()
        setSize({ width: box.width, height: box.height })
        setMarks(measure(pages, box, shown))
      })
    }
    update()
    // Changes to the review's own marks don't count.
    const ours = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest("[data-review]")
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => !ours(record.target))) update()
    })
    mutations.observe(pages, { childList: true, subtree: true, characterData: true })
    const resize = new ResizeObserver(update)
    resize.observe(pages)
    return () => {
      cancelAnimationFrame(frame)
      mutations.disconnect()
      resize.disconnect()
    }
  }, [shown])

  // A note chosen with a tap or a click stays until something else is chosen.
  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest("[data-mark], [data-note]"))) pin(null)
    }
    document.addEventListener("pointerdown", away)
    return () => document.removeEventListener("pointerdown", away)
  }, [pin])

  // A note pointed at in the panel is brought into view, if the preview's on screen.
  useEffect(() => {
    if (!active || pointedFrom !== "panel") return
    const mark = layer.current?.querySelector(`[data-mark="${active}"]`)
    if (!mark || mark.getClientRects().length === 0) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    mark.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" })
  }, [active, pointedFrom])

  const stroke = TONES[lens].stroke
  // Until they're measured again, marks can be left from a note that's just gone.
  const drawn = marks.flatMap((mark) => {
    const note = shown.find((one) => one.key === mark.key)
    return note ? [{ ...mark, note }] : []
  })
  const pointed = drawn.find((mark) => mark.key === active)
  return (
    // Coming in from a blur, as if the pages were swapped under it.
    <div ref={layer} data-review aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 animate-review-in motion-reduce:animate-none">
      <svg className="absolute inset-0 overflow-visible" width={size.width} height={size.height}>
        {drawn.map((mark, index) =>
          mark.lines.map((line, number) => {
            const [first, second] = strokes(line, `${mark.key}:${number}`)
            const on = mark.key === active
            const width = Math.max(1.2, line.h * 0.11) * (on ? 1.35 : 1)
            // One after another, as a pen would.
            const delay = { animationDelay: `${index * 90 + number * 140}ms` }
            return (
              <g key={`${mark.key}:${number}`} stroke={stroke} fill="none" strokeLinecap="round">
                {on && <rect x={line.x - 2} y={line.y} width={line.w + 4} height={line.h * 1.1} rx={3} fill={stroke} fillOpacity={0.14} stroke="none" />}
                <path d={first} pathLength={1} strokeWidth={width} className="review-stroke" style={delay} />
                <path d={second} pathLength={1} strokeWidth={width * 0.75} strokeOpacity={0.55} className="review-stroke" style={delay} />
              </g>
            )
          }),
        )}
      </svg>

      {drawn.map(({ key, lines, note }) =>
        lines.map((line, number) => (
          <div
            key={`${key}:${number}`}
            data-mark={key}
            className="pointer-events-auto absolute cursor-pointer"
            style={{ left: line.x - 2, top: line.y, width: line.w + 4, height: line.h * 1.35 }}
            onMouseEnter={() => point(key)}
            onMouseLeave={() => point(null)}
            onClick={() => {
              pin(key)
              // Where the form is beside the preview, its section opens too.
              if (window.matchMedia(WIDE_SCREEN).matches) open(note)
            }}
          />
        )),
      )}

      {pointed && <Tip key={pointed.key} note={pointed.note} lines={pointed.lines} size={size} />}
    </div>
  )
}

/** A note, under its words, or over them near the bottom of the pages. */
function Tip({ note, lines, size }: { note: PlacedNote; lines: Line[]; size: { width: number; height: number } }) {
  const first = lines[0]
  const last = lines[lines.length - 1]
  const width = Math.min(TIP_WIDTH, size.width)
  const left = Math.max(0, Math.min(first.x, size.width - width))
  const below = last.y + last.h * 1.35 + 6
  const position: React.CSSProperties = below + 120 > size.height ? { left, bottom: size.height - first.y + 8 } : { left, top: below }
  return (
    <div
      className="absolute z-20 animate-tip-in rounded-[10px] bg-sheet px-3 py-2 text-[13px] leading-snug text-ink shadow-[0_1px_2px_rgba(17,19,24,0.08),0_16px_36px_-12px_rgba(17,19,24,0.3)] ring-1 ring-black/[0.06] motion-reduce:animate-none"
      style={{ ...position, maxWidth: width, width: "max-content" }}
    >
      {note.note}
    </div>
  )
}

// The preview's text, as the invisible copy laid over each page has it, and
// the text nodes it's in, with where each starts in it.
function printedText(pages: HTMLElement) {
  const nodes: Text[] = []
  const starts: number[] = []
  let text = ""
  for (const layer of pages.querySelectorAll("[data-preview-shown] .react-pdf__Page__textContent")) {
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push(node as Text)
      starts.push(text.length)
      text += (node as Text).data
    }
  }
  return { nodes, starts, text }
}

/** Where each note's words are printed on the preview: the lines they're on. */
function measure(pages: HTMLElement, box: DOMRect, notes: readonly PlacedNote[]): Mark[] {
  const { nodes, starts, text } = printedText(pages)
  if (nodes.length === 0) return []
  const spans = locate(
    text,
    notes.map((note) => ({ piece: note.text, quote: note.quote })),
  )
  // The text node a place in the text is in, and where in it. An end is in the node it ends in.
  const nodeAt = (at: number, end: boolean): [Text, number] => {
    let index = 0
    while (index + 1 < nodes.length && (end ? starts[index + 1] < at : starts[index + 1] <= at)) index++
    return [nodes[index], at - starts[index]]
  }
  const range = document.createRange()
  return notes.flatMap((note, index) => {
    const span = spans[index]
    if (!span) return []
    range.setStart(...nodeAt(span[0], false))
    range.setEnd(...nodeAt(span[1], true))
    const lines = linesOf(range.getClientRects(), box)
    return lines.length > 0 ? [{ key: note.key, lines }] : []
  })
}

// The boxes a range covers, one a line: pdf.js lays out each run of text on its own.
function linesOf(rects: DOMRectList, box: DOMRect): Line[] {
  const lines: Line[] = []
  for (const rect of rects) {
    if (rect.width < 0.5 || rect.height < 0.5) continue
    const x = rect.left - box.left
    const y = rect.top - box.top
    const same = lines.find((line) => Math.abs(line.y + line.h / 2 - (y + rect.height / 2)) < Math.min(line.h, rect.height) / 2)
    if (!same) {
      lines.push({ x, y, w: rect.width, h: rect.height })
      continue
    }
    const right = Math.max(same.x + same.w, x + rect.width)
    const bottom = Math.max(same.y + same.h, y + rect.height)
    same.x = Math.min(same.x, x)
    same.y = Math.min(same.y, y)
    same.w = right - same.x
    same.h = bottom - same.y
  }
  return lines.sort((a, b) => a.y - b.y)
}

// Two pen strokes under a line of text, a little uneven, the same each time
// they're drawn for the same note.
function strokes(line: Line, seed: string): [string, string] {
  const random = seeded(seed)
  const wobble = () => (random() - 0.5) * line.h * 0.14
  const y = line.y + line.h * 1.1
  const left = line.x - 2
  const right = line.x + line.w + 3
  const first = `M ${left} ${y + wobble()} C ${left + line.w * 0.3} ${y + wobble()}, ${left + line.w * 0.7} ${y + wobble()}, ${right} ${y + wobble()}`
  const gap = line.h * 0.18
  const second = `M ${left + 4} ${y + gap + wobble()} Q ${left + line.w * 0.5} ${y + gap + wobble()}, ${right - 6} ${y + gap * 0.5 + wobble()}`
  return [first, second]
}

// Numbers between 0 and 1 that look random, the same for the same seed (mulberry32).
function seeded(seed: string): () => number {
  let state = 0
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 0x5bd1e995)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
