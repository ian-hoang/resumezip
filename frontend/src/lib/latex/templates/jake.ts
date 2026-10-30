// Jake's Resume (https://github.com/jakegut/resume, MIT), which templates/jake.typ
// was ported from: its packages and its commands (\resumeSubheading,
// \resumeItem, ...), so it's familiar to anyone who has used it. Entries are
// laid out as jake.typ lays them out, which isn't always as Jake's own example
// is, and the page, text sizes and spaces follow Fine-tune.

import {
  bold,
  CHARIS,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  latex,
  links,
  paragraphs,
  projectHeader,
  runs,
  sectionsOf,
  signs,
  underline,
  underlined,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

const BAR = " $|$ "

const FALLBACKS: Fallbacks = {
  comment: `TeX Live 2023's New Computer Modern has no ₹ ₽ ₺ ₴ ₿, which newer ones
have, as the PDF's does. Where it lacks them, they print in Charis SIL, a
serif that has them all.`,
  fonts: [{ name: "NewCM10-Book", faces: false, someGreek: false }],
  families: [CHARIS],
  letters: [[signs("₹₽₺₴₿"), CHARIS]],
}

// Jake's Resume's preamble, with what lets it compile with XeLaTeX and
// LuaLaTeX too, Latin Modern, and geometry for the page Fine-tune sets rather
// than fullpage. Then a command for prose, which Jake's doesn't have: its
// \relax ends \item, so text starting with [ isn't read as \item's option.
const preamble = (units: Units, title: string, fallbacks: string) => `\\documentclass[${units.paper("letterpaper")},11pt]{article}

${ENGINES}
\\ifPDFTeX
  \\usepackage{lmodern}
  % Latin Modern has no bold small capitals, which the name is set in, so it
  % borrows the EC fonts' (cm-super), which match it.
  \\input{t1lmr.fd}
  \\DeclareFontShape{T1}{lmr}{bx}{sc}{<->ssub*cmr/bx/sc}{}
\\else
${fallbacks}  % XeLaTeX or LuaLaTeX: New Computer Modern, as resumezip's Jake's is set in.
  \\usepackage{newcomputermodern}
\\fi
\\usepackage[margin=${units.margin(0.5)}, left=${units.margin(0.4)}, right=${units.margin(0.4)}]{geometry}
\\usepackage{latexsym}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
${links(title)}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Text sizes and line spacing, as Fine-tune sets them
\\renewcommand{\\normalsize}{\\fontsize{${units.size(11)}}{${units.space(13.6)}}\\selectfont}
\\renewcommand{\\small}{\\fontsize{${units.size(10)}}{${units.space(12)}}\\selectfont}
\\renewcommand{\\large}{\\fontsize{${units.size(12)}}{${units.space(14)}}\\selectfont}
\\renewcommand{\\Huge}{\\fontsize{${units.size(24.88)}}{${units.space(30)}}\\selectfont}
\\normalsize

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-${units.size(4)}}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-${units.size(5)}}]
% titlesec's own spaces around a section title (3.5ex and 2.3ex), in points
\\titlespacing*{\\section}{0pt}{${units.gap(16.5)} plus ${units.gap(4.7)} minus ${units.gap(0.9)}}{${units.size(10.8)} plus ${units.size(0.9)}}

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-${units.space(2)}}}
  }
}

% A line with one part on the left and one on the right. Jake's uses
% tabular*, where a long left part runs into the right one; here it wraps.
\\newcolumntype{L}{>{\\raggedright\\arraybackslash}X}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-${units.space(2)}}\\item
    \\begin{tabularx}{0.97\\textwidth}[t]{L@{\\hspace{0.8em}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabularx}\\vspace{-${units.space(7)}}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabularx}{0.97\\textwidth}{L@{\\hspace{0.8em}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabularx}\\vspace{-${units.space(7)}}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabularx}{0.97\\textwidth}{L@{\\hspace{0.8em}}r}
      \\small#1 & #2 \\\\
    \\end{tabularx}\\vspace{-${units.space(7)}}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-${units.space(4)}}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-${units.space(5)}}}

% Paragraphs, as the summary's, in from the margin as entries are.
\\newcommand{\\resumeTextStart}{\\begin{itemize}[leftmargin=0.15in, label={}, parsep=0.6em]\\item\\relax}
\\newcommand{\\resumeTextEnd}{\\end{itemize}}
`

function body(data: TemplateData): string {
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const itemList = (items: string[]) => {
    if (!items.length) return
    add("      \\resumeItemListStart", ...items.map((item) => `        \\resumeItem{${item}}`), "      \\resumeItemListEnd")
  }
  const subheading = (topLeft: string, topRight: string, bottomLeft: string, bottomRight: string, items: string[]) => {
    add("    \\resumeSubheading", `      {${topLeft}}{${topRight}}`, `      {${bottomLeft}}{${bottomRight}}`)
    itemList(items)
  }
  const experience = (top: string, start: string, end: string, bottom: string, location: string, bullets: Run[][]) =>
    subheading(latex(top), latex(dateRange(start, end)), latex(bottom), latex(location), bullets.map(runs))
  const entries = (write: () => void) => {
    add("  \\resumeSubHeadingListStart")
    write()
    add("  \\resumeSubHeadingListEnd")
  }
  const text = (texts: Paragraph[]) => add("  \\resumeTextStart", paragraphs(texts), "  \\resumeTextEnd")
  const heading = (title: string) => add("", `\\section{${title}}`)

  const { profile } = data
  const contacts = [
    latex(profile.location),
    latex(profile.phone),
    profile.email && emailLink(profile.email, underline),
    profile.linkedin && webLink(profile.linkedin, underline),
    profile.website && webLink(profile.website, underline),
    profile.github && webLink(profile.github, underline),
  ].filter(Boolean)
  if (profile.name || contacts.length) {
    add("\\begin{center}")
    if (profile.name) add(`    \\textbf{\\Huge \\scshape ${latex(profile.name)}}${contacts.length ? " \\\\ \\vspace{1pt}" : ""}`)
    if (contacts.length) add(`    \\small ${contacts.join(`${BAR.trimEnd()}\n    `)}`)
    add("\\end{center}")
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
            itemList(extra.bullets.map(runs))
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
        entries(() => data.work.forEach((job) => experience(job.role, job.start, job.end, job.company, job.location, job.bullets)))
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
        // In from the margin as entries are.
        add(citations(data.publications, underlined, "labelindent=0.15in, itemsep=2pt, before=\\small"))
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
        entries(() => {
          for (const award of data.awards) {
            const organization = award.organization && `, ${latex(award.organization)}`
            add("    \\resumeProjectHeading", `      {${bold(latex(award.name))}${organization}}{${latex(award.date)}}`)
          }
        })
        break
    }
  }
  return lines.join("\n")
}

export const jake: LatexTemplate = {
  credit: ["Based on Jake's Resume: https://github.com/jakegut/resume", "Author: Jake Gutierrez", "License: MIT"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
