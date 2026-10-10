"use client"

import { Loader2 } from "lucide-react"
import type { DriveFailure } from "@/lib/googleDrive"
import { failureOf, type PdfFailure } from "@/lib/typst/compile"

/** A download, share or save to Google Drive that failed: why, how many times in a row, and of what, when it wasn't the PDF. */
export interface Failure {
  /**
   * Why the PDF couldn't be made; `share`: it was made, and the share sheet
   * didn't take it; `popup`: the browser blocked Google's sign-in window; or
   * why Google Drive didn't take it.
   */
  reason: PdfFailure | "share" | "popup" | DriveFailure
  count: number
  of?: "Word file"
}

/**
 * The failure to show after `error`, following any failure of the same file
 * before it. `of` is the file, when it isn't the PDF; `reason` is why, when
 * it isn't why the PDF couldn't be made.
 */
export const nextFailure = (
  previous: Failure | null | undefined,
  error: unknown,
  { of, reason = failureOf(error) }: { of?: Failure["of"]; reason?: Failure["reason"] } = {},
): Failure => ({
  reason,
  count: (previous?.of === of ? (previous?.count ?? 0) : 0) + 1,
  ...(of && { of }),
})

// What couldn't be done: making the PDF, or what was done with it after.
const STEP: Record<Failure["reason"], "make" | "share" | "save"> = {
  connection: "make",
  resume: "make",
  crash: "make",
  share: "share",
  popup: "save",
  offline: "save",
  "signed-out": "save",
  full: "save",
  drive: "save",
}

const WHAT_TO_DO: Record<Failure["reason"], string> = {
  connection: "Check your connection and try again.",
  resume: "Something in it stops the template from working. Try another template.",
  crash: "Something went wrong. Try again, or reload the page if it keeps happening.",
  share: "Try again, or download it instead.",
  popup: "Your browser blocked Google's sign-in window. Allow pop-ups for this site, then try again.",
  offline: "Check your connection and try again.",
  "signed-out": "Try again, and sign in to Google once more.",
  full: "Your Google Drive is full. Make room in it, then try again.",
  drive: "Try again, or download it instead.",
}

const LABEL = { download: "Download failed", share: "Share failed", save: "Save to Drive failed" }

interface DownloadFailedProps {
  failure: Failure
  /** The resume's name, when the page lists more than one. */
  title?: string
  /** What failed: a download, Share PDF, or Save to Google Drive. */
  doing?: keyof typeof LABEL
  retrying: boolean
  onRetry: () => void
  className?: string
}

/**
 * Says a download, share or save to Google Drive didn't work and what to do,
 * with a button to try again. Give it `key={failure.count}`, so a screen
 * reader announces each new failure.
 */
export default function DownloadFailed({ failure, title, doing = "download", retrying, onRetry, className = "" }: DownloadFailedProps) {
  const step = STEP[failure.reason]
  return (
    <div role="alert" className={`flex flex-wrap items-baseline gap-x-6 gap-y-2 ${className}`}>
      <span className="label-mono shrink-0 text-[#b42318]">{LABEL[doing]}</span>
      <p className="min-w-0 flex-[1_1_280px] break-words text-sm leading-relaxed text-ink">
        {failure.count > 1 ? "Still couldn't" : "Couldn't"} {step}{" "}
        {title ? <>the PDF of &ldquo;{title}&rdquo;</> : `your ${failure.of ?? "PDF"}`}
        {step === "save" && " to Google Drive"}. {WHAT_TO_DO[failure.reason]}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink underline underline-offset-4 disabled:cursor-wait"
      >
        {retrying && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Try again
      </button>
    </div>
  )
}
