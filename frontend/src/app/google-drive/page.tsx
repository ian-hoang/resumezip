"use client"

import { useEffect } from "react"
import { answerIn, SIGN_IN_CHANNEL } from "@/lib/googleDrive"

/**
 * Where Google sends its sign-in window back to, from Save to Google Drive
 * (see lib/googleDrive.ts). It hands Google's answer to the editor and closes.
 * It only says something if it can't close, as when it was opened some other way.
 */
export default function GoogleDriveSignedIn() {
  useEffect(() => {
    const answer = answerIn(window.location.hash)
    // The token goes from the address, and so from the history, first.
    history.replaceState(null, "", window.location.pathname)
    if (!answer) return
    const channel = new BroadcastChannel(SIGN_IN_CHANNEL)
    channel.postMessage(answer)
    channel.close()
    window.close()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-5 text-center">
      <span className="label-mono text-ink-2">Google Drive</span>
      <p className="max-w-sm text-[17px] leading-relaxed text-ink">You can close this window and go back to your resume.</p>
    </main>
  )
}
