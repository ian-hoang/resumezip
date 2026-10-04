"use client"

import type React from "react"
import { useEffect, useRef } from "react"

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

/** A centred dialog that closes on Escape or a click outside it. */
export default function Modal({ title, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    // Start keyboard users inside the dialog.
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus()
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-md rounded-[4px] bg-paper p-7"
      >
        <h2 id="modal-title" className="font-serif text-[28px] leading-tight tracking-[-0.02em]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
