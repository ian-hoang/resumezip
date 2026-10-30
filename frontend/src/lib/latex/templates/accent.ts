// resumezip's Accent (templates/accent.typ): a centered name in two weights,
// section titles whose first three letters take the accent colour with a
// hairline running on after them, and roles and degrees in small spaced
// capitals, in Source Sans.
//
// accent.typ stacks its lines by hand: each gap runs from one line's baseline
// to the top of the next one's capitals, and lines in a paragraph are
// `LEADING` apart that way. TeX measures from baseline to baseline. So each
// line's \baselineskip is its leading plus its capitals' height, and each part
// that starts a new line (an entry, a list, a paragraph) first takes back the
// leading above it, which accent.typ's gaps don't count.

import { printedSections, type Paragraph, type TemplateData } from "@/lib/typst/resumeData"
import {
  bold,
  CHARIS,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  itemText,
  latex,
  links,
  paragraphs,
  projectHeader,
  ROW,
  runs,
  signs,
  sum,
  underline,
  underlined,
  unlessPdfLatex,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Units,
} from "../common"

// Space between lines, in em, as accent.typ's `leading`.
const LEADING = 0.48
// Source Sans's capitals, in em: where accent.typ's lines start.
const CAP = 0.66
// The text size, in points.
const BASE = 10.5

const FALLBACKS: Fallbacks = {
  comment: `Source Sans Pro has no ₿, which prints in Charis SIL, as in the PDF.`,
  fonts: [{ name: "SourceSansPro", faces: true, someGreek: false }],
  families: [CHARIS],
  letters: [[signs("₿"), CHARIS]],
}

/** Fine-tune's lengths in bp, and the leading above a line of text this size and its \baselineskip. */
function lengthsOf(units: Units) {
  const lead = (size: number) => units.space(LEADING * size)
  const pitch = (size: number) => sum(lead(size), units.size(CAP * size))
  return { size: units.size, space: units.space, gap: units.gap, lead, pitch }
}

const preamble = (units: Units, title: string, fallbacks: string) => {
  const { size, space, gap, lead, pitch } = lengthsOf(units)
  const font = (pt: number) => `\\fontsize{${size(pt)}}{${pitch(pt)}}\\selectfont`
  const rise = size(0.32 * BASE)

  return `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${unlessPdfLatex(fallbacks)}% Source Sans Pro: Source Sans 3, the PDF's font, under its older name
\\usepackage[default]{sourcesanspro}
\\usepackage[left=${units.margin(0.6)}, right=${units.margin(0.6)}, top=${units.margin(0.48)}, bottom=${units.margin(0.42)}]{geometry}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{tabularx}
% Roles and degrees: capitals 0.08em apart, by microtype's letterspacing with
% pdfLaTeX and the font's own with XeLaTeX and LuaLaTeX
\\ifPDFTeX
  \\usepackage{letterspace}
  \\newcommand{\\spacedCaps}[1]{\\textls*[80]{\\MakeUppercase{#1}}}
\\else
  \\newcommand{\\spacedCaps}[1]{{\\addfontfeature{LetterSpace=8}\\MakeUppercase{#1}}}
\\fi
% The light weight of the first names
\\ifPDFTeX
  \\newcommand{\\lightWeight}{\\fontseries{l}\\selectfont}
\\else
  \\newcommand{\\lightWeight}{\\sourcesansprolight}
\\fi
${links(title)}

\\definecolor{accent}{HTML}{0A8A68}
\\definecolor{ink}{HTML}{2B2B2B}
\\definecolor{muted}{HTML}{707070}
\\definecolor{hairline}{HTML}{B9B9B9}
\\AtBeginDocument{\\color{ink}}

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

% The name, its baseline its capitals' height under the top margin, then the
% contact line, a fixed distance under it. An empty box at the top, and no
% minimum space between lines, keep them where they are however tall or deep
% the name's letters are.
\\newcommand{\\resumeName}[1]{%
  \\hbox{}\\vspace{${sum("-" + lead(30), "-" + size(CAP * BASE))}}%
  {${font(30)}\\setlength{\\lineskiplimit}{-\\maxdimen}\\centering #1\\par}%
}
\\newcommand{\\resumeContacts}[1]{%
  \\vspace{${sum(size(8), "-" + lead(8.8))}}%
  {${font(8.8)}\\setlength{\\lineskiplimit}{-\\maxdimen}\\centering\\textcolor{muted}{\\ignorespaces #1}\\par}%
}
\\newcommand{\\contactSep}{\\hspace{0.6em}\\textcolor{accent}{\\textbar}\\hspace{0.6em}}

% A section: its title, the first three letters in the accent colour, then
% a hairline to the margin
\\newcommand{\\resumeSection}[2]{%
  \\par\\vspace{${sum(gap(13), "-" + lead(13.5))}}%
  {${font(13.5)}\\textbf{\\textcolor{accent}{#1}#2}\\hspace{6bp}\\sectionRule\\par}%
  \\nopagebreak\\vspace{${size(6)}}%
}
% 0.6bp thick, 0.32em over the baseline
\\newcommand{\\sectionRule}{{\\color{hairline}\\leaders\\hrule height ${sum(rise, "0.3bp")} depth ${sum("0.3bp", "-" + rise)}\\hskip 0pt plus 1filll}}

% An entry: the organization in bold and its place in accent italics, then
% the role in small spaced capitals and its dates in grey italics
\\newcommand{\\resumeEntryTop}[2]{%
  \\par\\vspace{-${lead(BASE)}}%
  \\resumeRow{\\textbf{#1}}{\\textcolor{accent}{\\textit{#2}}}\\par\\nopagebreak
}
\\newcommand{\\resumeEntry}[4]{%
  \\resumeEntryTop{#1}{#2}%
  \\vspace{${sum(space(3.6), "-" + pitch(BASE), size(CAP * 8.6))}}%
  \\resumeRow{\\resumeRole{#3}}{\\resumeDate{#4}}\\par\\nopagebreak
}
\\newcommand{\\resumeRole}[1]{{${font(8)}\\textcolor{muted}{\\spacedCaps{#1}}}}
\\newcommand{\\resumeDate}[1]{{${font(8.6)}\\textcolor{muted}{\\textit{#1}}}}

% A line with a date on the right: a project's first line, or an award
\\newcommand{\\resumeLine}[2]{%
  \\par\\vspace{-${lead(BASE)}}%
  \\resumeRow{#1}{\\resumeDate{#2}}\\par
}
\\newcommand{\\resumeProject}[2]{\\resumeLine{#1}{#2}\\nopagebreak}

\\newcommand{\\resumeEntryGap}{\\vspace{${size(9)}}}
\\newcommand{\\resumeAwardGap}{\\vspace{${space(4.4)}}}

% Bullets: an accent dot 2bp in, the text 5bp after it
\\newlist{resumeItems}{itemize}{1}
\\setlist[resumeItems]{label=\\textcolor{accent}{\\textbullet}, leftmargin=*, labelindent=2bp, labelsep=5bp, topsep=0pt, partopsep=0pt,
  parsep=0pt, itemsep=${sum(space(3.4), "-" + lead(BASE))}, before=\\vspace{${sum(space(3.6), "-" + lead(BASE))}}}

% Paragraphs, as the summary's, 0.6em further apart than lines. The first one gets \\parskip too, so it's taken back.
\\newenvironment{resumeText}{%
  \\par\\vspace{-${lead(BASE)}}%
  \\setlength{\\parskip}{${size(0.6 * BASE)}}\\vspace{-\\parskip}%
}{\\par}

% Skills: their names in bold, right-aligned, then what's in each
\\newenvironment{resumeSkills}{%
  \\par\\vspace{-${lead(BASE)}}%
  \\tabularx{\\linewidth}[t]{@{}r@{\\hspace{1em}}L@{}}%
}{%
  \\endtabularx\\par
  % The next line goes under the table's last line rather than its first.
  \\prevdepth=\\dp\\strutbox
}
\\newcommand{\\skillGap}{\\\\[${sum(space(4.2), "-" + lead(BASE))}]}
`
}

/**
 * A heading's first three letters and the rest, each escaped. Split before
 * escaping, as the escapes are several characters long. A letter is what the
 * PDF counts as one (clusters() in accent.typ): with its accents, or a
 * conjunct or an emoji as a whole.
 */
function splitHeading(heading: string): [string, string] {
  const letters = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(heading), ({ segment }) => segment)
  return [latex(letters.slice(0, 3).join("")), latex(letters.slice(3).join(""))]
}

function body(data: TemplateData, units: Units): string {
  const { space, lead } = lengthsOf(units)
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const items = (bullets: string[], indent = "    ") => {
    if (!bullets.length) return
    add(`${indent}\\begin{resumeItems}`, ...bullets.map((bullet) => `${indent}  \\item ${itemText(bullet)}`), `${indent}\\end{resumeItems}`)
  }
  // Entries, `\resumeEntryGap` between them.
  const entries = <T>(list: T[], write: (item: T) => void) =>
    list.forEach((item, index) => {
      if (index) add("  \\resumeEntryGap")
      write(item)
    })
  const entry = (organization: string, place: string, role: string, dates: string, bullets: string[]) => {
    if (role || dates) add(`  \\resumeEntry{${latex(organization)}}{${latex(place)}}{${latex(role)}}{${latex(dates)}}`)
    else add(`  \\resumeEntryTop{${latex(organization)}}{${latex(place)}}`)
    items(bullets)
  }
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  const heading = (raw: string) => {
    const [first, rest] = splitHeading(raw)
    add("", `\\resumeSection{${first}}{${rest}}`)
  }

  const { profile } = data
  // First names light, the last name bold.
  const words = profile.name.split(" ")
  const last = latex(words.pop() ?? "")
  const name = words.length ? `{\\lightWeight ${latex(words.join(" "))}} ${bold(last)}` : bold(last)
  const contacts = [
    latex(profile.location),
    latex(profile.phone),
    profile.email && emailLink(profile.email, underline),
    profile.linkedin && webLink(profile.linkedin, underline),
    profile.github && webLink(profile.github, underline),
    profile.website && webLink(profile.website, underline),
  ].filter(Boolean)
  if (profile.name) add(`\\resumeName{${name}}`)
  // Each item kept whole, a line breaking between them.
  if (contacts.length) add("\\resumeContacts{", contacts.map((contact) => `  \\mbox{${contact}}`).join("\\contactSep\n"), "}")

  if (data.summary.length) {
    heading("Summary")
    text(data.summary)
  }

  for (const section of printedSections(data)) {
    heading(section.heading)
    switch (section.kind) {
      case "extra": {
        const { extra } = section
        if (extra.kind === "text") text(extra.paragraphs)
        else items(extra.bullets.map(runs), "  ")
        break
      }
      case "education":
        entries(data.education, (school) => {
          const bullets = [
            school.gpa && `GPA: ${latex(school.gpa)}`,
            school.coursework && `Coursework: ${latex(school.coursework)}`,
            school.involvement && `Involvement: ${latex(school.involvement)}`,
          ].filter(Boolean)
          entry(school.school, school.location, school.degree, dateRange(school.start, school.end), bullets)
        })
        break
      case "work":
        entries(data.work, (job) => entry(job.company, job.location, job.role, dateRange(job.start, job.end), job.bullets.map(runs)))
        break
      case "leadership":
      case "volunteer":
        entries(data[section.kind], (role) =>
          entry(role.organization, role.location, role.role, dateRange(role.start, role.end), role.bullets.map(runs)),
        )
        break
      case "projects":
        entries(data.projects, (project) => {
          add(
            `  \\resumeProject{${projectHeader(project, " \\textcolor{accent}{\\textbar} ", underlined)}}{${latex(dateRange(project.start, project.end))}}`,
          )
          items(project.bullets.map(runs))
        })
        break
      case "publications":
        add(
          citations(
            data.publications,
            underlined,
            `labelindent=0pt, labelsep=0.7em, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${sum(space(5), "-" + lead(BASE))}, before=\\vspace{-${lead(BASE)}}`,
          ),
        )
        break
      case "skills":
        // \skillGap gives \\ its option, so a row starting with [ isn't read as one.
        add(
          "  \\begin{resumeSkills}",
          data.skills.map((skill) => `    ${bold(latex(skill.name))} & ${latex(skill.details)}`).join(" \\skillGap\n"),
          "  \\end{resumeSkills}",
        )
        break
      case "awards":
        data.awards.forEach((award, index) => {
          if (index) add("  \\resumeAwardGap")
          const organization = award.organization && `, ${latex(award.organization)}`
          add(`  \\resumeLine{${bold(latex(award.name))}${organization}}{${latex(award.date)}}`)
        })
        break
    }
  }
  return lines.join("\n")
}

export const accent: LatexTemplate = {
  credit: ["resumezip's Accent template"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
