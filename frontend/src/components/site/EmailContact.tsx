"use client"

import type React from "react"
import { useRef, useState } from "react"
import { Check, Copy, Mail } from "lucide-react"
import { CONTACT_EMAIL } from "@/lib/contact"
import { SMALL_PILL } from "@/components/pills"

// How long Copy says Copied, in milliseconds.
const COPIED_MS = 2000

/**
 * The address to write to, as a pill that opens the visitor's email app, and
 * a button that copies it, for those who write from Gmail or Outlook in a
 * browser, where a mailto: link opens nothing. A mouse over the pill sees a
 * blue Email bubble in place of the pointer, saying what a click does; a
 * finger, with no pointer to follow, just opens the email app.
 */
export default function EmailContact() {
  const bubble = useRef<HTMLSpanElement>(null)
  const [over, setOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)

  const follow = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || !bubble.current) return
    const box = event.currentTarget.getBoundingClientRect()
    bubble.current.style.translate = `${event.clientX - box.left}px ${event.clientY - box.top}px`
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
    } catch {
      // Some browsers only allow it over https or with permission; the address is still there to select.
      return
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return
          follow(event)
          setOver(true)
        }}
        onPointerMove={follow}
        onPointerLeave={() => setOver(false)}
        className={`relative inline-flex h-12 items-center rounded-full bg-sheet px-6 text-[17px] text-ink ring-1 ring-ink/10 transition-shadow hover:ring-ink/25 ${
          over ? "cursor-none" : ""
        }`}
      >
        {CONTACT_EMAIL}
        {/* Centred on the pointer, above it; it fades and grows in as the pointer arrives. */}
        <span
          ref={bubble}
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 z-10 -ml-[46px] -mt-[22px] inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgb(46_91_230/0.7)] transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none ${
            over ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        >
          <Mail className="h-4 w-4" />
          Email
        </span>
      </a>
      <button type="button" onClick={copy} className={SMALL_PILL}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? "Copied" : "Copy email"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Email address copied" : ""}
      </span>
    </div>
  )
}
