"use client"

import { useEffect, useRef, useState } from "react"
import SiteHeader from "@/components/site/SiteHeader"

/**
 * What the home page's sections are drawn on, from their data-tone: "dark"
 * (the video, the footer), "blue" or "light" (paper and white). Sections
 * with data-tick also get a tick at the side of the page.
 */
type Tone = "dark" | "blue" | "light"

const toneOf = (element: Element): Tone => {
  const tone = element.getAttribute("data-tone")
  return tone === "dark" || tone === "blue" ? tone : "light"
}

/** The tone of the section at this height on the screen, in px from its top. */
function toneAt(y: number): Tone {
  for (const element of document.querySelectorAll("[data-tone]")) {
    const box = element.getBoundingClientRect()
    if (box.top <= y && box.bottom > y) return toneOf(element)
  }
  return "light"
}

// Where the pill's middle is, in px from the top of the screen once it's
// stuck there; the reading line's tone is taken just under the top edge.
const PILL_MIDDLE = 42
const LINE = 1
// Scrolling down tucks the pill away, and up brings it back, once this far
// past the hero's top. Any less, and a jittery trackpad would flick it.
const TUCK_AFTER_VH = 0.6
const TUCK_SCROLL_PX = 6

/**
 * The home page's header, its reading line and its section ticks. The pill
 * and the line ride in a sticky strip, so they start under the news bar and
 * then stay at the top of the screen; the line is how far down the page is.
 */
export default function HomeChrome() {
  const lineRef = useRef<HTMLDivElement>(null)
  const [pillTone, setPillTone] = useState<Tone>("dark")
  const [lineTone, setLineTone] = useState<Tone>("dark")
  const [tucked, setTucked] = useState(false)
  const [ticks, setTicks] = useState<{ count: number; current: number; tone: Tone }>({ count: 0, current: 0, tone: "dark" })

  useEffect(() => {
    let frame = 0
    let lastY = window.scrollY
    const update = () => {
      frame = 0
      const y = window.scrollY
      const height = window.innerHeight
      const scrollable = document.documentElement.scrollHeight - height
      lineRef.current?.style.setProperty("--read", String(scrollable > 0 ? Math.min(1, y / scrollable) : 0))
      setPillTone(toneAt(PILL_MIDDLE))
      setLineTone(toneAt(LINE))

      const delta = y - lastY
      if (y < height * TUCK_AFTER_VH) setTucked(false)
      else if (delta > TUCK_SCROLL_PX) setTucked(true)
      else if (delta < -TUCK_SCROLL_PX) setTucked(false)
      if (Math.abs(delta) > TUCK_SCROLL_PX || y < height * TUCK_AFTER_VH) lastY = y

      // The current section is the one across the middle of the screen, or the last one passed.
      const sections = [...document.querySelectorAll("[data-tick]")]
      const middle = height / 2
      let current = 0
      sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= middle) current = index
      })
      const tone = toneAt(middle)
      setTicks((ticks) =>
        ticks.count === sections.length && ticks.current === current && ticks.tone === tone
          ? ticks
          : { count: sections.length, current, tone },
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [])

  return (
    <>
      <div className="home-chrome sticky top-0 z-40 h-0">
        <div
          ref={lineRef}
          aria-hidden="true"
          className={`reading-line absolute inset-x-0 top-0 h-[2px] ${lineTone === "blue" ? "bg-white" : "bg-accent"}`}
        />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center md:inset-x-0 md:top-4 [&>*]:pointer-events-auto">
          <SiteHeader variant="glass" tone={pillTone === "dark" ? "dark" : "light"} tucked={tucked} starOnGitHub />
        </div>
      </div>

      {/* Decoration only: the headings say where each section starts. */}
      <div
        aria-hidden="true"
        className={`fixed left-3.5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 md:flex ${ticks.tone === "light" ? "text-ink" : "text-white"}`}
      >
        {Array.from({ length: ticks.count }, (_, index) => (
          <span
            key={index}
            className={`h-px bg-current transition-[width,opacity] duration-300 ease-glide motion-reduce:transition-none ${
              index === ticks.current ? "w-5 opacity-100" : "w-2.5 opacity-50"
            }`}
          />
        ))}
      </div>
    </>
  )
}
