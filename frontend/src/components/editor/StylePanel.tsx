"use client"

import type React from "react"
import { memo, useEffect, useId, useRef, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import FineTune from "@/components/editor/FineTune"
import { TEMPLATES, templateById, type TemplateId } from "@/lib/templates"

// What sets each template apart, in a word or two beside its name. Typed by
// template, so a new one can't be added without one.
const LOOKS: Record<TemplateId, string> = {
  jake: "Serif",
  modernjack: "Sans",
  levelsfyi: "Blue rules",
  referme: "Caps headings",
  ian: "Blue name",
  resumeworded: "Garamond",
}

interface StylePanelProps {
  /** The resume's template, as saved. */
  value: unknown
  onChange: (template: TemplateId) => void
}

/**
 * The stage's Style panel, floating on the right on wide screens: the
 * templates, then Fine-tune. Below 1440px there isn't room for it beside the
 * page, so it folds behind a Style button in the corner and opens over the
 * canvas; a click elsewhere or Escape folds it again. Below WIDE_SCREEN the
 * header's template picker does its job.
 */
function StylePanel({ value, onChange }: StylePanelProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const headingId = useId()
  const templatesId = useId()
  const tuneId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const current = templateById(value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Only while the keyboard is in it, so Escape in a menu or dialog elsewhere is theirs.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return
    setOpen(false)
    toggleRef.current?.focus()
  }

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="fixed right-6 top-6 z-10 hidden w-[280px] flex-col items-end gap-2 xl:flex">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="glass glass-frost inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink transition-colors hover:text-accent min-[90rem]:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Style
        {/* Kept short, so it clears the page beside it; a screen reader hears the template too. */}
        <span className="sr-only">, {current.name}</span>
      </button>

      {/* It fades in as it opens (`starting:` is CSS @starting-style). */}
      <section
        id={panelId}
        aria-labelledby={headingId}
        // Over the page while it's opened from the button, where less shows through, so the page's text doesn't.
        className={`glass glass-frost w-full flex-col overflow-y-auto overscroll-contain rounded-[24px] bg-sheet/70 px-4 pb-5 pt-5 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none starting:-translate-y-1 starting:opacity-0 max-h-[calc(100dvh-168px)] min-[90rem]:flex min-[90rem]:max-h-[calc(100dvh-116px)] min-[90rem]:bg-transparent ${
          open ? "flex" : "hidden"
        }`}
      >
        <h2 id={headingId} className="px-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-ink">
          Style
        </h2>

        <div role="group" aria-labelledby={templatesId} className="mt-4 flex flex-col gap-1">
          <span id={templatesId} className="label-mono mb-1.5 px-2 text-ink-2">
            Template
          </span>
          {TEMPLATES.map((template) => {
            const selected = template.id === current.id
            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(template.id)}
                className={`flex h-10 shrink-0 items-center justify-between gap-3 rounded-[10px] px-3 text-left text-[15px] transition-colors duration-150 ${
                  selected ? "bg-ink text-white" : "text-ink hover:bg-ink/[0.05]"
                }`}
              >
                <span className="min-w-0 truncate">{template.name}</span>
                <span aria-hidden="true" className={`label-mono shrink-0 ${selected ? "text-white/70" : "text-ink-2"}`}>
                  {LOOKS[template.id]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Hidden while Fine-tune has nothing to show, so its heading doesn't stand alone. */}
        <section aria-labelledby={tuneId} className="mt-5 border-t border-ink/[0.08] px-2 pt-5 has-[>div:empty]:hidden">
          <h3 id={tuneId} className="font-serif text-[20px] leading-tight tracking-[-0.01em] text-ink">
            Fine-tune
          </h3>
          <div className="mt-4">
            <FineTune />
          </div>
        </section>
      </section>
    </div>
  )
}

// Re-renders when the template changes, and not with the rest of the editor.
export default memo(StylePanel)
