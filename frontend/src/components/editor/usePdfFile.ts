"use client"

import { useCallback, useRef } from "react"
import { useOpenResume } from "@/context/ResumeContext"
import type { Resume } from "@/lib/resume"
import { resolveSections } from "@/lib/resumeSections"
import { makePdfFile } from "@/lib/typst/compile"

/** The PDF of a resume, on its way or `ready`, and the resume it's made from. */
export interface PdfFile {
  from: Resume
  file: Promise<File>
  ready?: File
}

/**
 * Makes the open resume's PDF, with the resume attached, to hand to another
 * app: Share PDF and Save to Google Drive share it. The function it gives back
 * returns the PDF of the resume as it is now, and starts making it unless it's
 * made or on its way, so the resume is compiled once per change.
 */
export function usePdfFile(): () => PdfFile | null {
  const { read } = useOpenResume()
  const pdf = useRef<PdfFile | null>(null)

  return useCallback(() => {
    const from = read()
    if (!from) return null
    if (pdf.current?.from === from) return pdf.current
    // Made as Download PDF makes it.
    const next: PdfFile = { from, file: makePdfFile({ ...from, sectionOrder: resolveSections(from) }) }
    next.file.then(
      (file) => (next.ready = file),
      () => {
        // Made afresh next time.
        if (pdf.current === next) pdf.current = null
      },
    )
    pdf.current = next
    return next
  }, [read])
}
