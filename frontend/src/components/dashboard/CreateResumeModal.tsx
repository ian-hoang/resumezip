"use client"

import { useState } from "react"
import { RESUME_TAGS } from "@/lib/resume"
import Modal from "./Modal"

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
            className="border-0 border-b border-rule-strong bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-2/60 focus:border-accent"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="label-mono mb-2 text-ink-2">Type</legend>
          <div className="flex flex-wrap gap-2">
            {RESUME_TAGS.map((option) => (
              <label
                key={option.id}
                className={`cursor-pointer rounded-[4px] border px-3.5 py-2 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  tag === option.id ? "border-ink bg-ink text-white" : "border-rule-strong text-ink hover:border-ink"
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
          <button type="button" onClick={onClose} className="h-10 px-4 text-sm text-ink-2 hover:text-ink">
            Cancel
          </button>
          <button type="submit" className="h-10 rounded-[4px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black">
            Create
          </button>
        </div>
      </form>
    </Modal>
  )
}
