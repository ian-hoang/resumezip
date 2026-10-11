import { describe, expect, test } from "vitest"
import { samples } from "@/lib/import/testRender"
import type { Resume } from "@/lib/resume"
import { runChecks } from "./engine"
import type { DialectName } from "./dialect"
import { viewOf } from "./resume"
import { RULES } from "./rules"
import { grammarTexts, isTypo, SPELLING_RULES } from "./spelling"
import { oneSlipApart, typedSlip } from "./text"
import { addWord, CHECK_FIELD, readCheckState } from "./state"
import { readingOf } from "./testHarper"

const job = (bullets: string[], { workEndDate = "Present", companyName = "Google", workRole = "Engineer" } = {}) => ({
  id: 1,
  workRole,
  companyName,
  workStartDate: "Jan 2022",
  workEndDate,
  workDescription: bullets.map((bullet) => `• ${bullet}`).join("\n"),
})

const resumeWith = (jobs: ReturnType<typeof job>[], extra: Record<string, unknown> = {}) => ({
  profileSection: { fullName: "Jake Ryan", email: "jake@exmaple.com", linkedin: "linkedin.com/in/jakeryan" },
  workExperienceSection: jobs,
  ...extra,
})

const TODAY = new Date(2026, 9, 7)

/** What one rule says about a resume, with Harper reading its text as the editor has it read. */
async function check(id: string, resume: Resume, { dialect = "american" as DialectName, read = true } = {}) {
  const rule = RULES.find((rule) => rule.id === id)!
  const grammar = read
    ? await readingOf(
        grammarTexts(viewOf(resume)).map(({ text }) => text),
        dialect,
      )
    : undefined
  const report = runChecks(resume, { rules: [rule], grammar, today: TODAY })
  return {
    status: report.results[0].status,
    scoring: report.results[0].scoring,
    messages: report.findings.map((finding) => finding.message),
    findings: report.findings,
  }
}

const bulletAt = (line: number) => ({ kind: "entry", section: "Work", entry: 0, field: "workDescription", line })

describe("G1 typos", () => {
  test("points at each typo, with what to write instead", async () => {
    const result = await check("G1", resumeWith([job(["Recieved the team award", "Built a search index"])]))
    expect(result.findings).toEqual([
      expect.objectContaining({
        place: bulletAt(0),
        text: "Recieved",
        level: "fix",
        message: "“Recieved” may be misspelled",
        suggestion: "Try “Received”. If it's spelled right, add the word.",
      }),
    ])
  })

  test("an unknown word is a suggestion that counts until it's dismissed or added, never a must-fix", async () => {
    const resume = resumeWith([job(["Analyzed electrophysiology recordings", "Developed spintronics devices", "Recieved the team award"])])
    const result = await check("G1", resume)
    for (const text of ["electrophysiology", "spintronics"]) {
      const finding = result.findings.find((finding) => finding.text === text)!
      expect(finding, text).toMatchObject({ level: "look" })
      expect(finding.advisory, text).toBeUndefined()
    }
    expect(result.findings.find((finding) => finding.text === "Recieved")).toEqual(expect.objectContaining({ level: "fix" }))
    const term = result.findings.find((finding) => finding.text === "spintronics")!
    const dismissed = await check("G1", { ...resume, [CHECK_FIELD]: { dismissed: [term.key] } })
    expect(dismissed.findings.some((finding) => finding.text === "spintronics")).toBe(false)

    // On their own, unknown words cost a suggestion's points, without the must-fix cap.
    const terms = resumeWith([job(["Analyzed electrophysiology recordings", "Developed spintronics devices"])])
    expect((await check("G1", terms)).scoring).toMatchObject({ failed: true, level: "look" })
    const keys = (await check("G1", terms)).findings.map((finding) => finding.key)
    expect((await check("G1", { ...terms, [CHECK_FIELD]: { dismissed: keys } })).scoring).toMatchObject({ failed: false, credit: 1 })
  })

  test("offers the dictionary's guess for an unknown word as a question", async () => {
    const [finding] = (await check("G1", resumeWith([job(["Analyzed electrophysiology recordings"])]))).findings
    expect(finding).toMatchObject({
      text: "electrophysiology",
      level: "look",
      message: "The English dictionary doesn't know “electrophysiology”",
    })
    expect(finding.suggestion).toMatch(/^Did you mean “\p{L}+”\? If “electrophysiology” is a name or a specialist term, add the word\.$/u)
  })

  test("a word one typing slip from the dictionary's guess, in lower case, is a must-fix", async () => {
    const result = await check("G1", resumeWith([job(["Maintained internal sofware for the team", "Fixed teh billing export"])]))
    expect(result.findings).toEqual([
      expect.objectContaining({ text: "sofware", level: "fix", suggestion: "Try “software”. If it's spelled right, add the word." }),
      expect.objectContaining({ text: "teh", level: "fix", suggestion: "Try “the”. If it's spelled right, add the word." }),
    ])
  })

  test("at the start of a bullet, a slip is a must-fix only when it was meant to be a verb", async () => {
    const result = await check("G1", resumeWith([job(["Develped the billing service", "Polars pipelines replaced pandas"])]))
    expect(result.findings).toEqual([
      expect.objectContaining({ text: "Develped", level: "fix", suggestion: "Try “Developed”. If it's spelled right, add the word." }),
      expect.objectContaining({ text: "Polars", level: "look" }),
    ])
  })

  test("a nearby dictionary word is not proof a specialist name is misspelled", async () => {
    const result = await check(
      "G1",
      resumeWith([job(["Built an API with Litestar", "Processed data with Polars", "Compiled services with Cython"])]),
    )
    expect(result.findings.filter((finding) => ["Litestar", "Polars"].includes(finding.text))).toHaveLength(2)
    expect(result.findings.every((finding) => finding.level === "look")).toBe(true)
  })

  test("common tool names and compounds aren't taken for typos", async () => {
    const resume = resumeWith([
      job(["Validated inputs with Pydantic and Zod", "Wrote runbooks and backfilled multithreaded jobs", "Tracked work on a Kanban board"]),
    ])
    expect((await check("G1", resume)).status).toBe("passed")
  })

  test("Harper's suggestion to split a word in two is only advice", async () => {
    const result = await check("G1", resumeWith([job(["Built semantic search with pgvector"])]))
    expect(result.findings).toEqual([expect.objectContaining({ text: "pgvector", advisory: true })])
    expect(result.scoring).toMatchObject({ failed: false })
  })

  test("each typo costs more of the rule's credit, wherever it is", async () => {
    const one = await check("G1", resumeWith([job(["Maintained internal sofware", "Built a search index", "Wrote unit tests"])]))
    const three = await check(
      "G1",
      resumeWith([job(["Maintained internal sofware and hardwre", "Built a serch index", "Wrote unit tests"])]),
    )
    expect(one.scoring!.credit).toBeCloseTo(0.8)
    expect(three.scoring!.credit).toBeCloseTo(0.4)
  })

  test("capitalizing an ordinary typo doesn't hide it", async () => {
    const result = await check("G1", resumeWith([job(["RECIEVED the company award", "Wrote SQL queries for the API"])]))
    expect(result.findings).toEqual([expect.objectContaining({ text: "RECIEVED", level: "fix" })])
  })

  test("waits for the grammar checker", async () => {
    expect((await check("G1", resumeWith([job(["Recieved the team award"])]), { read: false })).status).toBe("waiting")
  })

  test("knows the resume's own names, tech words, degrees and verbs", async () => {
    const resume = resumeWith(
      [
        job(["Shipped Woonsocket's new site with DuckDB and eBPF at p99", "Prototyped an autograder in malloc for the nodejs backend"], {
          companyName: "Woonsocket Labs",
        }),
      ],
      {
        educationSection: [
          { id: 1, schoolName: "Questrom School of Business", degree: "B.S.E. in Computer Science", schoolEndDate: "May 2024" },
        ],
      },
    )
    expect((await check("G1", resume)).status).toBe("passed")
  })

  test("knows each part of a dotted name, Latin honors, and the English of every country", async () => {
    const resume = resumeWith(
      [
        job([
          "Built REST APIs with Node.js, Express.js and Nuxt.js",
          "Modelled the centre's colour scheme and travelled to 40 sites",
          "Raised ₹2 crore from 3 lakh donors",
        ]),
      ],
      {
        educationSection: [
          { id: 1, schoolName: "Harvard University", degree: "Ph.D. in Biology, summa cum laude", schoolEndDate: "May 2024" },
        ],
        awardsSection: [{ id: 1, awardName: "Magna Cum Laude", awardDate: "2020" }],
      },
    )
    expect((await check("G1", resume)).status).toBe("passed")
    // In any English the browser reads.
    expect((await check("G1", resume, { dialect: "british" })).status).toBe("passed")
    expect((await check("G1", resumeWith([job(["Optimized the honors program at the center"])]), { dialect: "british" })).status).toBe(
      "passed",
    )
  })

  test("a slip in a tech name is a typo, though it has capitals inside", async () => {
    const result = await check("G1", resumeWith([job(["Wrote services in TypeScirpt and Javascritp"])]))
    expect(result.findings.map((finding) => [finding.text, finding.suggestion])).toEqual([
      ["TypeScirpt", "Try “TypeScript”. If it's spelled right, add the word."],
      ["Javascritp", "Try “JavaScript”. If it's spelled right, add the word."],
    ])
    // Not other names a slip away from one, or short ones like CSV and PhD.
    const others = resumeWith([
      job(["Documented the OpenAPI spec and the MSSQL schema in GraphiQL", "Exported CSV files for the PhD program"]),
    ])
    expect((await check("G1", others)).status).toBe("passed")
  })

  test("finds slips in the skills, but doesn't take the names there for typos", async () => {
    const resume = resumeWith([job(["Moved the Kanban board to Redux and Okta"])], {
      skillsSection: [
        { id: 1, skillName: "Langauges", skillDetails: "Python, Redux, Kanban, Canva, Okta, Mathematica, Benchling, Magento, Tableu" },
        { id: 2, skillName: "Soft Skills", skillDetails: "Comunication, Teamwrok, Marketting, Adaptibility" },
      ],
      projectsSection: [{ id: 1, projectName: "Shelf", techStack: "Zustand, Vitest, Kubernets" }],
    })
    expect((await check("G1", resume)).findings.map((finding) => [finding.text, finding.suggestion])).toEqual([
      ["Langauges", "Try “Languages”. If it's spelled right, add the word."],
      ["Tableu", "Try “Tableau”. If it's spelled right, add the word."],
      ["Comunication", "Try “Communication”. If it's spelled right, add the word."],
      ["Teamwrok", "Try “Teamwork”. If it's spelled right, add the word."],
      ["Marketting", "Try “Marketing”. If it's spelled right, add the word."],
      ["Adaptibility", "Try “Adaptability”. If it's spelled right, add the word."],
      ["Kubernets", "Try “Kubernetes”. If it's spelled right, add the word."],
    ])
  })

  test("finds short skill typos without treating nearby product names as mistakes", async () => {
    const result = await check(
      "G1",
      resumeWith([], {
        skillsSection: [{ id: 1, skillName: "Skills", skillDetails: "Finace, Writng, Excell, Redux, Kanban, Canva, Benchling" }],
      }),
    )
    expect(result.findings.map((finding) => [finding.text, finding.level])).toEqual([
      ["Finace", "fix"],
      ["Writng", "fix"],
      ["Excell", "fix"],
    ])
  })

  test("involvement prose is checked and doesn't whitelist its errors elsewhere", async () => {
    const result = await check(
      "G1",
      resumeWith([job(["Tutored childrn weekly"])], {
        educationSection: [{ id: 1, schoolName: "University", involvement: "Tutored childrn weekly" }],
      }),
    )
    expect(result.findings.filter((finding) => finding.text === "childrn")).toHaveLength(2)
    expect(result.findings.every((finding) => finding.level === "fix")).toBe(true)
  })

  test("a word misspelled in every English is still a typo", async () => {
    expect(
      (await check("G1", resumeWith([job(["Controled the budget", "Identifys and simplifys workflows"])]))).findings.map(
        (finding) => finding.text,
      ),
    ).toEqual(["Controled", "Identifys", "simplifys"])
  })

  test("doesn't check names, links and emails", async () => {
    const resume = resumeWith([job(["Built a search index"], { companyName: "Gogle" })])
    expect((await check("G1", resume)).status).toBe("passed")
  })

  test("a word added with Add word isn't flagged anywhere on the resume", async () => {
    const resume = resumeWith([job(["Built Flurbo's cache", "Moved Flurbo to Go"]), job(["Ran flurbo tests"])])
    expect((await check("G1", resume)).findings.map((finding) => finding.text)).toEqual(["Flurbo's", "Flurbo", "flurbo"])
    const added = { ...resume, [CHECK_FIELD]: addWord(readCheckState({}), "Flurbo") }
    expect((await check("G1", added)).status).toBe("passed")
  })

  test("names with capitals inside, words with digits, initials and dotted abbreviations aren't typos", () => {
    const known = new Set<string>()
    expect(["DuckDB", "XGBoost", "iOS", "SQL", "p99", "D.", "e.g.", "B.Sc"].filter((word) => isTypo(word, known))).toEqual([])
    expect(isTypo("recieved", known)).toBe(true)
    expect(isTypo("Flurbo's", new Set(["flurbo"]))).toBe(false)
  })

  test("while some text hasn't been checked, it says it hasn't looked at everything", () => {
    const resume = resumeWith([job(["Recieved the team award", "Built a search index"])])
    const grammar = new Map([
      [
        "Recieved the team award",
        [{ rule: "SpellCheck", kind: "Spelling", text: "Recieved", start: 0, message: "", suggestions: ["Received"] }],
      ],
    ])
    const report = runChecks(resume, { rules: SPELLING_RULES.filter((rule) => rule.id === "G1"), grammar, today: TODAY })
    expect(report.results[0]).toEqual(expect.objectContaining({ status: "failed", checked: 1, partial: true }))
  })
})

describe("G2–G4", () => {
  test("G2 finds a word written twice, but not a name or a word that can be", async () => {
    expect((await check("G2", resumeWith([job(["Built the the search index"])]))).messages).toEqual(["“the” twice in a row"])
    expect((await check("G2", resumeWith([job(["Opened the Walla Walla branch", "Doubled what it had had in sales"])]))).status).toBe(
      "passed",
    )
  })

  test("G2 finds repeated acronyms without mistaking them for proper names", async () => {
    expect((await check("G2", resumeWith([job(["Wrote SQL SQL queries"])]))).messages).toEqual(["“SQL” twice in a row"])
    expect((await check("G2", resumeWith([job(["Opened the BORA BORA branch", "Opened the WALLA WALLA branch"])]))).status).toBe("passed")
  })

  test("G3 finds the wrong “a” or “an”", async () => {
    expect(
      (await check("G3", resumeWith([job(["Built a HTTP server", "Hired an university student", "😀😀 Shipped a app"])]))).messages,
    ).toEqual(["“a HTTP” should be “an HTTP”", "“an university” should be “a university”", "“a app” should be “an app”"])
  })

  test("G3 leaves “an” before an acronym said letter by letter", async () => {
    expect((await check("G3", resumeWith([job(["Ran an SEO audit", "Wrote an FAQ page"])]))).status).toBe("passed")
  })

  test("G3 distinguishes spoken acronyms and permits variable pronunciations", async () => {
    expect((await check("G3", resumeWith([job(["Built an NASA mission simulator"])]))).messages).toEqual(["“an NASA” should be “a NASA”"])
    expect(
      (
        await check(
          "G3",
          resumeWith([
            job(["Built a NASA mission simulator", "Wrote a SQL query", "Built an SQL database", "Wrote a FAQ page", "Wrote an FAQ page"]),
          ]),
        )
      ).status,
    ).toBe("passed")
  })

  test("G4 finds mixed-up words, and “loose” for “lose”", async () => {
    const resume = resumeWith([job(["Made the build faster then before", "Wrote it's docs", "Backed up data so users never loose work"])])
    expect((await check("G4", resume)).messages).toEqual([
      "“then” should be “than” here",
      "“it's” should be “its” here",
      "“loose” should be “lose” here",
    ])
    // Once, when Harper finds it too.
    expect((await check("G4", resumeWith([job(["Tried not to loose the data"])]))).messages).toEqual([
      "“to loose” should be “to lose” here",
    ])
  })

  test("G4 preserves the valid verb loose", async () => {
    expect(
      (
        await check(
          "G4",
          resumeWith([
            job(["Trained archers who can loose arrows safely", "Taught archers to loose arrows safely", "Worked to loose the restraints"]),
          ]),
        )
      ).status,
    ).toBe("passed")
  })

  test("well-written bullets pass", async () => {
    const resume = resumeWith([
      job(["Built a search index that cut query time by 40%", "Led a team of 4 engineers", "Wrote an API used by 30 partners"]),
    ])
    for (const id of ["G1", "G2", "G3", "G4", "G7"]) expect((await check(id, resume)).status, id).toBe("passed")
  })
})

describe("G5 lead for led", () => {
  test("finds “lead” joined to what was done", async () => {
    const bullets = [
      "Designed and lead the migration to Postgres",
      "Planned, lead and shipped the launch",
      "Hired and lead 4 engineers",
      "Managed budgets and lead quarterly reviews",
    ]
    const result = await check("G5", resumeWith([job(bullets, { workEndDate: "Dec 2024" })]))
    expect(result.messages).toEqual(Array(4).fill("“lead” should be “led” here"))
    expect(result.findings[0].place).toEqual(bulletAt(0))
  })

  test("in a job still going, only in bullets about the past", async () => {
    expect((await check("G5", resumeWith([job(["Designed and lead the migration"])]))).status).toBe("failed")
    expect((await check("G5", resumeWith([job(["Design and lead code reviews"])]))).status).toBe("skipped")
  })

  test("not “lead” as the metal or a sales lead", async () => {
    const bullets = [
      "Built dashboards and lead generation tools",
      "Tested soil samples for arsenic and lead",
      "Measured mercury, lead, and cadmium",
      "Improved conversion and lead quality",
      "Tested soil for mercury and lead over three years",
    ]
    expect((await check("G5", resumeWith([job(bullets, { workEndDate: "2023" })]))).status).toBe("passed")
  })

  test("an ongoing role may describe both a finished project and present duties", async () => {
    expect(
      (
        await check(
          "G5",
          resumeWith([job(["Built the platform last year and lead the team today", "Designed the service and lead its development now"])]),
        )
      ).status,
    ).toBe("passed")
  })

  test("quoted and introduced instructions don't inherit the job's past tense", async () => {
    expect(
      (
        await check(
          "G5",
          resumeWith([
            job(
              [
                'Wrote instructions: "Design and lead the project"',
                "Wrote instructions: Design and lead the project",
                "Taught the course ‘Design and lead the project’",
              ],
              { workEndDate: "2024" },
            ),
          ]),
        )
      ).status,
    ).toBe("passed")
  })
})

describe("G6 tech names", () => {
  test("finds tech names written another way, in any field", async () => {
    const resume = resumeWith([job(["Built the site in Javascript and nodejs", "Kept the code on github"])], {
      skillsSection: [{ id: 1, skillName: "Languages", skillDetails: "python, SQL, Typescript" }],
    })
    expect((await check("G6", resume)).messages).toEqual([
      "“Javascript” is written “JavaScript”",
      "“nodejs” is written “Node.js”",
      "“github” is written “GitHub”",
      "“python” is written “Python”",
      "“Typescript” is written “TypeScript”",
    ])
  })

  test("leaves links and handles alone", async () => {
    const resume = resumeWith([job(["Open-sourced it at github.com/jake/cache", "Posted updates as @github"])], {
      profileSection: { fullName: "Jake Ryan", profileGithub: "github.com/jake" },
    })
    expect((await check("G6", resume)).status).toBe("passed")
  })

  test("G6 branding suggestions are unscored and avoid ordinary meanings and names", async () => {
    const result = await check(
      "G6",
      resumeWith(
        [
          job(["Built a java coffee sales dashboard", "Studied python habitats", "Kept the code on github"], {
            companyName: "java coffee",
          }),
        ],
        {
          skillsSection: [{ id: 1, skillName: "Languages", skillDetails: "java, python" }],
        },
      ),
    )
    expect(result.findings.map((finding) => finding.text)).toEqual(["github", "java", "python"])
    expect(result.findings.every((finding) => finding.advisory)).toBe(true)
    expect(result.findings.every((finding) => !finding.why.includes("don't use"))).toBe(true)
  })

  test("G6 preserves command and quoted literals without swallowing possessives", async () => {
    const result = await check(
      "G6",
      resumeWith([
        job([
          "Ran `docker` builds",
          'Documented the "docker" command',
          "Documented the 'docker' command",
          "Updated the client's github repository and the team's github guide",
        ]),
      ]),
    )
    expect(result.findings.map((finding) => finding.text)).toEqual(["github", "github"])
  })
})

test("G7 finds other grammar mistakes, as suggestions", async () => {
  const result = await check("G7", resumeWith([job(["Could of shipped it faster"])]))
  expect(result.findings).toEqual([expect.objectContaining({ level: "look", text: "Could of", suggestion: "Try “Could have”." })])
})

test("other-language resumes skip all English rules without waiting for Harper", () => {
  const resume = resumeWith([job(["Développé une application pour les utilisateurs", "Could of used Javascript"])], {
    [CHECK_FIELD]: { grammarLanguage: "other" },
  })
  expect(grammarTexts(viewOf(resume))).toEqual([])
  const report = runChecks(resume, { rules: SPELLING_RULES, today: TODAY })
  expect(report.results.every((result) => result.status === "skipped")).toBe(true)
  expect(report.findings).toEqual([])
})

test("few false typos on the template samples", async () => {
  const fixes: string[] = []
  for (const resume of samples) {
    const grammar = await readingOf(grammarTexts(viewOf(resume)).map(({ text }) => text))
    const report = runChecks(resume, { rules: SPELLING_RULES, grammar, today: TODAY })
    fixes.push(...report.findings.filter((finding) => finding.level === "fix").map((finding) => finding.text))
  }
  expect(fixes).toEqual([])
})

test("a slip in typing a word leaves a letter out from inside it, swaps two, doubles one, or changes a vowel", () => {
  const slips = [
    ["Comunication", "Communication"],
    ["Teamwrok", "Teamwork"],
    ["Marketting", "Marketing"],
    ["Adaptibility", "Adaptability"],
    ["Programing", "Programming"],
  ]
  expect(slips.filter(([typed, right]) => !typedSlip(typed, right))).toEqual([])
  // Not how names are made from words, nor a word with an apostrophe.
  const names = [
    ["Canva", "Canvas"],
    ["Mathematica", "Mathematical"],
    ["Benchling", "Benching"],
    ["Kanban", "Kansan"],
    ["Postgress", "Postgres's"],
  ]
  expect(names.filter(([typed, right]) => typedSlip(typed, right))).toEqual([])
})

test("two words are one slip apart when a letter is added, dropped, changed or swapped with its neighbour", () => {
  expect(
    [
      ["typescirpt", "typescript"],
      ["tableu", "tableau"],
      ["kubernets", "kubernetes"],
      ["pythn", "python"],
      ["jaba", "java"],
    ].every(([a, b]) => oneSlipApart(a, b)),
  ).toBe(true)
  expect(
    [
      ["python", "python"],
      ["typescript", "javascript"],
      ["ab", "abcd"],
      ["abcd", "badc"],
    ].some(([a, b]) => oneSlipApart(a, b)),
  ).toBe(false)
})
