"use client"

import type React from "react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import type { ExtraKind } from "@/lib/resumeSections"
import { WIDE_SCREEN } from "./layout"
import { EXTRA_ICONS, SECTION_ICONS } from "./sectionIcons"
import { SECTIONS, type SectionName } from "./sections"
import { useMenu } from "./useMenu"

/** What Custom section offers: a section of the person's own, of text or of bullets. */
const CUSTOM: { kind: ExtraKind; title: string }[] = [
  { kind: "text", title: "Text" },
  { kind: "list", title: "Bullet list" },
]

// How long the menu takes to fade away, in milliseconds (matches duration-150).
const CLOSE_MS = 150
// The gap between the button and the menu, and the least between the menu and the window's edges.
const GAP = 8
const MARGIN = 16
// On smaller screens, where the button is in the row of tabs. On wide ones the button is an icon in the rail, and the menu is RAIL_WIDTH.
const WIDTH = 352
const RAIL_WIDTH = 248
// About the menu's height with every choice in it: above the button if it fits there.
const TALL = 240

/** Where the menu goes, in the window: by the button, and inside the window's edges. */
interface Placement {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
  above: boolean
  /** By the rail on wide screens, so the sections to add are in one column rather than two. */
  narrow: boolean
}

function placeBy(button: HTMLElement): Placement {
  const box = button.getBoundingClientRect()
  // By the rail it opens out over the form, one column wide, from the button's left edge.
  const narrow = window.matchMedia(WIDE_SCREEN).matches
  const width = narrow ? RAIL_WIDTH : Math.min(WIDTH, window.innerWidth - 2 * MARGIN)
  const left = narrow ? box.left : Math.min(Math.max(MARGIN, box.left), window.innerWidth - MARGIN - width)
  const below = window.innerHeight - box.bottom
  // Above the button where it fits, as under the left bar's sections; below
  // it in the row of tabs along the top on smaller screens.
  const above = box.top - GAP - MARGIN >= TALL || box.top > below
  return above
    ? { left, width, bottom: window.innerHeight - box.top + GAP, maxHeight: box.top - GAP - MARGIN, above, narrow }
    : { left, width, top: box.bottom + GAP, maxHeight: below - GAP - MARGIN, above, narrow }
}

const item =
  "group flex w-full items-center gap-2.5 rounded-row px-3 py-2 text-left text-sm leading-snug text-ink outline-none transition-colors duration-150 hover:bg-ink/[0.05] focus-visible:bg-ink/[0.05]"
const icon = "h-4 w-4 shrink-0 text-ink-2 transition-colors duration-150 group-hover:text-ink group-focus-visible:text-ink"

interface AddSectionMenuProps {
  /** The sections that aren't on the resume: optional ones, and any it started with that were deleted. */
  sections: readonly SectionName[]
  onAdd: (kind: ExtraKind | SectionName) => void
}

/**
 * The Add section button, and the menu it opens over the page: the sections
 * the resume doesn't have, then Custom section, which slides over to a text or a bullet list.
 * It's a portal to document.body, fixed above the page, so the left bar's scrolling,
 * and the row of tabs on smaller screens, neither cut it off nor move for it.
 */
export default function AddSectionMenu({ sections, onAdd }: AddSectionMenuProps) {
  const menuId = useId()
  const { button, menu, place, closing, open, show, close, onMenuKeyDown } = useMenu(placeBy, {
    closeMs: CLOSE_MS,
    followScroll: true,
    sideways: true,
  })
  const mainPanel = useRef<HTMLDivElement>(null)
  const customPanel = useRef<HTMLDivElement>(null)
  // Whether Custom section's choices have slid in.
  const [custom, setCustom] = useState(false)
  // The menu's height, eased from one panel's to the other's as they slide.
  const [height, setHeight] = useState<number>()
  // Coming back from Custom section puts the keyboard back on it.
  const backToCustom = useRef(false)

  const openMenu = () => {
    setCustom(false)
    setHeight(undefined)
    show()
  }

  const choose = (kind: ExtraKind | SectionName) => {
    close()
    onAdd(kind)
  }

  const back = () => {
    backToCustom.current = true
    setCustom(false)
  }

  // The first choice of the panel showing gets the keyboard, so arrows move through them.
  useEffect(() => {
    if (!open) return
    const panel = (custom ? customPanel : mainPanel).current
    const target = backToCustom.current ? panel?.querySelector<HTMLElement>("[data-custom]") : null
    backToCustom.current = false
    ;(target ?? panel?.querySelector<HTMLElement>('[role="menuitem"]'))?.focus({ preventScroll: true })
  }, [open, custom])

  // Measured before it's drawn, so the menu starts at its first panel's height.
  useLayoutEffect(() => {
    if (!place) return
    const panel = (custom ? customPanel : mainPanel).current
    if (panel) setHeight(panel.offsetHeight)
  }, [place, custom])

  // The arrows, Home and End move between the choices of the panel showing.
  // Escape goes back from Custom section, or closes; so does Tab.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && custom) {
      event.preventDefault()
      event.stopPropagation()
      back()
    } else onMenuKeyDown(event, (custom ? customPanel : mainPanel).current)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : openMenu())}
        // In the rail on wide screens, an icon as big as the sections'; in the row of tabs, a pill.
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[15px] font-medium tracking-[-0.01em] text-accent transition-[background-color,scale] duration-150 hover:bg-accent/[0.06] active:scale-[0.98] aria-expanded:bg-accent/[0.06] motion-reduce:transition-none xl:mt-[6px] xl:h-10 xl:w-10 xl:rounded-[12px] xl:px-0"
      >
        {/* It turns into a cross while the menu is open. */}
        <Plus
          className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none xl:mx-px ${open ? "rotate-45" : ""}`}
          aria-hidden="true"
        />
        <span className="xl:sr-only">Add section</span>
      </button>

      {place &&
        createPortal(
          // It grows in from the button's side (`starting:` is CSS @starting-style),
          // solid, and only what's in it fades in, as see-through glass stops
          // blurring. Closing, it fades as a nearly solid sheet for the same reason.
          // The glass is on the menu, which doesn't scroll, so it stays behind
          // what scrolls inside it.
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label="Add section"
            onKeyDown={onKeyDown}
            style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
            className={`glass glass-frost fixed z-50 flex flex-col rounded-panel transition-[opacity,scale,translate] ease-out motion-reduce:transition-none starting:scale-[0.97] [&>*]:animate-[panel-contents_220ms_ease-out] motion-reduce:[&>*]:animate-none ${
              place.above ? "origin-bottom-left starting:translate-y-1" : "origin-top-left starting:-translate-y-1"
            } ${
              closing
                ? `scale-[0.97] opacity-0 duration-150 [--glass-fill:linear-gradient(180deg,rgb(255_255_255/0.96),rgb(255_255_255/0.92))] ${place.above ? "translate-y-1" : "-translate-y-1"}`
                : "duration-200"
            }`}
          >
            <div style={{ maxHeight: place.maxHeight }} className="overflow-y-auto overscroll-contain p-1.5">
              <div style={{ height }} className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none">
                <div
                  className={`flex w-[200%] items-start transition-transform duration-300 ease-out motion-reduce:transition-none ${custom ? "-translate-x-1/2" : ""}`}
                >
                  <div ref={mainPanel} inert={custom} className="w-1/2">
                    {sections.length > 0 && (
                      <>
                        {/* Two columns where there's room: the first as wide as its words, so the second has room for "Awards & Certifications". */}
                        <div className={`grid gap-0.5 ${place.narrow ? "" : "grid-cols-[auto_1fr]"}`}>
                          {sections.map((name) => {
                            const Icon = SECTION_ICONS[name]
                            return (
                              <button key={name} type="button" role="menuitem" onClick={() => choose(name)} className={item}>
                                <Icon className={icon} aria-hidden="true" />
                                {SECTIONS[name].title}
                              </button>
                            )
                          })}
                        </div>
                        <div role="separator" className="mx-3 my-1.5 h-px bg-ink/10" />
                      </>
                    )}
                    <button type="button" role="menuitem" data-custom onClick={() => setCustom(true)} className={item}>
                      <Plus className={icon} aria-hidden="true" />
                      Custom section
                      <ChevronRight className={`${icon} ml-auto`} aria-hidden="true" />
                    </button>
                  </div>

                  <div ref={customPanel} inert={!custom} className="w-1/2">
                    <button type="button" role="menuitem" onClick={back} className={`${item} text-ink-2`}>
                      <ChevronLeft className={icon} aria-hidden="true" />
                      Back
                    </button>
                    <div role="separator" className="mx-3 my-1.5 h-px bg-ink/10" />
                    {CUSTOM.map(({ kind, title }) => {
                      const Icon = EXTRA_ICONS[kind]
                      return (
                        <button key={kind} type="button" role="menuitem" onClick={() => choose(kind)} className={item}>
                          <Icon className={icon} aria-hidden="true" />
                          {title}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
