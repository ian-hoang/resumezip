"use client"

import type React from "react"
import { memo, useId, useRef } from "react"
import { hasEnoughToCheck } from "@/lib/check/labels"
import { useCheck, useCheckActions, type Mode } from "./CheckContext"
import CheckPanel from "./CheckPanel"
import { WIDE_SCREEN } from "./layout"

const MODES: { id: Mode; label: string }[] = [
  { id: "write", label: "Write" },
  { id: "check", label: "Check" },
]

interface LeftBarProps {
  /** Hidden while small screens show the preview. */
  hidden: boolean
  /** The section list, shown in Write mode. */
  children: React.ReactNode
}

/**
 * The editor's left bar: a Write | Check switch, then the section list or
 * what the checker found. Below WIDE_SCREEN it's a bar above the form, pinned
 * in Write mode so the section tabs stay at hand. On wide screens it's in the
 * stage's left panel, above the form, and scrolls on its own when the list is
 * longer than its share of the panel.
 */
function LeftBar({ hidden, children }: LeftBarProps) {
  const { report, mode } = useCheck()
  const { chooseMode } = useCheckActions()
  const id = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const bar = useRef<HTMLElement>(null)
  // Until there's a name and an entry, the panel asks for those instead of listing what's missing.
  const open = hasEnoughToCheck(report.view) ? report.findings.length : 0
  const chosen = MODES.findIndex((option) => option.id === mode)

  const choose = (next: Mode) => {
    chooseMode(next)
    // On small screens the bar stops being pinned in Check mode, so if the
    // page was scrolled down the form, go back up to show what was found.
    if (next === "check" && !window.matchMedia(WIDE_SCREEN).matches) {
      requestAnimationFrame(() => {
        const top = bar.current?.getBoundingClientRect().top ?? 0
        if (top < 0) window.scrollTo({ top: window.scrollY + top })
      })
    }
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
      ref={bar}
      data-covers="top"
      data-mode={mode}
      className={`shrink-0 border-b border-rule bg-paper xl:static xl:flex xl:min-h-[150px] xl:shrink xl:flex-col xl:overflow-hidden xl:border-b-0 xl:bg-transparent ${
        mode === "write" ? "sticky top-0 z-20" : ""
      } ${hidden ? "hidden" : ""}`}
    >
      <div
        role="tablist"
        aria-label="Write or check"
        className="relative isolate mx-3 mt-2 flex shrink-0 gap-1 rounded-[4px] bg-desk p-1 xl:mx-6 xl:mb-3 xl:mt-1 xl:rounded-[10px] xl:bg-ink/[0.06]"
      >
        {/* The white tab behind the chosen one, which slides across to the other. The tabs
            share the width inside the 4px padding, 4px apart (p-1, gap-1). */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 -z-10 rounded-[3px] bg-sheet ring-1 ring-rule transition-transform duration-300 ease-glide motion-reduce:transition-none xl:rounded-[7px] xl:shadow-[0_1px_3px_rgb(17_19_24/0.08)] xl:ring-ink/[0.06]"
          style={{
            width: `calc((100% - ${8 + 4 * (MODES.length - 1)}px) / ${MODES.length})`,
            transform: `translateX(calc(${chosen} * (100% + 4px)))`,
          }}
        />
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
              // The download card's Check it first puts the keyboard here.
              data-mode-tab={option.id}
              onClick={() => choose(option.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-[3px] text-sm font-medium transition-colors ${
                selected ? "text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {option.label}
              {count !== null && <span className="tabular-nums">· {count}</span>}
            </button>
          )
        })}
      </div>

      {/* On wide screens it scrolls in its share of the panel, fading at its foot as a sign
          there's more; the padding lets the last row clear the fade. */}
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${mode}`}
        className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:px-4 xl:pb-6 xl:[mask-image:linear-gradient(to_bottom,#000_calc(100%-20px),transparent)]"
      >
        {/* Switching fades the other one in (`starting:` is CSS @starting-style). */}
        <div key={mode} className="transition-opacity duration-200 ease-out motion-reduce:transition-none starting:opacity-0">
          {mode === "write" ? children : <CheckPanel />}
        </div>
      </div>
    </aside>
  )
}

// The editor passes the same children until the section list changes, so a new preview doesn't re-render the bar.
export default memo(LeftBar)
