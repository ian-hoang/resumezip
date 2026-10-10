"use client"

import type React from "react"
import { useEffect, useId, useRef } from "react"

interface ModalProps {
  title: string
  onClose: () => void
  /** A large dialog that lays out its own content, title included (give the title id="modal-title"). */
  wide?: boolean
  children: React.ReactNode
}

/** A centred dialog of glass that closes on Escape or a click outside it. */
export default function Modal({ title, onClose, wide = false, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Its own, as another dialog can be open alongside it.
  const titleId = useId()
  // Callers pass a new onClose on every render. Reading the latest one from a
  // ref keeps the effect below to the dialog opening, so a parent re-render
  // (as when another tab saves) doesn't pull focus back to the first control.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current()
    }
    document.addEventListener("keydown", onKeyDown)
    // Start keyboard users inside the dialog, and put them back where they were once it closes.
    const opener = document.activeElement
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus()
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  // The page behind pales and blurs as it fades in, and the dialog glides
  // into place (`starting:` is CSS @starting-style). The blur belongs to the
  // backdrop that fades: under a fading parent, a blur would only show once
  // the fade had finished.
  return (
    <div
      className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-[240ms] ease-glide motion-reduce:transition-none starting:opacity-0"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return
        // The browser's own handling of the press would then move focus to the
        // page, undoing where the dialog's effects just put it: back on the
        // opener, or into a dialog that opens instead.
        event.preventDefault()
        onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={wide ? "modal-title" : titleId}
        className={`glass glass-frost rounded-panel transition-[scale,translate] duration-300 ease-glide motion-reduce:transition-none starting:translate-y-2 starting:scale-[0.97] ${
          wide ? "flex h-[min(88vh,880px)] w-full max-w-[1120px] flex-col overflow-hidden" : "w-full max-w-md p-7"
        }`}
      >
        {!wide && (
          <h2 id={titleId} className="font-serif text-[30px] leading-tight tracking-[-0.02em]">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}
