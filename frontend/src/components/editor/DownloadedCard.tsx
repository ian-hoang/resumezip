"use client"

import { useEffect, useRef, useState } from "react"

// How long the note shows, then how long it takes to go.
const SHOWN_MS = 2800
const LEAVING_MS = 320

interface DownloadedCardProps {
  /** The PDF's file name. */
  file: string
  /** Called once it has gone. */
  onClose: () => void
}

/**
 * A note that slides in after a PDF is downloaded, with a zipper closing
 * across its top (`.zip-strip` in styles/editor.css), to say the one thing
 * worth knowing about the file: it carries the resume, to be opened here
 * again. It's only a note: there's nothing to press, clicks go through it,
 * and it goes by itself after a moment. The editor says the download aloud
 * (its status), so a screen reader doesn't hear it twice. On wide screens it
 * drops in under Download PDF; narrower, it rises above the Edit / Preview
 * switch.
 */
export default function DownloadedCard({ file, onClose }: DownloadedCardProps) {
  const [leaving, setLeaving] = useState(false)
  // The latest one, so the timers below are about showing the note, not each render.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), SHOWN_MS)
    const gone = setTimeout(() => close.current(), SHOWN_MS + LEAVING_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(gone)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      data-downloaded-note
      // It slides into place (`starting:` is CSS @starting-style), up from the
      // foot of the screen or down from the button on wide screens, and fades
      // as it goes. It's over the page, so less shows through it than other glass.
      className={`glass glass-frost pointer-events-none fixed [--glass-fill:linear-gradient(180deg,rgb(255_255_255/0.9),rgb(255_255_255/0.82))] inset-x-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+64px)] z-40 overflow-hidden rounded-panel transition-[opacity,translate] ease-glide motion-reduce:transition-none starting:translate-y-3 starting:opacity-0 sm:left-auto sm:right-6 sm:w-[320px] xl:absolute xl:inset-x-auto xl:bottom-auto xl:right-0 xl:top-full xl:mt-3 xl:starting:-translate-y-2 ${
        leaving ? "translate-y-1 opacity-0 duration-300 xl:-translate-y-1" : "duration-500"
      }`}
    >
      <div className="zip-strip">
        <span className="zip-open" />
        <span className="zip-closed" />
        <span className="zip-pull" />
      </div>
      <div className="flex flex-col gap-1 px-5 pb-4 pt-3.5">
        <span className="label-mono text-ink-2">Downloaded</span>
        <p className="break-words text-[15px] font-medium leading-snug text-ink">{file}</p>
        <p className="text-[13px] leading-snug text-ink-2">Open it here on any computer to keep editing.</p>
      </div>
    </div>
  )
}
