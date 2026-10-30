"use client"

import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { DraggableProvided, DropResult } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"
import { useOpenResume, useResumeState } from "@/context/ResumeContext"
import { useCheckActions, useCheckMode } from "./CheckContext"
import type { Headings } from "@/lib/resume"
import { extraKey, sectionTitles, type ExtraKind, type ExtraSections, type SectionRef } from "@/lib/resumeSections"
import { resumeOf } from "@/lib/resumeStore"
import AddSectionMenu from "./AddSectionMenu"
import { loadDragAndDrop, type DragAndDrop } from "./dragAndDrop"
import { reducedMotion, useWideScreen } from "./layout"
import { useRailTip } from "./RailTip"
import { swapView } from "./swapView"
import { EXTRA_ICONS, PROFILE_ICON, SECTION_ICONS } from "./sectionIcons"
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
  onAdd: (kind: ExtraKind | SectionName) => void
}

/**
 * The sections, each with its icon: a rail of icons in the left column on wide screens, each
 * section's name and how many entries it has in a tip beside it, and a row of pill tabs on
 * narrower ones. Profile stays first; the rest can be dragged into any order by their icons.
 */
export default function SectionNav({ sections, headings, extras, active: open, onSelect, onReorder, onAdd }: SectionNavProps) {
  const navRef = useRef<HTMLElement>(null)
  const tabRef = useRef<HTMLSpanElement>(null)
  // The section the white tab was last put behind, so choosing another slides it there.
  const tabAt = useRef<ActiveSection | null>(null)
  const wide = useWideScreen()
  const mode = useCheckMode()
  // On wide screens the ATS checks, AI review and Style take the form's place, so no section shows as chosen in the
  // rail while they're open.
  const active: ActiveSection | null = wide && mode !== "write" ? null : open
  const [dnd, setDnd] = useState<DragAndDrop | null>(null)
  const [dragging, setDragging] = useState(false)
  const entries = useEntryCounts()
  const { tipProps, tip } = useRailTip(wide)
  const { chooseMode } = useCheckActions()
  // On wide screens the rail stays beside Check and Style, and choosing a section from it goes back to writing.
  const choose = (section: ActiveSection) =>
    swapView(() => {
      if (wide) chooseMode("write")
      onSelect(section)
    })
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

  // Keep the chosen tab in view in the row.
  useEffect(() => {
    const nav = navRef.current
    const tab = nav?.querySelector<HTMLElement>("[aria-current]")
    if (wide || !nav || !tab) return
    const box = (tab.parentElement === nav ? tab : tab.parentElement!).getBoundingClientRect()
    const view = nav.getBoundingClientRect()
    const by = box.left < view.left + 16 ? box.left - view.left - 16 : box.right > view.right - 16 ? box.right - view.right + 16 : 0
    if (by) nav.scrollBy({ left: by, behavior: reducedMotion() ? "auto" : "smooth" })
  }, [active, wide])

  const onDragEnd = ({ source, destination }: DropResult) => {
    setDragging(false)
    if (!destination || destination.index === source.index) return
    const next = [...sections]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onReorder(next)
  }

  const titles = sectionTitles(sections, headings, extras)
  const counts = new Map<string, number>()
  for (const title of titles.values()) counts.set(title, (counts.get(title) ?? 0) + 1)
  const titleOf = (name: SectionRef) => titles.get(name)!
  // The sections that aren't on the resume, which Add section offers.
  const addable = SECTION_NAMES.filter((name) => !sections.includes(name))
  // Two sections can have the same title, so a screen reader also hears where each is.
  const labelOf = (name: SectionRef, index: number) =>
    (counts.get(titleOf(name)) ?? 0) > 1 ? `${titleOf(name)}, section ${index + 2}` : titleOf(name)
  // Changes when a section is renamed, which changes its width in the row of tabs.
  const allTitles = [...titles.values()].join("\n")

  // The white tab behind the chosen section slides from the last one. It's
  // behind its whole row, handle and all, as it is behind Profile, which has
  // no handle. It's put in place without sliding when the list itself
  // changes: across WIDE_SCREEN, shown again after the preview, or a section
  // added, renamed or moved. It's measured from where the sections are laid
  // out, not where they're drawn, so one sliding in as it's added doesn't
  // throw it off.
  useLayoutEffect(() => {
    const nav = navRef.current
    const tab = tabRef.current
    if (!nav || !tab) return
    const rowOf = (button: HTMLElement | null) => button?.closest<HTMLElement>("[data-section-row]") ?? button
    const place = (slide: boolean) => {
      const chosen = rowOf(nav.querySelector<HTMLElement>("button[aria-current]"))
      if (!chosen) return
      let left = 0
      let top = 0
      for (let box: Element | null = chosen; box instanceof HTMLElement && box !== nav; box = box.offsetParent) {
        left += box.offsetLeft
        top += box.offsetTop
      }
      tab.style.transitionDuration = slide ? "" : "0s"
      tab.style.transform = `translate(${left}px, ${top}px)`
      tab.style.width = `${chosen.offsetWidth}px`
      tab.style.height = `${chosen.offsetHeight}px`
    }
    place(tabAt.current !== null && tabAt.current !== active)
    tabAt.current = active
    // The list and the chosen section can change size with nothing else
    // changing, as when the font loads. The observer also reports their sizes
    // as it starts, which isn't a change.
    const chosen = rowOf(nav.querySelector<HTMLElement>("button[aria-current]"))
    const sizes = () => `${nav.clientWidth}x${nav.clientHeight} ${chosen?.offsetWidth}x${chosen?.offsetHeight}`
    let size = sizes()
    const observer = new ResizeObserver(() => {
      if (sizes() !== size) place(false)
      size = sizes()
    })
    observer.observe(nav)
    if (chosen) observer.observe(chosen)
    return () => observer.disconnect()
  }, [active, sections, allTitles, wide, dnd, dragging])

  // Keyboard focus shows as a soft shade and dark text rather than the site's blue ring, which would box the row in.
  // The chosen section has the grey tab behind it already, so a shade there would draw a second one inside it.
  const item = (isActive: boolean) =>
    `flex h-9 w-full min-w-0 shrink-0 items-center gap-3 whitespace-nowrap rounded-full pl-9 pr-3.5 text-left text-[15px] tracking-[-0.01em] transition-colors focus-visible:outline-none xl:h-10 xl:rounded-[12px] xl:p-0 ${
      isActive ? "font-medium text-ink" : "text-[#3a3e46] hover:text-ink focus-visible:bg-ink/[0.05] focus-visible:text-ink"
    }`
  // A row's own background: the grey tab is drawn behind the chosen one,
  // except while a section is dragged, when the rows move under it and the
  // chosen one has its own. Another is shaded while pointed at.
  const rowBackground = (isActive: boolean) => (isActive ? (dragging ? "bg-[#f1f3f8]" : "") : "hover:bg-[#f6f7f9]")
  // The section's icon. In the row of tabs it turns into a grip while the row is pointed at or its handle has the keyboard.
  const iconClass = (isActive: boolean) =>
    `h-[18px] w-[18px] transition-colors ${isActive ? "text-accent" : "text-[#8b9099] group-hover/row:text-ink-2"}`

  // A section, the same with or without dragging, so the list doesn't move as dragging loads.
  const renderSection = (name: SectionRef, index: number, drag?: DraggableProvided, isDragged = false) => {
    const isActive = active === name
    const key = extraKey(name)
    // Added sections have no entries to count.
    const count = key === null ? entries[name as SectionName] : 0
    const Icon = key === null ? SECTION_ICONS[name as SectionName] : EXTRA_ICONS[extras?.[key]?.kind ?? "text"]
    return (
      <div
        key={name}
        ref={drag?.innerRef}
        {...drag?.draggableProps}
        data-section-row
        {...tipProps(titleOf(name), count)}
        className={`group/row relative flex shrink-0 items-center rounded-full transition-[opacity,translate,background-color] duration-300 ease-out motion-reduce:transition-none xl:w-10 xl:rounded-[12px] ${
          added.has(name) ? "starting:-translate-x-2 starting:opacity-0" : ""
        } ${isDragged ? "bg-sheet shadow-[0_8px_20px_-8px_rgb(17_19_24/0.3)] ring-1 ring-hairline" : rowBackground(isActive)}`}
      >
        {/* The icon is the handle a section is dragged by; pressed without dragging, it opens the section as the row does.
            In the rail the icon is the button's, so the button can be pressed anywhere, and the handle is a strip
            down the row's left edge that shows a grip while the row is pointed at. */}
        <span
          {...drag?.dragHandleProps}
          aria-label={drag && `Reorder ${labelOf(name, index)}`}
          onClick={() => choose(name)}
          className={`group/handle absolute inset-y-0 left-0 z-[1] flex items-center justify-center focus-visible:bg-ink/[0.06] focus-visible:outline-none ${
            wide ? "w-3 rounded-l-[12px]" : "w-9 rounded-full"
          }`}
        >
          {!wide && (
            <Icon
              className={`${iconClass(isActive)} ${drag ? "group-hover/row:hidden group-focus-visible/handle:hidden" : ""} ${isDragged ? "hidden" : ""}`}
              aria-hidden="true"
            />
          )}
          {drag && (
            <GripVertical
              className={`text-ink-2 ${wide ? "h-3.5 w-3.5" : "h-4 w-4"} ${isDragged ? "block" : "hidden group-hover/row:block group-focus-visible/handle:block"}`}
              aria-hidden="true"
            />
          )}
        </span>
        <button
          type="button"
          onClick={() => choose(name)}
          className={item(isActive)}
          aria-current={isActive || undefined}
          aria-label={labelOf(name, index)}
          data-section-ref={name}
        >
          {wide && <Icon className={`mx-auto ${iconClass(isActive)}`} aria-hidden="true" />}
          {/* A title too long for a tab, as a section can be renamed, is cut short. In the rail it's the tip instead. */}
          <span className="min-w-0 truncate xl:sr-only">{titleOf(name)}</span>
        </button>
      </div>
    )
  }

  // Arrows move from section to section, opening each as they go, as the
  // Write / Check / Style tabs do: up and down in the list on wide screens, and
  // either way along the row on narrow ones. Only from a section's button, so
  // a drag handle's own keys (Space to lift, then arrows to move) still work.
  const onArrowKey = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (!target.matches("button[data-section-ref]")) return
    const buttons = [...(navRef.current?.querySelectorAll<HTMLButtonElement>("button[data-section-ref]") ?? [])]
    const index = buttons.indexOf(target as HTMLButtonElement)
    const moves: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: buttons.length - 1,
    }
    const next = buttons[moves[event.key]]
    if (moves[event.key] === undefined || !next) return
    event.preventDefault()
    next.focus()
    next.click()
  }

  return (
    <nav
      ref={navRef}
      onKeyDown={onArrowKey}
      aria-label="Sections"
      className="relative isolate flex gap-1 overflow-x-auto px-2 py-2 no-scrollbar xl:flex-col xl:overflow-visible xl:p-0"
    >
      <span
        ref={tabRef}
        aria-hidden="true"
        className={`absolute left-0 top-0 -z-10 rounded-full bg-[#f1f3f8] transition-[transform,width] duration-300 ease-glide motion-reduce:transition-none xl:rounded-[12px] ${
          dragging || active === null ? "invisible" : ""
        }`}
      />

      {/* Laid out as the other sections are, its icon where theirs are, but with nothing to drag it by. */}
      <div
        data-section-row
        {...tipProps("Profile")}
        className={`group/row relative flex shrink-0 items-center rounded-full transition-colors xl:w-10 xl:rounded-[12px] ${rowBackground(active === "Profile")}`}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center xl:w-10">
          <PROFILE_ICON className={iconClass(active === "Profile")} />
        </span>
        <button
          type="button"
          data-section-ref="Profile"
          onClick={() => choose("Profile")}
          className={item(active === "Profile")}
          aria-current={active === "Profile" || undefined}
        >
          <span className="xl:sr-only">Profile</span>
        </button>
      </div>

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

      <AddSectionMenu sections={addable} onAdd={onAdd} />

      {!dragging && tip()}
    </nav>
  )
}

/**
 * How many entries each section of the open resume has. It's read as one
 * string, so typing in an entry doesn't re-render the list; adding or
 * deleting one does.
 */
function useEntryCounts(): Record<SectionName, number> {
  const { id } = useOpenResume()
  const counts = useResumeState((state) => {
    const resume = resumeOf(state, id)
    return SECTION_NAMES.map((name) => resume?.[SECTIONS[name].dataKey]?.length ?? 0).join(",")
  })
  const each = counts.split(",").map(Number)
  return Object.fromEntries(SECTION_NAMES.map((name, index) => [name, each[index]])) as Record<SectionName, number>
}
