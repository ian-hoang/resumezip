"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import type { ResumeWithId } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import { reducedMotion } from "@/components/editor/layout"
import PagePicture from "./PagePicture"
import { editedAgo } from "./ResumeGrid"
import { nameOf } from "./useListActions"

/** How many matches the panel under the search lists. */
const LISTED = 5

// How long the lifted search takes to fade back into the toolbar, in milliseconds (spot-out in dashboard.css).
const LANDING_MS = 200

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
 *
 * In use, it lifts out of the toolbar into the middle of the screen, over a
 * softened page, as Spotlight does on a Mac; a copy of it stays in the toolbar
 * underneath. Escape with nothing typed, a click on the page, or Tab out puts
 * it back, and lets go of the focus. It stays one input throughout, so focus
 * and typing carry over as it lifts.
 */
export default function SearchBar({ resumes, query, onQuery }: SearchBarProps) {
  const router = useRouter()
  const [listing, setListing] = useState(false)
  // In the toolbar, lifted into the middle of the screen, or fading back down.
  const [place, setPlace] = useState<"down" | "up" | "landing">("down")
  const landing = useRef(0)
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

  const lift = () => {
    window.clearTimeout(landing.current)
    setPlace("up")
  }
  const land = () => {
    if (place !== "up") return
    if (reducedMotion()) return setPlace("down")
    setPlace("landing")
    landing.current = window.setTimeout(() => setPlace("down"), LANDING_MS)
  }
  useEffect(() => () => window.clearTimeout(landing.current), [])

  // The header, a pill the same shape, tucks away above the screen while the search is up (home.css).
  useEffect(() => {
    if (place !== "up") return
    const page = document.documentElement
    page.setAttribute("data-spotlight", "")
    return () => page.removeAttribute("data-spotlight")
  }, [place])

  const go = (resume: ResumeWithId) => {
    setListing(false)
    router.push(`/create/new/${resume.id}`)
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Escape") {
      if (!query && !listing && place !== "up") return
      event.preventDefault()
      // With something typed it starts again; with nothing, it lets go, which puts it back in the toolbar.
      if (!query) input.current?.blur()
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

  const lifted = place !== "down"

  return (
    // The toolbar's place for it, which keeps its height while the search is lifted out of it.
    <div className="relative h-10">
      {lifted && (
        <>
          {/* What stays in the toolbar, under the softened page. */}
          <div aria-hidden="true" className="search-field flex h-10 items-center gap-2.5 pl-3.5 pr-2 text-[15px] text-ink-2">
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">{query || "Search resumes"}</span>
          </div>
          {/* A press on the page puts the search back, as focus leaving it does. */}
          <div aria-hidden="true" className={`search-veil ${place === "landing" ? "is-leaving" : ""}`} onPointerDown={land} />
        </>
      )}
      <div
        ref={root}
        data-lifted={place === "up" || undefined}
        data-landing={place === "landing" || undefined}
        className="search-spot group/spot"
        onFocus={lift}
        onBlur={(event) => {
          // Focus leaving the search and its panel closes the panel, and puts the search back.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setListing(false)
          land()
        }}
      >
        <div
          // A press on the field's edge, around the input, goes to the input.
          onPointerDown={(event) => {
            if (event.target !== input.current) {
              event.preventDefault()
              input.current?.focus()
            }
          }}
          className="search-field flex h-10 cursor-text items-center gap-2.5 pl-3.5 pr-2 group-data-[lifted]/spot:h-[60px] group-data-[landing]/spot:h-[60px] group-data-[lifted]/spot:gap-3.5 group-data-[landing]/spot:gap-3.5 group-data-[lifted]/spot:pl-6 group-data-[landing]/spot:pl-6 group-data-[lifted]/spot:pr-3 group-data-[landing]/spot:pr-3"
        >
          <Search
            className="h-4 w-4 shrink-0 text-ink-2 group-data-[landing]/spot:h-5 group-data-[landing]/spot:w-5 group-data-[lifted]/spot:h-5 group-data-[lifted]/spot:w-5"
            aria-hidden="true"
          />
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
            className="peer min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2 group-data-[landing]/spot:text-[19px] group-data-[lifted]/spot:text-[19px]"
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
    </div>
  )
}
