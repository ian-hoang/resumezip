"use client"

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

/** The numbered list of sections. Profile stays first; the rest can be dragged into any order. */
export default function SectionNav({ sections, active, onSelect, onReorder }: SectionNavProps) {
  const onDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) return
    const next = [...sections]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onReorder(next)
  }

  const item = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded-[4px] px-2 py-[9px] text-left text-sm transition-colors ${
      isActive ? "bg-sheet font-medium text-ink ring-1 ring-rule" : "text-ink-2 hover:text-ink"
    }`

  return (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      <span className="label-mono px-2 pb-3 text-ink-2">Sections</span>

      <button type="button" onClick={() => onSelect("Profile")} className={item(active === "Profile")} aria-current={active === "Profile" || undefined}>
        <span className="w-3.5" aria-hidden="true" />
        <span className={`font-mono text-[11px] ${active === "Profile" ? "text-accent" : ""}`}>01</span>
        Profile
      </button>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sections">
          {(drop) => (
            <div ref={drop.innerRef} {...drop.droppableProps} className="flex flex-col gap-1">
              {sections.map((name, index) => {
                const isActive = active === name
                return (
                  <Draggable key={name} draggableId={name} index={index}>
                    {(drag, snapshot) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={`flex items-center rounded-[4px] ${snapshot.isDragging ? "bg-sheet shadow-sm ring-1 ring-rule" : ""}`}
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

      <p className="mt-3 border-t border-rule px-2 pt-5 text-[13px] leading-normal text-ink-2">
        Drag a section to change its place on the page.
      </p>
    </nav>
  )
}
