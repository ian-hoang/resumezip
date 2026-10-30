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

/** Calls `then` with the next words picked in a box, if they're picked within `ms`. Returns what stops waiting. */
export function whenPickedInBox(then: (picked: PickedInBox) => void, ms = 1000): () => void {
  const stop = () => {
    clearTimeout(timer)
    unlisten()
  }
  const unlisten = onPickedInBox(() => {
    if (!picked) return
    stop()
    then(picked)
  })
  const timer = setTimeout(stop, ms)
  return stop
}

/** Marks the preview's toolbar: a press in it keeps the words picked. */
export const KEEPS_PICKED = "data-keeps-picked"
