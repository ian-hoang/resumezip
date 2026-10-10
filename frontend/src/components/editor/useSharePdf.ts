"use client"

import { useEffect, useState } from "react"
import { nextFailure, type Failure } from "@/components/site/DownloadFailed"
import { canSharePdf } from "@/lib/saveFile"
import type { PdfFile } from "./usePdfFile"

/**
 * Share PDF, in the ▾ menu: hands the PDF to the system's share sheet, which
 * offers Files, email and the device's other apps. It's only there where the
 * browser can share files (`shareable`).
 *
 * Browsers only open the share sheet shortly after a press (transient
 * activation), and Safari has been strict about how shortly. So the PDF is
 * made as the menu opens (`prepare`, from usePdfFile), and is usually shared
 * in the press itself. If it isn't made yet, the ▾ spins (`making`) until it is.
 */
export function useSharePdf(prepare: () => PdfFile | null, onShared: () => void) {
  // Asked once the page is in the browser: it's prebuilt, where there's no browser to ask.
  const [shareable, setShareable] = useState(false)
  // From Share PDF being pressed: making the PDF, then with the share sheet open.
  const [step, setStep] = useState<"making" | "sharing" | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  useEffect(() => setShareable(canSharePdf()), [])

  const fail = (error: unknown, reason?: Failure["reason"]) => {
    console.error("Error sharing resume:", error)
    setFailure((previous) => nextFailure(previous, error, reason))
  }

  const share = async () => {
    if (step) return
    const next = prepare()
    if (!next) return
    let file = next.ready
    if (!file) {
      setStep("making")
      try {
        file = await next.file
      } catch (error) {
        setStep(null)
        fail(error)
        return
      }
    }
    setStep("sharing")
    try {
      // The file alone: given text as well, iPhones can leave the file out.
      await navigator.share({ files: [file] })
      setFailure(null)
      onShared()
    } catch (error) {
      // Closing the share sheet without sharing rejects with AbortError.
      if (!(error instanceof DOMException && error.name === "AbortError")) fail(error, "share")
    } finally {
      setStep(null)
    }
  }

  return { shareable, share, making: step === "making", sharing: step !== null, failure }
}
