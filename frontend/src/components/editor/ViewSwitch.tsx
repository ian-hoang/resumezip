"use client"

import { Eye, PencilLine, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { useCheckActions, useCheckMode, type Mode } from "./CheckContext"
import { useFixCount } from "./LeftBar"
import { swapView } from "./swapView"

/** What a narrower screen shows: the form, with a section, Check or Style above it, or the page. */
export type View = "edit" | "preview"

type Choice = Mode | "preview"

const CHOICES: { id: Choice; label: string; icon: LucideIcon }[] = [
  { id: "write", label: "Write", icon: PencilLine },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "check", label: "Check", icon: ShieldCheck },
  { id: "style", label: "Style", icon: SlidersHorizontal },
]

/**
 * Back up to the top of the left bar if it's scrolled off. It's only pinned in Write mode, so Check or Style,
 * chosen far down the form, would otherwise open out of sight.
 */
function toBarTop() {
  const top = document.querySelector("aside[data-covers=top]")?.getBoundingClientRect().top ?? 0
  if (top < 0) window.scrollTo({ top: window.scrollY + top })
}

interface ViewSwitchProps {
  view: View
  /** Shows the form or the page. `change` runs with the swap, as for choosing Check from the page; `then` once it's shown. */
  onView: (next: View, change?: () => void, then?: () => void) => void
  /** A touch screen's keyboard is up, so the switch steps aside, below the foot of the screen. */
  typing: boolean
}

/**
 * The one way round the editor on a narrower screen, at its foot, in thumb's reach: Write, Preview, Check and
 * Style. On wide screens the page is always beside the form, and Check and Style are in the rail (LeftBar.tsx).
 * Preview keeps Check or Style as it was, so coming back from the page to either finds it as it was left.
 */
export default function ViewSwitch({ view, onView, typing }: ViewSwitchProps) {
  const mode = useCheckMode()
  const { chooseMode } = useCheckActions()
  const fixes = useFixCount()
  const chosen: Choice = view === "preview" ? "preview" : mode

  const choose = (next: Choice) => {
    if (next === chosen) return
    if (next === "preview") return onView("preview")
    const then = next === "write" ? undefined : toBarTop
    if (view === "preview") return onView("edit", () => chooseMode(next), then)
    swapView(() => chooseMode(next), then)
  }

  return (
    <div
      data-covers="bottom"
      className={`fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-2 transition-transform duration-200 xl:hidden ${
        typing ? "pointer-events-none translate-y-24" : ""
      }`}
    >
      <div
        role="group"
        aria-label="View"
        className="flex w-full max-w-[400px] gap-1 rounded-full bg-sheet p-[5px] shadow-[0_0_0_1px_rgb(17_19_24/0.06),0_10px_28px_-8px_rgb(17_19_24/0.3)]"
      >
        {CHOICES.map((option) => {
          const selected = option.id === chosen
          const Icon = option.icon
          // The must-fixes, once Check has been opened on this visit, as the rail's ATS Checks shows them.
          const badge = option.id === "check" && fixes > 0
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(option.id)}
              className={`inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-1.5 text-[14px] font-medium tracking-[-0.01em] transition-colors ${
                selected ? "bg-ink text-white" : "text-ink-3 hover:text-ink"
              }`}
            >
              <span className="relative flex shrink-0">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {badge && (
                  <span
                    aria-hidden="true"
                    className={`absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-semibold tabular-nums leading-none text-white ring-2 ${
                      selected ? "ring-ink" : "ring-sheet"
                    }`}
                  >
                    {fixes}
                  </span>
                )}
              </span>
              {option.label}
              {badge && <span className="sr-only">, {fixes} to fix</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
