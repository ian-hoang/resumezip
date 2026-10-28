"use client"

import { memo, useEffect, useRef } from "react"
import { useOpenResume, useResumeField } from "@/context/ResumeContext"
import { useCheckActions, useCheckTarget, usePointer } from "./CheckContext"
import { Field, pointAt, SectionHeading } from "./fields"
import { FIELD_GRID, FIELD_SPAN, PROFILE_FIELDS } from "./sections"

function ProfileForm() {
  const { update } = useOpenResume()
  const profile = useResumeField("profileSection") ?? {}
  const form = useRef<HTMLElement>(null)

  // What the checker points at here, while the person fixes it.
  const target = useCheckTarget()
  const { pending, claim } = useCheckActions()
  const flagged = target?.finding.place.kind === "profile" ? target.finding.place.field : null

  // When the person chooses a finding here, or picks words on the preview, move to its field, just once.
  const pointer = usePointer()
  useEffect(() => {
    const place = pointer?.place
    if (!pointer || place?.kind !== "profile" || !pending(pointer.request)) return
    const timer = setTimeout(() => {
      if (!claim(pointer.request)) return
      const field = form.current?.querySelector<HTMLElement>(`[data-field="${place.field}"] :is(input, [contenteditable="true"])`)
      pointAt(field, undefined, field, pointer.words)
    })
    return () => clearTimeout(timer)
  }, [pointer, pending, claim])

  return (
    <div className="@container flex flex-col gap-[22px]">
      <SectionHeading title="Profile" />
      <section ref={form} className={FIELD_GRID}>
        {PROFILE_FIELDS.map((field) => (
          <Field
            key={field.key}
            name={field.key}
            label={field.label}
            placeholder={field.placeholder}
            type={field.inputType}
            autoComplete={field.autoComplete}
            web={field.web}
            multiline={field.multiline}
            value={profile[field.key] ?? ""}
            onChange={(value) => update("profileSection", { ...profile, [field.key]: value })}
            className={FIELD_SPAN[field.size]}
            flag={flagged === field.key ? target!.finding : null}
          />
        ))}
      </section>
    </div>
  )
}

// Re-renders with the profile and the finding being fixed, not with a new preview.
export default memo(ProfileForm)
