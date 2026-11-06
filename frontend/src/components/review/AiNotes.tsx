"use client"

import { useId, useState } from "react"
import { Clock, RotateCcw } from "lucide-react"
import { Squares } from "@/components/site/Loader"
import type { Problem } from "@/lib/review/ai/problems"
import { TONE_NAMES } from "./notes"
import type { Ink, Note } from "./PageMarks"
import { STORM, SUN, type Picture } from "./weather/pictures"
import TextPicture from "./weather/TextPicture"

export type AiState =
  { step: "asking" } | { step: "done"; notes: Note[] } | { step: "problem"; reason: Exclude<Problem, "off">; message: string }

// The problem's headline, its last words set in italic; the line under it, when the message would only repeat it.
// prettier-ignore
const PROBLEM_WORDS: Record<Exclude<Problem, "off">, { lead: string; stress: string; body?: string }> = {
  limit: { lead: "Give it", stress: "a few minutes.", body: "You’ve asked for a lot of AI notes in a short time." },
  busy: { lead: "Give it", stress: "a minute.", body: "The AI is busy right now." },
  lines: { lead: "Too long for", stress: "AI notes." },
  other: { lead: "AI notes", stress: "didn’t load." },
}

/** What the pill over the dock says when the AI notes couldn't be had. */
export const PILL_WORDS: Record<Exclude<Problem, "off">, string> = {
  limit: "AI notes are paused for a few minutes",
  busy: "The AI is busy, so here are the ATS checks",
  lines: "This resume is too long for AI notes",
  other: "AI notes didn’t load, so here are the ATS checks",
}

/** A short note in a dark pill, over the dock or under the header on the drop zone, that the person can put away. */
export function Pill({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="status" className="review-pill">
      <Clock aria-hidden="true" />
      <span>{children}</span>
      <button type="button" onClick={onClose}>
        OK
      </button>
    </div>
  )
}

type AiInk = Extract<Ink, "red" | "good">

// prettier-ignore
const TILES: Record<AiInk, { title: string; line: string; empty: string; picture: Picture }> = {
  red: { title: TONE_NAMES.red.many, line: "Lines a recruiter would trip on.", empty: "None found. Nice.", picture: STORM },
  good: { title: TONE_NAMES.green.many, line: "Lines that land. Keep them.", empty: "None stood out.", picture: SUN },
}

/** A tile for one kind of flag: its count, and its picture in text. Pressed, it's tall and its flags are listed. */
function Tile({ tone, count, pressed, onPress }: { tone: AiInk; count: number; pressed: boolean; onPress: () => void }) {
  const line = useId()
  const { title, line: words } = TILES[tone]
  return (
    <button type="button" className="review-tile" data-tone={tone} aria-pressed={pressed} aria-describedby={line} onClick={onPress}>
      {/* Named by its title and count, not an aria-label: axe wants a label to hold all
          the visible text, and the line is read as the description instead. */}
      <span className="review-tile-head">
        <span className="review-tile-title">{title}</span>
        <span className="sr-only">, </span>
        <span className="review-tile-count">{count}</span>
      </span>
      <span id={line} className="review-tile-line" aria-hidden="true">
        {words}
      </span>
      <TextPicture picture={TILES[tone].picture} className="review-tile-picture" />
    </button>
  )
}

/**
 * The AI's flags as two tiles, red flags and done well; the one pressed lists
 * its flags under them, each pointing at its mark. It opens on the red flags,
 * unless there are none and something was done well.
 */
function Flags({
  notes,
  showing,
  onShow,
  open,
  onOpen,
  onPick,
}: {
  notes: Note[]
  /** Whether the page is marked with the AI's notes: with the checks' instead, both tiles are shut and nothing is listed. */
  showing: boolean
  onShow: () => void
  open: string | null
  onOpen: (key: string | null) => void
  onPick: (note: Note) => void
}) {
  const of = (tone: AiInk) => notes.filter((note) => note.ink === tone)
  const [shown, setShown] = useState<AiInk>(() => (of("red").length === 0 && of("good").length > 0 ? "good" : "red"))
  const listed = of(shown)
  return (
    <div className="review-flags">
      <div role="group" aria-label="AI notes" className="flex flex-col gap-2">
        {(["red", "good"] as const).map((tone) => (
          <Tile
            key={tone}
            tone={tone}
            count={of(tone).length}
            pressed={showing && shown === tone}
            onPress={() => {
              setShown(tone)
              onShow()
            }}
          />
        ))}
      </div>
      {/* Keyed by the tile, so a new list comes in row by row. */}
      {showing && (
        <div key={shown} className="review-flag-list">
          {listed.length === 0 ? (
            <p className="text-ink-2">{TILES[shown].empty}</p>
          ) : (
            <ul aria-label={TILES[shown].title} className="flex flex-col">
              {listed.map((note, index) => (
                <li key={note.key} style={{ "--row": index } as React.CSSProperties}>
                  <button
                    type="button"
                    className="review-flag"
                    data-ink={note.ink}
                    data-open={open === note.key ? "" : undefined}
                    onMouseEnter={() => note.drawn && onOpen(note.key)}
                    onMouseLeave={() => open === note.key && onOpen(null)}
                    onClick={() => onPick(note)}
                  >
                    {note.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The AI's notes, beside the page: its red flags and what's done well, each
 * pointing at its mark. A tile pressed marks the page with them. They're
 * asked for as soon as the resume's pages are read, and the page opens with
 * them; "asking" shows only when they were long coming, or asked again.
 */
export default function AiNotes({
  state,
  onAsk,
  showing,
  onShow,
  open,
  onOpen,
  onPick,
}: {
  state: AiState
  onAsk: () => void
  showing: boolean
  onShow: () => void
  open: string | null
  onOpen: (key: string | null) => void
  onPick: (note: Note) => void
}) {
  if (state.step === "done")
    return <Flags notes={state.notes} showing={showing} onShow={onShow} open={open} onOpen={onOpen} onPick={onPick} />
  if (state.step === "asking") {
    return (
      <div role="status" className="review-ai">
        <p className="flex items-center gap-2.5 font-medium text-ink">
          <Squares />
          Getting notes from AI
        </p>
        <p className="mt-0.5 text-ink-2">They’ll show here when they come.</p>
      </div>
    )
  }
  const words = PROBLEM_WORDS[state.reason]
  return (
    <div className="review-ai">
      <p className="label-mono text-ink-2">AI notes</p>
      <p className="mt-1.5 text-balance font-serif text-[28px] leading-[1.05] tracking-[-0.03em] text-ink">
        {words.lead} <em className="text-accent">{words.stress}</em>
      </p>
      <p className="mt-2 text-[13px] text-ink-2">{words.body ?? state.message}</p>
      {state.reason !== "lines" && (
        <button type="button" onClick={onAsk} className="review-try mt-3">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  )
}
