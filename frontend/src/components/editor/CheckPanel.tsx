"use client"

import type React from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, LoaderCircle, Lock, TrendingDown } from "lucide-react"
import { checkKeyOf } from "@/components/review/notes"
import type { Finding, Report, Rule } from "@/lib/check/engine"
import { describePlace, hasEnoughToCheck } from "@/lib/check/labels"
import type { ResumeView } from "@/lib/check/resume"
import {
  bandOf,
  checkingCategories,
  keepFixes,
  keepScores,
  mustFixMax,
  scoreOf,
  shownFixes,
  shownScore,
  wholePoints,
  type CategoryScore,
  type KeptFixes,
  type KeptScores,
} from "@/lib/check/score"
import { CATEGORIES, CONTENT_FULL, MUST_FIX_MAX, SCORE_BANDS, type CategoryId } from "@/lib/check/settings"
import { hasLeftOut } from "@/lib/leftOut"
import AiNotesBox from "./AiNotesBox"
import { useCheck, useCheckActions } from "./CheckContext"
import { useMarks, usePointAt } from "./MarksContext"
import { TIER_BG, TIER_NAMES, tierOf, type Tier } from "./fields"

// A typo can't be dismissed, but its word can be added so it isn't flagged
// again (rule G1, issue #66).
const TYPO_RULE = "G1"

// A finding's actions, as quiet underlined words: Dismiss, Add word, Bring back.
const action =
  "self-start text-[12px] font-medium text-ink-2 underline decoration-rule underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink-2"

type Category = (typeof CATEGORIES)[number]

/**
 * What the checker found on the resume, in the left bar's Check mode: the
 * resume score, then every category as a numbered line with its points, a
 * tick for those that passed, and under the others what they found.
 * Choosing a finding opens its field in the form.
 */
export default function CheckPanel() {
  const { report, checked, pdf, grammar } = useCheck()
  const { restore } = useCheckActions()
  const marks = useMarks()
  // The resume as last checked, so places are named as the findings saw them.
  const view = report.view

  const checking = checkingCategories(
    report.results.map((result) => result.rule),
    { readingPdf: pdf === "reading", checkingText: grammar === "checking" && view.grammarLanguage !== "other" },
  )
  const score = useShownScore(report, checking)
  const fixes = useShownFixes(report, checking)
  const withFindings = useCategoriesWithFindings(report.findings, checking)

  if (!hasEnoughToCheck(view)) {
    return (
      <div className="flex flex-col gap-4 px-3 py-4 xl:p-0">
        <ScoreHeader total={null} />
        <p className="text-sm leading-relaxed text-ink-2">
          {/* The checker reads only what's printed, so what's left out of the PDF doesn't count. */}
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
  if (marks.shown === "ai") {
    return (
      <div className="flex flex-col gap-5 px-3 py-4 xl:p-0">
        <MarksSwitch />
        <AiNotesBox />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5 px-3 py-4 xl:p-0">
      <MarksSwitch />
      <ScoreHeader total={score.total} mustFix={score.mustFix} fixes={fixes} bulletsTake={score.bulletsTake} updating={checking.size > 0} />
      {/* What's still being checked, under the score. The lines open and close rather than appear and
          go, so the list under them glides instead of jumping. */}
      <div
        role="status"
        className={`flex flex-col text-sm text-ink-2 transition-[margin] duration-300 ease-out motion-reduce:transition-none ${
          waitingFor("pdf") || checkingGrammar ? "" : "-mb-5"
        }`}
      >
        <StatusLine
          text={
            !waitingFor("pdf")
              ? null
              : pdf === "unbuilt"
                ? "The preview couldn't be built, so the checks on the PDF are left out."
                : pdf === "unreadable"
                  ? "The PDF couldn't be read, so the checks on it are left out."
                  : "Checking the PDF…"
          }
        />
        <StatusLine
          text={
            !checkingGrammar
              ? null
              : grammar === "failed"
                ? "Spelling and grammar couldn't all be checked, so what wasn't is left out."
                : "Checking spelling and grammar…"
          }
        />
      </div>

      <CheckIndex view={view} findings={report.findings} withFindings={withFindings} checking={checking} scores={score.categories} />

      {report.dismissed.length > 0 && (
        <Folded summary={`Dismissed · ${report.dismissed.length}`}>
          <ul className="flex flex-col">
            {report.dismissed.map((finding, index) => (
              <li key={`${finding.key}:${index}`} className="flex flex-col items-start gap-1 py-1.5">
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

/** One line of what's still being checked: it opens to its height, and closes still saying what it said. */
function StatusLine({ text }: { text: string | null }) {
  const said = useRef(text)
  if (text) said.current = text
  return (
    <div
      aria-hidden={text ? undefined : true}
      // Hidden (visibility) once it's closed, which changes at the end of the transition.
      className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-out motion-reduce:transition-none ${
        text ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <p className="pb-1">{said.current}</p>
      </div>
    </div>
  )
}

/** Which notes the panel lists and the preview is marked with: the ATS checks or the AI's. On wide screens each has its own tab in the rail instead (LeftBar.tsx). */
function MarksSwitch() {
  const { shown, show } = useMarks()
  return (
    // On the white sheet the switch's own white track wouldn't show, so it's grey here.
    <div
      role="group"
      aria-label="Notes on the page"
      className="review-switch self-start bg-fill shadow-[inset_0_0_0_1px_var(--color-fill-line)] xl:hidden"
    >
      <button type="button" aria-pressed={shown === "checks"} onClick={() => show("checks")}>
        ATS Checks
      </button>
      <button type="button" aria-pressed={shown === "ai"} onClick={() => show("ai")}>
        AI Reviews
      </button>
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
 * The categories shown with something to fix or review. One being checked
 * again keeps its findings' line if it had findings when last checked, rather
 * than ticking while its PDF or grammar findings wait to be found again.
 */
function useCategoriesWithFindings(findings: readonly Finding[], checking: ReadonlyMap<CategoryId, unknown>): ReadonlySet<CategoryId> {
  const found = new Set(findings.map((finding) => finding.category))
  const had = useRef(new Set<CategoryId>())
  useEffect(() => {
    for (const { id } of CATEGORIES) {
      if (checking.has(id)) continue
      if (found.has(id)) had.current.add(id)
      else had.current.delete(id)
    }
  })
  return new Set(CATEGORIES.filter(({ id }) => found.has(id) || (checking.has(id) && had.current.has(id))).map(({ id }) => id))
}

/**
 * The resume score as a big number, a word for how it reads, a scale with
 * where each word starts, and whether a must-fix or weak bullets are holding
 * it down. A perfect score's number glows
 * (`[data-perfect] .score-number` in styles/editor.css).
 */
function ScoreHeader({
  total,
  mustFix = false,
  fixes = 0,
  bulletsTake = 0,
  updating = false,
}: {
  total: number | "checking" | null
  mustFix?: boolean
  fixes?: number
  /** How many points weak bullets take off the total (`shownScore`). */
  bulletsTake?: number
  /** Whether some categories are being checked, so the score may change. */
  updating?: boolean
}) {
  const id = useId()
  const scored = typeof total === "number"
  const band = scored ? bandOf(total) : null
  return (
    <section aria-labelledby={id} data-perfect={total === 100 || undefined} className="flex flex-col">
      <h2 id={id} className="label-mono text-ink-2">
        ATS score
      </h2>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        {/* Said aloud when it changes, once the checks under way are done. */}
        <p className="flex items-baseline gap-2.5" aria-live="polite" aria-atomic="true" aria-busy={total === "checking" || undefined}>
          {scored ? (
            <>
              <span
                className={`score-number relative font-serif text-[72px] leading-[0.9] tracking-[-0.045em] tabular-nums text-ink ${
                  updating ? "animate-pulse motion-reduce:animate-none" : ""
                }`}
              >
                {/* Unseen under the rolling digits, unless there's less motion, when it shows as it is. */}
                <span className="opacity-0 motion-reduce:opacity-100">{total}</span>
                <Odometer value={total} />
              </span>
              <span className="label-mono tracking-[0.04em] text-ink-2" aria-hidden="true">
                / 100
              </span>
              <span className="sr-only">out of 100</span>
            </>
          ) : (
            <>
              {total === "checking" ? (
                // Three dots in the number's place, each rising in turn (`.score-dots` in styles/editor.css).
                <span className="score-dots font-serif text-[72px] leading-[0.9] text-ink" aria-hidden="true">
                  <i>.</i>
                  <i>.</i>
                  <i>.</i>
                </span>
              ) : (
                <span className="font-serif text-[72px] leading-[0.9] tracking-[-0.045em] text-ink-2/50" aria-hidden="true">
                  –
                </span>
              )}
              <span className="sr-only">{total === "checking" ? "Checking" : "Not scored yet"}</span>
            </>
          )}
        </p>
        {band && <p className="ml-auto font-serif text-2xl italic leading-none tracking-[-0.01em] text-accent">{band.name}</p>}
      </div>
      <ScoreScale total={total} />
      {(mustFix || bulletsTake > 0) && (
        <div className="mt-3.5 flex flex-col gap-1.5 text-balance text-[13px] leading-snug text-ink">
          {mustFix && (
            <p className="flex items-start gap-2">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {/* The count follows the cap (`shownFixes`); the wording without one is only a fallback. */}
              {fixes > 0
                ? `Capped at ${mustFixMax(fixes)} until you fix ${fixes === 1 ? "1 item" : `${fixes} items`}.`
                : `Capped at ${MUST_FIX_MAX} while something's left to fix.`}
            </p>
          )}
          {/* Why the total is under what the categories' points add up to (`contentShare` in lib/check/score.ts). */}
          {bulletsTake > 0 && (
            <p className="flex items-start gap-2">
              <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {`Your bullets take ${bulletsTake} off until they earn ${Math.round(CONTENT_FULL * 100)}% of their points.`}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// Where each word but the lowest starts, marked on the scale: "Good" at 70, "Strong" at 90.
const SCALE_MARKS = SCORE_BANDS.filter((band) => band.least > 0 && band.least < 100).map((band) => band.least)

/**
 * A hairline that fills to the score, from empty when it first shows, with a
 * tick where each word starts. Until there's a score, a short run sweeps
 * along it.
 */
function ScoreScale({ total }: { total: number | "checking" | null }) {
  const scored = typeof total === "number"
  return (
    <div aria-hidden="true" className="mt-4">
      <div className="relative h-[3px] rounded-full bg-rule">
        {scored && (
          <div
            style={{ scale: `${total / 100} 1` }}
            className="score-fill absolute inset-0 origin-left rounded-full bg-ink transition-[scale] duration-1000 ease-glide motion-reduce:transition-none starting:[scale:0_1]"
          />
        )}
        {total === "checking" && (
          <div className="absolute inset-0 overflow-hidden rounded-full motion-reduce:hidden">
            <div className="h-full w-1/4 animate-[score-sweep-bar_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
          </div>
        )}
        {SCALE_MARKS.map((mark) => (
          <span key={mark} style={{ left: `${mark}%` }} className="absolute -top-1 h-[11px] w-px bg-ink-2" />
        ))}
      </div>
      {/* Drawn as CSS content, not text: they're only marks, and the page's one number is the score. */}
      <div className="relative mt-1.5 h-3 font-mono text-[10px] leading-none text-ink-2">
        <span data-mark="0" className="absolute left-0 before:content-[attr(data-mark)]" />
        {SCALE_MARKS.map((mark) => (
          <span
            key={mark}
            data-mark={mark}
            style={{ left: `${mark}%` }}
            className="absolute -translate-x-1/2 tabular-nums before:content-[attr(data-mark)]"
          />
        ))}
      </div>
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
 * Every category, numbered in order like a book's contents: its name, dotted
 * leaders to its points, and how it stands, which is a tick once it's passed,
 * a spinner while it's checked again, or what it found, under its line.
 */
function CheckIndex({
  view,
  findings,
  withFindings,
  checking,
  scores,
}: {
  view: ResumeView
  findings: readonly Finding[]
  /** The categories shown with what they found (`useCategoriesWithFindings`). */
  withFindings: ReadonlySet<CategoryId>
  /** What each category being checked is waiting on. */
  checking: ReadonlyMap<CategoryId, Rule["reads"]>
  /** Each category's points as shown, in CATEGORIES' order; null until it's been checked once. */
  scores: readonly (CategoryScore | null)[]
}) {
  const id = useId()
  const clear = CATEGORIES.filter((category) => !withFindings.has(category.id)).length
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <div className="flex items-baseline justify-between border-b border-ink pb-2">
        <h2 id={id} className="label-mono text-ink-2">
          Checks
        </h2>
        <p className="label-mono text-ink-2">
          {clear} of {CATEGORIES.length} clear
        </p>
      </div>
      <ol>
        {CATEGORIES.map((category, index) => (
          <CheckRow
            key={category.id}
            number={index + 1}
            category={category}
            view={view}
            findings={withFindings.has(category.id) ? findings.filter((finding) => finding.category === category.id) : null}
            checking={checking.get(category.id)}
            score={scores[index]}
          />
        ))}
      </ol>
    </section>
  )
}

// How each tier is counted in a category's name for screen readers, as "2 to fix, 1 optional".
const TIER_COUNTS: Record<Tier, string> = { fix: "to fix", look: "to review", optional: "optional" }

const TIER_ORDER: readonly Tier[] = ["fix", "look", "optional"]

/**
 * One category's line in the index. One with findings is a button that folds
 * them away under it, sliding open and shut; it starts open.
 */
function CheckRow({
  number,
  category,
  view,
  findings,
  checking,
  score,
}: {
  number: number
  category: Category
  view: ResumeView
  /** What it found; null when it's shown as passed. */
  findings: Finding[] | null
  /** What it's waiting on, while some of its rules are still being checked. */
  checking: Rule["reads"] | undefined
  /** Its points as shown; null until it has been checked once. */
  score: CategoryScore | null
}) {
  const id = useId()
  const [open, setOpen] = useState(true)
  const counted = score?.applies && score.points > 0
  const points = counted ? `${wholePoints(score.earned)} of ${score.points} points` : null
  const line = "grid w-full grid-cols-[22px_1fr_auto] items-baseline gap-x-1.5 py-2.5 text-left"
  const content = (
    <>
      <span aria-hidden="true" className="font-mono text-[11px] tabular-nums text-ink-3">
        {String(number).padStart(2, "0")}
      </span>
      {/* The dots follow the name's last line (`.check-leader` in styles/editor.css). */}
      <span className="check-leader">
        <span>{category.name}</span>
      </span>
      <span aria-hidden="true" className="flex items-center gap-1.5 self-center">
        {checking ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-ink-2 motion-reduce:animate-none" />
        ) : findings ? (
          <ChevronDown
            className={`h-3.5 w-3.5 text-ink-2 transition-transform duration-300 ease-out group-hover:text-ink motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
          />
        ) : (
          <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.25} />
        )}
        {/* As wide as "30/30" even when shorter or empty, so the ticks line up. */}
        <span className="min-w-[5ch] whitespace-nowrap text-right font-mono text-[12px] tabular-nums text-ink">
          {counted && (
            <>
              {wholePoints(score.earned)}
              <span className="text-ink-3">/{score.points}</span>
            </>
          )}
        </span>
      </span>
    </>
  )

  if (!findings) {
    return (
      <li title={category.about} className={`${line} border-b border-hairline text-sm text-ink-2`}>
        {content}
        <span className="sr-only">{[checking ? "Checking" : "Passed", points].filter(Boolean).join(", ")}</span>
      </li>
    )
  }

  // Its findings, the ones that count most first.
  const sorted = TIER_ORDER.flatMap((tier) => findings.filter((finding) => tierOf(finding) === tier))
  const counts = TIER_ORDER.map((tier) => [tier, findings.filter((finding) => tierOf(finding) === tier).length] as const)
    .filter(([, count]) => count > 0)
    .map(([tier, count]) => `${count} ${TIER_COUNTS[tier]}`)
    .join(", ")
  // Where it stands, in a few words. While its rules wait on the PDF or the
  // text, it says so instead of a count.
  const status = checking === "pdf" ? "Reading the PDF…" : checking ? "Checking…" : counts
  return (
    <li className="border-b border-hairline">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          aria-label={[category.name, status, points].filter(Boolean).join(", ")}
          title={category.about}
          onClick={() => setOpen(!open)}
          className={`${line} group text-sm font-medium text-ink focus-visible:outline-offset-[-2px]`}
        >
          {content}
        </button>
      </h3>
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
          <ul className="flex flex-col pb-1.5 pl-7">
            {sorted.map((finding, index) => (
              <FindingItem key={`${finding.key}:${index}`} finding={finding} view={view} />
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}

// A place's number stays with its word when the place wraps: "bullet 4", "Page 2".
const keepNumbers = (place: string) => place.replace(/ (?=\d)/g, " ")

/**
 * A finding, under its category's line: it opens its field, and a suggestion
 * can be dismissed. Its tier's dot is the color its mark on the preview is
 * drawn in (inkOf in components/review/notes.ts).
 */
function FindingItem({ finding, view }: { finding: Finding; view: ResumeView }) {
  const { open, dismiss, addWord } = useCheckActions()
  // Pointing at it shows its mark's note on the preview.
  const point = usePointAt(checkKeyOf(finding))
  const tier = tierOf(finding)
  const tierName = useId()
  return (
    <li {...point} className="flex flex-col items-start gap-1.5 border-t border-dashed border-hairline py-2.5 first:border-t-0">
      <button
        type="button"
        onClick={() => open(finding)}
        onFocus={point.onMouseEnter}
        onBlur={point.onMouseLeave}
        aria-describedby={tierName}
        className="group flex flex-col items-start gap-0.5 text-left focus-visible:outline-offset-2"
      >
        <span className="-ml-[15px] flex items-baseline gap-2 font-mono text-[11px] leading-snug text-ink-2">
          <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full ${TIER_BG[tier]}`} />
          {keepNumbers(describePlace(view, finding.place))}
        </span>
        <span className="text-sm leading-snug text-ink decoration-rule underline-offset-[3px] group-hover:underline">
          {finding.message}
        </span>
      </button>
      <span id={tierName} hidden>
        {TIER_NAMES[tier]}
      </span>
      {(finding.level === "look" || finding.rule === TYPO_RULE) && (
        <div className="flex gap-3">
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
      <summary className="label-mono cursor-pointer select-none py-1 text-ink-2 transition-colors hover:text-ink">{summary}</summary>
      <div className="pt-1">{children}</div>
    </details>
  )
}
