"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"
import { ArrowUpRight, Search } from "lucide-react"
import LiquidLens from "@/components/LiquidLens"
import { SEGMENT, SEGMENTS, sheetPill, WHITE_PILL } from "@/components/pills"
import { StartWritingLink } from "@/components/site/StartWriting"
import { useThumb } from "@/components/useThumb"
import { typingIn } from "@/lib/keys"
import {
  TEMPLATE_TAGS,
  TEMPLATES,
  templateImageAlt,
  templateMatches,
  templatePath,
  type TemplateId,
  type TemplateTag,
} from "@/lib/templates"

const names = new Intl.ListFormat("en", { type: "conjunction" })

const STYLES = [undefined, ...TEMPLATE_TAGS]

/**
 * The templates page's list, as the dashboard lays out resumes: a bar of
 * liquid glass with a search and a chip for each style, then a card for each
 * template, its page across its top and its styles, name and typeface under
 * it. The page leads to the template's own page. Pointed at, or with the
 * keyboard in the card, a glass plate with Use, which starts a resume with it,
 * comes up over the page's foot (.template-card in styles/home.css); without
 * a pointer to point with, Use is a button under the name instead. `newId` is
 * the template marked as new, if one is.
 */
export default function TemplateGallery({ newId }: { newId?: TemplateId }) {
  const [search, setSearch] = useState("")
  const [tag, setTag] = useState<TemplateTag>()
  // Screen readers hear what's shown once the list has changed, not as the page opens.
  const [changed, setChanged] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchId = useId()
  const chips = useThumb(tag ?? "")

  // The search is in the page's HTML, so it can be typed in before this script runs. React keeps
  // what's in the box as it hydrates, but `search` starts empty, and the list would ignore it.
  useEffect(() => {
    const typed = searchRef.current?.value
    if (!typed) return
    setSearch(typed)
    setChanged(true)
  }, [])

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
    <div className="mt-8 flex flex-col gap-5 md:mt-[34px] md:gap-[22px]">
      {/* The dashboard's bar (styles/dashboard.css), with nothing after the chips. */}
      <div className="dash-toolbar dash-toolbar-plain glass glass-liquid">
        <LiquidLens bevel={26} strength={1.25} />
        <div className="dash-toolbar-search">
          {/* A press anywhere on the field goes to its box. */}
          <div
            onMouseDown={(event) => {
              if (event.target === searchRef.current) return
              event.preventDefault()
              searchRef.current?.focus()
            }}
            className="search-field flex h-11 cursor-text items-center gap-2.5 pl-[18px] pr-3"
          >
            <Search className="h-4 w-4 shrink-0 text-[#8b9099]" aria-hidden="true" />
            <label htmlFor={searchId} className="sr-only">
              Search templates
            </label>
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
              // 16px on phones: Safari on an iPhone zooms the page in to a field with smaller text when it's focused.
              className="peer min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-[#8b9099] md:text-[15px] [&::-webkit-search-cancel-button]:hidden"
            />
            {/* Only a hint for a keyboard; it goes once the search has focus. */}
            <kbd
              aria-hidden="true"
              className="pointer-events-none inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-sheet px-1.5 font-mono text-[11px] text-ink-3 ring-1 ring-inset ring-[#e3e5ea] peer-focus:hidden [@media(hover:none)]:hidden"
            >
              /
            </kbd>
          </div>
        </div>
        <div className="dash-toolbar-chips">
          {/* One line that scrolls sideways where it's too narrow. */}
          <div
            ref={chips.group}
            role="group"
            aria-label="Filter by style"
            className={`${SEGMENTS} overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            <span ref={chips.thumb} aria-hidden="true" className={`segment-thumb ${chips.placed ? "" : "invisible"}`} />
            {STYLES.map((option) => {
              const pressed = tag === option
              return (
                <button
                  key={option ?? "all"}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => pick(option)}
                  // Until the white pill is placed, the pressed chip draws its own.
                  className={`${SEGMENT} px-4 font-normal ${pressed ? "text-ink" : "text-ink-2 hover:text-ink"} ${
                    pressed && !chips.placed ? "bg-sheet shadow-[0_1px_3px_rgb(17_19_24/0.14)]" : ""
                  }`}
                >
                  {option ?? "All"}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {shown.length > 0 ? (
        <ul className="resume-grid">
          {shown.map((template) => {
            const tags: readonly string[] = template.tags
            return (
              <li key={template.id} className="tile template-card relative min-w-0">
                <div className="tile-stage">
                  <div className="tile-page">
                    <Link href={templatePath(template)} className="absolute inset-0">
                      <Image
                        src={template.image}
                        alt={templateImageAlt(template)}
                        fill
                        sizes="(min-width: 640px) 300px, 50vw"
                        className="object-cover object-top"
                      />
                    </Link>
                    {template.id === newId && (
                      <span className="label-mono pointer-events-none absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-white">
                        New
                      </span>
                    )}
                    {/* Frosted glass over the foot of the page: what it's set in, and Use, which starts a resume with it.
                        The whole plate is the Use link, so pointed at, it whitens and is outlined in ink, and its Use,
                        the sheet's blue main button, brightens and grows, its arrow nudged on: apart from the picture
                        above it, which opens the template's page. The plate's own fade is in styles/home.css. Use lets
                        the pointer through to the plate, so pointing at Use is pointing at the plate. */}
                    <StartWritingLink
                      template={template.id}
                      // Without a pointer to point with, the button under the name is Use instead.
                      className="template-use search-field group/use absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[18px] py-2.5 pl-4 pr-2.5 [--search-blur:14px] [@media(hover:none)]:hidden"
                    >
                      <span className="sr-only">Use {template.name}</span>
                      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate font-serif text-[21px] leading-none tracking-[-0.015em]">{template.name}</span>
                        <span className="label-mono truncate text-ink-2">{[template.font, ...tags].join(" · ")}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="blue-button pointer-events-none inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium tracking-[-0.01em] transition-[filter,scale] duration-200 group-hover/use:scale-[1.04] group-hover/use:brightness-[1.06] group-active/use:scale-[0.97] motion-reduce:group-hover/use:scale-100"
                      >
                        Use{" "}
                        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-glide group-hover/use:-translate-y-[3px] group-hover/use:translate-x-[3px] motion-reduce:transition-none motion-reduce:group-hover/use:translate-x-0 motion-reduce:group-hover/use:translate-y-0" />
                      </span>
                    </StartWritingLink>
                  </div>
                </div>

                <div className="tile-text flex min-w-0 flex-col gap-1 px-4 pb-3.5 pt-3 max-sm:px-3 max-sm:pb-1.5 max-sm:pt-2.5">
                  {/* Its styles, over its name. One without a style keeps the line, so the names in a row line up. */}
                  <span className="label-mono mb-[3px] truncate leading-[14px] text-ink-3">{tags.join(" · ") || " "}</span>
                  {/* The picture's link is the one announced, so this one's skipped. */}
                  <Link
                    href={templatePath(template)}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="truncate text-[16px] font-medium leading-[1.3] tracking-[-0.02em] hover:underline hover:underline-offset-4 sm:text-[18px]"
                  >
                    {template.name}
                  </Link>
                  <p className="truncate text-[13px] leading-5 text-ink-3 sm:text-[14px]">{template.font}</p>
                </div>

                {/* With nothing to point with, Use is a button here instead of the plate, which leaves the
                    page in full on a phone's narrow cards. */}
                <div className="hidden px-2.5 pb-2.5 pt-1 [@media(hover:none)]:block">
                  <StartWritingLink template={template.id} className={sheetPill("blue", "h-9 w-full text-[14px] font-medium")}>
                    <span className="sr-only">Use {template.name}</span>
                    <span aria-hidden="true">Use</span>
                    <ArrowUpRight aria-hidden="true" />
                  </StartWritingLink>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-4 pt-4">
          <p className="font-serif text-[28px] leading-tight tracking-[-0.02em]">No template matches that.</p>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
            Try a template’s name, a font like Garamond or Lato, or one of the styles above.
          </p>
          <button type="button" onClick={clear} className={WHITE_PILL}>
            Show every template
          </button>
        </div>
      )}
    </div>
  )
}
