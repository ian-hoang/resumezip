"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { Field, SectionHeading } from "./fields"
import { FIELD_SPAN, PROFILE_FIELDS } from "./sections"

export default function ProfileForm({ position }: { position: string }) {
  const { formData, updateFormData } = useResumeContext()
  const profile = formData.profileSection ?? {}

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading position={position} title="Profile" />
      <section className="grid grid-cols-2 gap-x-7 gap-y-6 border-t border-ink pt-6 sm:grid-cols-4">
        {PROFILE_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            type={field.inputType}
            value={profile[field.key] ?? ""}
            onChange={(value) => updateFormData("profileSection", { ...profile, [field.key]: value })}
            className={FIELD_SPAN[field.size]}
          />
        ))}
      </section>
    </div>
  )
}
