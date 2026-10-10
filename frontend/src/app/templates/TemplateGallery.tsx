"use client"

import Image from "next/image"
import { useEffect, useId, useRef, useState } from "react"
import { ArrowUpRight, Search } from "lucide-react"
import { StartWritingLink } from "@/components/site/StartWriting"
import { OUTLINE_PILL } from "@/components/pills"
import { TEMPLATE_TAGS, TEMPLATES, templateMatches, type TemplateId, type TemplateTag } from "@/lib/templates"

const names = new Intl.ListFormat("en", { type: "conjunction" })

// Whether a key pressed in this element is typing, which "/" mustn't take over.
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/**
 * The templates page's list: one glass bar with a search, chips to filter by
 * style and how many are shown; and a card for each template that starts a
 * resume with it. Pointed
 * at, a card's page brings up a glass plate with its details and Use. `newId`
 * is the template marked as new, if one is.
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
      {/* On wide screens it's one line; narrower, the chips go under the search and scroll sideways. */}
      <div className="search-field flex flex-col gap-1 rounded-[28px] p-2 [--search-blur:16px] [--search-fill:linear-gradient(180deg,rgb(255_255_255/0.72),rgb(255_255_255/0.52))] xl:flex-row xl:items-center xl:gap-2 xl:rounded-full">
        <div className="relative w-full shrink-0 xl:w-[300px]">
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
            placeholder="Search templates"
            autoComplete="off"
            spellCheck={false}
            className="peer h-12 w-full rounded-full bg-white/55 pl-12 pr-14 text-[16px] text-ink ring-1 ring-inset ring-ink/[0.06] transition-[box-shadow,background-color] placeholder:text-ink-2 focus:bg-white/80 focus:outline-none focus:ring-ink/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {/* Only a hint for a keyboard; it goes once the search has focus. */}
          <kbd
            aria-hidden="true"
            className="label-mono pointer-events-none absolute right-3 top-1/2 inline-flex h-6 min-w-8 -translate-y-1/2 items-center justify-center rounded-full px-2 text-ink-2 ring-1 ring-inset ring-ink/15 peer-focus:hidden [@media(hover:none)]:hidden"
          >
            /
          </kbd>
        </div>

        <span aria-hidden="true" className="mx-1 hidden h-7 w-px shrink-0 bg-ink/15 xl:block" />

        <div
          role="group"
          aria-label="Filter by style"
          className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[undefined, ...TEMPLATE_TAGS].map((option) => {
            const pressed = tag === option
            return (
              <button
                key={option ?? "all"}
                type="button"
                aria-pressed={pressed}
                onClick={() => pick(option)}
                className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-medium tracking-[-0.01em] transition-[background-color,color] ${
                  pressed ? "bg-ink text-white" : "text-ink hover:bg-ink/[0.06]"
                }`}
              >
                {option ?? "All"}
              </button>
            )
          })}
        </div>

        {/* The status below says it to screen readers, once the list changes. */}
        <span aria-hidden="true" className="label-mono hidden shrink-0 whitespace-nowrap pr-4 text-ink-2 xl:block">
          {shown.length} shown
        </span>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((template) => (
            <StartWritingLink key={template.id} template={template.id} className="template-card group flex flex-col gap-4">
              <div className="template-page relative aspect-[8.5/11] w-full overflow-hidden bg-sheet">
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
                {/* Frosted glass over the foot of the page: what it's set in, and Use. */}
                <span
                  aria-hidden="true"
                  className="template-use search-field absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[18px] py-2.5 pl-4 pr-2.5 [--search-blur:14px] [--search-fill:linear-gradient(180deg,rgb(255_255_255/0.66),rgb(255_255_255/0.46))]"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-serif text-[21px] leading-none tracking-[-0.015em]">{template.name}</span>
                    <span className="label-mono truncate text-ink-2">{[template.font, ...template.tags].join(" · ")}</span>
                  </span>
                  <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-medium tracking-[-0.01em] text-white shadow-[0_10px_24px_-12px_rgb(17_19_24/0.6)]">
                    Use <ArrowUpRight className="h-4 w-4" />
                  </span>
                </span>
              </div>
              {/* On touch screens the plate is always up and says this already. */}
              <div className="flex items-baseline justify-between gap-3 pt-1 [@media(hover:none)]:hidden">
                <span className="font-serif text-[22px] leading-tight tracking-[-0.015em]">{template.name}</span>
                <span className="label-mono text-right text-ink-2">{template.font}</span>
              </div>
            </StartWritingLink>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 pt-4">
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
