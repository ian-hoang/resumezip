"use client"

import { memo, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { DraggableProvided, DropResult } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"
import type { Headings } from "@/lib/resume"
import { extraHeading, extraKey, type ExtraKind, type ExtraSections, type SectionRef } from "@/lib/resumeSections"
import AddSectionMenu from "./AddSectionMenu"
import { loadDragAndDrop, type DragAndDrop } from "./dragAndDrop"
import { WIDE_SCREEN } from "./layout"
import { SECTION_NAMES, SECTIONS, type SectionName } from "./sections"

export type ActiveSection = "Profile" | SectionRef

interface SectionNavProps {
  sections: SectionRef[]
  /** The person's own section titles, by each section's `headingKey`. */
  headings?: Headings | null
  extras?: ExtraSections | null
  active: ActiveSection
  onSelect: (section: ActiveSection) => void
  onReorder: (sections: SectionRef[]) => void
  onAdd?: (kind: ExtraKind | SectionName) => void
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * The numbered sections: a list in the left bar on wide screens, a row of tabs on narrower ones.
 * Profile stays first; the rest can be dragged into any order.
 */
function SectionNav({ sections, headings, extras, active, onSelect, onReorder, onAdd }: SectionNavProps) {
  const navRef = useRef<HTMLElement>(null)
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_SCREEN).matches)
  const [dnd, setDnd] = useState<DragAndDrop | null>(null)
  // The sections at the last render, to tell one just added, which slides in.
  const seen = useRef<ReadonlySet<SectionRef> | null>(null)
  const added = new Set(seen.current ? sections.filter((ref) => !seen.current!.has(ref)) : [])
  useEffect(() => {
    seen.current = new Set(sections)
  }, [sections])

  // The drag and drop isn't in the page's first download, as it's only needed
  // once a section is dragged. It loads as soon as the editor opens; until
  // then, or for good if it fails to download, sections can be chosen but not
  // dragged.
  useEffect(() => {
    let live = true
    loadDragAndDrop().then(
      (module) => {
        if (!live) return
        // The draggable list's buttons are new elements, so a button with the
        // focus would lose it to the page.
        const buttons = () => [...(navRef.current?.querySelectorAll("button") ?? [])]
        const focused = buttons().findIndex((button) => button === document.activeElement)
        flushSync(() => setDnd(module))
        if (focused !== -1) buttons()[focused]?.focus()
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [])

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

  // A section's title as the person named it, or the editor's.
  const titles = new Map(
    sections.map((ref) => {
      const key = extraKey(ref)
      if (key !== null) return [ref, extras?.[key] ? extraHeading(extras[key]) : "New section"] as const
      const section = SECTIONS[ref as SectionName]
      return [ref, headings?.[section.headingKey] || section.title] as const
    }),
  )
  const counts = new Map<string, number>()
  for (const title of titles.values()) counts.set(title, (counts.get(title) ?? 0) + 1)
  const titleOf = (name: SectionRef) => titles.get(name)!
  // The optional sections that aren't on the resume, which Add section offers.
  const addable = SECTION_NAMES.filter((name) => SECTIONS[name].optional && !sections.includes(name))
  // Two sections can have the same title, so a screen reader also hears where each is.
  const labelOf = (name: SectionRef, index: number) =>
    (counts.get(titleOf(name)) ?? 0) > 1 ? `${titleOf(name)}, section ${index + 2}` : titleOf(name)

  const item = (isActive: boolean) =>
    `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-[4px] px-2 py-[9px] text-left text-sm transition-colors xl:w-full xl:shrink ${
      isActive ? "bg-sheet font-medium text-ink ring-1 ring-rule" : "text-ink-2 hover:text-ink"
    }`

  // A section, the same with or without dragging, so the list doesn't move as dragging loads.
  const renderSection = (name: SectionRef, index: number, drag?: DraggableProvided, dragging = false) => {
    const isActive = active === name
    return (
      <div
        key={name}
        ref={drag?.innerRef}
        {...drag?.draggableProps}
        className={`flex shrink-0 items-center rounded-[4px] transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none ${
          added.has(name) ? "starting:-translate-x-2 starting:opacity-0" : ""
        } ${dragging ? "bg-sheet shadow-sm ring-1 ring-rule" : ""}`}
      >
        <span
          {...drag?.dragHandleProps}
          aria-label={drag && `Reorder ${labelOf(name, index)}`}
          className="flex h-9 w-6 shrink-0 items-center justify-center text-ink-2 hover:text-ink"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <button
          type="button"
          onClick={() => onSelect(name)}
          className={`${item(isActive)} -ml-1`}
          aria-current={isActive || undefined}
          aria-label={`${pad(index + 2)} ${labelOf(name, index)}`}
          data-section-ref={name}
        >
          <span className={`font-mono text-[11px] ${isActive ? "text-accent" : ""}`}>{pad(index + 2)}</span>
          {titleOf(name)}
        </button>
      </div>
    )
  }

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] xl:flex-col xl:overflow-visible xl:p-0 [&::-webkit-scrollbar]:hidden"
    >
      <span className="label-mono hidden px-2 pb-3 text-ink-2 xl:block">Sections</span>

      <button
        type="button"
        data-section-ref="Profile"
        onClick={() => onSelect("Profile")}
        className={item(active === "Profile")}
        aria-current={active === "Profile" || undefined}
      >
        <span className="hidden w-3.5 xl:block" aria-hidden="true" />
        <span className={`font-mono text-[11px] ${active === "Profile" ? "text-accent" : ""}`}>01</span>
        Profile
      </button>

      {dnd ? (
        <dnd.DragDropContext onDragEnd={onDragEnd}>
          <dnd.Droppable droppableId="sections" direction={wide ? "vertical" : "horizontal"}>
            {(drop) => (
              <div ref={drop.innerRef} {...drop.droppableProps} className="flex gap-1 xl:flex-col">
                {sections.map((name, index) => (
                  <dnd.Draggable key={name} draggableId={name} index={index}>
                    {(drag, snapshot) => renderSection(name, index, drag, snapshot.isDragging)}
                  </dnd.Draggable>
                ))}
                {drop.placeholder}
              </div>
            )}
          </dnd.Droppable>
        </dnd.DragDropContext>
      ) : (
        <div className="flex gap-1 xl:flex-col">{sections.map((name, index) => renderSection(name, index))}</div>
      )}

      {onAdd && <AddSectionMenu sections={addable} onAdd={onAdd} />}

      <p className="mt-3 hidden border-t border-rule px-2 pt-5 text-[13px] leading-normal text-ink-2 xl:block">
        Drag a section to change its place on the page.
      </p>
    </nav>
  )
}

// Dragging is costly to render, so it re-renders only when its props change.
export default memo(SectionNav)
