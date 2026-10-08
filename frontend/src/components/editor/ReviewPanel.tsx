"use client"

import { useId } from "react"
import { LoaderCircle, Sparkles } from "lucide-react"
import { describePlace } from "@/lib/check/labels"
import { LENSES, TONES, useAiReview, type PlacedNote } from "./AiReview"
import { useCheck } from "./CheckContext"

const count = (n: number, thing: string) => `${n} ${thing}${n === 1 ? "" : "s"}`

const quiet = "text-[13px] text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"

/**
 * The AI review, at the top of the Check panel: what it does and where the
 * text goes, until it's asked for; then the highlights or red flags, the
 * same ones the preview shows.
 */
export default function ReviewPanel() {
  const { status, failure, ask, notes, fixed, changed, lens, setLens } = useAiReview()
  const id = useId()
  const reading = status === "reading"
  const counts = LENSES.map((kind) => notes.filter((note) => note.kind === kind).length)

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-b border-rule px-2 pb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="label-mono text-ink-2">
          AI review
        </h2>
        {status === "ready" && changed && (
          <button type="button" onClick={ask} className={quiet}>
            Read again
          </button>
        )}
      </div>

      {status === "ready" ? (
        <>
          <div role="group" aria-label="Show" className="flex gap-1 rounded-[4px] bg-desk p-1">
            {LENSES.map((option, index) => {
              const { name, ink } = TONES[option]
              const selected = option === lens
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLens(option)}
                  className={`inline-flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[3px] text-[13px] font-medium transition-colors ${
                    selected ? `bg-sheet ring-1 ring-rule ${ink}` : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {name}
                  <span className="tabular-nums">· {counts[index]}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[13px] leading-relaxed text-ink-2">{TONES[lens].about}</p>
          <Notes lens={lens} notes={notes.filter((note) => note.kind === lens)} />
          {lens === "redFlags" && fixed > 0 && (
            <p className="text-[12px] text-ink-2">
              {fixed} fixed since the review.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-ink-2">
            How a recruiter reads it in six seconds: the words that stick, and the ones that make them move on.
          </p>
          <button
            type="button"
            onClick={ask}
            disabled={reading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[4px] bg-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-wait disabled:opacity-80"
          >
            {reading ? (
              <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {reading ? "Reading…" : status === "failed" ? "Try again" : "Get AI feedback"}
          </button>
          {failure && (
            <p role="alert" className="text-[13px] leading-relaxed text-[#b42318]">
              {failure}
            </p>
          )}
          <p className="text-[12px] leading-relaxed text-ink-2">
            {reading
              ? "Claude is reading it like a recruiter would. This takes about half a minute."
              : "Sends the resume’s text to Claude, Anthropic’s AI. Your name, contact details, links and locations stay here, and resumezip keeps none of it."}
          </p>
        </>
      )}
      {/* Said aloud when the review comes back. */}
      <p aria-live="polite" className="sr-only">
        {status === "ready" ? `AI review: ${count(counts[0], "highlight")}, ${count(counts[1], "red flag")}.` : ""}
      </p>
    </section>
  )
}

/** The notes of one kind, in the order they're printed. Pointing at one points at its words on the preview. */
function Notes({ lens, notes }: { lens: (typeof LENSES)[number]; notes: PlacedNote[] }) {
  const { report } = useCheck()
  const { active, point, pin, open } = useAiReview()
  if (notes.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-ink">
        {lens === "redFlags" ? "No red flags. Nice." : "Nothing stood out yet. Numbers and names help."}
      </p>
    )
  }
  return (
    <ul className="-mx-2 flex flex-col">
      {notes.map((note) => (
        <li key={note.key}>
          <button
            type="button"
            data-note
            onClick={() => {
              pin(note.key, "panel")
              open(note)
            }}
            onMouseEnter={() => point(note.key, "panel")}
            onMouseLeave={() => point(null)}
            onFocus={() => point(note.key, "panel")}
            onBlur={() => point(null)}
            className={`flex w-full flex-col items-start gap-1 rounded-[4px] px-2 py-2 text-left transition-colors hover:bg-sheet ${
              active === note.key ? "bg-sheet" : ""
            }`}
          >
            <span className="w-full truncate font-mono text-[11px] text-ink-2">{describePlace(report.view, note.place)}</span>
            <span className="text-[13px] leading-snug text-ink">
              <span className="underline decoration-2 underline-offset-[3px]" style={{ textDecorationColor: TONES[lens].stroke }}>
                {note.quote}
              </span>
            </span>
            <span className="text-[13px] leading-snug text-ink-2">{note.note}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
