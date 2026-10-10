"use client"

import type React from "react"
import { Fragment, useEffect, useRef } from "react"

interface Words {
  text: string
  className: string
  /** Where in the scroll the words start and end coming into focus, from 0 to 1. */
  from: number
  to: number
  /**
   * How faint a word is before it's in focus, as an opacity. Its color still
   * has to stand out from the background enough to read, for the line's size
   * (WCAG's 3:1 for large text, 4.5:1 for the rest): the blur is what shows
   * the words aren't there yet.
   */
  faint: number
}

// The scroll the words come into focus over: from the heading's top at 90%
// of the way down the screen, to its top at 35%.
const START = 0.9
const END = 0.35

/**
 * Lines of words that come into focus one after another, each from a blur,
 * as the page scrolls them up the screen; the scroll, not a timer, sets how
 * far. Screen readers get the plain text, and so does anyone who asks for
 * less motion, from the start.
 */
export default function FocusWords({ lines, children }: { lines: Words[]; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)")
    if (!element) return
    let frame = 0
    const update = () => {
      frame = 0
      // Measured from the first line, so a tall block on a short screen still finishes.
      const top = (element.firstElementChild ?? element).getBoundingClientRect().top
      const height = window.innerHeight
      const progress = motion.matches ? Math.min(1, Math.max(0, (height * START - top) / (height * (START - END)))) : 1
      element.style.setProperty("--focus", String(progress))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    motion.addEventListener("change", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      motion.removeEventListener("change", schedule)
    }
  }, [])

  return (
    <div ref={ref} className="flex flex-col gap-8">
      {lines.map((line) => {
        const words = line.text.split(" ")
        return (
          <p key={line.text} className={line.className}>
            <span className="sr-only">{line.text}</span>
            <span
              aria-hidden="true"
              style={{ "--from": line.from, "--to": line.to, "--n": words.length, "--faint": line.faint } as React.CSSProperties}
              className="focus-line"
            >
              {words.map((word, index) => (
                <Fragment key={index}>
                  {index > 0 && " "}
                  <span className="focus-word" style={{ "--i": index } as React.CSSProperties}>
                    {word}
                  </span>
                </Fragment>
              ))}
            </span>
          </p>
        )
      })}
      {children}
    </div>
  )
}
