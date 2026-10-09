"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import DownloadFailed, { nextFailure, type Failure } from "@/components/site/DownloadFailed"
import { RESUME_TAGS, type ResumeWithId } from "@/lib/resume"
import { downloadResume } from "@/lib/typst/compile"
import { templateById } from "@/lib/templates"
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

interface ResumeTableProps {
  resumes: ResumeWithId[]
  /** Adds a copy of the resume, and returns its id. */
  onDuplicate: (resume: ResumeWithId) => string | undefined
  onRename: (resume: ResumeWithId, title: string) => void
  onDelete: (resume: ResumeWithId) => void
}

// The phone cards and the table are both on the page, one of them hidden, so
// this finds the one showing.
function focusShown(selector: string) {
  const shown = [...document.querySelectorAll<HTMLElement>(selector)].find((element) => element.offsetParent !== null)
  shown?.focus()
}

export default function ResumeTable({ resumes, onDuplicate, onRename, onDelete }: ResumeTableProps) {
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
    requestAnimationFrame(() => focusShown(`[data-resume-link="${copied}"]`))
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
    if (refocus) requestAnimationFrame(() => focusShown(`[data-rename="${resume.id}"]`))
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

  const header = "label-mono border-b border-rule py-3.5 text-left font-normal text-ink-2"
  const cell = "border-b border-rule py-[18px]"

  // The picture opens the resume too. The name's link is the one announced, so this one's skipped.
  const thumbnail = (resume: ResumeWithId) => (
    <Link href={`/create/new/${resume.id}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
      <Image
        src={templateById(resume.selectedTemplate).image}
        alt=""
        width={46}
        height={60}
        className="h-[60px] w-[46px] bg-sheet object-cover object-top ring-1 ring-rule transition-shadow hover:ring-rule-strong"
      />
    </Link>
  )

  // The name, which opens the resume, and a pencil to rename it; or, while
  // renaming, a box to type the name in. On wide screens the pencil shows
  // when the row is pointed at, or it's focused.
  const name = (resume: ResumeWithId, className: string) =>
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
        className="w-full min-w-0 border-0 border-b border-accent bg-transparent py-0.5 font-serif text-[21px] leading-tight text-ink outline-none placeholder:text-ink-2 focus-visible:outline-none"
      />
    ) : (
      <div className="flex min-w-0 items-start gap-0.5">
        <Link href={`/create/new/${resume.id}`} title={nameOf(resume)} data-resume-link={resume.id} className={className}>
          {nameOf(resume)}
        </Link>
        <RowAction
          label="Rename"
          data-rename={resume.id}
          onClick={() => setRenaming({ id: resume.id, draft: resume.resumeTitle ?? "" })}
          className="-my-2 transition-opacity motion-reduce:transition-none md:opacity-0 md:focus-visible:opacity-100 md:group-hover/row:opacity-100"
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
      <RowAction label="Delete" danger tipAtEnd onClick={() => onDelete(resume)}>
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

      {/* Phones: one card per resume, with its actions underneath. */}
      <ul className="border-t border-ink md:hidden">
        {resumes.map((resume) => (
          <li
            key={resume.id}
            className={`group/row flex gap-4 border-b border-rule pb-3 pt-5 transition-colors duration-700 motion-reduce:transition-none ${resume.id === copied ? "bg-accent/5" : ""}`}
          >
            {thumbnail(resume)}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {name(resume, "line-clamp-2 font-serif text-[21px] leading-tight wrap-anywhere")}
              <span className="text-[13px] text-ink-2">
                {[resume.resumeTag && tagName(resume.resumeTag), templateById(resume.selectedTemplate).name].filter(Boolean).join(" · ")}
              </span>
              <span className="font-mono text-[12px] text-ink-2">{formatEdited(resume.updatedAt)}</span>
              <div className="-ml-2.5 mt-1 flex gap-1">{actions(resume)}</div>
            </div>
          </li>
        ))}
      </ul>

      {/* Relative, so the screen-reader-only header can't widen the page past the scroll box. */}
      <div className="relative hidden overflow-x-auto border-t border-ink md:block">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className={header}>
                Resume
              </th>
              <th scope="col" className={header}>
                Template
              </th>
              <th scope="col" className={header}>
                Last edited
              </th>
              <th scope="col" className={header}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {resumes.map((resume) => (
              <tr
                key={resume.id}
                className={`group/row transition-colors duration-700 motion-reduce:transition-none ${resume.id === copied ? "bg-accent/5" : ""}`}
              >
                {/* A name breaks anywhere it has to, so however long it is, it can't
                    widen the table and push the other columns off the screen. Past
                    two lines it's cut short, and shown in full on hover. */}
                <td className={`${cell} pr-8`}>
                  <div className="flex items-center gap-[18px]">
                    {thumbnail(resume)}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {name(
                        resume,
                        "line-clamp-2 font-serif text-[21px] leading-tight wrap-anywhere hover:underline hover:underline-offset-4",
                      )}
                      {resume.resumeTag && <span className="text-[13px] text-ink-2">{tagName(resume.resumeTag)}</span>}
                    </div>
                  </div>
                </td>
                {/* On one line each, so the name gets the rest of the row. */}
                <td className={`${cell} whitespace-nowrap pr-6 text-[15px]`}>{templateById(resume.selectedTemplate).name}</td>
                <td className={`${cell} whitespace-nowrap pr-6 font-mono text-[13px] text-ink-2`}>{formatEdited(resume.updatedAt)}</td>
                <td className={cell}>
                  <div className="flex justify-end gap-1">{actions(resume)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
