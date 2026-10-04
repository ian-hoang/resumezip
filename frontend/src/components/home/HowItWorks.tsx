"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const STEPS = [
  { word: "Pick", text: "Choose a template. Switch any time.", art: "/how-it-works/pick.svg" },
  { word: "Write", text: "See the page update as you type.", art: "/how-it-works/write.svg" },
  { word: "Send", text: "Download the PDF and apply.", art: "/how-it-works/send.svg" },
]

// Pinning needs room to scroll, and is skipped for people who prefer less motion.
const STATIC_QUERY = "(prefers-reduced-motion: reduce), (max-height: 600px)"

const EASE = "transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"

/** Pins to the screen while you scroll past: the intro fades out, then the steps come in one at a time. */
export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)
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
      setShown(Math.min(STEPS.length, Math.floor(progress * (STEPS.length + 1))))
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
    <section ref={sectionRef} aria-labelledby="how" className={pinned ? "h-[300svh]" : undefined}>
      <div className={pinned ? "sticky top-0 flex h-svh flex-col overflow-hidden bg-white" : "bg-white"}>
        <div className="border-b border-[#d4d4d4]">
          <div className="flex items-center justify-between px-5 py-7 md:px-10">
            <h2 id="how" className="label-section text-accent">
              How it works
            </h2>
            <span aria-hidden="true" className="label-section tabular-nums text-[#5c5c5c]">
              {visible} / {STEPS.length}
            </span>
          </div>
        </div>

        <div className={pinned ? "relative min-h-0 flex-1" : undefined}>
          <div
            className={
              pinned
                ? `absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-white px-5 text-center ${EASE} ${
                    visible === 0 ? "opacity-100" : "pointer-events-none -translate-y-8 opacity-0"
                  }`
                : "flex flex-col items-center gap-5 px-5 py-16 text-center"
            }
          >
            <p className="font-serif text-5xl leading-[0.95] tracking-[-0.04em] md:text-[80px] md:leading-[0.92]">
              Pick. Write. Send.
            </p>
            <p className="text-xl leading-[1.35] tracking-[-0.015em] text-[#5c5c5c]">From a blank page to a finished PDF.</p>
          </div>

          <div className={`grid md:grid-cols-3 ${pinned ? "h-full grid-rows-3 md:grid-rows-1" : "border-t border-[#d4d4d4]"}`}>
            {STEPS.map((step, index) => (
              <div
                key={step.word}
                className={`min-h-0 overflow-hidden border-[#d4d4d4] ${index > 0 ? "border-t md:border-l md:border-t-0" : ""}`}
              >
                <div
                  className={`flex h-full gap-4 bg-white px-5 py-6 md:flex-col md:gap-3 md:px-10 md:pb-10 md:pt-8 ${EASE} ${
                    index < visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none md:gap-3">
                    <span className="font-serif text-[36px] leading-none text-accent md:text-[64px]">{index + 1}</span>
                    <span className="font-serif text-[44px] leading-[0.95] tracking-[-0.03em] md:text-[80px]">{step.word}</span>
                    <p className="mt-1 max-w-[300px] text-base leading-[1.35] tracking-[-0.015em] text-[#5c5c5c] md:mt-2 md:text-xl">
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
