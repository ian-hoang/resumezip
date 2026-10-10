"use client"

import { useState } from "react"
import { cleanTag, type ResumeWithId } from "@/lib/resume"
import Modal, { useModalClose } from "./Modal"
import TypePicker from "./TypePicker"
import { INK_PILL, OUTLINE_PILL } from "@/components/pills"

interface TypeModalProps {
  resume: ResumeWithId
  /** Types of the person's own already in use, to pick again. */
  own: string[]
  onClose: () => void
  /** The type chosen, cleaned (cleanTag); "" when the box was emptied, for no type. */
  onSave: (tag: string) => void
}

/** Changes a resume's type, from the dashboard. */
export default function TypeModal({ resume, own, onClose, onSave }: TypeModalProps) {
  const [tag, setTag] = useState(cleanTag(resume.resumeTag ?? ""))

  return (
    <Modal title="Change type" onClose={onClose} fade>
      <form
        className="mt-6 flex flex-col gap-7"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(cleanTag(tag))
        }}
      >
        <TypePicker value={tag} onChange={setTag} own={own} />
        <div className="flex justify-end gap-2">
          <CancelButton />
          <button type="submit" className={INK_PILL}>
            Save
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
