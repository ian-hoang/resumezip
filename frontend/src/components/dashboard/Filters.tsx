"use client"

import { ArrowDownWideNarrow, Check, ChevronDown, LayoutGrid, List } from "lucide-react"
import { useId, type ReactNode } from "react"
import { MENU_ITEM, MENU_PANEL, useMenu } from "./MoreMenu"
import LiquidLens from "@/components/LiquidLens"
import { SEGMENT, SEGMENTS } from "@/components/pills"
import { useThumb } from "@/components/useThumb"

export type View = "pages" | "list"
export type Sort = "edited" | "name"

const SORTS: { id: Sort; name: string }[] = [
  { id: "edited", name: "Last edited" },
  { id: "name", name: "Name" },
]

interface FiltersProps {
  /** The search box, first in the row. */
  search: ReactNode
  /** Each tag in use, with its name and how many resumes have it; "All" first, as "". */
  tags: { id: string; name: string; count: number }[]
  tag: string
  onTag: (tag: string) => void
  sort: Sort
  onSort: (sort: Sort) => void
  view: View
  onView: (view: View) => void
  /** Its place on the page, as its margin above. */
  className?: string
}

/**
 * The bar above the resumes, in liquid glass: the search, a chip for each
 * tag, how they're sorted, and pages or a list. Where it's too narrow for one
 * line, the chips go under the rest (dashboard.css).
 */
export default function Filters({ search, tags, tag, onTag, sort, onSort, view, onView, className = "" }: FiltersProps) {
  const chips = useThumb(tag, tags.map((option) => `${option.id} ${option.count}`).join("\n"))
  const views = useThumb(view)
  return (
    <div className={`dash-toolbar glass glass-liquid ${className}`}>
      <LiquidLens bevel={26} strength={1.25} />
      <div className="dash-toolbar-search">{search}</div>
      <div className="dash-toolbar-chips">
        {/* One line that scrolls sideways where it's too narrow. */}
        <div
          ref={chips.group}
          role="group"
          aria-label="Show"
          className={`${SEGMENTS} overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          <span ref={chips.thumb} aria-hidden="true" className={`segment-thumb ${chips.placed ? "" : "invisible"}`} />
          {tags.map((option) => {
            const pressed = tag === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onTag(option.id)}
                // Until the white pill is placed, the pressed chip draws its own.
                className={`${SEGMENT} gap-[7px] px-4 font-normal ${pressed ? "text-ink" : "text-ink-2 hover:text-ink"} ${pressed && !chips.placed ? "bg-sheet shadow-[0_1px_3px_rgb(17_19_24/0.14)]" : ""}`}
              >
                {option.name} <span className="text-[12px] tabular-nums text-ink-3">{option.count}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="dash-toolbar-controls">
        <SortMenu sort={sort} onSort={onSort} />
        {/* Left and right switch between the two, as the editor's Write / Check / Style do. Only the
            chosen one is in the Tab order, so focus is always on the white pill and needs no ring. */}
        <div
          ref={views.group}
          role="group"
          aria-label="View"
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
            event.preventDefault()
            const next = view === "pages" ? "list" : "pages"
            onView(next)
            event.currentTarget.querySelector<HTMLElement>(`[data-view="${next}"]`)?.focus()
          }}
          className="segment-track h-[46px] p-[5px]"
        >
          <span ref={views.thumb} aria-hidden="true" className={`segment-thumb ${views.placed ? "" : "invisible"}`} />
          <ViewButton
            view="pages"
            pressed={view === "pages"}
            placed={views.placed}
            onClick={() => onView("pages")}
            icon={<LayoutGrid className="h-[17px] w-[17px]" aria-hidden="true" />}
          >
            Pages
          </ViewButton>
          <ViewButton
            view="list"
            pressed={view === "list"}
            placed={views.placed}
            onClick={() => onView("list")}
            icon={<List className="h-[17px] w-[17px]" aria-hidden="true" />}
          >
            List
          </ViewButton>
        </div>
      </div>
    </div>
  )
}

/** A pill saying how the resumes are sorted, which opens a menu of the other ways. */
function SortMenu({ sort, onSort }: { sort: Sort; onSort: (sort: Sort) => void }) {
  const { open, setOpen, button, menu, close, onKeyDown } = useMenu()
  const id = useId()
  const current = SORTS.find((option) => option.id === sort) ?? SORTS[0]
  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((open) => !open)}
        aria-label={`Sort ${current.name}`}
        className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[14px] text-ink-2 transition-colors duration-200 hover:bg-white/60 hover:text-ink motion-reduce:transition-none"
      >
        <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />
        {current.name}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label="Sort by"
          onKeyDown={onKeyDown}
          className={`${MENU_PANEL} sort-menu right-0 top-full mt-2`}
        >
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === sort}
              tabIndex={-1}
              onClick={() => {
                close(true)
                onSort(option.id)
              }}
              className={`${MENU_ITEM} text-ink`}
            >
              <Check className={`h-4 w-4 ${option.id === sort ? "" : "invisible"}`} aria-hidden="true" />
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ViewButton({
  view,
  pressed,
  placed,
  onClick,
  icon,
  children,
}: {
  view: View
  pressed: boolean
  /** Whether the sliding pill (useThumb) is drawn, so the pressed button needn't draw its own. */
  placed: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-view={view}
      aria-pressed={pressed}
      tabIndex={pressed ? 0 : -1}
      onClick={onClick}
      className={`relative inline-flex h-9 w-10 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none motion-reduce:transition-none ${
        !pressed ? "text-ink-3 hover:text-ink" : placed ? "text-ink" : "bg-sheet text-ink shadow-[0_1px_3px_rgb(17_19_24/0.14)]"
      }`}
    >
      {icon}
      {/* Said, but not shown: the icons are the switch. */}
      <span className="sr-only">{children}</span>
    </button>
  )
}
