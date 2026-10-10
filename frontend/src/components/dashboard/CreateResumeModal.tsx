"use client"

import { useState } from "react"
import { RESUME_TAGS } from "@/lib/resume"
import Modal from "./Modal"
import { INK_PILL, OUTLINE_PILL } from "@/components/pills"

interface CreateResumeModalProps {
  onClose: () => void
  onCreate: (title: string, tag: string) => void
}

export default function CreateResumeModal({ onClose, onCreate }: CreateResumeModalProps) {
  const [title, setTitle] = useState("")
  const [tag, setTag] = useState(RESUME_TAGS[0].id)

  return (
    <Modal title="New resume" onClose={onClose}>
      <form
        className="mt-6 flex flex-col gap-7"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(title.trim() || "Untitled resume", tag)
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="label-mono text-ink-2">Name</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Software engineer, 2026"
            className="border-0 border-b border-ink/25 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-2/70 focus:border-accent"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="label-mono mb-2 text-ink-2">Type</legend>
          <div className="flex flex-wrap gap-2">
            {RESUME_TAGS.map((option) => (
              <label
                key={option.id}
                className={`inline-flex h-9 cursor-pointer items-center rounded-full px-4 text-sm transition-[background-color,box-shadow] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent motion-reduce:transition-none ${
                  tag === option.id ? "bg-ink text-white" : "bg-sheet/70 text-ink ring-1 ring-ink/15 hover:bg-sheet hover:ring-ink/40"
                }`}
              >
                <input
                  type="radio"
                  name="resume-tag"
                  value={option.id}
                  checked={tag === option.id}
                  onChange={() => setTag(option.id)}
                  className="sr-only"
                />
                {option.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={OUTLINE_PILL}>
            Cancel
          </button>
          <button type="submit" className={INK_PILL}>
            Create
          </button>
        </div>
      </form>
    </Modal>
  )
}
