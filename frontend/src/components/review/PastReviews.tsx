"use client"

import { useEffect, useRef, useState } from "react"
import { RowAction, TrashIcon } from "@/components/dashboard/RowActions"
import { sheetPill } from "@/components/pills"
import { ago } from "@/lib/ago"
import type { PastReview } from "@/lib/review/past"
import { verdictOf, VERDICT_WORDS } from "@/lib/review/verdict"

function details(review: PastReview): string {
  const red = review.notes?.filter((note) => note.tone === "red").length
  return [
    ago(new Date(review.savedAt).toISOString()),
    `ATS checks: ${VERDICT_WORDS[verdictOf(review.total)].toLowerCase()}`,
    `${review.total}/100`,
    red === undefined ? "AI: not included" : red === 0 ? "AI: no red flags" : red === 1 ? "AI: 1 red flag" : `AI: ${red} red flags`,
  ]
    .filter(Boolean)
    .join(" · ")
}

/**
 * The files reviewed in this browser before, newest first, under the drop
 * zone: each opens as it was reviewed, and each can be deleted, at once, as a
 * resume on the dashboard is (ReviewPage has its Undo), or all of them, which
 * asks first. Nothing is shown when there are none.
 */
export default function PastReviews({
  reviews,
  problem,
  onOpen,
  onDelete,
  onDeleteAll,
}: {
  reviews: readonly PastReview[]
  /** Why one couldn't be deleted, if it couldn't. */
  problem: string | null
  onOpen: (review: PastReview) => void
  /** Each resolves to whether it was deleted. If they all weren't, Clear all's question stays, to try again. */
  onDelete: (review: PastReview) => Promise<boolean>
  onDeleteAll: () => Promise<boolean>
}) {
  // Whether Clear all is asking.
  const [asking, setAsking] = useState(false)
  const clearAll = useRef<HTMLButtonElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  // A second click while the first is still deleting would delete nothing, and take its Undo away.
  const deleting = useRef(false)

  // Asking moves the focus to Keep, so Escape or Enter backs out.
  useEffect(() => {
    if (asking) keep.current?.focus()
  }, [asking])

  if (reviews.length === 0) return null

  const stopAsking = () => {
    setAsking(false)
    // Clear all is back once the question's gone.
    requestAnimationFrame(() => clearAll.current?.focus())
  }

  const remove = async (deleteIt: () => Promise<boolean>) => {
    if (deleting.current) return false
    deleting.current = true
    const deleted = await deleteIt()
    deleting.current = false
    return deleted
  }

  return (
    <section
      aria-labelledby="past-reviews"
      className="glass glass-solid mt-12 w-full max-w-[460px] overflow-hidden rounded-[18px] text-left"
    >
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-rule pl-4 pr-2">
        {/* On a phone, the question takes its place while Clear all asks: there isn't room for both. */}
        <h2 id="past-reviews" className={`label-mono text-ink-2 ${asking ? "max-sm:sr-only" : ""}`}>
          Past reviews
        </h2>
        {asking ? (
          // Fading in where Clear all was (`starting:` is CSS @starting-style).
          <span
            className="ml-auto flex h-10 shrink-0 items-center gap-2 transition-opacity duration-200 motion-reduce:transition-none starting:opacity-0"
            onKeyDown={(event) => {
              if (event.key === "Escape") stopAsking()
            }}
          >
            <span role="status" className="mr-1 text-sm text-ink">
              Delete all?
            </span>
            <button ref={keep} type="button" onClick={stopAsking} className={sheetPill("white", "h-9 px-4 text-[15px] font-medium")}>
              Keep
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await remove(onDeleteAll)) setAsking(false)
              }}
              className={sheetPill("danger", "h-9 px-4 text-[15px] font-medium")}
            >
              Delete
            </button>
          </span>
        ) : (
          <button ref={clearAll} type="button" className={sheetPill("text", "h-8 px-3 text-[13px]")} onClick={() => setAsking(true)}>
            Clear all
          </button>
        )}
      </div>
      <ul>
        {reviews.map((review) => (
          <li key={review.id} className="flex items-center border-b border-rule last:border-b-0">
            {/* While Clear all asks, the names stay and the rest fades, so it's clear what would go. With no
                  intrinsic width (w-0), the title truncates and the details wrap within the row on a phone. */}
            <button
              type="button"
              data-past-review={review.id}
              inert={asking}
              onClick={() => onOpen(review)}
              className="flex w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03] focus-visible:outline-offset-[-2px]"
            >
              <span className="truncate text-[15px] text-ink">{review.title}</span>
              <span
                className={`text-pretty text-[12.5px] tabular-nums text-ink-2 transition-opacity duration-200 motion-reduce:transition-none ${asking ? "opacity-30" : ""}`}
              >
                {details(review)}
              </span>
            </button>
            <RowAction
              label={`Delete the review of ${review.title}`}
              tip="Delete"
              tipAtEnd
              danger
              className="mr-2"
              onClick={() => void remove(() => onDelete(review))}
            >
              <TrashIcon />
            </RowAction>
          </li>
        ))}
      </ul>
      {problem && (
        <p role="alert" className="border-t border-rule px-4 py-2.5 text-[13px] text-alert">
          {problem}
        </p>
      )}
    </section>
  )
}
