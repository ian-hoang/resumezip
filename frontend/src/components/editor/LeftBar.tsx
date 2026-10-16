"use client"

import type React from "react"
import { memo, useRef } from "react"
import { PenLine, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { SEGMENT, SEGMENTS } from "@/components/pills"
import { useThumb } from "@/components/useThumb"
import { useCheckActions, useCheckMode, type Mode } from "./CheckContext"
import CheckPanel from "./CheckPanel"
import { WIDE_SCREEN } from "./layout"

const MODES: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: "write", label: "Write", icon: PenLine },
  { id: "check", label: "Check", icon: ShieldCheck },
  { id: "style", label: "Style", icon: SlidersHorizontal },
]

// The tabs and the panel they show, by these ids: the tabs are in the top bar
// on wide screens and at the top of the left bar on narrower ones, but only
// ever in one of them.
const tabId = (mode: Mode) => `editor-mode-${mode}`
const PANEL_ID = "editor-mode-panel"

/**
 * The Write | Check | Style switch: a grey track with the chosen one on a
 * white pill. On wide screens it's in the middle of the top bar; narrower,
 * it's at the top of the left bar, and on a phone its tabs share the width.
 */
export function ModeTabs({ stretch = false }: { stretch?: boolean }) {
  const mode = useCheckMode()
  const { chooseMode } = useCheckActions()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const thumb = useThumb(mode)

  const choose = (next: Mode) => {
    chooseMode(next)
    // On small screens the bar is only pinned in Write mode, so if the page
    // was scrolled down the form, go back up to show what Check or Style has.
    // It stops at the top, where the pinned bar sits.
    if (next !== "write" && !window.matchMedia(WIDE_SCREEN).matches) {
      requestAnimationFrame(() => {
        const top = document.getElementById(PANEL_ID)?.closest("aside")?.getBoundingClientRect().top ?? 0
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
    <div
      ref={thumb.group}
      role="tablist"
      aria-label="Write, check or style"
      className={`${SEGMENTS} ${stretch ? "flex w-full sm:inline-flex sm:w-auto" : ""}`}
    >
      <span ref={thumb.thumb} aria-hidden="true" className={`segment-thumb ${thumb.placed ? "" : "invisible"}`} />
      {MODES.map((option, index) => {
        const selected = option.id === mode
        const Icon = option.icon
        return (
          <button
            key={option.id}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            role="tab"
            id={tabId(option.id)}
            aria-selected={selected}
            aria-controls={PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            // No ring on keyboard focus: arrows choose the tab as they move, so the white pill shows where focus is.
            // Until the pill is placed, the chosen tab draws its own.
            className={`${SEGMENT} px-4 ${stretch ? "min-w-0 flex-1 max-sm:px-2 sm:flex-none" : ""} ${selected ? "text-ink" : "text-ink-3 hover:text-ink"} ${
              selected && !thumb.placed ? "bg-sheet shadow-[0_1px_3px_rgb(17_19_24/0.14)]" : ""
            }`}
          >
            <Icon aria-hidden="true" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface LeftBarProps {
  /** Hidden while small screens show the preview. */
  hidden: boolean
  /** Whether the Write | Check | Style tabs are here, as on narrower screens; on wide ones they're in the top bar. */
  tabs: boolean
  /** The section list, shown in Write mode. */
  children: React.ReactNode
  /** Fine-tune, shown in Style mode. */
  style: React.ReactNode
}

/**
 * The editor's left part: the section list, what the checker found, or
 * Fine-tune. On wide screens it's the left column of the sheet and scrolls on
 * its own. Narrower, it's a bar above the form with the Write | Check | Style
 * tabs, pinned in Write mode so the section tabs stay at hand; in Style mode
 * it takes the form's place (styles/editor.css).
 */
function LeftBar({ hidden, tabs, children, style }: LeftBarProps) {
  const mode = useCheckMode()

  return (
    <aside
      data-covers="top"
      data-mode={mode}
      className={`shrink-0 border-b border-hairline bg-sheet xl:flex xl:w-[270px] xl:flex-col xl:overflow-hidden xl:rounded-bl-[28px] xl:border-b-0 xl:border-r xl:bg-transparent ${
        mode === "write" ? "max-xl:sticky max-xl:top-0 max-xl:z-20" : ""
      } ${hidden ? "hidden" : ""}`}
    >
      {tabs && (
        <div className="px-3 pt-3 sm:px-4">
          <ModeTabs stretch />
        </div>
      )}
      {/* On wide screens it scrolls inside the column, fading at its foot as a sign there's
          more; the padding lets the last row clear the fade. */}
      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(mode)}
        className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:px-4 xl:pb-8 xl:pt-6 xl:[mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]"
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
