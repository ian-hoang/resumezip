// Deedy (templates/deedy.typ), after Debarghya Das's Deedy resume
// (https://github.com/deedy/Deedy-Resume): the name large and light over a
// rule across the page, education and skills in a narrow column on the left,
// everything else on the right. Its commands keep Deedy's names (\section,
// \subsection, \runsubsection, \descript, \location, tightemize) where they
// do what Deedy's do, so it's familiar to anyone who has used it.
//
// The columns are paracol's rather than two minipages, so a long resume
// carries on onto the next page as the PDF's does (minipages can't break
// across pages), and the left column is written first, so hiring software
// reads it first.
//
// Typst puts the top of a line at its font's cap height and measures each
// v() from the baseline above, where TeX spaces baselines \baselineskip
// apart, so each line's command starts with the space that turns one into
// the other.

import {
  ARROWS,
  CHARIS,
  citations,
  dateRange,
  emailLink,
  ENGINES,
  GREEK,
  joinPresent,
  latex,
  LATO,
  links,
  minus,
  paragraphs,
  projectName,
  runs,
  sectionsOf,
  signs,
  sum,
  underline,
  underlined,
  unlessPdfLatex,
  VIETNAMESE,
  webLink,
  type Fallbacks,
  type LatexTemplate,
  type Section,
  type Units,
} from "../common"
import type { Paragraph, Run, TemplateData } from "@/lib/typst/resumeData"

// The .typ's text sizes, and its fonts' cap heights at those sizes (Lato
// Light 1415/2000, Lato Bold 1446/2000, Raleway 710/1000).
// prettier-ignore
const FONTS = {
  name:     { size: 38,   cap: 26.89 },
  contact:  { size: 10.8, cap: 7.67 },
  title:    { size: 16.5, cap: 11.67 },
  body:     { size: 10.3, cap: 7.29 },
  entry:    { size: 11.4, cap: 8.24 },
  descript: { size: 10.4, cap: 7.38 },
  location: { size: 9.7,  cap: 6.89 },
}
type Font = keyof typeof FONTS

const FALLBACKS: Fallbacks = {
  comment: `Raleway, in roles, dates and places, has only a few Greek letters and no
arrows, and TeX Live's is older than the PDF's: it has no Vietnamese ơ, ư or
ộ, nor ₺ ₴ ₫. These, and all of Greek, print in Lato, as the PDF prints what
its Raleway lacks. ₽ and ₿, which Lato lacks too, print in Charis SIL.`,
  fonts: [
    { name: "Lato", faces: true, someGreek: false },
    { name: "Raleway-Medium", faces: false, someGreek: true },
  ],
  families: [LATO, CHARIS],
  letters: [
    [GREEK, LATO],
    [VIETNAMESE, LATO],
    [ARROWS, LATO],
    [signs("₺₴₫"), LATO],
    [signs("₽₿"), CHARIS],
  ],
}

function preamble(units: Units, title: string, fallbacks: string): string {
  const cap = (font: Font) => units.size(FONTS[font].cap)
  /** The .typ's leading: half the text size, between one line's baseline and the next one's top. */
  const lead = (font: Font) => units.space(FONTS[font].size / 2)
  const baselineskip = (font: Font) => sum(cap(font), lead(font))
  const fontsize = (font: Font) => `\\fontsize{${units.size(FONTS[font].size)}}{${baselineskip(font)}}\\selectfont`
  /** A length of a section title's, scaled down as the title is when a word in it is too wide for its column. */
  const fitted = (length: string) => `\\dimexpr${length}*\\linewidth/\\widesttitleword\\relax`
  /**
   * The space before a line in `font` whose paragraph ends in the body's
   * size, so it's `space` below the baseline above, as the .typ's v() is.
   */
  const above = (font: Font, space = "0bp") => sum(space, cap(font), minus(baselineskip("body")))
  /** The same for a line whose paragraph ends in its own `font`. */
  const before = (font: Font, space = "0bp") => sum(space, minus(lead(font)))
  const bulletSpace = before("body", units.space(4.2))

  return `\\documentclass[${units.paper("letterpaper")}]{article}

${ENGINES}
${unlessPdfLatex(fallbacks)}% Lato: light for text, bold for names and hairline for first names
\\usepackage[default]{lato}
% Raleway Medium, with lining figures, for roles, dates and places
\\ifPDFTeX
  \\newcommand*{\\raleway}{\\fontfamily{Raleway-TLF}\\fontseries{mb}\\selectfont}
\\else
  \\newfontfamily{\\ralewayfamily}{Raleway-Medium.otf}[Ligatures=TeX, Numbers={Lining,Proportional}]
  \\newcommand*{\\raleway}{\\fontseries{m}\\ralewayfamily}
\\fi
% Text in Lato Light; \\textbf is still Lato Bold.
\\renewcommand*{\\mddefault}{l}
\\usepackage[left=${units.margin(0.5)}, right=${units.margin(0.5)}, top=${units.margin(0.42)}, bottom=${units.margin(0.4)}]{geometry}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{tabularx}
\\usepackage{paracol}
${links(title)}

\\pagestyle{empty}
\\raggedright
\\frenchspacing
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
% A page's first line sits at its top margin, as in the PDF.
\\setlength{\\topskip}{0pt}
% Words aren't broken with a hyphen at the end of a line, as in the PDF,
% unless one is too wide for the left column (\\narrowpar).
\\hyphenpenalty=10000

% Deedy's colors: headings, subheadings and the text's grey
\\definecolor{headings}{HTML}{6A6A6A}
\\definecolor{subheadings}{HTML}{333333}
\\definecolor{text}{HTML}{444444}
\\AtBeginDocument{\\color{text}}

% Text sizes and line spacing, as Fine-tune sets them. The space between
% words is as the PDF prints it: Lato's pinned to 0.2025em, and Raleway's
% own, which its small capitals would make narrower.
\\newcommand*{\\latospace}{\\spaceskip=0.2025em\\relax}
\\newcommand*{\\ralewayspace}{\\spaceskip=0.253em\\relax}
\\renewcommand{\\normalsize}{${fontsize("body")}\\latospace}
\\normalsize
\\newcommand{\\namefont}{${fontsize("name")}\\latospace\\color{headings}}
\\newcommand{\\contactfont}{\\raleway${fontsize("contact")}\\ralewayspace}
\\newcommand{\\titlefont}{\\fontsize{${fitted(units.size(FONTS.title.size))}}{${fitted(baselineskip("title"))}}\\selectfont\\latospace\\color{headings}}
\\newcommand{\\entryfont}{${fontsize("entry")}\\bfseries\\latospace\\color{subheadings}}
\\newcommand{\\descriptfont}{\\raleway${fontsize("descript")}\\ralewayspace\\scshape\\color{subheadings}}
\\newcommand{\\locationfont}{\\raleway${fontsize("location")}\\ralewayspace\\color{headings}}

%-------------------------
% The name, first names in hairline, and a line or two of contacts under it
\\newcommand{\\namesection}[2]{{\\namefont{\\fontseries{ul}\\selectfont #1} #2\\par}}
\\newcommand{\\firstcontactline}[1]{\\par\\vspace{${before("contact", units.size(12))}}{\\contactfont #1\\par}}
\\newcommand{\\contactline}[1]{\\par\\vspace{${before("contact", units.size(5))}}{\\contactfont #1\\par}}
\\newcommand{\\contactsep}{\\hspace{0.35em}|\\hspace{0.35em}}
% A rule across the whole page
\\newcommand{\\namerule}{%
  \\par\\vspace{${sum(units.size(9), "0.25bp", minus(baselineskip("body")))}}%
  \\makebox[\\linewidth]{\\color{headings}\\rule{\\paperwidth}{0.5bp}}\\par
  \\vspace{${sum(units.size(12), "-0.25bp")}}%
}

% Two columns: education and skills on the left, the rest on the right
\\setcolumnwidth{0.32\\textwidth/0.3in}

% A section's title in light capitals, and the space between two sections.
% A title wraps between its words, but a word can't, so a title with a word
% wider than its column is set just small enough for that word to fit, as
% in the PDF: \\widesttitleword is that word's width, or the column's.
\\newlength{\\titleword}
\\newlength{\\widesttitleword}
\\def\\measuretitle#1 #2\\relax{%
  \\settowidth{\\titleword}{${fontsize("title")}\\MakeUppercase{#1}}%
  \\ifdim\\titleword>\\widesttitleword\\setlength{\\widesttitleword}{\\titleword}\\fi
  \\if\\relax\\detokenize{#2}\\relax\\else\\measuretitle#2\\relax\\fi
}
\\renewcommand{\\section}[1]{%
  \\par\\setlength{\\widesttitleword}{\\linewidth}\\measuretitle#1 \\relax
  \\vspace{${fitted(before("title"))}}{\\titlefont\\MakeUppercase{#1}\\par}\\nopagebreak\\vspace{${units.size(7)}}%
}
\\newcommand{\\sectionsep}{\\par\\vspace{${units.gap(13)}}}

% Names are printed in capitals; a linked name's address is left as it is.
\\providecommand{\\AddToNoCaseChangeList}[1]{}
\\AddToNoCaseChangeList{\\href}

% An entry's name in bold capitals, on a line of its own...
\\newcommand{\\nameline}[1]{\\par\\vspace{${before("entry")}}{\\entryfont\\MakeUppercase{#1}\\par}}
% ...or followed by its role, as \\runsubsection{Name}\\descript{| Role}
\\newcommand{\\runsubsection}[1]{\\par\\vspace{${above("entry")}}{\\entryfont\\MakeUppercase{#1}}\\hspace{0.4em}}
\\newcommand{\\descript}[1]{{\\descriptfont #1}}
% Its dates and place
\\newcommand{\\location}[1]{\\par\\nopagebreak\\vspace{${before("location", units.space(4.4))}}{\\locationfont #1\\par}}
% The space between two entries
\\newcommand{\\entrysep}{\\par\\vspace{${units.size(9)}}}

% The left column is narrow, and a word too wide for it would run on into the
% right one. So there, as in the PDF, such a word breaks after a comma,
% semicolon or slash (\\wordbreak), or else with a hyphen. Ragged lines all
% cost TeX the same, so the penalties keep it from breaking a word that fits.
% \\narrowpar starts each paragraph there, with glue, since TeX only
% hyphenates a word that comes after glue.
\\newcommand*{\\wordbreak}{\\penalty1000\\relax}
\\newcommand*{\\narrowpar}{\\leavevmode\\hyphenpenalty=1000\\relax\\nobreak\\hspace{0pt}}

% A school's or a skill's name, on the left, as Deedy's \\subsection
\\renewcommand{\\subsection}[1]{\\par\\vspace{${before("entry")}}{\\entryfont\\narrowpar\\MakeUppercase{#1}\\par}}

% Education: the degree, its dates, place and GPA, involvement and coursework
\\newcommand{\\degree}[1]{\\par\\nopagebreak\\vspace{${before("descript", units.space(3.4))}}{\\descriptfont\\narrowpar #1\\par}}
\\newcommand{\\detail}[1]{\\par\\nopagebreak\\vspace{${before("location", units.space(3.4))}}{\\locationfont\\narrowpar #1\\par}}
\\newcommand{\\involvement}[1]{\\par\\vspace{${above("body", units.space(3.4))}}{\\narrowpar Involvement: #1\\par}}
\\newcommand{\\coursework}[1]{\\par\\vspace{${above("descript", units.space(5))}}{\\narrowpar\\descript{Coursework:} #1\\par}}

% A skill: its name, if it has one, over its details; and the space between two
\\newcommand{\\skill}[2]{%
  \\if\\relax\\detokenize{#1}\\relax\\par\\vspace{${before("body")}}%
  \\else\\subsection{#1}\\vspace{${before("body", units.space(3.4))}}\\fi
  {\\narrowpar #2\\par}%
}
\\newcommand{\\skillsep}{\\par\\vspace{${units.size(8)}}}

% Bullets
\\newenvironment{tightemize}{%
  \\par\\nopagebreak\\vspace{${bulletSpace}}%
  \\begin{itemize}[label=\\textbullet, leftmargin=*, labelindent=3bp, labelsep=6bp, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${bulletSpace}]%
}{\\end{itemize}}

% Paragraphs, as the summary's, 0.6em further apart than lines. The first one gets \\parskip too, so it's taken back.
\\newenvironment{paragraphs}{%
  \\par\\setlength{\\parskip}{${units.size(6.18)}}\\vspace{${before("body", minus(units.size(6.18)))}}%
}{\\par}

% Publications, numbered
\\newenvironment{publications}{\\par\\vspace{${before("body")}}}{\\par}

% Awards: the date, then the award in regular weight and who gave it
\\newcommand{\\award}[1]{{\\fontseries{m}\\selectfont #1}}
\\newenvironment{awards}{%
  \\par\\vspace{${before("body")}}%
  \\tabularx{\\linewidth}[t]{@{}>{\\locationfont}r@{\\hspace{0.9em}}>{\\raggedright\\arraybackslash}X@{}}%
}{%
  \\endtabularx\\par
  % What comes next is spaced from the table's last line, not its foot.
  \\prevdepth=\\dp\\strutbox
}
`
}

function body(data: TemplateData, units: Units): string {
  const lines: string[] = []
  const add = (...more: string[]) => lines.push(...more)
  /** Each of `entries`, `separator` between them. */
  const join = (separator: string, entries: (() => void)[]) =>
    entries.forEach((write, index) => {
      if (index) add(separator)
      write()
    })

  const bullets = (items: Run[][]) => {
    if (!items.length) return
    add("  \\begin{tightemize}", ...items.map((item) => `    \\item\\relax ${runs(item)}`), "  \\end{tightemize}")
  }
  const text = (texts: Paragraph[]) => add("\\begin{paragraphs}", paragraphs(texts, "  "), "\\end{paragraphs}")

  /** An entry on the right: its name and role, its dates and place, its bullets. */
  const entry = (name: string, role: string, when: string, items: Run[][]) => {
    add(role ? `\\runsubsection{${name}}\\descript{| ${role}}` : `\\nameline{${name}}`)
    if (when) add(`\\location{${when}}`)
    bullets(items)
  }
  /** A job, or a role in leadership or volunteering. */
  const experience = (name: string, role: string, start: string, end: string, location: string, items: Run[][]) =>
    entry(latex(name), latex(role), latex(joinPresent(" | ", dateRange(start, end), location)), items)

  /**
   * Text in the left column, which may break after a comma, semicolon or
   * slash with no space after it. Not before a backslash: that's an escaped
   * character, or the \kern that keeps two commas from printing as „.
   */
  const narrow = (value: string) => latex(value).replace(/[,;/](?=[^\s\\])/g, "$&\\wordbreak ")
  const left = (section: Section) => {
    if (section.kind === "education")
      join(
        "\\entrysep",
        data.education.map((school) => () => {
          add(`\\subsection{${narrow(school.school)}}`)
          if (school.degree) add(`\\degree{${narrow(school.degree)}}`)
          const when = joinPresent(" | ", dateRange(school.start, school.end), school.location)
          if (when) add(`\\detail{${narrow(when)}}`)
          if (school.gpa) add(`\\detail{GPA: ${narrow(school.gpa)}}`)
          if (school.involvement) add(`\\involvement{${narrow(school.involvement)}}`)
          if (school.coursework) add(`\\coursework{${narrow(school.coursework)}}`)
        }),
      )
    else if (section.kind === "skills")
      join(
        "\\skillsep",
        data.skills.map((skill) => () => add(`\\skill{${narrow(skill.name)}}{${narrow(skill.details)}}`)),
      )
  }

  const right = (section: Section) => {
    switch (section.kind) {
      case "extra":
        if (section.extra.kind === "text") text(section.extra.paragraphs)
        else bullets(section.extra.bullets)
        break
      case "work":
        join(
          "\\entrysep",
          data.work.map((job) => () => experience(job.company, job.role, job.start, job.end, job.location, job.bullets)),
        )
        break
      case "leadership":
      case "volunteer":
        join(
          "\\entrysep",
          data[section.kind].map(
            (role) => () => experience(role.organization, role.role, role.start, role.end, role.location, role.bullets),
          ),
        )
        break
      case "projects":
        join(
          "\\entrysep",
          data.projects.map((project) => () => {
            const when = [latex(project.date), ...project.links.map((url) => webLink(url, underline))].filter(Boolean).join(" | ")
            entry(projectName(project), latex(project.techStack), when, project.bullets)
          }),
        )
        break
      case "publications": {
        const spacing = `labelsep=0.7em, topsep=0pt, partopsep=0pt, parsep=0pt, itemsep=${sum(units.space(6), minus(units.space(FONTS.body.size / 2)))}`
        add("\\begin{publications}", citations(data.publications, underlined, spacing), "\\end{publications}")
        break
      }
      case "awards":
        add(
          "\\begin{awards}",
          ...data.awards.map((award) => {
            const organization = award.organization ? ` | ${latex(award.organization)}` : ""
            return `  ${latex(award.date)} & \\award{${latex(award.name)}}${organization} \\\\`
          }),
          "\\end{awards}",
        )
        break
    }
  }

  /** A column's sections, each a title over what `write` writes. */
  const column = (sections: { heading: string; write: () => void }[]) =>
    join(
      "\\sectionsep",
      sections.map(({ heading, write }) => () => {
        add("", `\\section{${heading}}`)
        write()
      }),
    )

  // ---------- Heading ----------
  const { profile } = data
  const words = profile.name.split(" ").filter(Boolean)
  const profiles = [profile.website, profile.linkedin, profile.github].filter(Boolean).map((url) => webLink(url, underline))
  const reach = [profile.email && emailLink(profile.email, underline), latex(profile.phone), latex(profile.location)].filter(Boolean)
  const contacts = [profiles, reach].filter((items) => items.length)

  add("{\\centering")
  if (words.length) add(`  \\namesection{${latex(words.slice(0, -1).join(" "))}}{${latex(words.at(-1)!)}}`)
  contacts.forEach((items, index) =>
    add(`  \\${index ? "contactline" : "firstcontactline"}{${items.map((item) => `\\mbox{${item}}`).join("\\contactsep\n    ")}}`),
  )
  add("\\par}", "\\namerule")

  // ---------- Sections ----------
  const sections = sectionsOf(data)
  const onLeft = sections.filter((section) => section.kind === "education" || section.kind === "skills")
  const rightColumn = sections
    .filter((section) => !onLeft.includes(section))
    .map((section) => ({ heading: section.heading, write: () => right(section) }))
  if (data.summary.length) rightColumn.unshift({ heading: "Summary", write: () => text(data.summary) })

  if (onLeft.length || rightColumn.length) {
    add("", "\\begin{paracol}{2}")
    column(onLeft.map((section) => ({ heading: section.heading, write: () => left(section) })))
    add("", "\\switchcolumn")
    column(rightColumn)
    add("", "\\end{paracol}")
  }
  return lines.join("\n")
}

export const deedy: LatexTemplate = {
  credit: ["After Debarghya Das's Deedy resume: https://github.com/deedy/Deedy-Resume"],
  preamble,
  body,
  fallbacks: FALLBACKS,
}
