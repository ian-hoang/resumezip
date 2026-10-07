"use client"

import type React from "react"
import { useId, useRef, useState } from "react"
import { getStorage } from "@/lib/resumeStorage"
import CheckPanel from "./CheckPanel"
import { useResumeCheck } from "./useResumeCheck"

/** What the left bar shows: the sections to write in, or what the checker found. */
export type Mode = "write" | "check"

const MODES: { id: Mode; label: string }[] = [
  { id: "write", label: "Write" },
  { id: "check", label: "Check" },
]

// The last mode is remembered in this browser, for every resume.
const MODE_KEY = "editor-mode"

function savedMode(): Mode {
  try {
    return getStorage()?.getItem(MODE_KEY) === "check" ? "check" : "write"
  } catch {
    return "write"
  }
}

function saveMode(mode: Mode) {
  try {
    getStorage()?.setItem(MODE_KEY, mode)
  } catch {
    // Only a convenience: the editor opens in Write mode next time.
  }
}

interface LeftBarProps {
  /** Hidden while small screens show the preview. */
  hidden: boolean
  /** The section list, shown in Write mode. */
  children: React.ReactNode
}

/**
 * The editor's left bar: a Write | Check switch, then the section list or
 * what the checker found. On small screens it's a bar above the form, pinned
 * in Write mode so the section tabs stay at hand.
 */
export default function LeftBar({ hidden, children }: LeftBarProps) {
  const [mode, setMode] = useState<Mode>(savedMode)
  const { report } = useResumeCheck()
  const id = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const open = report.findings.length

  const choose = (next: Mode) => {
    setMode(next)
    saveMode(next)
  }

  // Arrow keys, Home and End move between the two (WAI-ARIA tabs pattern).
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = MODES.length - 1
    const targets: Record<string, number> = {
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowRight: index === last ? 0 : index + 1,
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    choose(MODES[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <aside
      data-covers="top"
      className={`shrink-0 border-b border-rule bg-paper lg:static lg:block lg:w-[248px] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-4 lg:py-7 ${
        mode === "write" ? "sticky top-0 z-20" : ""
      } ${hidden ? "hidden" : ""}`}
    >
      <div role="tablist" aria-label="Write or check" className="mx-3 mt-2 flex gap-1 rounded-[4px] bg-desk p-1 lg:mx-0 lg:mb-6 lg:mt-0">
        {MODES.map((option, index) => {
          const selected = option.id === mode
          // "Check · 3": how much the checker found that isn't dismissed.
          const count = option.id === "check" && open > 0 ? open : null
          return (
            <button
              key={option.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${id}-${option.id}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              aria-label={count === null ? undefined : `${option.label}, ${count} to look at`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(option.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-[3px] text-sm font-medium transition-colors ${
                selected ? "bg-sheet text-ink ring-1 ring-rule" : "text-ink-2 hover:text-ink"
              }`}
            >
              {option.label}
              {count !== null && <span className="tabular-nums">· {count}</span>}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}`}>
        {mode === "write" ? children : <CheckPanel report={report} />}
      </div>
    </aside>
  )
}
