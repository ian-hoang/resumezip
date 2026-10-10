"use client"

import Image from "next/image"
import type React from "react"
import { useEffect, useRef, useState } from "react"

// The sample resume (Modern Jake's preview), and where its parts sit on the
// page, as percentages of its width and height, measured from the picture.
const PAGE = { src: "/previews/modernjack.webp", width: 1280, height: 1656 }

const PARTS: { label: string; top: number; height: number }[] = [
  { label: "Name & contact", top: 3.5, height: 6.5 },
  { label: "Education", top: 10, height: 8.3 },
  { label: "Experience", top: 19.3, height: 36.4 },
  { label: "Projects", top: 56.5, height: 14.3 },
  { label: "Skills", top: 71.5, height: 7.7 },
  { label: "Volunteering & awards", top: 79.6, height: 15.2 },
]

// What the checker would say about this page: real findings on its own lines.
const NOTES: { level: string; text: string; top: number }[] = [
  { level: "Worth a look", text: "Add a result: what changed because of this?", top: 33.1 },
  { level: "Worth a look", text: "Dates are written two ways here and in Stripe.", top: 58.6 },
]

// What's read off the page, as the importer and checker find it, each with the
// part it comes from (PARTS, by index), so it appears as that part is boxed.
const FIELDS: { label: string; value: string; part: number }[] = [
  { label: "Name", value: "Elena Petrova", part: 0 },
  { label: "Email", value: "elena.petrova@example.com", part: 0 },
  { label: "Location", value: "Austin, TX", part: 0 },
  { label: "Education", value: "UT Austin, B.S. 2022", part: 1 },
  { label: "Experience", value: "Stripe · Tesla · Amazon", part: 2 },
  { label: "Projects", value: "pgshard · Ledgerline", part: 3 },
  { label: "Skills", value: "Go, Python, Rust +11", part: 4 },
  { label: "Awards", value: "2", part: 5 },
]

const SCORE = 88

const STAGES = [
  { title: "Scanned like hiring software.", text: "The PDF is real text, so every word can be read, the way hiring software reads it." },
  { title: "Read into its parts.", text: "Your name and contact details, each section and each entry, found and put in its place." },
  { title: "Scored, with notes.", text: "A score out of 100, and what to look at, pinned to the line it's about." },
]

// Pinning needs room to scroll, and is skipped for people who prefer less motion.
// Laptops with a few toolbars open leave about 540px, so it still pins there.
const STATIC_QUERY = "(prefers-reduced-motion: reduce), (max-height: 460px)"

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * One resume, scanned, read into its parts and scored as the page scrolls
 * past: the section pins to the screen and each third of its scroll is a
 * stage. The scroll sets --scan, --parse and --score (0 to 1) on the section,
 * and the overlays draw from them in CSS, so nothing re-renders as it moves.
 * With less motion, or a short screen, it shows the finished check, still.
 */
export default function CheckDemo() {
  const sectionRef = useRef<HTMLElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const [pinned, setPinned] = useState(true)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const query = window.matchMedia(STATIC_QUERY)
    const sync = () => setPinned(!query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (!pinned) {
      for (const name of ["--scan", "--parse", "--score"]) section.style.setProperty(name, "1")
      if (scoreRef.current) scoreRef.current.textContent = String(SCORE)
      setStage(STAGES.length - 1)
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      // Measured over the stretch where the pinned part is stuck: after the fade
      // at the section's head (::before) and before the clouds at its foot (::after).
      const head = parseFloat(getComputedStyle(section, "::before").height) || 0
      const foot = parseFloat(getComputedStyle(section, "::after").height) || 0
      // At least 1, so a section no taller than the screen doesn't divide by 0.
      const scrollable = Math.max(1, section.offsetHeight - head - foot - window.innerHeight)
      const progress = clamp((-section.getBoundingClientRect().top - head) / scrollable)
      // Each stage gets a third of the scroll, with a little still time at the end of each.
      const at = progress * STAGES.length
      const part = (index: number) => clamp((at - index) / 0.85)
      section.style.setProperty("--scan", String(part(0)))
      section.style.setProperty("--parse", String(part(1)))
      section.style.setProperty("--score", String(part(2)))
      if (scoreRef.current) scoreRef.current.textContent = String(Math.round(SCORE * part(2)))
      setStage(Math.min(STAGES.length - 1, Math.floor(at)))
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

  return (
    <section
      ref={sectionRef}
      aria-labelledby="check-demo"
      data-tone="blue"
      data-tick
      className={`check-demo cloud-seam cloud-seam-top relative bg-accent text-white ${pinned ? "h-[320svh]" : ""}`}
    >
      <div // Unpinned, it still needs a height for the page to size itself in.
        className={pinned ? "sticky top-0 flex h-svh flex-col overflow-hidden" : "flex h-[max(640px,100svh)] flex-col"}
      >
        <div className="flex items-center justify-between px-5 py-7 md:px-10">
          <h2 id="check-demo" className="label-section">
            Checked as you write
          </h2>
          <span aria-hidden="true" className="label-section tabular-nums text-white">
            {stage + 1} / {STAGES.length}
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-6 px-5 pb-8 md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-1 md:gap-16 md:px-10 md:pb-12">
          {/* The stages' words, one at a time where it pins, in a stack so they swap in place. */}
          <div className="grid content-center">
            {STAGES.map((item, index) => (
              <div
                key={item.title}
                aria-hidden={pinned && index !== stage}
                className={`col-start-1 row-start-1 flex flex-col gap-4 transition-[opacity,translate] duration-500 ease-glide motion-reduce:transition-none ${
                  !pinned
                    ? index === STAGES.length - 1
                      ? ""
                      : "hidden"
                    : index === stage
                      ? ""
                      : "pointer-events-none translate-y-3 opacity-0"
                }`}
              >
                <p className="font-serif text-[40px] leading-[0.95] tracking-[-0.035em] md:text-[clamp(44px,9svh,72px)] md:leading-[0.92]">
                  {item.title}
                </p>
                {/* While it's read, what's read flies off the page into a list, beside the words on wide screens. */}
                <p
                  className={`max-w-[440px] text-base leading-[1.4] text-white md:text-xl md:leading-[1.35] ${index === 1 ? "md:hidden" : ""}`}
                >
                  {item.text}
                </p>
                {index === 1 && (
                  <dl className="mt-2 hidden w-full max-w-[440px] bg-white px-5 pb-2 pt-4 text-ink shadow-[0_24px_48px_-24px_rgb(10_20_70/0.6)] md:block">
                    <span className="label-mono mb-2 block text-accent">Read from the page</span>
                    {FIELDS.map((field, row) => (
                      <div
                        key={field.label}
                        className="check-field flex items-baseline justify-between gap-6 border-t border-rule py-[clamp(4px,1svh,8px)] text-[15px]"
                        style={{ "--i": field.part, "--row": row, "--n": PARTS.length } as React.CSSProperties}
                      >
                        <dt className="label-mono text-ink-2">{field.label}</dt>
                        <dd className="truncate text-right">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>

          {/* The page, with what the check finds drawn over it. On phones it's sized by width (0.773 is the
              page's width over its height), to fit both across and under the words. */}
          <div
            className="relative mx-auto w-[min(100%,calc((100svh-300px)*0.773))] self-center md:h-full md:max-h-[min(78svh,880px)] md:w-auto md:mr-[220px]"
            style={{ aspectRatio: `${PAGE.width} / ${PAGE.height}` }}
          >
            <div className="relative h-full w-full overflow-hidden bg-white shadow-[0_30px_60px_-30px_rgb(10_20_70/0.6)]">
              <Image
                src={PAGE.src}
                alt="A sample resume being checked"
                fill
                sizes="(min-width: 768px) 640px, 90vw"
                className="object-cover object-top"
              />

              {/* Scanned: what's been read takes a blue tint, under a bar of light moving down the page. */}
              <div aria-hidden="true" className="check-scanned absolute inset-x-0 top-0" />
              <div aria-hidden="true" className="check-scan-line absolute inset-x-0" />

              {/* Read: a box round each part, one after another, with its name. */}
              {PARTS.map((part, index) => (
                <div
                  key={part.label}
                  aria-hidden="true"
                  className="check-part absolute left-[3.5%] right-[3.5%]"
                  style={{ top: `${part.top}%`, height: `${part.height}%`, "--i": index, "--n": PARTS.length } as React.CSSProperties}
                >
                  <span className="check-part-label">{part.label}</span>
                </div>
              ))}

              {/* Scored: the lines a note is about. */}
              {NOTES.map((note, index) => (
                <div
                  key={note.text}
                  aria-hidden="true"
                  className="check-mark absolute left-[7%] right-[5%] h-[2.4%]"
                  style={{ top: `${note.top}%`, "--i": index } as React.CSSProperties}
                />
              ))}
            </div>

            {/* The notes, pinned beside their lines, and the score, over the page's corner. */}
            {NOTES.map((note, index) => (
              <p
                key={note.text}
                className="check-note absolute right-[-4%] w-[min(260px,62%)] bg-white px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-[0_14px_30px_-14px_rgb(10_20_70/0.55)] md:right-auto md:left-[calc(100%+20px)] md:w-[200px]"
                style={{ top: `calc(${note.top}% + 2.4%)`, "--i": index } as React.CSSProperties}
              >
                <span className="label-mono mb-1 block text-accent">{note.level}</span>
                {note.text}
              </p>
            ))}
            <div className="check-score pane-etched absolute bottom-[4%] left-[-6%] flex items-baseline gap-2.5 px-5 py-4 text-ink md:left-[-14%]">
              <span className="flex flex-col">
                <span className="label-mono text-ink-2">Resume score</span>
                <span className="mt-1 flex items-baseline gap-2">
                  <span
                    ref={scoreRef}
                    aria-hidden="true"
                    className="font-serif text-[52px] leading-[0.9] tracking-[-0.04em] tabular-nums md:text-[64px]"
                  >
                    0
                  </span>
                  <span className="label-mono text-ink-2" aria-hidden="true">
                    / 100
                  </span>
                  <span className="sr-only">
                    {SCORE} out of 100, Good. {NOTES.length} notes to look at.
                  </span>
                </span>
              </span>
              <span className="ml-2 font-serif text-2xl italic leading-none text-accent">Good</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
