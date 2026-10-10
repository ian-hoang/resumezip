"use client"

import { Loader2 } from "lucide-react"
import { failureOf, type PdfFailure } from "@/lib/typst/compile"

/** A download that failed: why, how many times in a row, and of what, when it wasn't the PDF. */
export interface Failure {
  reason: PdfFailure
  count: number
  of?: "Word file"
}

/** The failure to show after `error`, following any failure of the same file before it. */
export const nextFailure = (previous: Failure | null | undefined, error: unknown, of?: Failure["of"]): Failure => ({
  reason: failureOf(error),
  count: (previous?.of === of ? (previous?.count ?? 0) : 0) + 1,
  ...(of && { of }),
})

const WHAT_TO_DO: Record<PdfFailure, string> = {
  connection: "Check your connection and try again.",
  resume: "Something in it stops the template from working. Try another template.",
  crash: "Something went wrong. Try again, or reload the page if it keeps happening.",
}

interface DownloadFailedProps {
  failure: Failure
  /** The resume's name, when the page lists more than one. */
  title?: string
  retrying: boolean
  onRetry: () => void
  className?: string
}

/**
 * Says a download didn't work and what to do, with a button to try again.
 * Give it `key={failure.count}`, so a screen reader announces each new failure.
 */
export default function DownloadFailed({ failure, title, retrying, onRetry, className = "" }: DownloadFailedProps) {
  return (
    <div role="alert" className={`flex flex-wrap items-baseline gap-x-6 gap-y-2 ${className}`}>
      <span className="label-mono shrink-0 text-[#b42318]">Download failed</span>
      <p className="min-w-0 flex-[1_1_280px] break-words text-sm leading-relaxed text-ink">
        {failure.count > 1 ? "Still couldn't" : "Couldn't"} make{" "}
        {title ? <>the PDF of &ldquo;{title}&rdquo;</> : `your ${failure.of ?? "PDF"}`}. {WHAT_TO_DO[failure.reason]}
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
