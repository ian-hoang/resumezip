"use client"

import { useCallback, useDeferredValue, useMemo, useRef } from "react"
import { useResumeContext } from "@/context/ResumeContext"
import { runChecks, type Finding, type PdfReading } from "@/lib/check/engine"
import { addWord, CHECK_FIELD, changeCheck, dismiss, restore, type CheckState } from "@/lib/check/state"

/**
 * Checks the open resume as it changes. The checks run on a deferred copy of
 * it, so what's typed shows first and the findings follow. PDF rules run once
 * `pdf` (the latest preview, as the resume reader read it) is given.
 */
export function useResumeCheck(pdf?: PdfReading) {
  const { formData, updateFormData } = useResumeContext()
  const resume = useDeferredValue(formData)
  const report = useMemo(() => runChecks(resume, { pdf }), [resume, pdf])

  // Changes start from the resume as it is now, not as last checked.
  const latest = useRef({ formData, report })
  latest.current = { formData, report }
  const change = useCallback(
    (next: (state: CheckState) => CheckState) => {
      const value = changeCheck(latest.current.formData, next)
      if (value) updateFormData(CHECK_FIELD, value)
    },
    [updateFormData],
  )

  return {
    report,
    /** Dismisses a suggestion on this resume; fixes can't be dismissed. */
    dismiss: useCallback((finding: Finding) => change((state) => dismiss(state, finding, latest.current.report)), [change]),
    /** Brings a dismissed finding back. */
    restore: useCallback((finding: Finding) => change((state) => restore(state, finding.key)), [change]),
    /** Adds a word, so it isn't flagged as a typo on this resume. */
    addWord: useCallback((word: string) => change((state) => addWord(state, word)), [change]),
  }
}
