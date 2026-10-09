"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useOpenResume, useResumeActions } from "@/context/ResumeContext"
import { runChecks, type Finding, type GrammarReading, type PdfReading } from "@/lib/check/engine"
import { addWord, CHECK_FIELD, changeCheck, dismiss, restore, type CheckState } from "@/lib/check/state"
import { hasLeftOut } from "@/lib/leftOut"
import type { Resume } from "@/lib/resume"

/**
 * The open resume as it was when its changes last paused for `delay`
 * milliseconds, so what follows it, like the checks, runs once typing pauses
 * rather than on every key. A change to what the person told the checker
 * (dismissing a finding, adding a word) shows at once. While the resume is
 * gone, as when another tab deletes it, it's the last one there was.
 */
export function usePausedResume(delay: number): Resume {
  const { subscribe } = useResumeActions()
  const { read } = useOpenResume()
  // Only shown with the resume open, so there's one to start from.
  const [resume, setResume] = useState(() => read() ?? {})
  useEffect(() => {
    let last = read()
    let timer: ReturnType<typeof setTimeout> | undefined
    // Anything changed between the first render and now is taken in at once.
    if (last) setResume(last)
    const unsubscribe = subscribe(() => {
      const next = read()
      if (!next || next === last) return
      const now = next[CHECK_FIELD] !== last?.[CHECK_FIELD]
      last = next
      clearTimeout(timer)
      if (now) setResume(next)
      else timer = setTimeout(() => setResume(next), delay)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [subscribe, read, delay])
  return resume
}

/**
 * Checks `resume` as it changes. The checks run on a deferred copy of it, so
 * what's typed shows first and the findings follow. PDF rules run once `pdf`
 * (the preview of `resume`, as the resume reader read it) is given, and
 * grammar rules once `grammar` (what the grammar checker found in each piece
 * of text) is. The changes it gives, like dismissing a finding, are made to
 * the open resume as it is now.
 */
export function useResumeCheck(resume: Resume, pdf?: PdfReading, grammar?: GrammarReading) {
  const { read, update } = useOpenResume()
  // `pdf` is of `resume`, so the two are deferred together: the PDF rules
  // never compare a resume with a PDF of another version, and a change doesn't
  // run the checks again on the old resume before the new.
  const latestInput = useMemo(() => ({ resume, pdf, grammar }), [resume, pdf, grammar])
  const input = useDeferredValue(latestInput)
  const report = useMemo(() => runChecks(input.resume, { pdf: input.pdf, grammar: input.grammar }), [input])

  const latestReport = useRef(report)
  latestReport.current = report
  // Changes start from the resume as it is now, not as last checked.
  const change = useCallback(
    (next: (state: CheckState) => CheckState) => {
      const resume = read()
      const value = resume && changeCheck(resume, next)
      if (value) update(CHECK_FIELD, value)
    },
    [read, update],
  )

  /**
   * Dismisses a suggestion on this resume; fixes can't be dismissed. Old
   * dismissals are tidied away only while nothing is left out of the PDF:
   * the checker doesn't see what's left out, so it would drop dismissals
   * that are needed again once it's put back.
   */
  const dismissFinding = useCallback(
    (finding: Finding) => change((state) => dismiss(state, finding, hasLeftOut(read() ?? {}) ? undefined : latestReport.current)),
    [change, read],
  )
  /** Brings a dismissed finding back. */
  const restoreFinding = useCallback((finding: Finding) => change((state) => restore(state, finding.key)), [change])
  /** Adds a word, so it isn't flagged as a typo on this resume. */
  const addKnownWord = useCallback((word: string) => change((state) => addWord(state, word)), [change])

  // The actions keep their identity for as long as the resume is open, so
  // what uses only them never re-renders with a new report.
  const actions = useMemo(
    () => ({ dismiss: dismissFinding, restore: restoreFinding, addWord: addKnownWord }),
    [dismissFinding, restoreFinding, addKnownWord],
  )
  /** The report, and the resume it's of. */
  return { report, checked: input.resume, actions }
}
