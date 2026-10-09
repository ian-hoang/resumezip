"use client"

import type React from "react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  AlignLeft,
  Award,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Flag,
  FolderKanban,
  GraduationCap,
  HandHeart,
  List,
  Plus,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { ExtraKind } from "@/lib/resumeSections"
import { reducedMotion, WIDE_SCREEN } from "./layout"
import { SECTIONS, type SectionName } from "./sections"

const ICONS: Record<SectionName, LucideIcon> = {
  Education: GraduationCap,
  Work: BriefcaseBusiness,
  Skills: Wrench,
  Projects: FolderKanban,
  Publications: BookOpen,
  Volunteership: HandHeart,
  Leadership: Flag,
  Awards: Award,
}

/** What Custom section offers: a section of the person's own, of text or of bullets. */
const CUSTOM: { kind: ExtraKind; title: string; Icon: LucideIcon }[] = [
  { kind: "text", title: "Text", Icon: AlignLeft },
  { kind: "list", title: "Bullet list", Icon: List },
]

// How long the menu takes to fade away, in milliseconds (matches duration-150).
const CLOSE_MS = 150
// The gap between the button and the menu, and the least between the menu and the window's edges.
const GAP = 8
const MARGIN = 16
// On smaller screens, where the button is in the row of tabs. On wide ones it's as wide as the button, in the left bar.
const WIDTH = 352
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
  /** As narrow as the left bar, so the optional sections are in one column rather than two. */
  narrow: boolean
}

function placeBy(button: HTMLElement): Placement {
  const box = button.getBoundingClientRect()
  // In the left bar it stays inside the bar, over the sections, rather than spreading over the form.
  const narrow = window.matchMedia(WIDE_SCREEN).matches
  const width = narrow ? box.width : Math.min(WIDTH, window.innerWidth - 2 * MARGIN)
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
  "group flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left text-sm leading-snug text-ink outline-none transition-colors duration-150 hover:bg-paper focus-visible:bg-paper"
const icon = "h-4 w-4 shrink-0 text-ink-2 transition-colors duration-150 group-hover:text-ink group-focus-visible:text-ink"

interface AddSectionMenuProps {
  /** The sections that aren't on the resume: optional ones, and any it started with that were deleted. */
  sections: readonly SectionName[]
  onAdd: (kind: ExtraKind | SectionName) => void
}

/**
 * The Add section button, and the menu it opens over the page: the sections
 * the resume doesn't have, then Custom section, which slides over to a text or a bullet list.
 * It's in the page's top layer (a portal), so the left bar's scrolling, and the
 * row of tabs on smaller screens, neither cut it off nor move for it.
 */
export default function AddSectionMenu({ sections, onAdd }: AddSectionMenuProps) {
  const menuId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const mainPanel = useRef<HTMLDivElement>(null)
  const customPanel = useRef<HTMLDivElement>(null)
  // Where the menu is while it's there, or null.
  const [place, setPlace] = useState<Placement | null>(null)
  const [closing, setClosing] = useState(false)
  // Whether Custom section's choices have slid in.
  const [custom, setCustom] = useState(false)
  // The menu's height, eased from one panel's to the other's as they slide.
  const [height, setHeight] = useState<number>()
  const timer = useRef(0)
  // Coming back from Custom section puts the keyboard back on it.
  const backToCustom = useRef(false)
  const open = place !== null && !closing

  const show = () => {
    if (!button.current) return
    window.clearTimeout(timer.current)
    setClosing(false)
    setCustom(false)
    setHeight(undefined)
    setPlace(placeBy(button.current))
  }

  // It fades away, then goes. `refocus` puts the keyboard back on the button, as Escape does.
  const close = (refocus = false) => {
    if (refocus) button.current?.focus()
    setClosing(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => {
        setPlace(null)
        setClosing(false)
      },
      reducedMotion() ? 0 : CLOSE_MS,
    )
  }
  const latestClose = useRef(close)
  latestClose.current = close

  const choose = (kind: ExtraKind | SectionName) => {
    close()
    onAdd(kind)
  }

  const back = () => {
    backToCustom.current = true
    setCustom(false)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

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

  // A click elsewhere closes it, and what was clicked keeps the focus. It
  // follows the button as the window is resized, or what it's in scrolls.
  const shown = place !== null
  useEffect(() => {
    if (!shown) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menu.current?.contains(target) || button.current?.contains(target)) return
      latestClose.current()
    }
    const follow = () => {
      if (button.current) setPlace(placeBy(button.current))
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("resize", follow)
    window.addEventListener("scroll", follow, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("resize", follow)
      window.removeEventListener("scroll", follow, true)
    }
  }, [shown])

  // Arrows, Home and End move between the panel's choices (WAI-ARIA menu
  // pattern). Escape goes back from Custom section, or closes; so does Tab.
  const onKeyDown = (event: React.KeyboardEvent) => {
    const items = [...((custom ? customPanel : mainPanel).current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const moveTo = (next: number) => {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") moveTo(index + 1)
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") moveTo(index - 1)
    else if (event.key === "Home") moveTo(0)
    else if (event.key === "End") moveTo(items.length - 1)
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === "Escape" && custom) back()
      else close(true)
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : show())}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-dashed border-rule-strong px-3 text-sm text-ink-2 transition-[color,border-color,scale] duration-150 hover:border-ink hover:text-ink active:scale-[0.98] aria-expanded:border-ink aria-expanded:text-ink motion-reduce:transition-none xl:mt-3 xl:h-10 xl:w-full"
      >
        {/* It turns into a cross while the menu is open. */}
        <Plus
          className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
          aria-hidden="true"
        />
        Add section
      </button>

      {place &&
        createPortal(
          // It fades and grows in from the button's side (`starting:` is CSS
          // @starting-style), and fades back the same way.
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label="Add section"
            onKeyDown={onKeyDown}
            style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
            className={`fixed z-50 overflow-y-auto overscroll-contain rounded-[4px] bg-sheet p-1.5 shadow-[0_18px_40px_-16px_rgba(17,19,24,0.3)] ring-1 ring-rule transition-[opacity,scale,translate] ease-out motion-reduce:transition-none starting:scale-[0.97] starting:opacity-0 ${
              place.above ? "origin-bottom-left starting:translate-y-1" : "origin-top-left starting:-translate-y-1"
            } ${closing ? `scale-[0.97] opacity-0 duration-150 ${place.above ? "translate-y-1" : "-translate-y-1"}` : "duration-200"}`}
          >
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
                          const Icon = ICONS[name]
                          return (
                            <button key={name} type="button" role="menuitem" onClick={() => choose(name)} className={item}>
                              <Icon className={icon} aria-hidden="true" />
                              {SECTIONS[name].title}
                            </button>
                          )
                        })}
                      </div>
                      <div role="separator" className="mx-1 my-1.5 h-px bg-rule" />
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
                  <div role="separator" className="mx-1 my-1.5 h-px bg-rule" />
                  {CUSTOM.map(({ kind, title, Icon }) => (
                    <button key={kind} type="button" role="menuitem" onClick={() => choose(kind)} className={item}>
                      <Icon className={icon} aria-hidden="true" />
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
