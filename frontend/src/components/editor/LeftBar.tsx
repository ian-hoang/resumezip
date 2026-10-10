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
  { id: "style", label: "Style" },
]

interface LeftBarProps {
  /** Hidden while small screens show the preview. */
  hidden: boolean
  /** The section list, shown in Write mode. */
  children: React.ReactNode
  /** The templates and Fine-tune, shown in Style mode. */
  style: React.ReactNode
}

/**
 * The editor's left part: a Write | Check | Style switch, then the section
 * list, what the checker found, or the templates and Fine-tune. On wide
 * screens it's the left of the three panels and scrolls on its own. Narrower,
 * it's a panel above the form, pinned in Write mode so the section tabs stay
 * at hand; in Style mode it takes the form's place (styles/editor.css).
 */
function LeftBar({ hidden, children, style }: LeftBarProps) {
  const { report, mode, pdf } = useCheck()
  const { chooseMode } = useCheckActions()
  const id = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const bar = useRef<HTMLElement>(null)
  // Until there's a name and an entry, the panel asks for those instead of listing what's missing.
  const found = hasEnoughToCheck(report.view) ? report.findings.length : 0
  // While a new preview is read for the PDF rules, as after switching
  // templates, only the form's rules have run, and the count would jump to
  // theirs and back. It stays at the last full count until the reading is in.
  const [settled, setSettled] = useState<number | null>(null)
  if (pdf !== "reading" && settled !== found) setSettled(found)
  const open = pdf === "reading" && settled !== null ? settled : found
  const chosen = MODES.findIndex((option) => option.id === mode)

  const choose = (next: Mode) => {
    chooseMode(next)
    // On small screens the bar is only pinned in Write mode, so if the page
    // was scrolled down the form, go back up to show what Check or Style has.
    // It stops 12px short of the top, where the pinned bar sits (top-3).
    if (next !== "write" && !window.matchMedia(WIDE_SCREEN).matches) {
      requestAnimationFrame(() => {
        const top = (bar.current?.getBoundingClientRect().top ?? 0) - 12
        if (top < 0) window.scrollTo({ top: window.scrollY + top })
      })
    }
  }

  // Arrow keys, Home and End move between the tabs (WAI-ARIA tabs pattern).
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
      className={`glass glass-frost mx-3 mt-3 shrink-0 rounded-panel xl:m-0 xl:flex xl:w-[280px] xl:flex-col xl:overflow-hidden min-[90rem]:w-[288px] ${
        mode === "write" ? "max-xl:sticky max-xl:top-3 max-xl:z-20" : ""
      } ${hidden ? "hidden" : ""}`}
    >
      <div
        role="tablist"
        aria-label="Write, check or style"
        className="relative isolate mx-2 mt-2 flex shrink-0 gap-1 rounded-full bg-ink/[0.06] p-1 sm:max-w-[420px] xl:mx-3 xl:mt-3 xl:max-w-none"
      >
        {/* The white pill behind the chosen tab, which slides across to another. The tabs
            share the width inside the 4px padding, 4px apart (p-1, gap-1). */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 -z-10 rounded-full bg-sheet shadow-[0_1px_3px_rgb(17_19_24/0.1)] ring-1 ring-ink/[0.06] transition-transform duration-300 ease-glide motion-reduce:transition-none"
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
              className={`inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full text-sm font-medium transition-colors ${
                selected ? "text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {option.label}
              {count !== null && <span className="tabular-nums">· {count}</span>}
            </button>
          )
        })}
      </div>

      {/* On wide screens it scrolls inside the panel, fading at its foot as a sign there's
          more; the padding lets the last row clear the fade. */}
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${mode}`}
        className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:px-3 xl:pb-8 xl:pt-5 xl:[mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]"
      >
        {/* Switching fades the other one in (`starting:` is CSS @starting-style). */}
        <div key={mode} className="transition-opacity duration-200 ease-out motion-reduce:transition-none starting:opacity-0">
          {mode === "write" ? children : mode === "check" ? <CheckPanel /> : style}
        </div>
      </div>
    </aside>
  )
}

// The editor passes the same children and style until the section list or the template changes, so a new preview doesn't re-render the bar.
export default memo(LeftBar)
