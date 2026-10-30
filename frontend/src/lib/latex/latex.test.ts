import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { samples } from "@/lib/import/testRender"
import { TEMPLATES, type TemplateId } from "@/lib/templates"
import { asSaved } from "@/lib/testResume"
import { TEMPLATE_SETTINGS } from "@/lib/tune"
import { toLatexFile } from "."

const IDS = TEMPLATES.map((template) => template.id)

const talks = "11111111-1111-4111-8111-111111111111"
const notes = "22222222-2222-4222-8222-222222222222"

const latexOf = (resume: unknown) => toLatexFile(asSaved(resume)).text

/** What's between \begin{document} and \end{document}. */
const bodyOf = (text: string) => text.slice(text.indexOf("\\begin{document}"), text.indexOf("\\end{document}"))

/** What's inside the {...} group that opens at `start`, braces TeX reads as text (\{, \}) aside. */
function group(text: string, start: number): string {
  let depth = 0
  for (let at = start; at < text.length; at++) {
    if (text[at] === "\\") at++
    else if (text[at] === "{") depth++
    else if (text[at] === "}" && --depth === 0) return text.slice(start + 1, at)
  }
  throw new Error(`No group closes after ${text.slice(start, start + 40)}`)
}

/** Whether every brace TeX reads as one has its pair: escaped ones (\{, \}) and \\ aside. */
function balanced(text: string): boolean {
  let depth = 0
  for (const brace of text.replace(/\\[\\{}]/g, "").replace(/[^{}]/g, "")) {
    depth += brace === "{" ? 1 : -1
    if (depth < 0) return false
  }
  return depth === 0
}

// Every character TeX reads as markup, then a straight quote and the pairs
// the fonts join into one mark (a dash, curly quotes, ¡, guillemets).
const TYPED = String.raw`\ & % $ # _ { } ~ ^ " -- '' << >> ,, !` + "`"
// The same, as LaTeX that prints it as typed.
const PRINTED =
  String.raw`\textbackslash{} \& \% \$ \# \_ \{ \} \textasciitilde{} \textasciicircum{} \textquotedbl{} -\kern0pt - '\kern0pt ' <\kern0pt < >\kern0pt > ,\kern0pt , !\kern0pt ` +
  "`"

/** A resume with `${name} ${TYPED}` in every kind of field, each with its own name. */
function everyField(selectedTemplate: string, field = (name: string) => `${name} ${TYPED}`) {
  return {
    selectedTemplate,
    profileSection: {
      fullName: field("Name"),
      location: field("Location"),
      phoneNumber: field("Phone"),
      email: field("Email"),
      linkedin: field("LinkedIn"),
      personalWebsite: field("Website"),
      profileGithub: field("GitHub"),
      summary: `${field("Summary")}\n${field("Line")}\n\n${field("Paragraph")}`,
    },
    headings: { work: field("Work heading") },
    sectionOrder: [
      "Education",
      "Work",
      "Projects",
      "Publications",
      "Skills",
      "Leadership",
      "Volunteership",
      "Awards",
      `extra:${talks}`,
      `extra:${notes}`,
    ],
    educationSection: [
      {
        id: 1,
        schoolName: field("School"),
        schoolLocation: field("Campus"),
        degree: field("Degree"),
        gpa: field("GPA"),
        schoolStartDate: field("Started"),
        schoolEndDate: field("Ended"),
        coursework: field("Coursework"),
        involvement: field("Involvement"),
      },
    ],
    workExperienceSection: [
      {
        id: 1,
        companyName: field("Company"),
        workRole: field("Role"),
        workLocation: field("Office"),
        workStartDate: field("Hired"),
        workEndDate: field("Left"),
        workDescription: `• ${field("Bullet")}\n• **${field("Bold")}** and *${field("Italic")}*`,
      },
    ],
    projectsSection: [
      {
        id: 1,
        projectName: field("Project"),
        techStack: field("Stack"),
        projectStartDate: field("Shipped"),
        projectGithub: field("example.com/repo"),
        projectDescription: `• ${field("Project bullet")}`,
      },
    ],
    publicationsSection: [
      {
        id: 1,
        publicationTitle: field("Paper"),
        publicationAuthors: field("Authors"),
        publicationVenue: field("Venue"),
        publicationDetails: field("Pages"),
        publicationDate: field("Published"),
        publicationLink: field("example.com/paper"),
      },
    ],
    skillsSection: [{ id: 1, skillName: field("Skill"), skillDetails: field("Tools") }],
    leadershipExperienceSection: [
      {
        id: 1,
        leadershipOrg: field("Club"),
        leadershipRole: field("Chair"),
        leadershipLocation: field("Hall"),
        leadershipDescription: `• ${field("Led")}`,
      },
    ],
    volunteerExperienceSection: [
      {
        id: 1,
        volunteerOrg: field("Shelter"),
        volunteerRole: field("Helper"),
        volunteerLocation: field("Town"),
        volunteerDescription: `• ${field("Helped")}`,
      },
    ],
    awardsSection: [{ id: 1, awardName: field("Award"), awardOrg: field("Giver"), awardDate: field("Won") }],
    extraSections: {
      [talks]: { kind: "list", heading: field("Talks"), bullets: `• ${field("Talk")}` },
      [notes]: { kind: "text", heading: field("Notes"), text: field("Note") },
    },
  }
}

/** The names everyField gives its fields, each printed `${name} ${PRINTED}`. */
const FIELDS = [
  ...["Name", "Location", "Phone", "Email", "LinkedIn", "Website", "GitHub", "Summary", "Line", "Paragraph", "Work heading"],
  ...["School", "Campus", "Degree", "GPA", "Started", "Ended", "Coursework", "Involvement"],
  ...["Company", "Role", "Office", "Hired", "Left", "Bullet", "Bold", "Italic"],
  ...["Project", "Stack", "Shipped", "example.com/repo", "Project bullet"],
  ...["Paper", "Authors", "Venue", "Pages", "Published", "example.com/paper"],
  ...["Skill", "Tools", "Club", "Chair", "Hall", "Led", "Shelter", "Helper", "Town", "Helped", "Award", "Giver", "Won"],
  ...["Talks", "Talk", "Notes", "Note"],
]

/** A resume with something in every section: links, bold and italic, added sections and publications. */
const EVERYTHING = {
  sectionOrder: [
    "Education",
    "Work",
    "Projects",
    "Publications",
    "Skills",
    `extra:${talks}`,
    "Leadership",
    "Volunteership",
    "Awards",
    `extra:${notes}`,
  ],
  profileSection: {
    fullName: "Rafael Conde",
    location: "Austin, TX",
    phoneNumber: "(555) 010-2299",
    email: "rafael@example.com",
    linkedin: "linkedin.com/in/rconde",
    profileGithub: "github.com/rconde",
    summary: "Backend engineer who likes fast, boring systems.",
  },
  educationSection: [
    {
      id: 1,
      schoolName: "University of Texas at Austin",
      schoolLocation: "Austin, TX",
      degree: "B.S. in Computer Science",
      gpa: "3.8",
      schoolStartDate: "Aug 2019",
      schoolEndDate: "May 2023",
      coursework: "Operating Systems, Distributed Systems",
    },
  ],
  workExperienceSection: [
    {
      id: 1,
      companyName: "Cloudflare",
      workRole: "Software Engineer",
      workLocation: "Austin, TX",
      workStartDate: "Jun 2023",
      workEndDate: "Present",
      workDescription: "• Cut p99 latency of the **cache purge** API by *40%*\n• Owned on-call for R&D's ***edge*** fleet",
    },
  ],
  projectsSection: [
    {
      id: 1,
      projectName: "tinykv",
      techStack: "Rust, Raft",
      projectStartDate: "2024",
      projectGithub: "github.com/rconde/tinykv",
      projectDescription: "• A key_value store with **snapshots**",
    },
  ],
  publicationsSection: [
    {
      id: 1,
      publicationTitle: "Purging caches at the edge",
      publicationAuthors: "R. Conde, J. Smith, and A. Lee",
      publicationVenue: "Proc. NSDI",
      publicationDetails: "pp. 1-14",
      publicationDate: "2025",
      publicationLink: "doi.org/10.1145/3580305",
    },
    { id: 2, publicationTitle: "Notes on consistent hashing?", publicationLink: "rconde.dev/hashing" },
  ],
  skillsSection: [
    { id: 1, skillName: "Languages", skillDetails: "Rust, Go, C++" },
    { id: 2, skillName: "Tools", skillDetails: "Linux, eBPF" },
  ],
  leadershipExperienceSection: [
    {
      id: 1,
      leadershipOrg: "Longhorn Developers",
      leadershipRole: "President",
      leadershipLocation: "Austin, TX",
      leadershipStartDate: "2021",
      leadershipEndDate: "2022",
      leadershipDescription: "• Ran 12 workshops",
    },
  ],
  volunteerExperienceSection: [{ id: 1, volunteerOrg: "Code2040", volunteerRole: "Mentor", volunteerDescription: "• Mentored 4 students" }],
  awardsSection: [{ id: 1, awardName: "Dean's List", awardOrg: "UT Austin", awardDate: "2022" }],
  extraSections: {
    [talks]: { kind: "list", heading: "Talks", bullets: "• *Boring* systems, **fast**" },
    [notes]: { kind: "text", heading: "Interests", text: "Climbing, film photography\nand bread.\n\nAsk me about sourdough." },
  },
}

// Letters the templates' fonts may lack: Cyrillic, Greek (an unaccented letter,
// which some fonts have, though all of Greek prints in one font), Vietnamese,
// and currency signs.
const LETTERS = ["И", "λ", "ộ", "₹", "₽", "₿"] as const
type Fallback = "SourceSansPro" | "CharisSIL" | "Lato" | "EBGaramond" | null

/** Where the letters print in XeLaTeX and LuaLaTeX when a template's fonts lack them, as its PDF prints them. */
interface Fallbacks {
  /** The family XeLaTeX switches to for each letter, by its files' name, or null where the template's font prints it. */
  xelatex: Record<(typeof LETTERS)[number], Fallback>
  /** The families LuaLaTeX takes a letter from, first first. */
  lualatex: Fallback[]
  /** The fonts, by the names fontspec loads them under, that have only some Greek, and the family all of it prints in. */
  greek: { fonts: string[]; to: Fallback }
}

const HEROS: Fallbacks = {
  xelatex: { И: "SourceSansPro", λ: "SourceSansPro", ộ: null, "₹": "SourceSansPro", "₽": "SourceSansPro", "₿": "CharisSIL" },
  lualatex: ["SourceSansPro", "CharisSIL"],
  greek: { fonts: ["texgyreheros", "zhv"], to: "SourceSansPro" },
}
const LATO_SIGNS: Fallbacks = {
  xelatex: { И: null, λ: null, ộ: null, "₹": null, "₽": "CharisSIL", "₿": "CharisSIL" },
  lualatex: ["CharisSIL"],
  greek: { fonts: [], to: null },
}
const FALLBACKS: Record<TemplateId, Fallbacks> = {
  levelsfyi: HEROS,
  referme: HEROS,
  swiss: HEROS,
  mono: {
    xelatex: { И: null, λ: "SourceSansPro", ộ: null, "₹": null, "₽": null, "₿": null },
    lualatex: ["SourceSansPro", "CharisSIL"],
    greek: { fonts: ["IBMPlexMono"], to: "SourceSansPro" },
  },
  // Raleway, in roles, dates and places: TeX Live's has no Vietnamese ộ, which the PDF's has.
  deedy: {
    xelatex: { И: null, λ: "Lato", ộ: "Lato", "₹": null, "₽": "CharisSIL", "₿": "CharisSIL" },
    lualatex: ["Lato", "CharisSIL"],
    greek: { fonts: ["Raleway-Medium"], to: "Lato" },
  },
  // TeX Gyre Termes, which has no Cyrillic and only some Greek, as Heros.
  zero2sudo: {
    xelatex: { И: "EBGaramond", λ: "EBGaramond", ộ: null, "₹": "EBGaramond", "₽": "EBGaramond", "₿": "CharisSIL" },
    lualatex: ["EBGaramond", "CharisSIL"],
    greek: { fonts: ["texgyretermes", "ztm"], to: "EBGaramond" },
  },
  // Charis SIL for the text, Linux Biolinum, which lacks ₹ ₽ ₿, for headings.
  margin: {
    xelatex: { И: null, λ: "EBGaramond", ộ: null, "₹": "EBGaramond", "₽": "EBGaramond", "₿": "CharisSIL" },
    lualatex: ["EBGaramond", "CharisSIL"],
    greek: { fonts: ["CharisSIL"], to: "EBGaramond" },
  },
  ian: LATO_SIGNS,
  modernjack: LATO_SIGNS,
  accent: {
    xelatex: { И: null, λ: null, ộ: null, "₹": null, "₽": null, "₿": "CharisSIL" },
    lualatex: ["CharisSIL"],
    greek: { fonts: [], to: null },
  },
  resumeworded: {
    xelatex: { И: null, λ: null, ộ: null, "₹": null, "₽": null, "₿": "CharisSIL" },
    lualatex: ["CharisSIL"],
    greek: { fonts: [], to: null },
  },
  // TeX Live 2023's New Computer Modern has no ₹ ₽ ₿; the PDF's newer one has.
  jake: {
    xelatex: { И: null, λ: null, ộ: null, "₹": "CharisSIL", "₽": "CharisSIL", "₿": "CharisSIL" },
    lualatex: ["CharisSIL"],
    greek: { fonts: [], to: null },
  },
}

/** A file's name without its face and extension: "SourceSansPro" for SourceSansPro-Bold.otf. */
const familyOf = (file: string) => file.replace(/-\w+\.(otf|ttf)$/, "")

/** Where the file's XeLaTeX set-up prints `letter`: the family of the \resumeLetters class that has it, or null. */
function xelatexFallback(text: string, letter: string): string | null {
  const families = new Map([...text.matchAll(/\\newfontfamily(\\\w+)\{([\w.-]+)\}/g)].map(([, command, file]) => [command, familyOf(file)]))
  const point = letter.codePointAt(0)!
  for (const [, command, ranges] of text.matchAll(/\\resumeLetters\{(\\\w+)\}\{"[0-9A-F]+\}\{([^}]*)\}/g)) {
    for (const range of ranges.split(",")) {
      const [first, last] = range.split("-").map((code) => parseInt(code.slice(1), 16))
      if (point >= first && point <= last) return families.get(command)!
    }
  }
  return null
}

/** The file's LuaLaTeX set-up: its fallbacks, and which fonts print all of Greek in which family. */
function lualatexFallbacks(text: string) {
  const list = text.match(/luaotfload\.add_fallback\("resume-regular", \{([^}]*)\}\)/)?.[1] ?? ""
  const greek = text.match(/luaotfload\.add_multiscript\("resume-regular", \{grek = "file:([\w.-]+):/)?.[1]
  return {
    fallbacks: [...list.matchAll(/"file:([\w.-]+):/g)].map(([, file]) => familyOf(file)),
    greek: {
      fonts: [...text.matchAll(/\\defaultfontfeatures\[([^\]]*)\]\{RawFeature=\{[^}]*multiscript=/g)].flatMap(([, names]) =>
        names.split(","),
      ),
      to: greek ? familyOf(greek) : null,
    },
  }
}

// Accent colors a heading's first three letters, so its headings are in two parts.
const HEADINGS = ["Work heading", "Talks", "Notes"]
const printedIn = (id: string, name: string) =>
  id === "accent" && HEADINGS.includes(name) ? `{${name.slice(0, 3)}}{${name.slice(3)} ${PRINTED}}` : `${name} ${PRINTED}`

describe("Accent's section titles", () => {
  test.each([
    ["an accent typed as a separate mark", "Re\u0301sume\u0301 talks", "Rés", "umé talks"],
    ["a conjunct", "शिक्षा", "शिक्षा", ""],
    ["a flag", "🇫🇷 Projets", "🇫🇷 P", "rojets"],
  ])("color their first three letters as the PDF does, with %s kept whole", (_, heading, first, rest) => {
    const text = latexOf({
      selectedTemplate: "accent",
      profileSection: { fullName: "Ada Lovelace" },
      workExperienceSection: [{ id: 1, companyName: "Analytical Engines" }],
      headings: { work: heading },
    })
    expect(text).toContain(`\\resumeSection{${first}}{${rest}}`)
  })
})

test("a LaTeX file underlines and links words as they were marked, printing a link's words alone", () => {
  const text = latexOf({
    selectedTemplate: "jake",
    marks: 2,
    workExperienceSection: [
      { id: 1, companyName: "Google", workDescription: "• Shipped the [__dashboard__](https://example.com/dash) on __time__" },
    ],
  })
  expect(text).toContain(String.raw`\href{https://example.com/dash}{\underline{dashboard}}`)
  expect(text).toContain(String.raw`\underline{time}`)
})

describe.each(IDS)("a LaTeX file in %s's layout", (id) => {
  test("prints every character TeX reads as markup as typed, in every kind of field", () => {
    const { text, beyondPdfLatex } = toLatexFile(asSaved(everyField(id)))
    for (const name of FIELDS) expect(text, name).toContain(printedIn(id, name))
    expect(text).toContain(`\\textbf{Bold ${PRINTED}}`)
    expect(text).toContain(`\\textit{Italic ${PRINTED}}`)
    expect(balanced(text)).toBe(true)
    // Nothing is left for TeX to read as a comment or a parameter. A % at the
    // end of a line is the template's own, so the line break isn't a space.
    expect(bodyOf(text)).not.toMatch(/(?<!\\)#|(?<!\\)%(?!$)/m)
    expect(beyondPdfLatex).toEqual([])
  })

  test("never puts the person's words where a command would read a [ as its option", () => {
    const text = latexOf(everyField(id, (name) => `[Q ${name}`))
    expect(text).toContain("[Q Name")
    expect(bodyOf(text)).not.toMatch(/(\\item|\\\\)\s*\[Q/)
  })

  test("never leaves ^^ in a link's address, which TeX would read as a character of its own", () => {
    // ^^5c is a backslash and ^^7d a closing brace to TeX, as it reads the file: a
    // link could close its \href and run what follows.
    const text = latexOf({
      selectedTemplate: id,
      profileSection: {
        email: "a^^5cb@example.com",
        linkedin: "linkedin.com/in/^^7d",
        personalWebsite: "example.com/^^5cinput",
        profileGithub: "github.com/^^7b",
      },
      sectionOrder: ["Projects", "Publications"],
      projectsSection: [{ id: 1, projectName: "Atlas", projectGithub: "github.com/a/^^5c", additionalLink: "example.com/^^7d" }],
      publicationsSection: [{ id: 1, publicationTitle: "Paper", publicationLink: "example.com/^^5c" }],
    })
    expect(text).toContain("\\%5E\\%5E5c")
    expect(text).not.toContain("^^")
  })

  test("leaves out what the PDF leaves out", () => {
    const sample = samples.find((resume) => resume.selectedTemplate === id)
    const [job] = sample.workExperienceSection
    const text = latexOf({
      ...sample,
      workExperienceSection: [
        { ...job, id: 1, companyName: "Left Out Corp", leftOut: true },
        { ...job, id: 2, workDescription: "• Printed bullet\n○ Left-out bullet" },
      ],
    })
    expect(text).toContain("Printed bullet")
    expect(text).not.toContain("Left Out Corp")
    expect(text).not.toContain("Left-out bullet")
  })

  test("is on A4 paper when the resume is, and Letter otherwise", () => {
    expect(latexOf({ selectedTemplate: id, tune: { paper: "a4" } })).toMatch(/\\documentclass\[a4paper[,\]]/)
    expect(latexOf({ selectedTemplate: id })).toMatch(/\\documentclass\[letterpaper[,\]]/)
  })

  test("follows each of Fine-tune's settings", () => {
    const resume = samples.find((sample) => sample.selectedTemplate === id)
    const plain = latexOf(resume)
    for (const tune of [{ size: 1.1 }, { margin: 0.8 }, { leading: 1.2 }, { gap: 0.8 }]) {
      expect(latexOf({ ...resume, tune }), JSON.stringify(tune)).not.toBe(plain)
    }
  })

  test("starts a new paragraph 0.6em further down than a new line, as its PDF does", () => {
    // The PDF leaves the leading plus 0.6em between paragraphs (prose in
    // templates/common.typ). \baselineskip has the leading in it already, so
    // what a blank line adds, \parskip or a list's parsep, is the 0.6em. Text
    // size and line spacing are both off 1, so the leading can't hide in it.
    const size = 1.1
    const text = latexOf({
      selectedTemplate: id,
      tune: { size, leading: 1.3 },
      profileSection: { summary: "Alpha line one.\nBeta line two.\n\nGamma new paragraph." },
    })
    expect(text).toMatch(/Alpha line one\.\\newline\n\s*Beta line two\.\n\n\s*Gamma new paragraph\./)
    // The environment or command the summary is set in, and its definition.
    const [, environment, command] = text.match(/\\(?:begin\{(\w+)\}|(\w+))\n\s*Alpha line one/)!
    const definition = environment ? `\\newenvironment{${environment}}` : `\\newcommand{\\${command}}`
    expect(text).toContain(definition)
    const opening = group(text, text.indexOf(definition) + definition.length)
    const [, length, unit] = opening.match(/(?:\\setlength\{\\parskip\}\{|parsep=)(-?[\d.]+)(bp|em)/)!
    const em = TEMPLATE_SETTINGS[id].size * size
    expect(parseFloat(length) * (unit === "em" ? em : 1), definition).toBeCloseTo(0.6 * em, 1)
  })

  test("of its sample is one pdfLaTeX can compile", () => {
    const { text, beyondPdfLatex } = toLatexFile(samples.find((sample) => sample.selectedTemplate === id))
    expect(balanced(text)).toBe(true)
    expect(beyondPdfLatex).toEqual([])
    expect(text).not.toContain("xelatex")
    // Nor does it need fonts for letters it doesn't have.
    expect(text).not.toContain("\\resumeLetters")
    expect(text).not.toContain("luaotfload")
  })

  test("prints Cyrillic, Greek, Vietnamese and currency signs its fonts lack in the fonts its PDF prints them in", () => {
    const { text } = toLatexFile(
      asSaved({
        selectedTemplate: id,
        profileSection: { fullName: "Иван Петров", location: "Αθήνα", summary: "Hà Nội, ₹5" },
      }),
    )
    const want = FALLBACKS[id]
    expect(Object.fromEntries(LETTERS.map((letter) => [letter, xelatexFallback(text, letter)]))).toEqual(want.xelatex)
    expect(lualatexFallbacks(text)).toEqual({ fallbacks: want.lualatex, greek: want.greek })
    expect(balanced(text)).toBe(true)
  })

  test("with links, bold and italic, added sections and publications is laid out as its template is", async () => {
    await expect(toLatexFile(asSaved({ ...EVERYTHING, selectedTemplate: id })).text).toMatchFileSnapshot(`__snapshots__/${id}.tex`)
  })
})

describe("a LaTeX file in Jake's layout", () => {
  test("links contacts, projects and papers, printed as their addresses, and doesn't link what isn't one", () => {
    const text = latexOf({
      selectedTemplate: "jake",
      profileSection: {
        fullName: "Mara Lin",
        email: "mara@example.com",
        linkedin: "https://www.linkedin.com/in/maralin/",
        personalWebsite: "not an address",
      },
      projectsSection: [
        { id: 1, projectName: "Atlas", projectGithub: "github.com/maralin/atlas" },
        { id: 2, projectName: "Beacon", projectGithub: "github.com/maralin/beacon" },
      ],
      publicationsSection: [{ id: 1, publicationTitle: "Fast tools", publicationLink: "https://doi.org/10.1145/3580305" }],
    })
    expect(text).toContain(
      [
        "\\href{mailto:mara@example.com}{\\underline{mara@example.com}} $|$",
        "    \\href{https://linkedin.com/in/maralin}{\\underline{linkedin.com/in/maralin}} $|$",
        "    not an address",
      ].join("\n"),
    )
    expect(text).toContain("{\\textbf{Atlas} $|$ \\href{https://github.com/maralin/atlas}{\\underline{github.com/maralin/atlas}}}")
    expect(text).toContain("\\item “Fast tools,” doi: \\href{https://doi.org/10.1145/3580305}{\\underline{10.1145/3580305}}.")
  })

  test("links a project's name, when the person chose that", () => {
    const text = latexOf({
      selectedTemplate: "jake",
      projectLinks: "title",
      projectsSection: [{ id: 1, projectName: "Atlas", techStack: "Go", projectGithub: "github.com/maralin/atlas" }],
    })
    expect(text).toContain("{\\textbf{\\href{https://github.com/maralin/atlas}{Atlas}} $|$ \\emph{Go}}")
  })

  test("escapes what an address needs escaped inside a command, and percent-encodes what can't be", () => {
    const text = latexOf({
      selectedTemplate: "jake",
      profileSection: { personalWebsite: "example.com/a_b~c/{d}?x=1&y=50%#top" },
    })
    expect(text).toContain(
      "\\href{https://example.com/a_b~c/\\%7Bd\\%7D?x=1\\&y=50\\%\\#top}{\\underline{example.com/a\\_b\\textasciitilde{}c/\\{d\\}?x=1\\&y=50\\%\\#top}}",
    )
    // A backslash or a space can't be escaped there either, so it's percent-encoded, and its % escaped.
    expect(latexOf({ selectedTemplate: "jake", profileSection: { email: "a\\b c@example.com" } })).toContain(
      "\\href{mailto:a\\%5Cb\\%20c@example.com}",
    )
  })

  test("sets bold and italic as the bullets mark them", () => {
    const text = latexOf({
      selectedTemplate: "jake",
      workExperienceSection: [
        {
          id: 1,
          companyName: "Stripe",
          workDescription: "• Optimized a **Rust** engine for *low latency*\n• ***Both*** and **bold with *italic* inside**",
        },
      ],
    })
    expect(text).toContain("\\resumeItem{Optimized a \\textbf{Rust} engine for \\textit{low latency}}")
    expect(text).toContain("\\resumeItem{\\textbf{\\textit{Both}} and \\textbf{bold with }\\textbf{\\textit{italic}}\\textbf{ inside}}")
  })

  test("has the person's headings, or the templates', in the resume's order after the summary", () => {
    const text = latexOf({
      selectedTemplate: "jake",
      profileSection: { fullName: "Mara Lin", summary: "Builds tools.\n\nWrites about them." },
      headings: { work: "Where I've worked" },
      sectionOrder: ["Skills", `extra:${talks}`, "Work"],
      skillsSection: [{ id: 1, skillName: "Languages", skillDetails: "Go, Rust" }],
      workExperienceSection: [{ id: 1, companyName: "Stripe", workRole: "Engineer" }],
      extraSections: { [talks]: { kind: "list", heading: "Talks", bullets: "• On fast tools" } },
    })
    expect([...text.matchAll(/\\section\{(.*)\}/g)].map(([, heading]) => heading)).toEqual([
      "Summary",
      "Skills",
      "Talks",
      "Where I've worked",
    ])
    expect(text).toContain("  \\resumeTextStart\n    Builds tools.\n\n    Writes about them.\n  \\resumeTextEnd")
    expect(text).toContain("    \\textbf{Languages:} {Go, Rust}")
    expect(text).toContain("\\resumeItem{On fast tools}")
  })

  test("keeps text that starts with [ or * from being read as a command's option", () => {
    const text = latexOf({
      selectedTemplate: "jake",
      profileSection: { summary: "[Open to work]\n*Remote" },
      publicationsSection: [{ id: 1, publicationDetails: "[Invited] talk" }],
    })
    expect(text).toContain("\\resumeTextStart\n    [Open to work]\\newline\n    *Remote")
    expect(text).toContain("\\item {}[Invited] talk.")
  })

  test("sets bold and italic words in the summary and a text section in bold and italics, a line at a time", () => {
    const text = latexOf({
      selectedTemplate: "jake",
      profileSection: { summary: "Builds **fast** tools\nin *Rust*" },
      sectionOrder: [`extra:${notes}`],
      extraSections: { [notes]: { kind: "text", heading: "Notes", text: "Ran ***both*** ways" } },
    })
    expect(text).toContain("    Builds \\textbf{fast} tools\\newline\n    in \\textit{Rust}")
    expect(text).toContain("    Ran \\textbf{\\textit{both}} ways")
  })

  test("of an empty resume is still a page", () => {
    expect(bodyOf(latexOf({}))).toBe("\\begin{document}\n\n\\mbox{}\n\n")
  })
})

describe.each(["deedy", "ian", "modernjack"])("a LaTeX file in %s's layout", (id) => {
  test("puts words as far apart as its PDF pins Lato's spaces, at every size", () => {
    const typst = readFileSync(path.resolve("src/lib/typst/templates", `${id}.typ`), "utf8")
    const [, space] = typst.match(/#set text\(font: "Lato"[^\n]*spacing: ([\d.]+em)\)/)!
    const text = latexOf({ selectedTemplate: id })
    expect(text).toContain(`\\newcommand*{\\latospace}{\\spaceskip=${space}\\relax}`)
    expect(text).toMatch(/\\renewcommand\{\\normalsize\}\{[^\n]*\\latospace/)
  })
})

describe("letters pdfLaTeX can't print", () => {
  test("make the file ask for XeLaTeX, naming them", () => {
    const { text, beyondPdfLatex } = toLatexFile(asSaved({ selectedTemplate: "jake", profileSection: { fullName: "Иван Petrov" } }))
    expect(beyondPdfLatex).toEqual(["И", "в", "а", "н"])
    expect(text.split("\n").slice(0, 3)).toEqual([
      "% !TeX program = xelatex",
      "% This resume has letters pdfLaTeX can't print: И в а н",
      "% Compile it with XeLaTeX. On Overleaf, set Compiler to XeLaTeX in the project's settings.",
    ])
    expect(text).toMatch(/\\ifPDFTeX\n {2}\\PackageError\{resume\}\{This resume has letters pdfLaTeX can't print/)
  })

  test("aren't accents, dashes, quotes or symbols it has", () => {
    const { text, beyondPdfLatex } = toLatexFile(
      asSaved({
        selectedTemplate: "jake",
        profileSection: { fullName: "José Müller-Łukasiewicz", summary: "“Fast” – not — slow… €5 → ©" },
      }),
    )
    expect(beyondPdfLatex).toEqual([])
    expect(text).not.toContain("xelatex")
    expect(text).not.toContain("PackageError")
  })

  test("aren't accents typed as separate marks, which are put together", () => {
    const { text, beyondPdfLatex } = toLatexFile(asSaved({ selectedTemplate: "jake", profileSection: { fullName: "Jose\u0301" } }))
    expect(text).toContain("\\scshape José}")
    expect(beyondPdfLatex).toEqual([])
  })

  test("aren't what nothing prints, which is dropped, though an emoji is kept", () => {
    const { text, beyondPdfLatex } = toLatexFile(
      asSaved({ selectedTemplate: "jake", profileSection: { fullName: "Ada\u0001\u200B Lovelace\uFEFF\uD800 🎉" } }),
    )
    expect(text).toContain("\\scshape Ada Lovelace 🎉}")
    expect(beyondPdfLatex).toEqual(["🎉"])
  })

  test("aren't the ohm sign or angle brackets, which Unicode composes into Greek and CJK ones", () => {
    const { text, beyondPdfLatex } = toLatexFile(
      asSaved({ selectedTemplate: "jake", profileSection: { summary: "A 10 k\u2126 resistor, \u2329x\u232A, 5 \u03A9." } }),
    )
    expect(beyondPdfLatex).toEqual([])
    expect(text).toContain("A 10 k\\textohm{} resistor, \\ensuremath{\\langle}x\\ensuremath{\\rangle}, 5 \\textohm{}.")
    expect(text).not.toContain("xelatex")
    // pdfLaTeX's PDF says the ohm sign's glyph is one.
    expect(text).toMatch(/\\ifPDFTeX\n(.*\n)?\s*\\pdfglyphtounicode\{ohm\}\{2126\}\n\\fi/)
  })

  test("include Ω in a Greek word", () => {
    const { text, beyondPdfLatex } = toLatexFile(asSaved({ selectedTemplate: "jake", profileSection: { fullName: "\u03A9μέγα Ανδρέου" } }))
    expect(beyondPdfLatex.slice(0, 2)).toEqual(["\u03A9", "μ"])
    expect(text).toContain("\\scshape \u03A9μέγα Ανδρέου}")
    expect(text).toContain("% !TeX program = xelatex")
  })

  test("name the first ten, and say there are more", () => {
    const { text } = toLatexFile(asSaved({ selectedTemplate: "jake", profileSection: { fullName: "Αλέξανδρος Παπαδόπουλος" } }))
    expect(text).toContain("% This resume has letters pdfLaTeX can't print: Α λ έ ξ α ν δ ρ ο ς ...\n")
  })
})

describe("signs pdfLaTeX prints, but a template's font lacks", () => {
  // pdfLaTeX prints → and ₫ with textcomp. TeX Live's Raleway, which Deedy's
  // roles, dates and places are in, has neither, so XeLaTeX and LuaLaTeX
  // would leave them out ("Missing character") without the fallbacks.
  test.each([
    { sign: "→", field: "role", job: { workRole: "Intern → Software Engineer" } },
    { sign: "→", field: "place", job: { workLocation: "Hanoi → Remote" } },
    { sign: "₫", field: "role", job: { workRole: "Engineer, 20.000.000₫" } },
    { sign: "₫", field: "place", job: { workLocation: "20.000.000₫" } },
  ])("give $sign in a Deedy $field a fallback, Lato, and still compile with pdfLaTeX", ({ sign, job }) => {
    const { text, beyondPdfLatex } = toLatexFile(
      asSaved({ selectedTemplate: "deedy", sectionOrder: ["Work"], workExperienceSection: [{ id: 1, companyName: "Viettel", ...job }] }),
    )
    expect(text).toContain(sign)
    expect(xelatexFallback(text, sign)).toBe("Lato")
    expect(lualatexFallbacks(text).fallbacks).toEqual(["Lato", "CharisSIL"])
    expect(beyondPdfLatex).toEqual([])
    expect(text).not.toContain("xelatex")
    expect(text).not.toContain("PackageError")
    expect(balanced(text)).toBe(true)
  })

  test("get no fallbacks where the template's fonts have them", () => {
    // TeX Gyre Heros has the arrow, so Swiss's file needs no fallback for it.
    const text = latexOf({ selectedTemplate: "swiss", workExperienceSection: [{ id: 1, workRole: "Intern → Software Engineer" }] })
    expect(text).toContain("Intern → Software Engineer")
    expect(text).not.toContain("\\resumeLetters")
    expect(text).not.toContain("luaotfload")
  })
})
