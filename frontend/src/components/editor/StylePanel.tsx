"use client"

import { useId } from "react"
import FineTune from "@/components/editor/FineTune"

/**
 * The left bar's Style mode: Fine-tune. The template is chosen from the
 * header's Template button, on every screen. On wide screens this is in the
 * left panel beside the form; narrower, it takes the form's place.
 */
export default function StylePanel() {
  const tuneId = useId()

  return (
    <section aria-label="Style" className="flex flex-col px-2 pb-5 pt-4 sm:px-3 xl:p-0">
      <section aria-labelledby={tuneId} className="mx-1 px-2 xl:mx-0 xl:px-0">
        {/* On wide screens the panel's title, Style, is over it. */}
        <h2 id={tuneId} className="font-serif text-[22px] leading-tight tracking-[-0.01em] text-ink xl:sr-only">
          Fine-tune
        </h2>
        <div className="mt-4 xl:mt-0">
          <FineTune />
        </div>
      </section>
    </section>
  )
}
