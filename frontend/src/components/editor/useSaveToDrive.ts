"use client"

import { useEffect, useRef, useState } from "react"
import { nextFailure, type Failure } from "@/components/site/DownloadFailed"
import { DriveError, SIGN_IN_CHANNEL, signInUrl, uploadPdf, type SignInAnswer } from "@/lib/googleDrive"
import type { PdfFile } from "./usePdfFile"

/** A PDF saved to Google Drive: its name, and the address that opens it there. */
export interface SavedToDrive {
  name: string
  link: string
}

// A token is used only while it has at least this long left, in milliseconds,
// so it doesn't run out during an upload.
const TOKEN_MARGIN_MS = 60_000

/**
 * Save to Google Drive, in the ▾ menu (see lib/googleDrive.ts). The first time,
 * it opens Google's sign-in in a window of its own, in the press itself, since
 * browsers block a window opened after a wait. Google's token is kept in memory
 * until it runs out, so later saves go straight to Drive. The PDF is made
 * while the person signs in. Once they have, it's `saving` until Drive has
 * it, then `saved` until `dismiss`.
 */
export function useSaveToDrive(prepare: () => PdfFile | null, onSaved: () => void) {
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [saved, setSaved] = useState<SavedToDrive | null>(null)
  const token = useRef<{ value: string; expiresAt: number } | null>(null)
  // Set as an upload starts. A press can come before the editor re-renders
  // with `saving`, as when Google's answer has only just arrived.
  const uploading = useRef(false)
  // The sign-in Google's window is open for, by its state, and what takes its answer.
  const waiting = useRef<{ state: string; answer: (answer: SignInAnswer | null) => void } | null>(null)

  // Answers for another sign-in, as another tab's, aren't this one's.
  useEffect(() => {
    const channel = new BroadcastChannel(SIGN_IN_CHANNEL)
    channel.onmessage = (event: MessageEvent<SignInAnswer>) => {
      const pending = waiting.current
      if (!pending || event.data?.state !== pending.state) return
      waiting.current = null
      pending.answer(event.data)
    }
    return () => {
      channel.close()
      waiting.current?.answer(null)
      waiting.current = null
    }
  }, [])

  const fail = (error: unknown, reason?: Failure["reason"]) => {
    console.error("Error saving resume to Google Drive:", error)
    setSaved(null)
    setFailure((previous) => nextFailure(previous, error, { reason }))
  }

  /**
   * Opens Google's sign-in, and gives its answer, or null once a later sign-in
   * takes its place. Closing the window gives no answer, so nothing waits on
   * it but this. Null at once if the browser blocked the window.
   */
  const signIn = (): Promise<SignInAnswer | null> | null => {
    const state = crypto.randomUUID()
    // Named, so pressing again while it's open uses the same window.
    const popup = window.open(signInUrl(window.location.origin, state), "google-drive", "popup,width=480,height=640")
    if (!popup) return null
    waiting.current?.answer(null)
    return new Promise((answer) => (waiting.current = { state, answer }))
  }

  const save = async () => {
    if (uploading.current) return
    // Starts making the PDF, while the person signs in.
    if (!prepare()) return
    let value = token.current && token.current.expiresAt - Date.now() > TOKEN_MARGIN_MS ? token.current.value : null
    if (!value) {
      const signingIn = signIn()
      if (!signingIn) return fail(new Error("The browser blocked Google's sign-in window"), "popup")
      const answer = await signingIn
      if (!answer) return
      if ("error" in answer) {
        // Declining says nothing, as closing the share sheet doesn't.
        if (answer.error !== "access_denied") fail(new Error(`Google's sign-in answered ${answer.error}`), "drive")
        return
      }
      token.current = { value: answer.token, expiresAt: Date.now() + answer.expiresIn * 1000 }
      value = answer.token
    }
    // The resume as it is now: it may have changed while Google's window was open.
    const pdf = prepare()
    if (!pdf || uploading.current) return
    uploading.current = true
    setSaving(true)
    setSaved(null)
    try {
      const file = await pdf.file
      const link = await uploadPdf(value, file)
      setFailure(null)
      setSaved({ name: file.name, link })
      onSaved()
    } catch (error) {
      if (error instanceof DriveError && error.failure === "signed-out") token.current = null
      fail(error, error instanceof DriveError ? error.failure : undefined)
    } finally {
      uploading.current = false
      setSaving(false)
    }
  }

  return { save, saving, failure, saved, dismiss: () => setSaved(null) }
}
