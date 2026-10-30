// templates/resumeworded.typ ("Harvard") as LaTeX: EB Garamond, the name and
// headings in dark gray capitals over a dark rule, organizations in gray
// capitals with their place flush right, round bullets, and ragged-right
// text. Every space is the .typ's: a Typst v(x) puts the next line's capitals
// x below the line above, which here is x less the leading, since
// \baselineskip is cap height plus leading.

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
  minus,
  paragraphs,
  projectName,
  runs,
  sectionsOf,
  signs,
  sum,
  UNBROKEN_ROW,
  underline,
  underlined,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

/** The longer of two lengths that `Units` gave, as the .typ's `calc.max`. */
const longer = (a: string, b: string) => (parseFloat(a) >= parseFloat(b) ? a : b)

/** A contact item kept whole, as the .typ boxes them. Links are underlined, which keeps them whole too. */
const whole = (body: string) => `\\mbox{${body}}`

/** "Start – End", with an en dash. */
const dates = (start: string, end: string) => dateRange(latex(start), latex(end), " \\textendash{} ")

const FALLBACKS: Fallbacks = {
  comment: `EB Garamond has no ₿, which prints in Charis SIL, as in the PDF.`,
  fonts: [{ name: "EBGaramond", faces: true, someGreek: false }],
  families: [CHARIS],
  letters: [[signs("₿"), CHARIS]],
}

function preamble(units: Units, title: string, fallbacks: string): string {
  // EB Garamond's cap height is 0.65em: the .typ measures each space to a line's capitals.
  const leading = units.space(5.78)
  const line = (size: number) => sum(units.size(size * 0.65), leading)
  // As in the .typ, the first heading sits a little closer to the contact
  // line than later ones to each other, but no closer than the contact line
  // is to the name, counting the gap \resumeSection adds: a fixed 3.5pt less
  // would pull it into the contact line's descenders at the tightest section
  // spacing.
  const toFirstHeading = longer(units.size(-3.5), sum(units.size(6.38), minus(units.gap(17.85))))
  return `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
% EB Garamond's own figures: lining, of even width
\\ifPDFTeX
  \\usepackage[lining, tabular]{ebgaramond}
\\else
${fallbacks}  % Its OpenType files. The package would also ask for EB Garamond Initials, which not every TeX install has.
  \\usepackage{fontspec}
  \\setmainfont{EBGaramond}[Extension=.otf, UprightFont=*-Regular, ItalicFont=*-Italic, BoldFont=*-Bold, BoldItalicFont=*-BoldItalic]
\\fi
\\usepackage[left=${units.margin(0.6)}, right=${units.margin(0.6)}, top=${units.margin(0.58)}, bottom=${units.margin(0.5)}]{geometry}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{pict2e}
${links(title)}

\\definecolor{resumeText}{HTML}{1A1A1A}
\\definecolor{resumeDark}{HTML}{404040}
\\definecolor{resumeGray}{HTML}{595959}
\\definecolor{resumeLight}{HTML}{737373}
\\definecolor{resumeRule}{HTML}{262626}
\\AtBeginDocument{\\color{resumeText}}

\\pagestyle{empty}
\\raggedbottom
\\raggedright
\\frenchspacing
\\setlength{\\parskip}{0pt}

% Text sizes and line spacing, as Fine-tune sets them. Spaces keep their
% width, as the PDF's do: a word that doesn't fit goes to the next line
% rather than squeeze the spaces before it.
\\newcommand{\\resumeSpaces}{\\spaceskip=\\fontdimen2\\font\\relax}
\\renewcommand{\\normalsize}{\\fontsize{${units.size(10.8)}}{${line(10.8)}}\\selectfont\\resumeSpaces}
\\normalsize
\\setlength{\\topskip}{${units.size(7.02)}}
\\newcommand{\\resumeNameFont}{\\fontsize{${units.size(20)}}{${line(20)}}\\selectfont\\bfseries\\resumeSpaces}
\\newcommand{\\resumeHeadingFont}{\\fontsize{${units.size(12)}}{${line(12)}}\\selectfont\\bfseries\\resumeSpaces}

% Lists start and end flush with the text around them, and stay with what's above them.
\\setlist{topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=0pt, beginpenalty=10000}

%-------------------------
% Custom commands

% The name in capitals, and the contact line under it
\\newenvironment{resumeHeader}{\\centering\\lineskiplimit=-\\maxdimen}{\\par\\vspace{${toFirstHeading}}}
% An empty box takes the page's first line, so the name's capitals sit at the
% top margin however tall its accents are.
\\newcommand{\\resumeName}[1]{\\hbox{}\\vspace{${minus(line(10.8))}}{\\resumeNameFont\\textcolor{resumeDark}{\\MakeUppercase{#1}}\\par}}
\\newcommand{\\resumeContacts}[1]{\\vspace{${sum(units.size(6.38), minus(leading))}}#1\\par}

% A heading in capitals over a dark rule, kept with what follows it.
\\newcommand{\\resumeSection}[1]{%
  \\par\\vspace{${sum(units.gap(17.85), minus(leading))}}%
  {\\resumeHeadingFont\\textcolor{resumeDark}{\\MakeUppercase{#1}}\\par}%
  \\nobreak\\vskip\\dimexpr${sum(units.size(4), "-0.4pt")}-\\prevdepth\\relax
  {\\color{resumeRule}\\hrule height 0.8pt}%
  % The next line's capitals sit ${units.size(10.38)} under the rule.
  \\nobreak\\prevdepth=${sum("0.4pt", leading, minus(units.size(10.38)))}
}

${UNBROKEN_ROW}
% An organization in gray capitals and its place, then the line under it
\\newcommand{\\resumeOrganization}[2]{\\resumeRow{\\textbf{\\textcolor{resumeGray}{\\MakeUppercase{#1}}}}{#2}}
\\newcommand{\\resumeSubRow}[2]{\\nobreak\\resumeRow{#1}{#2}}

% Round bullets at the margin, drawn: EB Garamond's own is small.
\\newcommand{\\resumeBullet}{%
  \\raisebox{${units.size(1.22)}}{\\setlength{\\unitlength}{${units.size(1.8)}}\\begin{picture}(2,2)\\put(1,1){\\circle*{2}}\\end{picture}}%
}
\\newenvironment{resumeItems}{%
  \\nobreak\\begin{itemize}[label=\\resumeBullet, align=left, labelindent=0pt, labelsep=10.7pt, leftmargin=*]%
}{\\end{itemize}\\vspace{${units.size(3.3)}}}

% Paragraphs, as the summary's, 0.6em further apart than lines
\\newenvironment{resumeText}{%
  \\begin{itemize}[label={}, leftmargin=0pt, labelwidth=0pt, labelsep=0pt, parsep=${units.size(6.48)}]\\item\\relax
}{\\end{itemize}}

% The space between entries
\\newcommand{\\resumeEntryGap}{\\vspace{${sum(units.size(13.58), minus(leading))}}}
`
}

function body(data: TemplateData, units: Units): string {
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)

  const bullets = (items: Run[][]) => {
    if (items.length) add("  \\begin{resumeItems}", ...items.map((item) => `    \\item ${itemText(runs(item))}`), "  \\end{resumeItems}")
  }
  const text = (texts: Paragraph[]) => add("  \\begin{resumeText}", paragraphs(texts), "  \\end{resumeText}")
  // The organization and its place, the line under it, then lines of details or bullets.
  const subheading = (organization: string, place: string, bottomLeft: string, bottomRight: string, details: string[], items: Run[][]) => {
    if (organization || place) add(`  \\resumeOrganization{${latex(organization)}}{${latex(place)}}`)
    if (bottomLeft || bottomRight) add(`  \\resumeSubRow{${bottomLeft}}{${bottomRight}}`)
    for (const detail of details) add(`  ${detail}\\par`)
    bullets(items)
  }
  const entries = <T>(list: T[], write: (entry: T) => void) =>
    list.forEach((entry, index) => {
      if (index) add("  \\resumeEntryGap")
      write(entry)
    })
  const heading = (title: string) => add("", `\\resumeSection{${title}}`)

  const { profile } = data
  const contacts = [
    profile.location && whole(latex(profile.location)),
    profile.phone && whole(latex(`P: ${profile.phone}`)),
    profile.email && emailLink(profile.email, underline),
    profile.linkedin && webLink(profile.linkedin, underline),
    profile.github && webLink(profile.github, underline),
    profile.website && webLink(profile.website, underline),
  ].filter(Boolean)
  add("\\begin{resumeHeader}")
  if (profile.name) add(`  \\resumeName{${latex(profile.name)}}`)
  if (contacts.length) add("  \\resumeContacts{", `    ${contacts.join(" |\n    ")}`, "  }")
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
          add(`  \\vspace{${units.space(5.78)}}`)
          bullets(extra.bullets)
        }
        break
      }
      case "education":
        entries(data.education, (school) => {
          const details = [
            school.gpa && `Cumulative GPA: ${latex(school.gpa)}`,
            school.coursework && `Relevant Coursework: ${latex(school.coursework)}`,
            school.involvement && `Involvement: ${latex(school.involvement)}`,
          ].filter(Boolean)
          const degree = school.degree && `\\textcolor{resumeLight}{${latex(school.degree)}}`
          subheading(school.school, school.location, degree, dates(school.start, school.end), details, [])
        })
        break
      case "work":
        entries(data.work, (job) => subheading(job.company, job.location, latex(job.role), dates(job.start, job.end), [], job.bullets))
        break
      case "leadership":
      case "volunteer":
        entries(data[section.kind], (role) =>
          subheading(role.organization, role.location, latex(role.role), dates(role.start, role.end), [], role.bullets),
        )
        break
      case "projects":
        entries(data.projects, (project) => {
          // The name in capitals, then the tech stack and any links in gray.
          const name = project.name && latex(project.name)
          const parts = [project.techStack && latex(project.techStack), ...project.links.map((url) => webLink(url, underline))].filter(
            Boolean,
          )
          const left = [
            name && bold(projectName(project, (body) => `\\MakeUppercase{${body}}`)),
            parts.length > 0 && `\\textcolor{resumeGray}{${name ? "| " : ""}${parts.join(" | ")}}`,
          ].filter(Boolean)
          add(`  \\resumeRow{${left.join(" ")}}{${latex(project.date)}}`)
          bullets(project.bullets)
        })
        break
      case "publications":
        add(citations(data.publications, underlined, "labelsep=0.7em"))
        break
      case "skills":
        add(
          `  ${data.skills.map((skill) => `${skill.name ? `${bold(latex(`${skill.name}:`))} ` : ""}${latex(skill.details)}`).join("\\newline\n  ")}\\par`,
        )
        break
      case "awards":
        for (const award of data.awards) {
          const organization = award.organization && `, ${latex(award.organization)}`
          add(`  \\resumeRow{${award.name ? bold(latex(award.name)) : ""}${organization}}{${latex(award.date)}}`)
        }
        break
    }
  }
  return lines.join("\n")
}

export const resumeworded: LatexTemplate = {
  credit: ["resumezip's Harvard template, in the format Harvard's career office recommends"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
