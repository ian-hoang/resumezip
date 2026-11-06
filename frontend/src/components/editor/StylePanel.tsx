"use client"

import { useId } from "react"
import FineTune from "@/components/editor/FineTune"
import TemplatePicker from "@/components/editor/TemplatePicker"
import { useOpenResume, useResumeField } from "@/context/ResumeContext"

/**
 * The left bar's Style mode: Fine-tune. On wide screens this is in the left
 * panel beside the form, and the template is chosen from the header's Template
 * button. Narrower, it takes the form's place, with the Template button at its
 * top: the header keeps to one row, with only the resume's name and Download PDF.
 */
export default function StylePanel() {
  const tuneId = useId()
  const template = useResumeField("selectedTemplate")
  const { update } = useOpenResume()

  return (
    <section aria-label="Style" className="flex flex-col px-2 pb-5 pt-4 sm:px-3 xl:p-0">
      <div className="mx-1 mb-6 flex flex-col items-start gap-2.5 px-2 xl:hidden">
        <span className="label-mono text-ink-2">Template</span>
        <TemplatePicker value={template} onChange={(next) => update("selectedTemplate", next)} centred />
      </div>
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
