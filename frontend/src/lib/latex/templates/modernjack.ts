// Modern Jake's (templates/modernjack.typ): Jake's Resume set in Lato, with a
// bold name and bold section titles. It keeps Jake's commands
// (\resumeSubheading, \resumeItem, ...), as the LaTeX template the .typ was
// ported from did, and sets them with modernjack.typ's sizes and spaces, as
// Fine-tune sets them.

import {
  bold,
  bp,
  CHARIS,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  latex,
  links,
  paragraphs,
  projectHeader,
  ROW,
  runs,
  sectionsOf,
  signs,
  underline,
  underlined,
  unlessPdfLatex,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

const BAR = " | "

// Typst measures a space from one line's baseline down to the next line's cap
// height, and sets a paragraph's lines `LEADING` apart that way; TeX measures
// both from baseline to baseline. So a line's \baselineskip here is Lato's cap
// height plus the leading, and a space above a line is the .typ's space less
// the leading, which \baselineskip adds back. Worked out with Fine-tune's
// multiples, so a tuned resume keeps the PDF's proportions too.
const CAP = 0.7165 // Lato's cap height, in em
const LEADING = 0.48 // modernjack.typ's leading, in em
// The rule under a section title: 0.4pt, drawn centred on its line in Typst.
const RULE = 0.4
// The space between words, as modernjack.typ pins Lato's.
const WORD_SPACE = "0.2275em"

const FALLBACKS: Fallbacks = {
  comment: `Lato has no ₽ or ₿, which print in Charis SIL, as in the PDF.`,
  fonts: [{ name: "Lato", faces: true, someGreek: false }],
  families: [CHARIS],
  letters: [[signs("₽₿"), CHARIS]],
}

/** The spaces that differ between Typst and TeX. */
function spacing(units: Units) {
  const points = (length: string) => parseFloat(length)
  const leading = (size: number) => points(units.space(size * LEADING))
  const line = (size: number) => points(units.size(size * CAP)) + leading(size)
  /** A space the .typ puts above a line of text `size` points tall. */
  const above = (space: string, size: number) => bp(points(space) - leading(size))
  return {
    line: (size: number) => bp(line(size)),
    above,
    // \resumeSubheading's second line is small, but both are lines of one
    // paragraph at the normal size, so its \baselineskip is the normal one.
    rows: bp(points(units.space(6.5)) + points(units.size(10 * CAP)) - line(11)),
    // titlesec ends a title with a strut, 0.3 of its line deep.
    titleToRule: bp(points(units.size(5)) - 0.3 * line(12) - RULE / 2),
    // What follows the rule is set as if after a line this deep, so it lands
    // where it does in the PDF, whatever its letters.
    afterRule: bp(leading(11) - points(units.size(5.5)) + RULE / 2),
    // A list section's bullets, right under the rule, where `afterRule` has
    // already taken off the normal size's leading rather than the small size's.
    bulletsAfterRule: bp(points(units.space(7.5)) - leading(10) + leading(11)),
  }
}

const preamble = (units: Units, title: string, fallbacks: string) => {
  const space = spacing(units)
  return `\\documentclass[${units.paper("letterpaper")},11pt]{article}

${ENGINES}
${unlessPdfLatex(fallbacks)}% Lato, with its tabular figures, as the PDF has them
\\usepackage[default]{lato}
% Words ${WORD_SPACE} apart at every size, as the PDF pins Lato's spaces
\\newcommand*{\\latospace}{\\spaceskip=${WORD_SPACE}\\relax}
\\usepackage[margin=${units.margin(0.5)}, left=${units.margin(0.4)}, right=${units.margin(0.4)}]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[english]{babel}
\\usepackage{tabularx}
${links(title)}

\\pagestyle{empty}
\\raggedbottom
\\raggedright
\\frenchspacing
% Lines break between words, never inside one.
\\hyphenpenalty=10000
\\setlength{\\parindent}{0pt}
\\setlength{\\tabcolsep}{0pt}
% A page's first line as high as the PDF's: its cap height below the margin, if it's no taller
\\setlength{\\topskip}{${units.size(10 * CAP)}}

% Text sizes and line spacing, as Fine-tune sets them
\\renewcommand{\\normalsize}{\\fontsize{${units.size(11)}}{${space.line(11)}}\\selectfont\\latospace}
\\renewcommand{\\small}{\\fontsize{${units.size(10)}}{${space.line(10)}}\\selectfont\\latospace}
\\renewcommand{\\large}{\\fontsize{${units.size(12)}}{${space.line(12)}}\\selectfont\\latospace}
\\renewcommand{\\Huge}{\\fontsize{${units.size(24.88)}}{${space.line(24.88)}}\\selectfont\\latospace}
\\normalsize

% Sections formatting: a bold title over a thin rule. \\prevdepth sets what
% follows from the rule, whatever its letters.
\\titleformat{\\section}{\\vspace{${space.above(units.gap(15), 12)}}\\large\\bfseries\\raggedright}{}{0em}{}
  [\\vspace{${space.titleToRule}}\\titlerule\\prevdepth=${space.afterRule}]
\\titlespacing*{\\section}{0pt}{0pt}{0pt}

%-------------------------
% Custom commands
${ROW}

\\newcommand{\\resumeSubheading}[4]{
  \\item
    \\resumeRow{\\textbf{#1}}{#2} \\\\*[${space.rows}]
    \\resumeRow{\\small\\textit{#3}}{\\small\\textit{#4}}%
}

\\newcommand{\\resumeProjectHeading}[2]{
  \\item
    \\resumeRow{\\small#1}{#2}%
}

\\newcommand{\\resumeAward}[2]{
  \\item
    \\resumeRow{#1}{#2}%
}

\\newcommand{\\resumeItem}[1]{\\item\\relax #1}

% Entries, in from the margin, [the space between them] apart
\\newcommand{\\resumeSubHeadingListStart}[1][${space.above(units.size(11), 11)}]{%
  \\begin{itemize}[leftmargin=0.15in, rightmargin=0.075in, label={}, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=#1]%
}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}

% Bullets, [the space above them] under what's above, and on its page. Small
% before the list starts, so its bullets are measured at the size they're printed.
\\newcommand{\\resumeItemListStart}[1][${space.above(units.space(7.5), 10)}]{%
  \\par\\nopagebreak\\vspace{#1}\\begingroup\\small
  \\begin{itemize}[label=\\textbullet, leftmargin=*, labelindent=17pt, labelsep=5pt, topsep=0pt, partopsep=0pt, parsep=0pt,
    beginpenalty=10000, itemsep=${space.above(units.space(6.6), 10)}]%
}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\endgroup}

% Paragraphs, as the summary's, 0.6em further apart than lines, in from the margin as entries are
\\newcommand{\\resumeTextStart}{%
  \\begin{itemize}[leftmargin=0.15in, rightmargin=0.075in, label={}, topsep=0pt, partopsep=0pt,
    parsep=${units.size(6.6)}]\\item\\relax
}
\\newcommand{\\resumeTextEnd}{\\end{itemize}}
`
}

function body(data: TemplateData, units: Units): string {
  const space = spacing(units)
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const itemList = (items: string[], above = "") => {
    if (!items.length) return
    add(`      \\resumeItemListStart${above}`, ...items.map((item) => `        \\resumeItem{${item}}`), "      \\resumeItemListEnd")
  }
  const subheading = (topLeft: string, topRight: string, bottomLeft: string, bottomRight: string, items: string[]) => {
    add("    \\resumeSubheading", `      {${topLeft}}{${topRight}}`, `      {${bottomLeft}}{${bottomRight}}`)
    itemList(items)
  }
  const experience = (top: string, start: string, end: string, bottom: string, location: string, bullets: Run[][]) =>
    subheading(latex(top), latex(dateRange(start, end)), latex(bottom), latex(location), bullets.map(runs))
  const entries = (write: () => void, gap = "") => {
    add(`  \\resumeSubHeadingListStart${gap}`)
    write()
    add("  \\resumeSubHeadingListEnd")
  }
  const text = (texts: Paragraph[]) => add("  \\resumeTextStart", paragraphs(texts), "  \\resumeTextEnd")
  const heading = (title: string) => add("", `\\section{${title}}`)

  const { profile } = data
  // A long line wraps between them, never inside one.
  const contacts = [
    profile.location && `\\mbox{${latex(profile.location)}}`,
    profile.phone && `\\mbox{${latex(profile.phone)}}`,
    profile.email && emailLink(profile.email, underline),
    profile.linkedin && webLink(profile.linkedin, underline),
    profile.website && webLink(profile.website, underline),
    profile.github && webLink(profile.github, underline),
  ].filter(Boolean)
  if (profile.name || contacts.length) {
    add("{\\centering")
    if (profile.name) add(`    {\\Huge\\bfseries ${latex(profile.name)}\\par}`)
    if (profile.name && contacts.length) {
      // From the name's baseline, whatever its letters, as the PDF measures it.
      add(`    \\prevdepth=0pt\\vspace{${space.above(units.size(6.5), 10)}}`)
    }
    if (contacts.length) add(`    \\small ${contacts.join(`${BAR.trimEnd()}\n    `)}`)
    add("\\par}", `\\vspace{${units.size(2)}}`)
  }

  if (data.summary.length) {
    heading("Summary")
    text(data.summary)
  }

  for (const section of sectionsOf(data)) {
    heading(section.heading)
    switch (section.kind) {
      case "extra": {
        const { extra } = section
        if (extra.kind === "text") text(extra.paragraphs)
        else
          entries(() => {
            add("    \\item")
            itemList(extra.bullets.map(runs), `[${space.bulletsAfterRule}]`)
          })
        break
      }
      case "education":
        entries(() => {
          for (const school of data.education) {
            const degree = [school.degree, school.gpa && `(GPA: ${school.gpa})`].filter(Boolean).join(" ")
            const items = [
              ["Relevant Coursework:", school.coursework],
              ["Involvements:", school.involvement],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => `${bold(label)} ${latex(value)}`)
            subheading(latex(school.school), latex(dateRange(school.start, school.end)), latex(degree), latex(school.location), items)
          }
        })
        break
      case "work":
        entries(() => data.work.forEach((job) => experience(job.company, job.start, job.end, job.role, job.location, job.bullets)))
        break
      case "leadership":
      case "volunteer": {
        const roles = data[section.kind]
        entries(() => roles.forEach((role) => experience(role.organization, role.start, role.end, role.role, role.location, role.bullets)))
        break
      }
      case "projects":
        entries(() => {
          for (const project of data.projects) {
            add(
              "    \\resumeProjectHeading",
              `      {${projectHeader(project, BAR, underlined)}}{${latex(dateRange(project.start, project.end))}}`,
            )
            itemList(project.bullets.map(runs))
          }
        })
        break
      case "publications":
        // In from the margin as entries are. Small before the list starts, so
        // its numbers are measured at the size they're printed.
        add(
          "  {\\small",
          citations(
            data.publications,
            underlined,
            `labelindent=0.15in, rightmargin=0.075in, labelsep=0.7em, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${space.above(units.space(6), 10)}`,
          ),
          "  }",
        )
        break
      case "skills":
        // Each line starts with a command or a brace, so \\ never reads it as its option.
        add(
          "  \\resumeTextStart\\small",
          data.skills
            .map((skill) => `    ${skill.name ? `${bold(latex(`${skill.name}:`))} ` : ""}{${latex(skill.details)}}`)
            .join(" \\\\\n"),
          "  \\resumeTextEnd",
        )
        break
      case "awards":
        entries(
          () => {
            for (const award of data.awards) {
              const organization = award.organization && `, ${latex(award.organization)}`
              add("    \\resumeAward", `      {${bold(latex(award.name))}${organization}}{${latex(award.date)}}`)
            }
          },
          `[${space.above(units.size(7), 11)}]`,
        )
        break
    }
  }
  return lines.join("\n")
}

export const modernjack: LatexTemplate = {
  credit: [
    "resumezip's Modern Jake's template: Jake's Resume set in Lato",
    "Based on Jake's Resume: https://github.com/jakegut/resume",
    "Author: Jake Gutierrez",
    "License: MIT",
  ],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
