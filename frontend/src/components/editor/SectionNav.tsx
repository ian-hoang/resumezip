"use client"

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { DraggableProvided, DropResult } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"
import type { Headings } from "@/lib/resume"
import { loadDragAndDrop, type DragAndDrop } from "./dragAndDrop"
import { WIDE_SCREEN } from "./layout"
import { SECTIONS, type SectionName } from "./sections"

export type ActiveSection = "Profile" | SectionName

interface SectionNavProps {
  sections: SectionName[]
  /** The person's own section titles, by each section's `headingKey`. */
  headings?: Headings | null
  active: ActiveSection
  onSelect: (section: ActiveSection) => void
  onReorder: (sections: SectionName[]) => void
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * The numbered sections: a list in the left bar on wide screens, a row of tabs on narrower ones.
 * Profile stays first; the rest can be dragged into any order.
 */
function SectionNav({ sections, headings, active, onSelect, onReorder }: SectionNavProps) {
  const navRef = useRef<HTMLElement>(null)
  const tabRef = useRef<HTMLSpanElement>(null)
  // The section the white tab was last put behind, so choosing another slides it there.
  const tabAt = useRef<ActiveSection | null>(null)
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_SCREEN).matches)
  const [dnd, setDnd] = useState<DragAndDrop | null>(null)
  const [dragging, setDragging] = useState(false)

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

  // The white tab behind the chosen section slides from the last one. It's
  // put in place without sliding when the list itself changes: across
  // WIDE_SCREEN, shown again after the preview, or a section renamed or moved.
  useLayoutEffect(() => {
    const nav = navRef.current
    const tab = tabRef.current
    if (!nav || !tab) return
    const place = (slide: boolean) => {
      const chosen = nav.querySelector("button[aria-current]")
      if (!chosen) return
      const box = chosen.getBoundingClientRect()
      const frame = nav.getBoundingClientRect()
      // Measured from the list's own top left, which scrolls with it in the row of tabs.
      const left = box.left - frame.left - nav.clientLeft + nav.scrollLeft
      const top = box.top - frame.top - nav.clientTop + nav.scrollTop
      tab.style.transitionDuration = slide ? "" : "0s"
      tab.style.transform = `translate(${left}px, ${top}px)`
      tab.style.width = `${box.width}px`
      tab.style.height = `${box.height}px`
    }
    place(tabAt.current !== null && tabAt.current !== active)
    tabAt.current = active
    // The list and the chosen section can change size with nothing else
    // changing, as when the font loads. The observer also reports their sizes
    // as it starts, which isn't a change.
    const chosen = nav.querySelector<HTMLElement>("button[aria-current]")
    const sizes = () => `${nav.clientWidth}x${nav.clientHeight} ${chosen?.offsetWidth}x${chosen?.offsetHeight}`
    let size = sizes()
    const observer = new ResizeObserver(() => {
      if (sizes() !== size) place(false)
      size = sizes()
    })
    observer.observe(nav)
    if (chosen) observer.observe(chosen)
    return () => observer.disconnect()
  }, [active, sections, headings, wide, dnd, dragging])

  const onDragEnd = ({ source, destination }: DropResult) => {
    setDragging(false)
    if (!destination || destination.index === source.index) return
    const next = [...sections]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onReorder(next)
  }

  // A section's title as the person named it, or the editor's.
  const titleOf = (name: SectionName) => headings?.[SECTIONS[name].headingKey] || SECTIONS[name].title

  // The white tab is drawn behind the chosen section, except while one is
  // being dragged: then the sections move under it, so the chosen one has its own.
  const item = (isActive: boolean) =>
    `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-[4px] px-2 py-[9px] text-left text-sm transition-colors xl:w-full xl:shrink ${
      isActive ? `font-medium text-ink ${dragging ? "bg-sheet ring-1 ring-rule" : ""}` : "text-ink-2 hover:text-ink"
    }`

  // A section, the same with or without dragging, so the list doesn't move as dragging loads.
  const renderSection = (name: SectionName, index: number, drag?: DraggableProvided, isDragged = false) => {
    const isActive = active === name
    return (
      <div
        key={name}
        ref={drag?.innerRef}
        {...drag?.draggableProps}
        className={`flex shrink-0 items-center rounded-[4px] ${isDragged ? "bg-sheet shadow-sm ring-1 ring-rule" : ""}`}
      >
        <span
          {...drag?.dragHandleProps}
          aria-label={drag && `Reorder ${titleOf(name)}`}
          className="flex h-9 w-6 shrink-0 items-center justify-center text-ink-2 hover:text-ink"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <button type="button" onClick={() => onSelect(name)} className={`${item(isActive)} -ml-1`} aria-current={isActive || undefined}>
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
      className="relative isolate flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] xl:flex-col xl:overflow-visible xl:p-0 [&::-webkit-scrollbar]:hidden"
    >
      <span
        ref={tabRef}
        aria-hidden="true"
        className={`absolute left-0 top-0 -z-10 rounded-[4px] bg-sheet ring-1 ring-rule transition-[transform,width] duration-300 ease-glide motion-reduce:transition-none ${
          dragging ? "invisible" : ""
        }`}
      />
      <span className="label-mono hidden px-2 pb-3 text-ink-2 xl:block">Sections</span>

      <button
        type="button"
        onClick={() => onSelect("Profile")}
        className={item(active === "Profile")}
        aria-current={active === "Profile" || undefined}
      >
        <span className="hidden w-3.5 xl:block" aria-hidden="true" />
        <span className={`font-mono text-[11px] ${active === "Profile" ? "text-accent" : ""}`}>01</span>
        Profile
      </button>

      {dnd ? (
        <dnd.DragDropContext onDragStart={() => setDragging(true)} onDragEnd={onDragEnd}>
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

      <p className="mt-3 hidden border-t border-rule px-2 pt-5 text-[13px] leading-normal text-ink-2 xl:block">
        Drag a section to change its place on the page.
      </p>
    </nav>
  )
}

// Dragging is costly to render, so it re-renders only when its props change.
export default memo(SectionNav)
