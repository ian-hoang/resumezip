"use client"

import type React from "react"
import { useRef, useState } from "react"
import { createPortal } from "react-dom"

interface Words {
  text: string
  /** A number after the text, in grey, as a section's entries; none at 0. */
  count: number
}

interface Tip {
  /** Which button it's beside, so it shows that button's words as they are now. */
  key: string
  top: number
  left: number
}

/**
 * The name beside a button in the editor's rail of icons, while it's pointed
 * at or has the keyboard. The rail is narrow and its column clips, so the tip
 * is fixed to the window beside the button, in a portal. The button's own name
 * already says what it is, so the tip isn't read out again. `tip()` goes after
 * the buttons, so it shows their words from the same render: a count that
 * comes in while one's pointed at shows at once.
 */
export function useRailTip(on = true) {
  const [tip, setTip] = useState<Tip | null>(null)
  const words = useRef(new Map<string, Words>())

  const tipProps = (text: string, count = 0, key = text) => {
    words.current.set(key, { text, count })
    const show = (target: HTMLElement) => {
      if (!on) return
      const box = target.getBoundingClientRect()
      setTip({ key, top: box.top + box.height / 2, left: box.right + 10 })
    }
    return {
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) => show(event.currentTarget),
      onPointerLeave: () => setTip(null),
      onFocus: (event: React.FocusEvent<HTMLElement>) => show(event.currentTarget),
      onBlur: () => setTip(null),
    }
  }

  const tipShown = () => {
    const shown = tip && words.current.get(tip.key)
    if (!tip || !shown) return null
    return createPortal(
      <span
        aria-hidden="true"
        style={{ top: tip.top, left: tip.left }}
        className="pointer-events-none fixed z-50 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] text-white shadow-[0_8px_20px_-8px_rgb(17_19_24/0.45)]"
      >
        {shown.text}
        {shown.count > 0 && <span className="tabular-nums text-white/60">{shown.count}</span>}
      </span>,
      document.body,
    )
  }

  return { tipProps, tip: tipShown, hideTip: () => setTip(null) }
}
