// Underlined and linked words (lib/marks.ts) print in every template: a link
// is clickable on its words alone, and its address isn't printed.

import { describe, expect, test } from "vitest"
import { pagesOf, render, shapesOf } from "@/lib/import/testRender"
import { TEMPLATES } from "@/lib/templates"

const resume = (template: string) => ({
  selectedTemplate: template,
  marks: 2,
  profileSection: { fullName: "Ada Lovelace", summary: "Builds [**search** tools](https://example.com/search) that __scale__" },
  workExperienceSection: [
    {
      id: 1,
      companyName: "Google",
      workRole: "Engineer",
      workDescription: "• Shipped the [__dashboard__](https://example.com/dash) on time\n• Wrote \\_\\_init\\_\\_ files",
    },
  ],
})

describe.each(TEMPLATES.map((template) => template.id))("%s", (template) => {
  test("prints linked words as links, without their addresses, and underlined words", async () => {
    const pages = await pagesOf(await render(resume(template)))
    const text = pages.flatMap((page) => page.items.map((item) => item.text)).join(" ")
    expect(text).toContain("dashboard")
    expect(text).toContain("__init__")
    expect(text).not.toContain("example.com")
    expect(text).not.toMatch(/\[|\]\(|\\_/)
    const links = pages.flatMap((page) => page.links.map((link) => link.url))
    expect(links).toContain("https://example.com/dash")
    expect(links).toContain("https://example.com/search")
  })
})

// A profile address, a project's link and a paper's link, each printed as its
// address. The same resume without them prints the same lines less those
// addresses, so each underline is one more shape drawn.
const links = (template: string, linked: boolean) => ({
  selectedTemplate: template,
  profileSection: { fullName: "Ada Lovelace", email: "ada@example.com", personalWebsite: linked ? "ada.dev" : "" },
  projectsSection: [{ id: 1, projectName: "Engine", projectGithub: linked ? "github.com/ada/engine" : "" }],
  publicationsSection: [{ id: 1, publicationTitle: "Notes", publicationLink: linked ? "https://example.com/notes" : "" }],
})

test.each(TEMPLATES.map((template) => template.id))("%s underlines its links", async (template) => {
  const [without, withLinks] = await Promise.all([render(links(template, false)), render(links(template, true))])
  expect((await shapesOf(withLinks)) - (await shapesOf(without))).toBe(3)
})
