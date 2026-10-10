"use client"

import type React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { reducedMotion } from "./layout"

/** A way to take the resume out of resumezip other than the PDF. */
export interface DownloadChoice {
  /** What it is, as "JSON". */
  title: string
  /** What it's for, in a few words. */
  hint: string
  onChoose: () => void
}

// How long the menu takes to fade away, in milliseconds (matches duration-150).
const CLOSE_MS = 150
// The least between the menu and the window's edges.
const MARGIN = 16
const WIDTH = 288

/**
 * Where the menu goes, from the left of what it's in: under the ▾, lined up
 * with its right edge, unless that would go past the window's left edge, as
 * where the header wraps on phones.
 */
function placeBy(button: HTMLElement): { left: number; width: number } {
  const box = button.getBoundingClientRect()
  const from = button.parentElement!.getBoundingClientRect().left
  const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN)
  const left = Math.min(Math.max(MARGIN, box.right - width), window.innerWidth - MARGIN - width)
  return { left: left - from, width }
}

const item =
  "flex w-full flex-col gap-0.5 rounded-[3px] px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-paper focus-visible:bg-paper"

/**
 * The ▾ beside Download PDF, and the menu of the other ways to download it
 * (WAI-ARIA menu button). Arrows move through the menu, Escape and Tab close
 * it, and either way the keyboard goes back to the ▾. On wide screens the
 * button is the pill in the stage's bottom corner, so the menu opens upward.
 */
export default function DownloadMenu({ choices }: { choices: DownloadChoice[] }) {
  const menuId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // Where the menu is while it's there, or null.
  const [place, setPlace] = useState<{ left: number; width: number } | null>(null)
  const [closing, setClosing] = useState(false)
  const timer = useRef(0)
  // Opened with the up arrow, which starts on the last choice.
  const fromEnd = useRef(false)
  const open = place !== null && !closing

  const show = (last = false) => {
    if (!button.current) return
    window.clearTimeout(timer.current)
    fromEnd.current = last
    setClosing(false)
    setPlace(placeBy(button.current))
  }

  // It fades away, then goes. `refocus` puts the keyboard back on the ▾.
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

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // The first choice, or the last, gets the keyboard, so arrows move through them.
  useEffect(() => {
    if (!open) return
    const items = menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
    items?.[fromEnd.current ? items.length - 1 : 0]?.focus({ preventScroll: true })
  }, [open])

  // A click elsewhere closes it, and what was clicked keeps the focus. It
  // stays by the ▾ as the window is resized.
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
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("resize", follow)
    }
  }, [shown])

  const onButtonKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    show(event.key === "ArrowUp")
  }

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const moveTo = (next: number) => {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
    if (event.key === "ArrowDown") moveTo(index + 1)
    else if (event.key === "ArrowUp") moveTo(index - 1)
    else if (event.key === "Home") moveTo(0)
    else if (event.key === "End") moveTo(items.length - 1)
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
  }

  return (
    <div className="relative flex">
      <button
        ref={button}
        type="button"
        aria-label="More formats"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKeyDown}
        className="inline-flex h-10 w-9 items-center justify-center rounded-r-[4px] border-l border-white/20 bg-ink text-white transition-colors hover:bg-black aria-expanded:bg-black xl:h-[52px] xl:w-12 xl:rounded-r-full xl:border-white/15 xl:pr-1"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {place && (
        // It fades and drops in from the ▾ (`starting:` is CSS @starting-style), and fades back the same way.
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label="More formats"
          onKeyDown={onMenuKeyDown}
          style={{ left: place.left, width: place.width }}
          className={`absolute top-full z-30 mt-2 origin-top-right rounded-[4px] bg-sheet p-1.5 shadow-[0_18px_40px_-16px_rgba(17,19,24,0.3)] ring-1 ring-rule transition-[opacity,scale,translate] ease-out motion-reduce:transition-none starting:-translate-y-1 starting:scale-[0.97] starting:opacity-0 xl:top-auto xl:bottom-full xl:mb-3 xl:mt-0 xl:origin-bottom-right xl:rounded-[14px] xl:starting:translate-y-1 ${
            closing ? "-translate-y-1 scale-[0.97] opacity-0 duration-150 xl:translate-y-1" : "duration-200"
          }`}
        >
          {choices.map(({ title, hint, onChoose }) => (
            <button
              key={title}
              type="button"
              role="menuitem"
              onClick={() => {
                close(true)
                onChoose()
              }}
              className={item}
            >
              <span className="text-sm font-medium text-ink">{title}</span>
              <span className="text-[13px] leading-snug text-ink-2">{hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
