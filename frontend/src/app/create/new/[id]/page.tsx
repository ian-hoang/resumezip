"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Download, Loader2 } from "lucide-react"
import { useResumeContext } from "@/context/ResumeContext"
import PdfPreview from "@/components/editor/PdfPreview"
import ProfileForm from "@/components/editor/ProfileForm"
import SectionForm from "@/components/editor/SectionForm"
import SectionNav, { WIDE_SCREEN, type ActiveSection } from "@/components/editor/SectionNav"
import TemplatePicker from "@/components/editor/TemplatePicker"
import { SECTION_NAMES, SECTIONS, type SectionName } from "@/components/editor/sections"
import { uniqueTitle } from "@/lib/resumeTitles"
import { compileResumeUrl, downloadResume } from "@/lib/typst/compile"

const pad = (n: number) => String(n).padStart(2, "0")

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const { setCurrentResumeId, formData, updateFormData, loaded, resumes } = useResumeContext()
  const [active, setActive] = useState<ActiveSection>("Profile")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (id) setCurrentResumeId(id)
  }, [id, setCurrentResumeId])

  // The saved order, plus any sections missing from older resumes.
  const sections = useMemo<SectionName[]>(() => {
    const saved: SectionName[] = (Array.isArray(formData.sectionOrder) ? formData.sectionOrder : []).filter(
      (name: string): name is SectionName => SECTION_NAMES.includes(name as SectionName),
    )
    return [...saved, ...SECTION_NAMES.filter((name) => !saved.includes(name))]
  }, [formData.sectionOrder])

  // Resumes live in this browser, so the tab title is set here rather than in metadata.
  const tabTitle = formData.resumeTitle?.trim() || "Untitled resume"
  useEffect(() => {
    if (formData.id) document.title = `${tabTitle} · resumezip`
  }, [formData.id, tabTitle])

  // Re-render the preview in the browser shortly after the resume changes.
  useEffect(() => {
    if (!formData.id) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const url = await compileResumeUrl({ ...formData, sectionOrder: sections })
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        setPdfUrl(url)
        setCompileError(null)
      } catch (error) {
        if (!cancelled) setCompileError(error instanceof Error ? error.message : String(error))
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [formData, sections])

  // Free each preview PDF once a newer one replaces it.
  useEffect(() => {
    if (!pdfUrl) return
    return () => URL.revokeObjectURL(pdfUrl)
  }, [pdfUrl])

  // A new section starts at its top: in the form's pane on wide screens, on the page on small ones
  // (scrolled just far enough that the section tabs stay pinned above it).
  const select = (section: ActiveSection) => {
    setActive(section)
    if (window.matchMedia(WIDE_SCREEN).matches) {
      if (mainRef.current) mainRef.current.scrollTop = 0
      return
    }
    const top = headerRef.current?.offsetHeight ?? 0
    if (window.scrollY > top) window.scrollTo({ top })
  }

  // Once a rename is done, number the name if another resume already has it.
  const commitTitle = () => {
    const others = Object.entries(resumes as Record<string, any>).filter(([key]) => key !== id)
    const title = uniqueTitle(formData.resumeTitle ?? "", others.map(([, resume]) => resume?.resumeTitle))
    if (title !== formData.resumeTitle) updateFormData("resumeTitle", title)
  }

  const download = async () => {
    setDownloading(true)
    try {
      await downloadResume({ ...formData, sectionOrder: sections })
    } catch (error) {
      console.error("Error downloading resume:", error)
    } finally {
      setDownloading(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <span className="label-mono text-ink-2">Loading…</span>
      </div>
    )
  }

  // Resumes only exist in the browser that created them.
  if (!resumes[id]) {
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

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:h-screen lg:overflow-hidden">
      <header ref={headerRef} className="border-b border-rule bg-sheet">
        <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-2.5 lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/create/dashboard"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Your resumes
            </Link>
            <span className="h-5 w-px shrink-0 bg-rule" aria-hidden="true" />
            <input
              aria-label="Resume name"
              value={formData.resumeTitle ?? ""}
              placeholder="Untitled resume"
              size={Math.max(14, (formData.resumeTitle ?? "").length + 1)}
              onChange={(event) => updateFormData("resumeTitle", event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur()
              }}
              className="min-w-0 max-w-[58vw] border-0 border-b border-transparent bg-transparent py-0.5 font-serif lg:max-w-[40vw] text-[19px] text-ink outline-none transition-colors placeholder:text-ink-2 hover:border-rule-strong focus:border-accent focus-visible:outline-none"
            />
            <span className="label-mono hidden shrink-0 text-ink-2 xl:inline">Saved in this browser</span>
          </div>
          <div className="flex items-center gap-3">
            <TemplatePicker value={formData.selectedTemplate} onChange={(template) => updateFormData("selectedTemplate", template)} />
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-wait disabled:opacity-80"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          data-covers="top"
          className="sticky top-0 z-20 shrink-0 border-b border-rule bg-paper lg:static lg:w-[248px] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-4 lg:py-7"
        >
          <SectionNav
            sections={sections}
            active={active}
            onSelect={select}
            onReorder={(order) => updateFormData("sectionOrder", order)}
          />
        </aside>

        <main
          ref={mainRef}
          className="min-w-0 flex-1 px-5 pb-16 pt-9 sm:px-10 lg:overflow-y-auto lg:px-12"
        >
          <div className="mx-auto max-w-[640px]">
            {active === "Profile" ? (
              <ProfileForm position={position(1)} />
            ) : (
              <SectionForm key={active} section={SECTIONS[active]} position={position(sections.indexOf(active) + 2)} />
            )}
          </div>
        </main>

        <section aria-label="Live preview" className="min-w-0 bg-desk lg:flex lg:w-[46%] lg:flex-col lg:overflow-hidden">
          <PdfPreview pdfUrl={pdfUrl} error={compileError} />
        </section>
      </div>

    </div>
  )
}
