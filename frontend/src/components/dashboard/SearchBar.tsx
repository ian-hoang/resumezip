"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import type { ResumeWithId } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import PagePicture from "./PagePicture"
import { editedAgo } from "./ResumeGrid"
import { nameOf } from "./useListActions"

/** How many matches the panel under the search lists. */
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

// Whether a key pressed in this element is typing, which "/" mustn't take over.
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

interface SearchBarProps {
  /** Every resume, last edited first. */
  resumes: ResumeWithId[]
  query: string
  onQuery: (query: string) => void
}

/**
 * The search at the start of the dashboard's toolbar. It filters the resumes
 * below by name or template, and lists the first few that match in a panel
 * under it: arrow keys pick one, Enter opens it, Escape clears the search.
 * "/" anywhere else on the page goes to it.
 */
export default function SearchBar({ resumes, query, onQuery }: SearchBarProps) {
  const router = useRouter()
  const [listing, setListing] = useState(false)
  // The match picked with the arrow keys, by its place in the list.
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const optionId = useId()

  const found = query.trim() ? resumes.filter((resume) => matches(resume, query)) : []
  const listed = found.slice(0, LISTED)
  const picked = Math.min(active, listed.length - 1)
  const open = listing && listed.length > 0

  // "/" goes to the search, as on many sites, unless it's being typed somewhere or a dialog is open.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || typingIn(event.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      input.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // A press anywhere else closes the panel.
  useEffect(() => {
    if (!listing) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setListing(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [listing])

  const go = (resume: ResumeWithId) => {
    setListing(false)
    router.push(`/create/new/${resume.id}`)
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Escape") {
      if (!query && !listing) return
      event.preventDefault()
      onQuery("")
      setListing(false)
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!query.trim()) return
      event.preventDefault()
      if (!open) {
        setListing(true)
        setActive(0)
        return
      }
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((picked + step + listed.length) % listed.length)
    } else if (event.key === "Enter" && open && listed[picked]) {
      event.preventDefault()
      go(listed[picked])
    }
  }

  const matching = query.trim()
    ? found.length === 0
      ? `No resume matches “${query.trim()}”`
      : `${found.length} ${found.length === 1 ? "resume matches" : "resumes match"} “${query.trim()}”`
    : ""

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        // Focus leaving the search and its panel closes the panel.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setListing(false)
      }}
    >
      <div className="flex h-10 items-center gap-2.5 rounded-full bg-sheet/70 pl-3.5 pr-2 ring-1 ring-ink/15 transition-[background-color,box-shadow] duration-200 focus-within:bg-sheet focus-within:shadow-[0_0_0_5px_rgb(46_91_230/0.14)] focus-within:ring-[1.5px] focus-within:ring-accent hover:ring-ink/40 motion-reduce:transition-none">
        <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label="Search your resumes"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-activedescendant={open && listed[picked] ? `${optionId}-${picked}` : undefined}
          placeholder="Search resumes"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            onQuery(event.target.value)
            setActive(0)
            setListing(event.target.value.trim() !== "")
          }}
          onFocus={() => {
            if (query.trim()) setListing(true)
          }}
          onKeyDown={onKey}
          className="peer min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onQuery("")
              setListing(false)
              input.current?.focus()
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          // Only a hint for a keyboard; it goes once the search has focus, and on touch screens.
          <kbd
            aria-hidden="true"
            className="pointer-events-none inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-[11px] text-ink-2 ring-1 ring-ink/15 peer-focus:hidden [@media(hover:none)]:hidden"
          >
            /
          </kbd>
        )}
      </div>

      {open && (
        <div className="search-panel glass glass-frost rounded-panel">
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
                onClick={() => go(resume)}
                className={`search-row ${index === picked ? "is-picked" : ""}`}
              >
                <PagePicture id={resume.id} resume={resume} sizes="40px" className="h-[44px] w-[34px] shrink-0 ring-1 ring-ink/10" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-medium text-ink">{marked(nameOf(resume), query)}</span>
                  <span className="label-mono truncate text-ink-2">
                    {templateById(resume.selectedTemplate).name} · {editedAgo(resume.updatedAt)}
                  </span>
                </span>
                <span className="search-open label-mono shrink-0 text-ink-2" aria-hidden="true">
                  ↵ Open
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p role="status" className="sr-only">
        {matching}
      </p>
    </div>
  )
}
