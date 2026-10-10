"use client"

import { useState } from "react"
import { cleanTag, RESUME_TAGS } from "@/lib/resume"
import Modal, { useModalClose } from "./Modal"
import TypePicker from "./TypePicker"
import { INK_PILL, OUTLINE_PILL } from "@/components/pills"

interface CreateResumeModalProps {
  /** Types of the person's own already in use, to pick again. */
  own: string[]
  onClose: () => void
  onCreate: (title: string, tag: string) => void
}

export default function CreateResumeModal({ own, onClose, onCreate }: CreateResumeModalProps) {
  const [title, setTitle] = useState("")
  const [tag, setTag] = useState(RESUME_TAGS[0].id)

  return (
    <Modal title="New resume" onClose={onClose} fade>
      <form
        className="mt-6 flex flex-col gap-7"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(title.trim() || "Untitled resume", cleanTag(tag))
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

        <TypePicker value={tag} onChange={setTag} own={own} />

        <div className="flex justify-end gap-2">
          <CancelButton />
          <button type="submit" className={INK_PILL}>
            Create
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Cancel, which closes the dialog as Escape does, fading away. */
function CancelButton() {
  const close = useModalClose()
  return (
    <button type="button" onClick={close} className={OUTLINE_PILL}>
      Cancel
    </button>
  )
}
