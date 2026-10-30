// Blueprint (templates/levelsfyi.typ): TeX Gyre Heros, a large bold name
// over where you are and how to reach you on the left and your profiles on
// the right, blue section titles over a blue rule, and justified text. Jobs
// are a line of three: the role, the organization centred, and the dates.

import {
  bold,
  bp,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  HEROS_FALLBACKS,
  itemText,
  joinPresent,
  latex,
  links,
  paragraphs,
  projectHeader,
  ROW,
  runs,
  sectionsOf,
  texGyre,
  underline,
  underlined,
  webLink,
  type LatexTemplate,
  type Units,
} from "../common"
import type { Paragraph, TemplateData } from "@/lib/typst/resumeData"

// Typst measures a space from one line's baseline down to the next line's cap
// height, and sets a paragraph's lines `LEADING` apart that way; TeX measures
// both from baseline to baseline. So a line's \baselineskip here is the cap
// height plus the leading, and a space above a line is the .typ's space less
// the leading, which \baselineskip adds back. Every line in the body is 10pt.
const CAP = 0.729 // TeX Gyre Heros's cap height, in em
const LEADING = 4.71 // levelsfyi.typ's leading, in points
// The rule under a section title: 1pt, drawn centred on its line in Typst.
const RULE = 1

/** The spaces that differ between Typst and TeX. */
function spacing(units: Units) {
  const points = (length: string) => parseFloat(length)
  const leading = points(units.space(LEADING))
  const line = (size: number) => points(units.size(size * CAP)) + leading
  /** A space the .typ puts above a line of text. */
  const above = (space: string) => bp(points(space) - leading)
  return {
    line: (size: number) => bp(line(size)),
    above,
    // titlesec ends a title with a strut, 0.3 of its line deep.
    titleToRule: bp(points(units.size(6.3)) - 0.3 * line(14) - RULE / 2),
    // What follows the rule is set as if after a line this deep, so it lands
    // where it does in the PDF, whatever its letters.
    afterRule: bp(leading - points(units.size(6.45)) + RULE / 2),
    // At the top of the page, back up over \topskip, the name's leading and 2.2pt more.
    nameTop: bp(-points(units.size(10 * CAP)) - leading - points(units.size(2.2))),
  }
}

const preamble = (units: Units, title: string, fallbacks: string) => {
  const space = spacing(units)
  return `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${texGyre("heros", fallbacks)}
\\usepackage[margin=${units.margin(0.4)}]{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{tabularx}
${links(title)}

\\definecolor{resumeBlue}{RGB}{17,85,204}

\\pagestyle{empty}
\\raggedbottom
\\frenchspacing
% Justified lines stretch further rather than run into the margin.
\\setlength{\\emergencystretch}{3em}
\\setlength{\\parindent}{0pt}
\\setlength{\\tabcolsep}{0pt}
% A page's first line as high as the PDF's: its cap height below the margin, if it's no taller
\\setlength{\\topskip}{${units.size(10 * CAP)}}

% Text sizes and line spacing, as Fine-tune sets them
\\renewcommand{\\normalsize}{\\fontsize{${units.size(10)}}{${space.line(10)}}\\selectfont}
\\renewcommand{\\large}{\\fontsize{${units.size(14)}}{${space.line(14)}}\\selectfont}
\\renewcommand{\\Huge}{\\fontsize{${units.size(24)}}{${space.line(24)}}\\selectfont}
\\normalsize

% Sections formatting: a blue title over a blue rule. \\prevdepth sets what
% follows from the rule, whatever its letters.
\\titleformat{\\section}{\\vspace{${space.above(units.gap(15.6))}}\\large\\bfseries\\color{resumeBlue}}{}{0em}{}
  [\\vspace{${space.titleToRule}}{\\color{resumeBlue}\\titlerule[${RULE}pt]}\\prevdepth=${space.afterRule}]
\\titlespacing*{\\section}{0pt}{0pt}{0pt}

%-------------------------
% Custom commands
${ROW}
% A job's columns are bottom-aligned too: a long role or organization wraps,
% and the others sit on its last line.
\\renewcommand{\\tabularxcolumn}[1]{b{#1}}

% The name, its capitals a little above the margin, and the space under it
\\newcommand{\\resumeName}[1]{%
  \\vspace*{${space.nameTop}}\\prevdepth=0pt
  {\\centering\\Huge\\bfseries #1\\par}%
  \\prevdepth=0pt\\vspace{${space.above(units.size(15.8))}}%
}

% How to reach you on the left, a profile on the right: on one line, 12pt or
% more apart, when they fit on it, and on a line each when they don't
\\newlength{\\resumeReach}
\\newlength{\\resumeProfile}
\\newcommand{\\resumeContact}[2]{%
  \\settowidth{\\resumeReach}{#1}\\settowidth{\\resumeProfile}{#2}%
  \\ifdim\\dimexpr\\resumeReach+12pt+\\resumeProfile\\relax>\\linewidth
    {\\raggedright #1\\par}{\\raggedleft #2\\par}%
  \\else
    {\\noindent #1\\hspace{12pt plus 1fill}#2\\par}%
  \\fi
}

% Entries, [the space between them] apart
\\newenvironment{resumeEntries}[1][${space.above(units.size(8.4))}]{%
  \\begin{itemize}[label={}, leftmargin=0pt, labelwidth=0pt, labelsep=0pt, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=#1]%
}{\\end{itemize}}

% An entry: what and where on the left, the dates in bold on the right
\\newcommand{\\resumeEntry}[2]{\\item\\resumeRow{#1}{\\textbf{#2}}}

% A job: the role, the organization centred on the page, and the dates. Each
% side keeps room for the dates and for the role up to a fifth of the line, at
% most a third of it; an organization wider than what's left wraps there.
\\newlength{\\resumeSide}
\\newlength{\\resumeMiddle}
\\newlength{\\resumeOrganization}
\\newcommand{\\resumeRole}[3]{%
  \\item
  \\settowidth{\\resumeSide}{\\textbf{#1}}%
  \\ifdim\\resumeSide>0.2\\linewidth \\setlength{\\resumeSide}{0.2\\linewidth}\\fi
  \\settowidth{\\resumeMiddle}{\\textbf{#3}}%
  \\ifdim\\resumeMiddle>\\resumeSide \\setlength{\\resumeSide}{\\resumeMiddle}\\fi
  \\ifdim\\resumeSide>\\dimexpr(\\linewidth-24pt)/3\\relax \\setlength{\\resumeSide}{\\dimexpr(\\linewidth-24pt)/3\\relax}\\fi
  \\setlength{\\resumeMiddle}{\\dimexpr\\linewidth-2\\resumeSide-24pt\\relax}%
  \\settowidth{\\resumeOrganization}{#2}%
  \\ifdim\\resumeOrganization>\\resumeMiddle
    \\resumeColumns{>{\\centering\\arraybackslash}b{\\resumeMiddle}}{#1}{#2}{#3}%
  \\else
    \\resumeColumns{c}{#1}{#2}{#3}%
  \\fi
}
% The role, the organization in the middle column it's given, and the dates
\\newcommand{\\resumeColumns}[4]{%
  \\begin{tabularx}{\\linewidth}{@{}>{\\raggedright\\arraybackslash}X@{\\hspace{12pt}}#1@{\\hspace{12pt}}>{\\raggedleft\\arraybackslash}X@{}}%
    \\textbf{#2} & #3 & \\textbf{#4}%
  \\end{tabularx}%
}

% Bullets, [the space above them] under what's above, and on its page;
% [more enumitem options]
\\NewDocumentEnvironment{resumeItems}{O{0pt} O{}}{%
  \\par\\nopagebreak\\vspace{#1}%
  \\begin{itemize}[label=\\textbullet, leftmargin=*, labelindent=11pt, labelsep=5pt, topsep=0pt, partopsep=0pt, parsep=0pt,
    itemsep=0pt, beginpenalty=10000, #2]%
}{\\end{itemize}}

% Paragraphs, as the summary's, 0.6em further apart than lines
\\newenvironment{resumeText}{%
  \\begin{itemize}[label={}, leftmargin=0pt, labelwidth=0pt, labelsep=0pt, topsep=0pt, partopsep=0pt,
    parsep=${units.size(6)}]\\item\\relax
}{\\end{itemize}}
`
}

function body(data: TemplateData, units: Units): string {
  const space = spacing(units)
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  // Bullets, `above` under what's above them, with more of enumitem's `options`.
  const items = (texts: string[], indent: string, above = "", options = "") => {
    if (!texts.length) return
    const args = options ? `[${above || "0pt"}][${options}]` : above ? `[${above}]` : ""
    add(
      `${indent}\\begin{resumeItems}${args}`,
      ...texts.map((text) => `${indent}  \\item ${itemText(text)}`),
      `${indent}\\end{resumeItems}`,
    )
  }
  const entries = (write: () => void, gap = "") => {
    add(`  \\begin{resumeEntries}${gap}`)
    write()
    add("  \\end{resumeEntries}")
  }
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  const heading = (title: string) => add("", `\\section{${title}}`)

  // Role / organization / dates entries: work, leadership and volunteering.
  const experience = (roles: TemplateData["leadership"]) =>
    entries(() => {
      for (const role of roles) {
        const organization = joinPresent(
          ", ",
          role.organization && bold(latex(role.organization)),
          role.location && `\\textit{${latex(role.location)}}`,
        )
        add(`    \\resumeRole{${latex(role.role)}}{${organization}}{${latex(dateRange(role.start, role.end))}}`)
        items(role.bullets.map(runs), "    ", space.above(units.space(8.5)))
      }
    })

  // Where you are and how to reach you on the left, your profiles on the right.
  const { profile } = data
  const reach = [latex(profile.location), latex(profile.phone), profile.email && emailLink(profile.email, underline)].filter(Boolean)
  const profiles = [profile.linkedin, profile.github, profile.website].filter(Boolean).map((url) => webLink(url, underline))
  if (profile.name || reach.length || profiles.length) {
    add(`\\resumeName{${latex(profile.name)}}`)
    for (let row = 0; row < Math.max(reach.length, profiles.length); row++) {
      add(`\\resumeContact{${reach[row] ?? ""}}{${profiles[row] ?? ""}}`)
    }
    add(`\\vspace{${units.size(5)}}`)
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
        else items(extra.bullets.map(runs), "  ")
        break
      }
      case "education":
        // A little more room around the schools, as the PDF has.
        add(`  \\vspace{${units.size(2)}}`)
        entries(() => {
          for (const school of data.education) {
            const what = [school.degree && `${bold(latex(`${school.degree},`))} `, latex(joinPresent(", ", school.school, school.location))]
            add(`    \\resumeEntry{${what.join("")}}{${latex(dateRange(school.start, school.end))}}`)
            const notes = [
              school.gpa && `GPA: ${school.gpa}`,
              school.coursework && `Relevant Coursework: ${school.coursework}`,
              school.involvement && `Involvement: ${school.involvement}`,
            ].filter(Boolean)
            items(
              notes.map((note) => latex(note)),
              "    ",
              space.above(units.space(6.6)),
              "labelindent=5.8pt, labelsep=4.1pt",
            )
          }
        })
        add(`  \\vspace{${units.size(1.4)}}`)
        break
      case "work":
        experience(data.work.map(({ company, ...job }) => ({ organization: company, ...job })))
        break
      case "leadership":
      case "volunteer":
        experience(data[section.kind])
        break
      case "projects":
        entries(
          () => {
            for (const project of data.projects) {
              add(`    \\resumeEntry{${projectHeader(project, "\\hspace{4pt}|\\hspace{4pt}", underlined)}}{${latex(project.date)}}`)
              items(project.bullets.map(runs), "    ", space.above(units.space(6.6)))
            }
          },
          `[${space.above(units.size(5.2))}]`,
        )
        break
      case "publications":
        add(
          citations(
            data.publications,
            underlined,
            `labelsep=0.7em, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${space.above(units.space(5.2))}`,
          ),
        )
        break
      case "skills":
        items(
          data.skills.map((skill) => `${skill.name ? `${bold(latex(`${skill.name}:`))}\\hspace{0.5em}` : ""}${latex(skill.details)}`),
          "  ",
        )
        break
      case "awards":
        items(
          data.awards.map((award) => {
            const what = `${bold(latex(award.name))}${award.name && award.organization ? ", " : ""}${latex(award.organization)}`
            return `\\resumeRow{${what}}{${bold(latex(award.date))}}`
          }),
          "  ",
        )
        break
    }
  }
  return lines.join("\n")
}

export const levelsfyi: LatexTemplate = {
  credit: ["resumezip's Blueprint template"],
  preamble,
  body,
  fallbacks: HEROS_FALLBACKS,
}
