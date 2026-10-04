"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { downloadResume } from "@/lib/typst/compile"
import { templateById } from "@/lib/templates"
import { RESUME_TAGS } from "./CreateResumeModal"

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })

function formatEdited(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const today = new Date().toDateString() === date.toDateString()
  return today ? `Today, ${timeFormat.format(date)}` : dateFormat.format(date)
}

const tagName = (tag: string) => RESUME_TAGS.find((option) => option.id === tag?.toLowerCase())?.name ?? tag

interface ResumeTableProps {
  resumes: Record<string, any>[]
  onDelete: (resume: Record<string, any>) => void
}

export default function ResumeTable({ resumes, onDelete }: ResumeTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const download = async (resume: Record<string, any>) => {
    setDownloadingId(resume.id)
    try {
      await downloadResume(resume)
    } catch (error) {
      console.error("Failed to build PDF:", error)
    } finally {
      setDownloadingId(null)
    }
  }

  const header = "label-mono border-b border-rule py-3.5 text-left font-normal text-ink-2"
  const cell = "border-b border-rule py-[18px]"

  const thumbnail = (resume: Record<string, any>) => (
    <Image
      src={templateById(resume.selectedTemplate).image}
      alt=""
      width={46}
      height={60}
      className="h-[60px] w-[46px] shrink-0 bg-sheet object-cover object-top ring-1 ring-rule"
    />
  )

  const actions = (resume: Record<string, any>) => (
    <>
      <Link href={`/create/new/${resume.id}`} className="px-2 py-2.5 text-sm underline underline-offset-4">
        Open
      </Link>
      <button
        type="button"
        onClick={() => download(resume)}
        disabled={downloadingId === resume.id}
        className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm text-ink-2 hover:text-ink disabled:cursor-wait"
      >
        {downloadingId === resume.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Download
      </button>
      <button
        type="button"
        onClick={() => onDelete(resume)}
        className="py-2.5 pl-2 pr-2 text-sm text-ink-2 hover:text-[#b42318] md:pr-0"
      >
        Delete
      </button>
    </>
  )

  return (
    <>
      {/* Phones: one card per resume, with its actions underneath. */}
      <ul className="border-t border-ink md:hidden">
        {resumes.map((resume) => (
          <li key={resume.id} className="flex gap-4 border-b border-rule pb-3 pt-5">
            {thumbnail(resume)}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={`/create/new/${resume.id}`} className="truncate font-serif text-[21px] leading-tight">
                {resume.resumeTitle || "Untitled resume"}
              </Link>
              <span className="text-[13px] text-ink-2">
                {[resume.resumeTag && tagName(resume.resumeTag), templateById(resume.selectedTemplate).name]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="font-mono text-[12px] text-ink-2">{formatEdited(resume.updatedAt)}</span>
              <div className="-ml-2 mt-1 flex flex-wrap">{actions(resume)}</div>
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
              <tr key={resume.id}>
                <td className={cell}>
                  <div className="flex items-center gap-[18px]">
                    {thumbnail(resume)}
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={`/create/new/${resume.id}`}
                        className="font-serif text-[21px] leading-tight hover:underline hover:underline-offset-4"
                      >
                        {resume.resumeTitle || "Untitled resume"}
                      </Link>
                      {resume.resumeTag && <span className="text-[13px] text-ink-2">{tagName(resume.resumeTag)}</span>}
                    </div>
                  </div>
                </td>
                <td className={`${cell} text-[15px]`}>{templateById(resume.selectedTemplate).name}</td>
                <td className={`${cell} font-mono text-[13px] text-ink-2`}>{formatEdited(resume.updatedAt)}</td>
                <td className={`${cell} whitespace-nowrap text-right`}>{actions(resume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
