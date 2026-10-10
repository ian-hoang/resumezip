"use client"

import type React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { Link2 } from "lucide-react"
import { paperIdOf } from "@/lib/papers/link"
import { lookUp } from "@/lib/papers/lookup"
import { publicationOf, type PublicationFields } from "@/lib/papers/publication"
import type { Entry } from "@/lib/resume"

type Reason = "no-doi" | "not-found" | "unreachable"

interface Problem {
  line: string
  reason: Reason
}

const MESSAGES: Record<Reason, string> = {
  "no-doi": "No DOI or arXiv ID in this. Try the paper’s DOI, which is usually on its page.",
  "not-found": "No paper found with this DOI.",
  unreachable: "Couldn’t reach the lookup service. Check your connection and try again.",
}

const papers = (count: number) => `${count} ${count === 1 ? "paper" : "papers"}`

/** What "Add by hand" fills in: the paper's DOI or link, or the text as its title when it isn't one. */
function byHand(line: string): Partial<PublicationFields> {
  const paper = paperIdOf(line)
  if (paper) return { publicationLink: paper.doi }
  return /\s/.test(line) ? { publicationTitle: line } : { publicationLink: line }
}

interface PaperFromLinkProps {
  /** The section's entries as they are now, to skip papers already in it. */
  entries: () => Entry[]
  /** The resume owner's name as it is now, kept in long author lists. */
  owner: () => string
  /** Adds papers as new entries. `show` brings the first into view. */
  onAdd: (papers: Partial<PublicationFields>[], show: boolean) => void
  /** The section's own add button, shown first. */
  children: React.ReactNode
}

/**
 * Adds publications from their DOIs or links, one per line. Each paper is
 * looked up in turn, and only its DOI leaves the browser.
 */
export default function PaperFromLink({ entries, owner, onAdd, children }: PaperFromLinkProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [progress, setProgress] = useState<{ at: number; of: number } | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [status, setStatus] = useState("")
  const stopper = useRef<AbortController | null>(null)
  const gone = useRef(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const panelId = useId()
  const noteId = useId()

  // Leaving the section stops a lookup, and adds nothing.
  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
      stopper.current?.abort()
    }
  }, [])

  // Opening the box puts the cursor in it. Closing it puts the focus back on
  // its button, unless it has moved on, to an entry that was just added.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) box.current?.focus()
    else if (wasOpen.current && (!document.activeElement || document.activeElement === document.body)) {
      toggle.current?.focus({ preventScroll: true })
    }
    wasOpen.current = open
  }, [open])

  const show = () => {
    setOpen(true)
    setStatus("")
  }

  // Closing while papers are being looked up cancels it, and adds nothing.
  const close = () => {
    stopper.current?.abort()
    stopper.current = null
    setProgress(null)
    setOpen(false)
    setText("")
    setProblems([])
  }

  const run = async () => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0 || progress) return
    const stop = new AbortController()
    stopper.current = stop
    setProblems([])
    setStatus("")

    // The DOIs in the list, read each time: entries can change while papers are looked up.
    const listed = () => new Set(entries().map((entry) => paperIdOf(entry.publicationLink ?? "")?.doi.toLowerCase()))
    const found: { doi: string; fields: PublicationFields }[] = []
    const failed: Problem[] = []
    const left: string[] = []
    let repeats = 0
    // One at a time: Crossref answers one request at a time from each visitor.
    for (const [index, line] of lines.entries()) {
      if (stop.signal.aborted) {
        left.push(line)
        continue
      }
      setProgress({ at: index + 1, of: lines.length })
      const paper = paperIdOf(line)
      if (!paper) {
        failed.push({ line, reason: "no-doi" })
        left.push(line)
        continue
      }
      const doi = paper.doi.toLowerCase()
      if (listed().has(doi) || found.some((other) => other.doi === doi)) {
        repeats++
        continue
      }
      try {
        const lookup = await lookUp(paper, stop.signal)
        if (lookup.found) {
          found.push({ doi, fields: publicationOf(lookup.work, paper, owner()) })
        } else {
          failed.push({ line, reason: lookup.reason })
          left.push(line)
        }
      } catch {
        // Stopped.
        left.push(line)
      }
    }
    const cancelled = stopper.current !== stop
    if (!cancelled) stopper.current = null
    if (gone.current || cancelled) return

    setProgress(null)
    const done = left.length === 0
    // Any put in the list by hand meanwhile count as already there.
    const inList = listed()
    const added = found.filter((paper) => !inList.has(paper.doi)).map((paper) => paper.fields)
    repeats += found.length - added.length
    if (added.length > 0) onAdd(added, done)
    setText(left.join("\n"))
    setProblems(failed)
    setStatus(
      [
        stop.signal.aborted && "Stopped.",
        added.length > 0 && `Added ${papers(added.length)}.`,
        repeats > 0 && `${papers(repeats)} ${repeats === 1 ? "was" : "were"} already in your list.`,
      ]
        .filter(Boolean)
        .join(" "),
    )
    if (done) setOpen(false)
  }

  const addByHand = (problem: Problem) => {
    const lines = text.split("\n")
    const at = lines.findIndex((line) => line.trim() === problem.line)
    if (at >= 0) lines.splice(at, 1)
    const rest = lines.join("\n").trim()
    const others = problems.filter((other) => other !== problem)
    const done = !rest && others.length === 0
    onAdd([byHand(problem.line)], done)
    setText(rest)
    setProblems(others)
    setStatus("")
    if (done) setOpen(false)
    else box.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation()
      if (progress) stopper.current?.abort()
      else close()
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && event.target === box.current) {
      event.preventDefault()
      void run()
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-3">
        {children}
        <button
          ref={toggle}
          type="button"
          onClick={open ? close : show}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-sheet/70 px-4 text-sm text-ink ring-1 ring-ink/15 transition-shadow hover:ring-ink/40"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          Add from DOI or link
        </button>
      </div>

      {open && (
        <div id={panelId} className="mt-5 flex flex-col gap-3 border-t border-ink pt-5" onKeyDown={onKeyDown}>
          <label className="flex flex-col gap-2">
            <span className="label-mono text-ink-2">DOI or link · one per line</span>
            <textarea
              ref={box}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setProblems([])
              }}
              readOnly={progress !== null}
              rows={3}
              placeholder={"10.1145/3580305.3599572\narxiv.org/abs/2202.01037"}
              aria-describedby={noteId}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full resize-y rounded-panel border border-rule bg-sheet px-4 py-3.5 font-mono text-[13px] leading-[1.7] text-ink outline-none transition-colors placeholder:text-ink-2/50 focus:border-accent focus-visible:outline-none"
            />
          </label>
          <p id={noteId} className="text-[13px] leading-normal text-ink-2">
            Only each paper’s DOI is sent, to Crossref or doi.org, to look it up. Nothing else from your resume leaves your browser.
          </p>

          {problems.length > 0 && (
            <ul className="flex flex-col gap-3">
              {problems.map((problem, index) => (
                <li
                  key={`${index}:${problem.line}`}
                  className="flex flex-col gap-1 border-l-2 border-[#b42318] pl-3 text-[13px] leading-normal"
                >
                  <span className="break-all font-mono text-ink">{problem.line}</span>
                  <span className="text-ink-2">{MESSAGES[problem.reason]}</span>
                  <button
                    type="button"
                    onClick={() => addByHand(problem)}
                    className="self-start py-1 text-sm text-ink underline underline-offset-4"
                  >
                    Add by hand
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* One button that turns into Stop, so it keeps the keyboard's focus. */}
            <button
              type="button"
              onClick={(event) => {
                // Safari does not focus buttons on pointer clicks. Keep focus
                // on this action as it changes between Add papers and Stop.
                event.currentTarget.focus({ preventScroll: true })
                if (progress) stopper.current?.abort()
                else void run()
              }}
              disabled={!progress && !text.trim()}
              className="h-10 rounded-full bg-ink px-[18px] text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {progress ? "Stop" : "Add papers"}
            </button>
            {!progress && (
              <button type="button" onClick={close} className="py-2 text-sm text-ink-2 transition-colors hover:text-ink">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <p role="status" className={`text-[13px] leading-normal text-ink-2 ${progress || status ? "mt-3" : ""}`}>
        {progress ? `Looking up ${progress.at} of ${progress.of}…` : status}
      </p>
    </div>
  )
}
