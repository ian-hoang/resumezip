"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef, type CSSProperties } from "react"
import { RESUME_TAGS, type ResumeWithId } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import { usePagePicture } from "./pagePictures"
import { CopyIcon, DownloadIcon, PencilIcon, RowAction, TagIcon, TrashIcon } from "./RowActions"
import { nameOf, type ListActions } from "./useListActions"
import { morph, useOpenResume } from "./viewSwitch"

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })

function formatEdited(value: string | undefined) {
  const date = new Date(value ?? "")
  if (Number.isNaN(date.getTime())) return "—"
  const today = new Date().toDateString() === date.toDateString()
  return today ? `Today, ${timeFormat.format(date)}` : dateFormat.format(date)
}

export const tagName = (tag: string) => RESUME_TAGS.find((option) => option.id === tag?.toLowerCase())?.name ?? tag

interface ResumeTableProps {
  resumes: ResumeWithId[]
  actions: ListActions
  onDelete: (resume: ResumeWithId) => void
  /** Opens the dialog to change its type. */
  onRetype: (resume: ResumeWithId) => void
  /** Resumes being deleted, which fold up and go. */
  leaving: ReadonlySet<string>
  /** A resume just put back, which unfolds. */
  returning: string | null
}

export default function ResumeTable({ resumes, actions, onDelete, onRetype, leaving, returning }: ResumeTableProps) {
  const { downloading, downloaded, renaming, setRenaming, finishRenaming, copied, duplicate, download } = actions
  const open = useOpenResume()

  const header = "label-mono border-b border-rule py-3.5 text-left font-normal text-ink-2"
  const cell = "border-b border-rule"

  // The picture opens the resume too. The name's link is the one announced, so this one's skipped.
  // The cards and the table both pair it, and the name, with the pages (viewSwitch.ts). Only the
  // one showing takes part in a view transition, so each name is still one of a kind.
  const thumbnail = (resume: ResumeWithId, index: number) => (
    <Link href={`/create/new/${resume.id}`} onClick={open} tabIndex={-1} aria-hidden="true" className="shrink-0">
      <Thumbnail resume={resume} style={morph("page", index)} />
    </Link>
  )

  // The name, which opens the resume, and a pencil to rename it; or, while
  // renaming, a box to type the name in. On wide screens the pencil shows
  // when the row is pointed at, or it's focused.
  const name = (resume: ResumeWithId, index: number, className: string) =>
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
        <Link
          href={`/create/new/${resume.id}`}
          onClick={open}
          title={nameOf(resume)}
          data-resume-link={resume.id}
          style={morph("name", index)}
          className={className}
        >
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

  const buttons = (resume: ResumeWithId) => (
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
      <RowAction label="Change type" onClick={() => onRetype(resume)}>
        <TagIcon />
      </RowAction>
      <RowAction label="Delete" danger tipAtEnd onClick={() => onDelete(resume)}>
        <TrashIcon />
      </RowAction>
    </>
  )

  // A row being deleted folds up (dashboard.css); one put back unfolds.
  const motion = (resume: ResumeWithId) => (leaving.has(resume.id) ? "is-folding" : resume.id === returning ? "is-unfolding" : "")

  return (
    <>
      {/* Phones: one card per resume, with its actions underneath. */}
      <ul className="md:hidden">
        {resumes.map((resume, index) => (
          <li
            key={resume.id}
            inert={leaving.has(resume.id)}
            className={`fold-row group/row border-b border-rule transition-colors duration-700 motion-reduce:transition-none ${resume.id === copied ? "bg-accent/5" : ""} ${motion(resume)}`}
          >
            <div className="fold-cell">
              <div className="flex gap-4 pb-3 pt-5">
                {thumbnail(resume, index)}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {name(resume, index, "line-clamp-2 font-serif text-[21px] leading-tight wrap-anywhere")}
                  <span className="text-[13px] text-ink-2">
                    {[resume.resumeTag && tagName(resume.resumeTag), templateById(resume.selectedTemplate).name]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="font-mono text-[12px] text-ink-2">{formatEdited(resume.updatedAt)}</span>
                  <div className="-ml-2.5 mt-1 flex gap-1">{buttons(resume)}</div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Relative, so the screen-reader-only header can't widen the page past the scroll box. */}
      <div className="relative hidden overflow-x-auto md:block">
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
            {resumes.map((resume, index) => (
              <tr
                key={resume.id}
                inert={leaving.has(resume.id)}
                className={`fold-row group/row transition-colors duration-700 motion-reduce:transition-none ${resume.id === copied ? "bg-accent/5" : ""} ${motion(resume)}`}
              >
                {/* A name breaks anywhere it has to, so however long it is, it can't
                    widen the table and push the other columns off the screen. Past
                    two lines it's cut short, and shown in full on hover. Each cell's
                    content is in a fold-cell, which closes up as the row folds. */}
                <td className={`${cell} pr-8`}>
                  <div className="fold-cell">
                    <div className="flex items-center gap-[18px] py-[18px]">
                      {thumbnail(resume, index)}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {name(
                          resume,
                          index,
                          "line-clamp-2 font-serif text-[21px] leading-tight wrap-anywhere hover:underline hover:underline-offset-4",
                        )}
                        {resume.resumeTag && <span className="text-[13px] text-ink-2">{tagName(resume.resumeTag)}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                {/* On one line each, so the name gets the rest of the row. */}
                <td className={`${cell} whitespace-nowrap pr-6 text-[15px]`}>
                  <div className="fold-cell">
                    <div>{templateById(resume.selectedTemplate).name}</div>
                  </div>
                </td>
                <td className={`${cell} whitespace-nowrap pr-6 font-mono text-[13px] text-ink-2`}>
                  <div className="fold-cell">
                    <div>{formatEdited(resume.updatedAt)}</div>
                  </div>
                </td>
                <td className={cell}>
                  <div className="fold-cell">
                    <div className="flex justify-end gap-1">{buttons(resume)}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// A small picture of the resume's first page, once it's drawn (pagePictures.ts), or its template's.
function Thumbnail({ resume, style }: { resume: ResumeWithId; style: CSSProperties }) {
  const element = useRef<HTMLSpanElement>(null)
  const url = usePagePicture(resume.id, resume, element)
  return (
    // Its edge is drawn inside it: the table's scroll box clips anything outside, and the
    // picture sits right at the box's left edge.
    <span
      ref={element}
      data-resume-page
      style={style}
      className="block h-[60px] w-[46px] bg-sheet outline outline-1 -outline-offset-1 outline-rule transition-[outline-color] hover:outline-rule-strong"
    >
      {url ? (
        // An object URL, which next/image can't optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <Image
          src={templateById(resume.selectedTemplate).image}
          alt=""
          width={46}
          height={60}
          className="h-full w-full object-cover object-top"
        />
      )}
    </span>
  )
}
