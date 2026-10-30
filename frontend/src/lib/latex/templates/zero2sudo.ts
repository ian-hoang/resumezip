// resumezip's zero2sudo (templates/zero2sudo.typ): a Times page as a word
// processor sets one. The name large and bold on the left, capital headings
// over full-width rules, and each job's role and company in bold on one line
// with its dates. TeX Gyre Termes.
//
// Typst measures the space between two blocks from one line's baseline to
// the top of the next one's capitals, where TeX adds it to the space between
// lines. A negative \parskip takes that back, so the spaces below are the
// .typ's own lengths.

import {
  bold,
  citations,
  CHARIS,
  CYRILLIC,
  dateRange,
  EB_GARAMOND,
  emailLink,
  ENGINES,
  fontSize,
  GREEK,
  joinPresent,
  latex,
  links,
  paragraphs,
  PLAIN_ROW,
  projectName,
  runs,
  sectionsOf,
  signs,
  sum,
  texGyre,
  underline,
  underlined,
  web,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

const SIZE = 11
/** Headings of entries, the contact lines, skills and awards. */
const LARGE = 12
const TITLE = 12.5
const NAME = 28
/** TeX Gyre Termes's capital height, in em: where Typst measures a line's top from. */
const CAP = 0.662
/** The space between lines, in em, as `leading` in zero2sudo.typ. */
const LEADING = 0.4

const FALLBACKS: Fallbacks = {
  comment: `TeX Gyre Termes has no Cyrillic and only some Greek letters, so these print
as in the PDF: Cyrillic, all of Greek and ₹ ₽ ₺ ₴ in EB Garamond, and ₿ in
Charis SIL.`,
  fonts: [
    { name: "texgyretermes", faces: true, someGreek: true },
    { name: "ztm", faces: true, someGreek: true },
  ],
  families: [EB_GARAMOND, CHARIS],
  letters: [
    [GREEK, EB_GARAMOND],
    [CYRILLIC, EB_GARAMOND],
    [signs("₹₽₺₴"), EB_GARAMOND],
    [signs("₿"), CHARIS],
  ],
}

/** The \parskip that takes back a size's gap above its capitals, so a \vspace before a paragraph is the .typ's. */
const parskip = (units: Units, size: number) => `\\setlength{\\parskip}{${units.space(-LEADING * size)}}`

const preamble = (units: Units, title: string, fallbacks: string) => `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${texGyre("termes", fallbacks)}
\\usepackage{enumitem}
\\usepackage[left=${units.margin(0.45)}, right=${units.margin(0.45)}, top=${units.margin(0.45)}, bottom=${units.margin(0.4)}]{geometry}
${links(title)}

% Text sizes and line spacing, as Fine-tune sets them: a line is its
% capitals' height and the gap above them
\\renewcommand{\\normalsize}{${fontSize(units, SIZE, CAP, LEADING)}\\selectfont}
\\newcommand{\\largeSize}{${fontSize(units, LARGE, CAP, LEADING)}\\selectfont${parskip(units, LARGE)}}
\\newcommand{\\titleSize}{${fontSize(units, TITLE, CAP, LEADING)}\\selectfont${parskip(units, TITLE)}}
\\newcommand{\\nameSize}{${fontSize(units, NAME, CAP, LEADING)}\\selectfont${parskip(units, NAME)}}
\\normalsize
% Each \\vspace below runs from a line to the top of the next line's
% capitals, as in the PDF, so a new paragraph takes back the gap above them
${parskip(units, SIZE)}
\\setlength{\\topskip}{${units.size(CAP * SIZE)}}
\\setlength{\\parindent}{0pt}

\\pagestyle{empty}
\\raggedbottom
\\raggedright

%-------------------------
% Custom commands

% The name, and where you are and how to reach you on the lines under it
\\newcommand{\\resumeName}[1]{\\par{\\nameSize\\noindent\\textbf{#1}\\par}}
\\newcommand{\\resumeReach}[1]{\\par\\vspace{${units.size(10)}}{\\largeSize\\noindent#1\\par}}
\\newcommand{\\resumeWeb}[1]{\\par\\vspace{${units.space(6.5)}}{\\largeSize\\noindent#1\\par}}
\\newcommand{\\contactBar}{ | }

% A section title in bold capitals over a rule as wide as the page. The
% rule's line is no taller than the rule, so it sits 3pt under the title.
\\newcommand{\\resumeSection}[1]{%
  \\par\\vspace{${units.gap(20)}}%
  {\\titleSize\\noindent\\textbf{\\MakeUppercase{#1}}\\par}%
  \\nobreak\\vspace{${sum(units.size(3), units.size(-CAP * SIZE))}}%
  \\noindent\\smash{\\rule[-0.3pt]{\\linewidth}{0.6pt}}\\par
  \\nobreak\\addvspace{${units.size(10)}}%
}

${PLAIN_ROW}

% An entry: what and where in bold, its dates in bold,
% then a line in italics under it when there's one. After a section title
% (the space it ends with), only the title's own space.
\\newcommand{\\resumeEntry}[3]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.size(15)}}\\fi
  {\\largeSize\\resumeRow{\\textbf{#1}}{\\textbf{#2}}}%
  \\if\\relax\\detokenize{#3}\\relax\\else
    \\nobreak\\vspace{${units.space(6.5)}}%
    \\noindent\\textit{#3}\\par
  \\fi
  \\nobreak
}

% A school, its degree after it, and its dates, then its place in italics
\\newcommand{\\resumeSchool}[3]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.size(7)}}\\fi
  {\\largeSize\\resumeRow{#1}{#2}}%
  \\if\\relax\\detokenize{#3}\\relax\\else
    \\nobreak\\vspace{${units.space(6.5)}}%
    \\noindent\\textit{#3}\\par
  \\fi
  \\nobreak
}

% A project: its name in bold and its tech stack, then its links and its
% date in bold on a line of their own, each line only when it has something
\\newcommand{\\resumeProject}[3]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.size(15)}}\\fi
  \\if\\relax\\detokenize{#1}\\relax\\else
    {\\largeSize\\noindent#1\\par}%
    \\if\\relax\\detokenize{#2#3}\\relax\\else\\nobreak\\vspace{${units.space(6.5)}}\\fi
  \\fi
  \\if\\relax\\detokenize{#2#3}\\relax\\else
    \\resumeRow{#3}{\\textbf{#2}}%
  \\fi
  \\nobreak
}

% An award: its name in bold, who gave it, and its date
\\newcommand{\\resumeAward}[3]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.space(4.4)}}\\fi
  {\\largeSize\\resumeRow{\\textbf{#1}\\if\\relax\\detokenize{#2}\\relax\\else, #2\\fi}{#3}}%
}

% Bullets: in 0.13in from the margin, the text 0.12in after the bullet, and
% wrapped lines under the text
\\newlength{\\bulletWidth}
\\newenvironment{resumeItems}{\\par\\vspace{${units.space(4.4)}}\\let\\itemGap\\relax}{\\par}
\\newcommand{\\resumeItem}[1]{%
  \\par\\itemGap\\def\\itemGap{\\vspace{${units.space(4.4)}}}%
  \\settowidth{\\bulletWidth}{\\textbullet\\hspace{0.12in}}%
  \\noindent\\hangindent=\\dimexpr0.13in+\\bulletWidth\\relax
  \\hspace*{0.13in}\\makebox[\\bulletWidth][l]{\\textbullet}#1\\par
}

% Paragraphs, as the summary's, 0.6em further apart than lines
\\newenvironment{resumeText}{\\par\\noindent\\setlength{\\parskip}{${units.size(0.6 * SIZE)}}\\ignorespaces}{\\par}

% Skills: a line each, at the size of the entries' headings
\\newenvironment{resumeSkills}{\\par\\begingroup\\largeSize\\noindent\\ignorespaces}{\\par\\endgroup}
`

function body(data: TemplateData, units: Units): string {
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const items = (bullets: string[]) => {
    if (bullets.length) add("  \\begin{resumeItems}", ...bullets.map((item) => `    \\resumeItem{${item}}`), "  \\end{resumeItems}")
  }
  const experience = (role: string, org: string, start: string, end: string, place: string, bullets: Run[][]) => {
    add(`  \\resumeEntry{${latex(joinPresent(" | ", role, org))}}{${latex(dateRange(start, end))}}{${latex(place)}}`)
    items(bullets.map(runs))
  }
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  const heading = (title: string) => add("", `\\resumeSection{${title}}`)

  const { profile } = data
  const reach = [latex(profile.location), latex(profile.phone), profile.email && emailLink(profile.email)]
    .filter(Boolean)
    .map((item) => `\\mbox{${item}}`)
  const profiles = [profile.linkedin, profile.github, profile.website].filter(Boolean).map((url) => `\\mbox{${webLink(url, underline)}}`)
  if (profile.name) add(`\\resumeName{${latex(profile.name)}}`)
  if (reach.length) add("\\resumeReach{%", `  ${reach.join("\\contactBar\n  ")}%`, "}")
  if (profiles.length) add("\\resumeWeb{%", `  ${profiles.join("\\contactBar\n  ")}%`, "}")

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
          const title = [school.school && bold(latex(school.school)), latex(degree)].filter(Boolean).join(" - ")
          add(`  \\resumeSchool{${title}}{${latex(dateRange(school.start, school.end))}}{${latex(school.location)}}`)
          const notes = [
            ["Relevant Coursework:", school.coursework],
            ["Involvement:", school.involvement],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => `${bold(latex(label))} ${latex(value)}`)
          items(notes)
        }
        break
      case "work":
        data.work.forEach((job) => experience(job.role, job.company, job.start, job.end, job.location, job.bullets))
        break
      case "leadership":
      case "volunteer":
        data[section.kind].forEach((role) => experience(role.role, role.organization, role.start, role.end, role.location, role.bullets))
        break
      case "projects":
        for (const project of data.projects) {
          const title = [project.name && bold(projectName(project)), latex(project.techStack)].filter(Boolean).join("\\contactBar ")
          const urls = project.links.map((url) => `\\mbox{${underlined(web(url), url)}}`).join("\\contactBar ")
          add(`  \\resumeProject{${title}}{${latex(project.date)}}{${urls}}`)
          items(project.bullets.map(runs))
        }
        break
      case "publications": {
        // [1], [2], ... 0.7em before each, 4.4pt apart.
        const apart = sum(units.space(4.4), units.space(-LEADING * SIZE))
        add(citations(data.publications, underlined, `labelsep=0.7em, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${apart}`))
        break
      }
      case "skills":
        // Each line starts with a command or a brace, so a [ is never read as an option.
        add(
          "  \\begin{resumeSkills}",
          data.skills
            .map((skill) => `    ${skill.name ? `${bold(latex(`${skill.name}:`))} ` : ""}{${latex(skill.details)}}`)
            .join("\\newline\n"),
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

export const zero2sudo: LatexTemplate = {
  credit: ["resumezip's zero2sudo template"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
