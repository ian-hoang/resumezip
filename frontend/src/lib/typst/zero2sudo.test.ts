// zero2sudo's schools and projects, as printed: a school and its degree on
// one line, and a project's name and tech stack first, then its links and date.

import { expect, test } from "vitest"
import { linesFromPages } from "@/lib/import/lines"
import { pagesOf, render } from "@/lib/import/testRender"

const linesOf = async (resume: Record<string, unknown>) =>
  linesFromPages(await pagesOf(await render({ selectedTemplate: "zero2sudo", ...resume })))

test("prints a school and its degree on one line, without a bullet", async () => {
  const lines = await linesOf({
    educationSection: [{ id: 1, schoolName: "Rice University", degree: "B.S. in Computer Science", schoolEndDate: "2024" }],
  })
  expect(lines.slice(1).map((line) => [line.text, line.bullet])).toEqual([["Rice University - B.S. in Computer Science 2024", false]])
})

test("prints a project's name and tech stack, then its links and date", async () => {
  const lines = await linesOf({
    projectsSection: [
      { id: 1, projectName: "Atlas", techStack: "Go, Redis", projectGithub: "github.com/ada/atlas", projectStartDate: "2024" },
      { id: 2, projectName: "Beacon", projectStartDate: "2023" },
      { id: 3, projectName: "Comet", techStack: "Rust" },
    ],
  })
  expect(lines.map((line) => line.text).slice(1)).toEqual([
    "Atlas | Go, Redis",
    "github.com/ada/atlas 2024",
    "Beacon",
    "2023",
    "Comet | Rust",
  ])
})
