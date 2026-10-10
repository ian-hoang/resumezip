import { describe, expect, test } from "vitest"
import { linesFromDocx } from "@/lib/import/lines"
import { samples } from "@/lib/import/testRender"
import { asSaved } from "@/lib/testResume"
import { toWordFile } from "./word"
import { storedFile, zipDirectory } from "./zip"

const talks = "11111111-1111-4111-8111-111111111111"

/** The files in a Word file, by name, as text. */
function partsOf(file: Uint8Array<ArrayBuffer>): Record<string, string> {
  const entries = zipDirectory(file.buffer)
  if (!Array.isArray(entries)) throw new Error("Not a zip")
  return Object.fromEntries(entries.map((entry) => [entry.name, new TextDecoder().decode(storedFile(file.buffer, entry)!)]))
}

describe("a Word file", () => {
  test("says what each file in it is, and has each file it points to", () => {
    const parts = partsOf(toWordFile(samples[0]))
    const types = parts["[Content_Types].xml"]
    for (const name of Object.keys(parts)) {
      expect(types.includes(`PartName="/${name}"`) || types.includes(`Extension="${name.split(".").pop()}"`), name).toBe(true)
    }
    for (const [relationships, folder] of [
      ["_rels/.rels", ""],
      ["word/_rels/document.xml.rels", "word/"],
    ]) {
      for (const [, target, external] of parts[relationships].matchAll(/Target="([^"]*)"( TargetMode="External")?/g)) {
        if (!external) expect(parts, target).toHaveProperty([folder + target])
      }
    }
  })

  test("leaves out what the PDF leaves out", () => {
    const [job] = samples[0].workExperienceSection
    const resume = asSaved({
      ...samples[0],
      workExperienceSection: [
        { ...job, id: 1, companyName: "Left Out Corp", leftOut: true },
        { ...job, id: 2, workDescription: "• Printed bullet\n○ Left-out bullet" },
      ],
    })
    const parts = partsOf(toWordFile(resume))
    for (const part of [parts["word/document.xml"], parts["resumezip.json"]]) {
      expect(part).toContain("Printed bullet")
      expect(part).not.toContain("Left Out Corp")
      expect(part).not.toContain("Left-out bullet")
    }
  })

  test("has the person's headings, or the templates', in the resume's order after the summary", async () => {
    const resume = asSaved({
      selectedTemplate: "jake",
      profileSection: { fullName: "Mara Lin", summary: "Builds tools.\n\nWrites about them." },
      headings: { work: "Where I've worked" },
      sectionOrder: ["Skills", `extra:${talks}`, "Work"],
      skillsSection: [{ id: 1, skillName: "Languages", skillDetails: "Go, Rust" }],
      workExperienceSection: [{ id: 1, companyName: "Stripe", workRole: "Engineer" }],
      extraSections: { [talks]: { kind: "list", heading: "Talks", bullets: "• On fast tools" } },
    })
    const lines = await linesFromDocx(toWordFile(resume).buffer)
    expect(lines.filter((line) => line.heading).map((line) => line.text)).toEqual(["Summary", "Skills", "Talks", "Where I've worked"])
    expect(lines.map((line) => line.text)).toEqual(
      expect.arrayContaining(["Builds tools.", "Writes about them.", "Languages: Go, Rust", "On fast tools"]),
    )
  })

  test("links contacts, projects and papers, printed as their addresses, and doesn't link what isn't one", async () => {
    const resume = asSaved({
      selectedTemplate: "jake",
      profileSection: {
        fullName: "Mara Lin",
        email: "mara@example.com",
        linkedin: "https://www.linkedin.com/in/maralin/",
        personalWebsite: "not an address",
      },
      projectsSection: [{ id: 1, projectName: "Atlas", projectGithub: "github.com/maralin/atlas" }],
      publicationsSection: [{ id: 1, publicationTitle: "Fast tools", publicationLink: "https://doi.org/10.1145/3580305" }],
    })
    const lines = await linesFromDocx(toWordFile(resume).buffer)
    expect(lines.flatMap((line) => line.links)).toEqual([
      "mailto:mara@example.com",
      "https://linkedin.com/in/maralin",
      "https://github.com/maralin/atlas",
      "https://doi.org/10.1145/3580305",
    ])
    expect(lines[1].text).toBe("mara@example.com | linkedin.com/in/maralin | not an address")
    expect(lines.map((line) => line.text)).toEqual(
      expect.arrayContaining(["Atlas | github.com/maralin/atlas", "“Fast tools,” doi: 10.1145/3580305."]),
    )
  })

  test("drops what XML can't hold, and keeps everything else as typed", async () => {
    const name = `Ada <Lovelace> & "Co" 🎉`
    const file = toWordFile(asSaved({ selectedTemplate: "jake", profileSection: { fullName: `${name}\u0001\uD800` } }))
    expect((await linesFromDocx(file.buffer)).map((line) => line.text)).toEqual([name])
    expect(partsOf(file)["docProps/core.xml"]).toContain("<dc:title>Ada &lt;Lovelace&gt; &amp; &quot;Co&quot; 🎉</dc:title>")
  })

  test("of an empty resume can still be opened", async () => {
    const file = toWordFile(asSaved({}))
    expect(partsOf(file)["word/document.xml"]).toContain("<w:body><w:p/><w:sectPr>")
    expect(await linesFromDocx(file.buffer)).toEqual([])
  })
})
