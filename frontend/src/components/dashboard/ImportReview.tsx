"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { ArrowLeftRight, Check, Copy } from "lucide-react"
import { SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Line, PageSize } from "@/lib/import/lines"
import type { OpenedFile } from "@/lib/import/open"
import { entryKey, toResumeContent, type FoundEntry, type ParsedResume } from "@/lib/import/parse"
import type { ResumeContent } from "@/lib/resumeFile"
import Modal from "./Modal"

type ParsedFile = Extract<OpenedFile, { kind: "parsed" }>

interface ImportReviewProps {
  file: ParsedFile
  onCancel: () => void
  onCreate: (content: ResumeContent) => void
}

const range = (start?: string, end?: string) => [start, end].filter(Boolean).join(" – ")
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

// How each kind of entry is summed up, and which two fields "Swap" exchanges.
const SHOWN: Record<
  SectionName,
  { primary: string; secondary: string[]; dates: (fields: Record<string, string>) => string; bullets?: string; swap?: [string, string]; swapLabel?: string }
> = {
  Education: {
    primary: "schoolName",
    secondary: ["degree", "gpa", "schoolLocation"],
    dates: (f) => range(f.schoolStartDate, f.schoolEndDate),
    swap: ["schoolName", "degree"],
    swapLabel: "Swap school and degree",
  },
  Work: {
    primary: "workRole",
    secondary: ["companyName", "workLocation"],
    dates: (f) => range(f.workStartDate, f.workEndDate),
    bullets: "workDescription",
    swap: ["workRole", "companyName"],
    swapLabel: "Swap role and company",
  },
  Leadership: {
    primary: "leadershipRole",
    secondary: ["leadershipOrg", "leadershipLocation"],
    dates: (f) => range(f.leadershipStartDate, f.leadershipEndDate),
    bullets: "leadershipDescription",
    swap: ["leadershipRole", "leadershipOrg"],
    swapLabel: "Swap role and organization",
  },
  Volunteership: {
    primary: "volunteerRole",
    secondary: ["volunteerOrg", "volunteerLocation"],
    dates: (f) => range(f.volunteerStartDate, f.volunteerEndDate),
    bullets: "volunteerDescription",
    swap: ["volunteerRole", "volunteerOrg"],
    swapLabel: "Swap role and organization",
  },
  Projects: { primary: "projectName", secondary: ["techStack"], dates: (f) => f.projectDate, bullets: "projectDescription" },
  Publications: { primary: "publicationTitle", secondary: ["publicationAuthors", "publicationVenue", "publicationDetails"], dates: (f) => f.publicationDate },
  Skills: { primary: "skillName", secondary: ["skillDetails"], dates: () => "" },
  Awards: { primary: "awardName", secondary: ["awardOrg"], dates: (f) => f.awardDate },
}

const swapFields = (entry: FoundEntry, [a, b]: [string, string]): FoundEntry => ({
  ...entry,
  fields: { ...entry.fields, [a]: entry.fields[b], [b]: entry.fields[a] },
})

/** The parsed resume with the user's swaps applied. */
function withSwaps(parsed: ParsedResume, swapped: Set<string>): ParsedResume {
  return {
    ...parsed,
    sections: parsed.sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry, index) => {
        const swap = SHOWN[section.name].swap
        return swap && swapped.has(entryKey(section.name, index)) ? swapFields(entry, swap) : entry
      }),
    })),
  }
}

export default function ImportReview({ file, onCancel, onCreate }: ImportReviewProps) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [swapped, setSwapped] = useState<Set<string>>(new Set())
  const [highlight, setHighlight] = useState<number[]>([])
  const [copied, setCopied] = useState(false)

  const parsed = withSwaps(file.parsed, swapped)
  const { profile } = parsed
  const contact = [profile.location, profile.email, profile.phoneNumber, profile.linkedin, profile.profileGithub, profile.personalWebsite].filter(Boolean)
  const leftovers = parsed.unplaced.reduce((sum, group) => sum + group.text.length, 0)
  const foundNothing = !profile.fullName && parsed.sections.length === 0

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }
  const point = (lines: number[]) => ({
    onMouseEnter: () => setHighlight(lines),
    onMouseLeave: () => setHighlight([]),
    onFocus: () => setHighlight(lines),
    onBlur: () => setHighlight([]),
  })

  const copyLeftovers = async () => {
    const text = parsed.unplaced.map((group) => [group.heading, ...group.text].join("\n")).join("\n\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the text is still on screen to select.
    }
  }

  return (
    <Modal title="Here's what we found" onClose={onCancel} wide>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-label="Your file" className="hidden min-h-0 overflow-y-auto border-r border-rule bg-desk lg:block">
          {file.pdf ? (
            <PdfPages doc={file.pdf.doc} pages={file.pdf.pages} lines={file.lines} highlight={highlight} />
          ) : (
            <TextLines lines={file.lines} highlight={highlight} />
          )}
        </section>

        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-7 sm:px-8">
            <span className="label-mono block truncate text-ink-2">From {file.fileName}</span>
            <h2 id="modal-title" className="mt-2 font-serif text-[32px] leading-tight tracking-[-0.02em]">
              Here&apos;s what we found
            </h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">
              {foundNothing
                ? "We couldn't make out much in this file. You can still start from it and fill in the rest."
                : "Untick anything that's wrong. You can change everything in the editor."}
            </p>

            <section className="mt-7 border-t border-ink pt-4" {...point(parsed.profileLines)}>
              <span className="label-mono text-ink-2">Profile</span>
              <p className="mt-1 font-serif text-[24px] leading-tight tracking-[-0.01em]">
                {profile.fullName || <span className="text-ink-2">No name found</span>}
              </p>
              <p className="mt-1 break-words text-sm text-ink-2">{contact.length ? contact.join(" · ") : "No contact details found"}</p>
            </section>

            {parsed.sections.map((section) => {
              const shown = SHOWN[section.name]
              return (
                <section key={section.name} className="mt-8">
                  <h3 className="label-mono border-b border-ink pb-2 text-ink-2">
                    {SECTIONS[section.name].title} · {section.entries.length}
                  </h3>
                  <ul>
                    {section.entries.map((entry, index) => {
                      const key = entryKey(section.name, index)
                      const off = skipped.has(key)
                      const primary = entry.fields[shown.primary]
                      const secondary = shown.secondary.map((field) => entry.fields[field]).filter(Boolean).join(" · ")
                      const dates = shown.dates(entry.fields)
                      const bullets = shown.bullets ? entry.fields[shown.bullets].split("\n").filter((line) => line.trim()).length : 0
                      return (
                        <li key={key} className="flex items-start gap-3 border-b border-rule py-3" {...point(entry.lines)}>
                          <input
                            type="checkbox"
                            checked={!off}
                            onChange={() => setSkipped((set) => toggle(set, key))}
                            aria-label={`Include ${primary || secondary || "this entry"}`}
                            className="mt-1 h-4 w-4 shrink-0 accent-accent"
                          />
                          <div className={`min-w-0 flex-1 ${off ? "opacity-45" : ""}`}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                              <span className="min-w-0 break-words text-[15px] font-medium text-ink">
                                {primary || <span className="font-normal text-ink-2">No title</span>}
                              </span>
                              {dates && <span className="label-mono shrink-0 text-ink-2">{dates}</span>}
                            </div>
                            {secondary && <p className="mt-0.5 break-words text-sm text-ink-2">{secondary}</p>}
                            {bullets > 0 && <p className="mt-0.5 text-xs text-ink-2">{plural(bullets, "bullet")}</p>}
                          </div>
                          {shown.swap && (
                            <button
                              type="button"
                              onClick={() => setSwapped((set) => toggle(set, key))}
                              title={shown.swapLabel}
                              aria-label={`${shown.swapLabel}: ${primary || "this entry"}`}
                              aria-pressed={swapped.has(key)}
                              className="shrink-0 rounded-[4px] p-1.5 text-ink-2 transition-colors hover:bg-sheet hover:text-ink aria-pressed:text-accent"
                            >
                              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            {leftovers > 0 && (
              <section className="mt-8">
                <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
                  <h3 className="label-mono text-ink-2">Couldn&apos;t place · {plural(leftovers, "line")}</h3>
                  <button
                    type="button"
                    onClick={copyLeftovers}
                    className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-ink-2">Add these in the editor if you need them.</p>
                {parsed.unplaced.map((group) => (
                  <div key={group.heading} className="mt-4" {...point(group.lines)}>
                    <p className="label-mono text-ink-2">{group.heading}</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {group.text.map((text, i) => (
                        <li key={i} className="break-words text-sm leading-relaxed text-ink">
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-rule px-6 py-4 sm:px-8">
            <button type="button" onClick={onCancel} className="h-10 px-4 text-sm text-ink-2 hover:text-ink">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onCreate(toResumeContent(parsed, skipped))}
              className="h-10 rounded-[4px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              Create resume
            </button>
          </footer>
        </div>
      </div>
    </Modal>
  )
}

/** Scrolls the first highlighted element in `container` into view. */
function useScrollToHighlight(container: RefObject<HTMLElement | null>, highlight: number[]) {
  useEffect(() => {
    const first = container.current?.querySelector("[data-highlight]")
    if (!first) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    first.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
  }, [container, highlight])
}

// Pages are drawn at twice the width they're shown at, for sharp text.
const RENDER_WIDTH = 1100

function PdfPages({ doc, pages, lines, highlight }: { doc: PDFDocumentProxy; pages: PageSize[]; lines: Line[]; highlight: number[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollToHighlight(ref, highlight)
  return (
    <div ref={ref} className="flex flex-col gap-4 p-5">
      {pages.map((size, i) => (
        <PdfPage
          key={i}
          doc={doc}
          number={i + 1}
          size={size}
          boxes={highlight.map((index) => lines[index]).filter((line) => line?.page === i + 1 && line.box).map((line) => line.box!)}
        />
      ))}
    </div>
  )
}

function PdfPage({ doc, number, size, boxes }: { doc: PDFDocumentProxy; number: number; size: PageSize; boxes: [number, number, number, number][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let task: { promise: Promise<void>; cancel: () => void } | null = null
    doc
      .getPage(number)
      .then((page) => {
        const canvas = canvasRef.current
        if (cancelled || !canvas) return
        const viewport = page.getViewport({ scale: RENDER_WIDTH / size.width })
        canvas.width = viewport.width
        canvas.height = viewport.height
        task = page.render({ canvasContext: canvas.getContext("2d")!, viewport })
        return task.promise
      })
      .catch(() => {
        // Cancelled when the review closes, or the page couldn't be drawn: the found text still shows.
      })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, number, size.width])

  const percent = (value: number, of: number) => `${(value / of) * 100}%`
  return (
    <div className="relative bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-label={`Page ${number}`} />
      {boxes.map(([left, top, right, bottom], i) => (
        <div
          key={i}
          data-highlight={i === 0 ? "" : undefined}
          className="pointer-events-none absolute rounded-[2px] bg-accent/15 ring-1 ring-accent/50"
          style={{
            left: percent(left - 2, size.width),
            top: percent(top - 1, size.height),
            width: percent(right - left + 4, size.width),
            height: percent(bottom - top + 2, size.height),
          }}
        />
      ))}
    </div>
  )
}

/** A Word file has no pages to draw, so its text stands in for them. */
function TextLines({ lines, highlight }: { lines: Line[]; highlight: number[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollToHighlight(ref, highlight)
  const marked = new Set(highlight)
  return (
    <div ref={ref} className="p-5">
      <div className="flex flex-col gap-0.5 bg-white px-6 py-7 text-[13px] leading-relaxed text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
        {lines.map((line, i) => (
          <p
            key={i}
            data-highlight={marked.has(i) && !marked.has(i - 1) ? "" : undefined}
            className={`rounded-[2px] px-1 ${marked.has(i) ? "bg-accent/15" : ""} ${line.heading ? "mt-3 font-semibold" : ""} ${line.bullet ? "pl-4" : ""}`}
          >
            {line.bullet && "• "}
            {line.text}
          </p>
        ))}
      </div>
    </div>
  )
}
