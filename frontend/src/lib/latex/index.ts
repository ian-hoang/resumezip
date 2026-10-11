// The resume as a LaTeX file (.tex), to keep editing on Overleaf or with any
// TeX install, laid out as the PDF's template is. Each template in
// templates/ is a LaTeX twin of the .typ file of the same name in
// lib/typst/templates/: its fonts, sizes, spaces and layout, set with the
// page and sizes Fine-tune gives. The words come from toTemplateData, as the
// PDF's do, so the headings and their order match, and what's left out of the
// PDF isn't in it either. A file can't match its PDF line for line: TeX
// breaks lines and pages its own way.
//
// It compiles with pdfLaTeX, Overleaf's default. pdfLaTeX's fonts only have
// Latin letters, so a resume with others (Иван, Nguyễn) gets a file that asks
// for XeLaTeX, where the template's fonts print what the PDF prints, and the
// PDF's fallback fonts the letters they lack (fallbackFonts in common.ts).
// A file pdfLaTeX can compile gets those fallbacks too when it has a sign
// pdfLaTeX prints but the template's OpenType font lacks, as → in Deedy's
// roles, so XeLaTeX and LuaLaTeX print it as well. Every file works with both
// engines, and with LuaLaTeX; iftex tells them apart.
//
// Unlike the PDF and the Word file, it doesn't carry its resume, so
// resumezip can't open it again.
//
// The editor downloads this module when LaTeX is first chosen.

import type { Resume } from "@/lib/resume"
import type { TemplateId } from "@/lib/templates"
import { templateIdOf, toTemplateData } from "@/lib/typst/resumeData"
import { beyondPdfLatex, fallbackFonts, hasFallbackLetter, latex, unitsOf, type LatexTemplate } from "./common"
import { accent } from "./templates/accent"
import { deedy } from "./templates/deedy"
import { ian } from "./templates/ian"
import { jake } from "./templates/jake"
import { levelsfyi } from "./templates/levelsfyi"
import { margin } from "./templates/margin"
import { modernjack } from "./templates/modernjack"
import { mono } from "./templates/mono"
import { referme } from "./templates/referme"
import { resumeworded } from "./templates/resumeworded"
import { swiss } from "./templates/swiss"

/** A LaTeX file's type, for a download. */
export const LATEX_TYPE = "application/x-tex"

/** Every template's LaTeX twin. A new template doesn't compile without one. */
const TEMPLATES: Record<TemplateId, LatexTemplate> = {
  accent,
  deedy,
  ian,
  jake,
  levelsfyi,
  margin,
  modernjack,
  mono,
  referme,
  resumeworded,
  swiss,
}

export interface LatexFile {
  text: string
  /**
   * The letters in it pdfLaTeX can't print, in the order they first appear.
   * When there are any, the file says to compile it with XeLaTeX.
   */
  beyondPdfLatex: string[]
}

// How many of them the file's first lines name.
const NAMED = 10

/** The resume as a LaTeX file, laid out as its template is. */
export function toLatexFile(resume: Resume): LatexFile {
  const data = toTemplateData(resume)
  const template = TEMPLATES[templateIdOf(resume.selectedTemplate)]
  const units = unitsOf(data.tune)
  const title = latex(data.profile.name || "Resume")
  // An empty resume is an empty page, as its PDF is, rather than no PDF at all.
  const document = template.body(data, units) || "\\mbox{}"
  const letters = beyondPdfLatex(document + title)
  // Letters pdfLaTeX can't print, or ones it can that the template's OpenType
  // fonts may lack. A file with neither doesn't load fonts it doesn't use.
  const fallbacks = letters.length || hasFallbackLetter(document + title, template.fallbacks) ? fallbackFonts(template.fallbacks) : ""

  const named = letters.slice(0, NAMED).join(" ") + (letters.length > NAMED ? " ..." : "")
  // Editors that read the first line (TeXShop, TeXworks, VS Code) switch to
  // XeLaTeX by themselves; Overleaf doesn't, so pdfLaTeX stops first with
  // what to do, before an error for each letter.
  const head = letters.length
    ? `% !TeX program = xelatex
% This resume has letters pdfLaTeX can't print: ${named}
% Compile it with XeLaTeX. On Overleaf, set Compiler to XeLaTeX in the project's settings.
`
    : ""
  const stop = letters.length
    ? `
\\ifPDFTeX
  \\PackageError{resume}{This resume has letters pdfLaTeX can't print. Compile it with XeLaTeX}{On Overleaf, set Compiler to XeLaTeX in the project's settings.}
\\fi
`
    : ""
  // glyphtounicode, which tells readers of a pdfLaTeX PDF which character
  // each glyph is (`links` in common.ts), doesn't know the ohm sign by the
  // name Latin Modern's and TeX Gyre's fonts give it, so it would read back
  // as the W its slot holds in ASCII.
  const ohm = document.includes("\\textohm")
    ? `
\\ifPDFTeX
  % The ohm sign reads back as one
  \\pdfglyphtounicode{ohm}{2126}
\\fi
`
    : ""

  const text = `${head}%-------------------------
% Resume in LaTeX, from resumezip
${template.credit.map((line) => `% ${line}`).join("\n")}
%-------------------------

${template.preamble(units, title, fallbacks).trimEnd()}
${ohm}${stop}
%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

${document}

\\end{document}
`
  return { text, beyondPdfLatex: letters }
}
