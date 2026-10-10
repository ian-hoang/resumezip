// Renders each template's sample resume to PDF with the real Typst templates,
// reads the PDF back the way "Open a file" does for PDFs from elsewhere (no
// resumezip attachment), and checks it prints the same resume.

import { describe, expect, test } from "vitest"
import { cleanResume } from "@/lib/resumeFile"
import { toTemplateData } from "@/lib/typst/resumeData"
import { differences, readBack, render, samples } from "./testRender"

/**
 * Fields each template's sample doesn't read back yet, as paths into the
 * printed data. Fix one in parse.ts, then delete it here; anything that
 * starts differing and isn't listed fails the test.
 */
const KNOWN_GAPS: Record<string, string[]> = {
  ian: [],
  // A comma inside an award's name reads as the start of the organization.
  jake: ["awards[0].name", "awards[0].organization"],
  levelsfyi: [],
  margin: [],
  modernjack: [],
  mono: [],
  // "Organization, City, ST" on one line all reads as the location, and a
  // comma or dash inside an award's name reads as the start of the organization.
  referme: [
    "education[0].school",
    "education[0].location",
    "work[0].company",
    "work[0].location",
    "work[2].company",
    "work[2].location",
    "volunteer[0].organization",
    "volunteer[0].location",
    "awards[0].name",
    "awards[0].organization",
    "awards[1].name",
    "awards[1].organization",
  ],
  // Names of schools, employers, groups and projects are printed in capitals,
  // so their original case can't be read back.
  resumeworded: [
    "education[0].school",
    "education[1].school",
    "leadership[0].organization",
    "projects[0].name",
    "projects[1].name",
    "work[0].company",
    "work[1].company",
    "work[2].company",
  ],
  swiss: [],
}

// What a resume prints, minus differences that print the same or are
// deliberate: the parser writes GPAs without spaces ("3.9/4.0").
function printed(resume: Record<string, unknown>) {
  const data = toTemplateData(resume)
  for (const school of data.education) school.gpa = school.gpa.replace(/\s+/g, "")
  return data
}

describe.each(samples.map((sample) => [sample.selectedTemplate as string, sample]))("the %s sample", (template, sample) => {
  test("reads back as it was printed", async () => {
    const { parsed, resume } = await readBack(await render(sample))
    const want = printed(cleanResume(sample))
    const got = printed(resume)

    expect(parsed.unplaced).toEqual([])
    // Sections are found in the order they're printed; empty ones aren't printed.
    expect(got.order.filter((name) => parsed.sections.some((section) => section.name === name))).toEqual(
      want.order.filter((name) => parsed.sections.some((section) => section.name === name)),
    )
    expect(differences({ ...want, order: [] }, { ...got, order: [] }).sort()).toEqual([...(KNOWN_GAPS[template] ?? [])].sort())
  })
})

test("every template's sample is checked", () => {
  expect(samples.map((sample) => sample.selectedTemplate).sort()).toEqual(Object.keys(KNOWN_GAPS).sort())
})

test("a school with its place on the right starts a new entry, even right after another school", async () => {
  // In the Harvard layout a school's dates are on its second line, and a
  // school with no details is followed straight away by the next one.
  const sample = samples.find((resume) => resume.selectedTemplate === "resumeworded")
  const [first, second] = sample.educationSection
  const resume = { ...sample, educationSection: [{ ...first, gpa: "", coursework: "", involvement: "" }, second] }
  const { resume: got } = await readBack(await render(resume))
  expect(got.educationSection?.map((school) => school.schoolLocation)).toEqual([first.schoolLocation, second.schoolLocation])
  expect(got.educationSection?.map((school) => school.schoolName?.toLowerCase())).toEqual([
    first.schoolName.toLowerCase(),
    second.schoolName.toLowerCase(),
  ])
})

test("bold and italic words in bullets come back marked, in every template", async () => {
  const bullet = "Led **Project Atlas** to a *record* quarter with ***zero*** outages, plus a plain ending"
  for (const sample of samples) {
    const [first, ...rest] = sample.workExperienceSection
    const resume = { ...sample, workExperienceSection: [{ ...first, workDescription: `• ${bullet}` }, ...rest] }
    const { resume: got } = await readBack(await render(resume))
    expect(got.workExperienceSection?.[0].workDescription, sample.selectedTemplate).toBe(`• ${bullet}`)
  }
})

test("a phone number with a plus written apart keeps the plus", async () => {
  const sample = samples.find((resume) => resume.selectedTemplate === "ian")
  const resume = { ...sample, profileSection: { ...sample.profileSection, phoneNumber: "+ (352) 284-0205" } }
  const { parsed, resume: got } = await readBack(await render(resume))
  expect(got.profileSection?.phoneNumber).toBe("+ (352) 284-0205")
  expect(parsed.unplaced).toEqual([])
})

test("a DOI or link holding a year keeps it, and the citation's own date is found", async () => {
  const sample = samples.find((resume) => resume.selectedTemplate === "levelsfyi")
  const resume = {
    ...sample,
    publicationsSection: [
      { ...sample.publicationsSection[0], publicationLink: "10.1109/CVPR.2016.90", publicationDate: "June 2016" },
      { ...sample.publicationsSection[1], publicationLink: "arxiv.org/abs/2023.01234", publicationDate: "Mar. 2024" },
    ],
  }
  const got = printed((await readBack(await render(resume))).resume).publications
  expect(got.map(({ doi, link, date }) => ({ doi, link, date }))).toEqual([
    { doi: "10.1109/CVPR.2016.90", link: "", date: "June 2016" },
    { doi: "", link: "arxiv.org/abs/2023.01234", date: "Mar. 2024" },
  ])
})
