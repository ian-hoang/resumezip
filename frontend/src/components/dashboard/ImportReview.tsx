"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { ArrowLeftRight, Check, ChevronDown, CircleAlert, Copy, Download } from "lucide-react"
import { SECTIONS, type FieldKey, type FieldKeyOf, type SectionName } from "@/components/editor/sections"
import type { Line, PageSize } from "@/lib/import/lines"
import type { OpenedFile } from "@/lib/import/open"
import {
  entryKey,
  extraGroupKey,
  MUCH_UNPLACED,
  unplacedKey,
  toResumeContent,
  unplacedShare,
  type FoundEntry,
  type ImportChoices,
  type ParsedResume,
} from "@/lib/import/parse"
import type { ResumeContent } from "@/lib/resume"
import Modal from "./Modal"
import { INK_PILL, OUTLINE_PILL } from "@/components/pills"

type ParsedFile = Extract<OpenedFile, { kind: "parsed" }>

interface ImportReviewProps {
  file: ParsedFile
  onCancel: () => void
  onCreate: (content: ResumeContent) => void
}

const range = (start?: string, end?: string) => [start, end].filter(Boolean).join(" – ")
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

// How each kind of entry is summed up, and which two fields "Swap" exchanges.
const SHOWN: {
  [Section in SectionName]: {
    primary: FieldKeyOf<Section>
    secondary: FieldKeyOf<Section>[]
    dates: (fields: FoundEntry["fields"]) => string
    bullets?: FieldKeyOf<Section>
    swap?: [FieldKeyOf<Section>, FieldKeyOf<Section>]
    swapLabel?: string
  }
} = {
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
  Projects: { primary: "projectName", secondary: ["techStack"], dates: (f) => f.projectDate ?? "", bullets: "projectDescription" },
  Publications: {
    primary: "publicationTitle",
    secondary: ["publicationAuthors", "publicationVenue", "publicationDetails"],
    dates: (f) => f.publicationDate ?? "",
  },
  Skills: { primary: "skillName", secondary: ["skillDetails"], dates: () => "" },
  Awards: { primary: "awardName", secondary: ["awardOrg"], dates: (f) => f.awardDate ?? "" },
}

const swapFields = (entry: FoundEntry, [a, b]: [FieldKey, FieldKey]): FoundEntry => ({
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
  const [keepAs, setKeepAs] = useState<NonNullable<ImportChoices["keepAs"]>>({})
  // Whether it's asking before closing, which loses what was unticked and swapped.
  const [closing, setClosing] = useState(false)
  const unplacedRef = useRef<HTMLElement>(null)

  const parsed = withSwaps(file.parsed, swapped)
  const { profile } = parsed
  const contact = [
    profile.location,
    profile.email,
    profile.phoneNumber,
    profile.linkedin,
    profile.profileGithub,
    profile.personalWebsite,
  ].filter(Boolean)
  const leftovers = parsed.unplaced.reduce((sum, group) => sum + group.text.length, 0)
  // The lines of what's unticked above, which copying and downloading keep too.
  const unticked =
    (parsed.extraGroups ?? []).filter((group) => skipped.has(extraGroupKey(group.id))).reduce((sum, group) => sum + group.text.length, 0) +
    parsed.sections.reduce(
      (sum, section) =>
        sum +
        section.entries
          .filter((_, index) => skipped.has(entryKey(section.name, index)))
          .reduce((lines, entry) => lines + entry.lines.length, 0),
      0,
    )
  const foundNothing = !profile.fullName && parsed.sections.length === 0 && !parsed.extraGroups?.length
  const selectedGroups = (kind: "summary") =>
    (parsed.extraGroups ?? []).filter((group) => group.kind === kind && !skipped.has(extraGroupKey(group.id)))
  const reviewText = [
    ...parsed.unplaced.map((group) => [group.heading, ...group.text].join("\n")),
    ...(parsed.extraGroups ?? [])
      .filter((group) => skipped.has(extraGroupKey(group.id)))
      .map((group) => [group.heading, ...group.text].join("\n")),
    ...parsed.sections.flatMap((section) =>
      section.entries
        .filter((_, index) => skipped.has(entryKey(section.name, index)))
        .map((entry) =>
          [SECTIONS[section.name].title, ...entry.lines.map((index) => parsed.lines[index]?.text).filter(Boolean)].join("\n"),
        ),
    ),
  ].join("\n\n")
  // Most of a file that wasn't placed was likely read wrong, so it's said up
  // front instead of left at the bottom, where it's easy to miss.
  const share = unplacedShare(parsed)
  const muchUnplaced = !foundNothing && share >= MUCH_UNPLACED
  const entryKeys = parsed.sections.flatMap((section) => section.entries.map((_, index) => entryKey(section.name, index)))
  // Groups and text kept as sections are something to start from too.
  const extrasKept = (parsed.extraGroups ?? []).some((group) => !skipped.has(extraGroupKey(group.id))) || Object.keys(keepAs).length > 0
  // With every entry unticked, only the profile would be left to start from.
  const nothingTicked = entryKeys.length > 0 && entryKeys.every((key) => skipped.has(key)) && !extrasKept

  // Escape reaches every open dialog, so while the question is up, it's the question's to answer.
  const close = () => {
    if (closing) return
    if (skipped.size > 0 || swapped.size > 0 || Object.keys(keepAs).length > 0) setClosing(true)
    else onCancel()
  }

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

  const showUnplaced = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    unplacedRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" })
    unplacedRef.current?.focus({ preventScroll: true })
  }

  const copyLeftovers = async () => {
    try {
      await navigator.clipboard.writeText(reviewText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the text is still on screen to select.
    }
  }

  const downloadLeftovers = () => {
    const url = URL.createObjectURL(new Blob([reviewText], { type: "text/plain;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${file.title || "resume"}-review-text.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const review = (
    <Modal title="Here's what we found" onClose={close} wide fade={false}>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Focusable, so the file can be scrolled from the keyboard. */}
        <section
          aria-label="Your file"
          tabIndex={0}
          className="hidden min-h-0 overflow-y-auto border-r border-ink/10 bg-ink/[0.04] focus-visible:outline-offset-[-2px] lg:block"
        >
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

            {muchUnplaced && (
              <div className="mt-5 flex max-w-md gap-3 rounded-panel bg-sheet/80 px-5 py-4 ring-1 ring-ink/10">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
                <div className="min-w-0 text-sm leading-relaxed">
                  <p className="font-medium text-ink">We couldn&apos;t place {share >= 0.5 ? "most" : "a lot"} of this file.</p>
                  <p className="mt-1 text-ink-2">
                    Its layout may be one we don&apos;t read well yet. Nothing&apos;s lost: it&apos;s all under Couldn&apos;t place, to copy
                    into the editor.
                  </p>
                  <button type="button" onClick={showUnplaced} className="mt-2 font-medium text-accent underline-offset-2 hover:underline">
                    Show what we couldn&apos;t place
                  </button>
                </div>
              </div>
            )}

            <section className="mt-7 border-t border-ink pt-4" {...point(parsed.profileLines)}>
              <span className="label-mono text-ink-2">Profile</span>
              <p className="mt-1 font-serif text-[24px] leading-tight tracking-[-0.01em]">
                {profile.fullName || <span className="text-ink-2">No name found</span>}
              </p>
              <p className="mt-1 break-words text-sm text-ink-2">{contact.length ? contact.join(" · ") : "No contact details found"}</p>
            </section>

            {(parsed.extraGroups ?? []).map((group, index) => {
              const off = skipped.has(extraGroupKey(group.id))
              const combined = selectedGroups(group.kind)
              return (
                <section key={group.id} className="mt-8" {...point([group.headingLine, ...group.lines])}>
                  <label className="flex items-start gap-3 border-b border-ink pb-2">
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() => setSkipped((set) => toggle(set, extraGroupKey(group.id)))}
                      aria-label={`Include ${group.heading}, group ${index + 1}`}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span className="label-mono text-ink-2">{group.heading}</span>
                  </label>
                  <div className={`mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed ${off ? "opacity-45" : ""}`}>
                    {group.text.join("\n")}
                  </div>
                  {!off && combined.length > 1 && combined[0].id === group.id && (
                    <p className="mt-2 text-sm text-ink-2" role="status">
                      These {combined.length} go together in your profile&apos;s summary, in this order.
                    </p>
                  )}
                </section>
              )
            })}

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
                      const secondary = shown.secondary
                        .map((field) => entry.fields[field])
                        .filter(Boolean)
                        .join(" · ")
                      const dates = shown.dates(entry.fields)
                      const bullets = shown.bullets
                        ? (entry.fields[shown.bullets] ?? "").split("\n").filter((line) => line.trim()).length
                        : 0
                      return (
                        <li key={key} className="flex items-start gap-3 border-b border-ink/10 py-3" {...point(entry.lines)}>
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
                              className="-my-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink aria-pressed:text-accent"
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

            {reviewText && (
              <section ref={unplacedRef} tabIndex={-1} aria-labelledby="couldnt-place" className="mt-8 scroll-mt-4 outline-none">
                <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
                  <h3 id="couldnt-place" className="label-mono text-ink-2">
                    {leftovers > 0 ? <>Couldn&apos;t place · {plural(leftovers, "line")}</> : <>Unticked · {plural(unticked, "line")}</>}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyLeftovers}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-ink ring-1 ring-ink/15 transition-[box-shadow] hover:ring-ink/40"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={downloadLeftovers}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-ink ring-1 ring-ink/15 transition-[box-shadow] hover:ring-ink/40"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-2">
                  {leftovers > 0
                    ? "Choose whether to keep each group. Copy or download also saves text from anything you unticked above."
                    : "Copy or download saves the text of what you unticked above."}
                </p>
                {parsed.unplaced.map((group, index) => (
                  <div key={unplacedKey(group, index)} className="mt-4" {...point(group.lines)}>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <p className="label-mono text-ink-2">{group.heading}</p>
                      <div className="relative">
                        {/* Named for screen readers only: the heading beside it already says which group it is.
                            16px on phones, as iOS zooms in on a smaller select. */}
                        <select
                          aria-label={`Keep ${group.heading}, group ${index + 1}`}
                          value={keepAs[unplacedKey(group, index)] ?? ""}
                          onChange={(event) => {
                            const value = event.target.value
                            setKeepAs((current) => {
                              const next = { ...current }
                              if (value === "text" || value === "list") next[unplacedKey(group, index)] = value
                              else delete next[unplacedKey(group, index)]
                              return next
                            })
                          }}
                          className="h-9 max-w-full cursor-pointer appearance-none rounded-full bg-sheet/80 pl-3.5 pr-9 text-base text-ink ring-1 ring-ink/15 transition-[box-shadow] hover:ring-ink/40 sm:text-sm"
                        >
                          <option value="">Leave out</option>
                          <option value="text">Add as a text section</option>
                          <option value="list">Add as a bullet list</option>
                        </select>
                        <ChevronDown
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2"
                        />
                      </div>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1">
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

          {/* Not a <footer>: inside a dialog, that would be a second footer for the whole page. */}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 border-t border-ink/10 px-6 py-4 sm:px-8">
            <p role="status" className="mr-auto text-sm text-ink-2">
              {nothingTicked && "Tick something to create a resume."}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={close} className={OUTLINE_PILL}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onCreate(toResumeContent(parsed, skipped, { keepAs }))}
                disabled={nothingTicked}
                className={INK_PILL}
              >
                Create resume
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )

  return (
    <>
      {review}
      {/* Beside the review rather than inside it, so nothing its panel does can clip it. */}
      {closing && (
        <Modal title="Discard your changes?" onClose={() => setClosing(false)}>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            Closing loses what you unticked and swapped, and no resume is created from this file.
          </p>
          <div className="mt-7 flex justify-end gap-2">
            <button type="button" onClick={() => setClosing(false)} className={OUTLINE_PILL}>
              Keep reviewing
            </button>
            <button type="button" onClick={onCancel} className={INK_PILL}>
              Discard
            </button>
          </div>
        </Modal>
      )}
    </>
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
          boxes={highlight
            .map((index) => lines[index])
            .filter((line) => line?.page === i + 1 && line.box)
            .map((line) => line.box!)}
        />
      ))}
    </div>
  )
}

function PdfPage({
  doc,
  number,
  size,
  boxes,
}: {
  doc: PDFDocumentProxy
  number: number
  size: PageSize
  boxes: [number, number, number, number][]
}) {
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
