// Bullets (B1–B9 in issue #58): how each one starts, what's in it, and how
// many a job has. Every finding points at the bullet it's about.

import { SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Problem, Rule } from "./engine"
import { hasEnded } from "./readDate"
import type { Entry } from "./resume"
import {
  BUZZWORDS,
  IMPACT_SHARE,
  MAX_BULLETS,
  MIN_SPECIFIC_BULLETS,
  NEAR_DUPLICATE_LENGTH,
  SAME_START,
  VAGUE_WORDS,
  WEAK_STARTS,
} from "./settings"
import { bulletsIn, escaped, firstWord, opening } from "./text"
import { hasOutcome, hasScope, isGenericBullet, showsImpact } from "./bulletEvidence"
import { alternativesTo, inTenseOf, verbAtStart, verbOf } from "./verbs"

// Jobs and roles, whose bullets say what the person did. A project's bullets
// often say what the project is instead ("Interactive map of…"), so they're
// left out of the rules about verbs.
const ROLES: SectionName[] = ["Work", "Leadership", "Volunteership"]

const WEAK = new RegExp(`^(${WEAK_STARTS.map(escaped).join("|")})\\b`, "i")

/** "I", "me", "my", "we" or "our" in a bullet, as written; null if there's none. */
export function pronounIn(text: string): string | null {
  // Product handles, links and quoted names are not narrative pronouns.
  text = text.replace(/(?:https?:\/\/|www\.)\S+|\S+@\S+|["“][^"”]+["”]/g, (value) => " ".repeat(value.length))
  for (const match of text.matchAll(/\b(I|i|me|my|we|our|Me|My|We|Our)\b/g)) {
    const word = match[0]
    const before = text.slice(0, match.index)
    const after = text.slice(match.index + word.length)
    // "I/O", "i.e.", "I-V curve": part of something else.
    if (/^[/&.-]\w/.test(after)) continue
    // "Phase I", "Level I": a numeral after a capitalized word, other than the first.
    if (word === "I" && /\S\s+\p{Lu}\p{L}*\s+$/u.test(before)) continue
    // "Save Our Seas": a capital in the middle of a sentence is part of a name.
    if (/^\p{Lu}/u.test(word) && word !== "I" && before.trim() !== "" && !/[.!?]\s*$/.test(before)) continue
    return word
  }
  return null
}

const weakStarts: Rule = {
  id: "B1",
  category: "bullets",
  level: "look",
  reads: "form",
  title: "No weak starts like “Responsible for”",
  why: "A specific action helps explain your own contribution.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ bullet, place }) => {
        const found = WEAK.exec(opening(bullet.text))
        return found
          ? [{ place, message: `“${found[1]}” is a weak start`, suggestion: "Name your own contribution, without overstating your role." }]
          : []
      }),
    }
  },
}

const actionVerbs: Rule = {
  id: "B2",
  advisory: true,
  category: "bullets",
  level: "look",
  reads: "form",
  title: "Make your contribution clear",
  why: "An action or result can help explain your contribution; other sentence forms can work too.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume, ROLES)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ bullet, place }) => {
        const text = opening(bullet.text)
        // A number first ("50% faster…") is fine; weak starts and "I" have rules of their own.
        if (!text || /^\p{N}/u.test(text) || WEAK.test(text) || pronounIn(firstWord(text)) !== null) return []
        // If the opening word could also name a subject, don't prescribe its
        // sentence structure ("Research findings informed policy").
        return verbAtStart(text) || verbOf(firstWord(text)) || hasScope(text) || hasOutcome(text)
          ? []
          : [
              {
                place,
                message: "Could you name your action?",
                suggestion: "An action or a clear result can help explain your contribution.",
              },
            ]
      }),
    }
  },
}

const scopeAndResults: Rule = {
  id: "B3",
  category: "bullets",
  level: "look",
  reads: "form",
  title: "Show the scope or result of your work",
  why: "A result can be a useful change, not just a number. This check looks for cues, not proof of quality.",
  check: ({ resume }) => {
    const entries = Object.values(resume.sections)
      .flat()
      .filter((entry) => entry.bullets.length > 0)
    if (entries.length === 0) return null
    return {
      // Only roles count toward the score; for a project it's advice (below).
      checked: entries.filter((entry) => ROLES.includes(entry.section)).length,
      problems: entries.flatMap((entry) => {
        // One number in a role shouldn't carry the rest of its bullets.
        const shown = entry.bullets.filter(({ text }) => showsImpact(text)).length
        const needed = Math.ceil(entry.bullets.length * IMPACT_SHARE)
        if (shown >= needed) return []
        return [
          {
            place: { kind: "entry" as const, section: entry.section, entry: entry.index, field: entry.bullets[0].field },
            // A role without enough results counts, though dismissing gives
            // the points back, as the cues can miss one. A project's
            // bullets often say what it is instead, so there it's only advice.
            advisory: !ROLES.includes(entry.section),
            message:
              shown === 0
                ? "Could you add the scope or result?"
                : `Only ${shown} of ${entry.bullets.length} bullets show a scope or result`,
            suggestion: "Say who used the work, what changed, or how much it covered, where you can. A clear result needs no number.",
          },
        ]
      }),
    }
  },
}

const pronouns: Rule = {
  id: "B4",
  category: "bullets",
  level: "look",
  reads: "form",
  title: "No “I”, “me”, “my”, “we” or “our”",
  why: "Starting with the action can make a bullet shorter.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ bullet, place }) => {
        const word = pronounIn(bullet.text)
        return word ? [{ place, message: `Uses “${word}”`, suggestion: "Leave it out: “Built…” rather than “I built…”." }] : []
      }),
    }
  },
}

const BUZZ = new RegExp(String.raw`(?<![\w-])(${BUZZWORDS.map(escaped).join("|")})(?![\w-])`, "i")
const VAGUE = new RegExp(String.raw`(?<![\w-])(${VAGUE_WORDS.map(escaped).join("|")})(?![\w-])`, "i")

const buzzwords: Rule = {
  id: "B5",
  category: "bullets",
  level: "look",
  reads: "form",
  title: "Back up claims with detail",
  why: "Words anyone could claim say less than what you did.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ bullet, place }): Problem[] => {
        if (hasScope(bullet.text) || hasOutcome(bullet.text)) return []
        const buzz = BUZZ.exec(bullet.text)
        // A trait claimed at the start is different from describing another
        // person or a named project later in the sentence.
        if (buzz && opening(bullet.text).startsWith(buzz[1]))
          return [{ place, message: `“${buzz[1]}” says little on its own`, suggestion: "Show it with what you did instead." }]
        const vague = VAGUE.exec(bullet.text)
        return vague ? [{ place, message: `“${vague[1]}” is vague`, suggestion: "Say which ones, or how many." }] : []
      }),
    }
  },
}

const sameStart: Rule = {
  id: "B6",
  advisory: true,
  category: "bullets",
  level: "look",
  reads: "form",
  title: "Varied opening verbs",
  why: "Vary nearby openings when another verb fits your contribution.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    if (bullets.length < SAME_START) return null
    let previous: Entry | undefined
    let last = ""
    let count = 0
    const problems: Problem[] = []
    for (const { place, entry, bullet } of bullets) {
      const action = verbAtStart(bullet.text)
      const base = action?.verb.tense === "ing" ? "" : (action?.verb.base ?? "")
      count = entry === previous && base && base === last ? count + 1 : 1
      previous = entry
      last = base
      if (!action || !base || count < SAME_START) continue
      const others = alternativesTo(action.verb)
      problems.push({
        place,
        message: `“${action.word}” starts ${count} nearby bullets`,
        suggestion: others.length
          ? `If they fit what you did, consider ${others.map((other) => `“${other}”`).join(", ")}.`
          : "Vary the verb if a different one fits what you did.",
      })
    }
    return { checked: bullets.length, problems }
  },
}

const pastTense: Rule = {
  id: "B7",
  advisory: true,
  category: "bullets",
  level: "look",
  reads: "form",
  title: "Past tense for what has ended",
  why: "The present tense says you still do it.",
  check: ({ resume, today }) => {
    const ended = new Map<Entry, boolean>()
    const endedYet = (entry: Entry) => {
      if (!ended.has(entry)) ended.set(entry, hasEnded(entry, today))
      return ended.get(entry)!
    }
    const bullets = bulletsIn(resume, ROLES).filter(({ entry }) => endedYet(entry))
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ bullet, place }) => {
        const action = verbAtStart(bullet.text)
        if (!action || action.verb.tense !== "present" || !action.verb.past) return []
        const { word, verb } = action
        return [
          {
            place,
            message: `“${word}” is present tense, but this has ended`,
            suggestion: `Try “${inTenseOf(verb.base, { ...verb, tense: "past" })}”.`,
          },
        ]
      }),
    }
  },
}

const descriptions: Rule = {
  id: "B8",
  category: "bullets",
  level: "look",
  reads: "form",
  title: "Descriptions explain your contribution",
  why: "Specific descriptions show what you did or made. A bullet count alone cannot tell that.",
  check: ({ resume, today }) => {
    const entries = [...ROLES, "Projects" as const].flatMap((section) => resume.sections[section]).filter((entry) => !entry.blank)
    if (entries.length === 0) return null
    return {
      checked: entries.length,
      problems: entries.flatMap((entry): Problem[] => {
        const field = SECTIONS[entry.section].fields.find((field) => field.type === "bullets")!.key
        const place = { kind: "entry" as const, section: entry.section, entry: entry.index, field }
        if (entry.bullets.length === 0) {
          // An older additional role can be listed briefly once another
          // role in its section describes the work.
          const peers = entries.filter((other) => other.section === entry.section)
          const additional = peers.indexOf(entry) > 0 && hasEnded(entry, today) && peers.some((other) => other.bullets.length > 0)
          return [
            {
              place,
              advisory: additional,
              message: "No description",
              suggestion: "Describe your contribution if this experience matters to the role you want.",
            },
          ]
        }
        const generic = entry.bullets.filter(({ text }) => isGenericBullet(text))
        const problems: Problem[] = generic.length
          ? [
              {
                place: { ...place, line: generic[0].line },
                // One vague bullet among specific ones is advice; half or more is a pattern.
                advisory: generic.length * 2 < entry.bullets.length,
                message: "Name the work more specifically",
                suggestion: "Which tools, reports or tasks? Say what you made or did and who it was for.",
              },
            ]
          : []
        // A recent job is what a recruiter reads first, so one specific bullet
        // there is too thin. Older jobs can be brief (above). Generic bullets
        // that already count (above) aren't counted twice.
        const specific = entry.bullets.length - generic.length
        const peers = entries.filter((other) => other.section === entry.section)
        const recent = entry.section === "Work" && (peers.indexOf(entry) === 0 || !hasEnded(entry, today))
        const genericCounts = generic.length * 2 >= entry.bullets.length
        if (resume.type !== "academic" && recent && !genericCounts && specific > 0 && specific < MIN_SPECIFIC_BULLETS) {
          problems.push({
            place,
            message: "Only one specific bullet",
            suggestion: "Add another bullet about what you did here, as recruiters read your most recent job first.",
          })
        }
        if (resume.type !== "academic" && entry.bullets.length > MAX_BULLETS) {
          problems.push({
            place,
            advisory: true,
            message: `${entry.bullets.length} bullets to review`,
            suggestion: "Keep the detail that matters to this application. Older or less relevant work can be shorter.",
          })
        }
        return problems
      }),
    }
  },
}

// A bullet as compared with others: lower case, without punctuation, but
// with the symbols that change what it says ("C++", "C#", "40%").
const comparable = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,;:!?"“”‘’'()[\]{}–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// How many letters two texts differ by (adding, removing or changing one),
// or `limit + 1` once it's more than `limit`.
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    // No row gets better than the best in the one above it.
    if (Math.min(...current) > limit) return limit + 1
    previous = current
  }
  return previous[b.length]
}

const repeated: Rule = {
  id: "B9",
  category: "bullets",
  level: "look",
  reads: "form",
  title: "No bullet twice",
  why: "A repeated bullet takes room and looks like a slip.",
  check: ({ resume }) => {
    const bullets = bulletsIn(resume)
    if (bullets.length < 2) return null
    const seen: { text: string; where: string }[] = []
    const problems: Problem[] = []
    for (const { bullet, place, entry } of bullets) {
      const text = comparable(bullet.text)
      if (!text) continue
      // A small edit may be an accidental copy, or genuinely different work.
      const limit = Math.floor(text.length / NEAR_DUPLICATE_LENGTH)
      let match: (typeof seen)[number] | undefined
      let closest = limit + 1
      for (const other of seen) {
        const difference = distance(text, other.text, limit)
        if (difference < closest) {
          match = other
          closest = difference
        }
        if (closest === 0) break
      }
      if (closest <= limit) {
        problems.push({
          place,
          message: closest === 0 ? "Same as another bullet" : "Almost the same as another bullet",
          advisory: closest !== 0,
          suggestion: `Compare with ${match!.where}. Keep both if they describe different work.`,
        })
      }
      seen.push({ text, where: `${SECTIONS[entry.section].title}, entry ${entry.index + 1}, bullet ${bullet.number}` })
    }
    return { checked: bullets.length, problems }
  },
}

export const BULLET_RULES: readonly Rule[] = [
  weakStarts,
  actionVerbs,
  scopeAndResults,
  pronouns,
  buzzwords,
  sameStart,
  pastTense,
  descriptions,
  repeated,
]
