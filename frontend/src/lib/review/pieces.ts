// The resume's text as it's sent to be reviewed: only what's printed, and
// only what a review needs. The profile (name, email, phone, location and
// links) stays in the browser, and so do the other links, places and a
// paper's authors, who are other people.

import { describePlace } from "@/lib/check/labels"
import { LINK_FIELDS, type Place } from "@/lib/check/places"
import { textsOf, type ResumeView } from "@/lib/check/resume"
import { spanOf } from "./match"
import { LIMITS, type Piece, type ReviewRequest } from "./review"

/** Fields that aren't sent: where someone lived and worked, and other people's names. */
const KEPT_HERE: ReadonlySet<string> = new Set([
  ...LINK_FIELDS,
  "schoolLocation",
  "workLocation",
  "volunteerLocation",
  "leadershipLocation",
  "publicationAuthors",
])

/** A piece of text that's sent, and where it is on the resume. */
export type PlacedPiece = Piece & { place: Extract<Place, { kind: "entry" }> }

/** The pieces of a resume that are sent to be reviewed, in the order they're printed. */
export function piecesOf(view: ResumeView): PlacedPiece[] {
  const pieces: PlacedPiece[] = []
  for (const { place, text } of textsOf(view)) {
    // Renamed section titles aren't worth a note.
    if (place.kind !== "entry" || !place.field || KEPT_HERE.has(place.field)) continue
    pieces.push({ id: `t${pieces.length + 1}`, where: describePlace(view, place).slice(0, LIMITS.whereLength), text: text.slice(0, LIMITS.pieceLength), place })
  }
  return pieces.slice(0, LIMITS.pieces)
}

type EntryPlace = PlacedPiece["place"]

const inField = (place: Place, field: EntryPlace): place is EntryPlace =>
  place.kind === "entry" && place.section === field.section && place.entry === field.entry && place.field === field.field

/**
 * Where words a note quotes are on the resume now: their place, the text
 * they're in, and its place in `texts` (`textsOf`), which is the order it's
 * printed in. At the note's place, or in another bullet of the same field, as
 * when a bullet is added above theirs. Null once they're gone, as when they're fixed.
 */
export function quotedNow(
  texts: readonly { place: Place; text: string }[],
  place: EntryPlace,
  quote: string,
): { place: EntryPlace; text: string; order: number } | null {
  const order = texts.findIndex((text) => inField(text.place, place) && text.place.line === place.line)
  if (order !== -1 && spanOf(texts[order].text, quote)) return { place, text: texts[order].text, order }
  if (place.line === undefined) return null
  for (const [index, { place: other, text }] of texts.entries()) {
    if (inField(other, place) && other.line !== undefined && spanOf(text, quote)) return { place: other, text, order: index }
  }
  return null
}

/** What's sent to be reviewed: the resume's type and its pieces, without their places. */
export function requestOf(view: ResumeView, pieces: readonly PlacedPiece[]): ReviewRequest {
  let total = 0
  const sent: Piece[] = []
  for (const { id, where, text } of pieces) {
    total += text.length
    if (total > LIMITS.totalLength) break
    sent.push({ id, where, text })
  }
  return { type: view.type, pieces: sent }
}
