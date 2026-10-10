"use client"

import { memo, useId } from "react"
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
 * The left bar's Style mode: the templates, then Fine-tune. On wide screens
 * it's in the left panel beside the form. Narrower, it takes the form's
 * place, with the two side by side where there's room, and the header's
 * template picker is there too.
 */
function StylePanel({ value, onChange }: StylePanelProps) {
  const templatesId = useId()
  const tuneId = useId()
  const current = templateById(value)

  return (
    <section
      aria-label="Style"
      className="flex flex-col px-2 pb-5 pt-4 sm:grid sm:grid-cols-2 sm:items-start sm:gap-x-8 sm:px-3 xl:flex xl:p-0"
    >
      <div role="group" aria-labelledby={templatesId} className="flex flex-col gap-1">
        <span id={templatesId} className="label-mono mb-1.5 px-3 text-ink-2">
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
              className={`flex h-10 shrink-0 items-center justify-between gap-3 rounded-full px-4 text-left text-[15px] transition-colors duration-150 ${
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
      <section
        aria-labelledby={tuneId}
        className="mx-1 mt-5 border-t border-ink/[0.08] px-2 pt-5 has-[>div:empty]:hidden sm:mt-0 sm:border-t-0 sm:pt-0 xl:mt-5 xl:border-t xl:pt-5"
      >
        <h2 id={tuneId} className="font-serif text-[22px] leading-tight tracking-[-0.01em] text-ink">
          Fine-tune
        </h2>
        <div className="mt-4">
          <FineTune />
        </div>
      </section>
    </section>
  )
}

// Re-renders when the template changes, and not with the rest of the editor.
export default memo(StylePanel)
