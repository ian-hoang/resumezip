import { describe, expect, test } from "vitest"
import type { Resume } from "@/lib/resume"
import { pronounIn } from "./bullets"
import { runChecks } from "./engine"
import { RULES } from "./rules"

const job = (bullets: string[], workEndDate = "Present", companyName = "Google") => ({
  id: 1,
  workRole: "Engineer",
  companyName,
  workStartDate: "Jan 2022",
  workEndDate,
  workDescription: bullets.map((bullet) => `• ${bullet}`).join("\n"),
})

const project = (bullets: string[]) => ({
  id: 1,
  projectName: "Gitlytics",
  projectDescription: bullets.map((bullet) => `• ${bullet}`).join("\n"),
})

const resumeWith = (...jobs: ReturnType<typeof job>[]) => ({ profileSection: { fullName: "Jake Ryan" }, workExperienceSection: jobs })

const TODAY = new Date(2026, 9, 7)

/** What one rule says about a resume. */
function check(id: string, resume: Resume) {
  const rule = RULES.find((rule) => rule.id === id)!
  const report = runChecks(resume, { rules: [rule], today: TODAY })
  return {
    status: report.results[0].status,
    credit: report.results[0].credit,
    scoring: report.results[0].scoring,
    messages: report.findings.map((finding) => finding.message),
    findings: report.findings,
  }
}

const bulletAt = (line: number, entry = 0) => ({ kind: "entry", section: "Work", entry, field: "workDescription", line })

const good = ["Built a search index that cut query time by 40%", "Led a team of 4 engineers", "Wrote the API docs used by 30 partners"]

test("well-written bullets pass every bullet rule", () => {
  for (const id of ["B1", "B2", "B3", "B4", "B5", "B6", "B8", "B9"]) {
    expect(check(id, resumeWith(job(good))).status, id).toBe("passed")
  }
  // Still going, so nothing to put in the past tense.
  expect(check("B7", resumeWith(job(good))).status).toBe("skipped")
})

describe("B1 weak starts", () => {
  test("points at each bullet with one", () => {
    const resume = resumeWith(job(["Responsible for the build system", "Helped launch the app", "Worked on search", "Assisted the team"]))
    expect(check("B1", resume).messages).toEqual(["“Responsible for” is a weak start", "“Worked on” is a weak start"])
    expect(check("B1", resume).findings[1].place).toEqual(bulletAt(2))
    // A duty instead of a contribution counts as a suggestion: dismissing it gives the points back.
    expect(check("B1", resume).findings.every((finding) => finding.level === "look" && !finding.advisory)).toBe(true)
    expect(check("B1", resume).scoring).toMatchObject({ failed: true, level: "look", credit: 0.5 })
  })

  test("accepts supporting contributions without asking someone to overstate their role", () => {
    const bullets = ["Helped launch the app", "Assisted patients with medication reminders", "Participated in accessibility research"]
    for (const id of ["B1", "B2"]) expect(check(id, resumeWith(job(bullets))).status, id).toBe("passed")
  })

  test("doesn't flag words that only start the same way", () => {
    expect(
      check("B1", resumeWith(job(["Helpdesk tickets fell by half after the redesign", "Assistant coach for the robotics team"]))).status,
    ).toBe("passed")
  })
})

describe("B2 action verbs", () => {
  test("coaches unclear openings while accepting a result first", () => {
    expect(
      check("B2", resumeWith(job(["The dashboard was used by 40 teams", "Built the search index", "Experienced in Python and Go"])))
        .findings,
    ).toEqual([expect.objectContaining({ place: bulletAt(2), message: "Could you name your action?", advisory: true })])
  })

  test("takes any tense, British spellings, and bullets that start with a number", () => {
    const bullets = [
      "Lead a team of 4",
      "Optimised the build",
      "Co-founded the club",
      "Building a new parser",
      "50% fewer pages after the redesign",
      "$2M saved in cloud costs",
      "Successfully launched the search index",
      "Independently built the search index",
      "Research findings informed the hospital's discharge policy",
    ]
    expect(check("B2", resumeWith(job(bullets))).status).toBe("passed")
  })

  test("leaves projects, weak starts and “I” to other rules", () => {
    const resume = {
      ...resumeWith(job(["Responsible for the build system", "I built the search index"])),
      projectsSection: [project(["Interactive map of subway delays"])],
    }
    expect(check("B2", resume).status).toBe("passed")
  })
})

describe("B3 scope and results", () => {
  test("asks half of a role's bullets for a scope or result, and a result needs no number", () => {
    const bullets = ["Built the search index", "Led the redesign", "Wrote the API docs for 30 partner teams", "Cut query time by 40%"]
    expect(check("B3", resumeWith(job(bullets))).status).toBe("passed")
    expect(check("B3", resumeWith(job(["Restored access to patient records during an outage"]))).status).toBe("passed")
    // One number shouldn't carry a role of four bullets.
    const one = check("B3", resumeWith(job(["Built the search index", "Led the redesign", "Wrote the API docs", "Cut query time by 40%"])))
    expect(one.messages).toEqual(["Only 1 of 4 bullets show a scope or result"])
    expect(one.scoring).toMatchObject({ failed: true, level: "look" })
  })

  test("a change or a result counts only when it says what changed", () => {
    for (const bullet of ["Improved the code", "Increased quality", "Reduced bugs", "Enabled the team", "Built a tool used by people"]) {
      expect(check("B3", resumeWith(job([bullet]))).status, bullet).toBe("failed")
    }
    for (const bullet of ["Cut deploy time for the mobile app", "Reduced customer churn", "Built a tool used by the dispatch team"]) {
      expect(check("B3", resumeWith(job([bullet]))).status, bullet).toBe("passed")
    }
  })

  test("a count of meetings or tasks, or a number in a generic bullet, isn't scope", () => {
    for (const bullet of ["Attended 5 meetings", "Helped with 4 tasks", "Built 2 tools for the team"]) {
      expect(check("B3", resumeWith(job([bullet]))).status, bullet).toBe("failed")
    }
  })

  test("counts digits, %, $ and numbers written as words", () => {
    const bullets = ["Built the search index", "Mentor two junior engineers", "Saved $2M a year", "Led the redesign"]
    expect(check("B3", resumeWith(job(bullets))).status).toBe("passed")
  })

  test("counts a role without scope or result evidence as a suggestion, once per role", () => {
    const result = check("B3", resumeWith(job(["Built the search index", "Led the redesign"])))
    expect(result.findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Work", entry: 0, field: "workDescription" },
        message: "Could you add the scope or result?",
        level: "look",
      }),
    ])
    expect(result.findings[0].advisory).toBeUndefined()
    expect(result.scoring).toMatchObject({ failed: true, level: "look", credit: 0 })
    expect(check("B3", resumeWith(job([]))).status).toBe("skipped")
  })

  test("only advises a project, whose bullets often say what it is, and scores by the roles alone", () => {
    const roleWithResult = job(["Cut query time by 40%"])
    const resume = { ...resumeWith(roleWithResult), projectsSection: [project(["Interactive map of subway delays"])] }
    const result = check("B3", resume)
    expect(result.findings).toEqual([expect.objectContaining({ place: expect.objectContaining({ section: "Projects" }), advisory: true })])
    expect(result.scoring).toMatchObject({ failed: false, credit: 1 })
  })

  test("takes a count of anything plural as scope", () => {
    for (const bullet of [
      "Built a dashboard for 1,500 robots in two warehouses",
      "Tracked food stock across six partner pantries",
      "Wrote a chaos test that found three ordering bugs",
      "Open-source proxy with 900 GitHub stars",
      "Wrote 12 APIs for the mobile app",
    ]) {
      expect(check("B3", resumeWith(job([bullet]))).status, bullet).toBe("passed")
    }
    // A count before a word that only ends in s isn't one.
    for (const bullet of ["Led 1 campus tour", "Wrote 1 analysis", "Placed 2nd across the region", "Room 4 has a lab"]) {
      expect(check("B3", resumeWith(job([bullet]))).status, bullet).toBe("failed")
    }
  })

  test("versions, dates and identifiers do not stand in for scope", () => {
    const bullets = ["Wrote Python 3 scripts", "Used HTML5 and CSS3", "Handled ticket #1234", "Shipped version 2.0 in 2024"]
    expect(check("B3", resumeWith(job(bullets))).messages).toEqual(["Could you add the scope or result?"])
  })
})

describe("B4 “I” and “we”", () => {
  test("flags each bullet that uses them", () => {
    const resume = resumeWith(
      job(["I built the search index", "Grew our user base", "Led my team", "We shipped weekly", "Built it so i could test it"]),
    )
    expect(check("B4", resume).messages).toEqual(["Uses “I”", "Uses “our”", "Uses “my”", "Uses “We”", "Uses “i”"])
    // A suggestion that counts, until it's dismissed.
    expect(check("B4", resume).scoring).toMatchObject({ failed: true, level: "look", credit: 0 })
  })

  test("doesn't take other words for them", () => {
    for (const text of [
      "Wrote I/O drivers",
      "Ran a Phase I trial",
      "Raised funds for Save Our Seas",
      "Ran IT support",
      "Grew US sales",
      "Cut costs, i.e. hosting",
      "Taught ME 101",
      "Built https://example.org/our/docs",
      "Maintained my@example.org",
      "Launched “My Health” for the hospital",
    ]) {
      expect(pronounIn(text), text).toBeNull()
    }
  })
})

describe("B5 buzzwords and vague words", () => {
  test("flags them, saying which", () => {
    const resume = resumeWith(job(["Results-driven engineer who shipped fast", "Worked with various teams", "Built tools, scripts, etc."]))
    expect(check("B5", resume).messages).toEqual(["“Results-driven” says little on its own", "“various” is vague", "“etc.” is vague"])
    expect(check("B5", resume).scoring).toMatchObject({ failed: true, level: "look", credit: 0 })
  })

  test("doesn't flag technical words that look like them", () => {
    const bullets = [
      "Used dynamic programming to cut costs",
      "Built an Internet of Things gateway",
      "Led a variety show",
      "Made the build faster and more reliable",
      "Built the results-driven dashboard for the sales team",
      "Results-driven engineer who restored access to patient records",
      "Worked with various teams across 12 locations",
    ]
    expect(check("B5", resumeWith(job(bullets))).status).toBe("passed")
  })
})

describe("B6 the same first verb", () => {
  test("flags the third bullet on, whatever the tense, with other verbs to try", () => {
    const resume = resumeWith(job(["Built the index", "Build the parser", "Built the cache", "Built the queue", "Led the team"]))
    expect(check("B6", resume).findings).toEqual([
      expect.objectContaining({
        place: bulletAt(2),
        message: "“Built” starts 3 nearby bullets",
        suggestion: "If they fit what you did, consider “Created”, “Developed”, “Engineered”.",
      }),
      expect.objectContaining({ place: bulletAt(3) }),
    ])
  })

  test("counts verbs only", () => {
    const bullets = [
      "The index",
      "The parser",
      "The cache",
      "Building a queue",
      "Building a cache",
      "Building a log",
      "Built X",
      "Led Y",
      "Wrote Z",
    ]
    expect(check("B6", resumeWith(job(bullets))).status).toBe("passed")
  })

  test("does not pool repetitions across experiences or separated bullets", () => {
    const separated = ["Built the index", "Led the migration", "Built the cache", "Wrote the guide", "Built the queue"]
    expect(check("B6", resumeWith(job(separated))).status).toBe("passed")
    expect(check("B6", resumeWith(job(["Built the index", "Built the cache"]), { ...job(["Built the queue"]), id: 2 })).status).toBe(
      "passed",
    )
  })
})

describe("B7 present tense on what has ended", () => {
  test("flags a present-tense verb on an ended job, with its past tense", () => {
    expect(check("B7", resumeWith(job(["Lead a team of 4", "Teaches a weekly class", "Built the index"], "Dec 2023"))).findings).toEqual([
      expect.objectContaining({ place: bulletAt(0), message: "“Lead” is present tense, but this has ended", suggestion: "Try “Led”." }),
      expect.objectContaining({ place: bulletAt(1), suggestion: "Try “Taught”." }),
    ])
  })

  test("counts a season to its last month: fall runs to December", () => {
    expect(check("B7", resumeWith(job(["Lead a team of 4"], "Fall 2026"))).status).toBe("skipped")
    expect(check("B7", resumeWith(job(["Lead a team of 4"], "Spring 2026"))).messages).toEqual([
      "“Lead” is present tense, but this has ended",
    ])
  })

  test("does not mistake a noun subject for a present-tense action", () => {
    const bullets = [
      "Research findings informed the discharge policy",
      "Support tickets fell after the migration",
      "Marketing reports were adopted by sales",
    ]
    expect(check("B7", resumeWith(job(bullets, "Dec 2023"))).status).toBe("passed")
  })

  test("leaves jobs that haven't ended, verbs the same in both tenses, and projects", () => {
    expect(check("B7", resumeWith(job(["Lead a team of 4"], "Present"))).status).toBe("skipped")
    expect(check("B7", resumeWith(job(["Lead a team of 4"], "2026"))).status).toBe("skipped")
    expect(check("B7", resumeWith(job(["Cut costs by 40%", "Set up CI"], "Dec 2023"))).status).toBe("passed")
    const resume = {
      ...resumeWith(job(["Built the index"], "Dec 2023")),
      projectsSection: [{ ...project(["Scrapes 9,000 listings"]), projectDate: "2021" }],
    }
    expect(check("B7", resume).status).toBe("passed")
  })
})

describe("B8 substantive descriptions", () => {
  test("scores a missing primary description but leaves length advice unscored", () => {
    const seven = ["index", "parser", "cache", "queue", "router", "gateway", "dashboard"].map((word) => `Built the ${word}`)
    const resume = resumeWith(job([]), { ...job(seven), id: 2 }, { ...job(seven.slice(0, 6)), id: 3 })
    expect(check("B8", resume).findings).toEqual([
      expect.objectContaining({ place: { kind: "entry", section: "Work", entry: 0, field: "workDescription" }, message: "No description" }),
      expect.objectContaining({
        place: { kind: "entry", section: "Work", entry: 1, field: "workDescription" },
        message: "7 bullets to review",
        advisory: true,
      }),
    ])
    expect(check("B8", resume).scoring?.credit).toBeCloseTo(2 / 3)
    expect(check("B8", resumeWith(job(seven))).scoring?.credit).toBe(1)
  })

  test("an older additional role can be brief", () => {
    const resume = resumeWith(job(["Built a searchable catalogue for the library", "Trained 12 volunteers on the new catalogue"]), {
      ...job([], "Dec 2020", "Library"),
      id: 2,
    })
    const result = check("B8", resume)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({ message: "No description", advisory: true })
    expect(result.scoring?.credit).toBe(1)
  })

  test("asks the most recent job, and one still going, for two specific bullets", () => {
    const older = { ...job(["Shelved returned books"], "Dec 2020", "Library"), id: 2 }
    const result = check("B8", resumeWith(job(["Built a searchable catalogue for the library"]), older))
    expect(result.findings).toEqual([
      expect.objectContaining({
        place: { kind: "entry", section: "Work", entry: 0, field: "workDescription" },
        message: "Only one specific bullet",
      }),
    ])
    expect(result.findings[0].advisory).toBeUndefined()
    expect(result.scoring).toMatchObject({ failed: true, level: "look", credit: 0.5 })
    // A generic bullet that already counts isn't counted again as a thin job.
    const thin = check("B8", resumeWith(job(["Built various tools", "Built a searchable catalogue for the library"]), older))
    expect(thin.messages).toEqual(["Name the work more specifically"])
    // An academic CV lists roles briefly.
    expect(check("B8", { ...resumeWith(job(["Built a searchable catalogue for the library"])), resumeTag: "academic" }).status).toBe(
      "passed",
    )
  })

  test("does not prescribe a bullet limit for an academic CV", () => {
    const bullets = ["index", "parser", "cache", "queue", "router", "gateway", "dashboard"].map((word) => `Built the ${word}`)
    expect(check("B8", { ...resumeWith(job(bullets)), resumeTag: "academic" }).findings).toEqual([])
  })

  test("numeric filler cannot earn all bullet points", () => {
    const bullets = [
      "Built 2 internal tools for the engineering team, using established methods to implement requested features and complete assigned tasks",
      "Created 3 reports for the business",
      "Managed 4 tasks on various projects",
    ]
    const result = check("B8", resumeWith(job(bullets)))
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({ message: "Name the work more specifically" })
    expect(result.findings[0].advisory).toBeUndefined()
    expect(result.scoring?.credit).toBe(0)
    expect(result.scoring?.failed).toBe(true)
  })

  test("checks generic project, leadership and volunteer descriptions too", () => {
    const result = check("B8", {
      projectsSection: [project(["Built tools for the team"])],
      leadershipExperienceSection: [{ id: 1, leadershipRole: "Chair", leadershipDescription: "• Managed various tasks" }],
      volunteerExperienceSection: [{ id: 1, volunteerRole: "Helper", volunteerDescription: "• Created various reports" }],
    })
    expect(result.findings).toHaveLength(3)
    expect(result.scoring?.credit).toBe(0)
  })

  test("a generic bullet among specific descriptions is coaching, but half of them is a pattern", () => {
    const specific = ["Restored access to patient records during an outage", "Built a searchable catalogue for the library"]
    const one = check("B8", resumeWith(job(["Built various tools", ...specific])))
    expect(one.findings[0].advisory).toBe(true)
    expect(one.scoring?.credit).toBe(1)
    const half = check("B8", resumeWith(job(["Built various tools", "Created various reports", ...specific])))
    expect(half.findings[0].advisory).toBeUndefined()
    expect(half.scoring).toMatchObject({ failed: true, credit: 0 })
  })

  test("does not score quoted product names as generic filler", () => {
    const result = check("B8", resumeWith(job(['Built "Tools" for the team', "Developed “Business”", "Built `tools` for the team"])))
    expect(result.findings).toEqual([])
    expect(result.scoring?.credit).toBe(1)
  })
})

describe("B9 repeated bullets", () => {
  test("lets each copy of a bullet written three times be dismissed on its own", () => {
    const findings = check("B9", resumeWith(job(["Built the index", "Built the index", "Built the index"]))).findings
    expect(findings.map((finding) => finding.place)).toEqual([bulletAt(1), bulletAt(2)])
    expect(findings[0].key).not.toBe(findings[1].key)
  })

  test("flags a long bullet a letter or two from another, but not short ones or different symbols", () => {
    const near = ["Managed customer account records for the sales team", "Managed customer accounts records for the sales team"]
    expect(check("B9", resumeWith(job(near))).findings).toEqual([
      expect.objectContaining({
        place: bulletAt(1),
        message: "Almost the same as another bullet",
        advisory: true,
        suggestion: expect.stringContaining("entry 1, bullet 1"),
      }),
    ])
    expect(check("B9", resumeWith(job(["Built C++ tools", "Built C tools", "Led 5 engineers", "Led 6 engineers"]))).status).toBe("passed")
    expect(check("B9", resumeWith(job(near))).scoring?.credit).toBe(1)
  })

  test("flags a bullet that's the same as one before it, case and punctuation aside", () => {
    const resume = resumeWith(job(["Built the search index."]), { ...job(["Led the team", "built the Search Index"]), id: 2 })
    expect(check("B9", resume).findings).toEqual([expect.objectContaining({ place: bulletAt(1, 1), message: "Same as another bullet" })])
    expect(check("B9", resume).findings[0].advisory).toBeUndefined()
    expect(check("B9", resume).scoring?.credit).toBeLessThan(1)
  })
})
