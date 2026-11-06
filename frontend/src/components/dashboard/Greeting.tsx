"use client"

import { useEffect, useState } from "react"
import { firstName, timeOfDay } from "@/lib/greeting"
import type { ResumeWithId } from "@/lib/resume"

interface GreetingProps {
  /** The resumes shown, last edited first. */
  resumes: ResumeWithId[]
  loaded: boolean
}

/**
 * The dashboard's title, "Good morning, Marcus", by the visitor's clock and
 * the first name on the last edited resume that has one, in blue, and what to
 * do here under it. It's in the serif the site's other page titles are in.
 * The time is only known in the browser, and the name once the resumes are
 * read, so until then both keep their place, empty: the page as built doesn't
 * guess them, and its first render in the browser matches it.
 */
export default function Greeting({ resumes, loaded }: GreetingProps) {
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => setHour(new Date().getHours()), [])
  const ready = loaded && hour !== null
  const name = resumes.map((resume) => firstName(resume.profileSection?.fullName)).find(Boolean)

  return (
    <div className="mt-6 flex flex-col items-center gap-2 text-center sm:mt-9 md:mt-2.5">
      {/* Where it doesn't fit on a line, the name goes onto the next one, whole. */}
      <h1 className="max-w-full text-balance font-serif text-[32px] leading-[1.05] min-[400px]:text-[38px] tracking-[-0.025em] wrap-anywhere sm:text-[52px] md:text-[64px] md:leading-[1.02]">
        {ready ? (
          name ? (
            <>
              <span className="whitespace-nowrap">{timeOfDay(hour)},</span> <span className="text-accent">{name}</span>
            </>
          ) : (
            timeOfDay(hour)
          )
        ) : (
          " "
        )}
      </h1>
      <p className="text-balance text-[16px] leading-snug text-ink-3 md:text-[18.5px]">
        {!ready
          ? " "
          : resumes.length > 0
            ? "Pick up where you left off, or start a new one."
            : "No resumes yet. Start one, or open one you already have."}
      </p>
    </div>
  )
}
