"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import type { LucideIcon } from "lucide-react"
import { PageSketch } from "@/components/editor/PrintingPage"
import DownloadFailed, { nextFailure, type Failure } from "@/components/site/DownloadFailed"
import { plainClick } from "@/components/site/StartWriting"
import type { ResumeWithId } from "@/lib/resume"
import { keepThumbnails, lastThumbnail, thumbnailOf } from "@/lib/thumbnails"
import { downloadResume, printedOf, savingData, Superseded } from "@/lib/typst/compile"
import { templateById } from "@/lib/templates"
import { openPage } from "@/lib/viewTransition"
import { RESUME_TAGS } from "./CreateResumeModal"
import { CopyIcon, DownloadIcon, PencilIcon, RowAction, TrashIcon } from "./RowActions"

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })

function formatEdited(value: string | undefined) {
  const date = new Date(value ?? "")
  if (Number.isNaN(date.getTime())) return "—"
  const today = new Date().toDateString() === date.toDateString()
  return today ? `Today, ${timeFormat.format(date)}` : dateFormat.format(date)
}

// How long a Download button says "Downloaded" before going back to how it was.
const DOWNLOADED_MS = 2000
// How long a new copy stands out in the list.
const COPIED_MS = 2500

const tagName = (tag: string) => RESUME_TAGS.find((option) => option.id === tag?.toLowerCase())?.name ?? tag

const nameOf = (resume: ResumeWithId) => resume.resumeTitle || "Untitled resume"

interface ResumeCardsProps {
  resumes: ResumeWithId[]
  /** Adds a copy of the resume, and returns its id. */
  onDuplicate: (resume: ResumeWithId) => string | undefined
  onRename: (resume: ResumeWithId, title: string) => void
  onDelete: (resume: ResumeWithId) => void
}

const focusOn = (selector: string) => document.querySelector<HTMLElement>(selector)?.focus()

/**
 * The resumes, as cards with a picture of each one's first page. A card opens
 * its resume, carrying the picture into the editor (lib/viewTransition.ts),
 * and has the resume's actions: rename, duplicate, download and delete.
 */
export default function ResumeCards({ resumes, onDuplicate, onRename, onDelete }: ResumeCardsProps) {
  const router = useRouter()
  // Ids of the resumes downloading, and why each one whose last download failed did.
  const [downloading, setDownloading] = useState<string[]>([])
  const [failed, setFailed] = useState<Record<string, Failure>>({})
  // When each resume just downloaded finished, by id, and what's said aloud about the last one.
  const [downloaded, setDownloaded] = useState<Record<string, number>>({})
  const [announcement, setAnnouncement] = useState("")
  // The resume being renamed, and the name typed so far.
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null)
  // The copy just made, which stands out for a moment.
  const [copied, setCopied] = useState<string | null>(null)

  const announce = (text: string) => {
    // Cleared first, so the same words twice in a row are said aloud again.
    setAnnouncement("")
    requestAnimationFrame(() => setAnnouncement(text))
  }

  useEffect(() => {
    if (!copied) return
    // Focus moves to the copy, at the top of the list.
    requestAnimationFrame(() => focusOn(`[data-resume-link="${copied}"]`))
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
  // Enter or Escape, focus goes back to the pencil; leaving the box leaves it
  // wherever it went.
  const finishRenaming = (resume: ResumeWithId, save: boolean, refocus: boolean) => {
    if (renaming?.id !== resume.id) return
    if (save) onRename(resume, renaming.draft)
    setRenaming(null)
    if (refocus) requestAnimationFrame(() => focusOn(`[data-rename="${resume.id}"]`))
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

  // The pictures of resumes deleted since, here or in another tab, are let go.
  const ids = JSON.stringify(resumes.map((resume) => resume.id))
  useEffect(() => keepThumbnails(JSON.parse(ids)), [ids])

  // A plain click opens the resume from its picture; one with a modifier key
  // is the browser's, as on any link, for a new tab or window.
  const open = (event: MouseEvent<HTMLAnchorElement>, resume: ResumeWithId) => {
    if (!plainClick(event)) return
    event.preventDefault()
    openPage(() => router.push(`/create/new/${resume.id}`), event.currentTarget.closest("li")?.querySelector<HTMLElement>("[data-page]"))
  }

  // The name, which opens the resume, and a pencil to rename it; or, while
  // renaming, a box to type the name in. On wide screens the pencil shows
  // when the card is pointed at, or it's focused.
  const name = (resume: ResumeWithId) =>
    renaming?.id === resume.id ? (
      <input
        aria-label="Resume name"
        value={renaming.draft}
        placeholder="Untitled resume"
        maxLength={200}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setRenaming({ id: resume.id, draft: event.target.value })}
        onBlur={() => finishRenaming(resume, true, false)}
        onKeyDown={(event) => {
          // Enter or Escape while typing with an input method (as for Japanese) picks or cancels a character.
          if (event.nativeEvent.isComposing) return
          if (event.key === "Enter") finishRenaming(resume, true, true)
          else if (event.key === "Escape") finishRenaming(resume, false, true)
        }}
        className="w-full min-w-0 border-0 border-b border-accent bg-transparent py-0.5 font-serif text-[19px] leading-tight text-ink outline-none placeholder:text-ink-2 focus-visible:outline-none sm:text-[21px]"
      />
    ) : (
      <div className="flex min-w-0 items-start gap-0.5">
        {/* A name breaks anywhere it has to, so however long it is, it can't
            widen its card. Past two lines it's cut short, and shown in full on hover. */}
        <Link
          href={`/create/new/${resume.id}`}
          title={nameOf(resume)}
          data-resume-link={resume.id}
          onClick={(event) => open(event, resume)}
          className="line-clamp-2 min-w-0 flex-1 font-serif text-[19px] leading-tight wrap-anywhere hover:underline hover:underline-offset-4 sm:text-[21px]"
        >
          {nameOf(resume)}
        </Link>
        <RowAction
          label="Rename"
          data-rename={resume.id}
          onClick={() => setRenaming({ id: resume.id, draft: resume.resumeTitle ?? "" })}
          tipAtEnd
          className="-my-2 transition-opacity motion-reduce:transition-none md:opacity-0 md:focus-visible:opacity-100 md:group-hover/card:opacity-100"
        >
          <PencilIcon />
        </RowAction>
      </div>
    )

  const actions = (resume: ResumeWithId) => (
    <>
      <RowAction label="Duplicate" onClick={() => duplicate(resume)}>
        <CopyIcon copied={resume.id === copied} />
      </RowAction>
      <RowAction
        label={resume.id in downloaded ? "Downloaded" : "Download"}
        onClick={() => download(resume)}
        disabled={downloading.includes(resume.id)}
        busy={downloading.includes(resume.id)}
      >
        <DownloadIcon state={downloading.includes(resume.id) ? "busy" : resume.id in downloaded ? "done" : "idle"} />
      </RowAction>
      <RowAction label="Delete" danger onClick={() => onDelete(resume)}>
        <TrashIcon />
      </RowAction>
    </>
  )

  // The latest copies, in case one was renamed or deleted since.
  const failedResumes = resumes.filter((resume) => failed[resume.id])

  return (
    <>
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {failedResumes.length > 0 && (
        <div className="mb-6 flex max-w-[720px] flex-col gap-4">
          {failedResumes.map((resume) => (
            <DownloadFailed
              key={`${resume.id}-${failed[resume.id].count}`}
              failure={failed[resume.id]}
              title={nameOf(resume)}
              retrying={downloading.includes(resume.id)}
              onRetry={() => download(resume)}
            />
          ))}
        </div>
      )}

      <ul
        aria-label="Resumes"
        className="grid grid-cols-2 gap-x-4 gap-y-10 border-t border-ink pt-8 sm:gap-x-8 md:grid-cols-3 md:pt-10 xl:grid-cols-4"
      >
        {resumes.map((resume) => (
          <li key={resume.id} className="group/card flex min-w-0 flex-col">
            {/* The picture opens the resume too. The name's link is the one announced, so this one's skipped. */}
            <Link href={`/create/new/${resume.id}`} tabIndex={-1} aria-hidden="true" onClick={(event) => open(event, resume)}>
              {/* Paper on the desk, lifted a little when pointed at; a new copy is outlined for a moment. */}
              <div
                data-page
                className={`relative aspect-[8.5/11] overflow-hidden bg-sheet shadow-[0_1px_2px_rgba(17,19,24,0.08),0_14px_32px_-18px_rgba(17,19,24,0.4)] outline-2 outline-offset-4 transition-[translate,box-shadow,outline-color] duration-500 ease-glide group-hover/card:-translate-y-1 group-hover/card:shadow-[0_2px_4px_rgba(17,19,24,0.08),0_26px_48px_-20px_rgba(17,19,24,0.45)] motion-reduce:transition-none ${
                  resume.id === copied ? "outline-accent" : "outline-transparent"
                }`}
              >
                <Sheet resume={resume} />
              </div>
            </Link>
            <div className="mt-4 flex min-w-0 flex-col gap-1 border-t border-rule pt-3">
              {name(resume)}
              <span className="text-[13px] text-ink-2">
                {[resume.resumeTag && tagName(resume.resumeTag), templateById(resume.selectedTemplate).name].filter(Boolean).join(" · ")}
              </span>
              <span className="font-mono text-[12px] text-ink-2">{formatEdited(resume.updatedAt)}</span>
            </div>
            {/* At the foot of the card, so a row of cards lines its buttons up whatever their names wrap to. */}
            <div className="-ml-2.5 mt-auto flex gap-1 pt-1">{actions(resume)}</div>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * A resume's first page, drawn in this browser (lib/thumbnails.ts). Until it
 * is, a sketch of a page with a line passing down it, as the editor's stand-in
 * page has. Visitors saving data, who don't download the compiler before they
 * open a resume, and a resume that can't be drawn, get its template's sample.
 */
function Sheet({ resume }: { resume: ResumeWithId }) {
  const [picture, setPicture] = useState(() => lastThumbnail(resume.id))
  const [sample, setSample] = useState(false)
  // Drawn again when what the resume prints changes, not when it's renamed.
  const printed = useMemo(() => JSON.stringify(printedOf(resume)), [resume])
  const latest = useRef(resume)
  latest.current = resume

  useEffect(() => {
    if (savingData()) {
      setSample(true)
      return
    }
    const wanted = new AbortController()
    thumbnailOf(latest.current.id, latest.current, wanted.signal).then(
      (url) => {
        setPicture(url)
        setSample(false)
      },
      (error) => {
        if (!(error instanceof Superseded)) setSample(true)
      },
    )
    // A card that's gone, as when the editor opens, doesn't keep the compiler from its preview.
    return () => wanted.abort()
  }, [printed])

  if (picture)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an object URL made in the browser, which next/image can't resize
      <img
        src={picture}
        alt=""
        className="absolute inset-0 size-full transition-opacity duration-300 motion-reduce:transition-none starting:opacity-0"
      />
    )
  if (sample)
    return (
      <Image
        src={templateById(resume.selectedTemplate).image}
        alt=""
        fill
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
        className="object-cover object-top"
      />
    )
  return (
    <>
      <PageSketch />
      <span aria-hidden="true" className="absolute inset-0 animate-print-sweep motion-reduce:hidden">
        <span className="absolute inset-x-[5%] top-0 h-px bg-accent/70 shadow-[0_0_10px_2px_rgba(46,91,230,0.25)]" />
      </span>
    </>
  )
}

interface BlankCardProps {
  icon: LucideIcon
  title: string
  /** A few words under the title, as a card's details. */
  note: string
  onClick: () => void
}

/** A blank page drawn in dashes, in a card's place, for a way to start: as on a dashboard with no resumes. */
export function BlankCard({ icon: Icon, title, note, onClick }: BlankCardProps) {
  return (
    <button type="button" onClick={onClick} className="group/blank flex min-w-0 flex-col text-left">
      <span className="flex aspect-[8.5/11] w-full items-center justify-center border border-dashed border-rule-strong transition-[border-color,background-color] duration-300 group-hover/blank:border-ink group-hover/blank:bg-sheet motion-reduce:transition-none">
        <span className="flex size-12 items-center justify-center rounded-full bg-sheet text-ink ring-1 ring-rule transition-colors duration-300 group-hover/blank:bg-ink group-hover/blank:text-white group-hover/blank:ring-ink motion-reduce:transition-none">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </span>
      <span className="mt-4 flex flex-col gap-1 border-t border-rule pt-3">
        <span className="font-serif text-[19px] leading-tight sm:text-[21px]">{title}</span>
        <span className="text-[13px] text-ink-2">{note}</span>
      </span>
    </button>
  )
}
