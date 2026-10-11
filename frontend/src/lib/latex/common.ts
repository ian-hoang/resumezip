// What every template's LaTeX file shares, as templates/common.typ is for the
// Typst templates: text escaped so it prints as typed, links, citations,
// project headers, Fine-tune's multiples as lengths, the resume's sections in
// its order, and the preamble every file starts with. Each template in
// templates/ writes its own preamble and body with these.

import { SECTIONS, type SectionName } from "@/components/editor/sections"
import type { ExtraTemplateSection, Run, TemplateData } from "@/lib/typst/resumeData"
import type { PrintedTune } from "@/lib/tune"

/** A template's LaTeX: its preamble, after \documentclass, and its body. */
export interface LatexTemplate {
  /**
   * Lines naming what it's drawn from, for the comment at the top of the
   * file, as "Based on Jake's Resume: https://github.com/jakegut/resume".
   */
  credit: string[]
  /**
   * \documentclass and everything up to \begin{document}. `title` is the PDF's
   * title, escaped. `fallbacks` is the set-up of fonts for letters the
   * template's fonts lack (`fallbackFonts`), for XeLaTeX and LuaLaTeX, or
   * nothing for a file with none of those letters (`hasFallbackLetter`) and
   * none pdfLaTeX can't print; it goes before the fonts.
   */
  preamble: (units: Units, title: string, fallbacks: string) => string
  /** Where letters the template's fonts lack print, as in its PDF. */
  fallbacks: Fallbacks
  /** Everything between \begin{document} and \end{document}. */
  body: (data: TemplateData, units: Units) => string
}

// ---------- Text ----------

// What TeX reads as markup rather than text, as text that prints it.
const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  // Not markup, but XeLaTeX and LuaLaTeX print a straight " as a closing ”.
  '"': "\\textquotedbl{}",
}

// Control characters pasted text can bring, and half of an emoji (a surrogate
// without its pair), which nothing prints. Whole emoji are matched so they're
// kept. Zero-width spaces and joiners print nothing either, but pdfLaTeX would
// stop at them.
const UNPRINTABLE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF\0-\x08\x0B\x0C\x0E-\x1F\x7F​⁠﻿]/g

// Pairs the fonts join into one mark ("--" is a dash, "''" a closing quote,
// "<<" a guillemet, "!`" is "¡"): a zero kern goes between the two, so they
// print as typed. An empty group would do in pdfLaTeX but not in XeLaTeX or
// LuaLaTeX. A lone ' and ` still print as curly quotes, as LaTeX writes them.
const LIGATURE = /([-'`<>,])(?=\1)|[!?](?=`)/g

// Signs NFC turns into letters pdfLaTeX can't print, as toTemplateData has
// already done: the ohm sign (U+2126) into Greek's capital omega, and the
// angle brackets (U+2329, U+232A) into CJK ones. They're the same characters
// to Unicode, so they print as signs pdfLaTeX has: an omega that isn't part of
// a Greek word as the ohm sign (textcomp's, in the template's font), as in
// "10 kΩ", and the brackets as maths' (Lato's textcomp has none).
const SIGNS: [RegExp, string][] = [
  [/(?<!\p{Script=Greek}\p{M}*)\u03A9(?!\p{M}*\p{Script=Greek})/gu, "\\textohm{}"],
  [/\u3008/g, "\\ensuremath{\\langle}"],
  [/\u3009/g, "\\ensuremath{\\rangle}"],
]

/**
 * Text as LaTeX that prints it as typed. Line breaks are `lineBreak`; tabs
 * are spaces. Letters are composed (NFC), since pdfLaTeX can print "é" but not
 * "e" followed by a combining accent, as macOS sometimes types it.
 */
export function latex(value: string, lineBreak = " "): string {
  return SIGNS.reduce(
    (text, [sign, command]) => text.replace(sign, command),
    value
      .normalize("NFC")
      .replace(UNPRINTABLE, (match) => (match.length === 2 ? match : ""))
      .replace(/[\\{}&%$#_~^"]/g, (special) => SPECIAL[special])
      .replace(LIGATURE, "$&\\kern0pt ")
      .replace(/\t/g, " ")
      .replace(/\r\n?|\n/g, lineBreak),
  )
}

/**
 * Prose, keeping its line breaks, each line indented by `indent`. \newline
 * rather than \\, which would read a line starting with [ or * as its own option.
 */
export const prose = (value: string, indent = "    ") => latex(value, `\\newline\n${indent}`)

/** Paragraphs of prose, a blank line between them, each line indented by `indent`. */
export const paragraphs = (texts: string[], indent = "    ") => texts.map((text) => indent + prose(text, indent)).join("\n\n")

export const bold = (body: string) => `\\textbf{${body}}`
export const italic = (body: string) => `\\textit{${body}}`

/** A bullet: its words in bold and italic where they were marked so (`rich` in templates/common.typ). */
export const runs = (pieces: Run[]) =>
  pieces
    .map((piece) => {
      let out = latex(piece.text)
      if (piece.italic) out = italic(out)
      if (piece.bold) out = bold(out)
      return out
    })
    .join("")

/** "Start - End", or whichever of the two is present, as the templates print dates. */
export const dateRange = (start: string, end: string) => (start && end ? `${start} - ${end}` : start + end)

/** The values that aren't empty, joined by `separator`, as `join-present` in templates/common.typ. */
export const joinPresent = (separator: string, ...values: string[]) => values.filter(Boolean).join(separator)

/** \item would read text starting with [ as its label. */
export const itemText = (text: string) => text.replace(/^\[/, "{}[")

// ---------- Links ----------

/**
 * An address as hyperref reads it inside another command's argument, where %,
 * # and & still need a backslash. What can't be escaped there (a backslash,
 * braces, spaces) is percent-encoded, and that % escaped in turn. So is ^, as
 * TeX reads ^^ and two hex digits as the character they name, before hyperref
 * sees it: ^^7d would close the link, and the address could run what follows.
 * One pass, so nothing it writes is read again.
 */
const address = (url: string) =>
  url.replace(/[\\{}\s^%#&]/g, (character) => `\\${/[%#&]/.test(character) ? character : encodeURIComponent(character)}`)

/** The address a link goes to, or null for one that isn't an address, which is printed without a link. */
function linkTarget(url: string): string | null {
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

/** Profile and project links are stored without "https://" (see resumeData.ts). */
export const web = (url: string) => `https://${url}`

/** `body` linked to `url`, or `body` alone when `url` isn't an address. */
export const href = (url: string, body: string) => {
  const target = linkTarget(url)
  return target ? `\\href{${address(target)}}{${body}}` : body
}

/**
 * A link printed as its own text, in the template's `style` (as Jake's
 * underline); plain when it isn't an address.
 */
export const shownLink = (url: string, text: string, style = (body: string) => body) =>
  linkTarget(url) ? href(url, style(latex(text))) : latex(text)

/** How a template prints a link: its address, and the words it shows, already LaTeX. */
export type ShowLink = (url: string, text: string) => string

/** A link that's a profile or project address, stored without its "https://". */
export const webLink = (url: string, style?: (body: string) => string) => shownLink(web(url), url, style)

/** An email address, linked to write to it. */
export const emailLink = (address: string, style?: (body: string) => string) => shownLink(`mailto:${address}`, address, style)

/**
 * A project's first line, as `project-header` in templates/common.typ: its
 * name in bold, linked when the person chose to link names, its tech stack in
 * italics, then its links as text, drawn by `showLink`, `separator` between them.
 */
export function projectHeader(project: TemplateData["projects"][number], separator: string, showLink: ShowLink): string {
  const parts: string[] = []
  if (project.name) parts.push(bold(project.link ? href(web(project.link), latex(project.name)) : latex(project.name)))
  if (project.techStack) parts.push(`\\emph{${latex(project.techStack)}}`)
  for (const url of project.links) parts.push(showLink(web(url), url))
  return parts.join(separator)
}

// ---------- Publications ----------

/**
 * A publication as a citation, IEEE style, as the templates print it
 * (`citation` in templates/common.typ), with the resume owner's name in bold.
 * `showLink` draws the DOI or link in the template's link style:
 *   R. Conde, J. Smith, and A. Lee, “Title of the paper,” Venue, details, date, doi: 10.1/x.
 */
export function citation(
  { title, authors, venue, details, date, doi, link }: TemplateData["publications"][number],
  showLink: ShowLink,
): string {
  // Each part, and the text it ends with, for the closing full stop.
  const rest: [string, string][] = []
  if (venue) rest.push([italic(latex(venue)), venue])
  if (details) rest.push([latex(details), details])
  if (date) rest.push([latex(date), date])
  if (doi) rest.push([`doi: ${showLink(`https://doi.org/${doi}`, doi)}`, doi])
  else if (link) rest.push([showLink(web(link), link), link])

  // Names and what's between them are escaped together, up to the owner's,
  // so a pair split between two of them still prints as typed.
  let out = ""
  let others = ""
  for (const piece of authors) {
    if (!piece.me) others += piece.text
    else {
      out += latex(others) + bold(latex(piece.text))
      others = ""
    }
  }
  out += latex(others)
  if (title) {
    if (authors.length) out += ", "
    // The comma after the title, or the closing full stop, goes inside the quotes.
    const mark = /[.?!]$/.test(title) ? "" : rest.length ? "," : "."
    out += `“${latex(title)}${mark}”${rest.length ? " " : ""}`
  } else if (authors.length && rest.length) {
    out += ", "
  }
  if (rest.length) {
    out += rest.map(([part]) => part).join(", ")
    if (!rest.at(-1)![1].endsWith(".")) out += "."
  }
  return out
}

/**
 * Publications as a numbered list, [1], [2], ..., each hanging under its
 * number, as `citations` in templates/common.typ. Needs enumitem. `options`
 * are more of enumitem's, as the space between them and the margin's indent.
 */
export function citations(publications: TemplateData["publications"], showLink: ShowLink, options: string, indent = "  "): string {
  return [
    `${indent}\\begin{enumerate}[label={[\\arabic*]}, widest=${publications.length}, align=left, leftmargin=*, ${options}]`,
    ...publications.map((publication) => `${indent}  \\item ${itemText(citation(publication, showLink))}`),
    `${indent}\\end{enumerate}`,
  ].join("\n")
}

// ---------- Sections ----------

/** Where each section's entries and heading are in TemplateData. */
const SECTION_KEYS: Record<SectionName, keyof TemplateData["headings"]> = {
  Education: "education",
  Work: "work",
  Projects: "projects",
  Publications: "publications",
  Skills: "skills",
  Leadership: "leadership",
  Volunteership: "volunteer",
  Awards: "awards",
}

/** A section with something to print, and its heading, already LaTeX. */
export type Section = { heading: string; name: string } & (
  { kind: "extra"; extra: ExtraTemplateSection } | { kind: keyof TemplateData["headings"] }
)

/**
 * The resume's sections in its order, each with something to print: the
 * heading the person wrote, or the one every template prints (`heading-or`
 * in the .typ files). The summary isn't one; it's in `data.summary`.
 */
export function sectionsOf(data: TemplateData): Section[] {
  return data.order.flatMap((name): Section[] => {
    const extra = data.extras[name]
    if (extra) return [{ kind: "extra", name, heading: latex(extra.heading), extra }]
    const kind = SECTION_KEYS[name as SectionName]
    if (!kind || data[kind].length === 0) return []
    return [{ kind, name, heading: latex(data.headings[kind] || SECTIONS[name as SectionName].title) }]
  })
}

// ---------- Fine-tune ----------

/**
 * Fine-tune's settings as lengths, as `sized`, `spaced`, `gapped` and the
 * page's in templates/common.typ. At 1 each gives back what it's given. A
 * resume kept to one page prints with the person's own multiples: how far
 * the PDF tightened them was measured in Typst, which sets lines differently.
 */
export interface Units {
  /** A text size, or the space around a heading or between entries, in Typst's points: it follows the text size. */
  size: (pt: number) => string
  /** The space between lines, in Typst's points: it follows the text size and the line spacing. */
  space: (pt: number) => string
  /** The space above a section, in Typst's points: it follows the text size and the space between sections. */
  gap: (pt: number) => string
  /** A page margin, in inches: it follows the margins. */
  margin: (inches: number) => string
  /** The paper, as \documentclass and geometry name it: the person's, or the template's own. */
  paper: (own: "letterpaper" | "a4paper") => "letterpaper" | "a4paper"
}

// Lengths to a hundredth, which is finer than print shows. Typst's point is
// the PostScript point, 1/72 in, which TeX calls bp; TeX's own pt is 0.4%
// smaller, which over a page comes to a line's worth.
const length = (value: number, unit: "bp" | "in") => `${Math.round(value * 100) / 100}${unit}`

/** Lengths that `Units` gave, added up into one, so the .tex has a number rather than a \dimexpr. */
export const sum = (...lengths: string[]) =>
  length(
    lengths.reduce((total, part) => total + parseFloat(part), 0),
    "bp",
  )

export function unitsOf(tune: PrintedTune): Units {
  return {
    size: (pt) => length(pt * tune.size, "bp"),
    space: (pt) => length(pt * tune.size * tune.leading, "bp"),
    gap: (pt) => length(pt * tune.size * tune.gap, "bp"),
    margin: (inches) => length(inches * tune.margin, "in"),
    paper: (own) => (tune.paper === "a4" ? "a4paper" : tune.paper === "us-letter" ? "letterpaper" : own),
  }
}

// ---------- Preamble ----------

/**
 * What every preamble starts with, after \documentclass: iftex, to tell the
 * engines apart, and T1 for pdfLaTeX, so it prints accents, <, > and | as
 * typed. A template loads its fonts after it.
 */
export const ENGINES = `\\usepackage{iftex}
\\ifPDFTeX
  \\usepackage[T1]{fontenc}
\\fi`

/**
 * Links that print as text, without boxes around them, the PDF's title, and
 * text that hiring software reads back as it's printed: with pdfLaTeX,
 * glyphtounicode maps each letter back to its character and real spaces go
 * between words, which would otherwise read as one; with XeLaTeX, a font
 * that draws - as a hyphen character (Lato, Source Sans) gives back the -
 * that was typed. Loaded after the template's other packages, as hyperref asks.
 */
export const links = (title: string) => `\\usepackage[hidelinks]{hyperref}
\\hypersetup{pdftitle={${title}}}
\\urlstyle{same}
\\ifPDFTeX
  \\input{glyphtounicode}
  \\pdfgentounicode=1
  \\pdfinterwordspaceon
\\fi
\\ifXeTeX
  \\XeTeXgenerateactualtext=1
\\fi`

/**
 * \resumeRow{left}{right}: a line with one part flush left and one flush
 * right, as `row` in templates/common.typ. A long left part wraps, and the
 * right one sits on its last line, as Typst's bottom-aligned row has it:
 * tabularx's X columns are top-aligned unless they're told otherwise. Needs
 * tabularx.
 */
export const ROW = `\\newcolumntype{L}{>{\\raggedright\\arraybackslash}X}
\\newcommand{\\resumeRow}[2]{{%
  \\renewcommand{\\tabularxcolumn}[1]{b{##1}}%
  \\begin{tabularx}{\\linewidth}{@{}L@{\\hspace{0.8em}}r@{}}#1 & #2\\end{tabularx}%
}}`

/**
 * TeX Gyre Heros, as the Helvetica-style templates are set in: its Type 1
 * fonts with pdfLaTeX, its OpenType ones otherwise, after `fallbacks`, its
 * fallback fonts' set-up (HEROS_FALLBACKS), if the file has one, which loads
 * fontspec. Some TeX installs leave out TeX Gyre's OpenType files; Nimbus
 * Sans, which TeX Gyre Heros is drawn from, stands in for them.
 */
export const heros = (fallbacks: string) => `\\ifPDFTeX
  \\usepackage{tgheros}
  \\renewcommand*\\familydefault{\\sfdefault}
\\else
${fallbacks || "  \\usepackage{fontspec}\n"}  \\IfFontExistsTF{texgyreheros-regular.otf}{
    \\setmainfont{texgyreheros}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic]
  }{
    \\setmainfont{zhv}[Extension=.otf, UprightFont=*-Reg, BoldFont=*-Bol, ItalicFont=*-RegIta, BoldItalicFont=*-BolIta]
  }
\\fi`

// ---------- Letters a template's fonts lack ----------

/**
 * A family that prints letters a template's fonts lack, as the PDF does, from
 * TeX Live's OpenType files, which Overleaf has too.
 */
export interface FallbackFamily {
  /** Its name, for the file's comment. */
  name: string
  /** The command XeLaTeX switches to it with. */
  command: string
  /** Its regular, bold, italic and bold italic files. */
  files: readonly [string, string, string, string]
  /** More of fontspec's features, for XeLaTeX. */
  features?: string
}

/** Source Sans 3, the PDF's fallback, under its older name: TeX Live 2023 has no Source Sans 3. */
export const SOURCE_SANS: FallbackFamily = {
  name: "Source Sans Pro",
  command: "\\resumeSourceSans",
  files: ["SourceSansPro-Regular.otf", "SourceSansPro-Bold.otf", "SourceSansPro-RegularIt.otf", "SourceSansPro-BoldIt.otf"],
}

/** The serif the PDF prints signs in that a template's fonts and its fallback lack, as ₿. */
export const CHARIS: FallbackFamily = {
  name: "Charis SIL",
  command: "\\resumeCharis",
  files: ["CharisSIL-Regular.ttf", "CharisSIL-Bold.ttf", "CharisSIL-Italic.ttf", "CharisSIL-BoldItalic.ttf"],
}

export const LATO: FallbackFamily = {
  name: "Lato",
  command: "\\resumeLato",
  files: ["Lato-Regular.ttf", "Lato-Bold.ttf", "Lato-Italic.ttf", "Lato-BoldItalic.ttf"],
  // Lato has no small capitals: what it prints in small capitals' place (as
  // Deedy's Raleway roles) is its regular letters, as in the PDF, without
  // LaTeX's warning that the shape is missing.
  features: "SmallCapsFont=Lato-Regular.ttf",
}

export const EB_GARAMOND: FallbackFamily = {
  name: "EB Garamond",
  command: "\\resumeGaramond",
  files: ["EBGaramond-Regular.otf", "EBGaramond-Bold.otf", "EBGaramond-Italic.otf", "EBGaramond-BoldItalic.otf"],
}

/** Letters XeLaTeX prints in a fallback together: all of them, unless the font they're in has `test`. */
export interface Letters {
  /**
   * One of them that a font has only if it has them all. Greek's is accented:
   * fonts with only some Greek letters have none of those, and the PDF prints
   * all of a Greek word in one font.
   */
  test: string
  /** Their code points, as the first and last of each range. */
  ranges: readonly (readonly [number, number])[]
}

/** Greek, and the ohm sign, which is a Greek letter to Unicode (and to luaotfload's multiscript). */
export const GREEK: Letters = {
  test: "ά",
  ranges: [
    [0x370, 0x3ff],
    [0x1f00, 0x1fff],
    [0x2126, 0x2126],
  ],
}
export const CYRILLIC: Letters = { test: "и", ranges: [[0x400, 0x52f]] }
/** The letters only Vietnamese has: ơ, ư, and those with two accents or a dot below. */
export const VIETNAMESE: Letters = {
  test: "ộ",
  ranges: [
    [0x1a0, 0x1a1],
    [0x1af, 0x1b0],
    [0x1ea0, 0x1ef9],
  ],
}
export const ARROWS: Letters = { test: "→", ranges: [[0x2190, 0x21ff]] }

/** Currency signs, which a font has one by one: the first is the test. */
export const signs = (characters: string): Letters => {
  const points = [...characters].map((character) => character.codePointAt(0)!)
  return { test: characters[0], ranges: points.map((point) => [point, point] as const) }
}

/** A font a template prints with, by the name fontspec loads it under. */
export interface TemplateFont {
  name: string
  /**
   * Its bold and italic each fall back to the fallbacks' bold and italic.
   * Not for a font of one file (Raleway Medium, Linux Biolinum), nor New
   * Computer Modern, whose sizes load files of their own: fontspec rejects
   * BoldFeatures there, so all its faces fall back to the regular ones.
   */
  faces: boolean
  /** It has only some Greek letters, so all of Greek prints in the first fallback, as in the PDF. */
  someGreek: boolean
}

/** Where letters a template's fonts lack print in XeLaTeX and LuaLaTeX, as its PDF prints them. */
export interface Fallbacks {
  /** What the file's comment says: which letters print in which family. */
  comment: string
  fonts: readonly TemplateFont[]
  /** The families letters the fonts lack print in, in the order LuaLaTeX tries them. */
  families: readonly FallbackFamily[]
  /**
   * For XeLaTeX, which can't try fonts in turn: the letters the fonts may
   * lack, and the family each group prints in.
   */
  letters: readonly (readonly [Letters, FallbackFamily])[]
}

/** TeX Gyre Heros, in Blueprint, Compact and Swiss. */
export const HEROS_FALLBACKS: Fallbacks = {
  comment: `TeX Gyre Heros has no Cyrillic and only some Greek letters, so these print
as in the PDF: Cyrillic, all of Greek and ₹ ₽ ₺ ₴ in Source Sans Pro (Source
Sans 3 under its older name), and ₿ in Charis SIL.`,
  fonts: [
    { name: "texgyreheros", faces: true, someGreek: true },
    { name: "zhv", faces: true, someGreek: true },
  ],
  families: [SOURCE_SANS, CHARIS],
  letters: [
    [GREEK, SOURCE_SANS],
    [CYRILLIC, SOURCE_SANS],
    [signs("₹₽₺₴"), SOURCE_SANS],
    [signs("₿"), CHARIS],
  ],
}

// A character's code as TeX reads it: "03AC.
const code = (point: number) => `"${point.toString(16).toUpperCase().padStart(4, "0")}`

// XeLaTeX: \resumeLetters{\family}{letter}{first-last,...} makes the
// characters from first to last a class of their own (see "Character
// classes" in XeTeX's reference). Where a run of them starts, XeTeX inserts a
// \begingroup and a switch to \family, unless the font they follow has
// letter; where it ends, the \endgroup; between two classes, both. Class
// numbers go through \numexpr, so the space after each ends it.
const XETEX_CLASSES = String.raw`\makeatletter
\newcount\resume@code
\def\resume@classes{}
\newcommand*\resumeLetters[3]{%
  \newXeTeXintercharclass\resume@class
  \edef\resume@this{\the\resume@class}%
  \@for\resume@range:=#3\do{\expandafter\resume@letters\resume@range\@nil}%
  \expandafter\def\csname resume@start@\resume@this\endcsname{\begingroup\iffontchar\font#2 \else#1\fi}%
  \def\resume@pair##1{\resume@between{##1}\resume@this\resume@between\resume@this{##1}}%
  \resume@classes
  \resume@pair\z@
  \resume@pair\e@alloc@intercharclass@top
  \edef\resume@classes{\unexpanded\expandafter{\resume@classes}\noexpand\resume@pair{\resume@this}}}
\def\resume@letters#1-#2\@nil{%
  \resume@code=#1\relax
  \loop
    \XeTeXcharclass\resume@code=\resume@class
  \ifnum\resume@code<#2\relax
    \advance\resume@code\@ne
  \repeat}
\def\resume@between#1#2{%
  \edef\resume@next{\XeTeXinterchartoks\the\numexpr#1\relax\space\the\numexpr#2\relax\space={%
    \ifcsname resume@start@\the\numexpr#1\relax\endcsname\endgroup\fi
    \ifcsname resume@start@\the\numexpr#2\relax\endcsname
      \expandafter\noexpand\csname resume@start@\the\numexpr#2\relax\endcsname
    \fi}}%
  \resume@next}
\makeatother`

const FACES = ["regular", "bold", "italic", "bolditalic"] as const
type Face = (typeof FACES)[number]

/**
 * Whether `text` has any of the letters `fallbacks` print in another family.
 * Some of them pdfLaTeX prints with textcomp, though the template's OpenType
 * font lacks them: TeX Live's Raleway, in Deedy, has no → or ₫.
 */
export function hasFallbackLetter(text: string, { letters }: Fallbacks): boolean {
  const ranges = letters.flatMap(([{ ranges }]) => ranges)
  return [...new Set(text)].some((character) => {
    const point = character.codePointAt(0)!
    return ranges.some(([first, last]) => point >= first && point <= last)
  })
}

/**
 * The set-up that prints letters a template's fonts lack in its fallback
 * fonts, for XeLaTeX and LuaLaTeX: lines indented to sit in an \ifPDFTeX's
 * \else, before the template loads its fonts.
 *
 * XeLaTeX switches fonts by character class (XETEX_CLASSES). LuaLaTeX uses
 * luaotfload's fallback feature, which takes a letter a font lacks from the
 * first font in its list that has it, and its multiscript feature, which
 * prints all of a script in a font of its own: Greek, where a font has only
 * some of it. Each face falls back to the same face, bold to bold, as the
 * PDF's do; fontspec's per-font defaults attach them, as they reach fonts the
 * templates load with packages too. luaotfload also prints digits and
 * punctuation right after a Greek word in the Greek font, where the PDF keeps
 * them in the template's.
 */
export function fallbackFonts({ comment, fonts, families, letters }: Fallbacks): string {
  const xetexFamilies = families.filter((family) => letters.some(([, to]) => to === family))
  const spec = (file: string, features = "") => `file:${file}:mode=node;${features}`
  const features = (face: Face, someGreek: boolean) =>
    `RawFeature={fallback=resume-${face}${someGreek ? `;multiscript=resume-${face}` : ""}}`
  // For each kind of font, the regular face's fallbacks for every face, which
  // those with bold and italic files override with their own.
  const defaults = [true, false].flatMap((faces) =>
    [true, false].flatMap((someGreek) => {
      const names = fonts.filter((font) => font.faces === faces && font.someGreek === someGreek).map((font) => font.name)
      if (!names.length) return []
      const each = faces
        ? [
            ",",
            `BoldFeatures={${features("bold", someGreek)}},`,
            `ItalicFeatures={${features("italic", someGreek)}},`,
            `BoldItalicFeatures={${features("bolditalic", someGreek)}}`,
          ].join("\n    ")
        : ""
      return [`  \\defaultfontfeatures[${names.join(",")}]{${features("regular", someGreek)}${each}}`]
    }),
  )

  return [
    ...comment.split("\n").map((line) => `% ${line}`),
    "\\usepackage{fontspec}",
    "\\ifXeTeX",
    "  % XeLaTeX: each \\resumeLetters is a class of characters. Where a run of",
    "  % them starts, XeTeX switches to its font, unless the font it's in has the",
    "  % letter named (for Greek, an accented one, which fonts with only some",
    "  % Greek letters lack).",
    ...xetexFamilies.map(({ command, files: [regular, bold, italic, boldItalic], features }) =>
      [
        `  \\newfontfamily${command}{${regular}}[BoldFont=${bold},`,
        `ItalicFont=${italic}, BoldItalicFont=${boldItalic},`,
        `FontFace={l}{n}{${regular}}, FontFace={l}{it}{${italic}}${features ? `, ${features}` : ""}]`,
      ].join("\n    "),
    ),
    ...XETEX_CLASSES.split("\n").map((line) => `  ${line}`),
    ...letters.map(
      ([{ test, ranges }, { command }]) =>
        `  \\resumeLetters{${command}}{${code(test.codePointAt(0)!)}}{${ranges.map(([first, last]) => `${code(first)}-${code(last)}`).join(",")}}`,
    ),
    "  \\XeTeXinterchartokenstate=1",
    "\\else",
    "  % LuaLaTeX: luaotfload takes a letter a font lacks from the first of these",
    "  % fonts that has it, in the same face, and all of Greek from the first,",
    "  % where the font has only some of it.",
    "  \\directlua{",
    ...FACES.map(
      (face, index) =>
        `    luaotfload.add_fallback("resume-${face}", {${families.map((family) => `"${spec(family.files[index])}"`).join(", ")}})`,
    ),
    ...(fonts.some((font) => font.someGreek)
      ? FACES.map(
          (face, index) =>
            `    luaotfload.add_multiscript("resume-${face}", {grek = "${spec(families[0].files[index], `script=grek;fallback=resume-${face}`)}"})`,
        )
      : []),
    "  }",
    ...defaults,
    "\\fi",
  ]
    .join("\n")
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")
    .concat("\n")
}

/** XeLaTeX and LuaLaTeX's `setUp`, in a branch of its own after \ifPDFTeX, or nothing when there's none. */
export const unlessPdfLatex = (setUp: string) => (setUp ? `\\ifPDFTeX\\else\n${setUp}\\fi\n` : "")

// ---------- What pdfLaTeX can print ----------

// What pdfLaTeX printed, character by character, with T1 and Latin Modern in
// TeX Live 2023; Overleaf's is newer and prints at least as much. Everything
// else stops it with "Unicode character ... not set up for use with LaTeX".
// prettier-ignore
const PDFLATEX_PRINTS = new RegExp(
  "[\\n\\x20-\\x7E\\u00A0-\\u0125\\u0128-\\u0137\\u0139-\\u013E\\u0141-\\u0148\\u014A-\\u0165\\u0168-\\u017E\\u0192" +
  "\\u01C4-\\u01D4\\u01E2\\u01E3\\u01E6-\\u01EB\\u01F0\\u01F4\\u01F5\\u0218-\\u021B\\u0232\\u0233\\u0237\\u02C6\\u02C7" +
  "\\u02D8\\u02D9\\u02DB-\\u02DD\\u1E02\\u1E03\\u1E0D\\u1E1E-\\u1E21\\u1E25\\u1E30\\u1E31\\u1E37\\u1E43\\u1E45\\u1E47" +
  "\\u1E5B\\u1E63\\u1E6D\\u1E8E-\\u1E91\\u1E9E\\u1EF2\\u1EF3\\u200C\\u2010-\\u2016\\u2018-\\u201A\\u201C-\\u201E" +
  "\\u2020-\\u2022\\u2026\\u2030\\u2031\\u2039-\\u203B\\u203D\\u2044\\u204E\\u2052\\u20A1\\u20A4\\u20A6\\u20A9" +
  "\\u20AB\\u20AC\\u20B1\\u2103\\u2116\\u2117\\u211E\\u2120\\u2122\\u2126\\u2127\\u212E\\u2190-\\u2193\\u2329\\u232A" +
  "\\u25E6\\u25EF\\u266A\\uFB00-\\uFB06]",
  "u",
)

/** The letters in `text` pdfLaTeX can't print, each once, in the order they first appear. */
export const beyondPdfLatex = (text: string) => [...new Set([...text].filter((character) => !PDFLATEX_PRINTS.test(character)))]
