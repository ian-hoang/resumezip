"use client"

import { useEffect, useRef, useState } from "react"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"
import { SECTIONS, type SectionName } from "./sections"

export type ActiveSection = "Profile" | SectionName

interface SectionNavProps {
  sections: SectionName[]
  active: ActiveSection
  onSelect: (section: ActiveSection) => void
  onReorder: (sections: SectionName[]) => void
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Wide enough for the sidebar; below this the sections are a row of tabs above the form. */
export const WIDE_SCREEN = "(min-width: 1024px)"

/**
 * The numbered sections: a list in the sidebar on wide screens, a row of tabs on small ones.
 * Profile stays first; the rest can be dragged into any order.
 */
export default function SectionNav({ sections, active, onSelect, onReorder }: SectionNavProps) {
  const navRef = useRef<HTMLElement>(null)
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_SCREEN).matches)

  useEffect(() => {
    const query = window.matchMedia(WIDE_SCREEN)
    const sync = () => setWide(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  // Keep the chosen tab in view in the row.
  useEffect(() => {
    const nav = navRef.current
    const tab = nav?.querySelector<HTMLElement>("[aria-current]")
    if (wide || !nav || !tab) return
    const box = (tab.parentElement === nav ? tab : tab.parentElement!).getBoundingClientRect()
    const view = nav.getBoundingClientRect()
    const by = box.left < view.left + 16 ? box.left - view.left - 16 : box.right > view.right - 16 ? box.right - view.right + 16 : 0
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (by) nav.scrollBy({ left: by, behavior: reduced ? "auto" : "smooth" })
  }, [active, wide])

  const onDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) return
    const next = [...sections]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onReorder(next)
  }

  const item = (isActive: boolean) =>
    `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-[4px] px-2 py-[9px] text-left text-sm transition-colors lg:w-full lg:shrink ${
      isActive ? "bg-sheet font-medium text-ink ring-1 ring-rule" : "text-ink-2 hover:text-ink"
    }`

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden"
    >
      <span className="label-mono hidden px-2 pb-3 text-ink-2 lg:block">Sections</span>

      <button type="button" onClick={() => onSelect("Profile")} className={item(active === "Profile")} aria-current={active === "Profile" || undefined}>
        <span className="hidden w-3.5 lg:block" aria-hidden="true" />
        <span className={`font-mono text-[11px] ${active === "Profile" ? "text-accent" : ""}`}>01</span>
        Profile
      </button>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sections" direction={wide ? "vertical" : "horizontal"}>
          {(drop) => (
            <div ref={drop.innerRef} {...drop.droppableProps} className="flex gap-1 lg:flex-col">
              {sections.map((name, index) => {
                const isActive = active === name
                return (
                  <Draggable key={name} draggableId={name} index={index}>
                    {(drag, snapshot) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={`flex shrink-0 items-center rounded-[4px] ${snapshot.isDragging ? "bg-sheet shadow-sm ring-1 ring-rule" : ""}`}
                      >
                        <span
                          {...drag.dragHandleProps}
                          aria-label={`Reorder ${SECTIONS[name].title}`}
                          className="flex h-9 w-6 shrink-0 items-center justify-center text-ink-2 hover:text-ink"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelect(name)}
                          className={`${item(isActive)} -ml-1`}
                          aria-current={isActive || undefined}
                        >
                          <span className={`font-mono text-[11px] ${isActive ? "text-accent" : ""}`}>{pad(index + 2)}</span>
                          {SECTIONS[name].title}
                        </button>
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {drop.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <p className="mt-3 hidden border-t border-rule px-2 pt-5 text-[13px] leading-normal text-ink-2 lg:block">
        Drag a section to change its place on the page.
      </p>
    </nav>
  )
}
