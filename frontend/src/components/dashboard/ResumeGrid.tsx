"use client"

import Link from "next/link"
import type { ResumeWithId } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import MoreMenu from "./MoreMenu"
import PagePicture from "./PagePicture"
import { CopyIcon, DownloadIcon, PencilIcon, RowAction, TrashIcon } from "./RowActions"
import { tagName } from "./ResumeTable"
import { nameOf, type ListActions } from "./useListActions"

const dayFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" })
const yearFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })

/** When a resume was last edited, in a few words: "Just now", "5 min ago", "Yesterday", "2 Oct". */
export function editedAgo(value: string | undefined, now = new Date()): string {
  const date = new Date(value ?? "")
  if (Number.isNaN(date.getTime())) return "—"
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1 && minutes > -5) return "Just now"
  if (minutes >= 1 && minutes < 60) return `${minutes} min ago`
  if (date.toDateString() === now.toDateString()) return `${Math.floor(minutes / 60)} hr ago`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return (date.getFullYear() === now.getFullYear() ? dayFormat : yearFormat).format(date)
}

interface ResumeGridProps {
  resumes: ResumeWithId[]
  actions: ListActions
  onDelete: (resume: ResumeWithId) => void
  /** Resumes being deleted, which crumple up and go. */
  leaving: ReadonlySet<string>
  /** A resume just put back, which smooths out again. */
  returning: string | null
  onChooseFile: () => void
  /** A file is being dragged over the page. */
  dragging: boolean
}

/**
 * Every resume as its first page, newest first, with its name and template
 * under it. Pointing at a page, or moving focus into it, shows what can be
 * done with it; on touch screens that's always showing, and on phones it's
 * under the name. The last tile takes a file to open.
 */
export default function ResumeGrid({ resumes, actions, onDelete, leaving, returning, onChooseFile, dragging }: ResumeGridProps) {
  const { downloading, downloaded, renaming, setRenaming, finishRenaming, copied, duplicate, download } = actions
  const now = new Date()

  return (
    <ul aria-label="Resumes" className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 xl:grid-cols-5">
      {resumes.map((resume) => {
        const href = `/create/new/${resume.id}`
        const name = nameOf(resume)
        const busy = downloading.includes(resume.id)
        return (
          <li
            key={resume.id}
            inert={leaving.has(resume.id)}
            className={`tile relative min-w-0 ${leaving.has(resume.id) ? "is-crumpling" : resume.id === returning ? "is-returning" : ""} ${
              resume.id === copied ? "is-copied" : ""
            }`}
          >
            <div className="tile-page relative aspect-[8.5/11]">
              {/* The picture opens the resume too. The name's link is the one announced, so this one's skipped. */}
              <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0">
                <PagePicture
                  id={resume.id}
                  resume={resume}
                  sizes="(min-width: 1280px) 260px, (min-width: 768px) 30vw, 50vw"
                  className="h-full w-full"
                />
              </Link>
              {resume.resumeTag && (
                <span aria-hidden="true" className="tile-tag">
                  {tagName(resume.resumeTag)}
                </span>
              )}
            </div>

            {renaming?.id === resume.id ? (
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
                className="mt-3 w-full min-w-0 border-0 border-b border-accent bg-transparent py-0.5 font-serif text-[19px] leading-tight text-ink outline-none placeholder:text-ink-2 focus-visible:outline-none md:text-[21px]"
              />
            ) : (
              <Link
                href={href}
                title={name}
                data-resume-link={resume.id}
                className="mt-3 line-clamp-2 font-serif text-[19px] leading-tight wrap-anywhere hover:underline hover:underline-offset-4 md:text-[21px]"
              >
                {name}
              </Link>
            )}
            <p className="label-mono mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-ink-2">
              {/* The tag on the page is only a picture of it; this is what's read out. */}
              <span>
                {resume.resumeTag && <span className="sr-only">{tagName(resume.resumeTag)}, </span>}
                {templateById(resume.selectedTemplate).name}
              </span>
              <span>{editedAgo(resume.updatedAt, now)}</span>
            </p>

            <div className="tile-actions">
              <div className="tile-bar glass">
                <Link href={href} tabIndex={-1} aria-hidden="true" className="tile-open">
                  Open
                </Link>
                <RowAction label="Duplicate" onClick={() => duplicate(resume)}>
                  <CopyIcon copied={resume.id === copied} />
                </RowAction>
                <RowAction
                  label={resume.id in downloaded ? "Downloaded" : "Download"}
                  onClick={() => download(resume)}
                  disabled={busy}
                  busy={busy}
                >
                  <DownloadIcon state={busy ? "busy" : resume.id in downloaded ? "done" : "idle"} />
                </RowAction>
                <MoreMenu
                  label={`More for “${name}”`}
                  data-rename={resume.id}
                  items={[
                    {
                      label: "Rename",
                      icon: <PencilIcon />,
                      onSelect: () => setRenaming({ id: resume.id, draft: resume.resumeTitle ?? "" }),
                    },
                    { label: "Delete", icon: <TrashIcon />, danger: true, onSelect: () => onDelete(resume) },
                  ]}
                />
              </div>
            </div>
          </li>
        )
      })}
      <li className={`min-w-0 ${dragging ? "relative z-[45]" : ""}`}>
        <DropTile onChooseFile={onChooseFile} dragging={dragging} />
      </li>
    </ul>
  )
}

/** A dashed page that opens a file: dropped on it (the page takes the drop), or chosen. */
export function DropTile({ onChooseFile, dragging }: { onChooseFile: () => void; dragging: boolean }) {
  return (
    <button type="button" onClick={onChooseFile} className={`drop-tile ${dragging ? "is-dragging" : ""}`}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path className="drop-arrow" d="M12 19V6m-5 5 5-5 5 5M5 3.5h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] leading-snug text-ink md:text-[17px]">Drop a PDF or Docx file</span>
      {/* Looks like a button; the whole tile is the one. */}
      <span className="mt-1 inline-flex h-9 items-center rounded-full bg-sheet/80 px-4 text-sm font-medium text-ink ring-1 ring-inset ring-ink/15">
        Choose a file
      </span>
    </button>
  )
}
