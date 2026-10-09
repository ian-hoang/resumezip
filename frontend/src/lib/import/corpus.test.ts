// The test set: resumes made the way people make them (LaTeX, a word
// processor, browser-based builders), read back the way "Open a file" reads
// them, and checked against what they say, field by field. A change to the
// parser fails here if it reads any field of any of them worse than before,
// or reads one it already gets wrong any differently. See corpus/README.md.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { toTemplateData } from "@/lib/typst/resumeData"
import { differences, readBack } from "./testRender"

const CORPUS = path.resolve("src/lib/import/corpus")

/** Every PDF in the test set, as "person/layout". */
const files = readdirSync(CORPUS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((person) =>
    readdirSync(path.join(CORPUS, person.name))
      .filter((file) => file.endsWith(".pdf"))
      .map((file) => `${person.name}/${file.replace(/\.pdf$/, "")}`),
  )
  .sort()

/**
 * Fields each file doesn't read back right yet, as paths into what's printed
 * ("work[0].role"; "work[3]" is an entry that shouldn't be there, or is
 * missing). Fix one in parse.ts, then delete it here; anything that starts
 * differing and isn't listed fails the test.
 */
const KNOWN_GAPS: Record<string, string[]> = {
  // pdfTeX prints "~90%" with a math tilde, "∼90%".
  "diego/latex-jake": ["work[0].bullets"],
  // A project's "Name, tech" isn't split.
  "diego/html-harvard": ["projects[0].name", "projects[0].techStack", "projects[1].name", "projects[1].techStack"],
  "diego/writer-classic": [],
  // "Degree. GPA 3.6/4.0" leaves the degree's full stop on.
  "jordan/html-harvard": ["education[0].degree"],
  "jordan/html-modern": [],
  // Headings in a margin column, level with the first line beside them, aren't
  // found, so almost everything goes to "Couldn't place".
  "jordan/html-side-headings": [
    "education[0]",
    "work[0]",
    "work[1]",
    "work[2]",
    "skills[0]",
    "skills[1]",
    "volunteer[0]",
    "awards[0]",
    "awards[1]",
  ],
  "jordan/writer-modern": [],
  // "Sprout – HackGT 2026" splits at the dash, so "HackGT 2026" reads as a
  // tool. "Role, Company" on one line all reads as the role.
  "maya/html-modern": [
    "work[0].company",
    "work[0].role",
    "projects[1].name",
    "projects[1].techStack",
    "leadership[0].organization",
    "leadership[0].role",
  ],
  // "Sprout – HackGT 2026" splits as in maya/html-modern.
  "maya/latex-jake": ["projects[1].name", "projects[1].techStack"],
  // As in maya/latex-jake.
  "maya/latex-jake-company-first": ["projects[1].name", "projects[1].techStack"],
  // An academic CV in Typst. A colon in the study abroad's name cuts the
  // degree short. The advisor entry's paragraph reads as its organization,
  // and "Director of Technology" doesn't read as a role, "technology" being
  // a word for organizations.
  "marcus/typst-academic": [
    "education[2].degree",
    "leadership[0].organization",
    "leadership[0].bullets",
    "leadership[3].organization",
    "leadership[3].role",
  ],
  "nadia/writer-company-first": [],
  "nadia/latex-jake": [],
  // With dates in a column on the left, each entry's title lines split into
  // two entries. A dash inside an award's name ("Architect – Professional")
  // reads as the start of the organization.
  "priya/html-dates-left": [
    "education[0].school",
    "education[0].location",
    "education[0].gpa",
    "education[1]",
    "work[0].company",
    "work[0].location",
    "work[0].bullets",
    "work[1].company",
    "work[1].role",
    "work[1].start",
    "work[1].end",
    "work[1].bullets",
    "work[2].company",
    "work[2].location",
    "work[2].role",
    "work[2].start",
    "work[2].end",
    "work[2].bullets",
    "work[3].company",
    "work[3].location",
    "work[3].role",
    "work[3].start",
    "work[3].end",
    "work[3].bullets",
    "work[4]",
    "work[5]",
    "work[6]",
    "work[7]",
    "volunteer[0].organization",
    "volunteer[0].location",
    "volunteer[0].bullets",
    "volunteer[1]",
    "awards[0].name",
    "awards[0].organization",
  ],
  // Award names that wrap in the narrow column split where they wrap.
  "priya/html-sidebar": ["awards[0].name", "awards[0].organization", "awards[1].name", "awards[1].organization"],
  // A dash inside an award's name reads as the start of the organization.
  "priya/latex-jake": ["awards[0].name", "awards[0].organization"],
  // As in priya/latex-jake.
  "priya/writer-modern": ["awards[0].name", "awards[0].organization"],
  // The degree keeps its full stop, as in jordan/html-harvard. A comma
  // inside an award's name ("Registered Nurse License, Texas") reads
  // as the start of the organization.
  "sam/html-harvard": ["education[0].degree", "awards[0].name", "awards[0].organization"],
  // As in jordan/html-side-headings.
  "sam/html-side-headings": [
    "education[0]",
    "work[0]",
    "work[1]",
    "work[2]",
    "skills[0]",
    "skills[1]",
    "skills[2]",
    "volunteer[0]",
    "awards[0]",
    "awards[1]",
    "awards[2]",
  ],
  // Award names that wrap in the narrow column split where they wrap, and a
  // comma inside one reads as the start of the organization.
  "sam/html-sidebar": [
    "awards[0].name",
    "awards[0].organization",
    "awards[1].name",
    "awards[1].organization",
    "awards[2].name",
    "awards[2].organization",
  ],
  // A comma inside an award's name reads as the start of the organization.
  "sam/writer-classic": ["awards[0].name", "awards[0].organization"],
  // As in priya/html-dates-left, and citations with their date in the left
  // column split into several.
  "wei/html-dates-left": [
    "education[0].school",
    "education[0].location",
    "education[0].start",
    "education[0].end",
    "education[1].school",
    "education[1].location",
    "education[1].degree",
    "education[1].gpa",
    "education[1].start",
    "education[1].end",
    "education[2]",
    "education[3]",
    "work[0].company",
    "work[0].location",
    "work[0].bullets",
    "work[1].company",
    "work[1].location",
    "work[1].role",
    "work[1].start",
    "work[1].end",
    "work[1].bullets",
    "work[2].company",
    "work[2].location",
    "work[2].role",
    "work[2].start",
    "work[2].end",
    "work[2].bullets",
    "work[3]",
    "work[4]",
    "work[5]",
    "publications[0].title",
    "publications[0].authors",
    "publications[0].venue",
    "publications[0].link",
    "publications[1].title",
    "publications[1].authors",
    "publications[1].venue",
    "publications[1].details",
    "publications[1].date",
    "publications[1].link",
    "publications[2].title",
    "publications[2].authors",
    "publications[2].venue",
    "publications[2].details",
    "publications[2].date",
    "publications[2].doi",
    "publications[3]",
    "publications[4]",
  ],
  "wei/latex-jake": [],
  "wei/writer-classic": [],
}

/**
 * What a resume prints, in a form that's easy to compare: bullets and
 * authors as plain text, GPAs without spaces. Headings and the order of
 * sections are left out: the reader keeps neither, and a layout can print
 * sections in its own order, like a sidebar.
 */
function printed(resume: Record<string, unknown>) {
  // The sections a person adds aren't in the corpus, and the summary is checked on its own, below.
  const { headings, order, extras, summary, ...data } = toTemplateData(resume)
  const plain = (bullets: { text: string }[][]) => bullets.map((runs) => runs.map((run) => run.text).join(""))
  const withPlainBullets = <T extends { bullets: { text: string }[][] }>(entries: T[]) =>
    entries.map((entry) => ({ ...entry, bullets: plain(entry.bullets) }))
  return {
    ...data,
    education: data.education.map((school) => ({ ...school, gpa: school.gpa.replace(/\s+/g, "") })),
    work: withPlainBullets(data.work),
    projects: withPlainBullets(data.projects),
    leadership: withPlainBullets(data.leadership),
    volunteer: withPlainBullets(data.volunteer),
    publications: data.publications.map((publication) => ({
      ...publication,
      authors: publication.authors.map((piece) => piece.text).join(""),
    })),
  }
}

/** The value at a path from `differences`. */
const valueAt = (value: unknown, where: string) =>
  where
    .split(/[.[\]]+/)
    .filter(Boolean)
    .reduce<unknown>((inside, key) => (inside as Record<string, unknown> | null | undefined)?.[key], value)

describe.each(files)("%s", (file) => {
  test("reads back no worse than before", async () => {
    const [person] = file.split("/")
    const want = printed(JSON.parse(readFileSync(path.join(CORPUS, person, "resume.json"), "utf8")))
    const { resume } = await readBack(new Uint8Array(readFileSync(path.join(CORPUS, `${file}.pdf`))))
    const got = printed(resume)

    const wrong = differences(want, got)
    const known = KNOWN_GAPS[file] ?? []
    const show = (value: unknown) => JSON.stringify(value) ?? "nothing"
    expect({
      // A change made these worse.
      newlyWrong: wrong
        .filter((field) => !known.includes(field))
        .map((field) => `${field}: want ${show(valueAt(want, field))}, got ${show(valueAt(got, field))}`),
      // A change fixed these: delete them from KNOWN_GAPS.
      nowRight: known.filter((field) => !wrong.includes(field)),
    }).toEqual({ newlyWrong: [], nowRight: [] })
    // What the known gaps read as, which a change can make worse while
    // they stay wrong.
    expect(Object.fromEntries(known.map((field) => [field, valueAt(got, field)]))).toMatchSnapshot()
  })

  test("the import reads the summary as it was typed", async () => {
    const [person] = file.split("/")
    const fixture = JSON.parse(readFileSync(path.join(CORPUS, person, "resume.json"), "utf8"))
    const { parsed, resume } = await readBack(new Uint8Array(readFileSync(path.join(CORPUS, `${file}.pdf`))))
    const summaries = parsed.extraGroups?.filter((group) => group.kind === "summary") ?? []
    if (summaries.length) {
      // As typed: the PDF's lines are joined back up where they only wrapped.
      expect(resume.profileSection.summary).toBe(fixture.summary)
      expect(summaries).toHaveLength(1)
    }
  })
})

test("every file has its known gaps listed, even when there are none", () => {
  expect(Object.keys(KNOWN_GAPS).sort()).toEqual(files)
})
