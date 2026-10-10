"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Resume } from "@/lib/resume"
import type { Finding, GrammarLint, GrammarReading, PdfReading, Report } from "@/lib/check/engine"
import { hasEnoughToCheck } from "@/lib/check/labels"
import type { Place } from "@/lib/check/places"
import { pdfLayoutOf, type PdfSectionLayout } from "@/lib/check/extraPdf"
import { viewOf } from "@/lib/check/resume"
import { grammarTexts } from "@/lib/check/spelling"
import { printedOf } from "@/lib/typst/compile"
import type { ActiveSection } from "./SectionNav"
import { usePausedResume, useResumeCheck } from "./useResumeCheck"

/** What the left bar shows: the sections to write in, what the checker found, or the template and Fine-tune. */
export type Mode = "write" | "check" | "style"

const MODES: readonly Mode[] = ["write", "check", "style"]

// The last mode is remembered for this visit, for every resume, so a reload
// keeps it. A later visit opens in Write, with the sections in view.
const MODE_KEY = "editor-mode"

function savedMode(): Mode {
  try {
    const saved = window.sessionStorage.getItem(MODE_KEY)
    return MODES.find((mode) => mode === saved) ?? "write"
  } catch {
    return "write"
  }
}

function saveMode(mode: Mode) {
  try {
    window.sessionStorage.setItem(MODE_KEY, mode)
  } catch {
    // Only a convenience: the editor opens in Write mode next time.
  }
}

/**
 * A finding the person chose to fix, as the checker sees it now. `request`
 * counts up each time one is chosen, so choosing it again opens it again.
 */
export interface Target {
  finding: Finding
  request: number
}

/** What the checker found, and where it stands. It changes as the resume is checked again, once typing pauses. */
interface CheckValue {
  report: Report
  /** The resume as last checked, which `report` is of. */
  checked: Resume
  /** What the left bar shows. */
  mode: Mode
  /**
   * Where the PDF rules stand: "reading" the current preview, "read",
   * "unreadable", or "unbuilt" when the preview itself couldn't be made.
   */
  pdf: "reading" | "read" | "unreadable" | "unbuilt"
  /**
   * Where the grammar rules stand: "checking" text on the resume that hasn't
   * been checked yet, "ready" when all of it has, or "failed" to check it.
   */
  grammar: "checking" | "ready" | "failed"
}

/** What changes the checker's state. Each keeps the same identity for as long as the resume is open. */
type CheckActions = ReturnType<typeof useResumeCheck>["actions"] & {
  /** Switches the left bar, and remembers it in this browser. */
  chooseMode: (mode: Mode) => void
  /** Opens a finding's section, and asks its form to point at the field. */
  open: (finding: Finding) => void
  /** Whether a request hasn't been taken yet. */
  pending: (request: number) => boolean
  /**
   * True the first time a form takes a request, so the form that opens the
   * field does it once, and not again when it's shown later.
   */
  claim: (request: number) => boolean
}

/** The preview on screen: its PDF, and what it prints (`printedOf` as JSON). */
export interface Preview {
  url: string
  printed: string
  /** The resume it was made from, with what's left out of it: where each printed line is in the editor. */
  checkerResume?: Resume
}

// Three contexts, so each part of the editor re-renders only with what it
// shows: the left bar with each new report, the forms only with the finding
// being fixed, and what just acts on the checker, never.
const CheckContext = createContext<CheckValue | null>(null)
const CheckActionsContext = createContext<CheckActions | null>(null)
// Null while no finding is being fixed, so undefined is outside a CheckProvider.
const CheckTargetContext = createContext<Target | null | undefined>(undefined)

/** The form section a place is in; none for the PDF's pages. */
export function sectionOf(place: Place): ActiveSection | null {
  return place.kind === "profile"
    ? "Profile"
    : place.kind === "page"
      ? null
      : "sectionId" in place
        ? `extra:${place.sectionId}`
        : place.section
}

const PLACE_PARTS = ["field", "section", "sectionId", "entry", "line", "page"] as const

// The same problem: one rule at one place. Its text and message can change
// as the person types, and it's still the one they're fixing.
const sameIssue = (a: Finding, b: Finding) =>
  a.rule === b.rule &&
  a.place.kind === b.place.kind &&
  PLACE_PARTS.every((part) => (a.place as Record<string, unknown>)[part] === (b.place as Record<string, unknown>)[part])

// Runs `callback` once the page is idle, or after a moment where it can't
// tell (Safari), and gives back how to call it off.
function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 2000 })
    return () => window.cancelIdleCallback(handle)
  }
  const timer = setTimeout(callback, 200)
  return () => clearTimeout(timer)
}

// How many previews to remember as read, by what they print, so going back
// to one, as with undo, or a change that's put back, doesn't read it again.
const READINGS_KEPT = 4

// How many pieces of text to remember the grammar checker's findings for.
// Each is checked once; one that's typed back, as with undo, isn't again.
const GRAMMAR_TEXTS_KEPT = 2000

// How long changes pause before the resume is checked again, in milliseconds.
// Checking takes milliseconds on a laptop and tens of them on a phone: too
// long for every key, so what's found trails typing by a pause.
const CHECK_DELAY_MS = 300

interface CheckProviderProps {
  /** Shows a section in the form, as choosing it in the section list does. */
  onSelect: (section: ActiveSection) => void
  preview: Preview | null
  /** What the resume printed when its preview last failed to build. */
  unbuilt: string | null
  children: React.ReactNode
}

/**
 * Checks the open resume for the editor, once typing pauses: the left bar
 * lists what's found, and the forms point at the finding the person chose to
 * fix. Once Check has been opened, each new preview is read for the PDF
 * rules, while the page is idle; they wait while the preview is behind the
 * resume being checked. Text that's new since it was last checked goes to the
 * grammar checker then too.
 */
export function CheckProvider({ onSelect, preview, unbuilt, children }: CheckProviderProps) {
  const resume = usePausedResume(CHECK_DELAY_MS)
  // What the resume being checked prints; a preview of anything else is out of date.
  const printed = useMemo(() => JSON.stringify(printedOf(resume)), [resume])
  // The resume the preview was made from, to find each section's text in the
  // PDF by. A change that doesn't print, as to a left-out bullet, can still
  // move that text in the editor, so while the resume being checked prints the
  // same as the preview, it's that one.
  const pdfResume = preview && preview.printed === printed ? resume : preview?.checkerResume
  const layoutJSON = useMemo(() => (pdfResume ? JSON.stringify(pdfLayoutOf(viewOf(pdfResume))) : undefined), [pdfResume])
  const layout = useMemo<PdfSectionLayout[] | undefined>(
    () => (layoutJSON === undefined ? undefined : JSON.parse(layoutJSON)),
    [layoutJSON],
  )
  const previewUrl = preview?.url
  const previewPrinted = preview?.printed
  // Private omitted-line edits can keep the PDF identical while moving an
  // editor target. Include source addresses in the reading cache key.
  const readingKey = previewPrinted ? `${previewPrinted}\n${layoutJSON}` : ""
  // A resume with nothing to check yet opens in Write, so its sections aren't
  // hidden behind a request to fill them in.
  const [mode, setMode] = useState<Mode>(() => (hasEnoughToCheck(viewOf(resume)) ? savedMode() : "write"))
  const chooseMode = useCallback((next: Mode) => {
    setMode(next)
    saveMode(next)
  }, [])
  // Once Check has been opened, the preview and the text are checked from then on.
  const [watching, setWatching] = useState(false)
  useEffect(() => {
    if (mode === "check") setWatching(true)
  }, [mode])
  // The latest preview as read, and what it prints; null if it couldn't be read.
  const [read, setRead] = useState<{ printed: string; key: string; pdf: PdfReading | null } | null>(null)
  const readings = useRef(new Map<string, PdfReading | null>())
  useEffect(() => {
    if (!watching || !previewUrl || !previewPrinted) return
    const known = readings.current
    if (known.has(readingKey)) {
      setRead({ printed: previewPrinted, key: readingKey, pdf: known.get(readingKey) ?? null })
      return
    }
    const reading = new AbortController()
    const cancel = whenIdle(() => {
      // The reader only loads once Check has been opened.
      import("@/lib/check/preview")
        .then(({ readPreview }) => readPreview(previewUrl, reading.signal, layout))
        .then((pdf) => {
          if (reading.signal.aborted) return
          known.set(readingKey, pdf)
          // Maps keep the order things were added in: the first is the oldest.
          if (known.size > READINGS_KEPT) known.delete(known.keys().next().value!)
          setRead({ printed: previewPrinted, key: readingKey, pdf })
        })
        .catch((error) => {
          if (reading.signal.aborted) return
          console.warn("The checker couldn't read the preview:", error)
          setRead({ printed: previewPrinted, key: readingKey, pdf: null })
        })
    })
    return () => {
      cancel()
      reading.abort()
    }
  }, [watching, previewUrl, previewPrinted, readingKey, layout])

  // What the grammar checker found in each piece of text, once it has loaded,
  // and the text it's checking now.
  const [grammarRead, setGrammarRead] = useState<GrammarReading | undefined>(undefined)
  const [grammarFailed, setGrammarFailed] = useState(false)
  const grammarFound = useRef(new Map<string, readonly GrammarLint[]>())
  const grammarChecking = useRef(new Set<string>())
  const current = read?.printed === printed && read.key === readingKey ? read : null
  const pdf: CheckValue["pdf"] = current ? (current.pdf ? "read" : "unreadable") : unbuilt === printed ? "unbuilt" : "reading"
  const check = useResumeCheck(resume, current?.pdf ?? undefined, grammarRead)
  // The text the grammar checker reads, from the resume as last checked, so
  // working it out never holds up typing.
  const texts = useMemo(() => (watching ? grammarTexts(check.report.view).map(({ text }) => text) : []), [watching, check.report.view])
  const textsNow = useRef(texts)
  textsNow.current = texts
  useEffect(() => {
    if (!watching) return
    const known = grammarFound.current
    const checking = grammarChecking.current
    const missing = [...new Set(texts.filter((text) => !known.has(text) && !checking.has(text)))]
    if (missing.length === 0) {
      // With nothing on its way either, what's known is the whole reading.
      if (texts.every((text) => known.has(text))) setGrammarRead((reading) => reading ?? new Map(known))
      return
    }
    return whenIdle(() => {
      setGrammarFailed(false)
      for (const text of missing) checking.add(text)
      // The grammar checker only loads once Check has been opened.
      import("@/lib/check/grammar")
        .then(({ checkGrammar }) => checkGrammar(missing))
        .then((lints) => {
          // Kept even if the text has changed since: it's what that text holds whenever it's typed.
          missing.forEach((text, index) => known.set(text, lints[index]))
          // The oldest go first, but never what's on the resume now.
          const onResume = new Set(textsNow.current)
          for (const text of known.keys()) {
            if (known.size <= GRAMMAR_TEXTS_KEPT) break
            if (!onResume.has(text)) known.delete(text)
          }
          setGrammarRead(new Map(known))
        })
        .catch((error) => {
          console.warn("The grammar checker couldn't check the resume:", error)
          setGrammarFailed(true)
        })
        .finally(() => {
          for (const text of missing) checking.delete(text)
        })
    })
  }, [watching, texts])
  // The grammar rules read what's been checked so far; until all of the
  // resume's text has been, the panel says it's still checking, or that it couldn't.
  const unchecked = !grammarRead || texts.some((text) => !grammarRead.has(text))
  const grammar: CheckValue["grammar"] = !unchecked ? "ready" : grammarFailed ? "failed" : "checking"
  const [chosen, setChosen] = useState<Target | null>(null)
  const claimed = useRef(0)
  const select = useRef(onSelect)
  select.current = onSelect

  const open = useCallback((finding: Finding) => {
    const section = sectionOf(finding.place)
    if (section) select.current(section)
    setChosen((current) => ({ finding, request: (current?.request ?? 0) + 1 }))
  }, [])

  const pending = useCallback((request: number) => request > claimed.current, [])
  const claim = useCallback((request: number) => {
    if (request <= claimed.current) return false
    claimed.current = request
    return true
  }, [])

  // The same finding while it's there, or else the same problem as its text
  // changes while it's being fixed: one rule can find more than one thing at
  // a place, as two typos in a bullet.
  const live = chosen
    ? (check.report.findings.find((finding) => finding.key === chosen.finding.key) ??
      check.report.findings.find((finding) => sameIssue(finding, chosen.finding)))
    : undefined
  const target = useMemo(
    () => (chosen && live && mode === "check" ? { finding: live, request: chosen.request } : null),
    [chosen, live, mode],
  )
  const { report, checked } = check
  const value = useMemo(() => ({ report, checked, mode, pdf, grammar }), [report, checked, mode, pdf, grammar])
  const actions = useMemo(() => ({ ...check.actions, chooseMode, open, pending, claim }), [check.actions, chooseMode, open, pending, claim])
  return (
    <CheckActionsContext.Provider value={actions}>
      <CheckContext.Provider value={value}>
        <CheckTargetContext.Provider value={target}>{children}</CheckTargetContext.Provider>
      </CheckContext.Provider>
    </CheckActionsContext.Provider>
  )
}

/** What the checker found, and where it stands. A component using this re-renders each time the resume is checked. */
export function useCheck(): CheckValue {
  const check = useContext(CheckContext)
  if (!check) throw new Error("useCheck must be used inside CheckProvider")
  return check
}

/** What changes the checker's state. A component using just this doesn't re-render when the resume is checked again. */
export function useCheckActions(): CheckActions {
  const actions = useContext(CheckActionsContext)
  if (!actions) throw new Error("useCheckActions must be used inside CheckProvider")
  return actions
}

/**
 * The finding being fixed, which the forms show on its field. Null once it's
 * fixed or dismissed, and in Write mode, where it would only be noise.
 */
export function useCheckTarget(): Target | null {
  const target = useContext(CheckTargetContext)
  if (target === undefined) throw new Error("useCheckTarget must be used inside CheckProvider")
  return target
}
