"use client"

import { useEffect, useRef, useState } from "react"

/** How long the message stays, in milliseconds, unless it's pointed at or has the keyboard's focus. */
export const UNDO_MS = 6_000

interface DeletedToastProps {
  title: string
  onUndo: () => void
  /** The time to undo is up. */
  onDone: () => void
}

/**
 * Shows a resume was deleted, with a button to undo it, at the bottom of the
 * screen. It waits while it's pointed at or the keyboard is on it, so there's
 * time to read it, and starts its time again afterwards. Give it a key per
 * deletion, so each gets its full time.
 */
export default function DeletedToast({ title, onUndo, onDone }: DeletedToastProps) {
  const [held, setHeld] = useState({ pointer: false, keyboard: false })
  const undoButton = useRef<HTMLButtonElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  const waiting = held.pointer || held.keyboard

  useEffect(() => {
    if (waiting) return
    const timer = setTimeout(() => done.current(), UNDO_MS)
    return () => clearTimeout(timer)
  }, [waiting])

  // Focus that was on what's being deleted goes to Undo, rather than being lost.
  useEffect(() => {
    const focused = document.activeElement
    if (!focused || focused === document.body || focused.closest("[inert]")) undoButton.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="deleted-toast-dock">
      <div
        className="deleted-toast glass glass-clear"
        onPointerEnter={() => setHeld((held) => ({ ...held, pointer: true }))}
        onPointerLeave={() => setHeld((held) => ({ ...held, pointer: false }))}
      >
        <span className="paper-ball" aria-hidden="true" />
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
          className="ink-button h-9 shrink-0 rounded-full px-4 text-sm font-medium"
        >
          Undo
        </button>
      </div>
    </div>
  )
}
