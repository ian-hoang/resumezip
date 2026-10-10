"use client"

import { ChevronDown, LayoutGrid, List } from "lucide-react"
import type { ReactNode } from "react"

export type View = "pages" | "list"
export type Sort = "edited" | "name"

interface FiltersProps {
  /** Each tag in use, with its name and how many resumes have it; "all" first. */
  tags: { id: string; name: string; count: number }[]
  tag: string
  onTag: (tag: string) => void
  sort: Sort
  onSort: (sort: Sort) => void
  view: View
  onView: (view: View) => void
}

/** The row above the resumes: a tab for each tag, how they're sorted, and pages or a list. */
export default function Filters({ tags, tag, onTag, sort, onSort, view, onView }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-ink pb-5">
      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {tags.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={tag === option.id}
            onClick={() => onTag(option.id)}
            className={`inline-flex h-9 items-center gap-2.5 rounded-[4px] border px-3.5 text-sm transition-colors ${
              tag === option.id ? "border-ink bg-ink text-white" : "border-rule-strong text-ink hover:border-ink"
            }`}
          >
            {option.name}{" "}
            <span className={`font-mono text-[11px] ${tag === option.id ? "text-white/70" : "text-ink-2"}`}>{option.count}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <label className="relative inline-flex items-center">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(event) => onSort(event.target.value === "name" ? "name" : "edited")}
            className="label-mono h-9 cursor-pointer appearance-none rounded-[4px] bg-transparent pl-2 pr-6 text-ink-2 hover:text-ink"
          >
            <option value="edited">Last edited</option>
            <option value="name">Name</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-ink-2" aria-hidden="true" />
        </label>
        <div role="group" aria-label="View" className="inline-flex rounded-[4px] border border-rule-strong p-0.5">
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

function ViewButton({ pressed, onClick, icon, children }: { pressed: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[3px] px-3 text-sm transition-colors ${
        pressed ? "bg-sheet text-ink shadow-[0_1px_2px_rgb(17_19_24/0.12)]" : "text-ink-2 hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
