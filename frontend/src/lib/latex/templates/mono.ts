// resumezip's Mono (templates/mono.typ): everything in IBM Plex Mono, with
// semibold for what's bold, capital section titles over grey dashed rules,
// hyphen bullets, and grey for what's secondary.
//
// Typst measures the space between two blocks from one line's baseline to
// the top of the next one's capitals, where TeX adds it to the space between
// lines. A negative \parskip takes that back, so the spaces below are the
// .typ's own lengths.

import {
  bold,
  CHARIS,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  fontSize,
  GREEK,
  joinPresent,
  latex,
  links,
  paragraphs,
  PLAIN_ROW,
  projectHeader,
  runs,
  sectionsOf,
  SOURCE_SANS,
  stretch,
  sum,
  underline,
  underlined,
  unlessPdfLatex,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

const SIZE = 8.4
/** IBM Plex Mono's capital height, in em: where Typst measures a line's top from. */
const CAP = 0.698
/** The space between lines, in em, as `leading` in mono.typ. */
const LEADING = 0.52
const NAME = 18

const FALLBACKS: Fallbacks = {
  comment: `IBM Plex Mono has no Greek but π, so all of Greek prints in Source Sans Pro
(Source Sans 3 under its older name), as in the PDF.`,
  fonts: [{ name: "IBMPlexMono", faces: true, someGreek: true }],
  families: [SOURCE_SANS, CHARIS],
  letters: [[GREEK, SOURCE_SANS]],
}

const preamble = (units: Units, title: string, fallbacks: string) => `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${unlessPdfLatex(fallbacks)}% IBM Plex Mono for everything, with its semibold as bold
\\usepackage[semibold]{plex-mono}
\\renewcommand*\\familydefault{\\ttdefault}
\\usepackage[left=${units.margin(0.55)}, right=${units.margin(0.55)}, top=${units.margin(0.5)}, bottom=${units.margin(0.42)}]{geometry}
\\usepackage{xcolor}
\\usepackage{tabularx}
\\usepackage{enumitem}
\\ifPDFTeX
  % For \\textls, which spaces out the section titles
  \\usepackage[protrusion=false, expansion=false]{microtype}
\\fi
${links(title)}

\\definecolor{ink}{HTML}{111111}
\\definecolor{grey}{RGB}{105,105,105}
\\definecolor{rulegrey}{RGB}{150,150,150}
\\AtBeginDocument{\\color{ink}}

% Text sizes and line spacing, as Fine-tune sets them: a line is its
% capitals' height and the gap above them
\\renewcommand{\\normalsize}{${fontSize(units, SIZE, CAP, LEADING)}\\selectfont}
\\newcommand{\\nameSize}{${fontSize(units, NAME, CAP, LEADING)}\\selectfont}
\\normalsize
% Each \\vspace below runs from a line to the top of the next line's
% capitals, as in the PDF, so a new paragraph takes back the gap above them
\\setlength{\\parskip}{${units.space(-LEADING * SIZE)}}
\\setlength{\\topskip}{${units.size(CAP * SIZE)}}

\\pagestyle{empty}
\\raggedbottom
\\raggedright
\\frenchspacing

% Section titles spaced out by 0.04em
\\ifPDFTeX
  \\newcommand{\\tracked}[1]{\\textls*[40]{#1}}
\\else
  \\newcommand{\\tracked}[1]{{\\addfontfeatures{LetterSpace=4}#1}}
\\fi

%-------------------------
% Custom commands

% The name, and where you are and how to reach you under it. Lines are placed
% by their baselines alone, however deep the name's letters go.
\\newcommand{\\resumeName}[1]{\\par\\noindent{\\nameSize\\bfseries #1\\par}}
\\newcommand{\\resumeContacts}[1]{\\par\\vspace{${units.size(6)}}{\\lineskiplimit=-\\maxdimen\\noindent\\color{grey}#1\\par}}
\\newcommand{\\contactGap}{\\hspace{1.5em}}

% A section title in capitals over a grey dashed rule: 2pt dashes, 2pt apart
\\newcommand{\\dashedRule}{\\leaders\\hbox to 4pt{\\rule[-${sum(units.size(4), "0.3pt")}]{2pt}{0.6pt}\\hss}\\hskip\\linewidth}
\\newcommand{\\resumeSection}[1]{%
  \\par\\vspace{${units.gap(13)}}%
  \\noindent\\rlap{\\smash{\\color{rulegrey}\\dashedRule}}%
  \\textbf{\\tracked{\\MakeUppercase{#1}}}\\par
  \\nobreak\\addvspace{${units.size(10)}}%
}

${PLAIN_ROW}

% An entry: the organization in bold and its dates, then the role and the
% place, when there's either. After a section title (the space it ends with),
% only the title's own space.
\\newcommand{\\resumeEntry}[4]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.size(7.5)}}\\fi
  \\resumeRow{\\textbf{#1}}{\\textcolor{grey}{#2}}%
  \\if\\relax\\detokenize{#3#4}\\relax\\else
    \\nobreak\\vspace{${units.space(3.2)}}%
    \\resumeRow{#3}{\\textcolor{grey}{#4}}%
  \\fi
  \\nobreak
}

% A project: its name, stack and links, and its date
\\newcommand{\\resumeProject}[2]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.size(7.5)}}\\fi
  \\resumeRow{#1}{\\textcolor{grey}{#2}}\\nobreak
}

% An award: its name in bold, who gave it, and its date
\\newcommand{\\resumeAward}[3]{%
  \\par\\ifdim\\lastskip=0pt \\vspace{${units.space(4.2)}}\\fi
  \\resumeRow{\\textbf{#1}\\if\\relax\\detokenize{#2}\\relax\\else\\barSep #2\\fi}{\\textcolor{grey}{#3}}%
}

\\newcommand{\\barSep}{ \\textcolor{grey}{\\textbar} }

% Bullets: a grey hyphen, its text 1em after it, and wrapped lines under the text
\\newenvironment{resumeItems}{\\par\\vspace{${units.space(3.6)}}\\let\\itemGap\\relax}{\\par}
\\newcommand{\\resumeItem}[1]{%
  \\par\\itemGap\\def\\itemGap{\\vspace{${units.space(3.4)}}}%
  \\noindent\\hangindent=1.6em
  \\makebox[1.6em][l]{\\textcolor{grey}{-}}#1\\par
}

% Paragraphs, as the summary's, 0.6em further apart than lines
\\newenvironment{resumeText}{\\par\\noindent\\setlength{\\parskip}{${units.size(0.6 * SIZE)}}\\ignorespaces}{\\par}

% Skills: the names in a column as wide as the widest, the rest beside them.
% \\prevdepth puts what comes next as far below as after a line of text.
\\newenvironment{resumeSkills}{%
  \\par\\noindent
  \\renewcommand{\\arraystretch}{${stretch(units, SIZE, CAP, LEADING, 4)}}%
  \\tabularx{\\linewidth}[t]{@{}l@{\\hspace{1.5em}}X@{}}%
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
  const entry = (org: string, start: string, end: string, role: string, place: string, bullets: Run[][]) => {
    add(`  \\resumeEntry{${latex(org)}}{${latex(dateRange(start, end))}}{${latex(role)}}{${latex(place)}}`)
    items(bullets.map(runs))
  }
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
  if (contacts.length) {
    // Where you are and how to reach you on one line, your profiles on the next.
    const first = contacts.slice(0, 3).join("\\contactGap\n  ")
    const rest = contacts.slice(3).join("\\contactGap\n  ")
    add("\\resumeContacts{%", `  ${first}${rest ? `\\newline\n  ${rest}` : ""}%`, "}")
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
        else items(extra.bullets.map(runs))
        break
      }
      case "education":
        for (const school of data.education) {
          const degree = joinPresent(", ", school.degree, school.gpa && `GPA ${school.gpa}`)
          add(
            `  \\resumeEntry{${latex(school.school)}}{${latex(dateRange(school.start, school.end))}}{${latex(degree)}}{${latex(school.location)}}`,
          )
          items(
            [
              ["Coursework:", school.coursework],
              ["Involvement:", school.involvement],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => `${label} ${latex(value)}`),
          )
        }
        break
      case "work":
        data.work.forEach((job) => entry(job.company, job.start, job.end, job.role, job.location, job.bullets))
        break
      case "leadership":
      case "volunteer":
        data[section.kind].forEach((role) => entry(role.organization, role.start, role.end, role.role, role.location, role.bullets))
        break
      case "projects":
        for (const project of data.projects) {
          add(`  \\resumeProject{${projectHeader(project, "\\barSep ", underlined)}}{${latex(dateRange(project.start, project.end))}}`)
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

export const mono: LatexTemplate = {
  credit: ["resumezip's Mono template"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
