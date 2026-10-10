"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { FileDown, FileUp } from "lucide-react"
import { openResumes, useResumeContext } from "@/context/ResumeContext"
import CreateResumeModal from "@/components/dashboard/CreateResumeModal"
import DeletedToast from "@/components/dashboard/DeletedToast"
import EmptyShelf from "@/components/dashboard/EmptyShelf"
import Filters, { type Sort, type View } from "@/components/dashboard/Filters"
import { AllConflictDialog, ConflictDialog, OpenErrorDialog, ReadingDialog, type Differing } from "@/components/dashboard/OpenFileDialogs"
import { startPictures } from "@/components/dashboard/pagePictures"
import ResumeGrid from "@/components/dashboard/ResumeGrid"
import ResumeTable, { tagName } from "@/components/dashboard/ResumeTable"
import SearchBar, { matches } from "@/components/dashboard/SearchBar"
import UnreadableData from "@/components/dashboard/UnreadableData"
import { focusShown, nameOf, useListActions } from "@/components/dashboard/useListActions"
import { useReadiness } from "@/components/dashboard/useReadiness"
import DownloadFailed from "@/components/site/DownloadFailed"
import NotSaved from "@/components/site/NotSaved"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import type { OpenedFile } from "@/lib/import/open"
import { hasLeftOut } from "@/lib/leftOut"
import { RESUME_TAGS, type ResumeWithId } from "@/lib/resume"
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

// Where the dashboard remembers whether it shows pages or a list. Only this
// browser's choice, like the resumes; nothing breaks without it.
const VIEW_KEY = "dashboard-view"

function savedView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "pages"
  } catch {
    return "pages"
  }
}

/** How long a deleted resume takes to crumple or fold away, in milliseconds (dashboard.css has the same). */
const LEAVING_MS = 480
/** How long one put back takes to smooth out again. */
const RETURNING_MS = 420

const lessMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

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
  const [opening, setOpening] = useState<Opening | null>(null)
  // What opening a file of them all did, until another file is opened.
  const [allOpened, setAllOpened] = useState("")
  // What's said aloud about the last file opened or downloaded, or resume deleted.
  const [announcement, setAnnouncement] = useState("")
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState<View>("pages")
  const [sort, setSort] = useState<Sort>("edited")
  const [tag, setTag] = useState("all")
  const [query, setQuery] = useState("")
  // The resume deleted last, while it can still be put back. It's only
  // hidden until then, so Undo puts back exactly what was there; it's
  // deleted from the browser when the time's up, another is deleted, or the
  // page is left.
  const [deleting, setDeleting] = useState<{ resume: ResumeWithId; key: number } | null>(null)
  const deletingRef = useRef(deleting)
  const deletions = useRef(0)
  // Resumes crumpling or folding away, and the one put back, smoothing out.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const [returning, setReturning] = useState<string | null>(null)
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

  // Before the first paint, so someone who chose the list doesn't see pages first.
  useLayoutEffect(() => setView(savedView()), [])
  const chooseView = (next: View) => {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Not remembered, then: pages next time.
    }
  }

  const sorted = useMemo(
    () =>
      // Each with the id it's saved under, which is what opens it.
      Object.entries(resumes)
        .map(([id, resume]): ResumeWithId => ({ ...resume, id }))
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
    [resumes],
  )
  // Every resume but one deleted a moment ago; that one shows while it crumples away.
  const deletedId = deleting?.resume.id
  const kept = useMemo(() => sorted.filter((resume) => resume.id !== deletedId), [sorted, deletedId])

  const announce = (text: string) => {
    // Cleared first, so the same words twice in a row are said aloud again.
    setAnnouncement("")
    requestAnimationFrame(() => setAnnouncement(text))
  }

  const actions = useListActions({
    onDuplicate: (resume) => duplicateResume(resume.id),
    onRename: (resume, title) => renameResume(resume.id, title),
    announce,
  })

  const create = (title: string, tag: string) => {
    setCreating(false)
    router.push(`/create/new/${createNewResume(title, tag)}`)
  }

  const edit = (id: string) => {
    setOpening(null)
    router.push(`/create/new/${id}`)
  }

  // Deletes the resume waiting to be put back from the browser, for good.
  const finishDeleting = () => {
    const pending = deletingRef.current
    if (!pending) return
    deletingRef.current = null
    setDeleting(null)
    deleteResume(pending.resume.id)
  }
  const finishDeletingRef = useRef(finishDeleting)
  finishDeletingRef.current = finishDeleting
  // Closing the page, or going to another, can't wait for the time to be up.
  useEffect(() => {
    const finish = () => finishDeletingRef.current()
    window.addEventListener("pagehide", finish)
    return () => {
      window.removeEventListener("pagehide", finish)
      finish()
    }
  }, [])

  const remove = (resume: ResumeWithId) => {
    finishDeleting()
    const pending = { resume, key: ++deletions.current }
    deletingRef.current = pending
    setDeleting(pending)
    announce(`“${nameOf(resume)}” deleted`)
    if (lessMotion()) return
    setLeaving((ids) => new Set(ids).add(resume.id))
    setTimeout(
      () =>
        setLeaving((ids) => {
          const next = new Set(ids)
          next.delete(resume.id)
          return next
        }),
      LEAVING_MS,
    )
  }

  const undo = () => {
    const pending = deletingRef.current
    if (!pending) return
    const { id } = pending.resume
    deletingRef.current = null
    setDeleting(null)
    setLeaving((ids) => {
      const next = new Set(ids)
      next.delete(id)
      return next
    })
    announce(`“${nameOf(pending.resume)}” is back`)
    // Focus goes to it, as Undo is gone.
    requestAnimationFrame(() => focusShown(`[data-resume-link="${CSS.escape(id)}"]`))
    if (lessMotion()) return
    setReturning(id)
    setTimeout(() => setReturning((current) => (current === id ? null : current)), RETURNING_MS)
  }

  const closeOpening = () => {
    reading.current?.abort()
    reading.current = null
    setOpening(null)
  }

  const addAll = (files: FileResume[], options?: { replace?: boolean }) => {
    setOpening(null)
    const done = openedAll(files.length, importAll(files, options))
    setAllOpened(done)
    announce(done)
  }

  const openFile = async (file: File) => {
    // A file may have the resume just deleted in it, which would otherwise look like it's still here.
    finishDeleting()
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
      // The resumes as they are now, read from storage if the page hasn't yet:
      // a file chosen as the page loads can be opened before it has.
      const { resumes: saved } = openResumes().getState()
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
          const here = copyHere(saved, resume)
          return here && !here.unchanged
            ? [{ existingTitle: here.resume.resumeTitle, existingEdited: here.resume.updatedAt, fileEdited: resume.updatedAt }]
            : []
        })
        if (differing.length > 0) setOpening({ step: "all", resumes: opened.resumes, differing })
        else addAll(opened.resumes)
        return
      }
      // A resumezip PDF or JSON file: it restores exactly, unless this browser already has that resume.
      const here = copyHere(saved, opened.resume)
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

  // The pictures of the resumes' first pages use that compiler, and start a
  // moment later, so opening a resume straight away isn't kept waiting. The
  // checker's stamps come once the page has settled too.
  const total = kept.length
  const settledWithResumes = useSettled(loaded && total > 0)
  useEffect(() => {
    if (settledWithResumes && !savingData()) startPictures()
  }, [settledWithResumes])
  const ready = useReadiness(kept, settledWithResumes)

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
    saveFile(toJsonOfAll(kept), `resumezip-resumes-${today()}.json`, "application/json")
    announce(`Downloaded ${count(kept.length, "resume")} in one file`)
  }

  // What's shown: the resumes found by the search, with the chosen tag, in the chosen order.
  // A resume crumpling away keeps its place until it's gone.
  const showing = sorted.filter((resume) => resume.id !== deletedId || leaving.has(resume.id))
  const found = showing.filter((resume) => matches(resume, query))
  const tagOf = (resume: ResumeWithId) => resume.resumeTag?.toLowerCase() ?? ""
  // Counted without the one crumpling away, so the tabs agree with the count above them at once.
  const counted = found.filter((resume) => resume.id !== deletedId)
  const tags = [
    { id: "all", name: "All", count: counted.length },
    ...[...new Set([...RESUME_TAGS.map((option) => option.id), ...counted.map(tagOf).filter(Boolean)])]
      .map((id) => ({ id, name: tagName(id), count: counted.filter((resume) => tagOf(resume) === id).length }))
      .filter((option) => option.count > 0 || option.id === tag),
  ]
  const tagged = found.filter((resume) => tag === "all" || tagOf(resume) === tag)
  const shown =
    sort === "name" ? tagged.sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true, sensitivity: "base" })) : tagged
  // The latest copies, in case one was renamed or deleted since.
  const failedResumes = kept.filter((resume) => actions.failed[resume.id])

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
  // The search bar is there once there's something to search.
  const withBar = loaded && showing.length > 0

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader onStartWriting={() => setCreating(true)} />

      <main
        className={`mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-12 px-5 pb-24 md:px-10 ${withBar ? "pt-4 md:pt-5" : "pt-16 md:pt-20"}`}
      >
        {withBar && <SearchBar resumes={kept} query={query} onQuery={setQuery} onNew={() => setCreating(true)} />}

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
        {failedResumes.length > 0 && (
          <div className="flex max-w-[720px] flex-col gap-4">
            {failedResumes.map((resume) => (
              <DownloadFailed
                key={`${resume.id}-${actions.failed[resume.id].count}`}
                failure={actions.failed[resume.id]}
                title={nameOf(resume)}
                retrying={actions.downloading.includes(resume.id)}
                onRetry={() => actions.download(resume)}
              />
            ))}
          </div>
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>

        {loaded && showing.length > 0 && (
          <div className="flex flex-col gap-8">
            <Filters tags={tags} tag={tag} onTag={setTag} sort={sort} onSort={setSort} view={view} onView={chooseView} />
            {shown.length === 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
                <p className="font-serif text-[24px] leading-tight tracking-[-0.02em]">
                  {query.trim() ? (
                    <>
                      No resumes match &ldquo;{query.trim()}&rdquo;{tag !== "all" && ` in ${tagName(tag)}`}.
                    </>
                  ) : (
                    "None here."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    setTag("all")
                  }}
                  className="text-sm font-medium text-ink underline underline-offset-4"
                >
                  Show all
                </button>
              </div>
            ) : view === "pages" ? (
              <ResumeGrid
                resumes={shown}
                actions={actions}
                onDelete={remove}
                ready={ready}
                leaving={leaving}
                returning={returning}
                onChooseFile={chooseFile}
                dragging={dragging}
              />
            ) : (
              <ResumeTable resumes={shown} actions={actions} onDelete={remove} leaving={leaving} returning={returning} />
            )}
          </div>
        )}

        {loaded && showing.length === 0 && <EmptyShelf onNew={() => setCreating(true)} onChooseFile={chooseFile} dragging={dragging} />}

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

      {deleting && <DeletedToast key={deleting.key} title={nameOf(deleting.resume)} onUndo={undo} onDone={finishDeleting} />}

      {creating && <CreateResumeModal onClose={() => setCreating(false)} onCreate={create} />}

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

/** Whether `ready` has held for a moment, so what starts then doesn't compete with the page coming in. */
function useSettled(ready: boolean): boolean {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!ready || settled) return
    const timer = setTimeout(() => setSettled(true), 1_500)
    return () => clearTimeout(timer)
  }, [ready, settled])
  return settled
}
