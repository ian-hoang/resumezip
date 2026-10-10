"use client"

import { useEffect, useState } from "react"
import { StartWritingLink } from "@/components/site/StartWriting"

/**
 * A small "Start writing" that follows the page down, over a blur that
 * thickens toward the bottom of the screen. It keeps out of the way where
 * there's one already: over the hero, which has its own, and the footer.
 * It's last in the page, so the hero's link comes first to the keyboard.
 */
export default function FloatingStart() {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const hero = document.querySelector("[data-hero]")
    const footer = document.querySelector("footer")
    if (!hero || !footer) return
    const over = { hero: true, footer: false }
    // The hero counts until its bottom is in the screen's top half; the footer from its first line in sight.
    const heroWatch = new IntersectionObserver(
      ([entry]) => {
        over.hero = entry.isIntersecting
        setShown(!over.hero && !over.footer)
      },
      { rootMargin: "0px 0px -50% 0px" },
    )
    const footerWatch = new IntersectionObserver(([entry]) => {
      over.footer = entry.isIntersecting
      setShown(!over.hero && !over.footer)
    })
    heroWatch.observe(hero)
    footerWatch.observe(footer)
    return () => {
      heroWatch.disconnect()
      footerWatch.disconnect()
    }
  }, [])

  return (
    <>
      <div aria-hidden="true" className="floating-blur" data-shown={shown || undefined}>
        <span />
        <span />
        <span />
      </div>
      {/* Hidden, it's out of the way of the keyboard and screen readers too. */}
      <div
        className={`fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-5 transition-[opacity,transform,visibility] duration-300 ease-glide motion-reduce:transition-none ${
          shown ? "" : "invisible translate-y-3 opacity-0"
        }`}
      >
        <StartWritingLink
          preloadOnHover
          className="group flex items-center gap-4 rounded-full bg-ink py-1.5 pl-6 pr-1.5 text-white shadow-[0_18px_40px_-14px_rgba(17,19,24,0.55)] transition-colors hover:bg-black"
        >
          <span className="whitespace-nowrap text-[16px] tracking-[-0.015em]">Start writing. It’s free.</span>
          <span
            aria-hidden="true"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-medium text-ink transition-colors group-hover:bg-white/85"
          >
            Start
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l6-6M4 3h5v5" />
            </svg>
          </span>
        </StartWritingLink>
      </div>
    </>
  )
}
