"use client"

import { useEffect, useRef } from "react"
import { useOpenResume, useResumeActions, useResumeField } from "@/context/ResumeContext"
import { extraHeading, type ExtraSection } from "@/lib/resumeSections"
import { useCheckActions, useCheckTarget } from "./CheckContext"
import DeleteSection from "./DeleteSection"
import { BulletsField, Field, pointAt, SectionHeading } from "./fields"

/** A section the person added, found by its key rather than its title, as two sections can have the same title. */
export default function ExtraSectionForm({ sectionId, onDelete }: { sectionId: string; onDelete: () => void }) {
  const { editSection } = useResumeActions()
  const { id } = useOpenResume()
  const extraSections = useResumeField("extraSections")
  const section: ExtraSection | undefined = extraSections?.[sectionId]
  const root = useRef<HTMLDivElement>(null)
  // What the checker points at in this section, while the person fixes it.
  const target = useCheckTarget()
  const { pending, claim } = useCheckActions()
  const place = target?.finding.place
  const here = place && "sectionId" in place && place.sectionId === sectionId ? place : null
  const flagAt = (field: "text" | "bullets") => (here?.kind === "extra-text" && here.field === field ? target!.finding : null)

  useEffect(() => {
    if (!target || !here || !pending(target.request)) return
    const timer = setTimeout(() => {
      if (!claim(target.request)) return
      const selector =
        here.kind === "extra-heading" ? 'button[aria-label="Rename section"]' : `[data-field="${here.field}"] [contenteditable="true"]`
      pointAt(root.current?.querySelector<HTMLElement>(selector), here.kind === "extra-text" ? here.line : undefined)
    }, 0)
    return () => clearTimeout(timer)
  }, [target, here, pending, claim])

  if (!section) return null
  const title = extraHeading(section)
  return (
    <div ref={root} className="flex flex-col gap-[22px]">
      <SectionHeading
        title={title}
        allowEmpty
        onRename={(heading) => editSection(id, sectionId, { heading })}
        flag={here?.kind === "extra-heading" ? target!.finding : null}
        end={<DeleteSection onDelete={onDelete} />}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2.5 text-[14px] text-ink-2">
          <input
            type="checkbox"
            checked={!section.leftOut}
            onChange={(event) => editSection(id, sectionId, { leftOut: !event.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Include section in the PDF
        </label>
      </div>
      {section.leftOut && <p className="text-[13px] text-ink-3">This section stays saved here and is left out of the PDF and checks.</p>}
      {section.kind === "text" && (
        <Field
          multiline
          name="text"
          label="Text"
          value={section.text}
          onChange={(text) => editSection(id, sectionId, { text })}
          flag={flagAt("text")}
          hint="Paragraph breaks are kept."
          // As tall as eight and a half lines.
          boxHeight="min-h-[238px]"
        />
      )}
      {section.kind === "list" && (
        <BulletsField
          label="Bullet points"
          name="bullets"
          value={section.bullets}
          onChange={(bullets) => editSection(id, sectionId, { bullets })}
          flag={flagAt("bullets")}
        />
      )}
    </div>
  )
}
