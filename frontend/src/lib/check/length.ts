// Length & layout (L1–L5 in issue #58): how the preview PDF fills its pages,
// and how each bullet wraps.

import type { Rule } from "./engine"
import { printedLayoutBullets } from "./pdf"
import { LONG_BULLET_LINES, MIN_PAGE_FULL, SHORT_LAST_LINE, SPILL_LINES } from "./settings"

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

// The words on a line, not counting stray punctuation.
const wordsOn = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length

const pages: Rule = {
  id: "L1",
  category: "length",
  level: "look",
  reads: "pdf",
  title: "One page, unless it's an academic CV",
  why: "Recruiters spend seconds on a resume; one page keeps the best of it in view.",
  check: ({ resume, pdf }) => {
    // An academic CV runs as long as it needs to.
    if (resume.type === "academic") return null
    const count = pdf.pages.length
    return {
      checked: 1,
      problems:
        count > 1
          ? [
              {
                place: { kind: "page", page: 2 },
                message: `${plural(count, "page")}`,
                // The page count, so a dismissal ends if the resume grows another page.
                text: plural(count, "page"),
                suggestion: "Cut what matters least to fit one page.",
              },
            ]
          : [],
    }
  },
}

const spill: Rule = {
  id: "L2",
  category: "length",
  level: "look",
  reads: "pdf",
  title: "No last page with only a few lines",
  why: "A few lines on a page of their own look like a mistake.",
  check: ({ pdf }) => {
    const last = pdf.pages.length
    if (last < 2) return null
    const lines = pdf.lines.filter((line) => line.page === last).length
    return {
      checked: 1,
      problems:
        lines <= SPILL_LINES
          ? [
              {
                place: { kind: "page", page: last },
                message: `Only ${plural(lines, "line")} on page ${last}`,
                suggestion: "Trim a little so it ends a page sooner, or fill out the last page.",
              },
            ]
          : [],
    }
  },
}

const shortLastLine: Rule = {
  id: "L3",
  category: "length",
  level: "look",
  reads: "pdf",
  title: "No bullet ending with a few words on a line of their own",
  why: "A short last line takes a whole line of space for a few words.",
  check: ({ resume, pdf }) => {
    const bullets = printedLayoutBullets(resume, pdf)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ place, printed }) => {
        const words = wordsOn(printed.lines[printed.lines.length - 1].text)
        if (printed.lines.length < 2 || words > SHORT_LAST_LINE) return []
        return [
          {
            place,
            message: `${words === 1 ? "One word" : `${words} words`} on its last line`,
            suggestion: "Trim a few words so it ends a line sooner, or add a detail to fill the line.",
          },
        ]
      }),
    }
  },
}

const longBullets: Rule = {
  id: "L4",
  category: "length",
  level: "look",
  reads: "pdf",
  title: "No bullet longer than two lines",
  why: "Long bullets get skimmed past.",
  check: ({ resume, pdf }) => {
    const bullets = printedLayoutBullets(resume, pdf)
    if (bullets.length === 0) return null
    return {
      checked: bullets.length,
      problems: bullets.flatMap(({ place, printed }) =>
        printed.lines.length >= LONG_BULLET_LINES
          ? [{ place, message: `Runs ${printed.lines.length} lines`, suggestion: "Split it in two, or cut it to two lines." }]
          : [],
      ),
    }
  },
}

const fullPage: Rule = {
  id: "L5",
  category: "length",
  level: "look",
  reads: "pdf",
  title: "A one-page resume fills its page",
  why: "A page that's mostly empty can read as thin.",
  check: ({ pdf }) => {
    if (pdf.pages.length !== 1) return null
    const bottoms = pdf.lines.flatMap((line) => (line.page === 1 && line.box ? [line.box[3]] : []))
    if (bottoms.length === 0) return null
    const full = Math.max(...bottoms) / pdf.pages[0].height
    return {
      checked: 1,
      problems:
        full < MIN_PAGE_FULL
          ? [
              {
                place: { kind: "page", page: 1 },
                message: `The page is ${Math.round(full * 100)}% full`,
                suggestion: "Add a project or more detail. Early on, a shorter page is fine.",
              },
            ]
          : [],
    }
  },
}

export const LENGTH_RULES: readonly Rule[] = [pages, spill, shortLastLine, longBullets, fullPage]
