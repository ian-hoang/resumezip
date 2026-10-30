"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, Eye, PencilLine } from "lucide-react"
import { OpenResumeProvider, useOpenResume, useResumeActions, useResumeField, useResumeState } from "@/context/ResumeContext"
import DeletedToast from "@/components/dashboard/DeletedToast"
import { DownloadIcon } from "@/components/dashboard/RowActions"
import { closeResume } from "@/components/dashboard/viewSwitch"
import { CheckProvider } from "@/components/editor/CheckContext"
import { DriveIcon, JsonIcon, LatexIcon, ShareIcon, WordIcon } from "@/components/editor/FormatIcons"
import DownloadMenu, { type MenuNotice } from "@/components/editor/DownloadMenu"
import LeftBar from "@/components/editor/LeftBar"
import PdfPreview from "@/components/editor/PdfPreview"
import Loader from "@/components/site/Loader"
import ProfileForm from "@/components/editor/ProfileForm"
import Replaced from "@/components/editor/Replaced"
import SectionForm, { type DeletedEntry } from "@/components/editor/SectionForm"
import ExtraSectionForm from "@/components/editor/ExtraSectionForm"
import { reducedMotion, useWideScreen, WIDE_SCREEN } from "@/components/editor/layout"
import SectionNav, { type ActiveSection } from "@/components/editor/SectionNav"
import StylePanel from "@/components/editor/StylePanel"
import TemplatePicker from "@/components/editor/TemplatePicker"
import { swapView } from "@/components/editor/swapView"
import { useFold } from "@/components/editor/useFold"
import { useKeepFormPlace } from "@/components/editor/useKeepFormPlace"
import { usePdfFile } from "@/components/editor/usePdfFile"
import { useSaveToDrive } from "@/components/editor/useSaveToDrive"
import { useSharePdf } from "@/components/editor/useSharePdf"
import DownloadFailed, { nextFailure, type Failure } from "@/components/site/DownloadFailed"
import NotSaved from "@/components/site/NotSaved"
import { SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Resume } from "@/lib/resume"
import { toJson } from "@/lib/resumeFile"
import { extraKey, filledSections, resolveSections, type ExtraKind, type SectionRef } from "@/lib/resumeSections"
import { resumeOf } from "@/lib/resumeStore"
import { fileNameOf, saveFile } from "@/lib/saveFile"
import { compilePreview, forgetPreviewFit, loadCompiler, makeDownload, printedOf, Superseded } from "@/lib/typst/compile"
import { templateIdOf } from "@/lib/typst/resumeData"
import type { TemplateId } from "@/lib/templates"

// After a change, the preview waits about as long as a compile takes before
// compiling: fast computers update quickly, and slow phones don't compile
// for every pause in typing.
const MIN_WAIT_MS = 150
const MAX_WAIT_MS = 400
// How long a replaced preview PDF is kept before it's freed.
const PDF_KEPT_MS = 10_000
// How long "Saving…" stays after a change is saved, which is SAVE_DELAY after
// typing stops, so a pause between words doesn't flick it to "Saved" and back.
const SAVED_AFTER_MS = 800
// How long "Downloaded" shows after a download.
const DOWNLOADED_MS = 2000
// How long the line along Download PDF takes to fill, however quick the PDF is
// (--animate-download-progress in globals.css). The file is saved as it ends.
// Long enough to see it fill without waiting on it.
const DOWNLOAD_FILL_MS = 1500

const EDITOR_ADDRESS = "/create/new/"

// How long a deleted section takes to fade away before the next one shows.
const LEAVE_MS = 220

// The widest the page is drawn at 100% while the form is folded away: big enough to read like a printed page.
const FOLDED_PAGE_WIDTH = 860

// The notes under the top bar's row, across the top bar: what wasn't saved, a
// resume replaced by an opened file, a download that failed.
const BANNER = "border-t border-hairline px-5 py-3 lg:px-6"

/**
 * The resume id in an editor address: all of the path after /create/new/, as
 * an id can have a "/" in it, without the browser's escapes (a space is %20).
 */
function idFromAddress(pathname: string): string {
  const escaped = pathname.startsWith(EDITOR_ADDRESS) ? pathname.slice(EDITOR_ADDRESS.length) : ""
  try {
    return decodeURIComponent(escaped)
  } catch {
    // A "%" that doesn't start an escape is part of the id.
    return escaped
  }
}

export default function EditorPage() {
  // next.config.js serves this one prebuilt page at every resume's address,
  // /create/new/<id>, so the id comes from the address.
  const id = idFromAddress(usePathname())
  // Going back or forward from one resume straight to another stays on this
  // page; keyed by resume, the editor starts afresh rather than keeping the
  // last one's open section, preview and messages.
  return (
    <OpenResumeProvider id={id}>
      <Editor key={id} id={id} />
    </OpenResumeProvider>
  )
}

// The editor reads the resume a field at a time (useResumeField), and the
// preview follows it in the store, so typing re-renders only the form being
// typed in, not the editor around it.
function Editor({ id }: { id: string }) {
  const { getState, subscribe, addSection, removeSection, deleteSection, reorderSections } = useResumeActions()
  const { read, update } = useOpenResume()
  const router = useRouter()
  const loaded = useResumeState((state) => state.loaded)
  // Whether this browser has the resume, once storage has loaded.
  const found = useResumeState((state) => state.loaded && resumeOf(state, id) !== undefined)
  const selectedTemplate = useResumeField("selectedTemplate")
  const savedOrder = useResumeField("sectionOrder")
  const headings = useResumeField("headings")
  const extraSections = useResumeField("extraSections")
  const sectionsChosen = useResumeField("sectionsChosen")
  const [active, setActive] = useState<ActiveSection>("Profile")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  // What the preview on screen prints, for the checker to know when it's
  // current, and what the resume printed when a preview last failed to build.
  const [pdfPrinted, setPdfPrinted] = useState("")
  // The resume the preview on screen was made from, for the checker to read it by.
  const [pdfResume, setPdfResume] = useState<Resume | undefined>(undefined)
  const [unbuilt, setUnbuilt] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  // When the last download finished, while the button says so; 0 otherwise.
  const [downloadedAt, setDownloadedAt] = useState(0)
  const downloaded = downloadedAt > 0
  const [failure, setFailure] = useState<Failure | null>(null)
  // Said to screen readers once another format is downloaded, or the PDF is shared or saved to Google Drive.
  const [savedAs, setSavedAs] = useState("")
  // Said again, even when it's the same as last time.
  const announce = useCallback((message: string) => {
    setSavedAs("")
    requestAnimationFrame(() => setSavedAs(message))
  }, [])
  // The entry deleted last, while Undo can put it back: until the time's up,
  // or another entry or a section is deleted. It's gone from the resume
  // meanwhile, so the preview and the checker are without it.
  const [deletedEntry, setDeletedEntry] = useState<(DeletedEntry & { key: number }) | null>(null)
  const deletions = useRef(0)
  // The entry Undo put back, until its section has opened it.
  const [restored, setRestored] = useState<{ section: SectionName; id: number } | null>(null)
  // On wide screens the message sits at the foot of the form's panel rather than the window's middle.
  const formRef = useRef<HTMLDivElement>(null)
  const [toastSpan, setToastSpan] = useState<CSSProperties | undefined>(undefined)
  // The PDF that Share PDF and Save to Google Drive hand on, made once per change.
  const preparePdf = usePdfFile()
  const sharePdf = useSharePdf(preparePdf, () => announce("PDF shared"))
  const drive = useSaveToDrive(preparePdf, () => announce("PDF saved to Google Drive"))
  // What to do with a LaTeX file pdfLaTeX can't compile, under the ▾ once it's downloaded.
  const [latexNotice, setLatexNotice] = useState<MenuNotice | null>(null)
  // Small screens show the form or the preview, not both.
  const [view, setView] = useState<"edit" | "preview">("edit")
  // On wide screens the form can be folded away, so the page has the sheet to itself.
  const { folded, shut, foldTo, fold } = useFold()
  // The Write | Check | Style tabs are in the top bar on wide screens, and atop the left bar narrower.
  const wide = useWideScreen()
  const [typing, setTyping] = useState(false)
  const editScroll = useRef(0)
  // How long the last preview took.
  const compileMs = useRef(MIN_WAIT_MS)
  const headerRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  // Resizing across the wide-screen width keeps the form where it was scrolled to.
  useKeepFormPlace(mainRef, found)

  // The PDF compiler starts loading as soon as the resume is found, with its
  // template's fonts, before the first preview asks for it. A resume that
  // isn't here doesn't need it.
  const template = templateIdOf(selectedTemplate)
  useEffect(() => {
    if (found) loadCompiler(template)
  }, [found, template])

  // Fine-tune says what keeping the last preview to one page did; a resume
  // opened here hasn't had a preview yet, so that's forgotten, as it is on leaving.
  useEffect(() => {
    forgetPreviewFit()
    return forgetPreviewFit
  }, [id])

  // The sections with entries, as text, so typing in one doesn't re-render the editor.
  const filled = useResumeState((state) => {
    const resume = resumeOf(state, id)
    return resume ? filledSections(resume).join(" ") : ""
  })
  // The sections the editor shows, in order: the saved order's, then any it
  // lacks that have entries or that the person added (resolveSections).
  const sections = useMemo(
    () => resolveSections({ sectionOrder: savedOrder, sectionsChosen, extraSections }, filled ? (filled.split(" ") as SectionName[]) : []),
    [savedOrder, sectionsChosen, extraSections, filled],
  )
  const selected = active === "Profile" || sections.includes(active) ? active : "Profile"

  const preview = useMemo(
    () => (pdfUrl ? { url: pdfUrl, printed: pdfPrinted, checkerResume: pdfResume } : null),
    [pdfUrl, pdfPrinted, pdfResume],
  )
  // The preview on screen is in another template than the one picked, until the new one is built.
  const shownTemplate = useMemo(() => (pdfPrinted ? JSON.parse(pdfPrinted).template : null), [pdfPrinted])
  const switchingTemplate = shownTemplate !== null && shownTemplate !== template

  // Re-render the preview in the browser shortly after what it shows changes.
  // It follows the resume in the store rather than through renders, so only a
  // new preview re-renders the editor, not each key typed.
  useEffect(() => {
    const build = (printed: string, from: Resume) => {
      // Aborted once this preview is no longer wanted: withdrawn if it's still
      // waiting to compile, and its result thrown away if it isn't.
      const wanted = new AbortController()
      const wait = Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, compileMs.current))
      const timer = setTimeout(async () => {
        const startedAt = performance.now()
        try {
          const url = await compilePreview(JSON.parse(printed), wanted.signal)
          compileMs.current = performance.now() - startedAt
          if (wanted.signal.aborted) {
            URL.revokeObjectURL(url)
            return
          }
          setPdfUrl(url)
          setPdfPrinted(printed)
          setPdfResume(from)
          setCompileError(null)
          // What failed before can build now, as after a hiccup.
          setUnbuilt(null)
        } catch (error) {
          if (!wanted.signal.aborted && !(error instanceof Superseded)) {
            setCompileError(error instanceof Error ? error.message : String(error))
            setUnbuilt(printed)
          }
        }
      }, wait)
      return () => {
        wanted.abort()
        clearTimeout(timer)
      }
    }

    let resume: Resume | undefined
    let printed: string | undefined
    let cancel: (() => void) | undefined
    const follow = () => {
      const next = resumeOf(getState(), id)
      if (next === resume) return
      resume = next
      if (!next) {
        // Gone, as when another tab deletes it. The preview on its way isn't
        // wanted, and the one built isn't of anything here any more: if it
        // comes back, as when its PDF is opened again, it's built afresh.
        cancel?.()
        cancel = undefined
        printed = undefined
        setPdfUrl(null)
        setPdfPrinted("")
        setPdfResume(undefined)
        setCompileError(null)
        setUnbuilt(null)
        return
      }
      // What the preview shows. Changes that don't print, such as renaming
      // the resume, leave it as it was, so they don't recompile.
      const shows = JSON.stringify(printedOf(next))
      if (shows === printed) return
      printed = shows
      cancel?.()
      cancel = build(shows, next)
    }
    follow()
    const unsubscribe = subscribe(follow)
    return () => {
      unsubscribe()
      cancel?.()
    }
  }, [id, getState, subscribe])

  // After a download, the button says so for a moment, counted from the latest one.
  useEffect(() => {
    if (!downloadedAt) return
    const timer = setTimeout(() => setDownloadedAt(0), DOWNLOADED_MS)
    return () => clearTimeout(timer)
  }, [downloadedAt])

  // Free each preview PDF a while after a newer one replaces it. The
  // preview may only just have started reading it, and pdf.js fails, and
  // throws, if it's freed before the preview lets go of it.
  useEffect(() => {
    if (!pdfUrl) return
    return () => {
      setTimeout(() => URL.revokeObjectURL(pdfUrl), PDF_KEPT_MS)
    }
  }, [pdfUrl])

  // The Edit / Preview switch steps aside while a touch screen's keyboard is
  // up. With a mouse and keyboard nothing covers the page, so it stays put and
  // can be clicked while a field has focus.
  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)")
    // A box to tick or a choice to pick doesn't bring the keyboard up. Bullets and the summary are typed in a
    // contenteditable box (StyledBox), which does.
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio") ||
      (target instanceof HTMLElement && target.isContentEditable)
    const onFocusIn = (event: FocusEvent) => setTyping(touch.matches && isField(event.target))
    const onFocusOut = (event: FocusEvent) => {
      if (isField(event.target) && !isField(event.relatedTarget)) setTyping(false)
    }
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  // A new section starts at its top: in the form's pane on wide screens, on the page on small ones
  // (scrolled just far enough that the section tabs stay pinned above it, where the header ends).
  const select = useCallback(
    (section: ActiveSection) => {
      setActive(section)
      foldTo(false)
      if (window.matchMedia(WIDE_SCREEN).matches) {
        if (mainRef.current) mainRef.current.scrollTop = 0
        return
      }
      const header = headerRef.current
      const top = header ? header.offsetTop + header.offsetHeight : 0
      if (window.scrollY > top) window.scrollTo({ top })
    },
    [foldTo],
  )

  const reorder = useCallback((order: SectionRef[]) => reorderSections(id, order), [reorderSections, id])
  const add = useCallback(
    (kind: ExtraKind | SectionName) => {
      const ref = addSection(id, kind)
      if (!ref) return
      select(ref)
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-section-ref="${ref}"]`)?.focus({ preventScroll: true }))
    },
    [addSection, id, select],
  )
  // Takes the section shown off the resume, and shows the one before it, or else after it, with the focus on its
  // title. The section fades away first, as its button in the section list folds up and the rest close the gap.
  const remove = useCallback(() => {
    if (selected === "Profile") return
    setDeletedEntry(null)
    const index = sections.indexOf(selected)
    const next: ActiveSection = sections[index - 1] ?? sections[index + 1] ?? "Profile"
    const leave = () => {
      const key = extraKey(selected)
      if (key !== null) deleteSection(id, key)
      else removeSection(id, selected as SectionName)
      select(next)
      requestAnimationFrame(() => mainRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true }))
    }
    const shown = mainRef.current?.querySelector<HTMLElement>("[data-section-shown]")
    if (!shown || reducedMotion()) return leave()
    // Out of reach as it goes, so Delete can't be pressed twice.
    shown.inert = true
    const timing = { duration: LEAVE_MS, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" } as const
    shown.animate({ opacity: [1, 0], translate: ["0 0", "0 -6px"] }, timing)
    // Down the rail on wide screens, along a row narrower; the rows are 4px apart (gap-1).
    const row = document.querySelector(`[data-section-ref="${selected}"]`)?.closest<HTMLElement>("[data-section-row]")
    if (row) {
      const box = row.getBoundingClientRect()
      const across = !window.matchMedia(WIDE_SCREEN).matches
      row.animate(
        across
          ? { width: [`${box.width}px`, "0px"], marginRight: ["0px", "-4px"], opacity: [1, 0], scale: [1, 0.6] }
          : { height: [`${box.height}px`, "0px"], marginBottom: ["0px", "-4px"], opacity: [1, 0], scale: [1, 0.6] },
        timing,
      )
    }
    setTimeout(leave, LEAVE_MS)
  }, [sections, selected, id, deleteSection, removeSection, select])
  const chooseTemplate = useCallback((template: TemplateId) => update("selectedTemplate", template), [update])
  const entryDeleted = useCallback(
    (deleted: DeletedEntry) => {
      setDeletedEntry({ ...deleted, key: ++deletions.current })
      announce(`“${deleted.title}” deleted`)
    },
    [announce],
  )
  const forgetRestored = useCallback(() => setRestored(null), [])
  // Puts the entry back where it was, in its section as it is now, and shows it there.
  const undoDelete = () => {
    const pending = deletedEntry
    if (!pending) return
    setDeletedEntry(null)
    const { dataKey } = SECTIONS[pending.section]
    const entries = read()?.[dataKey] ?? []
    // An entry added since can have taken its id.
    const taken = entries.some((entry) => entry.id === pending.entry.id)
    const id = taken ? Math.max(...entries.map((entry) => entry.id)) + 1 : pending.entry.id
    const next = [...entries]
    next.splice(Math.min(pending.index, next.length), 0, { ...pending.entry, id })
    update(dataKey, next)
    setRestored({ section: pending.section, id })
    if (selected !== pending.section) select(pending.section)
    announce(`“${pending.title}” is back`)
  }

  // Measured, as the panels' widths follow the window's.
  const toastShown = deletedEntry !== null
  useLayoutEffect(() => {
    if (!toastShown) return
    const wide = window.matchMedia(WIDE_SCREEN)
    const measure = () => {
      const form = formRef.current?.getBoundingClientRect()
      setToastSpan(wide.matches && form ? { left: form.left, right: document.documentElement.clientWidth - form.right } : undefined)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [toastShown])
  // The same elements while what they show is, so the left bar (memo) doesn't re-render with a new preview.
  const nav = useMemo(
    () => (
      <SectionNav
        sections={sections}
        headings={headings}
        extras={extraSections}
        active={selected}
        onSelect={select}
        onReorder={reorder}
        onAdd={add}
      />
    ),
    [sections, headings, extraSections, selected, select, reorder, add],
  )
  const style = useMemo(() => <StylePanel />, [])

  // Coming back to the form returns to where you were in it.
  const show = (next: "edit" | "preview") => {
    if (next === view) return
    if (next === "preview") editScroll.current = window.scrollY
    swapView(
      () => setView(next),
      () => window.scrollTo({ top: next === "edit" ? editScroll.current : 0 }),
    )
  }
  // Words picked on the preview open in the form, which scrolls to them rather than to where you were.
  const showForm = useCallback(() => {
    setView("edit")
    foldTo(false)
  }, [foldTo])

  const download = async () => {
    const resume = read()
    if (!resume) return
    // Each try takes back the last one's "Downloaded", so it never shows
    // beside a failure, and a second download in a row is said aloud again.
    setDownloadedAt(0)
    setDownloading(true)
    // The PDF is often made in a moment, too quick to see the button working.
    // So the line along it fills in the same time however quick that is, and
    // the file is saved as it ends, with the tick. With less motion there's no
    // line, so nothing waits for it.
    const filled = reducedMotion() ? null : new Promise((done) => setTimeout(done, DOWNLOAD_FILL_MS))
    try {
      const save = await makeDownload({ ...resume, sectionOrder: resolveSections(resume) })
      await filled
      save()
      // Only a failed PDF is put right; a failed Word or LaTeX file still is one.
      setFailure((previous) => (previous?.of ? previous : null))
      setDownloadedAt(Date.now())
    } catch (error) {
      console.error("Error downloading resume:", error)
      setFailure((previous) => nextFailure(previous, error))
    } finally {
      setDownloading(false)
    }
  }

  // The PDF's words in a plain layout, to change in Word, Google Docs or Pages.
  // Its code downloads the first time it's chosen.
  const downloadWord = async () => {
    const resume = read()
    if (!resume) return
    try {
      const { toWordFile, WORD_TYPE } = await import("@/lib/word")
      saveFile(toWordFile({ ...resume, sectionOrder: resolveSections(resume) }), fileNameOf(resume, "docx"), WORD_TYPE)
      // Only a failed Word file is put right; a failed PDF or LaTeX file still is one.
      setFailure((previous) => (previous?.of === "Word file" ? null : previous))
      announce("Word file downloaded")
    } catch (error) {
      console.error("Error downloading the Word file:", error)
      setFailure((previous) => nextFailure(previous, error, { of: "Word file" }))
    }
  }

  // The PDF's words in LaTeX, laid out as its template is, to keep editing on Overleaf.
  // Its code downloads the first time it's chosen.
  const downloadLatex = async () => {
    const resume = read()
    if (!resume) return
    try {
      const { toLatexFile, LATEX_TYPE } = await import("@/lib/latex")
      const { text, beyondPdfLatex } = toLatexFile({ ...resume, sectionOrder: resolveSections(resume) })
      const name = fileNameOf(resume, "tex")
      saveFile(text, name, LATEX_TYPE)
      // Only a failed LaTeX file is put right; a failed PDF or Word file still is one.
      setFailure((previous) => (previous?.of === "LaTeX file" ? null : previous))
      // Overleaf compiles with pdfLaTeX unless it's told otherwise, and the file can't tell it.
      if (beyondPdfLatex.length) {
        const detail = "It has letters pdfLaTeX can't print. On Overleaf, set Compiler to XeLaTeX in the project's settings."
        drive.dismiss()
        setLatexNotice({ title: "LaTeX file downloaded", file: name, detail })
        announce(`LaTeX file downloaded. ${detail}`)
      } else {
        announce("LaTeX file downloaded")
      }
    } catch (error) {
      console.error("Error downloading the LaTeX file:", error)
      setFailure((previous) => nextFailure(previous, error, { of: "LaTeX file" }))
    }
  }

  // Everything in the resume, what's left out of the PDF too, as a file to keep or open here again.
  const downloadJson = () => {
    const resume = read()
    if (!resume) return
    saveFile(toJson(resume), fileNameOf(resume, "json"), "application/json")
    announce("JSON downloaded")
  }

  if (!loaded) {
    return (
      <div className="desk desk-bright flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    )
  }

  // Resumes only exist in the browser that created them.
  if (!found) {
    return (
      <div className="desk desk-bright flex min-h-screen items-center justify-center px-4">
        {/* On a white sheet in its frame over the sky, as the editor is. */}
        <div className="paper-frame w-full max-w-[560px]">
          <div className="paper flex flex-col items-center gap-4 px-6 py-12 text-center sm:px-12">
            <span className="inline-flex h-[30px] items-center rounded-full bg-fill px-3.5 text-[13px] text-[#3a3e46]">
              Not in this browser
            </span>
            <h1 className="font-serif text-[40px] leading-tight tracking-[-0.02em]">Resume not found</h1>
            <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
              Resumes are saved in the browser you made them in. Open this link on that device, or start a new one.
            </p>
            <Link
              href="/create/dashboard"
              className="blue-button mt-2 inline-flex h-11 items-center rounded-full px-5 text-[15px] font-medium"
            >
              Go to the dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    // The editor is one white sheet in a frosted frame over the sky. On wide screens (WIDE_SCREEN)
    // it fills the window, with only a thin edge of sky round the frame so the page has the room: a
    // top bar over three columns, the sections (or what Check found, or Style) on the left, the form
    // in the middle, and the page on the right. Narrower, the same
    // parts stack on the sheet: the top bar, the left bar's tabs, the form, and an Edit / Preview
    // switch for the page. On wide screens it and the columns clip (overflow: clip) rather than
    // hide: a hidden box is still a scroll box, and choosing a finding scrolls its field into view
    // through every scroll box around it, which would shift the sheet up where no wheel can bring
    // it back.
    <div className="desk desk-bright flex min-h-screen flex-col p-2 pb-24 sm:p-6 sm:pb-24 xl:h-screen xl:overflow-clip xl:p-2.5">
      {/* All of it shares what the checker found: the left bar lists it and the forms point at it. */}
      <CheckProvider onSelect={select} onPick={showForm} preview={preview} unbuilt={unbuilt}>
        <div className="paper-frame flex flex-1 flex-col xl:min-h-0">
          <div className="paper flex flex-1 flex-col xl:min-h-0">
            {/* Raised (z-40) over the columns and the Edit / Preview switch: the menus and the
                gallery that open from it go over them. */}
            <header ref={headerRef} className="relative z-40 border-b border-hairline">
              <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 sm:px-3.5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-[15px]">
                  <Link
                    href="/create/dashboard"
                    // The page shrinks back into its place on the dashboard (closeResume).
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      if (closeResume(id, () => router.push("/create/dashboard"))) event.preventDefault()
                    }}
                    aria-label="Dashboard"
                    title="Dashboard"
                    className="glass glass-lit lit-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                  </Link>
                  <ResumeName />
                  <SavedNote />
                </div>
                {/* On the narrowest phones the template's name is cut short, so Download PDF still fits. */}
                <div className="flex min-w-0 items-center justify-end gap-2.5 sm:gap-[15px]">
                  <TemplatePicker value={selectedTemplate} onChange={chooseTemplate} />
                  {/* Download PDF is the main way out; the ▾ beside it has the others. One blue pill,
                      split. The button's least width fits "Download PDF", so it doesn't shrink when it
                      says Downloaded. */}
                  <div className="relative flex shrink-0 rounded-full text-white">
                    {/* The pill's blue is under the two halves, not on what holds them: a filter
                        there would brighten the menu that opens from the ▾, and keep it from blurring
                        what's behind it. */}
                    <span aria-hidden="true" className="blue-fill pointer-events-none absolute inset-0 rounded-full" />
                    <button
                      type="button"
                      onClick={download}
                      disabled={downloading}
                      className="download-button relative inline-flex h-9 items-center justify-center gap-2 overflow-hidden rounded-l-full pl-4 pr-3.5 text-sm font-medium transition-colors hover:bg-white/[0.08] focus-visible:bg-white/[0.14] disabled:cursor-wait sm:min-w-[148px] [&_svg]:size-4"
                    >
                      <DownloadIcon state={downloading ? "busy" : downloaded ? "done" : "idle"} />
                      {/* Fills along the bottom while the PDF is made, then the rest of the way, and fades, once it's downloaded. */}
                      <span
                        aria-hidden="true"
                        // The fill's time, and the wait after it, from DOWNLOAD_FILL_MS, as the save is.
                        style={{ animationDuration: `${DOWNLOAD_FILL_MS}ms, 20s`, animationDelay: `0s, ${DOWNLOAD_FILL_MS}ms` }}
                        className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white/80 ${
                          downloading
                            ? "scale-x-0 motion-safe:animate-download-progress"
                            : downloaded
                              ? "scale-x-100 opacity-0 [transition:scale_180ms_ease-out,opacity_450ms_ease-out_200ms] motion-reduce:transition-none"
                              : "scale-x-0"
                        }`}
                      />
                      {/* Just "PDF" on phones, so it fits beside the template picker. */}
                      {downloaded ? (
                        <span>
                          <span className="max-sm:sr-only">Downloaded</span>
                          <span className="sm:hidden">PDF</span>
                        </span>
                      ) : (
                        <span>
                          <span className="max-sm:sr-only">Download </span>PDF
                        </span>
                      )}
                    </button>
                    <DownloadMenu
                      choices={[
                        { title: "Word", hint: "To edit in Word, Google Docs or Pages", icon: <WordIcon />, onChoose: downloadWord },
                        {
                          title: "LaTeX",
                          hint: "To edit on Overleaf, laid out like your PDF",
                          icon: <LatexIcon />,
                          onChoose: downloadLatex,
                        },
                        {
                          title: "Save to Google Drive",
                          hint: "Puts the PDF in your Drive. Google asks you first.",
                          icon: <DriveIcon />,
                          onChoose: drive.save,
                        },
                        {
                          title: "JSON",
                          hint: "A backup with everything, even what the PDF leaves out",
                          icon: <JsonIcon />,
                          onChoose: downloadJson,
                        },
                        // It opens the device's share sheet, so it's apart from the formats.
                        ...(sharePdf.shareable
                          ? [{ title: "Share PDF…", hint: "", icon: <ShareIcon />, apart: true, onChoose: sharePdf.share }]
                          : []),
                      ]}
                      busy={sharePdf.making}
                      onOpen={() => {
                        // The last LaTeX file's note goes as the menu opens: it's about that
                        // file, and whatever is chosen next is another.
                        setLatexNotice(null)
                        if (sharePdf.shareable) preparePdf()
                      }}
                      notice={
                        drive.saving
                          ? { title: "Saving to Google Drive…", working: true }
                          : drive.saved
                            ? {
                                title: "Saved to Google Drive",
                                file: drive.saved.name,
                                icon: <DriveIcon />,
                                link: { href: drive.saved.link, label: "Open it", name: "Open it in Google Drive" },
                              }
                            : latexNotice
                      }
                      onNoticeClose={() => {
                        drive.dismiss()
                        setLatexNotice(null)
                      }}
                    />
                  </div>
                  <span role="status" className="sr-only">
                    {downloaded ? "PDF downloaded. This PDF carries your resume. Open it here on any computer to keep editing." : ""}
                  </span>
                  <span role="status" className="sr-only">
                    {savedAs}
                  </span>
                </div>
              </div>
              <NotSaved className={BANNER} onDownload={download} downloading={downloading} />
              <Replaced id={id} className={BANNER} />
              {failure && (
                <DownloadFailed
                  key={failure.count}
                  failure={failure}
                  retrying={downloading}
                  onRetry={failure.of === "LaTeX file" ? downloadLatex : failure.of ? downloadWord : download}
                  className={BANNER}
                />
              )}
              {sharePdf.failure && (
                <DownloadFailed
                  key={sharePdf.failure.count}
                  doing="share"
                  failure={sharePdf.failure}
                  retrying={sharePdf.sharing}
                  onRetry={sharePdf.share}
                  className={BANNER}
                />
              )}
              {drive.failure && (
                <DownloadFailed
                  key={drive.failure.count}
                  doing="save"
                  failure={drive.failure}
                  retrying={drive.saving}
                  onRetry={drive.save}
                  className={BANNER}
                />
              )}
            </header>

            <div className="flex flex-1 flex-col xl:min-h-0 xl:flex-row">
              <LeftBar hidden={view === "preview"} tabs={!wide} folded={folded} shut={shut} onFold={fold} style={style}>
                {nav}
              </LeftBar>

              {/* The form. On wide screens it's the middle column, as wide as is comfortable to
                  write in, and scrolls inside it (useKeepFormPlace keeps the place across the two).
                  In Style mode on narrower screens, Style takes its place. */}
              <div
                ref={formRef}
                id="editor-form"
                data-column
                className={`editor-form xl:flex xl:w-[clamp(440px,36vw,520px)] xl:shrink-0 xl:flex-col xl:overflow-clip ${
                  view === "preview" ? "hidden" : ""
                } ${shut ? "xl:hidden" : ""}`}
              >
                <main ref={mainRef} className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-8 xl:overflow-y-auto xl:pb-14">
                  {/* The fields fit the form's own width rather than the window's. Each grid of
                      them is in a container (ProfileForm, SectionForm), not the whole form, so
                      an entry being dragged isn't in one: SectionForm says why. */}
                  <div className="mx-auto max-w-[640px]">
                    {/* Each section fades in as it's chosen: a new key mounts it anew, and
                        `starting:` (CSS @starting-style) is where its transition starts from. */}
                    <div
                      key={selected}
                      data-section-shown
                      className="transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none starting:translate-y-1 starting:opacity-0"
                    >
                      {selected === "Profile" ? (
                        <ProfileForm />
                      ) : extraKey(selected) !== null ? (
                        <ExtraSectionForm sectionId={extraKey(selected)!} onDelete={remove} />
                      ) : (
                        <SectionForm
                          section={SECTIONS[selected as SectionName]}
                          onDelete={remove}
                          onEntryDeleted={entryDeleted}
                          restored={restored}
                          onRestored={forgetRestored}
                        />
                      )}
                    </div>
                  </div>
                </main>
              </div>

              {/* The page, on a grey panel: on wide screens in the room the columns leave, running to the
                  sheet's edges, its corner rounded with the sheet's. */}
              <section
                aria-label="Live preview"
                className={`min-w-0 flex-col p-2.5 xl:flex xl:flex-1 xl:overflow-clip xl:p-0 ${
                  view === "preview" ? "flex max-xl:flex-1" : "hidden"
                }`}
              >
                <div className="flex min-h-0 flex-1 flex-col rounded-[22px] bg-[#eef0f4] xl:rounded-none xl:rounded-br-[28px]">
                  <PdfPreview
                    pdfUrl={pdfUrl}
                    template={shownTemplate}
                    error={compileError}
                    updating={switchingTemplate && !compileError}
                    maxPageWidth={folded ? FOLDED_PAGE_WIDTH : undefined}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </CheckProvider>

      {deletedEntry && (
        <DeletedToast
          key={deletedEntry.key}
          title={deletedEntry.title}
          onUndo={undoDelete}
          onDone={() => setDeletedEntry(null)}
          className="in-editor"
          style={toastSpan}
        />
      )}

      <div
        data-covers="bottom"
        // Out of the way while typing, below the foot of the screen.
        className={`fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center transition-transform duration-200 xl:hidden ${
          typing ? "pointer-events-none translate-y-24" : ""
        }`}
      >
        <div
          role="group"
          aria-label="View"
          className="flex gap-1 rounded-full bg-sheet p-[5px] shadow-[0_0_0_1px_rgb(17_19_24/0.06),0_10px_28px_-8px_rgb(17_19_24/0.3)]"
        >
          {(["edit", "preview"] as const).map((option) => {
            const Icon = option === "edit" ? PencilLine : Eye
            return (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => show(option)}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors ${
                  view === option ? "bg-ink text-white" : "text-ink-3 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {option === "edit" ? "Edit" : "Preview"}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * The resume's name, in the top bar and the tab's title. A component of its
 * own, so typing a name doesn't re-render the editor.
 */
function ResumeName() {
  const { renameResume } = useResumeActions()
  const { id, update } = useOpenResume()
  const title = useResumeField("resumeTitle")

  // Resumes live in this browser, so the tab title is set here rather than in metadata.
  const tabTitle = title?.trim() || "Untitled resume"
  useEffect(() => {
    document.title = `${tabTitle} · resumezip`
  }, [tabTitle])

  // Once a rename is done, number the name if another resume already has it.
  const commit = () => renameResume(id, title ?? "")

  // As wide as its words: an unseen copy of them sizes the box, which the input fills.
  return (
    <span className="grid min-w-0 text-[16px] font-medium tracking-[-0.02em] sm:text-[17px]">
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre border-b border-transparent py-0.5 pr-1"
      >
        {title || "Untitled resume"}
      </span>
      <input
        aria-label="Resume name"
        value={title ?? ""}
        placeholder="Untitled resume"
        // The least a box can be, so its unseen copy, not its own width, is what sizes it.
        size={1}
        onChange={(event) => update("resumeTitle", event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="col-start-1 row-start-1 w-full min-w-0 border-0 border-b border-transparent bg-transparent py-0.5 text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-rule-strong focus:border-accent focus-visible:outline-none"
      />
    </span>
  )
}

/**
 * "Saving…" from a change until it's saved and typing has paused a moment,
 * then "Saved". Nothing while saving fails: NotSaved says so instead.
 */
function SavedNote() {
  const saveStatus = useResumeState((state) => state.saveStatus)
  const unsaved = useResumeState((state) => state.unsaved)
  const savedAt = useResumeState((state) => state.savedAt)
  // When it was last saved as the page opened: "Saving…" waits a moment after each save since.
  const openedSavedAt = useRef(savedAt)
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    if (savedAt === openedSavedAt.current) return
    setSettling(true)
    const timer = setTimeout(() => setSettling(false), SAVED_AFTER_MS)
    return () => clearTimeout(timer)
  }, [savedAt])

  if (saveStatus !== "saved") return null
  return (
    <span className="hidden shrink-0 whitespace-nowrap text-[14px] text-ink-3 xl:inline">{unsaved || settling ? "Saving…" : "Saved"}</span>
  )
}
