"use client"

import type React from "react"
import { memo, useRef } from "react"
import {
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  ScanEye,
  ShieldCheck,
  SlidersHorizontal,
  Type,
  type LucideIcon,
} from "lucide-react"
import { SLIM_SEGMENT, SLIM_SEGMENTS } from "@/components/pills"
import { useThumb } from "@/components/useThumb"
import { useCheckActions, useCheckIfOpened, useCheckMode, type Mode } from "./CheckContext"
import CheckPanel from "./CheckPanel"
import { WIDE_SCREEN } from "./layout"
import { useMarks, type Shown } from "./MarksContext"
import { useRailTip } from "./RailTip"
import { swapView } from "./swapView"

const MODES: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: "write", label: "Write", icon: PenLine },
  { id: "check", label: "Check", icon: ShieldCheck },
  { id: "style", label: "Style", icon: SlidersHorizontal },
]

// The tabs and the panel they show, by these ids: the tabs are in the rail on
// wide screens and at the top of the left bar on narrower ones, but only ever
// in one of them.
const tabId = (mode: Mode) => `editor-mode-${mode}`
const PANEL_ID = "editor-mode-panel"

/** The tab an arrow key, Home or End moves to from tab `index` (WAI-ARIA tabs pattern); either arrow along each way. */
function tabFrom(key: string, index: number): number | undefined {
  const last = MODES.length - 1
  const back = index === 0 ? last : index - 1
  const on = index === last ? 0 : index + 1
  return { ArrowLeft: back, ArrowUp: back, ArrowRight: on, ArrowDown: on, Home: 0, End: last }[key]
}

/**
 * The Write | Check | Style switch on narrower screens: a grey track with the
 * chosen one on a white pill, at the top of the left bar; on a phone its tabs
 * share the width. On wide screens they're in the rail (RailTabs).
 */
export function ModeTabs({ stretch = false }: { stretch?: boolean }) {
  const mode = useCheckMode()
  const { chooseMode } = useCheckActions()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const thumb = useThumb(mode)

  const choose = (next: Mode) =>
    swapView(
      () => chooseMode(next),
      () => {
        // On small screens the bar is only pinned in Write mode, so if the page
        // was scrolled down the form, go back up to show what Check or Style has.
        // It stops at the top, where the pinned bar sits.
        if (next === "write" || window.matchMedia(WIDE_SCREEN).matches) return
        const top = document.getElementById(PANEL_ID)?.closest("aside")?.getBoundingClientRect().top ?? 0
        if (top < 0) window.scrollTo({ top: window.scrollY + top })
      },
    )

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = tabFrom(event.key, index)
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
      className={`${SLIM_SEGMENTS} ${stretch ? "flex w-full sm:inline-flex sm:w-auto" : ""}`}
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
            className={`${SLIM_SEGMENT} px-3.5 ${stretch ? "min-w-0 flex-1 max-sm:px-2 sm:flex-none" : ""} ${selected ? "text-ink" : "text-ink-3 hover:text-ink"} ${
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

// A button in the rail: a 40px square of icon, shaded while pointed at, as the sections are (SectionNav).
const RAIL_BUTTON =
  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-colors focus-visible:outline-none focus-visible:bg-ink/[0.05] [&_svg]:size-[18px]"

// The rail's tabs on wide screens, where Check's two lists each have one: the ATS checks and the AI's notes.
type RailTab = "write" | Shown | "style"
// Writing has no tab of its own: the rail's sections are the form, and choosing the open tab again closes it.
const RAIL_TABS: { id: Exclude<RailTab, "write">; label: string; icon: LucideIcon }[] = [
  { id: "checks", label: "ATS Checks", icon: ListChecks },
  { id: "ai", label: "AI Reviews", icon: ScanEye },
  { id: "style", label: "Style", icon: Type },
]
const railTabId = (tab: RailTab) => `editor-rail-${tab}`

/** The rail tab that's chosen: the mode, and in Check, which of its lists. */
function useRailTab(): RailTab {
  const mode = useCheckMode()
  const { shown } = useMarks()
  return mode === "check" ? shown : mode
}

/**
 * The ATS Checks, AI Reviews and Style in the rail on wide screens: its icons,
 * one above the other, with the name in a tip. Each takes the form's place;
 * choosing it again goes back to writing, as choosing a section does. While
 * writing none is chosen, and the first takes the Tab key.
 */
function RailTabs({ unfold }: { unfold?: () => void }) {
  const tab = useRailTab()
  const { chooseMode } = useCheckActions()
  const { show } = useMarks()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { tipProps, tip } = useRailTip()
  const fixes = useFixCount()

  const choose = (next: RailTab) =>
    swapView(() => {
      if (next === "checks" || next === "ai") show(next)
      chooseMode(next === "checks" || next === "ai" ? "check" : next)
      unfold?.()
    })

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = RAIL_TABS.length - 1
    const next = { ArrowUp: index === 0 ? last : index - 1, ArrowDown: index === last ? 0 : index + 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    choose(RAIL_TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label="Check or style" aria-orientation="vertical" className="flex flex-col gap-1">
      {RAIL_TABS.map((option, index) => {
        const selected = option.id === tab
        const Icon = option.icon
        const badge = option.id === "checks" && fixes > 0
        return (
          <button
            key={option.id}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            role="tab"
            id={railTabId(option.id)}
            aria-selected={selected}
            aria-controls={PANEL_ID}
            tabIndex={selected || (tab === "write" && index === 0) ? 0 : -1}
            onClick={() => choose(selected ? "write" : option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            {...tipProps(badge ? `${option.label} · ${fixes} to fix` : option.label, 0, option.id)}
            className={`${RAIL_BUTTON} ${selected ? "glass glass-lit text-accent" : "text-[#8b9099] hover:bg-[#f6f7f9] hover:text-ink-2"}`}
          >
            <Icon aria-hidden="true" />
            <span className="sr-only">{option.label}</span>
            {/* How many must-fix findings there are, once Check has been opened on this visit: the checker only runs from then on. */}
            {badge && (
              <span
                aria-hidden="true"
                className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-semibold tabular-nums leading-none text-white"
              >
                {fixes}
              </span>
            )}
          </button>
        )
      })}
      {tip()}
    </div>
  )
}

/** How many of the checker's findings must be fixed; 0 until Check has been opened, as nothing's checked before. */
function useFixCount(): number {
  const check = useCheckIfOpened()
  return check?.report.findings.filter((finding) => finding.level === "fix").length ?? 0
}

/** Hides the form, or brings it back, from the top of the rail. Choosing a section brings it back too. */
function FoldButton({ folded, onFold }: { folded: boolean; onFold: () => void }) {
  const { tipProps, tip } = useRailTip()
  const label = folded ? "Show the form" : "Hide the form"
  const Icon = folded ? PanelLeftOpen : PanelLeftClose
  return (
    <>
      <button
        type="button"
        onClick={onFold}
        aria-expanded={!folded}
        aria-controls="editor-form"
        aria-label={label}
        {...tipProps(label, 0, "fold")}
        className={`${RAIL_BUTTON} text-[#8b9099] hover:bg-[#f6f7f9] hover:text-ink-2`}
      >
        <Icon aria-hidden="true" />
      </button>
      {tip()}
    </>
  )
}

const RAIL_RULE = "my-2 h-px w-6 shrink-0 bg-hairline"

interface LeftBarProps {
  /** Hidden while small screens show the preview. */
  hidden: boolean
  /** Whether the Write | Check | Style tabs are here, as on narrower screens; on wide ones they're in the rail. */
  tabs: boolean
  /** Whether the form is folded away, on wide screens, or on its way. */
  folded: boolean
  /** Whether it has slid shut, and is out of the layout. */
  shut: boolean
  onFold: () => void
  /** The section list: in the rail on wide screens, and in Write mode narrower. */
  children: React.ReactNode
  /** Fine-tune, shown in Style mode. */
  style: React.ReactNode
}

/**
 * The editor's left part. On wide screens it's a rail of icons down the left of
 * the sheet: hide or show the form, then the ATS Checks, AI Reviews and
 * Style, each opening its panel beside it, in the form's place (styles/editor.css
 * hides the form), and hidden with it, then the sections. Narrower, it's a bar
 * above the form with the Write | Check | Style tabs and the section list,
 * what the checker found, or Fine-tune, pinned in Write mode so the section
 * tabs stay at hand; in Style mode it takes the form's place (styles/editor.css).
 */
function LeftBar({ hidden, tabs, folded, shut, onFold, children, style }: LeftBarProps) {
  const mode = useCheckMode()
  const wide = !tabs
  const railTab = useRailTab()
  const { shown: notes } = useMarks()
  // Check has been opened on this visit, so there's a report for its panel.
  const checked = useCheckIfOpened() !== null
  const panel = { role: "tabpanel", id: PANEL_ID, "aria-labelledby": wide ? railTabId(railTab) : tabId(mode) }
  // Switching fades the other one in (`starting:` is CSS @starting-style).
  const fadeIn = "transition-opacity duration-200 ease-out motion-reduce:transition-none starting:opacity-0"
  // On wide screens each part scrolls inside the column, fading at its foot as a sign there's more; the padding lets
  // the last row clear the fade. Positioned, so the findings' screen-reader text (absolute) stays in it rather than
  // stretching the window below.
  const scrolls = "relative min-h-0 flex-1 overflow-y-auto pb-8 [mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]"

  if (wide)
    return (
      <aside
        data-covers="top"
        data-mode={mode}
        className={`flex shrink-0 overflow-clip rounded-bl-[28px] border-r border-hairline ${hidden ? "hidden" : ""}`}
      >
        <div className="flex w-16 shrink-0 flex-col items-center pt-4">
          <FoldButton folded={folded} onFold={() => onFold()} />
          <span aria-hidden="true" className={RAIL_RULE} />
          <RailTabs unfold={folded ? onFold : undefined} />
          <span aria-hidden="true" className={RAIL_RULE} />
          <div className={`${scrolls} flex w-full justify-center`}>{children}</div>
        </div>
        {/* Once Check has been opened, its panel stays while the form's back, hidden, so going back to it,
            as from a finding being fixed, finds it as it was left: the same note open, scrolled as far, the
            score as it was. */}
        {(mode !== "write" || checked) && (
          // The column the form folds away from (data-column), as the form's.
          <div data-column hidden={mode === "write" || shut} className="flex shrink-0 flex-col overflow-clip border-l border-hairline">
            <div {...(mode !== "write" ? panel : {})} className={`${scrolls} w-[clamp(440px,36vw,520px)] px-8 pt-6`}>
              <div key={mode === "style" ? "style" : notes} className={fadeIn}>
                {/* The rail names it only in a tip, so it has a title, as each section has. */}
                {railTab !== "write" && (
                  <h2 className="mb-5 font-serif text-[34px] leading-[1.1] tracking-[-0.03em] text-ink">
                    {RAIL_TABS.find((tab) => tab.id === railTab)!.label}
                  </h2>
                )}
                {mode === "style" ? style : <CheckPanel />}
              </div>
            </div>
          </div>
        )}
      </aside>
    )

  return (
    <aside
      data-covers="top"
      data-mode={mode}
      className={`shrink-0 border-b border-hairline bg-sheet ${mode === "write" ? "sticky top-0 z-20" : ""} ${hidden ? "hidden" : ""}`}
    >
      <div className="px-3 pt-3 sm:px-4">
        <ModeTabs stretch />
      </div>
      <div {...panel}>
        <div key={mode} className={fadeIn}>
          {mode === "write" ? children : mode === "check" ? <CheckPanel /> : style}
        </div>
      </div>
    </aside>
  )
}

// The editor passes the same children and style until the section list changes, so a new preview doesn't re-render the bar.
export default memo(LeftBar)
