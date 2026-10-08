"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Flag, Highlighter, type LucideIcon } from "lucide-react"
import { textsOf } from "@/lib/check/resume"
import { piecesOf, quotedNow, requestOf, type PlacedPiece } from "@/lib/review/pieces"
import { readReview, type Note } from "@/lib/review/review"
import type { ActiveSection } from "./SectionNav"
import { useCheck } from "./CheckContext"

/** Which notes the preview shows: the words that stick, or the ones that hurt. */
export type Lens = "highlights" | "redFlags"

export const LENSES: Lens[] = ["highlights", "redFlags"]

/** How each kind of note looks, on the preview and in the Check panel. */
export const TONES: Record<Lens, { name: string; icon: LucideIcon; about: string; stroke: string; frame: string; ink: string; soft: string }> = {
  highlights: {
    name: "Highlights",
    icon: Highlighter,
    about: "The words that stick when a recruiter skims it in six seconds.",
    stroke: "#1fb3c4",
    frame: "bg-[#ddf5f7]",
    ink: "text-[#07707b]",
    soft: "bg-[#c4edf2]",
  },
  redFlags: {
    name: "Red flags",
    icon: Flag,
    about: "Buzzwords, filler and slips that make a recruiter move on. Fix them and they go.",
    stroke: "#e0357f",
    frame: "bg-[#fce6ef]",
    ink: "text-[#ac1f5c]",
    soft: "bg-[#f8cfe0]",
  },
}

/** A note on the resume as it is now: its words, and where they are. */
export interface PlacedNote extends Note {
  kind: Lens
  /** Tells notes apart while the review is shown. */
  key: string
  place: PlacedPiece["place"]
  /** The text the words are in now. */
  text: string
  /** Its place in the order the resume is printed. */
  order: number
}

type Status =
  | { state: "idle" }
  | { state: "reading" }
  | { state: "failed"; message: string }
  | { state: "ready"; notes: (Note & { kind: Lens; key: string; place: PlacedPiece["place"] })[]; sent: string }

interface AiReviewValue {
  status: Status["state"]
  /** Why the last review failed, in a sentence. */
  failure: string | null
  /** Asks for a review of the resume as it is now. */
  ask: () => void
  /** The notes whose words are still on the resume, in the order they're printed. */
  notes: PlacedNote[]
  /** Red flags whose words have gone since the review. */
  fixed: number
  /** The resume's text has changed since it was reviewed. */
  changed: boolean
  lens: Lens
  setLens: (lens: Lens) => void
  /** The note pointed at or chosen, from the panel or the preview, whose words stand out and whose note shows. */
  active: string | null
  /** Points at a note, or at none, as the pointer goes over it; `from` says where, so the preview can bring it into view when it's the panel. */
  point: (key: string | null, from?: "panel" | "preview") => void
  /** Chooses a note, or none, so it stays pointed at, as a tap on a touch screen does. */
  pin: (key: string | null, from?: "panel" | "preview") => void
  /** Where the note is being pointed at from. */
  pointedFrom: "panel" | "preview"
  /** Opens a note's section in the form. */
  open: (note: PlacedNote) => void
  /** Whether the preview shows the review: in Check, once there is one. */
  shown: boolean
}

const AiReviewContext = createContext<AiReviewValue | null>(null)

// What each answer from the review's server function means, in a sentence.
const FAILURES: Record<number, string> = {
  400: "This resume couldn't be sent for a review.",
  413: "This resume is too long to review.",
  429: "That's a lot of reviews. Try again in a few minutes.",
  502: "Claude didn't send a review back. Try again.",
  503: "AI feedback isn't available right now.",
}

/**
 * The AI review of the open resume (lib/review): it's asked for from the
 * Check panel, which lists it, and drawn on the preview while Check is open.
 * It's kept while the editor is open, and only its notes whose words are
 * still on the resume are shown, so a red flag goes once it's fixed.
 */
export function AiReviewProvider({ onSelect, children }: { onSelect: (section: ActiveSection) => void; children: React.ReactNode }) {
  const { report, mode } = useCheck()
  const view = report.view
  const [status, setStatus] = useState<Status>({ state: "idle" })
  const [lens, setLens] = useState<Lens>("highlights")
  type Pointing = { key: string | null; from: "panel" | "preview" }
  const [hovered, setHovered] = useState<Pointing>({ key: null, from: "preview" })
  const [pinned, setPinned] = useState<Pointing>({ key: null, from: "preview" })
  const asking = useRef<AbortController | null>(null)
  useEffect(() => () => asking.current?.abort(), [])

  const pieces = useMemo(() => piecesOf(view), [view])
  const request = useMemo(() => requestOf(view, pieces), [view, pieces])
  const now = useMemo(() => JSON.stringify(request), [request])

  const ask = useCallback(async () => {
    asking.current?.abort()
    const controller = new AbortController()
    asking.current = controller
    setStatus({ state: "reading" })
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: now,
        signal: controller.signal,
      })
      if (!response.ok) {
        setStatus({ state: "failed", message: FAILURES[response.status] ?? "Couldn't get a review. Try again." })
        return
      }
      // Checked again here, against what was sent, as the server's word isn't taken for it.
      const review = readReview(await response.json(), request.pieces)
      const places = new Map(pieces.map((piece) => [piece.id, piece.place]))
      const notes = LENSES.flatMap((kind) =>
        review[kind].map((note, index) => ({ ...note, kind, key: `${kind}:${index}`, place: places.get(note.id)! })),
      )
      setStatus({ state: "ready", notes, sent: now })
      setLens(review.highlights.length === 0 && review.redFlags.length > 0 ? "redFlags" : "highlights")
    } catch {
      if (controller.signal.aborted) return
      setStatus({ state: "failed", message: "Couldn't reach resumezip. Check your connection and try again." })
    }
  }, [now, request, pieces])

  // The notes whose words are still on the resume, where they are now.
  const texts = useMemo(() => textsOf(view), [view])
  const reviewed = status.state === "ready" ? status.notes : null
  const { notes, fixed } = useMemo(() => {
    if (!reviewed) return { notes: [], fixed: 0 }
    const notes: PlacedNote[] = []
    for (const note of reviewed) {
      const here = quotedNow(texts, note.place, note.quote)
      if (here) notes.push({ ...note, ...here })
    }
    notes.sort((a, b) => a.order - b.order)
    const fixed = reviewed.filter((note) => note.kind === "redFlags").length - notes.filter((note) => note.kind === "redFlags").length
    return { notes, fixed }
  }, [reviewed, texts])

  const point = useCallback((key: string | null, from: "panel" | "preview" = "preview") => setHovered({ key, from }), [])
  const pin = useCallback((key: string | null, from: "panel" | "preview" = "preview") => setPinned({ key, from }), [])
  const select = useRef(onSelect)
  select.current = onSelect
  const open = useCallback((note: PlacedNote) => select.current(note.place.section), [])
  const choose = useCallback((next: Lens) => {
    setLens(next)
    setPinned({ key: null, from: "preview" })
  }, [])

  // What the pointer's over, or else what was chosen, while its words are on the resume.
  const pointed = hovered.key !== null ? hovered : pinned
  const active = pointed.key !== null && notes.some((note) => note.key === pointed.key) ? pointed.key : null
  const value = useMemo<AiReviewValue>(
    () => ({
      status: status.state,
      failure: status.state === "failed" ? status.message : null,
      ask,
      notes,
      fixed,
      changed: status.state === "ready" && status.sent !== now,
      lens,
      setLens: choose,
      active,
      point,
      pin,
      pointedFrom: pointed.from,
      open,
      shown: mode === "check" && status.state === "ready",
    }),
    [status, ask, notes, fixed, now, lens, choose, active, point, pin, pointed.from, open, mode],
  )
  return <AiReviewContext.Provider value={value}>{children}</AiReviewContext.Provider>
}

export function useAiReview(): AiReviewValue {
  const review = useContext(AiReviewContext)
  if (!review) throw new Error("useAiReview must be used inside AiReviewProvider")
  return review
}
