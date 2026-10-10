"use client"

import { useEffect, useState } from "react"
import { nextFailure, type Failure } from "@/components/site/DownloadFailed"
import type { ResumeWithId } from "@/lib/resume"
import { downloadResume } from "@/lib/typst/compile"

// How long a Download button says "Downloaded" before going back to how it was.
const DOWNLOADED_MS = 2000
// How long a new copy stands out in the list.
const COPIED_MS = 2500

export const nameOf = (resume: ResumeWithId) => resume.resumeTitle || "Untitled resume"

// Both views can have more than one copy of a control on the page, one of
// them hidden (the table and the phone cards), so this finds the one showing.
export function focusShown(selector: string) {
  const shown = [...document.querySelectorAll<HTMLElement>(selector)].find((element) => element.offsetParent !== null)
  shown?.focus()
}

interface Options {
  /** Adds a copy of the resume, and returns its id. */
  onDuplicate: (resume: ResumeWithId) => string | undefined
  onRename: (resume: ResumeWithId, title: string) => void
  /** Says something aloud, in the page's live region. */
  announce: (text: string) => void
}

/**
 * What the dashboard's pages and list share: downloading each resume,
 * copying one, and renaming one in place. Kept by the page, so switching
 * between them keeps a download's "Downloaded" or a name half typed.
 */
export function useListActions({ onDuplicate, onRename, announce }: Options) {
  // Ids of the resumes downloading, and why each one whose last download failed did.
  const [downloading, setDownloading] = useState<string[]>([])
  const [failed, setFailed] = useState<Record<string, Failure>>({})
  // When each resume just downloaded finished, by id.
  const [downloaded, setDownloaded] = useState<Record<string, number>>({})
  // The resume being renamed, and the name typed so far.
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null)
  // The copy just made, which stands out for a moment.
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!copied) return
    // Focus moves to the copy.
    requestAnimationFrame(() => focusShown(`[data-resume-link="${CSS.escape(copied)}"]`))
    const timer = setTimeout(() => setCopied(null), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const duplicate = (resume: ResumeWithId) => {
    const id = onDuplicate(resume)
    if (!id) return
    setCopied(id)
    announce(`Made a copy of ${nameOf(resume)}`)
  }

  // Enter or leaving the box saves the name; Escape keeps the old one. After
  // Enter or Escape, focus goes back to what started it (data-rename); leaving
  // the box leaves it wherever it went.
  const finishRenaming = (resume: ResumeWithId, save: boolean, refocus: boolean) => {
    if (renaming?.id !== resume.id) return
    if (save) onRename(resume, renaming.draft)
    setRenaming(null)
    if (refocus) requestAnimationFrame(() => focusShown(`[data-rename="${CSS.escape(resume.id)}"]`))
  }

  const download = async (resume: ResumeWithId) => {
    // Each try takes back the resume's last "Downloaded", so it never shows beside a failure.
    setDownloaded(({ [resume.id]: _, ...others }) => others)
    setDownloading((ids) => [...ids, resume.id])
    try {
      await downloadResume(resume)
      setFailed(({ [resume.id]: _, ...others }) => others)
      const at = Date.now()
      setDownloaded((all) => ({ ...all, [resume.id]: at }))
      announce(`Downloaded ${nameOf(resume)}`)
      // Only this download's confirmation goes; a newer one keeps its two seconds.
      setTimeout(
        () =>
          setDownloaded((all) => {
            if (all[resume.id] !== at) return all
            const { [resume.id]: _, ...others } = all
            return others
          }),
        DOWNLOADED_MS,
      )
    } catch (error) {
      console.error("Failed to build PDF:", error)
      setFailed((all) => ({ ...all, [resume.id]: nextFailure(all[resume.id], error) }))
    } finally {
      setDownloading((ids) => ids.filter((id) => id !== resume.id))
    }
  }

  return { downloading, failed, downloaded, renaming, setRenaming, finishRenaming, copied, duplicate, download }
}

export type ListActions = ReturnType<typeof useListActions>
