// The resume score (issue #67): how well a resume follows the checker's
// rules, out of 100. It says nothing about whether a resume gets anyone
// hired. Each category is worth its points (CATEGORIES) and starts with all
// of them. Each rule that finds something takes some away: a must-fix up to
// half of them, a suggestion up to a fifth (LEVELS), at least half of that
// for finding anything (LEAST_PENALTY), and the rest by how much of the
// resume fails it, with dismissed suggestions counting as passing
// (engine.ts). Rules that pass earn nothing, so easy passes can't make up for
// a real problem. Nor can a category earn more than the share of its rules
// that pass, so one whose only rules that apply fail, as with no bullets at
// all, earns nothing. While a must-fix is left, the score stays at
// MUST_FIX_MAX or below.

import type { Finding, Report, Rule, RuleResult } from "./engine"
import { hasEnoughToCheck } from "./labels"
import { CATEGORIES, LEAST_PENALTY, LEVELS, MUST_FIX_MAX, SCORE_BANDS, SCORE_COLORS, type CategoryId } from "./settings"

/** How a category did. */
export interface CategoryScore {
  id: CategoryId
  /** What it's worth. */
  points: number
  /** What the resume earned of them. */
  earned: number
  /** Whether any of its rules apply. When none do, its points go to the others. */
  applies: boolean
  /** Whether a must-fix rule found something, which holds the total at MUST_FIX_MAX or below. */
  mustFix: boolean
}

export interface Score {
  /** From 0 to 100, or null until there's a name and an entry to check. */
  total: number | null
  /** Each category, in CATEGORIES' order. */
  categories: CategoryScore[]
}

// A rule counts once it has looked at the whole resume, or found something
// where it did look, so a problem it lists always costs points, as when the
// grammar checker failed partway. One that doesn't apply, broke, is still
// waiting for the PDF or the grammar checker, or has seen only part of the
// text (partial) and found nothing there is left out: that's no pass yet.
const counts = (result: RuleResult) =>
  !result.rule.advisory &&
  result.scoring !== null &&
  (result.status === "failed" || result.status === "passed") &&
  (!result.partial || failed(result))

const creditOf = (result: RuleResult) => result.scoring?.credit ?? result.credit
const levelOf = (result: RuleResult) => result.scoring?.level ?? result.rule.level
const failed = (result: RuleResult) => result.scoring?.failed ?? result.status === "failed"

/**
 * What a rule takes from its category, as a share of its points: nothing when
 * it passes, and when it finds something, its level's penalty, at least
 * LEAST_PENALTY of it and the rest by how much of the resume fails it.
 */
function penaltyOf(result: RuleResult): number {
  if (!failed(result)) return 0
  return LEVELS[levelOf(result)].penalty * (LEAST_PENALTY + (1 - LEAST_PENALTY) * (1 - creditOf(result)))
}

/**
 * Points as they're shown: whole ones, rounded down, so 100 (or a full
 * category) means everything passed. The small margin keeps a sum that comes
 * to 99.999… from losing a point.
 */
export const wholePoints = (points: number) => Math.floor(points + 1e-9)

// Coverage weights stay fixed when a contextual finding is resolved. Otherwise
// fixing an issue can lower the passing share by shrinking its denominator.
const weight = (result: RuleResult) => LEVELS[result.rule.level].penalty

/**
 * How a category's rules did, in points: all of them, less what each rule
 * that found something takes, and no more than the share of its rules that
 * pass, each counting as much as it could take.
 */
export function categoryScore(id: CategoryId, results: readonly RuleResult[]): CategoryScore {
  const { points } = CATEGORIES.find((category) => category.id === id)!
  const ran = results.filter((result) => result.rule.category === id && counts(result))
  if (ran.length === 0) return { id, points, earned: 0, applies: false, mustFix: false }
  const left = Math.max(0, 1 - ran.reduce((sum, result) => sum + penaltyOf(result), 0))
  const passing =
    ran.reduce((sum, result) => sum + weight(result) * creditOf(result), 0) / ran.reduce((sum, result) => sum + weight(result), 0)
  return {
    id,
    points,
    earned: points * Math.min(left, passing),
    applies: true,
    mustFix: ran.some((result) => failed(result) && levelOf(result) === "fix"),
  }
}

/** Whether a must-fix problem is left in the categories that apply. */
export const hasMustFix = (categories: readonly CategoryScore[]) => categories.some((category) => category.applies && category.mustFix)

/**
 * Out of 100: what the categories that apply earned, of what they're worth,
 * and no more than MUST_FIX_MAX while a must-fix is left. Null when none apply.
 */
export function totalOf(categories: readonly CategoryScore[]): number | null {
  const counted = categories.filter((category) => category.applies)
  const possible = counted.reduce((sum, category) => sum + category.points, 0)
  if (possible === 0) return null
  const total = (100 * counted.reduce((sum, category) => sum + category.earned, 0)) / possible
  return wholePoints(hasMustFix(counted) ? Math.min(total, MUST_FIX_MAX) : total)
}

/** The word for a score out of 100 (SCORE_BANDS). */
export const bandOf = (total: number) => SCORE_BANDS.find((band) => total >= band.least) ?? SCORE_BANDS[SCORE_BANDS.length - 1]

export type ScoreColor = (typeof SCORE_COLORS)[number]["color"]

/** The color a score out of 100 is shown in (SCORE_COLORS). */
export const colorOf = (total: number): ScoreColor =>
  (SCORE_COLORS.find((band) => total >= band.least) ?? SCORE_COLORS[SCORE_COLORS.length - 1]).color

/** The resume's score, from what the checker found (`runChecks`). */
export function scoreOf(report: Report): Score {
  const categories = CATEGORIES.map(({ id }) => categoryScore(id, report.results))
  return { total: hasEnoughToCheck(report.view) ? totalOf(categories) : null, categories }
}

/**
 * The categories still being checked, and what each waits on: those with
 * rules on the PDF while the preview is read, and those with grammar rules
 * while the text is checked. It goes by where those checks stand now, as the
 * report can be a moment behind.
 */
export function checkingCategories(
  rules: readonly Rule[],
  { readingPdf, checkingText }: { readingPdf: boolean; checkingText: boolean },
): Map<CategoryId, Rule["reads"]> {
  const checking = new Map<CategoryId, Rule["reads"]>()
  for (const rule of rules) {
    const waits = (rule.reads === "pdf" && readingPdf) || (rule.reads === "grammar" && checkingText)
    // The PDF is what a category with both is said to wait on.
    if (waits && checking.get(rule.category) !== "pdf") checking.set(rule.category, rule.reads)
  }
  return checking
}

/** Each category's points as last checked, kept while it's checked again. */
export type KeptScores = Map<CategoryId, CategoryScore>

/**
 * Keeps the points of each category that isn't being checked, while the
 * resume can be scored. Before it has a name and an entry most rules don't
 * apply, which would look like a category with nothing to score, and once it
 * loses them the points it had are let go, so they aren't shown again when
 * it gets them back before it has been checked anew.
 */
export function keepScores(kept: KeptScores, now: Score, checking: ReadonlyMap<CategoryId, unknown>): void {
  if (now.total === null) {
    kept.clear()
    return
  }
  for (const category of now.categories) if (!checking.has(category.id)) kept.set(category.id, category)
}

/** Each category's must-fix count as last checked, kept while it's checked again. */
export type KeptFixes = Map<CategoryId, number>

const fixesIn = (findings: readonly Finding[], id: CategoryId) =>
  findings.filter((finding) => finding.category === id && finding.level === "fix").length

/** Keeps each category's must-fix count while it isn't being checked, and lets go of them as `keepScores` does. */
export function keepFixes(kept: KeptFixes, report: Report, checking: ReadonlyMap<CategoryId, unknown>): void {
  if (!hasEnoughToCheck(report.view)) {
    kept.clear()
    return
  }
  for (const { id } of CATEGORIES) if (!checking.has(id)) kept.set(id, fixesIn(report.findings, id))
}

/**
 * How many must-fixes hold the score down, as shown. A category being checked
 * again counts them as last checked, or as found since if there are more, as
 * `shownScore`'s `mustFix` does, so the count agrees with the cap while the
 * PDF or the text is read again.
 */
export function shownFixes(report: Report, kept: ReadonlyMap<CategoryId, number>, checking: ReadonlyMap<CategoryId, unknown>): number {
  return CATEGORIES.reduce((sum, { id }) => {
    const now = fixesIn(report.findings, id)
    return sum + (checking.has(id) ? Math.max(now, kept.get(id) ?? 0) : now)
  }, 0)
}

/**
 * The score as shown: a category being checked again keeps its points as
 * last checked (`kept`), so its bar and the total don't jump each time the
 * PDF or the text is read again after a change. Until each has been checked
 * once, the total waits ("checking"), and so does a category's bar (null).
 * `mustFix` says whether a must-fix is left, as last checked or as found
 * since, as by a form rule while the PDF is read again; either holds the
 * total down at once.
 */
export function shownScore(
  now: Score,
  kept: ReadonlyMap<CategoryId, CategoryScore>,
  checking: ReadonlyMap<CategoryId, unknown>,
): { total: number | "checking" | null; categories: (CategoryScore | null)[]; mustFix: boolean } {
  const categories = now.categories.map((category) => (checking.has(category.id) ? (kept.get(category.id) ?? null) : category))
  const shown = categories.filter((category): category is CategoryScore => category !== null)
  if (now.total === null) return { total: null, categories, mustFix: false }
  const mustFix = hasMustFix(shown) || hasMustFix(now.categories)
  const total = shown.length === categories.length ? totalOf(shown) : "checking"
  return { total: typeof total === "number" && mustFix ? Math.min(total, MUST_FIX_MAX) : total, categories, mustFix }
}
