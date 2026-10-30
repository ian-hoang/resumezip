"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { onMac, shortcut, typingIn } from "@/lib/keys"

/** How long the message stays, in milliseconds, unless it's pointed at or has the keyboard's focus. */
const UNDO_MS = 6_000

interface DeletedToastProps {
  title: string
  onUndo: () => void
  /** The time to undo is up. */
  onDone: () => void
  /** What was deleted, as a small picture before the words: a resume's page, which flies into it (flight.ts). */
  page?: ReactNode
  /** Added to the dock's class and style, to place it somewhere other than the foot of the screen's middle. */
  className?: string
  style?: CSSProperties
}

/**
 * Says a resume was deleted, or in the editor an entry, with a button to undo
 * it, at the bottom of the screen. It waits while it's pointed at or the
 * keyboard is on it, so there's time to read it, and starts its time again
 * afterwards. ⌘Z (Ctrl+Z) undoes too, while it's up. With a key per deletion,
 * each one gets its full time.
 */
export default function DeletedToast({ title, onUndo, onDone, page, className = "", style }: DeletedToastProps) {
  const [held, setHeld] = useState({ pointer: false, keyboard: false })
  const undoButton = useRef<HTMLButtonElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  const undo = useRef(onUndo)
  undo.current = onUndo
  const waiting = held.pointer || held.keyboard

  useEffect(() => {
    if (waiting) return
    const timer = setTimeout(() => done.current(), UNDO_MS)
    return () => clearTimeout(timer)
  }, [waiting])

  // ⌘Z (Ctrl+Z) undoes the delete too, except in a field, where it takes back typing as usual.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key.toLowerCase() !== "z" || event.shiftKey || event.altKey) return
      if (!(onMac() ? event.metaKey : event.ctrlKey) || typingIn(event.target)) return
      event.preventDefault()
      undo.current()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Focus that was on what's being deleted goes to Undo, rather than being lost.
  useEffect(() => {
    const focused = document.activeElement
    if (!focused || focused === document.body || focused.closest("[inert]")) undoButton.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className={`deleted-toast-dock ${className}`} style={style}>
      <div
        className="deleted-toast glass glass-clear"
        onPointerEnter={() => setHeld((held) => ({ ...held, pointer: true }))}
        onPointerLeave={() => setHeld((held) => ({ ...held, pointer: false }))}
      >
        {page && (
          <span data-toast-page="" className="toast-page" aria-hidden="true">
            {page}
          </span>
        )}
        {/* The page's live region says it aloud. */}
        <p className="min-w-0 flex-1 truncate text-sm">&ldquo;{title}&rdquo; deleted</p>
        <button
          ref={undoButton}
          type="button"
          onClick={onUndo}
          // Only focus that shows counts: a click on Delete can leave focus here unseen.
          onFocus={(event) => {
            const keyboard = event.currentTarget.matches(":focus-visible")
            setHeld((held) => ({ ...held, keyboard }))
          }}
          onBlur={() => setHeld((held) => ({ ...held, keyboard: false }))}
          aria-keyshortcuts={onMac() ? "Meta+Z" : "Control+Z"}
          className="ink-button inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full pl-3 pr-2 text-[13px] font-medium [@media(hover:none)]:pr-3"
        >
          Undo
          {/* Only a hint for a keyboard, so not on touch screens. */}
          <kbd
            aria-hidden="true"
            className="rounded-[4px] px-1 py-[2px] font-mono text-[10px] leading-none tracking-[0.04em] text-white/70 ring-1 ring-inset ring-white/28 [@media(hover:none)]:hidden"
          >
            {shortcut("Z")}
          </kbd>
        </button>
      </div>
    </div>
  )
}
