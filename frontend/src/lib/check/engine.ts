// Runs the resume checker's rules over a resume and collects what they found.
// A rule is a plain function: it reads the resume (and for some rules, the
// PDF as the resume reader read it) and says what's wrong and where. The
// rules are listed in rules.ts; how to write one is in README.md.

import type { Line, PageSize } from "@/lib/import/lines"
import type { ParsedResume } from "@/lib/import/parse"
import { findingKey, placeExists, textAt, type Place } from "./places"
import { viewOf, type ResumeView } from "./resume"
import { RULES } from "./rules"
import { AUTOMATIC_PASSES, CATEGORIES, type CategoryId, type Level } from "./settings"
import { readCheckState } from "./state"

/** The latest preview PDF, as the resume reader in lib/import read it. */
export interface PdfReading {
  lines: Line[]
  pages: PageSize[]
  parsed: ParsedResume
}

/** What a rule reads. */
export interface CheckInput {
  resume: ResumeView
  /** For rules about dates, like whether a job has ended. */
  today: Date
  /** Words the person added with "Add word", in lower case. */
  words: ReadonlySet<string>
}

/** Something a rule found wrong. */
export interface Problem {
  place: Place
  /** What's wrong, in a few plain words: "“Responsible for” is a weak start". */
  message: string
  /**
   * The text it's about, when that isn't all the text at `place`, or when the
   * problem is that something's missing. A dismissal lasts until it changes.
   */
  text?: string
  /** What to do instead, when there's something specific: "Try “Led” or “Built”". */
  suggestion?: string
}

/** What a rule found on a resume. */
export interface Outcome {
  /** How many things it looked at (fields, entries, bullets), for partial credit. */
  checked: number
  /** What's wrong; none when it passes. */
  problems: Problem[]
  /**
   * How much of the resume passes, from 0 to 1, when that isn't the share of
   * what it checked that had no problem, as for "about half the bullets have
   * a number". It stands even if some of the problems are dismissed; all of
   * them dismissed counts as passing.
   */
  credit?: number
}

interface RuleInfo {
  /** As in the rubric: "C1", "B3". */
  id: string
  category: CategoryId
  level: Level
  /** What it checks, for the list of passed checks: "Your email address". */
  title: string
  /** Why it matters, in one line, shown with what it finds. */
  why: string
}

/**
 * A check. It returns null when it doesn't apply, as for a project rule on a
 * resume without projects; that counts neither for nor against the resume.
 * PDF rules wait until the preview has been read.
 */
export type Rule = RuleInfo &
  (
    | { reads: "form"; check: (input: CheckInput) => Outcome | null }
    | { reads: "pdf"; check: (input: CheckInput & { pdf: PdfReading }) => Outcome | null }
  )

/** A problem, with its rule's level and reason, ready to show. */
export interface Finding {
  rule: string
  level: Level
  category: CategoryId
  place: Place
  message: string
  why: string
  suggestion?: string
  /** The text it's about, as typed. */
  text: string
  /** Tells it apart from other findings, for dismissing it (see state.ts). */
  key: string
  dismissed: boolean
}

/**
 * How a rule did: "passed", "failed" (it found something that isn't
 * dismissed), "skipped" (it doesn't apply), "waiting" (for the PDF) or
 * "error" (it broke, and is left out like a skipped one).
 */
export type RuleStatus = "passed" | "failed" | "skipped" | "waiting" | "error"

export interface RuleResult {
  rule: Rule
  status: RuleStatus
  /** How many things it looked at; 0 unless it ran. */
  checked: number
  /** How much of the resume passes it, from 0 to 1, with dismissed findings counting as passing; 1 unless it ran. */
  credit: number
  /** What it found, dismissed or not. */
  findings: Finding[]
}

export interface Report {
  /** What's wrong and not dismissed: fixes first, then by category, then in rule and resume order. */
  findings: Finding[]
  /** What the person dismissed, in the same order, so it can be brought back. */
  dismissed: Finding[]
  /** How each rule did, in the order the rules were given. */
  results: RuleResult[]
  /** What the templates guarantee, always passed. */
  automatic: readonly string[]
}

export interface CheckOptions {
  /** The rules to run; all of them unless given. */
  rules?: readonly Rule[]
  /** The preview PDF as read, once it has been; PDF rules wait for it. */
  pdf?: PdfReading
  today?: Date
}

const clamp = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

const LEVEL_ORDER: Record<Level, number> = { fix: 0, look: 1 }
const CATEGORY_ORDER = new Map<string, number>(CATEGORIES.map((category, index) => [category.id, index]))

/** Runs the rules over a resume, as the editor saves it, and says what they found. */
export function runChecks(resume: Record<string, any>, { rules = RULES, pdf, today = new Date() }: CheckOptions = {}): Report {
  const view = viewOf(resume)
  const state = readCheckState(resume)
  const dismissed = new Set(state.dismissed)
  const input: CheckInput = { resume: view, today, words: new Set(state.words.map((word) => word.toLowerCase())) }
  const results = rules.map((rule) => run(rule, input, dismissed, pdf))
  // A stable sort, so rules and the resume's own order break ties.
  const findings = results
    .flatMap((result) => result.findings)
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        (CATEGORY_ORDER.get(a.category) ?? 0) - (CATEGORY_ORDER.get(b.category) ?? 0),
    )
  return {
    findings: findings.filter((finding) => !finding.dismissed),
    dismissed: findings.filter((finding) => finding.dismissed),
    results,
    automatic: AUTOMATIC_PASSES,
  }
}

// One rule over the resume. A rule that breaks, or points somewhere that
// isn't on the resume, is a bug; it's logged and left out, and the rest of
// the checker carries on.
function run(rule: Rule, input: CheckInput, dismissed: ReadonlySet<string>, pdf: PdfReading | undefined): RuleResult {
  const untouched = { rule, checked: 0, credit: 1, findings: [] }
  if (rule.reads === "pdf" && !pdf) return { ...untouched, status: "waiting" }
  let outcome: Outcome | null
  try {
    outcome = rule.reads === "pdf" ? rule.check({ ...input, pdf: pdf! }) : rule.check(input)
  } catch (error) {
    console.warn(`The ${rule.id} check failed:`, error)
    return { ...untouched, status: "error" }
  }
  if (!outcome) return { ...untouched, status: "skipped" }

  const view = input.resume
  const findings = outcome.problems.flatMap((problem): Finding[] => {
    if (!placeExists(view, problem.place, pdf?.pages.length)) {
      console.warn(`The ${rule.id} check found something at a place that isn't on the resume:`, problem.place)
      return []
    }
    const text = problem.text ?? textAt(view, problem.place)
    const key = findingKey(rule.id, problem.place, text)
    return [
      {
        rule: rule.id,
        level: rule.level,
        category: rule.category,
        place: problem.place,
        message: problem.message,
        why: rule.why,
        ...(problem.suggestion && { suggestion: problem.suggestion }),
        text,
        key,
        // Only suggestions can be dismissed.
        dismissed: rule.level === "look" && dismissed.has(key),
      },
    ]
  })

  const open = findings.filter((finding) => !finding.dismissed).length
  const checked = Math.max(1, Number.isFinite(outcome.checked) ? outcome.checked : 0)
  const credit =
    findings.length > 0 && open === 0
      ? 1
      : outcome.credit !== undefined
        ? clamp(outcome.credit)
        : clamp((checked - open) / checked)
  return { rule, status: open > 0 ? "failed" : "passed", checked, credit, findings }
}
