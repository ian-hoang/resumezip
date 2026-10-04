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

  return (
    <div className="overflow-x-auto border-t border-ink">
      <table className="w-full min-w-[720px] border-collapse">
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
          {resumes.map((resume) => {
            const template = templateById(resume.selectedTemplate)
            const href = `/create/new/${resume.id}`
            return (
              <tr key={resume.id}>
                <td className={cell}>
                  <div className="flex items-center gap-[18px]">
                    <Image
                      src={template.image}
                      alt=""
                      width={46}
                      height={60}
                      className="h-[60px] w-[46px] bg-sheet object-cover object-top ring-1 ring-rule"
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link href={href} className="font-serif text-[21px] leading-tight hover:underline hover:underline-offset-4">
                        {resume.resumeTitle || "Untitled resume"}
                      </Link>
                      {resume.resumeTag && <span className="text-[13px] text-ink-2">{tagName(resume.resumeTag)}</span>}
                    </div>
                  </div>
                </td>
                <td className={`${cell} text-[15px]`}>{template.name}</td>
                <td className={`${cell} font-mono text-[13px] text-ink-2`}>{formatEdited(resume.updatedAt)}</td>
                <td className={`${cell} whitespace-nowrap text-right`}>
                  <Link href={href} className="px-2 py-2.5 text-sm underline underline-offset-4">
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
                    className="py-2.5 pl-2 text-sm text-ink-2 hover:text-[#b42318]"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
