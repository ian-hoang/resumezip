// templates/referme.typ ("Compact") as LaTeX: TeX Gyre Heros, headings in
// bold capitals over a thin rule, "Organization, Place: Role" lines with the
// dates flush right, and justified text. Every space is the .typ's: a Typst
// v(x) puts the next line's capitals x below the line above, which here is x
// less the leading, since \baselineskip is cap height plus leading.

import {
  bold,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  HEROS_FALLBACKS,
  italic,
  itemText,
  joinPresent,
  latex,
  links,
  minus,
  paragraphs,
  projectName,
  runs,
  sectionsOf,
  shownLink,
  sum,
  texGyre,
  UNBROKEN_ROW,
  webLink,
  type LatexTemplate,
  type ShowLink,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

const underline = (body: string) => `\\resumeUnderline{${body}}`
/** A link printed as its own text, underlined, as the .typ's `ul`. */
const underlined: ShowLink = (url, text) => shownLink(url, text, underline)

function preamble(units: Units, title: string, fallbacks: string): string {
  // TeX Gyre Heros's cap height is 0.729em: the .typ measures each space to a line's capitals.
  const leading = units.space(4.71)
  const line = (size: number) => sum(units.size(size * 0.729), leading)
  return `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${texGyre("heros", fallbacks)}
\\usepackage[margin=${units.margin(0.5)}]{geometry}
\\usepackage{enumitem}
${links(title)}

\\pagestyle{empty}
\\raggedbottom
\\frenchspacing
% Lines stretch further, as the PDF's do, rather than run into the margin.
\\setlength{\\emergencystretch}{3em}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

% Text sizes and line spacing, as Fine-tune sets them
\\renewcommand{\\normalsize}{\\fontsize{${units.size(10)}}{${line(10)}}\\selectfont}
\\normalsize
\\setlength{\\topskip}{${units.size(7.29)}}
\\newcommand{\\resumeNameFont}{\\fontsize{${units.size(20.74)}}{${line(20.74)}}\\selectfont\\bfseries}
\\newcommand{\\resumeHeadingFont}{\\fontsize{${units.size(12)}}{${line(12)}}\\selectfont\\bfseries}

% Lists start and end flush with the text around them, and stay with what's above them.
\\setlist{topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=0pt, beginpenalty=10000}

%-------------------------
% Custom commands

% The name, and the contact line under it
\\newenvironment{resumeHeader}{\\centering\\lineskiplimit=-\\maxdimen}{\\par\\vspace{${units.size(1.1)}}}
% An empty box takes the page's first line, so the name's capitals sit at the
% top margin however tall its accents are.
\\newcommand{\\resumeName}[1]{\\hbox{}\\vspace{${minus(line(10))}}{\\resumeNameFont #1\\par}}
\\newcommand{\\resumeContacts}[1]{#1\\par}

% A link, underlined ${units.size(3)} under its baseline. It never breaks across lines.
\\newsavebox{\\resumeLinkBox}
\\newcommand{\\resumeUnderline}[1]{%
  \\sbox{\\resumeLinkBox}{#1}%
  \\rlap{\\rule[${minus(sum(units.size(3), "0.2pt"))}]{\\wd\\resumeLinkBox}{0.4pt}}\\usebox{\\resumeLinkBox}%
}

% A heading in bold capitals over a thin rule, kept with what follows it.
\\newcommand{\\resumeSection}[1]{%
  \\par\\vspace{${sum(units.gap(20.1), minus(leading))}}%
  {\\resumeHeadingFont\\MakeUppercase{#1}\\par}%
  \\nobreak\\vskip\\dimexpr${sum(units.size(4.05), "-0.2pt")}-\\prevdepth\\relax
  \\hrule height 0.4pt\\relax
  % The next line's capitals sit ${units.size(4.7)} under the rule.
  \\nobreak\\prevdepth=${sum("0.2pt", leading, minus(units.size(4.7)))}
}

${UNBROKEN_ROW}

% A project's tech stack and links, under its name
\\newcommand{\\resumeDetails}[1]{\\nobreak{\\raggedright #1\\par}}

% Bullets, kept with the line above them
\\newenvironment{resumeItems}{%
  \\nobreak\\vspace{${sum(units.space(5.8), minus(leading))}}%
  \\begin{itemize}[label=\\textbullet, align=left, labelindent=11.1pt, labelsep=5.2pt, leftmargin=*]%
}{\\end{itemize}}

% Paragraphs, as the summary's
\\newenvironment{resumeText}{\\begin{itemize}[label={}, leftmargin=0pt, labelwidth=0pt, labelsep=0pt, parsep=0.6em]\\item\\relax}{\\end{itemize}}

% The space between entries, and between schools
\\newcommand{\\resumeEntryGap}{\\vspace{${sum(units.size(6.8), minus(leading))}}}
\\newcommand{\\resumeSchoolGap}{\\vspace{${sum(units.space(5.71), minus(leading))}}}
`
}

function body(data: TemplateData, units: Units): string {
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)
  const leading = units.space(4.71)

  // Bold or italic text, or nothing when there's none.
  const strong = (text: string) => (text ? bold(latex(text)) : "")
  const emph = (text: string) => (text ? italic(latex(text)) : "")

  const row = (left: string, right: string) => {
    if (left || right) add(`  \\resumeRow{${left}}{${right}}`)
  }
  const bullets = (items: Run[][]) => {
    if (items.length) add("  \\begin{resumeItems}", ...items.map((item) => `    \\item ${itemText(runs(item))}`), "  \\end{resumeItems}")
  }
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  // "Organization, Place: Role" and the dates, then bullets: work, leadership and volunteering.
  const experience = (entries: { organization: string; location: string; role: string; start: string; end: string; bullets: Run[][] }[]) =>
    entries.forEach((entry, index) => {
      if (index) add("  \\resumeEntryGap")
      const place = joinPresent(", ", entry.organization, entry.location)
      row(joinPresent(" ", place && bold(`${latex(place)}:`), emph(entry.role)), emph(dateRange(entry.start, entry.end)))
      bullets(entry.bullets)
    })
  const heading = (title: string) => add("", `\\resumeSection{${title}}`)

  const { profile } = data
  const contacts = [
    profile.location && `\\mbox{${latex(profile.location)}}`,
    profile.phone && `\\mbox{${latex(profile.phone)}}`,
    profile.email && emailLink(profile.email, underline),
    profile.linkedin && webLink(profile.linkedin, underline),
    profile.website && webLink(profile.website, underline),
    profile.github && webLink(profile.github, underline),
  ].filter(Boolean)
  add("\\begin{resumeHeader}")
  if (profile.name) add(`  \\resumeName{${latex(profile.name)}}`)
  if (contacts.length) add("  \\resumeContacts{", `    ${contacts.join(" \\textbullet{}\n    ")}`, "  }")
  add("\\end{resumeHeader}")

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
        else {
          // The bullets' space adds to the heading's. Each space here is less
          // the leading of the line it comes before, and there's one line.
          add(`  \\vspace{${leading}}`)
          bullets(extra.bullets)
        }
        break
      }
      case "education":
        data.education.forEach((school, index) => {
          if (index) add("  \\resumeSchoolGap")
          const dates = dateRange(school.start, school.end)
          row(strong(school.degree), strong(dates))
          row(emph(joinPresent(", ", school.school, school.location)), school.gpa ? emph(`GPA: ${school.gpa}`) : "")
          if (school.coursework) add(`  ${italic("Relevant Coursework:")} ${latex(school.coursework)}\\par`)
          if (school.involvement) add(`  ${italic("Involvement:")} ${latex(school.involvement)}\\par`)
        })
        break
      case "work":
        experience(data.work.map(({ company, ...job }) => ({ organization: company, ...job })))
        break
      case "leadership":
      case "volunteer":
        experience(data[section.kind])
        break
      case "projects":
        data.projects.forEach((project, index) => {
          if (index) add("  \\resumeEntryGap")
          const name = project.name && bold(projectName(project))
          row(name, emph(dateRange(project.start, project.end)))
          const details = [emph(project.techStack), ...project.links.map((url) => webLink(url, underline))].filter(Boolean)
          if (details.length) add(`  \\resumeDetails{${details.join(" | ")}}`)
          bullets(project.bullets)
        })
        break
      case "publications":
        add(citations(data.publications, underlined, `labelsep=0.7em, itemsep=${sum(units.space(6), minus(leading))}`))
        break
      case "skills":
        for (const skill of data.skills) add(`  ${skill.name ? `${bold(latex(`${skill.name}:`))} ` : ""}${latex(skill.details)}\\par`)
        break
      case "awards":
        for (const award of data.awards) {
          row(`${strong(award.name)}${award.name && award.organization ? ", " : ""}${latex(award.organization)}`, emph(award.date))
        }
        break
    }
  }
  return lines.join("\n")
}

export const referme: LatexTemplate = {
  credit: ["resumezip's Compact template"],
  preamble,
  body,
  fallbacks: HEROS_FALLBACKS,
}
