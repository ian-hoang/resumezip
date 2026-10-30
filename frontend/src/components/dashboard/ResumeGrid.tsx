"use client"

import Link from "next/link"
import { useRef } from "react"
import { Plus } from "lucide-react"
import { ago } from "@/lib/ago"
import type { ResumeWithId } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import MoreMenu from "./MoreMenu"
import PagePicture from "./PagePicture"
import { CopyIcon, DownloadIcon, PencilIcon, RowAction, TagIcon, TrashIcon } from "./RowActions"
import { RenameInput, tagName } from "./ResumeTable"
import { nameOf, type ListActions } from "./useListActions"
import { useGlideOnChange } from "./flight"
import { morph, useOpenOnClick } from "./viewSwitch"

/** When a resume was last edited, in a few words: "Just now", "5 min ago", "Yesterday", "2 Oct". */
export const editedAgo = ago

/** "Edited yesterday", "Edited 5 min ago", "Edited Oct 2", or nothing when the time can't be read. */
export function editedPhrase(value: string | undefined, now = new Date()): string {
  const when = editedAgo(value, now)
  if (when === "—") return ""
  return `Edited ${when === "Just now" || when === "Yesterday" ? when.toLowerCase() : when}`
}

interface ResumeGridProps {
  resumes: ResumeWithId[]
  actions: ListActions
  onDelete: (resume: ResumeWithId) => void
  /** Opens the dialog to change its type. */
  onRetype: (resume: ResumeWithId) => void
  /** Resumes just deleted, which keep their place for a moment, unseen, as their page lifts off (flight.ts). */
  leaving: ReadonlySet<string>
  /** A resume Undo just put back, whose page is still flying back to it. */
  returning: string | null
  /** Opens New resume, from the last tile. */
  onNew: () => void
}

/**
 * Every resume as a card: its first page across its top, then its type in
 * small capitals, its name, and its template and when it was last edited.
 * Pointing at a card, or moving focus into it, shows what can be done with
 * it; on touch screens that's always showing, and on phones it's under the
 * name. The last tile starts a new one.
 */
export default function ResumeGrid({ resumes, actions, onDelete, onRetype, leaving, returning, onNew }: ResumeGridProps) {
  const { downloading, downloaded, renaming, setRenaming, copied, duplicate, download } = actions
  const now = new Date()
  const open = useOpenOnClick()
  const list = useRef<HTMLUListElement>(null)
  useGlideOnChange(list, resumes.map((resume) => resume.id).join("\n"))

  return (
    <ul ref={list} aria-label="Resumes" className="resume-grid">
      {resumes.map((resume, index) => {
        const href = `/create/new/${resume.id}`
        const name = nameOf(resume)
        const busy = downloading.includes(resume.id)
        const edited = editedPhrase(resume.updatedAt, now)
        return (
          <li
            key={resume.id}
            data-glide={resume.id}
            inert={leaving.has(resume.id)}
            className={`tile relative min-w-0 ${leaving.has(resume.id) ? "is-leaving" : resume.id === returning ? "is-returning" : ""} ${
              resume.id === copied ? "is-copied" : ""
            }`}
          >
            <div className="tile-stage">
              {/* The stage opens the resume too. The name's link is the one announced, so this one's skipped. */}
              <Link href={href} onClick={open} tabIndex={-1} aria-hidden="true" className="absolute inset-0 z-[1] rounded-[inherit]" />
              <div data-resume-page className="tile-page" style={morph("page", index)}>
                <PagePicture id={resume.id} resume={resume} sizes="(min-width: 640px) 300px, 50vw" className="h-full w-full" />
              </div>
            </div>

            <div className="tile-text flex min-w-0 flex-col gap-1 px-3.5 pb-3 pt-2.5 max-sm:px-3 max-sm:pb-1.5">
              {/* Its type, over its name. One without a type keeps the line, so the names in a row line up. */}
              <span aria-hidden={!resume.resumeTag || undefined} className="label-mono mb-[3px] truncate leading-[14px] text-ink-3">
                {resume.resumeTag ? tagName(resume.resumeTag) : "\u00a0"}
              </span>
              {renaming?.id === resume.id ? (
                <RenameInput
                  resume={resume}
                  draft={renaming.draft}
                  actions={actions}
                  // Underlined, as a name being typed is in the list and the editor. Its line hangs 1px
                  // below, where the link's text would end, so nothing under it moves.
                  className="-mb-px w-full min-w-0 border-0 border-b border-accent bg-transparent p-0 text-[16px] font-medium leading-[1.3] tracking-[-0.02em] text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
                />
              ) : (
                <Link
                  href={href}
                  onClick={open}
                  title={name}
                  data-resume-link={resume.id}
                  style={morph("name", index)}
                  className="truncate text-[16px] font-medium leading-[1.3] tracking-[-0.02em] hover:underline hover:underline-offset-4"
                >
                  {name}
                </Link>
              )}
              <p className="truncate text-[13px] leading-5 text-ink-3">
                {[templateById(resume.selectedTemplate).name, edited].filter(Boolean).join(" · ")}
              </p>
            </div>

            <div className="tile-actions">
              <div className="tile-bar glass glass-float">
                <Link href={href} onClick={open} tabIndex={-1} aria-hidden="true" className="tile-open blue-button">
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
                    { label: "Change type", icon: <TagIcon />, onSelect: () => onRetype(resume) },
                    { label: "Delete", icon: <TrashIcon />, danger: true, onSelect: () => onDelete(resume) },
                  ]}
                />
              </div>
            </div>
          </li>
        )
      })}
      <li data-glide="new" className="min-w-0">
        <NewTile onNew={onNew} />
      </li>
    </ul>
  )
}

/** A dashed card that starts a new resume: last in the grid, or first while there are none (EmptyShelf). */
export function NewTile({ onNew }: { onNew: () => void }) {
  return (
    <button type="button" onClick={onNew} className="new-tile">
      <span className="new-tile-plus" aria-hidden="true">
        <Plus className="h-[22px] w-[22px]" strokeWidth={2} />
      </span>
      <span className="text-[15px] font-medium text-ink">New resume</span>
    </button>
  )
}

/** A dashed page that opens a file: dropped on it (the page takes the drop), or chosen. */
export function DropTile({ onChooseFile, dragging }: { onChooseFile: () => void; dragging: boolean }) {
  return (
    <button type="button" onClick={onChooseFile} className={`drop-tile ${dragging ? "is-dragging" : ""}`}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path className="drop-arrow" d="M12 19V6m-5 5 5-5 5 5M5 3.5h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-medium leading-snug text-ink">Drop a PDF, Word or JSON file</span>
      {/* Looks like a button; the whole tile is the one. */}
      <span className="white-button inline-flex h-9 items-center rounded-full px-4 text-sm font-medium">Choose a file</span>
    </button>
  )
}
