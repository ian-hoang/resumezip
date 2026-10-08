// What's sent to be reviewed and what comes back, and the checks on both. The
// server checks what it's sent before anything goes to Claude, and both ends
// check what Claude sends back: a note is kept only if the words it quotes
// are on the resume, in the piece of text it names.

import type { ResumeType } from "@/lib/check/resume"
import { spanOf } from "./match"

/** A piece of the resume's text, as sent to be reviewed. */
export interface Piece {
  /** "t1", "t2"…, in the order they're printed. */
  id: string
  /** Where it is, in a few words: "Experience → Google · bullet 2". */
  where: string
  text: string
}

export interface ReviewRequest {
  type: ResumeType
  pieces: Piece[]
}

/** Something said about a few words of the resume. */
export interface Note {
  /** The piece the words are in. */
  id: string
  /** The words, exactly as they are in the piece. */
  quote: string
  /** Why they stand out, to the person. */
  note: string
}

export interface Review {
  /** The words that stick in a recruiter's quick scan. */
  highlights: Note[]
  /** The words that make a recruiter move on. */
  redFlags: Note[]
}

export const LIMITS = {
  /** A long resume is a few hundred pieces of text at most. */
  pieces: 300,
  /** Characters in one piece: a long summary. */
  pieceLength: 2000,
  /** Characters in all of them: several pages. */
  totalLength: 40_000,
  /** Characters in a piece's `where`. */
  whereLength: 160,
  /** Bytes in a request, all of it. */
  body: 100_000,
  /** Notes of each kind that are kept. */
  notes: 8,
  /** Characters in a note. */
  noteLength: 400,
} as const

const TYPES: readonly ResumeType[] = ["professional", "personal", "academic"]
const ID = /^t\d{1,4}$/

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** A request to review a resume, if it is one and within the limits; null otherwise. */
export function readRequest(body: unknown): ReviewRequest | null {
  if (!isObject(body) || !TYPES.includes(body.type as ResumeType) || !Array.isArray(body.pieces)) return null
  if (body.pieces.length === 0 || body.pieces.length > LIMITS.pieces) return null
  const ids = new Set<string>()
  let total = 0
  const pieces: Piece[] = []
  for (const piece of body.pieces) {
    if (!isObject(piece)) return null
    const { id, where, text } = piece
    if (typeof id !== "string" || !ID.test(id) || ids.has(id)) return null
    if (typeof where !== "string" || where.length > LIMITS.whereLength) return null
    if (typeof text !== "string" || !text.trim() || text.length > LIMITS.pieceLength) return null
    total += text.length
    if (total > LIMITS.totalLength) return null
    ids.add(id)
    pieces.push({ id, where, text })
  }
  return { type: body.type as ResumeType, pieces }
}

// The notes of one kind that quote the resume, with each quote as the piece has it.
function notesFrom(value: unknown, pieces: ReadonlyMap<string, string>, taken: Set<string>): Note[] {
  if (!Array.isArray(value)) return []
  const notes: Note[] = []
  for (const item of value) {
    if (notes.length >= LIMITS.notes) break
    if (!isObject(item) || typeof item.id !== "string" || typeof item.quote !== "string" || typeof item.note !== "string") continue
    const text = pieces.get(item.id)
    const note = item.note.trim().replace(/\s+/g, " ")
    if (text === undefined || !note) continue
    const span = spanOf(text, item.quote)
    if (!span) continue
    const quote = text.slice(...span)
    // The same words said about twice, or as both a highlight and a red flag: the first.
    const key = `${item.id}|${span.join(":")}`
    if (taken.has(key)) continue
    taken.add(key)
    notes.push({ id: item.id, quote, note: note.length > LIMITS.noteLength ? `${note.slice(0, LIMITS.noteLength - 1).trimEnd()}…` : note })
  }
  return notes
}

/** What Claude said about the resume, keeping only the notes on words that are in it. */
export function readReview(value: unknown, pieces: readonly Pick<Piece, "id" | "text">[]): Review {
  const texts = new Map(pieces.map((piece) => [piece.id, piece.text]))
  const taken = new Set<string>()
  const review = isObject(value) ? value : {}
  // Red flags first, so words that are both are the thing to fix.
  const redFlags = notesFrom(review.redFlags, texts, taken)
  const highlights = notesFrom(review.highlights, texts, taken)
  return { highlights, redFlags }
}
