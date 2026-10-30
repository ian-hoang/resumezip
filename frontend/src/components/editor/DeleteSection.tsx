"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useOpenResume } from "@/context/ResumeContext"
import { RowAction, TrashIcon } from "@/components/dashboard/RowActions"
import { extrasOf, resolveSections, sectionTitles, type SectionRef } from "@/lib/resumeSections"
import { strikeOnPreview } from "./penStrike"

// How long the bin stays armed before it backs out on its own (the line along its foot, .arm-timer in globals.css).
const ARMED_MS = 4000

interface DeleteSectionProps {
  section: SectionRef
  /** What goes with it, as the armed bin's name says: "Experience and its 2 entries". */
  what: string
  /** Whether it's armed, which the section shows too: what's under its title fades. */
  asking: boolean
  onAsk: (asking: boolean) => void
  onDelete: () => void
}

/**
 * A section's Delete button, a bin like an entry's, which asks first with
 * one word in the form: the first click arms it, black with its lid up and
 * "Confirm" under it, and strikes the section's lines out on the preview, so
 * the page says what would go; a second click deletes. A click anywhere else, Escape, or a few seconds
 * back out, and the pen lifts off the page.
 */
export default function DeleteSection({ section, what, asking, onAsk, onDelete }: DeleteSectionProps) {
  const { read } = useOpenResume()
  const deleting = useRef(false)
  const button = useRef<HTMLButtonElement>(null)
  // The next section's bin shows where the one deleted was, under the pointer: it doesn't light up, or show its tip,
  // until the pointer moves.
  const [still, setStill] = useState(true)
  useEffect(() => {
    const moved = () => setStill(false)
    window.addEventListener("pointermove", moved, { once: true })
    return () => window.removeEventListener("pointermove", moved)
  }, [])

  useEffect(() => {
    if (!asking) return
    const resume = read()
    const order = resume ? resolveSections(resume) : []
    const titles = resume ? [...sectionTitles(order, resume.headings, extrasOf(resume)).values()] : []
    const lift = strikeOnPreview(titles, order.indexOf(section))
    const away = (event: PointerEvent) => {
      if (!(event.target instanceof Node && button.current?.contains(event.target))) onAsk(false)
    }
    document.addEventListener("pointerdown", away, true)
    const timer = setTimeout(() => onAsk(false), ARMED_MS)
    return () => {
      document.removeEventListener("pointerdown", away, true)
      clearTimeout(timer)
      // Deleted, the struck lines stay on the page until the preview without them replaces it.
      if (!deleting.current) lift?.()
    }
  }, [asking, read, section, onAsk])

  const click = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!asking) return onAsk(true)
    // A double-click's second click doesn't delete: only a click of its own (or Enter) does.
    if (event.detail > 1) return
    deleting.current = true
    onDelete()
  }

  return (
    <span
      className="contents"
      onKeyDown={(event) => {
        if (event.key === "Escape" && asking) onAsk(false)
      }}
    >
      <RowAction
        ref={button}
        label={asking ? `Delete ${what}` : "Delete section"}
        tip={asking ? "Confirm" : undefined}
        danger
        onClick={click}
        tipBelow
        // Armed, its short tip sits centred under it; the longer "Delete section" keeps to the form's edge.
        tipAtEnd={!asking}
        className={asking ? "is-armed" : still ? "is-still" : ""}
      >
        <TrashIcon />
        {asking && <i aria-hidden="true" className="arm-timer" />}
      </RowAction>
      {asking && (
        <span role="status" className="sr-only">
          Press again to delete {what}.
        </span>
      )}
    </span>
  )
}

/** What a section's Delete takes with it, as its armed name says. */
export function deleteWhat(heading: string, entries = 0) {
  // An added section's title can be left empty.
  const title = heading.trim() || "this section"
  return entries > 0 ? `${title} and its ${entries} ${entries === 1 ? "entry" : "entries"}` : title
}

/** What's under a section's title while its Delete is armed: faded (the section makes it inert), as the page shows it struck out. */
export const asked = (asking: boolean) => `transition-opacity duration-200 motion-reduce:transition-none ${asking ? "opacity-50" : ""}`
