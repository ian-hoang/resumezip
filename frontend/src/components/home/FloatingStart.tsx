"use client"

import { StartWritingLink } from "@/components/site/StartWriting"

/**
 * A small "Start writing" at the foot of the screen, over a blur that thickens
 * toward the bottom of the screen. The story (HomeStory.tsx) shows it while
 * there's no other on screen: between the first screen's and the way in's.
 * It's last in the story, so the first screen's link comes first to the keyboard.
 */
export default function FloatingStart({ shown }: { shown: boolean }) {
  return (
    <>
      <div aria-hidden="true" className="floating-blur" data-shown={shown || undefined}>
        <span />
        <span />
        <span />
      </div>
      {/* Hidden, it's out of the way of the keyboard and screen readers too. */}
      <div
        // It slides up from under the foot of the screen rather than fading in: it's glass, which stops blurring while see-through.
        className={`fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-5 transition-[transform,visibility] duration-300 ease-glide motion-reduce:transition-none ${
          shown ? "" : "invisible translate-y-28"
        }`}
      >
        <StartWritingLink
          preloadOnHover
          className="glass glass-float group flex items-center gap-4 rounded-full py-1.5 pl-6 pr-1.5 text-ink transition-[scale] duration-150 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <span className="whitespace-nowrap text-[16px] tracking-[-0.015em]">Start writing. It’s free.</span>
          <span
            aria-hidden="true"
            className="ink-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-medium group-hover:brightness-[1.35]"
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
