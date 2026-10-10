"use client"

import type React from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  IdCard,
  LayoutList,
  List,
  LoaderCircle,
  Lock,
  Ruler,
  ScanText,
  Sparkles,
  SpellCheck,
  type LucideIcon,
} from "lucide-react"
import type { Finding, Report, Rule } from "@/lib/check/engine"
import { describePlace, hasEnoughToCheck } from "@/lib/check/labels"
import type { ResumeView } from "@/lib/check/resume"
import {
  bandOf,
  checkingCategories,
  keepFixes,
  keepScores,
  scoreOf,
  shownFixes,
  shownScore,
  wholePoints,
  type CategoryScore,
  type KeptFixes,
  type KeptScores,
} from "@/lib/check/score"
import { CATEGORIES, MUST_FIX_MAX, type CategoryId } from "@/lib/check/settings"
import { hasLeftOut } from "@/lib/leftOut"
import { useCheck, useCheckActions } from "./CheckContext"
import { levelPill } from "./fields"

// A typo can't be dismissed, but its word can be added so it isn't flagged
// again (rule G1, issue #66).
const TYPO_RULE = "G1"

// Each category's icon, so categories at the same level still look apart.
const ICONS: Record<CategoryId, LucideIcon> = {
  contact: IdCard,
  readable: ScanText,
  sections: LayoutList,
  dates: CalendarDays,
  bullets: List,
  length: Ruler,
  spelling: SpellCheck,
  polish: Sparkles,
}

// The score ring's circle, in the SVG's 36-unit box.
const RING_RADIUS = 15.5
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

// A small grey pill for a finding's actions: Dismiss, Add word, Bring back.
const action = "inline-flex h-6 items-center rounded-full bg-ink/[0.05] px-2.5 text-[12px] text-ink transition-colors hover:bg-ink/[0.1]"

type Category = (typeof CATEGORIES)[number]

/**
 * What the checker found on the resume, in the left bar's Check mode: the
 * resume score, then each category with something to fix or review, its
 * points and what it found. What passed isn't listed. Choosing a finding
 * opens its field in the form.
 */
export default function CheckPanel() {
  const { report, checked, pdf, grammar } = useCheck()
  const { restore } = useCheckActions()
  // The resume as last checked, so places are named as the findings saw them.
  const view = report.view

  const checking = checkingCategories(
    report.results.map((result) => result.rule),
    { readingPdf: pdf === "reading", checkingText: grammar === "checking" && view.grammarLanguage !== "other" },
  )
  const score = useShownScore(report, checking)
  const fixes = useShownFixes(report, checking)
  const shown = useShownCategories(report.findings, checking)

  if (!hasEnoughToCheck(view)) {
    return (
      <div className="flex flex-col gap-4 px-3 py-4 xl:p-0">
        <ScoreHeader total={null} />
        <p className="px-2 text-sm leading-relaxed text-ink-2">
          {/* The checker reads only what's printed, so entries that are all left out don't count. */}
          {view.profile.fullName && hasLeftOut(checked)
            ? "Include some section content in the PDF to check this resume."
            : "Add your name and some section content to check this resume."}
        </p>
      </div>
    )
  }

  const waitingFor = (reads: "pdf" | "grammar") =>
    report.results.some((result) => result.status === "waiting" && result.rule.reads === reads)
  // Grammar rules check text as it's typed, so they're behind until it's all been checked.
  const checkingGrammar = view.grammarLanguage !== "other" && (waitingFor("grammar") || grammar !== "ready")
  return (
    <div className="flex flex-col gap-5 px-3 py-4 xl:p-0">
      <ScoreHeader total={score.total} mustFix={score.mustFix} fixes={fixes} updating={checking.size > 0} />
      {(waitingFor("pdf") || checkingGrammar) && (
        <div role="status" className="flex flex-col gap-1 px-2 text-sm text-ink-2">
          {waitingFor("pdf") && (
            <p>
              {pdf === "unbuilt"
                ? "The preview couldn't be built, so the checks on the PDF are left out."
                : pdf === "unreadable"
                  ? "The PDF couldn't be read, so the checks on it are left out."
                  : "Checking the PDF…"}
            </p>
          )}
          {checkingGrammar && (
            <p>
              {grammar === "failed"
                ? "Spelling and grammar couldn't all be checked, so what wasn't is left out."
                : "Checking spelling and grammar…"}
            </p>
          )}
        </div>
      )}

      {shown.length > 0 ? (
        <div className="flex flex-col gap-3">
          {shown.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              view={view}
              findings={report.findings.filter((finding) => finding.category === category.id)}
              checking={checking.get(category.id)}
              score={score.categories[CATEGORIES.indexOf(category)]}
            />
          ))}
        </div>
      ) : (
        checking.size === 0 && <p className="px-2 text-sm leading-relaxed text-ink-2">Nothing to fix or review.</p>
      )}

      {report.dismissed.length > 0 && (
        <Folded summary={`Dismissed · ${report.dismissed.length}`}>
          <ul className="flex flex-col">
            {report.dismissed.map((finding, index) => (
              <li key={`${finding.key}:${index}`} className="flex flex-col items-start gap-1 px-2 py-1.5">
                <span className="w-full truncate font-mono text-[11px] text-ink-2">{describePlace(view, finding.place)}</span>
                <span className="text-[13px] leading-snug text-ink-2">{finding.message}</span>
                <button
                  type="button"
                  onClick={() => restore(finding)}
                  aria-label={`Bring back: ${finding.message}`}
                  className={`${action} mt-0.5`}
                >
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </Folded>
      )}
    </div>
  )
}

/** The score as shown (`shownScore`), with each category's points as last checked. */
function useShownScore(report: Report, checking: ReadonlyMap<CategoryId, unknown>) {
  const now = useMemo(() => scoreOf(report), [report])
  const kept = useRef<KeptScores>(new Map())
  useEffect(() => keepScores(kept.current, now, checking))
  return shownScore(now, kept.current, checking)
}

/** How many must-fixes hold the score down (`shownFixes`), counting those being checked again as last checked. */
function useShownFixes(report: Report, checking: ReadonlyMap<CategoryId, unknown>) {
  const kept = useRef<KeptFixes>(new Map())
  useEffect(() => keepFixes(kept.current, report, checking))
  return shownFixes(report, kept.current, checking)
}

/**
 * The categories with something to fix or review. One being checked again
 * stays if it had findings when last checked, rather than going while its
 * PDF or grammar findings wait to be found again.
 */
function useShownCategories(findings: readonly Finding[], checking: ReadonlyMap<CategoryId, unknown>): Category[] {
  const found = new Set(findings.map((finding) => finding.category))
  const had = useRef(new Set<CategoryId>())
  useEffect(() => {
    for (const { id } of CATEGORIES) {
      if (checking.has(id)) continue
      if (found.has(id)) had.current.add(id)
      else had.current.delete(id)
    }
  })
  return CATEGORIES.filter(({ id }) => found.has(id) || (checking.has(id) && had.current.has(id)))
}

/**
 * The resume score on a ring, a word for how it reads, in a line what it
 * measures, and whether a must-fix is holding it down.
 */
function ScoreHeader({
  total,
  mustFix = false,
  fixes = 0,
  updating = false,
}: {
  total: number | "checking" | null
  mustFix?: boolean
  fixes?: number
  /** Whether some categories are being checked, so the score may change. */
  updating?: boolean
}) {
  const id = useId()
  const band = typeof total === "number" ? bandOf(total) : null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 px-2">
      <div className="flex items-center gap-4">
        <ScoreRing total={total} updating={updating} />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id} className="label-mono text-ink-2">
            Resume score
          </h2>
          {band && <p className="text-[17px] font-medium leading-tight text-ink">{band.name}</p>}
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-2">How well this resume follows the checks below.</p>
      {mustFix && (
        <p className="bg-hatch flex items-start gap-2 rounded-[4px] border border-rule bg-sheet px-3 py-2.5 text-[13px] leading-snug text-ink">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {/* The count follows the cap (`shownFixes`); the wording without one is only a fallback. */}
          {fixes > 0
            ? `Capped at ${MUST_FIX_MAX} until you fix ${fixes === 1 ? "1 item" : `${fixes} items`}.`
            : `Capped at ${MUST_FIX_MAX} while something's left to fix.`}
        </p>
      )}
    </section>
  )
}

/**
 * The score in a ring that fills up to it, from empty when it first shows.
 * Until there's a score an arc runs round the ring, and while the score is
 * checked again after a change, the ring pulses.
 */
function ScoreRing({ total, updating }: { total: number | "checking" | null; updating: boolean }) {
  const scored = typeof total === "number"
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={RING_RADIUS} fill="none" strokeWidth="3" className="stroke-rule" />
        {scored && total > 0 && (
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            // Variables rather than an inline stroke-dashoffset, which would
            // outrank `starting:` (@starting-style) and keep a new ring from
            // starting empty.
            style={{ "--ring-empty": RING_LENGTH, "--ring-offset": RING_LENGTH * (1 - total / 100) } as React.CSSProperties}
            className={`stroke-accent transition-[stroke-dashoffset] duration-1000 ease-out [stroke-dashoffset:var(--ring-offset)] motion-reduce:transition-none starting:[stroke-dashoffset:var(--ring-empty)] ${
              updating ? "animate-pulse motion-reduce:animate-none" : ""
            }`}
          />
        )}
        {total === "checking" && (
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${RING_LENGTH / 4} ${RING_LENGTH}`}
            className="origin-center animate-spin stroke-accent motion-reduce:hidden"
          />
        )}
      </svg>
      {/* Said aloud when it changes, once the checks under way are done. */}
      <p
        className="absolute inset-0 flex flex-col items-center justify-center text-ink"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={total === "checking" || undefined}
      >
        {scored ? (
          <>
            <span className="relative text-[22px] font-medium leading-none tabular-nums">
              {/* Unseen under the rolling digits, unless there's less motion, when it shows as it is. */}
              <span className="opacity-0 motion-reduce:opacity-100">{total}</span>
              <Odometer value={total} />
            </span>
            <span className="mt-0.5 font-mono text-[10px] leading-none text-ink-2" aria-hidden="true">
              / 100
            </span>
            <span className="sr-only">out of 100</span>
          </>
        ) : (
          <>
            <span className="text-[22px] font-medium leading-none text-ink-2" aria-hidden="true">
              {total === "checking" ? "…" : "–"}
            </span>
            <span className="sr-only">{total === "checking" ? "Checking" : "Not scored yet"}</span>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * The score's digits, each rolling up or down to its new value like an
 * odometer's (`.odometer-digit` in styles/editor.css). Keyed from the right,
 * so the ones stay the ones when the score gains a digit, and roll rather
 * than appear. Drawn over the number itself, which is what's read.
 */
function Odometer({ value }: { value: number }) {
  const digits = String(value).split("")
  return (
    <span aria-hidden="true" className="absolute inset-0 flex justify-center motion-reduce:hidden">
      {digits.map((digit, index) => (
        <span key={digits.length - 1 - index} className="odometer-digit" style={{ "--digit": digit } as React.CSSProperties} />
      ))}
    </span>
  )
}

/**
 * One category with something to fix or review, in a box of its own: its
 * icon, a count of each level, its points, and, opened, what it checks and
 * its findings (fixes first). It's open until folded, and slides open and shut.
 */
function CategoryRow({
  category,
  view,
  findings,
  checking,
  score,
}: {
  category: Category
  view: ResumeView
  findings: Finding[]
  /** What it's waiting on, while some of its rules are still being checked. */
  checking: Rule["reads"] | undefined
  /** Its points as shown; null until it has been checked once. */
  score: CategoryScore | null
}) {
  const id = useId()
  const [open, setOpen] = useState(true)
  const fixes = findings.filter((finding) => finding.level === "fix")
  const looks = findings.filter((finding) => finding.level === "look")
  const counts = [fixes.length > 0 && `${fixes.length} to fix`, looks.length > 0 && `${looks.length} to review`].filter(Boolean).join(", ")
  // Where it stands, in a few words. While its rules wait on the PDF or the
  // text, it says so instead of a count.
  const status = checking === "pdf" ? "Reading the PDF…" : checking ? "Checking…" : counts
  const Icon = ICONS[category.id]

  return (
    // Clipped to its corners, so its buttons' focus outlines are drawn inside them.
    <section aria-labelledby={`${id}-name`} className="flex flex-col overflow-hidden rounded-[6px] border border-rule bg-sheet">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          aria-label={`${category.name}, ${status}`}
          onClick={() => setOpen(!open)}
          className="flex w-full items-start gap-2.5 px-3 pb-2 pt-3 text-left transition-colors hover:bg-ink/[0.02] focus-visible:outline-offset-[-2px]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-ink/[0.05] text-ink" aria-hidden="true">
            {checking ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-ink-2 motion-reduce:animate-none" />
            ) : (
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span id={`${id}-name`} className="text-sm font-medium leading-snug text-ink">
              {category.name}
            </span>
            {checking ? (
              <span className="text-[12px] leading-snug text-ink-2">{status}</span>
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {fixes.length > 0 && <span className={levelPill("fix")}>{fixes.length} to fix</span>}
                {looks.length > 0 && <span className={levelPill("look")}>{looks.length} to review</span>}
              </span>
            )}
          </span>
          <ChevronDown
            className={`mt-1.5 h-4 w-4 shrink-0 text-ink-2 transition-transform duration-300 ease-out motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div className="pb-3 pl-[50px] pr-3">
        <Points name={category.name} score={score} checking={Boolean(checking)} />
      </div>

      {/* Slides by its grid row. Once it starts to shut, inert keeps the keyboard
          out of what's sliding away; once shut, visibility (which changes at the
          end of its transition) hides it from view too. */}
      <div
        id={`${id}-body`}
        inert={!open}
        className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col border-t border-rule">
            <p className="px-3 pt-2.5 text-[12px] leading-snug text-ink-2">{category.about}</p>
            {fixes.length > 0 && (
              <Group title={`To fix · ${fixes.length}`}>
                {fixes.map((finding, index) => (
                  <FindingItem key={`${finding.key}:${index}`} finding={finding} view={view} />
                ))}
              </Group>
            )}
            {looks.length > 0 && (
              <Group title={`To review · ${looks.length}`}>
                {looks.map((finding, index) => (
                  <FindingItem key={`${finding.key}:${index}`} finding={finding} view={view} />
                ))}
              </Group>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** A category's points, as a bar. */
function Points({ name, score, checking }: { name: string; score: CategoryScore | null; checking: boolean }) {
  // Not checked yet: the count says it's being checked.
  if (!score?.applies) return null
  const earned = wholePoints(score.earned)
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label={`${name}, points`}
        aria-valuemin={0}
        aria-valuemax={score.points}
        aria-valuenow={earned}
        aria-valuetext={`${earned} of ${score.points} points`}
        className="h-1 flex-1 overflow-hidden rounded-full bg-rule"
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none ${
            checking ? "bg-ink-2" : "bg-accent"
          }`}
          style={{ width: `${(100 * score.earned) / score.points}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-ink-2" aria-hidden="true">
        {earned}/{score.points}
      </span>
    </div>
  )
}

/** Some of a category's findings, under a small title, as rows across its box. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h3 id={id} className="label-mono px-3 pb-1.5 pt-3 text-ink-2">
        {title}
      </h3>
      <ul className="flex flex-col">{children}</ul>
    </section>
  )
}

/**
 * A finding, as a row in its category's box: it opens its field, and a
 * suggestion can be dismissed. A must-fix has a red line down its left side.
 */
function FindingItem({ finding, view }: { finding: Finding; view: ResumeView }) {
  const { open, dismiss, addWord } = useCheckActions()
  return (
    // Pointing at the finding shades the whole row, its actions too.
    <li
      className={`flex flex-col border-t border-rule transition-colors has-[>button:first-child:hover]:bg-ink/[0.02] ${
        finding.level === "fix" ? "shadow-[inset_3px_0_0_var(--color-alert)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => open(finding)}
        className="flex flex-col items-start gap-1 px-3 py-2.5 text-left focus-visible:outline-offset-[-2px]"
      >
        <span className="w-full truncate font-mono text-[11px] text-ink-2">{describePlace(view, finding.place)}</span>
        <span className="text-sm leading-snug text-ink">{finding.message}</span>
        {finding.advisory && <span className="text-[11px] text-ink-2">Optional advice · no score impact</span>}
      </button>
      {(finding.level === "look" || finding.rule === TYPO_RULE) && (
        <div className="-mt-0.5 flex gap-1.5 px-3 pb-2.5">
          {finding.rule === TYPO_RULE && (
            <button type="button" onClick={() => addWord(finding.text)} aria-label={`Add word “${finding.text}”`} className={action}>
              Add word
            </button>
          )}
          {finding.level === "look" && (
            <button type="button" onClick={() => dismiss(finding)} aria-label={`Dismiss: ${finding.message}`} className={action}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/** A list that starts folded, like the dismissed findings. */
function Folded({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details>
      <summary className="label-mono cursor-pointer select-none rounded-[4px] px-2 py-1 text-ink-2 transition-colors hover:text-ink">
        {summary}
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  )
}
