// zero2sudo's schools, as printed: a school and its degree on one line.

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
