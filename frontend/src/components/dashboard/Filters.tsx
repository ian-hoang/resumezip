"use client"

import { Check, ChevronDown, LayoutGrid, List } from "lucide-react"
import { useId, type ReactNode } from "react"
import { MENU_ITEM, MENU_PANEL, useMenu } from "./MoreMenu"
import { SMALL_PILL } from "@/components/pills"

export type View = "pages" | "list"
export type Sort = "edited" | "name"

const SORTS: { id: Sort; name: string }[] = [
  { id: "edited", name: "Last edited" },
  { id: "name", name: "Name" },
]

interface FiltersProps {
  /** The search box, first in the row. */
  search: ReactNode
  /** Each tag in use, with its name and how many resumes have it; "all" first. */
  tags: { id: string; name: string; count: number }[]
  tag: string
  onTag: (tag: string) => void
  sort: Sort
  onSort: (sort: Sort) => void
  view: View
  onView: (view: View) => void
}

/**
 * The row above the resumes: the search, a chip for each tag, how they're
 * sorted, and pages or a list. Where it's too narrow for one line, the chips
 * go under the rest (dashboard.css).
 */
export default function Filters({ search, tags, tag, onTag, sort, onSort, view, onView }: FiltersProps) {
  return (
    <div className="dash-toolbar border-b border-ink pb-5">
      <div className="dash-toolbar-search">{search}</div>
      <div role="group" aria-label="Show" className="dash-toolbar-chips flex flex-wrap gap-2">
        {tags.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={tag === option.id}
            onClick={() => onTag(option.id)}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none ${
              tag === option.id ? "bg-ink text-white" : "bg-sheet/70 text-ink ring-1 ring-ink/15 hover:bg-sheet hover:ring-ink/40"
            }`}
          >
            {option.name}{" "}
            <span className={`font-mono text-[11px] ${tag === option.id ? "text-white/70" : "text-ink-2"}`}>{option.count}</span>
          </button>
        ))}
      </div>
      <div className="dash-toolbar-controls">
        <SortMenu sort={sort} onSort={onSort} />
        <div role="group" aria-label="View" className="inline-flex h-9 rounded-full bg-sheet/50 p-[3px] ring-1 ring-ink/15">
          <ViewButton
            pressed={view === "pages"}
            onClick={() => onView("pages")}
            icon={<LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Pages
          </ViewButton>
          <ViewButton pressed={view === "list"} onClick={() => onView("list")} icon={<List className="h-3.5 w-3.5" aria-hidden="true" />}>
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
        className={SMALL_PILL}
      >
        <span className="text-ink-2">Sort</span> {current.name}
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-2 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
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

function ViewButton({ pressed, onClick, icon, children }: { pressed: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-full items-center gap-1.5 rounded-full px-3 text-sm transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none ${
        pressed ? "bg-sheet text-ink shadow-[0_1px_3px_rgb(17_19_24/0.14)]" : "text-ink-2 hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
