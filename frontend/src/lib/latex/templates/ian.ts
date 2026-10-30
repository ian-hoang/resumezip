// resumezip's Ian's (templates/ian.typ): Lato with blue headings over thin
// blue rules, narrow margins, entries with the organization and dates in bold
// over the role and place in italics.
//
// ian.typ stacks its lines by hand: each gap runs from one line's baseline to
// the top of the next one's capitals, and lines in a paragraph are `LEADING`
// apart that way. TeX measures from baseline to baseline. So each line's
// \baselineskip is the leading plus its capitals' height, and each part that
// starts a new line (an entry, a list, a paragraph) first takes back the
// leading above it, which ian.typ's gaps don't count.

import type { Paragraph, TemplateData } from "@/lib/typst/resumeData"
import {
  bold,
  CHARIS,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  itemText,
  joinPresent,
  latex,
  links,
  paragraphs,
  projectHeader,
  ROW,
  runs,
  sectionsOf,
  shownLink,
  signs,
  sum,
  unlessPdfLatex,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Section,
  type ShowLink,
  type Units,
} from "../common"

// Space between lines, in points, as ian.typ's `leading`: the same at every text size.
const LEADING = 4.78
// Lato's capitals, in em: where ian.typ's lines start. A line with bold in
// it starts at the bold's, which are a little taller.
const CAP = 0.7165
const BOLD_CAP = 0.723
// The text size, in points.
const BASE = 9.96
// The space between words, as ian.typ pins Lato's.
const WORD_SPACE = "0.2125em"

const FALLBACKS: Fallbacks = {
  comment: `Lato has no ₽ or ₿, which print in Charis SIL, as in the PDF.`,
  fonts: [{ name: "Lato", faces: true, someGreek: false }],
  families: [CHARIS],
  letters: [[signs("₽₿"), CHARIS]],
}

/** Fine-tune's lengths in bp, the leading above a line, and the \baselineskip of text this size. */
function lengthsOf(units: Units) {
  const lead = units.space(LEADING)
  const pitch = (pt: number, cap = CAP) => sum(lead, units.size(cap * pt))
  return { size: units.size, space: units.space, gap: units.gap, lead, pitch }
}

const underline = (body: string) => `\\resumeUnderline{${body}}`
/** A link printed as its own text, underlined, as ian.typ's are. */
const underlined: ShowLink = (url, text) => shownLink(url, text, underline)

/** "Start – End", with an en dash, as ian.typ's `dates`. */
const dates = (start: string, end: string) => dateRange(latex(start), latex(end), " \\textendash{} ")

const preamble = (units: Units, title: string, fallbacks: string) => {
  const { size, space, gap, lead, pitch } = lengthsOf(units)
  const font = (pt: number, cap = CAP) => `\\fontsize{${size(pt)}}{${pitch(pt, cap)}}\\selectfont\\latospace`
  // How much further a line in bold this size starts above its baseline than regular text does.
  const bolder = (pt: number) => sum(size(BOLD_CAP * pt), "-" + size(CAP * BASE))
  // The space under a section's rule, before what comes next.
  const after = size(5.58)

  return `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${unlessPdfLatex(fallbacks)}\\usepackage[default]{lato}
% Words ${WORD_SPACE} apart at every size, as the PDF pins Lato's spaces
\\newcommand*{\\latospace}{\\spaceskip=${WORD_SPACE}\\relax}
\\usepackage[left=${units.margin(0.35)}, right=${units.margin(0.35)}, top=${units.margin(0.5)}, bottom=${units.margin(0.35)}]{geometry}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{tabularx}
${links(title)}

\\definecolor{titleblue}{RGB}{10,90,160}

% Text size and line spacing, as Fine-tune sets them. Lengths are in bp,
% the PDF's points: TeX's pt is a little smaller.
\\renewcommand{\\normalsize}{${font(BASE)}}
\\normalsize

\\pagestyle{empty}
\\raggedright
\\setlength{\\parindent}{0pt}
% A page's first line sits its capitals' height under the top margin
\\setlength{\\topskip}{${size(CAP * BASE)}}
% Words aren't broken at the end of a line, as in the PDF
\\hyphenpenalty=10000
% Lines too tall to sit their usual distance apart touch rather than sit 1pt apart
\\setlength{\\lineskip}{0pt}

${ROW}

%-------------------------
% Custom commands

% Links are underlined 2bp under the baseline, through the letters' tails
\\newcommand{\\resumeUnderline}[1]{\\setbox0\\hbox{#1}\\rlap{\\rule[-${sum(size(2), "0.2bp")}]{\\wd0}{0.4bp}}\\box0}

% The name, its baseline its capitals' height under the top margin, then the
% contact line, a fixed distance under it. An empty box at the top, and no
% minimum space between lines, keep them where they are however tall or deep
% the name's letters are.
\\newcommand{\\resumeName}[1]{%
  \\hbox{}\\vspace{${sum("-" + lead, "-" + size(CAP * BASE))}}%
  {${font(24.79, BOLD_CAP)}\\setlength{\\lineskiplimit}{-\\maxdimen}\\centering\\textbf{\\textcolor{titleblue}{#1}}\\par}%
  \\vspace{${size(3.1)}}%
}
\\newcommand{\\resumeContacts}[1]{%
  \\vspace{${sum(size(11.06), "-" + size(3.1), "-" + lead)}}%
  {\\setlength{\\lineskiplimit}{-\\maxdimen}\\centering\\ignorespaces #1\\par}%
  \\vspace{${size(3.1)}}%
}
\\newcommand{\\contactSep}{\\hspace{0.6em}\\textbar\\hspace{0.5em}}

% A section: its title in blue, over a thin blue rule ${size(4.4)} under its baseline
% however deep its letters go. The option is the space under the rule.
\\newcommand{\\resumeSection}[2][${after}]{%
  \\par\\vspace{${sum(gap(13.73), "-" + lead)}}%
  {${font(11.96, BOLD_CAP)}\\textbf{\\textcolor{titleblue}{#2}}\\par}%
  \\nopagebreak\\vspace{\\dimexpr ${sum(size(4.4), "-0.2bp")}-\\prevdepth\\relax}%
  {\\color{titleblue}\\hrule height 0.2bp depth 0.2bp}%
  \\prevdepth=0.2bp
  \\nopagebreak\\vspace{#1}%
}

% An entry: the organization and its dates in bold, then the role and its
% place in italics. The first line's larger size is set inside its row, so
% both rows are as tall as a line of text and sit their usual distance apart.
\\newcommand{\\resumeEntryTop}[2]{%
  \\par\\vspace{${sum("-" + lead, bolder(10.91))}}%
  \\resumeRow{${font(10.91)}\\textbf{#1}}{${font(10.91)}\\textbf{#2}}\\par\\nopagebreak
}
\\newcommand{\\resumeEntry}[4]{%
  \\resumeEntryTop{#1}{#2}%
  \\vspace{${sum(space(6.46), "-" + lead)}}%
  \\resumeRow{\\textit{#3}}{\\textit{#4}}\\par\\nopagebreak
}
% A line with a name in bold and something on the right: a project's first line, or an award
\\newcommand{\\resumeLine}[2]{%
  \\par\\vspace{${sum("-" + lead, bolder(BASE))}}%
  \\resumeRow{#1}{#2}\\par
}
\\newcommand{\\resumeProject}[2]{\\resumeLine{#1}{\\textbf{#2}}\\nopagebreak}
\\newcommand{\\resumeAward}[2]{\\resumeLine{#1}{\\textit{#2}}}

\\newcommand{\\resumeEntryGap}{\\vspace{${size(7.78)}}}
\\newcommand{\\resumeProjectGap}{\\vspace{${size(10.46)}}}
\\newcommand{\\resumeAwardGap}{\\vspace{${space(4.78)}}}

% Bullets: a small dot 14.7bp in, raised so the top of its capitals would be level with
% the text's, and the text 5bp after it
\\SetEnumitemKey{bullets}{label={\\raisebox{${size(CAP * (BASE - 7.5))}}{${font(7.5)}\\textbullet}}, leftmargin=*, labelindent=14.7bp,
  labelsep=5bp, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${sum(space(5.21), "-" + lead)}}
\\newlist{resumeItems}{itemize}{1}
\\setlist[resumeItems]{bullets, before=\\vspace{${sum(space(5.66), "-" + lead)}}}
% A project's bullets are a little closer to its first line
\\newlist{projectItems}{itemize}{1}
\\setlist[projectItems]{bullets, before=\\vspace{${sum(space(5.26), "-" + lead)}}}

% Paragraphs, as the summary's, 0.6em further apart than lines. The first one gets \\parskip too, so it's taken back.
\\newenvironment{resumeText}{%
  \\par\\vspace{-${lead}}%
  \\setlength{\\parskip}{${size(0.6 * BASE)}}\\vspace{-\\parskip}%
}{\\par}
`
}

// The space under a section's rule, where it isn't the usual 5.58pt: it differs with what comes next, as in ian.typ.
const AFTER: Partial<Record<Section["kind"], number>> = { projects: 8.36, publications: 6.06, skills: 6.06, awards: 6.06 }

function body(data: TemplateData, units: Units): string {
  const { size, space, lead } = lengthsOf(units)
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const items = (bullets: string[], list = "resumeItems", indent = "    ") => {
    if (!bullets.length) return
    add(`${indent}\\begin{${list}}`, ...bullets.map((bullet) => `${indent}  \\item ${itemText(bullet)}`), `${indent}\\end{${list}}`)
  }
  // Entries, `gap` between them.
  const entries = <T>(list: T[], write: (item: T) => void, gap = "\\resumeEntryGap") =>
    list.forEach((item, index) => {
      if (index) add(`  ${gap}`)
      write(item)
    })
  // Each part already LaTeX.
  const entry = (organization: string, when: string, role: string, place: string, bullets: string[]) => {
    if (role || place) add(`  \\resumeEntry{${organization}}{${when}}{${role}}{${place}}`)
    else add(`  \\resumeEntryTop{${organization}}{${when}}`)
    items(bullets)
  }
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  const heading = (title: string, after?: number) => add("", `\\resumeSection${after ? `[${size(after)}]` : ""}{${title}}`)

  const { profile } = data
  const contacts = [
    latex(profile.location),
    latex(profile.phone),
    profile.email && emailLink(profile.email, underline),
    profile.github && webLink(profile.github, underline),
    profile.linkedin && webLink(profile.linkedin, underline),
    profile.website && webLink(profile.website, underline),
  ].filter(Boolean)
  if (profile.name) add(`\\resumeName{${latex(profile.name)}}`)
  // Each item kept whole, a line breaking between them.
  if (contacts.length) add("\\resumeContacts{", contacts.map((contact) => `  \\mbox{${contact}}`).join("\\contactSep\n"), "}")

  if (data.summary.length) {
    heading("Summary")
    text(data.summary)
  }

  for (const section of sectionsOf(data)) {
    heading(section.heading, AFTER[section.kind])
    switch (section.kind) {
      case "extra": {
        const { extra } = section
        if (extra.kind === "text") text(extra.paragraphs)
        else items(extra.bullets.map(runs), "resumeItems", "  ")
        break
      }
      case "education":
        entries(data.education, (school) => {
          const bullets = [
            school.coursework && `${bold("Relevant Coursework:")} ${latex(school.coursework)}`,
            school.involvement && `${bold("Involvement:")} ${latex(school.involvement)}`,
          ].filter(Boolean)
          const place = joinPresent(" | ", latex(school.location), school.gpa && `GPA: ${latex(school.gpa)}`)
          entry(latex(school.school), dates(school.start, school.end), latex(school.degree), place, bullets)
        })
        break
      case "work":
        entries(data.work, (job) =>
          entry(latex(job.company), dates(job.start, job.end), latex(job.role), latex(job.location), job.bullets.map(runs)),
        )
        break
      case "leadership":
      case "volunteer":
        entries(data[section.kind], (role) =>
          entry(latex(role.organization), dates(role.start, role.end), latex(role.role), latex(role.location), role.bullets.map(runs)),
        )
        break
      case "projects":
        entries(
          data.projects,
          (project) => {
            add(`  \\resumeProject{${projectHeader(project, " | ", underlined)}}{${dates(project.start, project.end)}}`)
            items(project.bullets.map(runs), "projectItems")
          },
          "\\resumeProjectGap",
        )
        break
      case "publications":
        add(
          citations(
            data.publications,
            underlined,
            `labelindent=0pt, labelsep=0.7em, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${sum(space(5.26), "-" + lead)}, before=\\vspace{-${lead}}`,
          ),
        )
        break
      case "skills":
        // \newline, unlike \\, never reads a line starting with [ as its option.
        add(
          "  \\begin{resumeText}",
          data.skills.map((skill) => `    ${skill.name ? `${bold(latex(skill.name))}: ` : ""}${latex(skill.details)}`).join("\\newline\n"),
          "  \\end{resumeText}",
        )
        break
      case "awards":
        data.awards.forEach((award, index) => {
          if (index) add("  \\resumeAwardGap")
          const organization = award.organization && `, ${latex(award.organization)}`
          add(`  \\resumeAward{${bold(latex(award.name))}${organization}}{${latex(award.date)}}`)
        })
        break
    }
  }
  return lines.join("\n")
}

export const ian: LatexTemplate = {
  credit: ["resumezip's Ian's template, after Ian Hoang's own resume"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
