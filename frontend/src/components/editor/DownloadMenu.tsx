"use client"

import type React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, X } from "lucide-react"
import { reducedMotion } from "./layout"

/** A way to take the resume out of resumezip other than Download PDF. */
export interface DownloadChoice {
  /** What it is, as "JSON" or "Share PDF". */
  title: string
  /** What it's for, in a few words. */
  hint: string
  onChoose: () => void
}

/**
 * What a choice says once it's pressed, in a card that drops from the ▾ as the
 * menu does: Save to Google Drive saving, then saved.
 */
export interface MenuNotice {
  /** The first line, as "Saved to Google Drive". */
  title: string
  /** Still at work: a spinner instead of the tick, and it stays until it's done. */
  working?: boolean
  /** The file it's about, as "Ada's resume.pdf". */
  file?: string
  /** What was made, as the file in Drive: `label` is shown, and `name` is what it's called aloud. */
  link?: { href: string; label: string; name: string }
}

// How long the menu takes to fade away, in milliseconds (matches duration-150).
const CLOSE_MS = 150
// How long a notice that's done stays, in milliseconds, while the pointer and keyboard are elsewhere.
const NOTICE_MS = 6000
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

interface DownloadMenuProps {
  choices: DownloadChoice[]
  /** A choice is getting its file ready, as Share PDF may after it's pressed: the ▾ spins. */
  busy?: boolean
  /** Called as the menu opens, so a choice can get its file ready before it's pressed. */
  onOpen?: () => void
  /** What a choice says once it's pressed, while the menu's closed. */
  notice?: MenuNotice | null
  /** Takes the notice away: once it's done and has been shown a while, or it's closed. */
  onNoticeClose?: () => void
}

/**
 * The ▾ beside Download PDF, and the menu of the other ways to take the
 * resume out (WAI-ARIA menu button). Arrows move through the menu, Escape and
 * Tab close it, and either way the keyboard goes back to the ▾. A choice's
 * notice shows in the same place once the menu's closed.
 */
export default function DownloadMenu({ choices, busy = false, onOpen, notice = null, onNoticeClose }: DownloadMenuProps) {
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
    onOpen?.()
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

  // Where the notice is while there's one. It stays by the ▾ as the window is resized.
  const [noticePlace, setNoticePlace] = useState<{ left: number; width: number } | null>(null)
  const noticed = notice !== null
  useEffect(() => {
    if (!noticed) return setNoticePlace(null)
    const follow = () => {
      if (button.current) setNoticePlace(placeBy(button.current))
    }
    follow()
    window.addEventListener("resize", follow)
    return () => window.removeEventListener("resize", follow)
  }, [noticed])

  // A notice that's done goes after a while, unless the pointer or the keyboard is on it.
  const [holding, setHolding] = useState(false)
  const latestNoticeClose = useRef(onNoticeClose)
  latestNoticeClose.current = onNoticeClose
  const done = noticed && !notice.working
  useEffect(() => {
    if (!done || holding) return
    const goes = window.setTimeout(() => latestNoticeClose.current?.(), NOTICE_MS)
    return () => window.clearTimeout(goes)
  }, [done, holding])
  useEffect(() => {
    if (!noticed) setHolding(false)
  }, [noticed])

  // Closed from the keyboard or with ×, the keyboard goes back to the ▾.
  const closeNotice = () => {
    button.current?.focus()
    onNoticeClose?.()
  }

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
        aria-busy={busy || undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKeyDown}
        className="inline-flex h-10 w-9 items-center justify-center rounded-r-[4px] border-l border-white/20 bg-ink text-white transition-colors hover:bg-black aria-expanded:bg-black"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        )}
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
          className={`absolute top-full z-30 mt-2 origin-top-right rounded-[4px] bg-sheet p-1.5 shadow-[0_18px_40px_-16px_rgba(17,19,24,0.3)] ring-1 ring-rule transition-[opacity,scale,translate] ease-out motion-reduce:transition-none starting:-translate-y-1 starting:scale-[0.97] starting:opacity-0 ${
            closing ? "-translate-y-1 scale-[0.97] opacity-0 duration-150" : "duration-200"
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

      {notice && noticePlace && !place && (
        // It drops in from the ▾ as the menu does. Not a live region: the editor says it aloud itself.
        <div
          role="group"
          aria-label={notice.title}
          style={{ left: noticePlace.left, width: noticePlace.width }}
          onPointerEnter={() => setHolding(true)}
          onPointerLeave={() => setHolding(false)}
          onFocus={() => setHolding(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || notice.working) return
            event.preventDefault()
            closeNotice()
          }}
          className="absolute top-full z-20 mt-2 flex items-start gap-2.5 rounded-[4px] bg-sheet py-3 pl-3.5 pr-2 shadow-[0_18px_40px_-16px_rgba(17,19,24,0.3)] ring-1 ring-rule transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none starting:-translate-y-1 starting:opacity-0"
        >
          {notice.working ? (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-ink-2" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{notice.title}</p>
            {(notice.file || notice.link) && (
              <p className="mt-0.5 flex items-baseline gap-3 text-[13px] leading-snug">
                {notice.file && <span className="min-w-0 truncate text-ink-2">{notice.file}</span>}
                {notice.link && (
                  <a
                    href={notice.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={notice.link.name}
                    className="ml-auto shrink-0 font-medium text-ink underline underline-offset-4"
                  >
                    {notice.link.label}
                  </a>
                )}
              </p>
            )}
          </div>
          {!notice.working && (
            <button
              type="button"
              aria-label="Close"
              onClick={closeNotice}
              className="-my-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-ink-2 transition-colors hover:bg-paper hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
