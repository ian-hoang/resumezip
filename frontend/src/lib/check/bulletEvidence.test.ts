import { describe, expect, test } from "vitest"
import { hasOutcome, hasScope, isGenericBullet } from "./bulletEvidence"

describe("scope cues", () => {
  test("recognizes the size or reach of work, including words and units", () => {
    for (const text of [
      "Led 4 engineers",
      "Mentored two students",
      "Mentored two junior engineers",
      "Handled 2,000 requests",
      "Saved $2M",
      "Cut delays by 40%",
      "Halved wait times",
    ]) {
      expect(hasScope(text), text).toBe(true)
    }
  })

  test("does not treat versions, dates, standards or IDs as measurements", () => {
    for (const text of [
      "Used Python 3",
      "Built HTML5 and CSS3 tools",
      "Shipped version 2.0",
      "Used ISO 27001",
      "Handled ticket #1234",
      "Launched on 2024-01-01",
      "Launched in 2024 in London",
      "Built in 2024 for clients",
    ]) {
      expect(hasScope(text), text).toBe(false)
    }
    expect(hasScope("Migrated Python 3 services for 40 teams")).toBe(true)
  })

  test("a count of meetings or tasks says how busy, not how far the work reached", () => {
    for (const text of ["Attended 5 meetings", "Helped with 4 weekly tasks", "Juggled 3 things"]) expect(hasScope(text), text).toBe(false)
  })
})

describe("qualitative result cues", () => {
  test("recognizes useful changes without demanding a number", () => {
    for (const text of [
      "Restored access to patient records during an outage",
      "Wrote guidance adopted by the support team",
      "Resolved keyboard navigation barriers in the checkout",
      "Built a dashboard used by the dispatch team",
      "Created training so volunteers could answer urgent calls",
      "Helped a food bank forecast demand, so its volunteers could plan deliveries a month ahead",
      "Built a scheduler that allowed the clinic's nurses to swap shifts",
    ])
      expect(hasOutcome(text), text).toBe(true)
    expect(hasOutcome("Built a dashboard")).toBe(false)
  })

  test("a change that doesn't say what changed isn't a result", () => {
    for (const text of [
      "Improved the code",
      "Increased overall quality",
      "Reduced bugs",
      "Enabled the team",
      "Used by people",
      "Led to better results",
    ])
      expect(hasOutcome(text), text).toBe(false)
    for (const text of [
      "Improved page load speed",
      "Reduced customer churn",
      "Enabled support agents to close tickets",
      "Led to faster releases",
    ])
      expect(hasOutcome(text), text).toBe(true)
  })
})

describe("generic descriptions", () => {
  test("adding numbers to unnamed tasks does not add substantive detail", () => {
    for (const text of [
      "Built 2 tools for the team",
      "Created 3 reports for the business",
      "Managed 4 tasks on various projects",
      "Built",
    ]) {
      expect(isGenericBullet(text), text).toBe(true)
    }
  })

  test("does not reject brief but specific work or infer meaning from unknown sentence forms", () => {
    for (const text of [
      "Built a search index",
      "Maintained PostgreSQL",
      "Assisted patients",
      "Interactive map of subway delays",
      "Marketing reports informed policy",
      'Built "Tools" for the team',
      "Developed “Business”",
      "Built 'Tools' for the team",
      "Built `tools` for the team",
    ]) {
      expect(isGenericBullet(text), text).toBe(false)
    }
  })
})
