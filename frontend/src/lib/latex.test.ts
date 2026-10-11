import { describe, expect, test } from "vitest"
import { samples } from "@/lib/import/testRender"
import { asSaved } from "@/lib/testResume"
import { toLatexFile } from "./latex"

const talks = "11111111-1111-4111-8111-111111111111"
const notes = "22222222-2222-4222-8222-222222222222"

const latexOf = (resume: unknown) => toLatexFile(asSaved(resume)).text

/** What's between \begin{document} and \end{document}. */
const bodyOf = (text: string) => text.slice(text.indexOf("\\begin{document}"), text.indexOf("\\end{document}"))

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

describe("a LaTeX file", () => {
  test("prints every character TeX reads as markup as typed, in every kind of field", () => {
    const field = (name: string) => `${name} ${TYPED}`
    const resume = {
      selectedTemplate: "jake",
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
          projectDate: field("Shipped"),
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
    const { text, beyondPdfLatex } = toLatexFile(asSaved(resume))
    const names = [
      ...["Name", "Location", "Phone", "Email", "LinkedIn", "Website", "GitHub", "Summary", "Line", "Paragraph", "Work heading"],
      ...["School", "Campus", "Degree", "GPA", "Started", "Ended", "Coursework", "Involvement"],
      ...["Company", "Role", "Office", "Hired", "Left", "Bullet", "Bold"],
      ...["Project", "Stack", "Shipped", "example.com/repo", "Project bullet"],
      ...["Paper", "Authors", "Venue", "Pages", "Published", "example.com/paper"],
      ...["Skill", "Tools", "Club", "Chair", "Hall", "Led", "Shelter", "Helper", "Town", "Helped", "Award", "Giver", "Won"],
      ...["Talks", "Talk", "Notes", "Note"],
    ]
    for (const name of names) expect(text, name).toContain(`${name} ${PRINTED}`)
    expect(text).toContain(`\\textbf{Bold ${PRINTED}} and \\textit{Italic ${PRINTED}}`)
    expect(balanced(text)).toBe(true)
    // Nothing is left for TeX to read as a comment or a parameter.
    expect(bodyOf(text)).not.toMatch(/(?<!\\)[%#]/)
    expect(beyondPdfLatex).toEqual([])
  })

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

  test("leaves out what the PDF leaves out", () => {
    const [job] = samples[0].workExperienceSection
    const text = latexOf({
      ...samples[0],
      workExperienceSection: [
        { ...job, id: 1, companyName: "Left Out Corp", leftOut: true },
        { ...job, id: 2, workDescription: "• Printed bullet\n○ Left-out bullet" },
      ],
    })
    expect(text).toContain("Printed bullet")
    expect(text).not.toContain("Left Out Corp")
    expect(text).not.toContain("Left-out bullet")
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

  test("is on A4 paper when the resume is, and Letter otherwise", () => {
    expect(latexOf({ selectedTemplate: "jake", tune: { paper: "a4" } })).toContain("\\documentclass[a4paper,11pt]{article}")
    expect(latexOf({ selectedTemplate: "jake" })).toContain("\\documentclass[letterpaper,11pt]{article}")
  })

  test("of an empty resume is still a page", () => {
    expect(bodyOf(latexOf({}))).toBe("\\begin{document}\n\n\\mbox{}\n\n")
  })

  test("of every template's sample is one pdfLaTeX can compile", () => {
    for (const sample of samples) {
      const { text, beyondPdfLatex } = toLatexFile(sample)
      expect(balanced(text), sample.selectedTemplate).toBe(true)
      expect(beyondPdfLatex, sample.selectedTemplate).toEqual([])
      expect(text, sample.selectedTemplate).not.toContain("xelatex")
    }
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

  test("name the first ten, and say there are more", () => {
    const { text } = toLatexFile(asSaved({ selectedTemplate: "jake", profileSection: { fullName: "Αλέξανδρος Παπαδόπουλος" } }))
    expect(text).toContain("% This resume has letters pdfLaTeX can't print: Α λ έ ξ α ν δ ρ ο ς ...\n")
  })
})

test("a LaTeX file with links, bold and italic, extra sections and publications is laid out as Jake's Resume is", async () => {
  const resume = asSaved({
    selectedTemplate: "jake",
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
        projectDate: "2024",
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
    volunteerExperienceSection: [
      { id: 1, volunteerOrg: "Code2040", volunteerRole: "Mentor", volunteerDescription: "• Mentored 4 students" },
    ],
    awardsSection: [{ id: 1, awardName: "Dean's List", awardOrg: "UT Austin", awardDate: "2022" }],
    extraSections: {
      [talks]: { kind: "list", heading: "Talks", bullets: "• *Boring* systems, **fast**" },
      [notes]: { kind: "text", heading: "Interests", text: "Climbing, film photography\nand bread.\n\nAsk me about sourdough." },
    },
  })
  await expect(toLatexFile(resume).text).toMatchFileSnapshot("__snapshots__/latex.tex")
})
