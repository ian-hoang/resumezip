// resumezip's Margin (templates/margin.typ) in LaTeX: section headings hang in
// the left margin, in Linux Biolinum's small capitals, level with the first
// line of their section, and the text runs beside them in Charis SIL. The
// headings' column is geometry's margin for notes (marginparwidth), so a
// section is ordinary text and breaks across pages as any text does; its
// heading is set into it with \llap.
//
// Typst puts a line's top at its capitals and measures a space from one
// line's baseline to the next line's capitals; LaTeX puts lines a
// \baselineskip apart, baseline to baseline. The spaces below are the .typ's
// turned into LaTeX's, so lines land where the PDF has them.

import {
  bp,
  CHARIS,
  citations,
  dateRange,
  EB_GARAMOND,
  emailLink,
  ENGINES,
  GREEK,
  itemText,
  latex,
  links,
  paragraphs,
  projectHeader,
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

// How tall the fonts' capitals are, in em (their OS/2 tables): where Typst
// puts the top of a line.
const CHARIS_CAPS = 0.671
const BIOLINUM_CAPS = 0.658
const HEADING_SIZE = 10.8

const FALLBACKS: Fallbacks = {
  comment: `Charis SIL has only the Greek letters phonetics uses, so all of Greek prints
in EB Garamond, as in the PDF. Linux Biolinum, in headings, has all of Greek,
but not ₹ ₽ ₺ ₴, which print in EB Garamond too, nor ₿, which prints in
Charis SIL.`,
  fonts: [
    { name: "CharisSIL", faces: true, someGreek: true },
    { name: "LinBiolinum", faces: false, someGreek: false },
  ],
  families: [EB_GARAMOND, CHARIS],
  letters: [
    [GREEK, EB_GARAMOND],
    [signs("₹₽₺₴"), EB_GARAMOND],
    [signs("₿"), CHARIS],
  ],
}

const preamble = (units: Units, title: string, fallbacks: string) => {
  // Sums of Fine-tune's lengths, worked out as numbers and written back with `bp`.
  const value = Number.parseFloat
  const caps = (size: number) => value(units.size(size * CHARIS_CAPS))
  // A line is its capitals' height plus the leading (0.5em) below the line above.
  const leading = value(units.space(4.8))
  const line = caps(9.6) + leading
  const nameLine = caps(25) + value(units.space(12.5))
  const headingLine = value(units.size(HEADING_SIZE * BIOLINUM_CAPS)) + value(units.space(5.4))
  // LaTeX's space for Typst's v(space) between two lines. Typst measures it from
  // the first's baseline to the second's capitals, so one smaller than the
  // leading brings them closer than a line apart.
  const between = (space: string) => bp(value(space) - leading)
  // The heading sits as much lower as its capitals are taller than the text's.
  const lower = units.size(HEADING_SIZE * BIOLINUM_CAPS - 9.6 * CHARIS_CAPS)
  // The headings' 0.15pt outline as fontspec's FakeBold, in hundredths of their size.
  const fakeBold = Math.round((0.15 / HEADING_SIZE) * 10000) / 100
  // How far a heading's line may run past its column rather than hyphenate:
  // the .typ's 0.03em, and as much again for \textls's kerns at its ends.
  const allowance = units.size(0.06 * HEADING_SIZE)

  return `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${unlessPdfLatex(fallbacks)}% Charis SIL for the text, Linux Biolinum for the headings
\\usepackage{CharisSIL}
\\ifPDFTeX
  \\usepackage[sf]{libertine}
  % The headings are letterspaced (microtype's \\textls) and outlined a little
  % (pdfrender), as in the PDF
  \\usepackage[protrusion=false, expansion=false]{microtype}
  \\usepackage{pdfrender}
  \\newcommand{\\nameStyle}[1]{\\textls[10]{#1}}
  \\newcommand{\\headingStyle}[1]{%
    \\textpdfrender{TextRenderingMode=FillStroke, LineWidth=${units.size(0.15)}}{\\biolinum\\scshape\\textls[30]{#1}}%
  }
\\else
  % XeLaTeX or LuaLaTeX: Biolinum's OpenType file, letterspaced and outlined
  % by fontspec
  \\newfontfamily\\biolinum{LinBiolinum}[Extension=.otf, UprightFont=*_R, LetterSpace=3, FakeBold=${fakeBold}]
  \\newcommand{\\nameStyle}[1]{{\\addfontfeatures{LetterSpace=1}#1}}
  \\newcommand{\\headingStyle}[1]{{\\biolinum\\scshape #1}}
\\fi
% The headings' column (0.98in) is the margin for notes, on the left
\\usepackage[top=${units.margin(0.55)}, bottom=${units.margin(0.45)}, left=${units.margin(0.55)}, right=${units.margin(0.55)},
  marginparwidth=${units.size(70.56)}, marginparsep=0.2in, reversemp, includemp]{geometry}
\\usepackage{xcolor}
\\usepackage{enumitem}
${links(title)}

% Text size and line spacing, as Fine-tune sets them. Lines are a fixed
% distance apart, whatever letters they have, as in the PDF.
\\renewcommand{\\normalsize}{\\fontsize{${units.size(9.6)}}{${bp(line)}}\\selectfont}
\\normalsize
\\setlength{\\lineskiplimit}{-\\maxdimen}
\\setlength{\\topskip}{${bp(caps(9.6))}}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\raggedright
\\raggedbottom
\\pagestyle{empty}
\\definecolor{grey}{gray}{0.36}

%-------------------------
% Custom commands

% The name, its capitals' tops on the top margin whatever its letters: an
% empty line goes on the margin, and the name a line below it, moved up. Then
% how to reach you, in grey.
\\newcommand{\\resumeHeader}[2]{%
  \\null\\nobreak\\kern${bp(caps(25) - caps(9.6) - nameLine)}\\relax
  {\\fontsize{${units.size(25)}}{${bp(nameLine)}}\\selectfont\\leavevmode\\nameStyle{#1}\\par}%
  \\if\\relax\\detokenize{#2}\\relax\\else
    \\vspace{${bp(value(units.size(7)) - value(units.space(4.5)))}}%
    {\\fontsize{${units.size(9)}}{${bp(caps(9) + value(units.space(4.5)))}}\\selectfont\\color{grey}#2\\par}%
  \\fi
  \\vspace{${units.size(2)}}%
}
\\newcommand{\\contactSep}{\\nobreak\\hspace{0.5em}\\textperiodcentered\\hspace{0.5em}}

% A section's heading, in the margin and level with the section's first line.
% Its lines below the first take no room, so a section shorter than its
% heading moves the next one down, clear of it. Its lines stay on one page:
% when they don't fit above the foot of one, the section starts on the next.
%
% A word too wide for the margin is hyphenated, which TeX only does when a
% line can't fit otherwise; the glue before the first word lets it hyphenate
% that one too. When a line is too wide all the same, as a word with nowhere
% to hyphenate is, the heading is set again smaller, to fit, so a line too
% wide isn't reported (\\hfuzz).
\\newsavebox{\\resumeHeadingBox}
\\newlength{\\resumeHeadingEnd} % the last heading's last baseline, on its page
\\newlength{\\resumeHeadingWidest}
\\newcount\\resumeHeadingPage
\\newif\\ifresumeFirst
% The heading #2 at size #1, as deep as its last baseline is below its first.
% A line may run ${allowance} past the margin rather than hyphenate, as the
% sample's "Certifications" does. A plain \\hbox, as \\sbox's ends with color
% specials, after the \\parbox that \\resumeHeadingMeasure takes off its end.
\\newcommand{\\resumeHeadingAt}[2]{%
  \\setbox\\resumeHeadingBox=\\hbox{\\parbox[t]{\\marginparwidth}{\\raggedleft\\rightskip=0pt minus ${allowance}\\hfuzz=\\maxdimen
    \\fontsize{#1}{${bp(headingLine)}}\\selectfont\\leavevmode\\headingStyle{\\nobreak\\hspace{0pt}#2}\\par\\kern-\\prevdepth}}%
}
% Its widest line, taking the lines off a copy of it one by one
\\newcommand{\\resumeHeadingMeasure}{%
  \\setbox0=\\hbox{\\unhcopy\\resumeHeadingBox\\global\\setbox1=\\lastbox}%
  \\global\\resumeHeadingWidest=0pt
  \\setbox0=\\vbox{\\unvbox1
    \\loop\\unskip\\unpenalty\\unkern\\setbox2=\\lastbox\\ifhbox2
      \\setbox2=\\hbox{\\unhbox2}%
      \\ifdim\\wd2>\\resumeHeadingWidest\\global\\resumeHeadingWidest=\\wd2\\fi
    \\repeat}%
}
\\newcommand{\\resumeSection}[1]{%
  \\par
  \\ifnum\\value{page}=\\resumeHeadingPage
    \\ifdim\\dimexpr\\pagetotal+\\pagedepth-\\prevdepth\\relax<\\resumeHeadingEnd
      \\vspace{\\dimexpr\\resumeHeadingEnd-\\pagetotal-\\pagedepth+\\prevdepth\\relax}%
    \\fi
  \\fi
  \\vspace{${between(units.gap(12.5))}}%
  \\resumeHeadingAt{${units.size(HEADING_SIZE)}}{#1}%
  \\resumeHeadingMeasure
  \\ifdim\\resumeHeadingWidest>\\dimexpr\\marginparwidth+${allowance}\\relax
    \\resumeHeadingAt{\\dimexpr${units.size(HEADING_SIZE)}*\\marginparwidth/\\resumeHeadingWidest\\relax}{#1}%
  \\fi
  % Its last baseline above the foot of the page, or a new page. The penalty,
  % where no page breaks, puts the space above on the page, so \\pagetotal
  % counts it.
  \\penalty10000
  \\ifdim\\dimexpr\\pagetotal+\\pagedepth-\\prevdepth+\\baselineskip+${lower}+\\dp\\resumeHeadingBox\\relax>\\pagegoal\\newpage\\fi
  % Lowered, so its capitals' tops are level with the text's
  \\noindent\\llap{\\raisebox{-${lower}}[0pt][0pt]{\\usebox{\\resumeHeadingBox}}\\hspace{\\marginparsep}}\\par
  \\global\\resumeHeadingPage=\\value{page}%
  \\global\\resumeHeadingEnd=\\dimexpr\\pagetotal+${lower}+\\dp\\resumeHeadingBox\\relax
  % The section's first line goes on the heading's
  \\kern-\\baselineskip\\nobreak
  \\global\\resumeFirsttrue
}

% Space between two parts of a section, none before the first
\\newcommand{\\resumeSpace}[1]{\\ifresumeFirst\\global\\resumeFirstfalse\\else\\vspace{#1}\\fi}

% A line with one part on the left and one on the right. A long left part
% wraps, and the right one ends its last line.
\\newcommand{\\resumeRow}[2]{\\leavevmode#1\\nobreak\\hspace{0.8em plus 1fill}\\mbox{#2}\\par}

% An entry: the organization and its dates, then the role and the place (when
% there's either). Its bullets follow.
\\newcommand{\\resumeEntry}[4]{%
  \\resumeSpace{${between(units.size(8))}}%
  \\resumeRow{\\textbf{#1}}{#2}%
  \\if\\relax\\detokenize{#3#4}\\relax\\else
    \\nopagebreak\\vspace{${between(units.space(3.5))}}%
    \\resumeRow{\\textit{#3}}{\\textcolor{grey}{#4}}%
  \\fi
}
\\newcommand{\\resumeProject}[2]{\\resumeSpace{${between(units.size(8))}}\\resumeRow{#1}{#2}}
\\newcommand{\\projectSep}{\\nobreak\\hspace{0.4em}\\textperiodcentered\\hspace{0.4em}}
\\newcommand{\\resumeSkill}[2]{%
  \\resumeSpace{${between(units.space(3.9))}}%
  \\leavevmode\\if\\relax\\detokenize{#1}\\relax\\else\\textbf{#1}: \\fi#2\\par
}
\\newcommand{\\resumeAward}[3]{%
  \\resumeSpace{${between(units.space(4.5))}}%
  \\resumeRow{\\textbf{#1}\\if\\relax\\detokenize{#2}\\relax\\else, #2\\fi}{#3}%
}

% Bullets: grey dashes, kept with the lines above them. The space above them
% is a \\kern, as a list's own space can't be less than none.
\\newenvironment{resumeBullets}{%
  \\par\\nopagebreak
  \\ifresumeFirst\\global\\resumeFirstfalse\\kern${units.space(3.8)}\\else\\kern${between(units.space(3.8))}\\fi
  \\begin{itemize}[label={\\textcolor{grey}{\\textendash}}, leftmargin=*, labelsep=6pt, topsep=0pt, partopsep=0pt,
    parsep=0pt, itemsep=${between(units.space(3.9))}, beginpenalty=10000]%
}{\\end{itemize}}

% Paragraphs, as the summary's, 0.6em further apart than lines
\\newenvironment{resumeText}{\\setlength{\\parskip}{${units.size(5.76)}}\\vspace{-\\parskip}}{\\par}

% Publications: the space between them
\\newcommand{\\citationSpace}{${between(units.space(5))}}
`
}

function body(data: TemplateData): string {
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const bullets = (items: string[]) => {
    if (!items.length) return
    add("  \\begin{resumeBullets}", ...items.map((item) => `    \\item ${itemText(item)}`), "  \\end{resumeBullets}")
  }
  const entry = (title: string, dates: string, subtitle: string, place: string, items: string[]) => {
    add(`  \\resumeEntry{${latex(title)}}{${latex(dates)}}{${latex(subtitle)}}{${latex(place)}}`)
    bullets(items)
  }
  const experience = (title: string, start: string, end: string, subtitle: string, place: string, items: Run[][]) =>
    entry(title, dateRange(start, end), subtitle, place, items.map(runs))
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  const heading = (title: string) => add("", `\\resumeSection{${title}}`)

  const { profile } = data
  const reach = [latex(profile.location), latex(profile.phone), profile.email && emailLink(profile.email, underline)]
  const web = [profile.linkedin, profile.github, profile.website].map((url) => url && webLink(url, underline))
  const contacts = [reach, web].map((items) => items.filter(Boolean).map((item) => `\\mbox{${item}}`)).filter((items) => items.length)
  // The name's line is there even without a name, as in the PDF.
  if (profile.name || contacts.length) {
    add(
      `\\resumeHeader{${latex(profile.name)}}{%`,
      ...contacts
        .map((items) => `  ${items.join("\\contactSep\n  ")}`)
        .join("\\newline\n")
        .split("\n"),
      "}",
    )
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
        else bullets(extra.bullets.map(runs))
        break
      }
      case "education":
        for (const school of data.education) {
          const degree = [school.degree, school.gpa && `GPA ${school.gpa}`].filter(Boolean).join(", ")
          const items = [
            ["Coursework", school.coursework],
            ["Involvement", school.involvement],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => latex(`${label}: ${value}`))
          entry(school.school, dateRange(school.start, school.end), degree, school.location, items)
        }
        break
      case "work":
        data.work.forEach((job) => experience(job.company, job.start, job.end, job.role, job.location, job.bullets))
        break
      case "leadership":
      case "volunteer":
        data[section.kind].forEach((role) => experience(role.organization, role.start, role.end, role.role, role.location, role.bullets))
        break
      case "projects":
        for (const project of data.projects) {
          add(`  \\resumeProject{${projectHeader(project, "\\projectSep ", underlined)}}{${latex(dateRange(project.start, project.end))}}`)
          bullets(project.bullets.map(runs))
        }
        break
      case "publications":
        add(citations(data.publications, underlined, "labelsep=0.7em, topsep=0pt, parsep=0pt, itemsep=\\citationSpace, beginpenalty=10000"))
        break
      case "skills":
        for (const skill of data.skills) add(`  \\resumeSkill{${latex(skill.name)}}{${latex(skill.details)}}`)
        break
      case "awards":
        for (const award of data.awards) add(`  \\resumeAward{${latex(award.name)}}{${latex(award.organization)}}{${latex(award.date)}}`)
        break
    }
  }
  return lines.join("\n")
}

export const margin: LatexTemplate = {
  credit: ["resumezip's Margin template"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
