"use client"

import type React from "react"
import { useLayoutEffect, useRef, useState } from "react"
import { Pencil } from "lucide-react"

interface FieldProps {
  label: string
  value: string
  placeholder?: string
  type?: string
  className?: string
  onChange: (value: string) => void
}

/** A labelled, underlined text input. */
export function Field({ label, value, placeholder, type = "text", className = "", onChange }: FieldProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="label-mono text-ink-2">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 border-0 border-b border-rule-strong bg-transparent py-2 text-base text-ink outline-none transition-colors placeholder:text-ink-2/50 focus:border-accent focus-visible:outline-none"
      />
    </label>
  )
}

// Every non-empty line starts with "• " so the textarea reads like the PDF.
function withBullets(text: string) {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim() || line === "•") return line
      if (/^•([^\s]|$)/.test(line)) return line.replace(/^•/, "• ")
      return line.startsWith("• ") ? line : `• ${line}`
    })
    .join("\n")
}

/** A textarea for bullet points: one per line, and Enter starts a new bullet. */
export function BulletsField({ label, value, placeholder, className = "", onChange }: FieldProps) {
  const text = withBullets(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow to fit the text instead of scrolling inside the box.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${textarea.scrollHeight + 2}px`
  }, [text])

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return
    event.preventDefault()
    const textarea = event.currentTarget
    const { selectionStart: start, selectionEnd: end } = textarea
    const insert = text[start - 1] === "\n" ? "" : "\n• "
    onChange(text.slice(0, start) + insert + text.slice(end))
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = start + insert.length
    })
  }

  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="label-mono text-ink-2">{label}</span>
      <textarea
        ref={textareaRef}
        value={text}
        placeholder={placeholder ? `• ${placeholder}` : undefined}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-full resize-none overflow-hidden rounded-[4px] border border-rule bg-sheet px-3.5 py-3 text-[15px] leading-[1.7] text-ink outline-none transition-colors placeholder:text-ink-2/50 focus:border-accent focus-visible:outline-none"
      />
    </label>
  )
}

interface SectionHeadingProps {
  /** e.g. "03 / 08" */
  position: string
  title: string
  /** When given, the title can be renamed. */
  onRename?: (title: string) => void
}

/** The big serif title at the top of each section, optionally renameable. */
export function SectionHeading({ position, title, onRename }: SectionHeadingProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const save = () => {
    if (draft !== null && draft.trim() && draft.trim() !== title) onRename?.(draft.trim())
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="label-mono text-ink-2">{position}</span>
      {draft === null ? (
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-[40px] leading-[1.1] tracking-[-0.02em]">{title}</h1>
          {onRename && (
            <button
              type="button"
              aria-label="Rename section"
              title="Rename section"
              onClick={() => setDraft(title)}
              className="p-1.5 text-ink-2 transition-colors hover:text-ink"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <input
          aria-label="Section title"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") save()
            if (event.key === "Escape") setDraft(null)
          }}
          className="w-full border-0 border-b-[1.5px] border-accent bg-transparent font-serif text-[40px] leading-[1.1] tracking-[-0.02em] outline-none focus-visible:outline-none"
        />
      )}
    </div>
  )
}
