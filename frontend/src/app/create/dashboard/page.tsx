"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { FileDown, FileUp, Plus } from "lucide-react"
import { useResumeContext } from "@/context/ResumeContext"
import CreateResumeModal from "@/components/dashboard/CreateResumeModal"
import DeleteResumeModal from "@/components/dashboard/DeleteResumeModal"
import { AllConflictDialog, ConflictDialog, OpenErrorDialog, ReadingDialog, type Differing } from "@/components/dashboard/OpenFileDialogs"
import ResumeTable from "@/components/dashboard/ResumeTable"
import UnreadableData from "@/components/dashboard/UnreadableData"
import NotSaved from "@/components/site/NotSaved"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import type { OpenedFile } from "@/lib/import/open"
import { hasLeftOut } from "@/lib/leftOut"
import type { ResumeWithId } from "@/lib/resume"
import { toJsonOfAll, type FileResume } from "@/lib/resumeFile"
import { copyHere } from "@/lib/resumeStore"
import { saveFile } from "@/lib/saveFile"
import { loadCompiler, savingData } from "@/lib/typst/compile"
import { templateIdOf } from "@/lib/typst/resumeData"

// Only loaded when someone opens a file that isn't a resumezip PDF.
const ImportReview = dynamic(() => import("@/components/dashboard/ImportReview"))

const ACCEPTED_FILES =
  ".pdf,.docx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json"

type Opening =
  | { step: "reading"; fileName: string }
  | { step: "error"; message: string }
  | { step: "conflict"; file: Extract<OpenedFile, { kind: "resumezip" }>; existing: ResumeWithId }
  | { step: "all"; resumes: FileResume[]; differing: Differing[] }
  | { step: "review"; file: Extract<OpenedFile, { kind: "parsed" }> }

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What opening a file of them all did, said once it's done. */
function openedAll(total: number, { added, replaced }: { added: number; replaced: number }) {
  if (added + replaced === 0) return "Every resume in the file is already here."
  const done =
    added > 0 && replaced > 0
      ? `Added ${count(added, "resume")} and replaced ${replaced}.`
      : added > 0
        ? `Added ${count(added, "resume")}.`
        : `Replaced ${count(replaced, "resume")}.`
  const same = total - added - replaced
  return same > 0 ? `${done} ${same} ${same === 1 ? "was" : "were"} already here.` : done
}

/** Today, as "2026-10-09", for the name of a file of every resume. */
function today() {
  const now = new Date()
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-")
}

export default function DashboardPage() {
  const router = useRouter()
  const {
    resumes,
    loaded,
    saveStatus,
    deleteResume,
    createNewResume,
    importResume,
    importAll,
    replaceResume,
    duplicateResume,
    renameResume,
  } = useResumeContext()
  const [creating, setCreating] = useState(false)
  const [resumeToDelete, setResumeToDelete] = useState<ResumeWithId | null>(null)
  const [opening, setOpening] = useState<Opening | null>(null)
  // What opening a file of them all did, until another file is opened.
  const [allOpened, setAllOpened] = useState("")
  // What's said aloud about the last file opened or downloaded.
  const [announcement, setAnnouncement] = useState("")
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // The file being read. Cancelling (or opening another file) stops it, and
  // means it can't reappear if it was just finishing.
  const reading = useRef<AbortController | null>(null)
  // Leaving the page stops it too.
  useEffect(
    () => () => {
      reading.current?.abort()
      reading.current = null
    },
    [],
  )

  const sorted = useMemo(
    () =>
      // Each with the id it's saved under, which is what opens it.
      Object.entries(resumes)
        .map(([id, resume]): ResumeWithId => ({ ...resume, id }))
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
    [resumes],
  )

  const create = (title: string, tag: string) => {
    setCreating(false)
    router.push(`/create/new/${createNewResume(title, tag)}`)
  }

  const edit = (id: string) => {
    setOpening(null)
    router.push(`/create/new/${id}`)
  }

  const closeOpening = () => {
    reading.current?.abort()
    reading.current = null
    setOpening(null)
  }

  const announce = (text: string) => {
    // Cleared first, so the same words twice in a row are said aloud again.
    setAnnouncement("")
    requestAnimationFrame(() => setAnnouncement(text))
  }

  const addAll = (files: FileResume[], options?: { replace?: boolean }) => {
    setOpening(null)
    const done = openedAll(files.length, importAll(files, options))
    setAllOpened(done)
    announce(done)
  }

  const openFile = async (file: File) => {
    reading.current?.abort()
    const current = new AbortController()
    reading.current = current
    setAllOpened("")
    setOpening({ step: "reading", fileName: file.name })
    // Kept once the code that reads files has loaded, so a failure can say
    // what's wrong without waiting on anything (or loading it again).
    let OpenFileError: typeof import("@/lib/import/open").OpenFileError | undefined
    try {
      const open = await import("@/lib/import/open")
      OpenFileError = open.OpenFileError
      const opened = await open.openResumeFile(file, { signal: current.signal })
      if (current !== reading.current) {
        if (opened.kind === "parsed") void opened.pdf?.doc.destroy()
        return
      }
      reading.current = null
      if (opened.kind === "parsed") {
        setOpening({ step: "review", file: opened })
        return
      }
      // Each resume in a file of them all that's here, but different, which takes a question.
      if (opened.kind === "all") {
        const differing = opened.resumes.flatMap(({ resume }): Differing[] => {
          const here = copyHere(resumes, resume)
          return here && !here.unchanged
            ? [{ existingTitle: here.resume.resumeTitle, existingEdited: here.resume.updatedAt, fileEdited: resume.updatedAt }]
            : []
        })
        if (differing.length > 0) setOpening({ step: "all", resumes: opened.resumes, differing })
        else addAll(opened.resumes)
        return
      }
      // A resumezip PDF or JSON file: it restores exactly, unless this browser already has that resume.
      const here = copyHere(resumes, opened.resume)
      if (!here) edit(importResume(opened.resume, opened.title, { tag: opened.tag }))
      else if (here.unchanged) edit(opened.resume.id!)
      else setOpening({ step: "conflict", file: opened, existing: { ...here.resume, id: opened.resume.id! } })
    } catch (error) {
      if (current !== reading.current) return
      reading.current = null
      const problem = OpenFileError && error instanceof OpenFileError ? error.message : null
      if (problem === null) console.error("Couldn't open file:", error)
      setOpening({ step: "error", message: problem ?? "Something went wrong reading this file. Try a PDF or Word copy of it." })
    }
  }

  // The review shows the PDF itself, so it stays open until the review
  // closes. Closed here rather than in the review, which React mounts twice
  // in development.
  const reviewedPdf = opening?.step === "review" ? opening.file.pdf?.doc : undefined
  useEffect(() => {
    if (!reviewedPdf) return
    return () => void reviewedPdf.destroy()
  }, [reviewedPdf])

  // People here are usually a click away from the editor, so the PDF
  // compiler starts downloading once the page has settled, with the fonts of
  // the resume edited last. Visitors saving data only download it when they
  // open a resume.
  const lastTemplate = templateIdOf(sorted[0]?.selectedTemplate)
  useEffect(() => {
    if (!loaded || savingData()) return
    const timer = setTimeout(() => loadCompiler(lastTemplate), 1_000)
    return () => clearTimeout(timer)
  }, [loaded, lastTemplate])

  // Dropping a file anywhere on the page opens it.
  const openFileRef = useRef(openFile)
  openFileRef.current = openFile
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files")
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth++
      setDragging(true)
    }
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file) void openFileRef.current(file)
    }
    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragover", onOver)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [])

  const chooseFile = () => {
    setOpening(null)
    fileInput.current?.click()
  }

  // Every resume in one JSON file, newest first, as the list shows them.
  const downloadAll = () => {
    saveFile(toJsonOfAll(sorted), `resumezip-resumes-${today()}.json`, "application/json")
    announce(`Downloaded ${count(sorted.length, "resume")} in one file`)
  }

  const total = sorted.length
  const newResumeButton = (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-ink px-[18px] text-sm font-medium text-white transition-colors hover:bg-black"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      New resume
    </button>
  )
  const openFileButton = (
    <button
      type="button"
      onClick={chooseFile}
      className="inline-flex h-11 items-center gap-2 rounded-[4px] border border-rule-strong px-[18px] text-sm font-medium text-ink transition-colors hover:border-ink"
    >
      <FileUp className="h-4 w-4" aria-hidden="true" />
      Open a file
    </button>
  )
  const downloadAllButton = (
    <button
      type="button"
      onClick={downloadAll}
      className="inline-flex h-11 items-center gap-2 rounded-[4px] border border-rule-strong px-[18px] text-sm font-medium text-ink transition-colors hover:border-ink"
    >
      <FileDown className="h-4 w-4" aria-hidden="true" />
      Download all
    </button>
  )

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader onStartWriting={() => setCreating(true)} />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-12 px-5 pb-24 pt-16 md:px-10 md:pt-20">
        <PageIntro
          label={
            loaded
              ? `${count(total, "resume")} · ${saveStatus === "saved" ? "stored in this browser" : "not saved"}`
              : "Stored in this browser"
          }
          title="Your resumes"
          actions={
            total > 0 ? (
              <div className="flex flex-wrap gap-2">
                {downloadAllButton}
                {openFileButton}
                {newResumeButton}
              </div>
            ) : undefined
          }
        />

        <NotSaved className="max-w-[720px]" />
        <UnreadableData />
        {allOpened && (
          <div className="flex max-w-[720px] flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="label-mono shrink-0 text-ink-2">Opened</span>
            <p className="min-w-0 flex-[1_1_280px] text-sm leading-relaxed text-ink">{allOpened}</p>
          </div>
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>

        {loaded && total > 0 && (
          <ResumeTable
            resumes={sorted}
            onDuplicate={(resume) => duplicateResume(resume.id)}
            onRename={(resume, title) => renameResume(resume.id, title)}
            onDelete={setResumeToDelete}
          />
        )}

        {loaded && total === 0 && (
          <div className="flex flex-col items-start gap-5 border-t border-ink pt-8">
            <p className="font-serif text-[28px] leading-tight tracking-[-0.02em]">No resumes yet.</p>
            <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
              Start one, or open a resume you already have: a PDF, a Word file, or a JSON file from resumezip.
            </p>
            <div className="flex flex-wrap gap-2">
              {newResumeButton}
              {openFileButton}
            </div>
          </div>
        )}

        <div className="flex max-w-[720px] flex-wrap items-baseline gap-x-8 gap-y-3">
          <span className="label-mono text-accent">Stored locally</span>
          <p className="min-w-0 flex-[1_1_320px] text-sm leading-relaxed text-ink-2">
            Resumes live in this browser only. Every PDF you download carries its resume, so you can open it here again on any computer.
            Download all puts every resume in one file, to move them all at once.
          </p>
        </div>
      </main>

      <SiteFooter />

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void openFile(file)
        }}
      />

      {dragging && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 bg-paper/95 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-accent">
            <p className="font-serif text-[40px] leading-tight tracking-[-0.02em]">Drop to open</p>
            <p className="label-mono text-ink-2">PDF, Word or JSON file</p>
          </div>
        </div>
      )}

      {creating && <CreateResumeModal onClose={() => setCreating(false)} onCreate={create} />}
      {resumeToDelete && (
        <DeleteResumeModal
          resumeTitle={resumeToDelete.resumeTitle}
          onClose={() => setResumeToDelete(null)}
          onDelete={() => {
            deleteResume(resumeToDelete.id)
            setResumeToDelete(null)
          }}
        />
      )}

      {opening?.step === "reading" && <ReadingDialog fileName={opening.fileName} onCancel={closeOpening} />}
      {opening?.step === "error" && <OpenErrorDialog message={opening.message} onClose={closeOpening} onRetry={chooseFile} />}
      {opening?.step === "conflict" && (
        <ConflictDialog
          existingTitle={opening.existing.resumeTitle}
          existingEdited={opening.existing.updatedAt}
          fileEdited={opening.file.resume.updatedAt}
          from={opening.file.from}
          existingLeftOut={hasLeftOut(opening.existing)}
          onCancel={closeOpening}
          onKeepBoth={() => edit(importResume(opening.file.resume, opening.file.title, { keepId: false, tag: opening.file.tag }))}
          onReplace={() => {
            replaceResume(opening.existing.id, opening.file.resume, opening.file.from)
            edit(opening.existing.id)
          }}
        />
      )}
      {opening?.step === "all" && (
        <AllConflictDialog
          differing={opening.differing}
          onCancel={closeOpening}
          onKeepBoth={() => addAll(opening.resumes)}
          onReplace={() => addAll(opening.resumes, { replace: true })}
        />
      )}
      {opening?.step === "review" && (
        <ImportReview
          file={opening.file}
          onCancel={closeOpening}
          onCreate={(content) => edit(importResume(content, opening.file.title, { keepId: false }))}
        />
      )}
    </div>
  )
}
