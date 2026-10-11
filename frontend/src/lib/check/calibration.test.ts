// Where the score puts resumes of known quality, from trash to strong. Each
// is the Jake template's sample with its experience rewritten, printed and
// read back, and checked for spelling, as the editor does. When a change to
// the rules or their weights moves one of these out of its range, the score
// no longer means what it says.

import { describe, expect, test } from "vitest"
import { readForChecks } from "@/lib/import/read"
import { readBack, render, samples } from "@/lib/import/testRender"
import { runChecks } from "./engine"
import { pdfLayoutOf } from "./extraPdf"
import { viewOf } from "./resume"
import { scoreOf } from "./score"
import { grammarTexts } from "./spelling"
import { readingOf } from "./testHarper"

const TODAY = new Date(2026, 9, 7)

const jake = samples.find((resume) => resume.selectedTemplate === "jake")!

async function scoreOfResume(resume: Record<string, unknown>): Promise<number> {
  const { parsed, pages } = await readBack(await render(resume))
  const pdf = readForChecks(parsed.lines, pdfLayoutOf(viewOf(resume)))
  const grammar = await readingOf(grammarTexts(viewOf(resume)).map(({ text }) => text))
  return scoreOf(runChecks(resume, { pdf: { lines: pdf.parsed.lines, pages, ...pdf }, grammar, today: TODAY })).total!
}

const bulleted = (bullets: string[]) => bullets.map((bullet) => `• ${bullet}`).join("\n")

/**
 * The sample with its bullets rewritten, in order: each job's, each
 * project's and the leadership role's. Those past a list keep the sample's.
 */
function rewritten({ work = [], projects = [], leadership = [] }: { work?: string[][]; projects?: string[][]; leadership?: string[] }) {
  const replace = (entries: Record<string, unknown>[], field: string, lists: string[][]) =>
    entries.map((entry, index) => (lists[index] ? { ...entry, [field]: bulleted(lists[index]) } : entry))
  return {
    ...jake,
    workExperienceSection: replace(jake.workExperienceSection, "workDescription", work),
    projectsSection: replace(jake.projectsSection, "projectDescription", projects),
    leadershipExperienceSection: replace(jake.leadershipExperienceSection, "leadershipDescription", leadership.length ? [leadership] : []),
  }
}

const RESUMES: { name: string; resume: Record<string, unknown>; least: number; most: number }[] = [
  {
    name: "duties and filler, nothing specific",
    resume: rewritten({
      work: [
        ["Responsible for backend work", "Helped with various tasks", "Did testing"],
        ["Worked on the dashboard", "Assisted with stuff"],
        ["Helped students", "Did grading"],
      ],
      projects: [["Worked on a website for students"], ["Built a project for class"]],
      leadership: ["Responsible for workshops"],
    }),
    least: 0,
    most: 50,
  },
  {
    name: "two-word bullets",
    resume: rewritten({
      work: [["Developed software", "Fixed bugs"], ["Built dashboards"], ["Taught students"]],
      projects: [["Degree planner"], ["Raft in Go"]],
      leadership: ["Ran workshops"],
    }),
    least: 0,
    most: 69,
  },
  {
    name: "results in name only",
    resume: rewritten({
      work: [
        ["Improved the code", "Increased quality", "Reduced bugs"],
        ["Attended 5 meetings", "Worked with 3 teams"],
        ["Enabled the team", "Helped with 4 tasks"],
      ],
      projects: [["Improved the planner for users"], ["Increased performance of the code"]],
      leadership: ["Led 6 meetings"],
    }),
    least: 0,
    most: 69,
  },
  {
    name: "real work, but no scope or results",
    resume: rewritten({
      work: [
        [
          "Built a Go service for Google Maps that merges edits to business hours from owners and reviewers",
          "Added tracing to the edit pipeline and found a slow storage lookup",
          "Wrote a load test that replays a busy holiday weekend of edits",
        ],
        [
          "Built a React dashboard that tracks over-the-air software updates by vehicle model",
          "Wrote Python checks for vehicle telemetry records",
        ],
        [
          "Led lab sections and held office hours on pointers, graphs and recursion in C++",
          "Wrote autograder tests for hash table assignments",
        ],
      ],
      projects: [
        ["Degree planner that checks schedules against major requirements and prerequisites"],
        ["Implemented Raft in Go with leader election, log replication and snapshots"],
      ],
      leadership: ["Run a monthly workshop series on Git, web APIs and Docker"],
    }),
    least: 70,
    most: 82,
  },
  {
    name: "strong, with obvious typos",
    resume: rewritten({
      work: [
        [
          "Built a Go sevrice for Google Maps that merges edits to business hours, cutting the time before an approved change shows up from six hours to 30 minutes",
          "Added tracing to the edit pipeline and found a slow storage lookup that added 900 ms to every reqeust",
          "Wrote a load test that replays a busy holiday weekend of edits, now run before every relase",
        ],
        [
          "Built a React dashboard that tracks over-the-air sofware updates by vehicle model for 40 release engineers",
          "Wrote Python checks that scan 2 million vehicle telemetry records each night, catching two bad sensor firmware bulids",
        ],
      ],
    }),
    least: 0,
    most: 82,
  },
  {
    name: "one job with one bullet, no education or skills",
    resume: {
      ...jake,
      workExperienceSection: [{ ...jake.workExperienceSection[0], workDescription: bulleted(["Built a website used by 200 customers"]) }],
      projectsSection: [],
      leadershipExperienceSection: [],
      awardsSection: [],
      educationSection: [],
      skillsSection: [],
    },
    least: 0,
    most: 79,
  },
  {
    name: "strong, full of real jargon",
    resume: rewritten({
      work: [
        [
          "Built a Go service with protobuf APIs that backfilled 3 million business-hour edits, cutting time to search from six hours to 30 minutes",
          "Wrote runbooks and Datadog monitors for the edit pipeline, cutting pages to on-call engineers by half",
          "Added multithreaded load tests that replay a holiday weekend of edits before each of 20 releases",
        ],
        [
          "Built a React and Redux dashboard with Zod-validated APIs for 40 release engineers tracking over-the-air updates",
          "Wrote Pydantic models and Splunk alerts that scan 2 million telemetry records nightly, catching two bad firmware builds",
        ],
      ],
    }),
    least: 90,
    most: 100,
  },
  { name: "the template's own sample", resume: jake, least: 95, most: 100 },
]

describe("scores resumes of known quality where they belong", () => {
  for (const { name, resume, least, most } of RESUMES) {
    test(`${name}: ${least}–${most}`, async () => {
      const total = await scoreOfResume(resume)
      expect(total).toBeGreaterThanOrEqual(least)
      expect(total).toBeLessThanOrEqual(most)
    })
  }
})
