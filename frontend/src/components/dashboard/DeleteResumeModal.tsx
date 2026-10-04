"use client"

import Modal from "./Modal"

interface DeleteResumeModalProps {
  resumeTitle: string
  onClose: () => void
  onDelete: () => void
}

export default function DeleteResumeModal({ resumeTitle, onClose, onDelete }: DeleteResumeModalProps) {
  return (
    <Modal title="Delete this resume?" onClose={onClose}>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        <span className="text-ink">{resumeTitle || "Untitled resume"}</span> will be removed from this browser. This
        can't be undone.
      </p>
      <div className="mt-7 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-10 px-4 text-sm text-ink-2 hover:text-ink">
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="h-10 rounded-[4px] bg-[#b42318] px-4 text-sm font-medium text-white transition-colors hover:bg-[#912018]"
        >
          Delete
        </button>
      </div>
    </Modal>
  )
}
