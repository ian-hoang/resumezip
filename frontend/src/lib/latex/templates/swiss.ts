// resumezip's Swiss (templates/swiss.typ): big grotesque type on one strong
// left edge, like a Swiss poster. The name and section titles are large and
// black, everything else small and quiet, with red only in the rule under the
// name and the bullets. TeX Gyre Heros.
//
// Typst measures the space between two blocks from one line's baseline to
// the top of the next one's capitals, where TeX adds it to the space between
// lines. A negative \parskip takes that back, so the spaces below are the
// .typ's own lengths. The red rule is the one exception: see
// \resumeRule.

import {
  bold,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  fontSize,
  HEROS_FALLBACKS,
  joinPresent,
  latex,
  links,
  paragraphs,
  PLAIN_ROW,
  projectHeader,
  runs,
  sectionsOf,
  shownLink,
  stretch,
  sum,
  texGyre,
  underline,
  underlined,
  webLink,
  type LatexTemplate,
  type ShowLink,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

const SIZE = 9.2
const TITLE = 15
const NAME = 40
/** TeX Gyre Heros's capital height, in em: where Typst measures a line's top from. */
const CAP = 0.729
/** The space between lines, in em, as `leading` in swiss.typ. */
const LEADING = 0.5

/** A project's links, in grey and underlined. */
const greyLink: ShowLink = (url, text) => `\\textcolor{grey}{${shownLink(url, text, underline)}}`

const preamble = (units: Units, title: string, fallbacks: string) => `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${texGyre("heros", fallbacks)}
\\usepackage[left=${units.margin(0.55)}, right=${units.margin(0.55)}, top=${units.margin(0.48)}, bottom=${units.margin(0.42)}]{geometry}
\\usepackage{xcolor}
\\usepackage{tabularx}
\\usepackage{enumitem}
\\ifPDFTeX
  % For \\textls, which tightens the name and section titles
  \\usepackage[protrusion=false, expansion=false]{microtype}
\\fi
${links(title)}

\\definecolor{swissred}{HTML}{D4261C}
\\definecolor{grey}{RGB}{105,105,105}

% Text sizes and line spacing, as Fine-tune sets them: a line is its
% capitals' height and the gap above them
\\renewcommand{\\normalsize}{${fontSize(units, SIZE, CAP, LEADING)}\\selectfont}
\\newcommand{\\titleSize}{${fontSize(units, TITLE, CAP, LEADING)}\\selectfont}
\\newcommand{\\nameSize}{${fontSize(units, NAME, CAP, LEADING)}\\selectfont}
\\normalsize
% Each \\vspace below runs from a line to the top of the next line's
% capitals, as in the PDF, so a new paragraph takes back the gap above them
\\setlength{\\parskip}{${units.space(-LEADING * SIZE)}}
\\setlength{\\topskip}{${units.size(CAP * SIZE)}}

\\pagestyle{empty}
\\raggedbottom
\\raggedright

% \\tracked{-35}{text}: letters 0.035em closer together
\\ifPDFTeX
  \\newcommand{\\tracked}[2]{\\textls*[#1]{#2}}
\\else
  \\newcommand{\\tracked}[2]{{\\addfontfeatures{LetterSpace=\\fpeval{#1/10}}#2}}
\\fi

%-------------------------
% Custom commands

% The name, where you are and how to reach you, and the red rule under them.
% Lines are placed by their baselines alone, however deep the name's letters go.
\\newcommand{\\resumeName}[1]{\\par\\noindent{\\nameSize\\bfseries\\tracked{-35}{#1}\\par}}
\\newcommand{\\resumeContacts}[1]{\\par\\vspace{${units.size(14)}}{\\lineskiplimit=-\\maxdimen\\noindent#1\\par}}
\\newcommand{\\contactGap}{\\hspace{1em}}
% The red rule, 9pt below the line above it, less the capitals' height that
% a line of its own adds
\\newcommand{\\resumeRule}{%
  \\par\\vspace{${sum(units.size(9), units.size(-CAP * SIZE))}}%
  \\noindent\\smash{\\color{swissred}\\rule[-1.2pt]{\\linewidth}{2.4pt}}\\par
  \\vspace{${units.size(2)}}%
}

% A section title, big and bold
\\newcommand{\\resumeSection}[1]{%
  \\par\\vspace{${units.gap(13)}}%
  {\\titleSize\\setlength{\\parskip}{${units.space(-LEADING * TITLE)}}\\noindent\\textbf{\\tracked{-15}{#1}}\\par}%
  \\nobreak\\addvspace{${units.size(7)}}%
}

${PLAIN_ROW}

% An entry: the organization in bold and its dates, then the role and the
% place in grey, when there's either. After a section title (the space it
% ends with), only the title's own space.
\\newcommand{\\resumeEntry}[4]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.size(8)}}\\fi
  \\resumeRow{\\textbf{#1}}{#2}%
  \\if\\relax\\detokenize{#3#4}\\relax\\else
    \\nobreak\\vspace{${units.space(3.4)}}%
    \\resumeRow{#3}{\\textcolor{grey}{#4}}%
  \\fi
  \\nobreak
}

% A project: its name, stack and links, and its date
\\newcommand{\\resumeProject}[2]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.size(8)}}\\fi
  \\resumeRow{#1}{#2}\\nobreak
}

% An award: its name in bold, who gave it in grey, and its date
\\newcommand{\\resumeAward}[3]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.space(4.4)}}\\fi
  \\resumeRow{\\textbf{#1}\\if\\relax\\detokenize{#2}\\relax\\else\\dotSep\\textcolor{grey}{#2}\\fi}{#3}%
}

\\newcommand{\\dotSep}{\\hspace{0.45em}\\textcolor{grey}{\\textperiodcentered}\\hspace{0.45em}}

% Bullets: a red dash, its text 6pt after it, and wrapped lines under the text
\\newlength{\\bulletWidth}
\\newenvironment{resumeItems}{\\par\\vspace{${units.space(3.8)}}\\let\\itemGap\\relax}{\\par}
\\newcommand{\\resumeItem}[1]{%
  \\par\\itemGap\\def\\itemGap{\\vspace{${units.space(3.6)}}}%
  \\settowidth{\\bulletWidth}{\\textendash\\hspace{6pt}}%
  \\noindent\\hangindent=\\bulletWidth
  \\makebox[\\bulletWidth][l]{\\textcolor{swissred}{\\textendash}}#1\\par
}

% Paragraphs, as the summary's, 0.6em further apart than lines
\\newenvironment{resumeText}{\\par\\noindent\\setlength{\\parskip}{${units.size(0.6 * SIZE)}}\\ignorespaces}{\\par}

% Skills: the names in a column as wide as the widest, the rest beside them.
% \\prevdepth puts what comes next as far below as after a line of text.
\\newenvironment{resumeSkills}{%
  \\par\\noindent
  \\renewcommand{\\arraystretch}{${stretch(units, SIZE, CAP, LEADING, 4.2)}}%
  \\tabularx{\\linewidth}[t]{@{}l@{\\hspace{1.2em}}X@{}}%
}{%
  \\endtabularx\\par
  \\prevdepth=\\arraystretch\\dp\\strutbox
}
`

function body(data: TemplateData, units: Units): string {
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const items = (bullets: string[]) => {
    if (bullets.length) add("  \\begin{resumeItems}", ...bullets.map((item) => `    \\resumeItem{${item}}`), "  \\end{resumeItems}")
  }
  const entry = (org: string, dates: string, role: string, place: string, bullets: string[]) => {
    add(`  \\resumeEntry{${latex(org)}}{${latex(dates)}}{${latex(role)}}{${latex(place)}}`)
    items(bullets)
  }
  const experience = (org: string, start: string, end: string, role: string, place: string, bullets: Run[][]) =>
    entry(org, dateRange(start, end), role, place, bullets.map(runs))
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  const heading = (title: string) => add("", `\\resumeSection{${title}}`)

  const { profile } = data
  const contacts = [
    latex(profile.location),
    latex(profile.phone),
    profile.email && emailLink(profile.email, underline),
    profile.linkedin && webLink(profile.linkedin, underline),
    profile.github && webLink(profile.github, underline),
    profile.website && webLink(profile.website, underline),
  ]
    .filter(Boolean)
    .map((item) => `\\mbox{${item}}`)
  if (profile.name) add(`\\resumeName{${latex(profile.name)}}`)
  if (contacts.length) add("\\resumeContacts{%", `  ${contacts.join("\\contactGap\n  ")}%`, "}")
  add("\\resumeRule")

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
        else items(extra.bullets.map(runs))
        break
      }
      case "education":
        for (const school of data.education) {
          const degree = joinPresent(", ", school.degree, school.gpa && `GPA ${school.gpa}`)
          const notes = [
            ["Coursework:", school.coursework],
            ["Involvement:", school.involvement],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => `${label} ${latex(value)}`)
          entry(school.school, dateRange(school.start, school.end), degree, school.location, notes)
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
          add(`  \\resumeProject{${projectHeader(project, "\\dotSep ", greyLink)}}{${latex(project.date)}}`)
          items(project.bullets.map(runs))
        }
        break
      case "publications": {
        // [1], [2], ... 0.7em before each, 5pt apart.
        const apart = sum(units.space(5), units.space(-LEADING * SIZE))
        add(citations(data.publications, underlined, `labelsep=0.7em, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${apart}`))
        break
      }
      case "skills":
        // Each row starts with a command, so \\ never reads it as its option.
        add(
          "  \\begin{resumeSkills}",
          data.skills.map((skill) => `    ${bold(latex(skill.name))} & ${latex(skill.details)}`).join(" \\\\\n"),
          "  \\end{resumeSkills}",
        )
        break
      case "awards":
        for (const award of data.awards) add(`  \\resumeAward{${latex(award.name)}}{${latex(award.organization)}}{${latex(award.date)}}`)
        break
    }
  }
  return lines.join("\n")
}

export const swiss: LatexTemplate = {
  credit: ["resumezip's Swiss template"],
  preamble,
  body,
  fallbacks: HEROS_FALLBACKS,
}
