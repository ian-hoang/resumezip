"use client"

import type React from "react"
import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { getStorage, hasSavedResumes } from "@/lib/resumeKeys"
import type { TemplateId } from "@/lib/templates"
import { loadCompiler, savingData } from "@/lib/typst/compile"
import { openPage } from "@/lib/viewTransition"

// How long a mouse rests on a link before it counts as reaching for it. One
// passing over it on the way somewhere else is there for less.
const RESTING_MS = 100

// The code that reads and saves resumes, only downloaded to start a new one:
// these links are on pages that don't otherwise need it.
const loadResumes = () => import("@/context/ResumeContext")

// Whether starting may make a new resume, rather than go to the dashboard.
// Saved resumes are looked for by their keys alone; reading them is for the
// dashboard.
const opensNew = (template?: TemplateId) => template !== undefined || !hasSavedResumes(getStorage())

/**
 * Starts the user writing. First-time visitors get a new resume straight away;
 * returning visitors go to their resumes. Picking a specific template always
 * starts a new resume with it, and the template's picture, `page`, carries
 * into the editor (lib/viewTransition.ts). `prepare`, for a moment before,
 * starts the downloads a new resume's editor needs.
 */
export function useStartWriting() {
  const router = useRouter()

  const start = useCallback(
    async (template?: TemplateId, page?: HTMLElement | null) => {
      const store = opensNew(template) ? (await loadResumes()).openResumes() : null
      // Resumes the browser couldn't save are only in the store, until the page is closed.
      if (!store || (template === undefined && Object.keys(store.getState().resumes).length > 0)) {
        router.push("/create/dashboard")
        return
      }
      const id = store.create("Untitled resume", "personal", template)
      // The editor's preview needs the PDF compiler and the template's fonts, so they start downloading now.
      loadCompiler(template)
      openPage(() => router.push(`/create/new/${id}`), page)
    },
    [router],
  )

  // The dashboard starts its own downloads, with the fonts of the resume edited last.
  const prepare = useCallback((template?: TemplateId) => {
    if (!opensNew(template)) return
    loadCompiler(template)
    void loadResumes()
  }, [])

  return { start, prepare }
}

// A click with a modifier key or another button is left to the browser, as on
// any link: it opens a new tab or window, or a menu.
export const plainClick = (event: React.MouseEvent) => !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0

interface StartWritingLinkProps {
  template?: TemplateId
  className?: string
  /**
   * Start the editor's downloads once a mouse rests on the link, a moment
   * before it's clicked. For "Start writing" links, not template pictures,
   * which people look over without meaning to start.
   */
  preloadOnHover?: boolean
  children: React.ReactNode
}

/**
 * A link that starts writing (see useStartWriting). Works as a plain link without JavaScript.
 * A mouse pressing it starts the editor's downloads before the click; a finger
 * doesn't, as scrolling the page starts with the same touch. A template's
 * link marks its picture with data-page, to carry it into the editor.
 */
export function StartWritingLink({ template, className, preloadOnHover = false, children }: StartWritingLinkProps) {
  const { start, prepare } = useStartWriting()
  const resting = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(resting.current), [])

  return (
    <a
      href="/create/dashboard"
      className={className}
      onPointerEnter={(event) => {
        // Visitors saving data only download the compiler once they press or click.
        if (!preloadOnHover || event.pointerType !== "mouse" || savingData()) return
        clearTimeout(resting.current)
        resting.current = setTimeout(() => prepare(template), RESTING_MS)
      }}
      onPointerLeave={() => clearTimeout(resting.current)}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && plainClick(event)) prepare(template)
      }}
      onClick={(event) => {
        if (!plainClick(event)) return
        event.preventDefault()
        void start(template, event.currentTarget.querySelector<HTMLElement>("[data-page]"))
      }}
    >
      {children}
    </a>
  )
}
