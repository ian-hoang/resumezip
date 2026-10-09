"use client"

import { useEffect, useRef, useState } from "react"
import { useResumeContext } from "@/context/ResumeContext"

/**
 * After the dashboard replaces resume `id` with a PDF of it, says so, with a
 * button to undo that (the PDF can be an older copy, picked by mistake). Shows
 * nothing otherwise.
 */
export default function Replaced({ id, className = "" }: { id: string; className?: string }) {
  const { replaced, undoReplace } = useResumeContext()
  const [undone, setUndone] = useState(false)
  const done = useRef<HTMLParagraphElement>(null)

  // The Undo button is gone once it's pressed, so focus moves to what it did, which is read out.
  useEffect(() => {
    if (undone) done.current?.focus()
  }, [undone])

  if (!undone && replaced?.id !== id) return null
  return (
    <div className={`flex flex-wrap items-baseline gap-x-6 gap-y-2 ${className}`}>
      <span className="label-mono shrink-0 text-accent">{undone ? "Undone" : "Replaced"}</span>
      {undone ? (
        <p ref={done} tabIndex={-1} className="min-w-0 flex-[1_1_280px] text-sm leading-relaxed text-ink focus:outline-none">
          This resume is back to the copy that was in this browser.
        </p>
      ) : (
        <>
          <p className="min-w-0 flex-[1_1_280px] text-sm leading-relaxed text-ink">
            This resume now has what&apos;s in the PDF you opened.
          </p>
          <button
            type="button"
            onClick={() => {
              undoReplace()
              setUndone(true)
            }}
            className="inline-flex shrink-0 items-center text-sm font-medium text-ink underline underline-offset-4"
          >
            Undo
          </button>
        </>
      )}
    </div>
  )
}
