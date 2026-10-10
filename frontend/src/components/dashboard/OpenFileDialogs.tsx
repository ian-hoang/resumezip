"use client"

import { Loader2 } from "lucide-react"
import Modal from "./Modal"
import { INK_PILL, OUTLINE_PILL } from "@/components/pills"

export function ReadingDialog({ fileName, onCancel }: { fileName: string; onCancel: () => void }) {
  return (
    <Modal title="Opening your file" onClose={onCancel}>
      <p className="mt-4 flex items-center gap-2 text-[15px] text-ink-2" role="status">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        <span className="min-w-0 truncate">Reading {fileName} in your browser…</span>
      </p>
      <div className="mt-7 flex justify-end">
        <button type="button" onClick={onCancel} className={OUTLINE_PILL}>
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
        <button type="button" onClick={onClose} className={OUTLINE_PILL}>
          Close
        </button>
        <button type="button" onClick={onRetry} className={INK_PILL}>
          Choose another file
        </button>
      </div>
    </Modal>
  )
}

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
// When a copy was last edited, as a time: NaN if it doesn't say.
const timeOf = (value: unknown) => (typeof value === "string" ? Date.parse(value) : NaN)
const formatWhen = (value: unknown) => {
  const time = timeOf(value)
  return Number.isNaN(time) ? "an unknown time" : when.format(time)
}

interface ConflictDialogProps {
  existingTitle?: string
  existingEdited: unknown
  fileEdited: unknown
  /** A PDF, or a JSON file, which has what's left out of the PDF too. */
  from: "pdf" | "json"
  /** Whether the resume in this browser has something left out of the PDF, which the PDF doesn't hold. */
  existingLeftOut: boolean
  onCancel: () => void
  onKeepBoth: () => void
  onReplace: () => void
}

/** A resumezip PDF or JSON file of a resume that's already in this browser, but different. */
export function ConflictDialog({
  existingTitle,
  existingEdited,
  fileEdited,
  from,
  existingLeftOut,
  onCancel,
  onKeepBoth,
  onReplace,
}: ConflictDialogProps) {
  const file = from === "pdf" ? "PDF" : "file"
  // Without both times, neither copy is newer (NaN compares false).
  const fileOlder = timeOf(fileEdited) < timeOf(existingEdited)
  const fileNewer = timeOf(fileEdited) > timeOf(existingEdited)
  const losesLeftOut = from === "pdf" && existingLeftOut
  // Replacing is the main choice only when it loses nothing.
  const replaceFirst = fileNewer && !losesLeftOut
  return (
    <Modal title="You already have this resume" onClose={onCancel}>
      <p className="mt-4 break-words text-[15px] leading-relaxed text-ink-2">
        &ldquo;{existingTitle || "Untitled resume"}&rdquo; is in this browser, last edited {formatWhen(existingEdited)}.{" "}
        {fileOlder
          ? `The ${file} is older, from ${formatWhen(fileEdited)}. Replacing loses your changes since then.`
          : fileNewer
            ? `The ${file} is newer, from ${formatWhen(fileEdited)}.`
            : `The ${file} is from ${formatWhen(fileEdited)}.`}
        {losesLeftOut && " What you left out of the PDF isn't in the file, so replacing deletes it."}
      </p>
      <div className="mt-7 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={OUTLINE_PILL}>
          Cancel
        </button>
        <button type="button" onClick={onKeepBoth} className={replaceFirst ? OUTLINE_PILL : INK_PILL}>
          Keep both
        </button>
        <button type="button" onClick={onReplace} className={replaceFirst ? INK_PILL : OUTLINE_PILL}>
          Replace with the {file}
        </button>
      </div>
    </Modal>
  )
}

/** A resume in a file of them all that's in this browser too, but different: when each copy was last edited. */
export interface Differing {
  existingTitle?: string
  existingEdited: unknown
  fileEdited: unknown
}

interface AllConflictDialogProps {
  differing: Differing[]
  onCancel: () => void
  onKeepBoth: () => void
  onReplace: () => void
}

/** Names a few resumes, as “Ada”, “Grace” and 3 more. */
function nameSome(titles: string[]) {
  const quoted = titles.map((title) => `“${title || "Untitled resume"}”`)
  if (quoted.length === 1) return quoted[0]
  if (quoted.length <= 3) return `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`
  return `${quoted.slice(0, 2).join(", ")} and ${quoted.length - 2} more`
}

/**
 * A file of every resume ("Download all") with some that are in this browser
 * too, but different: one question for them all. Those that aren't here are
 * added either way, and those that are the same are left as they are.
 */
export function AllConflictDialog({ differing, onCancel, onKeepBoth, onReplace }: AllConflictDialogProps) {
  const count = differing.length
  const one = count === 1
  // As for one file: without both times, neither copy is older or newer.
  const older = differing.filter(({ fileEdited, existingEdited }) => timeOf(fileEdited) < timeOf(existingEdited)).length
  const replaceFirst = differing.every(({ fileEdited, existingEdited }) => timeOf(fileEdited) > timeOf(existingEdited))
  return (
    <Modal title={one ? "You already have one of these" : `You already have ${count} of these`} onClose={onCancel}>
      <p className="mt-4 break-words text-[15px] leading-relaxed text-ink-2">
        {nameSome(differing.map(({ existingTitle }) => existingTitle ?? ""))} {one ? "is" : "are"} in this browser, and the file has{" "}
        {one ? "a different copy" : "different copies"}.{" "}
        {older > 0 &&
          `${one ? "The file's copy is" : older === count ? "The file's copies are" : `${older} of the file's copies are`} older: replacing loses your changes since then.`}
      </p>
      <div className="mt-7 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={OUTLINE_PILL}>
          Cancel
        </button>
        <button type="button" onClick={onKeepBoth} className={replaceFirst ? OUTLINE_PILL : INK_PILL}>
          Keep both
        </button>
        <button type="button" onClick={onReplace} className={replaceFirst ? INK_PILL : OUTLINE_PILL}>
          {one ? "Replace it" : "Replace them"}
        </button>
      </div>
    </Modal>
  )
}
