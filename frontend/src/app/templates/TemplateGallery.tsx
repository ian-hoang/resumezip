"use client"

import Image from "next/image"
import { useEffect, useId, useRef, useState } from "react"
import { ArrowUpRight, Search } from "lucide-react"
import { StartWritingLink } from "@/components/site/StartWriting"
import { OUTLINE_PILL } from "@/components/site/pills"
import { TEMPLATE_TAGS, TEMPLATES, templateMatches, type TemplateId, type TemplateTag } from "@/lib/templates"

const names = new Intl.ListFormat("en", { type: "conjunction" })

// Whether a key pressed in this element is typing, which "/" mustn't take over.
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/**
 * The templates page's list: a search, chips to filter by style, and a card
 * for each template that starts a resume with it. `newId` is the template
 * marked as new, if one is.
 */
export default function TemplateGallery({ newId }: { newId?: TemplateId }) {
  const [search, setSearch] = useState("")
  const [tag, setTag] = useState<TemplateTag>()
  // Screen readers hear what's shown once the list has changed, not as the page opens.
  const [changed, setChanged] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchId = useId()

  // "/" goes to the search, as on many sites, unless it's being typed somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || typingIn(event.target)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const shown = TEMPLATES.filter((template) => templateMatches(template, search, tag))
  const filtering = search.trim() !== "" || tag !== undefined
  const announcement = !changed
    ? ""
    : shown.length === 0
      ? "No template matches."
      : filtering
        ? `Showing ${names.format(shown.map((template) => template.name))}.`
        : "Showing every template."

  const pick = (next?: TemplateTag) => {
    setTag(next)
    setChanged(true)
  }
  const clear = () => {
    setSearch("")
    setTag(undefined)
    searchRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-full max-w-[520px]">
          <label htmlFor={searchId} className="sr-only">
            Search templates
          </label>
          <Search
            className="pointer-events-none absolute left-[18px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-2"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setChanged(true)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search) {
                event.preventDefault()
                setSearch("")
              }
            }}
            placeholder="Search by name, font or style"
            autoComplete="off"
            spellCheck={false}
            className="peer h-12 w-full rounded-full bg-sheet/80 pl-12 pr-14 text-[16px] text-ink shadow-[0_12px_32px_-20px_rgb(30_40_90/0.45)] ring-1 ring-inset ring-ink/15 transition-[box-shadow,background-color] placeholder:text-ink-2 hover:ring-ink/40 focus:bg-sheet focus:shadow-[0_0_0_4px_rgb(46_91_230/0.15)] focus:outline-none focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {/* Only a hint for a keyboard; it goes once the search has focus. */}
          <kbd
            aria-hidden="true"
            className="label-mono pointer-events-none absolute right-3 top-1/2 inline-flex h-6 min-w-8 -translate-y-1/2 items-center justify-center rounded-full px-2 text-ink-2 ring-1 ring-inset ring-ink/15 peer-focus:hidden [@media(hover:none)]:hidden"
          >
            /
          </kbd>
        </div>

        <div role="group" aria-label="Filter by style" className="flex max-w-[860px] flex-wrap justify-center gap-2">
          {[undefined, ...TEMPLATE_TAGS].map((option) => {
            const pressed = tag === option
            return (
              <button
                key={option ?? "all"}
                type="button"
                aria-pressed={pressed}
                onClick={() => pick(option)}
                className={`h-10 rounded-full px-4 text-[15px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] ${
                  pressed ? "bg-ink text-white" : "bg-sheet/70 text-ink ring-1 ring-inset ring-ink/15 hover:ring-ink/40"
                }`}
              >
                {option ?? "All"}
              </button>
            )
          })}
        </div>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 border-t border-ink/15 pt-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((template) => (
            <StartWritingLink key={template.id} template={template.id} className="template-card group flex flex-col gap-4">
              <div className="template-page relative aspect-[8.5/11] w-full bg-sheet">
                <Image
                  src={template.image}
                  alt={`${template.name} template`}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top"
                />
                {template.id === newId && (
                  <span className="label-mono absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-white">New</span>
                )}
                <span aria-hidden="true" className="template-use absolute inset-x-0 bottom-5 flex justify-center">
                  <span className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-[18px] text-[15px] font-medium tracking-[-0.01em] text-white shadow-[0_12px_28px_-12px_rgb(17_19_24/0.6)]">
                    Use this template <ArrowUpRight className="h-4 w-4" />
                  </span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-1">
                <span className="font-serif text-[22px] leading-tight tracking-[-0.015em]">{template.name}</span>
                <span className="label-mono text-right text-ink-2">{template.font}</span>
              </div>
            </StartWritingLink>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 border-t border-ink/15 pt-10">
          <p className="font-serif text-[28px] leading-tight tracking-[-0.02em]">No template matches that.</p>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
            Try a template’s name, a font like Garamond or Lato, or one of the styles above.
          </p>
          <button type="button" onClick={clear} className={OUTLINE_PILL}>
            Show every template
          </button>
        </div>
      )}
    </div>
  )
}
