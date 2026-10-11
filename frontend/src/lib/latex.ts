// The resume as a LaTeX file (.tex), to keep editing on Overleaf or with any
// TeX install. It's written in the style of Jake's Resume
// (https://github.com/jakegut/resume, MIT), which resumezip's Jake's template
// is drawn from: its packages and its commands (\resumeSubheading,
// \resumeItem, ...), so it's familiar to anyone who has used it. Like the Word
// file (lib/word.ts), every template gets this one layout, and the words come
// from toTemplateData, as the PDF's do: the headings and their order match,
// and what's left out of the PDF isn't in it either. Entries are laid out as
// templates/jake.typ lays them out, which isn't always as Jake's own example is.
//
// It compiles with pdfLaTeX, Overleaf's default. pdfLaTeX's fonts only have
// Latin letters, so a resume with others (Иван, Nguyễn) gets a file that asks
// for XeLaTeX, where New Computer Modern, the font Jake's PDF is set in,
// prints what the PDF prints. Every file works with both engines; iftex tells
// them apart.
//
// Unlike the PDF and the Word file, it doesn't carry its resume, so
// resumezip can't open it again.
//
// The editor downloads this module when LaTeX is first chosen.

import { SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Resume } from "@/lib/resume"
import { toTemplateData, type Run, type TemplateData } from "@/lib/typst/resumeData"

/** A LaTeX file's type, for a download. */
export const LATEX_TYPE = "application/x-tex"

export interface LatexFile {
  text: string
  /**
   * The letters in it pdfLaTeX can't print, in the order they first appear.
   * When there are any, the file says to compile it with XeLaTeX.
   */
  beyondPdfLatex: string[]
}

// What TeX reads as markup rather than text, as text that prints it.
const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  // Not markup, but XeLaTeX and LuaLaTeX print a straight " as a closing ”.
  '"': "\\textquotedbl{}",
}

// Control characters pasted text can bring, and half of an emoji (a surrogate
// without its pair), which nothing prints. Whole emoji are matched so they're
// kept. Zero-width spaces and joiners print nothing either, but pdfLaTeX would
// stop at them.
const UNPRINTABLE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF\0-\x08\x0B\x0C\x0E-\x1F\x7F\u200B\u2060\uFEFF]/g

// Pairs the fonts join into one mark ("--" is a dash, "''" a closing quote,
// "<<" a guillemet, "!`" is "¡"): a zero kern goes between the two, so they
// print as typed. An empty group would do in pdfLaTeX but not in XeLaTeX or
// LuaLaTeX. A lone ' and ` still print as curly quotes, as LaTeX writes them.
const LIGATURE = /([-'`<>,])(?=\1)|[!?](?=`)/g

/**
 * Text as LaTeX that prints it as typed. Line breaks are `lineBreak`; tabs
 * are spaces. Letters are composed (NFC), since pdfLaTeX can print "é" but not
 * "e" followed by a combining accent, as macOS sometimes types it.
 */
function latex(value: string, lineBreak = " "): string {
  return value
    .normalize("NFC")
    .replace(UNPRINTABLE, (match) => (match.length === 2 ? match : ""))
    .replace(/[\\{}&%$#_~^"]/g, (special) => SPECIAL[special])
    .replace(LIGATURE, "$&\\kern0pt ")
    .replace(/\t/g, " ")
    .replace(/\r\n?|\n/g, lineBreak)
}

// Prose keeps its line breaks, each line indented as the paragraph is.
// \newline rather than \\, which would read a line starting with [ or * as
// its own option.
const prose = (value: string) => latex(value, "\\newline\n    ")

/**
 * An address as hyperref reads it inside another command's argument, where %,
 * # and & still need a backslash. What can't be escaped there (a backslash,
 * braces, spaces) is percent-encoded.
 */
const address = (url: string) => url.replace(/[\\{}\s]/g, (character) => encodeURIComponent(character)).replace(/[%#&]/g, "\\$&")

/** The address a link goes to, or null for one that isn't an address, which is printed without a link. */
function linkTarget(url: string): string | null {
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

// Profile and project links are stored without "https://" (see resumeData.ts).
const web = (url: string) => `https://${url}`

/** `body` linked to `url`, or `body` alone when `url` isn't an address. */
const href = (url: string, body: string) => {
  const target = linkTarget(url)
  return target ? `\\href{${address(target)}}{${body}}` : body
}

/** A link printed as its own text, underlined, as Jake's contact line is; plain when it isn't an address. */
const shownLink = (url: string, text: string) => (linkTarget(url) ? href(url, `\\underline{${latex(text)}}`) : latex(text))

const bold = (body: string) => `\\textbf{${body}}`
const italic = (body: string) => `\\textit{${body}}`

/** A bullet's bold and italic stretches. */
const runs = (pieces: Run[]) =>
  pieces
    .map((piece) => {
      let out = latex(piece.text)
      if (piece.italic) out = italic(out)
      if (piece.bold) out = bold(out)
      return out
    })
    .join("")

/** "Start - End", or whichever of the two is present, as the templates print dates. */
const dateRange = (start: string, end: string) => (start && end ? `${start} - ${end}` : start + end)

/** Jake's separator between items on a line. */
const BAR = " $|$ "

/**
 * A publication as a citation, IEEE style, as the templates print it
 * (`citation` in templates/common.typ), with the resume owner's name in bold:
 *   R. Conde, J. Smith, and A. Lee, “Title of the paper,” Venue, details, date, doi: 10.1/x.
 */
function citation({ title, authors, venue, details, date, doi, link }: TemplateData["publications"][number]): string {
  // Each part, and the text it ends with, for the closing full stop.
  const rest: [string, string][] = []
  if (venue) rest.push([italic(latex(venue)), venue])
  if (details) rest.push([latex(details), details])
  if (date) rest.push([latex(date), date])
  if (doi) rest.push([`doi: ${shownLink(`https://doi.org/${doi}`, doi)}`, doi])
  else if (link) rest.push([shownLink(web(link), link), link])

  // Names and what's between them are escaped together, up to the owner's,
  // so a pair split between two of them still prints as typed.
  let out = ""
  let others = ""
  for (const piece of authors) {
    if (!piece.me) others += piece.text
    else {
      out += latex(others) + bold(latex(piece.text))
      others = ""
    }
  }
  out += latex(others)
  if (title) {
    if (authors.length) out += ", "
    // The comma after the title, or the closing full stop, goes inside the quotes.
    const mark = /[.?!]$/.test(title) ? "" : rest.length ? "," : "."
    out += `“${latex(title)}${mark}”${rest.length ? " " : ""}`
  } else if (authors.length && rest.length) {
    out += ", "
  }
  if (rest.length) {
    out += rest.map(([part]) => part).join(", ")
    if (!rest.at(-1)![1].endsWith(".")) out += "."
  }
  return out
}

/** Where each section's entries and heading are in TemplateData. */
const SECTION_KEYS: Record<SectionName, keyof TemplateData["headings"]> = {
  Education: "education",
  Work: "work",
  Projects: "projects",
  Publications: "publications",
  Skills: "skills",
  Leadership: "leadership",
  Volunteership: "volunteer",
  Awards: "awards",
}

/** The document between \begin{document} and \end{document}, as lines. */
function body(data: TemplateData): string[] {
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
  const paragraphs = (texts: string[]) =>
    add("  \\resumeTextStart", texts.map((text) => `    ${prose(text)}`).join("\n\n"), "  \\resumeTextEnd")

  const { profile, headings } = data
  const contacts = [
    latex(profile.location),
    latex(profile.phone),
    profile.email && shownLink(`mailto:${profile.email}`, profile.email),
    profile.linkedin && shownLink(web(profile.linkedin), profile.linkedin),
    profile.website && shownLink(web(profile.website), profile.website),
    profile.github && shownLink(web(profile.github), profile.github),
  ].filter(Boolean)
  if (profile.name || contacts.length) {
    add("\\begin{center}")
    if (profile.name) add(`    \\textbf{\\Huge \\scshape ${latex(profile.name)}}${contacts.length ? " \\\\ \\vspace{1pt}" : ""}`)
    if (contacts.length) add(`    \\small ${contacts.join(`${BAR.trimEnd()}\n    `)}`)
    add("\\end{center}")
  }

  const section = (heading: string) => add("", `\\section{${latex(heading)}}`)

  if (data.summary.length) {
    section("Summary")
    paragraphs(data.summary)
  }

  for (const name of data.order) {
    const extra = data.extras[name]
    if (extra) {
      section(extra.heading)
      if (extra.kind === "text") paragraphs(extra.paragraphs)
      else
        entries(() => {
          add("    \\item")
          itemList(extra.bullets.map(runs))
        })
      continue
    }
    const key = SECTION_KEYS[name as SectionName]
    if (!key || data[key].length === 0) continue
    // The heading the person wrote, or the one every template prints.
    section(headings[key] || SECTIONS[name as SectionName].title)
    switch (key) {
      case "education":
        entries(() => {
          for (const school of data.education) {
            const degree = [school.degree, school.gpa && `(GPA: ${school.gpa})`].filter(Boolean).join(" ")
            const items = [
              ["Relevant Coursework:", school.coursework],
              ["Involvements:", school.involvement],
            ]
              .filter(([, text]) => text)
              .map(([label, text]) => `${bold(label)} ${latex(text)}`)
            subheading(latex(school.school), latex(dateRange(school.start, school.end)), latex(degree), latex(school.location), items)
          }
        })
        break
      case "work":
        entries(() => data.work.forEach((job) => experience(job.role, job.start, job.end, job.company, job.location, job.bullets)))
        break
      case "leadership":
      case "volunteer":
        entries(() =>
          data[key].forEach((role) => experience(role.organization, role.start, role.end, role.role, role.location, role.bullets)),
        )
        break
      case "projects":
        entries(() => {
          for (const project of data.projects) {
            const parts: string[] = []
            if (project.name) parts.push(bold(project.link ? href(web(project.link), latex(project.name)) : latex(project.name)))
            if (project.techStack) parts.push(`\\emph{${latex(project.techStack)}}`)
            for (const url of project.links) parts.push(shownLink(web(url), url))
            add("    \\resumeProjectHeading", `      {${parts.join(BAR)}}{${latex(project.date)}}`)
            itemList(project.bullets.map(runs))
          }
        })
        break
      case "publications":
        // Numbered [1], [2], ..., each hanging under its number, in from the margin as entries are.
        add(
          `  \\begin{enumerate}[label={[\\arabic*]}, widest=${data.publications.length}, align=left, labelindent=0.15in, leftmargin=*, itemsep=2pt]`,
          "    \\small",
          // \item would read a citation starting with [ as its label.
          ...data.publications.map((publication) => `    \\item ${citation(publication).replace(/^\[/, "{}[")}`),
          "  \\end{enumerate}",
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
        entries(() => {
          for (const award of data.awards) {
            const organization = award.organization && `, ${latex(award.organization)}`
            add("    \\resumeProjectHeading", `      {${bold(latex(award.name))}${organization}}{${latex(award.date)}}`)
          }
        })
        break
    }
  }
  return lines
}

// What pdfLaTeX printed, character by character, with T1 and Latin Modern in
// TeX Live 2023; Overleaf's is newer and prints at least as much. Everything
// else stops it with "Unicode character ... not set up for use with LaTeX".
// prettier-ignore
const PDFLATEX_PRINTS = new RegExp(
  "[\\n\\x20-\\x7E\\u00A0-\\u0125\\u0128-\\u0137\\u0139-\\u013E\\u0141-\\u0148\\u014A-\\u0165\\u0168-\\u017E\\u0192" +
  "\\u01C4-\\u01D4\\u01E2\\u01E3\\u01E6-\\u01EB\\u01F0\\u01F4\\u01F5\\u0218-\\u021B\\u0232\\u0233\\u0237\\u02C6\\u02C7" +
  "\\u02D8\\u02D9\\u02DB-\\u02DD\\u1E02\\u1E03\\u1E0D\\u1E1E-\\u1E21\\u1E25\\u1E30\\u1E31\\u1E37\\u1E43\\u1E45\\u1E47" +
  "\\u1E5B\\u1E63\\u1E6D\\u1E8E-\\u1E91\\u1E9E\\u1EF2\\u1EF3\\u200C\\u2010-\\u2016\\u2018-\\u201A\\u201C-\\u201E" +
  "\\u2020-\\u2022\\u2026\\u2030\\u2031\\u2039-\\u203B\\u203D\\u2044\\u204E\\u2052\\u20A1\\u20A4\\u20A6\\u20A9" +
  "\\u20AB\\u20AC\\u20B1\\u2103\\u2116\\u2117\\u211E\\u2120\\u2122\\u2126\\u2127\\u212E\\u2190-\\u2193\\u2329\\u232A" +
  "\\u25E6\\u25EF\\u266A\\uFB00-\\uFB06]",
  "u",
)

/** The letters in `text` pdfLaTeX can't print, each once, in the order they first appear. */
const beyondPdfLatex = (text: string) => [...new Set([...text].filter((character) => !PDFLATEX_PRINTS.test(character)))]

// How many of them the file's first lines name.
const NAMED = 10

// Jake's Resume's preamble, with what lets it compile with XeLaTeX and
// LuaLaTeX too, and Latin Modern with T1, so pdfLaTeX prints accents, <, >
// and | as typed. Then a command for prose, which Jake's doesn't have: its
// \relax ends \item, so text starting with [ isn't read as \item's option.
const preamble = (paper: string, title: string) => `\\documentclass[${paper},11pt]{article}

\\usepackage{iftex}
\\ifPDFTeX
  \\usepackage[T1]{fontenc}
  \\usepackage{lmodern}
\\else
  % XeLaTeX or LuaLaTeX: New Computer Modern, as resumezip's Jake's is set in.
  \\usepackage{newcomputermodern}
\\fi
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\ifPDFTeX
  \\input{glyphtounicode}
\\fi

\\hypersetup{pdftitle={${title}}}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generated pdf is machine readable/ATS parsable
\\ifPDFTeX
  \\pdfgentounicode=1
\\fi

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

% A line with one part on the left and one on the right. Jake's uses
% tabular*, where a long left part runs into the right one; here it wraps.
\\newcolumntype{L}{>{\\raggedright\\arraybackslash}X}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabularx}{0.97\\textwidth}[t]{L@{\\hspace{0.8em}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabularx}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabularx}{0.97\\textwidth}{L@{\\hspace{0.8em}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabularx}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabularx}{0.97\\textwidth}{L@{\\hspace{0.8em}}r}
      \\small#1 & #2 \\\\
    \\end{tabularx}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

% Paragraphs, as the summary's, in from the margin as entries are.
\\newcommand{\\resumeTextStart}{\\begin{itemize}[leftmargin=0.15in, label={}, parsep=0.6em]\\item\\relax}
\\newcommand{\\resumeTextEnd}{\\end{itemize}}
`

/** The resume as a LaTeX file, in the style of Jake's Resume. */
export function toLatexFile(resume: Resume): LatexFile {
  const data = toTemplateData(resume)
  const lines = body(data)
  // An empty resume is an empty page, as its PDF is, rather than no PDF at all.
  const document = lines.length ? lines.join("\n") : "\\mbox{}"
  const paper = data.tune.paper === "a4" ? "a4paper" : "letterpaper"
  const title = latex(data.profile.name || "Resume")
  const letters = beyondPdfLatex(document + title)

  const named = letters.slice(0, NAMED).join(" ") + (letters.length > NAMED ? " ..." : "")
  // Editors that read the first line (TeXShop, TeXworks, VS Code) switch to
  // XeLaTeX by themselves; Overleaf doesn't, so pdfLaTeX stops first with
  // what to do, before an error for each letter.
  const head = letters.length
    ? `% !TeX program = xelatex
% This resume has letters pdfLaTeX can't print: ${named}
% Compile it with XeLaTeX. On Overleaf, set Compiler to XeLaTeX in the project's settings.
`
    : ""
  const stop = letters.length
    ? `
\\ifPDFTeX
  \\PackageError{resume}{This resume has letters pdfLaTeX can't print. Compile it with XeLaTeX}{On Overleaf, set Compiler to XeLaTeX in the project's settings.}
\\fi
`
    : ""

  const text = `${head}%-------------------------
% Resume in LaTeX, from resumezip
% Based on Jake's Resume: https://github.com/jakegut/resume
% Author: Jake Gutierrez
% License: MIT
%-------------------------

${preamble(paper, title)}${stop}
%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

${document}

\\end{document}
`
  return { text, beyondPdfLatex: letters }
}
