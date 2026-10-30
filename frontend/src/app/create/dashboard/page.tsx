"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Download, HardDrive, Plus, Upload } from "lucide-react"
import { openResumes, useResumeContext } from "@/context/ResumeContext"
import CreateResumeModal from "@/components/dashboard/CreateResumeModal"
import TypeModal from "@/components/dashboard/TypeModal"
import DeletedToast from "@/components/dashboard/DeletedToast"
import EmptyShelf from "@/components/dashboard/EmptyShelf"
import Greeting from "@/components/dashboard/Greeting"
import Filters, { type Sort, type View } from "@/components/dashboard/Filters"
import { fly, glideFrom, pageOf, placesIn, restingBox } from "@/components/dashboard/flight"
import { AllConflictDialog, ConflictDialog, OpenErrorDialog, ReadingDialog, type Differing } from "@/components/dashboard/OpenFileDialogs"
import PagePicture from "@/components/dashboard/PagePicture"
import { keepPictures, startPictures } from "@/components/dashboard/pagePictures"
import ResumeGrid from "@/components/dashboard/ResumeGrid"
import ResumeTable, { tagName } from "@/components/dashboard/ResumeTable"
import SearchBar, { matches } from "@/components/dashboard/SearchBar"
import UnreadableData from "@/components/dashboard/UnreadableData"
import { focusShown, nameOf, useListActions } from "@/components/dashboard/useListActions"
import { closingResume, switchView } from "@/components/dashboard/viewSwitch"
import { reducedMotion } from "@/components/editor/layout"
import { BLUE_PILL, sheetPill, WHITE_PILL } from "@/components/pills"
import DownloadFailed from "@/components/site/DownloadFailed"
import NotSaved from "@/components/site/NotSaved"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { count } from "@/lib/count"
import type { OpenedFile } from "@/lib/import/open"
import { hasLeftOut } from "@/lib/leftOut"
import { RESUME_TAGS, type ResumeWithId } from "@/lib/resume"
import { toJsonOfAll, type FileResume } from "@/lib/resumeFile"
import { copyHere } from "@/lib/resumeStore"
import { saveFile } from "@/lib/saveFile"
import { loadCompiler, savingData } from "@/lib/typst/compile"
import { templateIdOf } from "@/lib/typst/resumeData"
import type { TemplateId } from "@/lib/templates"
import type { Paper } from "@/lib/tune"
import { CARD_SHEET, COUNT_BADGE, PAPER_FRAME } from "@/components/site/sheet"

// Only loaded when someone opens a PDF or Word file that resumezip didn't make.
const ImportReview = dynamic(() => import("@/components/dashboard/ImportReview"))

const ACCEPTED_FILES =
  ".pdf,.docx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json"

type Opening =
  | { step: "reading"; fileName: string }
  | { step: "error"; message: string }
  | { step: "conflict"; file: Extract<OpenedFile, { kind: "resumezip" }>; existing: ResumeWithId }
  | { step: "all"; resumes: FileResume[]; differing: Differing[] }
  | { step: "review"; file: Extract<OpenedFile, { kind: "parsed" }> }

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

/**
 * How long a deleted resume keeps its place, unseen, in milliseconds, as its
 * page lifts off toward the Undo message, before the rest slide into the gap.
 */
const LEAVING_MS = 160

/** Today, as "2026-10-09", for the name of a file of every resume. */
function today() {
  const now = new Date()
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-")
}

// The "All" chip's value: empty, which no type can be (cleanTag drops a blank
// one), so a type of the person's own named "all" is a chip of its own.
const EVERY_TYPE = ""

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
    editResume,
  } = useResumeContext()
  const [creating, setCreating] = useState(false)
  // The resume whose type is being changed, while its dialog is open.
  const [retyping, setRetyping] = useState<ResumeWithId | null>(null)
  const [opening, setOpening] = useState<Opening | null>(null)
  // What opening a file of them all did, until another file is opened.
  const [allOpened, setAllOpened] = useState("")
  // What's said aloud about the last thing done here, as a file opened or a resume deleted.
  const [announcement, setAnnouncement] = useState("")
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState<View>("pages")
  // Set once a switch fades the new view in: off until then, so the first view doesn't fade in on load.
  const [fadeIn, setFadeIn] = useState(false)
  // Back from the editor, the page comes in with the transition's crossfade alone (closingResume).
  const [closedResume] = useState(closingResume)
  const [sort, setSort] = useState<Sort>("edited")
  const [tag, setTag] = useState(EVERY_TYPE)
  const [query, setQuery] = useState("")
  // The resume deleted last, while it can still be put back. It's only
  // hidden until then, so Undo puts back exactly what was there; it's
  // deleted from the browser when the time's up, another is deleted, a file
  // is opened, or the page is left.
  const [deleting, setDeleting] = useState<{ resume: ResumeWithId; key: number } | null>(null)
  const deletingRef = useRef(deleting)
  const deletions = useRef(0)
  // Resumes just deleted, keeping their place for a moment, and the one put
  // back, while its page flies back to it (flight.ts).
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const [returning, setReturning] = useState<string | null>(null)
  // The resumes as pages or the list, where they're measured to slide, and
  // the copy of a page in flight, taken away if another delete or Undo comes first.
  const viewRef = useRef<HTMLDivElement>(null)
  const flying = useRef<HTMLElement | null>(null)
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
    if (next === view) return
    if (switchView(() => setView(next)) !== "instant") setFadeIn(true)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Not remembered, then: pages next time.
    }
  }

  const sorted = useMemo(
    () =>
      // Each with the id it's saved under, which is what opens it. Resumes
      // edited at the same moment go by name, rather than in whatever order
      // the browser keeps its storage in.
      Object.entries(resumes)
        .map(([id, resume]): ResumeWithId => ({ ...resume, id }))
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime() ||
            nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true, sensitivity: "base" }),
        ),
    [resumes],
  )
  // Every resume but one deleted a moment ago; that one keeps its place while its page lifts off.
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

  const create = ({ title, tag, template, paper }: { title: string; tag: string; template: TemplateId; paper: Paper }) => {
    setCreating(false)
    router.push(`/create/new/${createNewResume(title, tag, template, paper)}`)
  }

  // A copy made from New resume opens, as a new resume does; one made from a resume's Duplicate stays in the list.
  const copy = (id: string, look: { template: TemplateId; paper: Paper }) => {
    setCreating(false)
    const copied = duplicateResume(id, look)
    if (copied) router.push(`/create/new/${copied}`)
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
      flying.current?.remove()
    }
  }, [])

  const forgetLeaving = (id: string) =>
    setLeaving((ids) => {
      const next = new Set(ids)
      next.delete(id)
      return next
    })

  // Its page flies into the Undo message, and the resumes after it slide into its place.
  const remove = (resume: ResumeWithId) => {
    finishDeleting()
    const pending = { resume, key: ++deletions.current }
    deletingRef.current = pending
    announce(`“${nameOf(resume)}” deleted`)
    if (reducedMotion()) {
      setDeleting(pending)
      return
    }
    // The message goes on the page at once, so the page knows where to fly.
    flushSync(() => {
      setDeleting(pending)
      setLeaving((ids) => new Set(ids).add(resume.id))
    })
    flying.current?.remove()
    const page = pageOf(viewRef.current, resume.id)
    const slot = document.querySelector<HTMLElement>("[data-toast-page]")
    flying.current = page && slot ? fly(page, restingBox(slot)) : null
    setTimeout(() => {
      const before = placesIn(viewRef.current)
      flushSync(() => forgetLeaving(resume.id))
      glideFrom(before)
    }, LEAVING_MS)
  }

  const undo = () => {
    const pending = deletingRef.current
    if (!pending) return
    const { id } = pending.resume
    deletingRef.current = null
    announce(`“${nameOf(pending.resume)}” is back`)
    // Focus goes to it, as Undo is gone.
    requestAnimationFrame(() => focusShown(`[data-resume-link="${CSS.escape(id)}"]`))
    const restore = () => {
      setDeleting(null)
      forgetLeaving(id)
    }
    if (reducedMotion()) return restore()
    // Its page flies back out of the message, which is measured before it goes,
    // and the resumes after it slide out of its way. It shows once the page lands.
    const slot = document.querySelector<HTMLElement>("[data-toast-page]")?.getBoundingClientRect()
    const before = placesIn(viewRef.current)
    flying.current?.remove()
    flushSync(() => {
      restore()
      setReturning(id)
    })
    glideFrom(before)
    const page = pageOf(viewRef.current, id)
    const landed = () => flushSync(() => setReturning((current) => (current === id ? null : current)))
    if (slot && page) flying.current = fly(page, slot, true, landed)
    else landed()
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
    // Opening a file is a way to start a resume too, so New resume, if it's open, gives way to it.
    setCreating(false)
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
      // A resumezip PDF, Word or JSON file: it restores exactly, unless this browser already has that resume.
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
  // moment later, so opening a resume straight away isn't kept waiting.
  const total = kept.length
  const settledWithResumes = useSettled(loaded && total > 0)
  useEffect(() => {
    if (settledWithResumes && !savingData()) startPictures()
  }, [settledWithResumes])
  // A deleted resume's picture is let go of, rather than kept for the rest of the visit.
  useEffect(() => {
    if (loaded) keepPictures(Object.keys(resumes))
  }, [loaded, resumes])

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
  // A resume just deleted keeps its place for a moment, as its page lifts off.
  const showing = sorted.filter((resume) => resume.id !== deletedId || leaving.has(resume.id))
  const found = showing.filter((resume) => matches(resume, query))
  const tagOf = (resume: ResumeWithId) => resume.resumeTag?.toLowerCase() ?? ""
  // Counted without the one just deleted, so the tabs agree with the count above them at once.
  const counted = found.filter((resume) => resume.id !== deletedId)
  const tags = [
    { id: EVERY_TYPE, name: "All", count: counted.length },
    ...[...new Set([...RESUME_TAGS.map((option) => option.id), ...counted.map(tagOf).filter(Boolean)])]
      // A type of the person's own is named as they wrote it, from the first resume that has it.
      .map((id) => ({
        id,
        name: tagName(counted.find((resume) => tagOf(resume) === id)?.resumeTag ?? id),
        count: counted.filter((resume) => tagOf(resume) === id).length,
      }))
      .filter((option) => option.count > 0 || option.id === tag),
  ]
  // The person's own types, as they wrote them, once each whatever the case, to pick again.
  const ownTypes = [
    ...new Map(
      sorted
        .map((resume) => resume.resumeTag ?? "")
        .filter((tag) => tag !== "" && !RESUME_TAGS.some((option) => option.id === tag.toLowerCase()))
        .map((tag) => [tag.toLowerCase(), tag]),
    ).values(),
  ]
  const tagged = found.filter((resume) => tag === EVERY_TYPE || tagOf(resume) === tag)
  const shown =
    sort === "name"
      ? [...tagged].sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true, sensitivity: "base" }))
      : tagged
  // The latest copies, in case one was renamed or deleted since.
  const failedResumes = kept.filter((resume) => actions.failed[resume.id])

  return (
    <div className="desk desk-bright flex min-h-screen flex-col">
      <SiteHeader />

      {/* One sheet in a frosted frame over the sky, holding the greeting, the toolbar and the resumes. */}
      <div className={PAPER_FRAME}>
        <main className={CARD_SHEET} data-no-page-in={closedResume || undefined}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p className={COUNT_BADGE}>
                <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {loaded
                    ? `${count(total, "resume")} · ${saveStatus === "saved" ? "Saved in this browser" : "Not saved"}`
                    : "Saved in this browser"}
                </span>
              </p>
              {/* With nothing to download it's there, as the rest of the page is, but can't be used. */}
              {loaded && (
                <button
                  type="button"
                  onClick={downloadAll}
                  disabled={total === 0}
                  className={sheetPill("text", "h-[34px] px-3.5 text-[14px]")}
                >
                  <Download aria-hidden="true" />
                  Download all
                </button>
              )}
            </div>
            {/* The same with no resumes, so the page doesn't change shape when the first arrives. */}
            {loaded && (
              <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full max-sm:[&>*]:flex-1">
                <button type="button" onClick={chooseFile} className={WHITE_PILL}>
                  <Upload aria-hidden="true" />
                  Open a file
                </button>
                <button type="button" onClick={() => setCreating(true)} className={BLUE_PILL}>
                  <Plus aria-hidden="true" />
                  New resume
                </button>
              </div>
            )}
          </div>

          <Greeting resumes={kept} loaded={loaded} />

          {(saveStatus !== "saved" || allOpened || failedResumes.length > 0) && (
            <div className="mx-auto mt-8 flex w-full max-w-[720px] flex-col gap-4">
              <NotSaved />
              {allOpened && (
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <span className="label-mono shrink-0 text-ink-2">Opened</span>
                  <p className="min-w-0 flex-[1_1_280px] text-sm leading-relaxed text-ink">{allOpened}</p>
                </div>
              )}
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
          <div className="mx-auto w-full max-w-[720px] empty:hidden [&>*]:mt-8">
            <UnreadableData />
          </div>
          <p role="status" className="sr-only">
            {announcement}
          </p>

          {/* The bar is straight in main, not in the block with the resumes, which fades in (page-in in
              globals.css): glass in a fading block can't blur what's behind it, so the bar would change color
              as the fade ended. */}
          {loaded && (
            <>
              <Filters
                className="mt-8 md:mt-5"
                search={<SearchBar resumes={kept} query={query} onQuery={setQuery} />}
                tags={tags}
                tag={tag}
                onTag={setTag}
                sort={sort}
                onSort={setSort}
                view={view}
                onView={chooseView}
              />
              <div className="mt-5 flex flex-col">
                {showing.length === 0 ? (
                  <EmptyShelf onNew={() => setCreating(true)} onChooseFile={chooseFile} dragging={dragging} />
                ) : shown.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-[22px] font-medium leading-tight tracking-[-0.02em]">
                      {query.trim() ? (
                        <>
                          No resumes match &ldquo;{query.trim()}&rdquo;{tag !== EVERY_TYPE && ` in ${tagName(tag)}`}.
                        </>
                      ) : (
                        "None here."
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("")
                        setTag(EVERY_TYPE)
                      }}
                      className={WHITE_PILL}
                    >
                      Show all
                    </button>
                  </div>
                ) : (
                  // A new one for each view, so the fade starts from nothing.
                  <div key={view} ref={viewRef} className={fadeIn ? "view-fade" : undefined}>
                    {view === "pages" ? (
                      <ResumeGrid
                        resumes={shown}
                        actions={actions}
                        onDelete={remove}
                        onRetype={setRetyping}
                        leaving={leaving}
                        returning={returning}
                        onNew={() => setCreating(true)}
                      />
                    ) : (
                      <ResumeTable
                        resumes={shown}
                        actions={actions}
                        onDelete={remove}
                        onRetype={setRetyping}
                        leaving={leaving}
                        returning={returning}
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

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
        <div aria-hidden="true" className="dialog-backdrop pointer-events-none fixed inset-0 z-40 p-4">
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed border-accent bg-sheet/40">
            <p className="font-serif text-[40px] leading-tight tracking-[-0.02em]">Drop to open</p>
            <p className="label-mono text-ink-2">PDF, Word or JSON file</p>
          </div>
        </div>
      )}

      {deleting && (
        <DeletedToast
          key={deleting.key}
          title={nameOf(deleting.resume)}
          page={<PagePicture id={deleting.resume.id} resume={deleting.resume} sizes="22px" className="h-full w-full" />}
          onUndo={undo}
          onDone={finishDeleting}
        />
      )}

      {creating && (
        <CreateResumeModal
          own={ownTypes}
          resumes={kept}
          dragging={dragging}
          onClose={() => setCreating(false)}
          onCreate={create}
          onCopy={copy}
          onChooseFile={chooseFile}
        />
      )}
      {retyping && (
        <TypeModal
          resume={retyping}
          own={ownTypes}
          onClose={() => setRetyping(null)}
          onSave={(tag) => {
            editResume(retyping.id, "resumeTag", tag)
            announce(tag ? `${nameOf(retyping)} is now ${tagName(tag)}` : `${nameOf(retyping)} has no type now`)
            setRetyping(null)
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
