"use client"

import type React from "react"
import { createContext, useContext, useEffect, useId, useRef, useState } from "react"
import { reducedMotion } from "@/components/editor/layout"

interface ModalProps {
  title: string
  onClose: () => void
  /** A large dialog that lays out its own content, title included (give the title id="modal-title"). */
  wide?: boolean
  children: React.ReactNode
}

// How long a dialog takes to fade away, in milliseconds (matches its closing classes below). It eases
// in and out rather than gliding: a fast start would have it all but gone in the first frames.
const CLOSE_MS = 260

const CloseContext = createContext<() => void>(() => {})

/**
 * Closes the dialog it's in the way Escape does: it fades away, then the
 * dialog's onClose is called. For a Cancel button, so it doesn't vanish at once.
 */
export const useModalClose = () => useContext(CloseContext)

// What Tab can reach inside a dialog, before leaving out what's hidden or has tabindex="-1".
const TABBABLE = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]"

/** A centred dialog of glass that closes on Escape or a click outside it, and keeps Tab inside it while it's open. */
export default function Modal({ title, onClose, wide = false, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Its own, as another dialog can be open alongside it.
  const titleId = useId()
  // Callers pass a new onClose on every render. Reading the latest one from a
  // ref keeps the effect below to the dialog opening, so a parent re-render
  // (as when another tab saves) doesn't pull focus back to the first control.
  const latestClose = useRef(onClose)
  latestClose.current = onClose
  // Fading away, after which onClose is called.
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const close = useRef(() => {
    if (closingRef.current) return
    closingRef.current = true
    if (reducedMotion()) return latestClose.current()
    setClosing(true)
    setTimeout(() => latestClose.current(), CLOSE_MS)
  })

  useEffect(() => {
    // Tab goes round the dialog's controls, from the last back to the first,
    // and Shift+Tab the other way. It's moved here rather than left to the
    // browser, as Safari's own Tab skips buttons unless set not to, and would
    // leave the dialog. Only the dialog on top does this: the import review
    // stays open under the question it asks before closing.
    const keepTabInside = (event: KeyboardEvent) => {
      const panel = panelRef.current
      const open = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (!panel || open[open.length - 1] !== panel) return
      // A group of radio buttons is one stop, at the one that's chosen.
      const tabbable = [...panel.querySelectorAll<HTMLElement>(TABBABLE)].filter(
        (element) =>
          element.tabIndex >= 0 &&
          element.getClientRects().length > 0 &&
          !(element instanceof HTMLInputElement && element.type === "radio" && !element.checked),
      )
      if (tabbable.length === 0) return
      event.preventDefault()
      const active = document.activeElement
      const at = tabbable.findIndex((element) => element === active)
      if (at >= 0) {
        tabbable[(at + (event.shiftKey ? -1 : 1) + tabbable.length) % tabbable.length].focus()
        return
      }
      // From something Tab doesn't stop at, as a section scrolled to, it carries on from there.
      // Outside the dialog altogether, Tab goes to its first control and Shift+Tab to its last.
      const after =
        active && panel.contains(active)
          ? tabbable.findIndex((element) => active.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
          : -1
      const before = after < 0 ? tabbable.length - 1 : after - 1
      tabbable[event.shiftKey ? (before + tabbable.length) % tabbable.length : Math.max(after, 0)].focus()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current()
      else if (event.key === "Tab") keepTabInside(event)
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
      inert={closing}
      className={`dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity motion-reduce:transition-none starting:opacity-0 ${
        closing ? "opacity-0 duration-[260ms] ease-in-out" : "duration-[240ms] ease-glide"
      }`}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return
        // The browser's own handling of the press would then move focus to the
        // page, undoing where the dialog's effects just put it: back on the
        // opener, or into a dialog that opens instead.
        event.preventDefault()
        close.current()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={wide ? "modal-title" : titleId}
        className={`glass glass-frost rounded-panel transition-[scale,translate] motion-reduce:transition-none starting:translate-y-2 starting:scale-[0.97] ${
          closing ? "translate-y-2 scale-[0.97] duration-[260ms] ease-in-out" : "duration-300 ease-glide"
        } ${wide ? "flex h-[min(88vh,880px)] w-full max-w-[1120px] flex-col overflow-hidden" : "w-full max-w-md p-7"}`}
      >
        {!wide && (
          <h2 id={titleId} className="font-serif text-[30px] leading-tight tracking-[-0.02em]">
            {title}
          </h2>
        )}
        <CloseContext.Provider value={close.current}>{children}</CloseContext.Provider>
      </div>
    </div>
  )
}
