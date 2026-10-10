"use client"

import type React from "react"
import { useEffect, useRef } from "react"

// How far, in px, the parts marked magnet-pull lean toward the cursor at most, and how much of the cursor's distance from the middle they follow.
const REACH = 6
const FOLLOW = 0.12

/**
 * Leans what's inside, the parts with the magnet-pull class, a few pixels
 * toward a mouse moving over it, and springs back as it leaves. The area
 * itself stays put, so what's clicked doesn't move under the cursor. Only
 * for a mouse or trackpad, and not for people who ask for less motion.
 */
export default function Magnetic({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const allowed = useRef(false)

  useEffect(() => {
    const query = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)")
    const sync = () => {
      allowed.current = query.matches
      if (query.matches) return
      ref.current?.style.removeProperty("--mx")
      ref.current?.style.removeProperty("--my")
    }
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  const lean = (x: number, y: number) => {
    ref.current?.style.setProperty("--mx", `${x}px`)
    ref.current?.style.setProperty("--my", `${y}px`)
  }

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(event) => {
        if (!allowed.current || event.pointerType !== "mouse") return
        const box = event.currentTarget.getBoundingClientRect()
        const clamp = (value: number) => Math.max(-REACH, Math.min(REACH, value * FOLLOW))
        lean(clamp(event.clientX - (box.left + box.width / 2)), clamp(event.clientY - (box.top + box.height / 2)))
      }}
      onPointerLeave={() => lean(0, 0)}
    >
      {children}
    </div>
  )
}
