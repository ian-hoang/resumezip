"use client"

import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore } from "react"
import { KEEPS_PICKED, onPickedInBox, pickedInBox } from "./pickedStyle"
import { SelectionToolbar, type SelectedWords } from "./SelectionToolbar"
import { boxStylers } from "./StyledBox"

const noPick = () => null

/**
 * Bold, italic, underline and link buttons over words selected on the
 * preview, as over words selected in a box: they style the words in the box
 * that printed them, where they're lit up (fields.tsx), and the preview
 * prints them anew. `at` is where the words are on the preview.
 */
export function PickedToolbar({ at }: { at: Omit<SelectedWords, "style" | "link"> }) {
  const picked = useSyncExternalStore(onPickedInBox, pickedInBox, noPick)
  const [editingLink, setEditingLink] = useState<string | null>(null)
  // Styles are read from the box, which doesn't tell the toolbar it changed.
  const [, restyled] = useReducer((count: number) => count + 1, 0)
  const toolbar = useRef<HTMLDivElement>(null)
  const styler = picked && picked.box.isConnected ? boxStylers.get(picked.box) : undefined

  useLayoutEffect(() => {
    toolbar.current?.setAttribute(KEEPS_PICKED, "")
  })

  useEffect(() => {
    setEditingLink(null)
    if (!picked) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) picked.close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [picked])

  if (!picked || !styler) return null
  const { style, link } = styler.stylesOver(picked.start, picked.end)
  // The box draws the words anew, so the light on them is put back.
  const done = () => {
    picked.relight()
    restyled()
  }
  return (
    <SelectionToolbar
      words={{ ...at, style, link }}
      editingLink={editingLink}
      onToggle={(change) => {
        styler.toggle(picked.start, picked.end, change)
        done()
      }}
      onEditLink={() => setEditingLink(link)}
      onLink={(address) => {
        styler.link(picked.start, picked.end, address)
        setEditingLink(null)
        done()
      }}
      onCancelLink={() => setEditingLink(null)}
      onLeave={() => setEditingLink(null)}
      toolbarRef={toolbar}
    />
  )
}
