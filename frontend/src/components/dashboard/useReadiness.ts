"use client"

import { useEffect, useState } from "react"
import type { ResumeWithId } from "@/lib/resume"

// Each resume object's answer, as it's new with every change.
const answers = new WeakMap<object, boolean>()

const idle = (run: () => void): (() => void) => {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(run, { timeout: 2_000 })
    return () => cancelIdleCallback(handle)
  }
  const handle = setTimeout(run, 50)
  return () => clearTimeout(handle)
}

/**
 * The ids of the resumes that are ready to send (readyCheck.ts). The checker
 * loads once `start` is true, and checks one resume each time the page is
 * idle, so it never holds up the page; until then, and while a changed
 * resume waits its turn, it isn't counted as ready.
 */
export function useReadiness(resumes: readonly ResumeWithId[], start: boolean): ReadonlySet<string> {
  const [ready, setReady] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!start) return
    let cancel = () => {}
    let stopped = false
    const publish = () =>
      setReady((before) => {
        const after = new Set(resumes.filter((resume) => answers.get(resume)).map((resume) => resume.id))
        return after.size === before.size && [...after].every((id) => before.has(id)) ? before : after
      })
    import("./readyCheck")
      .then(({ isReady }) => {
        const unchecked = resumes.filter((resume) => !answers.has(resume))
        const step = () => {
          if (stopped) return
          const resume = unchecked.shift()
          if (resume) {
            try {
              answers.set(resume, isReady(resume))
            } catch {
              // The checker logs a rule that breaks; anything else leaves the resume unstamped.
              answers.set(resume, false)
            }
          }
          publish()
          if (unchecked.length > 0) cancel = idle(step)
        }
        cancel = idle(step)
      })
      .catch(() => {
        // The checker's code didn't download: no stamps this visit.
      })
    return () => {
      stopped = true
      cancel()
    }
  }, [resumes, start])
  return ready
}
