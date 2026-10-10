"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const STEPS = [
  {
    word: "Pick",
    // No count: it changes as templates are added.
    text: "Choose a template. Switch any time; your words stay put.",
    art: "/how-it-works/pick.svg",
  },
  {
    word: "Write",
    text: "Type beside a live page. Start from scratch, or open the PDF or Word resume you already have.",
    art: "/how-it-works/write.svg",
  },
  { word: "Send", text: "Download an ATS-friendly PDF so hiring software can read every word.", art: "/how-it-works/send.svg" },
]

// Pinning needs room to scroll, and is skipped for people who prefer less motion.
const STATIC_QUERY = "(prefers-reduced-motion: reduce), (max-height: 600px)"

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const easeOut = (value: number) => 1 - (1 - value) ** 3

// Where each part is follows the scroll (--k, 0 to 1), and a short transition
// smooths the steps between scroll events, as a mouse wheel's.
const SCRUB =
  "will-change-[opacity,translate] [opacity:var(--k,0)] [translate:0_calc((1-var(--k,0))*var(--rise))] transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none"

/** Pins to the screen while you scroll past: the intro fades out, then the steps come in one at a time. */
export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [pinned, setPinned] = useState(true)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const query = window.matchMedia(STATIC_QUERY)
    const sync = () => setPinned(!query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!pinned || !section) return
    let frame = 0
    const update = () => {
      frame = 0
      const scrollable = section.offsetHeight - window.innerHeight
      const progress = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / scrollable))
      // The intro gets the first slice of the scroll, then each step gets one.
      const at = progress * (STEPS.length + 1)
      // Set on the elements, not through state, so each frame doesn't re-render the section.
      introRef.current?.style.setProperty("--k", String(easeOut(clamp((at - 0.45) / 0.5))))
      let count = 0
      cardRefs.current.forEach((card, index) => {
        const k = easeOut(clamp((at - index - 0.55) / 0.6))
        card?.style.setProperty("--k", String(k))
        if (k >= 0.5) count++
      })
      setShown(count)
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
  }, [pinned])

  const visible = pinned ? shown : STEPS.length

  return (
    <section ref={sectionRef} aria-labelledby="how" data-tone="light" data-tick className={`desk ${pinned ? "h-[300svh]" : ""}`}>
      <div className={pinned ? "sticky top-0 flex h-svh flex-col overflow-hidden" : undefined}>
        <div className="flex items-center justify-between px-5 py-7 md:px-10">
          <h2 id="how" className="label-section text-accent">
            How it works
          </h2>
          <span aria-hidden="true" className="label-section tabular-nums text-ink-2">
            {visible} / {STEPS.length}
          </span>
        </div>

        <div className={pinned ? "relative min-h-0 flex-1" : undefined}>
          <div
            ref={introRef}
            className={
              pinned
                ? // The intro goes as the steps come: up and out, the other way to them.
                  `absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-5 text-center will-change-[opacity,translate] [opacity:calc(1-var(--k,0))] [translate:0_calc(var(--k,0)*-2rem)] transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none ${
                    visible === 0 ? "" : "pointer-events-none"
                  }`
                : "flex flex-col items-center gap-5 px-5 pb-16 pt-8 text-center"
            }
          >
            <p className="font-serif text-5xl leading-[0.95] tracking-[-0.04em] md:text-[80px] md:leading-[0.92]">Pick. Write. Send.</p>
            <p className="text-xl leading-[1.35] tracking-[-0.015em] text-ink-2">From a blank page to a finished PDF.</p>
          </div>

          <div
            className={`grid gap-3 px-3 md:grid-cols-3 md:gap-5 md:px-10 ${pinned ? "h-full grid-rows-3 pb-3 md:grid-rows-1 md:pb-10" : "pb-16"}`}
          >
            {STEPS.map((step, index) => (
              <div
                key={step.word}
                ref={(card) => {
                  cardRefs.current[index] = card
                }}
                className={`pane-etched flex min-h-0 gap-4 overflow-hidden px-5 py-5 md:flex-col md:gap-3 md:px-8 md:pb-8 md:pt-7 ${pinned ? `${SCRUB} [--rise:3rem]` : ""}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none md:gap-3">
                  {/* On phones the number sits beside the word, leaving the step's text room to fit. */}
                  <div className="flex items-baseline gap-3 md:flex-col md:items-start">
                    <span className="font-serif text-[36px] leading-none text-accent md:text-[64px]">{index + 1}</span>
                    <span className="font-serif text-[44px] leading-[0.95] tracking-[-0.03em] md:text-[80px]">{step.word}</span>
                  </div>
                  <p className="mt-1 max-w-[300px] text-base leading-[1.35] tracking-[-0.015em] text-ink-2 md:mt-2 md:text-xl">
                    {step.text}
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-center md:flex-1 md:items-end">
                  <Image
                    src={step.art}
                    alt=""
                    width={240}
                    height={240}
                    className="h-[clamp(88px,16svh,140px)] w-auto md:h-[clamp(140px,28svh,260px)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
