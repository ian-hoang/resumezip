"use client"

import { memo, useEffect, useRef } from "react"
import { useOpenResume, useResumeField } from "@/context/ResumeContext"
import { useCheckActions, useCheckTarget } from "./CheckContext"
import { Field, SectionHeading } from "./fields"
import { FIELD_SPAN, PROFILE_FIELDS } from "./sections"

function ProfileForm({ position }: { position: string }) {
  const { update } = useOpenResume()
  const profile = useResumeField("profileSection") ?? {}
  const form = useRef<HTMLElement>(null)

  // What the checker points at here, while the person fixes it.
  const target = useCheckTarget()
  const { pending, claim } = useCheckActions()
  const flagged = target?.finding.place.kind === "profile" ? target.finding.place.field : null

  // When the person chooses a finding here, move to its field, just once.
  useEffect(() => {
    const place = target?.finding.place
    if (!target || place?.kind !== "profile" || !pending(target.request)) return
    const timer = setTimeout(() => {
      if (!claim(target.request)) return
      const input = form.current?.querySelector<HTMLElement>(`[data-field="${place.field}"] :is(input, textarea)`)
      input?.focus({ preventScroll: true })
      input?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
    })
    return () => clearTimeout(timer)
  }, [target, pending, claim])

  return (
    <div className="@container flex flex-col gap-8">
      <SectionHeading position={position} title="Profile" />
      <section ref={form} className="grid grid-cols-2 gap-x-7 gap-y-6 border-t border-ink pt-6 @lg:grid-cols-4">
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
