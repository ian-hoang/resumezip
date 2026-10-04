"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { TEMPLATES, templateById, type TemplateId } from "@/lib/templates"

interface TemplatePickerProps {
  value: unknown
  onChange: (template: TemplateId) => void
}

/** A button showing the current template that opens a gallery of all of them. */
export default function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = templateById(value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="inline-flex h-10 items-center gap-2.5 rounded-[4px] border border-rule-strong pl-3.5 pr-3 text-sm text-ink transition-colors hover:border-ink"
      >
        <span className="label-mono text-ink-2">Template</span>
        {current.name}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a template"
          className="absolute right-0 top-12 z-30 w-[min(560px,calc(100vw-2.5rem))] rounded-[4px] bg-paper p-5 shadow-[0_18px_40px_-16px_rgba(17,19,24,0.3)] ring-1 ring-rule"
        >
          <span className="label-mono text-ink-2">Templates</span>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {TEMPLATES.map((template) => {
              const selected = template.id === current.id
              return (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(template.id)
                    setOpen(false)
                  }}
                  className="group flex flex-col gap-2 text-left"
                >
                  <span
                    className={`relative block aspect-[8.5/11] w-full overflow-hidden bg-sheet transition-shadow ${
                      selected ? "ring-2 ring-accent" : "ring-1 ring-rule group-hover:ring-ink"
                    }`}
                  >
                    <Image src={template.image} alt="" fill sizes="180px" className="object-cover object-top" />
                  </span>
                  <span className={`text-sm ${selected ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink"}`}>
                    {template.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
