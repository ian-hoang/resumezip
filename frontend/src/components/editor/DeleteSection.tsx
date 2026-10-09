"use client"

import { useEffect, useRef, useState } from "react"
import { RowAction, TrashIcon } from "@/components/dashboard/RowActions"

/**
 * A section's Delete button, a bin like an entry's, which asks first. Cancel,
 * or Escape, puts the question away and the focus back on the button.
 */
export default function DeleteSection({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirming) cancel.current?.focus()
  }, [confirming])

  const keep = () => {
    setConfirming(false)
    // The button is back once the question is gone.
    requestAnimationFrame(() => button.current?.focus())
  }

  // The question fades in where the button was (`starting:` is CSS @starting-style), as tall as it.
  return confirming ? (
    <span
      className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") keep()
      }}
    >
      <span className="text-sm text-ink">Delete this section?</span>
      <button ref={cancel} type="button" onClick={keep} className="py-2 text-sm text-ink-2 transition-colors hover:text-ink">
        Cancel
      </button>
      <button type="button" onClick={onDelete} className="py-2 text-sm font-medium text-alert underline-offset-4 hover:underline">
        Delete section
      </button>
    </span>
  ) : (
    <RowAction ref={button} label="Delete section" danger onClick={() => setConfirming(true)} tipBelow tipAtEnd>
      <TrashIcon />
    </RowAction>
  )
}
