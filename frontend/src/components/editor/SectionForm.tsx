"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useResumeContext } from "@/context/ResumeContext"
import { BulletsField, Field, SectionHeading } from "./fields"
import { FIELD_SPAN, type SectionDef } from "./sections"

type Entry = { id: number; [field: string]: any }

interface SectionFormProps {
  section: SectionDef
  /** e.g. "03 / 08" */
  position: string
}

/** The form for one list section (education, experience, ...): its title and entries. */
export default function SectionForm({ section, position }: SectionFormProps) {
  const { formData, updateFormData } = useResumeContext()
  const entries: Entry[] = Array.isArray(formData[section.dataKey]) ? formData[section.dataKey] : []
  // One entry is open at a time; the rest collapse to a one-line summary.
  const [openId, setOpenId] = useState<number | null>(entries[0]?.id ?? null)

  const save = (next: Entry[]) => updateFormData(section.dataKey, next)

  const add = () => {
    const id = entries.length > 0 ? Math.max(...entries.map((entry) => entry.id)) + 1 : 1
    const blank = Object.fromEntries(section.fields.map((field) => [field.key, ""]))
    save([...entries, { ...blank, id } as Entry])
    setOpenId(id)
  }

  // Ids are renumbered so they stay 1..n, as the stored data always has been.
  const remove = (id: number) => save(entries.filter((entry) => entry.id !== id).map((entry, i) => ({ ...entry, id: i + 1 })))

  const update = (id: number, key: string, value: string) =>
    save(entries.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)))

  const title = formData.headings?.[section.headingKey] || section.title

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        position={position}
        title={title}
        onRename={(name) => updateFormData("headings", { ...formData.headings, [section.headingKey]: name })}
      />

      {entries.length === 0 && (
        <p className="border-t border-ink pt-5 text-[15px] text-ink-2">Nothing here yet.</p>
      )}

      {entries.map((entry, index) => {
        const summary = section.summary.map((key) => entry[key]?.trim()).filter(Boolean).join(", ")
        const label = <span className="label-mono text-ink-2">Entry {index + 1}</span>

        if (entry.id !== openId) {
          return (
            <section key={entry.id} className="flex items-center justify-between gap-4 border-t border-rule pt-4">
              <div className="flex min-w-0 flex-col gap-1">
                {label}
                <span className={`truncate text-[15px] ${summary ? "text-ink" : "text-ink-2"}`}>
                  {summary || "Empty entry"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(entry.id)}
                className="shrink-0 py-2.5 text-sm text-ink underline underline-offset-4"
              >
                Edit
              </button>
            </section>
          )
        }

        return (
          <section key={entry.id} className="flex flex-col gap-6 border-t border-ink pt-5">
            <div className="flex items-center justify-between">
              {label}
              <button
                type="button"
                onClick={() => remove(entry.id)}
                className="py-1.5 text-[13px] text-ink-2 transition-colors hover:text-[#b42318]"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-7 gap-y-6 sm:grid-cols-4">
              {section.fields.map((field) => {
                const Input = field.type === "bullets" ? BulletsField : Field
                return (
                  <Input
                    key={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    value={entry[field.key] ?? ""}
                    onChange={(value) => update(entry.id, field.key, value)}
                    className={FIELD_SPAN[field.size]}
                  />
                )
              })}
            </div>
          </section>
        )
      })}

      <button
        type="button"
        onClick={add}
        className="inline-flex h-10 items-center gap-2 self-start rounded-[4px] border border-rule-strong px-3.5 text-sm text-ink transition-colors hover:border-ink"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {section.addLabel}
      </button>
    </div>
  )
}
