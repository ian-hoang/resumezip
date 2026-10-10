"use client"

import Link from "next/link"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { ArrowLeft, Eye, PencilLine } from "lucide-react"
import { OpenResumeProvider, useOpenResume, useResumeActions, useResumeField, useResumeState } from "@/context/ResumeContext"
import { DownloadIcon } from "@/components/dashboard/RowActions"
import { CheckProvider } from "@/components/editor/CheckContext"
import DownloadedCard from "@/components/editor/DownloadedCard"
import DownloadMenu from "@/components/editor/DownloadMenu"
import LeftBar from "@/components/editor/LeftBar"
import PdfPreview from "@/components/editor/PdfPreview"
import ProfileForm from "@/components/editor/ProfileForm"
import Replaced from "@/components/editor/Replaced"
import SectionForm from "@/components/editor/SectionForm"
import ExtraSectionForm from "@/components/editor/ExtraSectionForm"
import { reducedMotion, WIDE_SCREEN } from "@/components/editor/layout"
import SectionNav, { type ActiveSection } from "@/components/editor/SectionNav"
import StylePanel from "@/components/editor/StylePanel"
import TemplatePicker from "@/components/editor/TemplatePicker"
import { useKeepFormPlace } from "@/components/editor/useKeepFormPlace"
import DownloadFailed, { nextFailure, type Failure } from "@/components/site/DownloadFailed"
import NotSaved from "@/components/site/NotSaved"
import { SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Resume } from "@/lib/resume"
import { toJson } from "@/lib/resumeFile"
import { extraKey, filledSections, resolveSections, type ExtraKind, type SectionRef } from "@/lib/resumeSections"
import { resumeOf } from "@/lib/resumeStore"
import { uniqueTitle } from "@/lib/resumeTitles"
import { fileNameOf, saveFile } from "@/lib/saveFile"
import { compilePreview, loadCompiler, makeDownload, printedOf, Superseded } from "@/lib/typst/compile"
import { printedTune, TEMPLATE_SETTINGS } from "@/lib/tune"
import { templateIdOf } from "@/lib/typst/resumeData"
import type { TemplateId } from "@/lib/templates"

const pad = (n: number) => String(n).padStart(2, "0")

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

// The notes under the header: a strip across it, or a card in the stage's left panel on wide screens.
const BANNER = "border-t border-rule px-5 py-2.5 lg:px-6"
const PANEL_BANNER = "xl:mx-4 xl:mb-3 xl:rounded-[12px] xl:border xl:border-ink/[0.08] xl:bg-sheet/85 xl:px-4"

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
  const loaded = useResumeState((state) => state.loaded)
  // Whether this browser has the resume, once storage has loaded.
  const found = useResumeState((state) => state.loaded && resumeOf(state, id) !== undefined)
  const selectedTemplate = useResumeField("selectedTemplate")
  const tune = useResumeField("tune")
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
  // The PDF just downloaded, while the card about it shows.
  const [savedPdf, setSavedPdf] = useState<{ file: string; at: number } | null>(null)
  // Said to screen readers once another format is downloaded.
  const [savedAs, setSavedAs] = useState("")
  // How many pages the preview on screen has, for Download PDF to say.
  const [pages, setPages] = useState<number | null>(null)
  // Small screens show the form or the preview, not both.
  const [view, setView] = useState<"edit" | "preview">("edit")
  const [typing, setTyping] = useState(false)
  const editScroll = useRef(0)
  // How long the last preview took.
  const compileMs = useRef(MIN_WAIT_MS)
  const headerRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const downloadRef = useRef<HTMLButtonElement>(null)
  const pdfDetailsId = useId()

  // Resizing across the wide-screen width keeps the form where it was scrolled to.
  useKeepFormPlace(mainRef, found)

  // The PDF compiler starts loading as soon as the resume is found, with its
  // template's fonts, before the first preview asks for it. A resume that
  // isn't here doesn't need it.
  const template = templateIdOf(selectedTemplate)
  useEffect(() => {
    if (found) loadCompiler(template)
  }, [found, template])

  // The paper it prints on, for Download PDF to say, as Fine-tune has it (printedTune reads the saved setting defensively).
  const paper = (printedTune(tune).paper || TEMPLATE_SETTINGS[template].paper) === "a4" ? "A4" : "Letter"

  // The saved order, plus any sections missing from older resumes.
  // The optional sections with entries, which show even when the saved order lacks them. As
  // text, so typing in one doesn't re-render the editor.
  const filled = useResumeState((state) => {
    const resume = resumeOf(state, id)
    return resume ? filledSections(resume).join(" ") : ""
  })
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
    // A box to tick or a choice to pick doesn't bring the keyboard up.
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio")
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
  // (scrolled just far enough that the section tabs stay pinned above it).
  const select = useCallback((section: ActiveSection) => {
    setActive(section)
    if (window.matchMedia(WIDE_SCREEN).matches) {
      if (mainRef.current) mainRef.current.scrollTop = 0
      return
    }
    const top = headerRef.current?.offsetHeight ?? 0
    if (window.scrollY > top) window.scrollTo({ top })
  }, [])

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
  // Takes the section shown off the resume, and shows the one before it, or else after it.
  const remove = useCallback(() => {
    if (selected === "Profile") return
    const index = sections.indexOf(selected)
    const next: ActiveSection = sections[index - 1] ?? sections[index + 1] ?? "Profile"
    const key = extraKey(selected)
    if (key !== null) deleteSection(id, key)
    else removeSection(id, selected as SectionName)
    select(next)
    requestAnimationFrame(() =>
      (document.querySelector<HTMLElement>(`[data-section-ref="${next}"]`) ?? mainRef.current?.querySelector<HTMLElement>("h1"))?.focus(),
    )
  }, [sections, selected, id, deleteSection, removeSection, select])
  const chooseTemplate = useCallback((template: TemplateId) => update("selectedTemplate", template), [update])
  // The same element while what it shows is, so the left bar (memo) doesn't re-render with a new preview.
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

  // Coming back to the form returns to where you were in it.
  const show = (next: "edit" | "preview") => {
    if (next === view) return
    if (next === "preview") editScroll.current = window.scrollY
    setView(next)
    requestAnimationFrame(() => window.scrollTo({ top: next === "edit" ? editScroll.current : 0 }))
  }

  const download = async () => {
    const resume = read()
    if (!resume) return
    // Each try takes back the last one's "Downloaded", so it never shows
    // beside a failure, and a second download in a row is said aloud again.
    setDownloadedAt(0)
    setSavedPdf(null)
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
      setFailure(null)
      const at = Date.now()
      setDownloadedAt(at)
      setSavedPdf({ file: fileNameOf(resume, "pdf"), at })
    } catch (error) {
      console.error("Error downloading resume:", error)
      setFailure((previous) => nextFailure(previous, error))
    } finally {
      setDownloading(false)
    }
  }

  // The download card's Got it, or its time running out. If it had the
  // keyboard, the keyboard goes back to Download PDF rather than the page.
  const closeSavedPdf = useCallback((refocus: boolean) => {
    setSavedPdf(null)
    if (refocus) downloadRef.current?.focus()
  }, [])

  // Everything in the resume, what's left out of the PDF too, as a file to keep or open here again.
  const downloadJson = () => {
    const resume = read()
    if (!resume) return
    saveFile(toJson(resume), fileNameOf(resume, "json"), "application/json")
    // Said again, even when it's the same as last time.
    setSavedAs("")
    requestAnimationFrame(() => setSavedAs("JSON downloaded"))
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <span className="label-mono text-ink-2">Loading…</span>
      </div>
    )
  }

  // Resumes only exist in the browser that created them.
  if (!found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-5 text-center">
        <span className="label-mono text-ink-2">Not in this browser</span>
        <h1 className="font-serif text-[40px] leading-tight tracking-[-0.02em]">Resume not found</h1>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
          Resumes are saved in the browser you made them in. Open this link on that device, or start a new one.
        </p>
        <Link href="/create/dashboard" className="text-sm underline underline-offset-4">
          Go to your resumes
        </Link>
      </div>
    )
  }

  const total = sections.length + 1
  const position = (index: number) => `${pad(index)} / ${pad(total)}`

  const pagesSaid = pages === null ? "" : pages === 1 ? "1 page" : `${pages} pages`

  return (
    // On wide screens (WIDE_SCREEN) the editor is a stage: the live page is the canvas in the
    // middle, on a soft blue field, with the writing panel and the Style panel floating as glass
    // either side of it (.editor-stage in styles/editor.css). Narrower, it's a header, the
    // section tabs and the form, and an Edit / Preview switch for the preview.
    <div className="editor-stage flex min-h-screen flex-col max-xl:bg-paper xl:h-screen xl:overflow-hidden">
      {/* The left bar and the forms share what the checker found, and the download card opens Check. */}
      <CheckProvider onSelect={select} preview={preview} unbuilt={unbuilt}>
        {/* The writing side: the header, the section tabs and the form. On wide screens it's the
            stage's left panel, with the name at its top and the form scrolling inside it. */}
        <div
          className={`stage-panel relative flex flex-col ${view === "edit" ? "flex-1" : ""} xl:fixed xl:inset-y-6 xl:left-6 xl:z-20 xl:w-[var(--stage-left)]`}
        >
          <span aria-hidden="true" className="glass glass-frost absolute inset-0 -z-10 hidden rounded-[24px] xl:block" />
          <header ref={headerRef} className="border-b border-rule bg-sheet xl:shrink-0 xl:border-0 xl:bg-transparent">
            <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-2.5 lg:px-6 xl:min-h-0 xl:flex-col xl:flex-nowrap xl:items-stretch xl:gap-1 xl:pb-3 xl:pt-5">
              <div className="flex min-w-0 items-center gap-4 xl:gap-1.5">
                <Link
                  href="/create/dashboard"
                  title="Your resumes"
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink xl:-ml-2 xl:h-8 xl:w-8 xl:justify-center xl:rounded-full xl:hover:bg-ink/[0.06]"
                >
                  <ArrowLeft className="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden="true" />
                  <span className="xl:sr-only">Your resumes</span>
                </Link>
                <span className="h-5 w-px shrink-0 bg-rule xl:hidden" aria-hidden="true" />
                <ResumeName />
              </div>
              {/* Under the name on wide screens, so it stays put while the name is typed. */}
              <SavedNote />
              <div className="flex flex-wrap items-center gap-3 xl:contents">
                {/* On wide screens the Style panel lists the templates instead. */}
                <div className="xl:hidden">
                  <TemplatePicker value={selectedTemplate} onChange={chooseTemplate} />
                </div>
                {/* Download PDF is the main way out; the ▾ beside it has the others. On wide
                    screens it's the dark pill in the stage's corner, and reads back the paper
                    and how many pages the PDF has. */}
                <div className="flex xl:fixed xl:bottom-6 xl:right-6 xl:z-30 xl:rounded-full xl:shadow-[0_18px_40px_-14px_rgba(17,19,24,0.55)]">
                  <button
                    ref={downloadRef}
                    type="button"
                    onClick={download}
                    disabled={downloading}
                    // Named for what it does: the paper and pages it shows on wide screens are its description.
                    aria-label={downloaded ? "Downloaded" : "Download PDF"}
                    aria-describedby={pdfDetailsId}
                    className="download-button relative inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-l-[4px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-wait sm:min-w-[9.5rem] [&_svg]:size-4 xl:h-[52px] xl:rounded-l-full xl:pl-6 xl:pr-5 xl:text-[15px]"
                  >
                    <DownloadIcon state={downloading ? "busy" : downloaded ? "done" : "idle"} />
                    {/* Fills along the bottom while the PDF is made, then the rest of the way, and fades, once it's downloaded. */}
                    <span
                      aria-hidden="true"
                      // The fill's time, and the wait after it, from DOWNLOAD_FILL_MS, as the save is.
                      style={{ animationDuration: `${DOWNLOAD_FILL_MS}ms, 20s`, animationDelay: `0s, ${DOWNLOAD_FILL_MS}ms` }}
                      className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent ${
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
                    <span className="label-mono hidden whitespace-nowrap text-white/65 xl:inline">
                      · {paper}
                      {pagesSaid && ` · ${pagesSaid}`}
                    </span>
                  </button>
                  <DownloadMenu
                    choices={[{ title: "JSON", hint: "A backup with everything, even what the PDF leaves out", onChoose: downloadJson }]}
                  />
                </div>
                <span id={pdfDetailsId} className="sr-only">
                  {paper === "A4" ? "A4" : "US Letter"}
                  {pagesSaid && `, ${pagesSaid}`}
                </span>
                <span role="status" className="sr-only">
                  {downloaded ? "PDF downloaded. This PDF carries your resume. Open it here on any computer to keep editing." : ""}
                </span>
                <span role="status" className="sr-only">
                  {savedAs}
                </span>
              </div>
            </div>
            <NotSaved className={`${BANNER} ${PANEL_BANNER}`} onDownload={download} downloading={downloading} />
            <Replaced id={id} className={`${BANNER} ${PANEL_BANNER}`} />
            {failure && (
              <DownloadFailed
                key={failure.count}
                failure={failure}
                retrying={downloading}
                onRetry={download}
                // By the Download PDF pill on wide screens, where it was pressed.
                className={`${BANNER} xl:fixed xl:bottom-[92px] xl:right-6 xl:z-30 xl:w-[380px] xl:rounded-[14px] xl:border-0 xl:bg-sheet xl:p-4 xl:shadow-[0_24px_48px_-20px_rgba(17,19,24,0.45)]`}
              />
            )}
          </header>

          <LeftBar hidden={view === "preview"}>{nav}</LeftBar>

          <main
            ref={mainRef}
            className={`min-w-0 flex-1 px-5 pb-28 pt-9 sm:px-10 xl:block xl:overflow-y-auto xl:border-t xl:border-ink/[0.08] xl:px-6 xl:pb-12 xl:pt-6 ${view === "preview" ? "hidden" : ""}`}
          >
            {/* The fields fit the form's own width rather than the window's. Each grid of
                them is in a container (ProfileForm, SectionForm), not the whole form, so
                an entry being dragged isn't in one: SectionForm says why. */}
            <div className="mx-auto max-w-[640px]">
              {/* Each section fades in as it's chosen: a new key mounts it anew, and
                  `starting:` (CSS @starting-style) is where its transition starts from. */}
              <div
                key={selected}
                className="transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none starting:translate-y-1 starting:opacity-0"
              >
                {selected === "Profile" ? (
                  <ProfileForm position={position(1)} />
                ) : extraKey(selected) !== null ? (
                  <ExtraSectionForm sectionId={extraKey(selected)!} position={position(sections.indexOf(selected) + 2)} onDelete={remove} />
                ) : (
                  <SectionForm
                    section={SECTIONS[selected as SectionName]}
                    position={position(sections.indexOf(selected) + 2)}
                    onDelete={remove}
                  />
                )}
              </div>
            </div>
          </main>
        </div>

        {/* On wide screens, the canvas between the panels. */}
        <section
          aria-label="Live preview"
          className={`min-w-0 flex-col bg-desk pb-20 xl:fixed xl:inset-y-0 xl:left-[var(--stage-canvas-left)] xl:right-[var(--stage-canvas-right)] xl:flex xl:overflow-hidden xl:bg-transparent xl:pb-0 ${
            view === "preview" ? "flex max-xl:flex-1" : "hidden"
          }`}
        >
          <PdfPreview
            pdfUrl={pdfUrl}
            template={shownTemplate}
            error={compileError}
            updating={switchingTemplate && !compileError}
            onPages={setPages}
          />
        </section>

        <StylePanel value={selectedTemplate} onChange={chooseTemplate} />

        {savedPdf && <DownloadedCard key={savedPdf.at} file={savedPdf.file} onClose={closeSavedPdf} onCheck={() => show("edit")} />}
      </CheckProvider>

      <div
        data-covers="bottom"
        className={`fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center transition-[opacity,transform] duration-200 xl:hidden ${
          typing ? "pointer-events-none translate-y-3 opacity-0" : ""
        }`}
      >
        <div role="group" aria-label="View" className="flex gap-1 rounded-[4px] bg-ink p-1 shadow-[0_12px_32px_-12px_rgba(17,19,24,0.5)]">
          {(["edit", "preview"] as const).map((option) => {
            const Icon = option === "edit" ? PencilLine : Eye
            return (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => show(option)}
                className={`inline-flex h-9 items-center gap-2 rounded-[3px] px-4 text-sm font-medium transition-colors ${
                  view === option ? "bg-paper text-ink" : "text-white/70 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
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
 * The resume's name, in the header and the tab's title. A component of its
 * own, so typing a name doesn't re-render the editor.
 */
function ResumeName() {
  const { getState } = useResumeActions()
  const { id, update } = useOpenResume()
  const title = useResumeField("resumeTitle")

  // Resumes live in this browser, so the tab title is set here rather than in metadata.
  const tabTitle = title?.trim() || "Untitled resume"
  useEffect(() => {
    document.title = `${tabTitle} · resumezip`
  }, [tabTitle])

  // Once a rename is done, number the name if another resume already has it.
  const commit = () => {
    const others = Object.entries(getState().resumes).filter(([key]) => key !== id)
    const unique = uniqueTitle(
      title ?? "",
      others.map(([, resume]) => resume?.resumeTitle),
    )
    if (unique !== title) update("resumeTitle", unique)
  }

  return (
    <input
      aria-label="Resume name"
      value={title ?? ""}
      placeholder="Untitled resume"
      size={Math.max(14, (title ?? "").length + 1)}
      onChange={(event) => update("resumeTitle", event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
      }}
      className="min-w-0 max-w-[58vw] border-0 border-b border-transparent bg-transparent py-0.5 font-serif lg:max-w-[40vw] text-[19px] text-ink outline-none transition-colors placeholder:text-ink-2 hover:border-rule-strong focus:border-accent focus-visible:outline-none xl:w-full xl:max-w-none xl:text-[23px] xl:tracking-[-0.01em]"
    />
  )
}

/**
 * "Saving…" from a change until it's saved and typing has paused a moment,
 * then "Saved in this browser", with a tick that draws itself after a save.
 * Nothing while saving fails: NotSaved says so instead.
 */
function SavedNote() {
  const saveStatus = useResumeState((state) => state.saveStatus)
  const unsaved = useResumeState((state) => state.unsaved)
  const savedAt = useResumeState((state) => state.savedAt)
  // Saved since the page opened, so the tick has something to draw itself for.
  const openedSavedAt = useRef(savedAt)
  const saved = savedAt !== openedSavedAt.current
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    if (savedAt === openedSavedAt.current) return
    setSettling(true)
    const timer = setTimeout(() => setSettling(false), SAVED_AFTER_MS)
    return () => clearTimeout(timer)
  }, [savedAt])

  if (saveStatus !== "saved") return null
  return (
    <span className="saved-note label-mono hidden shrink-0 items-center gap-1.5 text-ink-2 xl:ml-[30px] xl:flex">
      {unsaved || settling ? (
        "Saving…"
      ) : (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path className={saved ? "tick" : undefined} pathLength={1} d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          Saved in this browser
        </>
      )}
    </span>
  )
}
