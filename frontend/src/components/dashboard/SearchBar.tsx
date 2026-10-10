"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { ChevronDown, Plus, Search, X } from "lucide-react"
import type { ResumeWithId } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import PagePicture from "./PagePicture"
import { editedAgo } from "./ResumeGrid"
import { nameOf } from "./useListActions"

/** How many resumes the panel lists. */
const LISTED = 5

// Lower case, without accents, so "resume" finds "Résumé".
const folded = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** Whether a resume's name or template has what was typed in it. */
export function matches(resume: ResumeWithId, query: string): boolean {
  const wanted = folded(query.trim())
  return !wanted || folded(nameOf(resume)).includes(wanted) || folded(templateById(resume.selectedTemplate).name).includes(wanted)
}

// The name, with what was typed marked where it's written the same way.
function marked(name: string, query: string): ReactNode {
  const at = name.toLowerCase().indexOf(query.trim().toLowerCase())
  if (!query.trim() || at < 0) return name
  const end = at + query.trim().length
  return (
    <>
      {name.slice(0, at)}
      <mark className="rounded-[2px] bg-accent-soft/60 text-ink">{name.slice(at, end)}</mark>
      {name.slice(end)}
    </>
  )
}

interface SearchBarProps {
  /** Every resume, last edited first. */
  resumes: ResumeWithId[]
  query: string
  onQuery: (query: string) => void
  onNew: () => void
}

/**
 * The glass bar at the top of the dashboard, which stays in view. Its search
 * filters the resumes below by name or template, and lists the first few
 * that match: arrow keys pick one, Enter opens it, Escape clears the search.
 * Recent lists the resumes edited last, in a panel that grows out of the bar.
 */
export default function SearchBar({ resumes, query, onQuery, onNew }: SearchBarProps) {
  const router = useRouter()
  // What the panel under the bar shows, if anything.
  const [panel, setPanel] = useState<"search" | "recent" | null>(null)
  // The match picked with the arrow keys, by its place in the list.
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const recentButton = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const optionId = useId()

  const found = query.trim() ? resumes.filter((resume) => matches(resume, query)) : []
  const listed = panel === "search" ? found.slice(0, LISTED) : resumes.slice(0, LISTED)
  const picked = Math.min(active, listed.length - 1)

  // A press anywhere else closes the panel.
  useEffect(() => {
    if (!panel) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPanel(null)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [panel])

  const open = (resume: ResumeWithId) => {
    setPanel(null)
    router.push(`/create/new/${resume.id}`)
  }

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Escape") {
      if (!query && !panel) return
      event.preventDefault()
      onQuery("")
      setPanel(null)
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!query.trim()) return
      event.preventDefault()
      if (panel !== "search") {
        setPanel("search")
        setActive(0)
        return
      }
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((picked + step + listed.length) % Math.max(1, listed.length))
    } else if (event.key === "Enter" && panel === "search" && listed[picked]) {
      event.preventDefault()
      open(listed[picked])
    }
  }

  // In Recent, the arrow keys move between the resumes, and Escape goes back to the button.
  const onRecentKey = (event: KeyboardEvent) => {
    if (panel !== "recent" || event.target === input.current) return
    const links = [...(root.current?.querySelectorAll<HTMLElement>("[data-recent]") ?? [])]
    const at = links.indexOf(document.activeElement as HTMLElement)
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      links[at < 0 ? 0 : (at + step + links.length) % links.length]?.focus()
    } else if (event.key === "Escape") {
      event.preventDefault()
      setPanel(null)
      recentButton.current?.focus()
    }
  }

  const searching = panel === "search"
  const wide = panel !== null || query !== ""
  const matching = query.trim()
    ? found.length === 0
      ? `No resume matches “${query.trim()}”`
      : `${found.length} ${found.length === 1 ? "resume matches" : "resumes match"} “${query.trim()}”`
    : ""

  return (
    <div className="search-dock">
      <div
        ref={root}
        className={`search-bar glass ${wide ? "is-wide" : ""}`}
        onKeyDown={onRecentKey}
        onBlur={(event) => {
          // Focus leaving the bar and its panel closes the panel.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPanel(null)
        }}
      >
        <div className="search-field">
          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Search your resumes"
            aria-autocomplete="list"
            aria-expanded={searching}
            aria-controls={searching ? panelId : undefined}
            aria-activedescendant={searching && listed[picked] ? `${optionId}-${picked}` : undefined}
            placeholder="Search resumes"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              onQuery(event.target.value)
              setActive(0)
              setPanel(event.target.value.trim() ? "search" : null)
            }}
            onFocus={() => {
              if (query.trim()) setPanel("search")
            }}
            onKeyDown={onSearchKey}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2/80"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onQuery("")
                setPanel(null)
                input.current?.focus()
              }}
              className="-mr-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-ink/[0.06] hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          ref={recentButton}
          type="button"
          aria-expanded={panel === "recent"}
          aria-controls={panel === "recent" ? panelId : undefined}
          onClick={() => setPanel((panel) => (panel === "recent" ? null : "recent"))}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.06] sm:px-4"
        >
          Recent
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${panel === "recent" ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New<span className="sr-only"> resume</span>
        </button>

        {panel && (
          <div className="search-panel glass glass-frost">
            {/* While searching, the status below says this. */}
            <p className="label-mono px-3 pb-2 pt-1 text-ink-2" aria-hidden={searching || undefined}>
              {searching ? matching : "Recently edited"}
            </p>
            {searching ? (
              <ul id={panelId} role="listbox" aria-label="Matching resumes">
                {listed.map((resume, index) => (
                  <li
                    key={resume.id}
                    id={`${optionId}-${index}`}
                    role="option"
                    aria-selected={index === picked}
                    // Keeps focus in the search, which a click would take away.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => open(resume)}
                    className={`search-row ${index === picked ? "is-picked" : ""}`}
                  >
                    <Row resume={resume} query={query} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul id={panelId} aria-label="Recently edited">
                {listed.map((resume) => (
                  <li key={resume.id}>
                    <Link href={`/create/new/${resume.id}`} data-recent="" onClick={() => setPanel(null)} className="search-row">
                      <Row resume={resume} query="" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <p role="status" className="sr-only">
        {matching}
      </p>
    </div>
  )
}

function Row({ resume, query }: { resume: ResumeWithId; query: string }) {
  return (
    <>
      <PagePicture id={resume.id} resume={resume} sizes="46px" className="h-[52px] w-10 shrink-0 ring-1 ring-rule" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-medium text-ink">{marked(nameOf(resume), query)}</span>
        <span className="label-mono truncate text-ink-2">
          {templateById(resume.selectedTemplate).name} · Edited {editedAgo(resume.updatedAt).toLowerCase()}
        </span>
      </span>
      <span className="search-open label-mono shrink-0 text-ink-2" aria-hidden="true">
        ↵ Open
      </span>
    </>
  )
}
