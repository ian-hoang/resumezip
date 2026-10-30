// Words picked on the preview that are lit up in a text box with bold and
// italic (fields.tsx), so the preview can show the toolbar over the words
// still selected there, and style them in the box (PdfPreview.tsx).

export interface PickedInBox {
  box: HTMLElement
  start: number
  end: number
  /** Lights the words up again, once the box has drawn them anew. */
  relight: () => void
  /** Puts the words out, as a press anywhere else does. */
  close: () => void
}

let picked: PickedInBox | null = null
const listeners = new Set<() => void>()

export const pickedInBox = () => picked

export function setPickedInBox(next: PickedInBox | null) {
  if (next === picked) return
  picked = next
  for (const listener of listeners) listener()
}

export function onPickedInBox(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Marks the preview's toolbar: a press in it keeps the words picked. */
export const KEEPS_PICKED = "data-keeps-picked"
