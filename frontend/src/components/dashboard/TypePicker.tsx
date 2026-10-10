"use client"

import { useId, useState } from "react"
import { MAX_TAG_LENGTH, RESUME_TAGS } from "@/lib/resume"
import { tagName } from "./ResumeTable"

interface TypePickerProps {
  /** The type chosen so far: a RESUME_TAGS id, or the person's own as typed. */
  value: string
  onChange: (value: string) => void
  /** Types of the person's own already in use, as saved, to pick again. */
  own?: string[]
}

const chip = (chosen: boolean) =>
  `inline-flex h-9 cursor-pointer items-center rounded-full px-4 text-sm transition-[background-color,box-shadow] duration-200 has-[:focus-visible]:[background-image:linear-gradient(rgb(17_19_24/0.08),rgb(17_19_24/0.08))] motion-reduce:transition-none ${
    // Chosen, it's ink, where the focus tint wouldn't show: it lightens instead, as an ink button does.
    chosen
      ? "bg-ink text-white has-[:focus-visible]:bg-[#3a3f4b]"
      : "bg-sheet/70 text-ink ring-1 ring-ink/15 hover:bg-sheet hover:ring-ink/40"
  }`

/**
 * A resume's type: a chip for each of RESUME_TAGS and each type of the
 * person's own in use, and a box to name a new one. Typing in the box
 * chooses what's typed; choosing a chip empties it. What's typed is kept
 * apart from what's chosen, so text that happens to match a chip, as
 * "Data roles" on the way to "Data roles 2", stays in the box.
 */
export default function TypePicker({ value, onChange, own = [] }: TypePickerProps) {
  const name = useId()
  const choices = [...RESUME_TAGS.map((option) => option.id), ...own.filter((tag) => !RESUME_TAGS.some((option) => option.id === tag))]
  const [typed, setTyped] = useState(() => (choices.includes(value) ? "" : value))

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label-mono mb-2 text-ink-2">Type</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((tag) => (
          <label key={tag} className={chip(typed === "" && value === tag)}>
            <input
              type="radio"
              name={name}
              value={tag}
              checked={typed === "" && value === tag}
              onChange={() => {
                setTyped("")
                onChange(tag)
              }}
              className="sr-only"
            />
            {tagName(tag)}
          </label>
        ))}
      </div>
      <label className="mt-3 flex flex-col gap-1.5">
        <span className="label-mono text-ink-2">Or your own</span>
        <input
          type="text"
          value={typed}
          maxLength={MAX_TAG_LENGTH}
          onChange={(event) => {
            setTyped(event.target.value)
            onChange(event.target.value)
          }}
          placeholder="Data roles"
          className="border-0 border-b border-ink/25 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-2/70 focus:border-accent"
        />
      </label>
    </fieldset>
  )
}
