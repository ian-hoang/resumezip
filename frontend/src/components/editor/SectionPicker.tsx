"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import type { Headings } from "@/lib/resume"
import { extraKey, sectionTitles, type ExtraSections, type SectionRef } from "@/lib/resumeSections"
import type { ActiveSection } from "./SectionNav"
import { swapView } from "./swapView"
import { EXTRA_ICONS, PROFILE_ICON, SECTION_ICONS } from "./sectionIcons"
import type { SectionName } from "./sections"

interface SectionPickerProps {
  sections: SectionRef[]
  headings?: Headings | null
  extras?: ExtraSections | null
  active: ActiveSection
  onSelect: (section: ActiveSection) => void
  /** The sections as a list (SectionNav, stacked), shown in the drawer. */
  children: React.ReactNode
}

// A round button on the sheet, a thumb's width.
const ROUND = "white-button inline-flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40 [&_svg]:size-[18px]"

/**
 * The sections on a narrower screen, where a row of them didn't fit: the open
 * one, where it is among them, and the way to the one before and after, in a
 * bar pinned over the form. The open one opens every section in a drawer from
 * the foot of the screen, to choose, reorder or add to. On wide screens the
 * sections are in the rail instead (SectionNav).
 *
 * The drawer is a modal <dialog>: it's in the browser's top layer, over the
 * switch at the foot and the menus, keeps Tab inside it and closes on Escape.
 */
export default function SectionPicker({ sections, headings, extras, active, onSelect, children }: SectionPickerProps) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const all: ActiveSection[] = ["Profile", ...sections]
  const index = Math.max(0, all.indexOf(active))
  const titles = sectionTitles(sections, headings, extras)
  const titleOf = (section: ActiveSection) => (section === "Profile" ? "Profile" : titles.get(section)!)
  const key = active === "Profile" ? null : extraKey(active)
  const Icon =
    active === "Profile" ? PROFILE_ICON : key === null ? SECTION_ICONS[active as SectionName] : EXTRA_ICONS[extras?.[key]?.kind ?? "text"]
  const before = all[index - 1]
  const after = all[index + 1]

  useEffect(() => {
    const box = dialog.current
    if (!box) return
    if (open && !box.open) box.showModal()
    if (!open && box.open) box.close()
  }, [open])
  // Choosing a section, or adding one, opens it: the drawer has done its work.
  useEffect(() => setOpen(false), [active])

  const go = (section: ActiveSection) => swapView(() => onSelect(section))

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 sm:px-3">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Sections: ${titleOf(active)}, ${index + 1} of ${all.length}`}
          onClick={() => setOpen(true)}
          className="flex h-11 min-w-0 items-center gap-2.5 rounded-full bg-[#f1f3f8] pl-3 pr-3.5 text-[15px] font-medium tracking-[-0.01em] text-ink"
        >
          <Icon className="h-[18px] w-[18px] shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 truncate">{titleOf(active)}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span aria-hidden="true" className="label-mono pr-1 text-ink-2">
            {index + 1} of {all.length}
          </span>
          <button
            type="button"
            disabled={!before}
            onClick={() => before && go(before)}
            aria-label={before ? `Previous section: ${titleOf(before)}` : "Previous section"}
            className={ROUND}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!after}
            onClick={() => after && go(after)}
            aria-label={after ? `Next section: ${titleOf(after)}` : "Next section"}
            className={ROUND}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="sections-drawer-title"
        onClose={() => setOpen(false)}
        // A tap on the softened page round it, which is the dialog's own backdrop, closes it.
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        className="dialog-sheet m-0 mt-auto border-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-b-none p-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop:bg-ink/15 backdrop:backdrop-blur-[3px] sm:mx-auto sm:max-w-[560px]"
      >
        {open && (
          <>
            <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between gap-4 pl-6 pr-3 pt-1">
              <h2 id="sections-drawer-title" className="label-mono text-ink-2">
                Sections
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center rounded-full px-3.5 text-sm text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                Done
              </button>
            </div>
            <div className="px-2 pb-2">{children}</div>
          </>
        )}
      </dialog>
    </>
  )
}
