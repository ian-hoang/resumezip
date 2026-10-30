import { describe, expect, test } from "vitest"
import { splitProjectDate, withProjectDates } from "./projectDates"
import { cleanResume } from "./resumeFile"
import { readResume } from "./resumeStorage"

describe("a project's dates from before its start and end", () => {
  test.each([
    ["Jun – Aug 2025", "Jun 2025", "Aug 2025"],
    ["Jan 2024 - Present", "Jan 2024", "Present"],
    ["2023—2024", "2023", "2024"],
    ["May to Aug 2023", "May 2023", "Aug 2023"],
    ["2024", "2024", ""],
    ["Summer 2024", "Summer 2024", ""],
    ["", "", ""],
  ])("“%s” starts “%s” and ends “%s”", (typed, start, end) => {
    expect(splitProjectDate(typed)).toEqual({ start, end })
  })

  test("are read from storage as a start and an end", () => {
    const { resume } = readResume(
      JSON.stringify({ id: "old", projectsSection: [{ id: 1, projectName: "Gitlytics", projectDate: "Sep – Dec 2024" }] }),
    )
    expect(resume!.projectsSection![0]).toEqual({
      id: 1,
      projectName: "Gitlytics",
      projectStartDate: "Sep 2024",
      projectEndDate: "Dec 2024",
    })
  })

  test("are read from a file the same way, as an old PDF's attached resume", () => {
    const content = cleanResume({ projectsSection: [{ projectName: "Raft", projectDate: "2023" }] })
    expect(content.projectsSection?.[0]).toMatchObject({ projectStartDate: "2023", projectEndDate: "" })
  })

  test("leave a start and an end a project has, and a resume saved since, as they are", () => {
    const both = withProjectDates({ projectsSection: [{ id: 1, projectStartDate: "2024", projectDate: "2020" }] })
    expect(both.projectsSection[0]).toEqual({ id: 1, projectStartDate: "2024" })
    const resume = { projectsSection: [{ id: 1, projectStartDate: "2024", projectEndDate: "" }] }
    expect(withProjectDates(resume)).toBe(resume)
  })
})
