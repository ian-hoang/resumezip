"use client"

import { useEffect, useRef, useState } from "react"
import { useCheckActions } from "./CheckContext"

// How long the card stays, unless it's pointed at or has the keyboard.
const SHOWN_MS = 9000

interface DownloadedCardProps {
  /** The PDF's file name. */
  file: string
  /** Closes it. `refocus` is set when it had the keyboard, which then needs somewhere to go. */
  onClose: (refocus: boolean) => void
  /** Before Check opens, as on small screens, where the preview may be showing instead of the left bar. */
  onCheck: () => void
}

/**
 * The card that slides in after a PDF is downloaded, with a zipper closing
 * across its top (`.zip-strip` in styles/editor.css), to say the one thing
 * worth knowing about the file: it carries the resume, to be opened here
 * again. It doesn't take the focus (the editor says the download aloud), and
 * it goes by itself after a while, unless it's pointed at or has the keyboard.
 */
export default function DownloadedCard({ file, onClose, onCheck }: DownloadedCardProps) {
  const { chooseMode } = useCheckActions()
  const cardRef = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  // The latest one, so the timer below starts over only when it's left alone again.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (hovered || focused) return
    const timer = setTimeout(() => close.current(false), SHOWN_MS)
    return () => clearTimeout(timer)
  }, [hovered, focused])

  const hasFocus = () => cardRef.current?.contains(document.activeElement) ?? false

  const check = () => {
    onCheck()
    chooseMode("check")
    onClose(false)
    // The card's button is gone, so the keyboard goes to what it opened.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-mode-tab="check"]')?.focus())
  }

  return (
    <section
      ref={cardRef}
      aria-label="PDF downloaded"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
      // It slides up into place (`starting:` is CSS @starting-style).
      className="fixed inset-x-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+64px)] z-40 overflow-hidden rounded-[14px] bg-sheet shadow-[0_24px_48px_-20px_rgba(17,19,24,0.45),0_2px_6px_-2px_rgba(17,19,24,0.12)] ring-1 ring-ink/[0.06] transition-[opacity,translate] duration-500 ease-glide motion-reduce:transition-none starting:translate-y-4 starting:opacity-0 sm:left-auto sm:right-6 sm:w-[380px] xl:bottom-[96px]"
    >
      <div aria-hidden="true" className="zip-strip">
        <span className="zip-open" />
        <span className="zip-closed" />
        <span className="zip-pull" />
      </div>
      <div className="flex flex-col gap-2 px-5 pb-5 pt-4">
        <span className="label-mono text-ink-2">Downloaded</span>
        <p className="break-words text-[17px] font-medium leading-snug text-ink">{file}</p>
        <p className="text-sm leading-relaxed text-ink-2">This PDF carries your resume. Open it here on any computer to keep editing.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onClose(hasFocus())}
            className="inline-flex h-9 items-center rounded-[4px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={check}
            className="inline-flex h-9 items-center rounded-[4px] border border-rule-strong px-4 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            Check it first
          </button>
        </div>
      </div>
    </section>
  )
}
