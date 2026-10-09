"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { compilerStatus, onCompilerStatus } from "@/lib/typst/compile"

// Stands in for the preview until the first PDF is on screen: a blank page
// that prints grey lines laid out like a resume, from the top down. While the
// PDF compiler downloads, the lines keep pace with how much of it has
// arrived, so the page is also a progress bar. Otherwise they print in
// quickly. Once they're all in, a line passes down the page until the
// preview takes its place.

/** A grey line, in points on a US Letter page. */
interface Bar {
  x: number
  y: number
  w: number
  h: number
  strong?: boolean
}

const PAGE = { width: 612, height: 792 }
const BARS = layOut()
// Below this, a download is quick enough not to explain.
const EXPLAIN_AFTER_MS = 600

// A name, a contact line, and sections of entries with bullets, roughly as
// the templates set them.
function layOut(): Bar[] {
  const bars: Bar[] = []
  const left = 42
  const right = PAGE.width - 42
  const centered = (y: number, w: number, h: number, strong = false) => bars.push({ x: (PAGE.width - w) / 2, y, w, h, strong })
  centered(38, 196, 16, true)
  centered(64, 330, 5)
  let y = 88
  const heading = (w: number) => {
    bars.push({ x: left, y, w, h: 8, strong: true }, { x: left, y: y + 12, w: right - left, h: 1, strong: true })
    y += 22
  }
  const entries = (...bullets: number[][]) => {
    for (const widths of bullets) {
      bars.push({ x: left + 4, y, w: 156, h: 6.5, strong: true }, { x: right - 78, y, w: 74, h: 5.5 })
      bars.push({ x: left + 4, y: y + 12, w: 120, h: 5.5 }, { x: right - 62, y: y + 12, w: 58, h: 5.5 })
      y += 27
      for (const w of widths) {
        bars.push({ x: left + 18, y, w, h: 5 })
        y += 11.5
      }
      y += 7
    }
    y += 6
  }
  heading(78)
  entries([388])
  heading(90)
  entries([470, 432, 456, 300], [446, 470, 392], [462, 410, 350])
  heading(68)
  entries([452, 404], [470, 380])
  heading(84)
  entries([440, 396])
  heading(52)
  for (const w of [430, 476, 360, 410]) {
    bars.push({ x: left + 4, y, w, h: 5 })
    y += 11.5
  }
  return bars
}

const percent = (value: number, of: number) => `${(value / of) * 100}%`

/** The page's grey lines, all printed, at any size: a resume not drawn yet, as on a dashboard card. */
export function PageSketch() {
  return BARS.map((bar, index) => (
    <span
      key={index}
      aria-hidden="true"
      className={`absolute rounded-[1px] ${bar.strong ? "bg-ink/20" : "bg-ink/10"}`}
      style={{
        left: percent(bar.x, PAGE.width),
        top: percent(bar.y, PAGE.height),
        width: percent(bar.w, PAGE.width),
        height: `max(1px, ${percent(bar.h, PAGE.height)})`,
      }}
    />
  ))
}

interface PrintingPageProps {
  width: number
  /** The preview has arrived: fade out, then the parent removes this. */
  leaving?: boolean
}

export default function PrintingPage({ width, leaving = false }: PrintingPageProps) {
  const status = useSyncExternalStore(onCompilerStatus, compilerStatus, compilerStatus)
  const [explain, setExplain] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setExplain(true), EXPLAIN_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  // While the compiler downloads, the lines follow it; otherwise all print at once, one after another.
  const following = !status.loaded && !leaving
  const printed = following ? Math.floor(status.downloaded * BARS.length) : BARS.length
  const next = BARS[printed]
  const head = next ? next.y - 4 : PAGE.height
  // Rounded down, so 100% means it has all arrived.
  const shown = Math.floor(status.downloaded * 100)

  return (
    <div
      role={leaving ? undefined : "status"}
      aria-label={leaving ? undefined : "Loading preview"}
      aria-hidden={leaving || undefined}
      className={`absolute inset-x-0 top-0 z-10 transition-opacity duration-300 ${leaving ? "opacity-0" : ""}`}
    >
      <div
        className="relative overflow-hidden bg-sheet shadow-[0_1px_2px_rgba(17,19,24,0.06),0_18px_40px_-16px_rgba(17,19,24,0.22)]"
        style={{ width, height: width * (PAGE.height / PAGE.width) }}
      >
        {BARS.map((bar, index) => (
          <span
            key={index}
            className={`absolute origin-left rounded-[1px] transition-transform duration-200 ease-out motion-reduce:transition-none ${
              bar.strong ? "bg-ink/20" : "bg-ink/10"
            } ${index < printed ? "scale-x-100" : "scale-x-0"}`}
            style={{
              left: percent(bar.x, PAGE.width),
              top: percent(bar.y, PAGE.height),
              width: percent(bar.w, PAGE.width),
              height: Math.max(1, bar.h * (width / PAGE.width)),
              transitionDelay: following ? undefined : `${index * 10}ms`,
            }}
          />
        ))}
        {/* The line rides at the top of a layer the page's size, which is moved
            rather than the line itself, so the browser needn't lay the page out
            again as it goes. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 motion-reduce:hidden ${following ? "transition-transform duration-200 ease-out" : "animate-print-sweep"}`}
          style={following ? { transform: `translateY(${percent(head, PAGE.height)})` } : { animationDelay: `${BARS.length * 10}ms` }}
        >
          <span className="absolute inset-x-[5%] top-0 h-px bg-accent/70 shadow-[0_0_10px_2px_rgba(46,91,230,0.25)]" />
        </span>
        {following && explain && (
          <div className="absolute inset-x-0 top-[38%] flex justify-center px-5">
            {/* The figure changes often, so it's given as a value rather than read out each time. */}
            <div
              role="progressbar"
              aria-label="Setting up the preview"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={shown}
              className="border border-rule bg-sheet px-4 py-3 text-center shadow-[0_12px_32px_-16px_rgba(17,19,24,0.35)]"
            >
              {/* Once the compiler is in, building it and the first preview are left. */}
              <p aria-hidden="true" className="label-mono text-ink">
                {shown < 100 ? `Setting up the preview · ${shown}%` : "Finishing up…"}
              </p>
              <p aria-hidden="true" className="mt-1 text-xs text-ink-2">
                It&apos;s quicker after the first time.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
