// Underlined and linked words (lib/marks.ts) print in every template: a link
// is clickable on its words alone, and its address isn't printed.

import { describe, expect, test } from "vitest"
import { pagesOf, render } from "@/lib/import/testRender"
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
