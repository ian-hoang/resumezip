"use client"

import { Loader2 } from "lucide-react"
import Modal from "./Modal"

const secondary = "h-10 rounded-[4px] border border-rule-strong px-4 text-sm font-medium text-ink transition-colors hover:border-ink"
const primary = "h-10 rounded-[4px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black"
const quiet = "h-10 px-4 text-sm text-ink-2 hover:text-ink"

export function ReadingDialog({ fileName, onCancel }: { fileName: string; onCancel: () => void }) {
  return (
    <Modal title="Opening your file" onClose={onCancel}>
      <p className="mt-4 flex items-center gap-2 text-[15px] text-ink-2" role="status">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        <span className="min-w-0 truncate">Reading {fileName} in your browser…</span>
      </p>
      <div className="mt-7 flex justify-end">
        <button type="button" onClick={onCancel} className={quiet}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export function OpenErrorDialog({ message, onClose, onRetry }: { message: string; onClose: () => void; onRetry: () => void }) {
  return (
    <Modal title="Couldn't open that file" onClose={onClose}>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{message}</p>
      <div className="mt-7 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={quiet}>
          Close
        </button>
        <button type="button" onClick={onRetry} className={primary}>
          Choose another file
        </button>
      </div>
    </Modal>
  )
}

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
const timeOf = (value: unknown) => new Date(typeof value === "string" ? value : NaN).getTime()
const formatWhen = (value: unknown) => {
  const time = timeOf(value)
  return Number.isNaN(time) ? "an unknown time" : when.format(time)
}

interface ConflictDialogProps {
  existingTitle?: string
  existingEdited: unknown
  fileEdited: unknown
  /** Whether the resume in this browser has something left out of the PDF, which the PDF doesn't hold. */
  existingLeftOut: boolean
  onCancel: () => void
  onKeepBoth: () => void
  onReplace: () => void
}

/** A resumezip PDF of a resume that's already in this browser, but different. */
export function ConflictDialog({
  existingTitle,
  existingEdited,
  fileEdited,
  existingLeftOut,
  onCancel,
  onKeepBoth,
  onReplace,
}: ConflictDialogProps) {
  // Said in words, since old PDFs pile up as "resume (1).pdf" and so on, and an older one is easy to pick by mistake.
  const existingTime = timeOf(existingEdited)
  const fileTime = timeOf(fileEdited)
  const fileIs = fileTime > existingTime ? "newer" : fileTime < existingTime ? "older" : null
  // Replacing is the main button only when it can't lose anything newer.
  const replaceFirst = fileIs === "newer" && !existingLeftOut
  return (
    <Modal title="You already have this resume" onClose={onCancel}>
      <p className="mt-4 break-words text-[15px] leading-relaxed text-ink-2">
        &ldquo;{existingTitle || "Untitled resume"}&rdquo; is in this browser, last edited {formatWhen(existingEdited)}. The PDF is from{" "}
        {formatWhen(fileEdited)}.
        {fileIs && <strong className="font-medium text-ink"> The PDF is {fileIs} than the copy in this browser.</strong>}
        {existingLeftOut && " What you left out of the PDF isn't in the file, so replacing deletes it."}
      </p>
      <div className="mt-7 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={quiet}>
          Cancel
        </button>
        <button type="button" onClick={onKeepBoth} className={replaceFirst ? secondary : primary}>
          Keep both
        </button>
        <button type="button" onClick={onReplace} className={replaceFirst ? primary : secondary}>
          Replace with the PDF
        </button>
      </div>
    </Modal>
  )
}
