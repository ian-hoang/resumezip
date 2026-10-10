import { describe, expect, test } from "vitest"
import { linesFromPages, type Line } from "./lines"
import { MUCH_UNPLACED, parseResume, toResumeContent, unplacedShare } from "./parse"

/**
 * A line of a PDF from its parts, as [text, x] pairs: text set apart on the
 * line, like dates on the right. A bullet's text starts 10 points after it.
 */
function line(parts: [string, number][], { bullet = false, bold = false, italic = false, size = 10, page = 1 } = {}): Line {
  const x = parts[0][1]
  return {
    parts: parts.map(([text, at]) => ({ text, x: at, runs: [{ start: 0, end: text.length, bold, italic }] })),
    text: parts.map(([text]) => text).join(" "),
    bullet,
    left: bullet ? x - 10 : x,
    x,
    size,
    bold,
    italic,
    links: [],
    page,
  }
}

/**
 * Lines laid out down a page, each 12 points below the last, with its right
 * edge where its text would end at 5 points a letter, so the reader can tell
 * which lines ran out of room.
 */
const onPage = (lines: Line[]): Line[] =>
  lines.map((line, i) => {
    const end = line.parts[line.parts.length - 1]
    return { ...line, box: [line.left, 100 + 12 * i, end.x + end.text.length * 5, 110 + 12 * i] }
  })

/** A resume of `lines` under a name and a heading. */
const read = (heading: string, lines: Line[]) => {
  const parsed = parseResume([line([["Mara Lin", 36]], { size: 18, bold: true }), line([[heading, 36]], { size: 12, bold: true }), ...lines])
  return { parsed, resume: toResumeContent(parsed), unplaced: parsed.unplaced.flatMap((group) => group.text) }
}

describe("dates", () => {
  test("a month written as a number is a date", () => {
    const { resume } = read("Experience", [line([["Data Analyst", 36], ["06/2022 – 1/2024", 480]], { bold: true }), line([["Acme Corp", 36]], { italic: true })])
    expect(resume.workExperienceSection[0]).toMatchObject({ workStartDate: "06/2022", workEndDate: "1/2024" })
  })

  test("a split like 80/20 on a bullet's second line stays in the bullet", () => {
    const { resume } = read("Experience", [
      line([["Data Analyst", 36], ["Jun 2022 – Present", 480]], { bold: true }),
      line([["Acme Corp", 36]], { italic: true }),
      line([["Trained a fraud model on a year of card payments with a", 54]], { bullet: true }),
      line([["70/30 split between training and testing data", 54]]),
      line([["Cut false alarms by a third", 54]], { bullet: true }),
    ])
    expect(resume.workExperienceSection).toHaveLength(1)
    expect(resume.workExperienceSection[0].workDescription).toBe(
      "• Trained a fraud model on a year of card payments with a 70/30 split between training and testing data\n• Cut false alarms by a third",
    )
  })
})

describe("nothing on an entry's title line is thrown away", () => {
  test("a second date goes to Couldn't place", () => {
    const { resume, unplaced } = read("Experience", [
      line([["Teaching Assistant", 36], ["Fall 2023", 400], ["Spring 2025", 480]], { bold: true }),
      line([["State University", 36]], { italic: true }),
    ])
    expect(resume.workExperienceSection[0]).toMatchObject({ workRole: "Teaching Assistant", workEndDate: "Fall 2023" })
    expect(unplaced).toEqual(["Spring 2025"])
  })

  test("so do an award's other dates", () => {
    const { resume, unplaced } = read("Awards", [line([["Dean’s List, Fall 2023, Spring 2024", 36]])])
    expect(resume.awardsSection[0]).toMatchObject({ awardName: "Dean’s List", awardDate: "Fall 2023" })
    expect(unplaced).toEqual(["Spring 2024"])
  })
})

describe("an entry's date", () => {
  test("is the one alone on the right, not a year in the title, which stays in it", () => {
    const { resume, unplaced } = read("Projects", [
      line([["Sprout – HackGT 2026 | React, Flask", 36], ["September 2026", 480]], { bold: true }),
      line([["Built a garden planner", 54]], { bullet: true }),
    ])
    expect(resume.projectsSection[0].projectDate).toBe("September 2026")
    expect(Object.values(resume.projectsSection[0]).join(" ")).toContain("HackGT 2026")
    expect(unplaced).toEqual([])
  })

  test("is a year in the title when there's no other", () => {
    const { resume } = read("Awards", [line([["First Place, HackGT 2026", 36]])])
    expect(resume.awardsSection[0].awardDate).toBe("2026")
  })
})

describe("a detail line that wraps", () => {
  const school = [
    line([["State University", 36], ["Aug 2022 – May 2026", 480]], { bold: true }),
    line([["B.S. in Biology", 36], ["Austin, TX", 500]], { italic: true }),
  ]

  test("carries on at its own left edge when it was cut off mid-list", () => {
    const { resume } = read("Education", [
      ...school,
      line([["Relevant Coursework: Genetics, Organic Chemistry (CHEM 2310), Statistics (STA 2023),", 36]]),
      line([["Cell Biology (BIO 2020), Ecology", 36]]),
    ])
    expect(resume.educationSection).toHaveLength(1)
    expect(resume.educationSection[0].coursework).toBe("Genetics, Organic Chemistry (CHEM 2310), Statistics (STA 2023), Cell Biology (BIO 2020), Ecology")
  })

  test("doesn't take in the next school", () => {
    const { resume } = read("Education", [
      ...school,
      line([["Relevant Coursework: Genetics, Ecology,", 36]]),
      line([["Austin Community College", 36], ["Aug 2020 – May 2022", 480]], { bold: true }),
    ])
    expect(resume.educationSection.map((entry) => entry.schoolName)).toEqual(["State University", "Austin Community College"])
  })
})

describe("a year on a line that wrapped", () => {
  test("stays in the bullet it carries on", () => {
    const { resume } = read(
      "Leadership",
      onPage([
        line([["Software Lead", 36], ["Sep 2026 – Present", 480]], { bold: true }),
        line([["GT Solar Racing", 36]], { italic: true }),
        line([["Lead software for the team’s solar car, building battery telemetry and a live dashboard in React for the", 54]], { bullet: true }),
        line([["2027 American Solar Challenge.", 54]]),
        line([["Mentor 5 new members", 54]], { bullet: true }),
      ]),
    )
    expect(resume.leadershipExperienceSection).toHaveLength(1)
    expect(resume.leadershipExperienceSection[0].leadershipDescription).toBe(
      "• Lead software for the team’s solar car, building battery telemetry and a live dashboard in React for the 2027 American Solar Challenge.\n• Mentor 5 new members",
    )
  })

  test("stays in the paragraph it carries on", () => {
    const { resume } = read(
      "Experience",
      onPage([
        line([["2026", 36], ["Study Abroad Instructional Staff", 120], ["Kyoto, Japan", 480]], { bold: true }),
        line([["Supported a 12-week engineering study abroad program in Kyoto for students during Summer", 120]]),
        line([["2026, combining language study with design and computing courses.", 120]]),
      ]),
    )
    expect(resume.workExperienceSection).toHaveLength(1)
    expect(resume.workExperienceSection[0].workDescription).toContain("during Summer 2026, combining")
  })

  test("doesn't take in the next entry's title, with its date set apart", () => {
    const { resume } = read(
      "Experience",
      onPage([
        line([["Google", 36]], { bold: true }),
        line([["Senior Engineer", 54], ["Jan 2021 – Present", 480]], { italic: true }),
        line([["Led the move of the ads ranking service to a new storage layer, cutting its p99 latency in half", 64]], { bullet: true }),
        line([["Engineer", 54], ["Jun 2018 – Dec 2020", 480]], { italic: true }),
      ]),
    )
    expect(resume.workExperienceSection.map((job) => job.workStartDate)).toEqual(["Jan 2021", "Jun 2018"])
  })

  test("doesn't take in a title with its date in it, after a line with room left", () => {
    const { resume } = read(
      "Experience",
      onPage([
        line([["Software Engineer, Acme Corp, 2019 – 2021", 36]], { bold: true }),
        line([["Built the billing service", 36]]),
        line([["Data Analyst, Beta Inc, 2017 – 2019", 36]], { bold: true }),
      ]),
    )
    expect(resume.workExperienceSection.map((job) => job.workStartDate)).toEqual(["2019", "2017"])
  })
})

describe("publications", () => {
  test("numbered citations that wrap under a hanging indent are read one by one", () => {
    const { resume } = read("Publications", [
      line([["[1] W. Zhang and M. Torres, “Sparse Experts for Retrieval,” International", 44]]),
      line([["Conference on Learning Representations (ICLR), 2026.", 61]]),
      line([["[2] J. Kim and W. Zhang, “Benchmarking Long Documents,” Proc. Annual Meeting", 44]]),
      line([["of the Association for Computational Linguistics (ACL), Vienna, Austria,", 61]]),
      line([["pp. 410–422, Jul 2025.", 61]]),
    ])
    expect(resume.publicationsSection.map((paper) => [paper.publicationTitle, paper.publicationDate])).toEqual([
      ["Sparse Experts for Retrieval", "2026"],
      ["Benchmarking Long Documents", "Jul 2025"],
    ])
  })
})

describe("a single citation", () => {
  test("that wraps onto two more lines is read as one", () => {
    const { resume } = read(
      "Publications",
      onPage([
        line([["[1] R. Mehta, S. Okoro, and L. Zhang, “Fast depth completion for small robots", 44]]),
        line([["with sparse lidar,” IEEE International Conference on Robotics and Automation,", 61]]),
        line([["Atlanta, GA, May 2025, doi: 10.5555/icra.2025.1187.", 61]]),
      ]),
    )
    expect(resume.publicationsSection).toMatchObject([
      { publicationTitle: "Fast depth completion for small robots with sparse lidar", publicationDate: "May 2025" },
    ])
  })

  test("doesn't take in an entry laid out on lines of its own after it", () => {
    const { resume } = read(
      "Publications",
      onPage([
        line([["M. Lin and J. Park, “Robot hands that learn,” IROS, 2024.", 54]], { bullet: true }),
        line(
          [
            ["Sparse lidar for small robots", 66],
            ["May 2025", 480],
          ],
          { bold: true },
        ),
        line([["M. Lin, S. Okoro and L. Zhang", 66]]),
        line([["IEEE International Conference on Robotics and Automation", 66]]),
      ]),
    )
    expect(resume.publicationsSection).toHaveLength(2)
    expect(resume.publicationsSection[1]).toMatchObject({
      publicationTitle: "Sparse lidar for small robots",
      publicationAuthors: "M. Lin, S. Okoro and L. Zhang",
      publicationVenue: "IEEE International Conference on Robotics and Automation",
      publicationDate: "May 2025",
    })
  })
})

describe("headings in a margin column", () => {
  const text = (value: string, x: number, baseline: number, { size = 10, bold = false, italic = false } = {}) => ({
    text: value,
    x,
    right: x + value.length * size * 0.5,
    baseline,
    size,
    bold,
    italic,
  })
  // Each heading ends where the text beside it starts, and one too long for
  // the margin wraps onto the next line, a little higher than the text there.
  const heading = (value: string, baseline: number) => text(value, 110 - value.length * 4, baseline, { size: 8 })
  const page = {
    width: 612,
    height: 792,
    links: [],
    items: [
      text("Dana Cole", 125, 740, { size: 22 }),
      text("dana@example.com", 125, 722, { size: 9 }),
      heading("EXPERIENCE", 690),
      text("Acme Corp", 125, 690, { bold: true }),
      text("2021 – Present", 500, 690),
      text("Data Analyst", 125, 678, { italic: true }),
      text("– Built the weekly sales report used by 40 managers", 125, 666),
      heading("SKILLS", 640),
      text("Languages: Python, SQL", 125, 640),
      heading("AWARDS &", 610),
      text("Dean's List, State University", 125, 610),
      text("2019", 540, 610),
      heading("CERTIFICATIONS", 600.5),
      text("Tableau Desktop Specialist, Tableau", 125, 598),
      text("2022", 540, 598),
    ],
  }

  test("set against the text, and wrapped onto two lines, still start their sections", () => {
    const parsed = parseResume(linesFromPages([page]))
    const resume = toResumeContent(parsed)
    expect(parsed.unplaced).toEqual([])
    expect(resume.workExperienceSection).toMatchObject([
      { companyName: "Acme Corp", workRole: "Data Analyst", workDescription: "• Built the weekly sales report used by 40 managers" },
    ])
    expect(resume.skillsSection).toMatchObject([{ skillName: "Languages", skillDetails: "Python, SQL" }])
    expect(resume.awardsSection).toMatchObject([
      { awardName: "Dean's List", awardOrg: "State University", awardDate: "2019" },
      { awardName: "Tableau Desktop Specialist", awardOrg: "Tableau", awardDate: "2022" },
    ])
  })
})

describe("a heading it doesn't know by name", () => {
  const heading = (text: string) => line([[text, 36]], { size: 12, bold: true })
  const school = [line([["State University", 36], ["2016 – 2020", 480]], { bold: true }), line([["Bachelor of Science in Nursing", 36]], { italic: true })]

  test("is known by a word that says what it holds, when it looks like the others", () => {
    const { resume } = read("Education", [
      ...school,
      heading("Clinical Experience"),
      line([["Registered Nurse", 36], ["2020 – Present", 480]], { bold: true }),
      line([["St. David’s Medical Center", 36]], { italic: true }),
      line([["Cared for 5 patients a shift", 54]], { bullet: true }),
      heading("Honors & Certifications"),
      line([["Certified Emergency Nurse, BCEN", 36], ["2025", 480]]),
    ])
    expect(resume.workExperienceSection).toMatchObject([{ workRole: "Registered Nurse", companyName: "St. David’s Medical Center" }])
    expect(resume.awardsSection).toMatchObject([{ awardName: "Certified Emergency Nurse", awardOrg: "BCEN", awardDate: "2025" }])
  })

  test("about interests keeps its words as the skill's name", () => {
    const { resume } = read("Education", [...school, heading("Research Interests"), line([["Mobile Robotics, Embedded Systems", 36]])])
    expect(resume.skillsSection).toMatchObject([{ skillName: "Research Interests", skillDetails: "Mobile Robotics, Embedded Systems" }])
  })

  test("about interests is about interests, even with a word about work in it", () => {
    const { resume } = read("Education", [...school, heading("Career Interests"), line([["Healthcare Consulting, Product Management", 36]])])
    expect(resume.skillsSection).toMatchObject([{ skillName: "Career Interests", skillDetails: "Healthcare Consulting, Product Management" }])
    expect(resume.workExperienceSection).toEqual([])
  })

  test("isn't a line that only shares a word with one", () => {
    const { resume } = read("Projects", [
      line([["Volunteer Matching App", 36]], { bold: true }),
      line([["Matched 300 volunteers with shifts at local food banks", 54]], { bullet: true }),
    ])
    expect(resume.projectsSection).toMatchObject([{ projectName: "Volunteer Matching App" }])
    expect(resume.volunteerExperienceSection).toEqual([])
  })
})

describe("page numbers", () => {
  test("aren't part of the resume", () => {
    const { resume, unplaced } = read("Skills", [
      line([["Languages: Python, Go, SQL", 36]]),
      line([["Tools: Docker, Kubernetes,", 36]]),
      line([["1", 300]]),
      line([["Terraform", 36]], { page: 2 }),
      line([["Page 2 of 2", 300]], { page: 2 }),
    ])
    expect(resume.skillsSection.map((skill) => skill.skillDetails)).toEqual(["Python, Go, SQL", "Docker, Kubernetes, Terraform"])
    expect(unplaced).toEqual([])
  })

  test("are only the page's own number, at its top or bottom", () => {
    const { resume, unplaced } = read("Awards", [line([["Dean’s List", 36], ["2024", 480]]), line([["7", 300]])])
    expect(JSON.stringify([resume.awardsSection, unplaced])).toContain("7")
  })
})

describe("contact links", () => {
  const text = (value: string, x: number, baseline: number, size = 10, bold = false) => ({ text: value, x, right: x + value.length * size * 0.5, baseline, size, bold, italic: false })
  const icon = (url: string, x: number) => ({ url, x0: x, y0: 688, x1: x + 8, y1: 696 })
  const page = {
    width: 612,
    height: 792,
    items: [
      text("Marcus Ferreira", 68, 740, 20, true),
      text("marcus@example.com", 450, 715),
      text("(765) 555-0142", 470, 703),
      text("Experience", 68, 660, 12, true),
      text("Lab Manager", 68, 640, 10, true),
    ],
    links: [
      { url: "mailto:marcus@example.com", x0: 450, y0: 712, x1: 540, y1: 724 },
      { url: "tel:+17655550142", x0: 470, y0: 700, x1: 540, y1: 712 },
      // Icons on a row of their own, with no text on it.
      icon("https://linkedin.com/in/marcus-ferreira", 500),
      icon("https://marcusferreira.dev", 512),
      icon("https://github.com/mferreira", 524),
      // A link nowhere near any text.
      { url: "https://example.com/far-away", x0: 300, y0: 400, x1: 320, y1: 410 },
    ],
  }

  test("behind icons, with no text, still count, and a phone's link isn't a website", () => {
    const { profile } = parseResume(linesFromPages([page]))
    expect(profile).toMatchObject({
      phoneNumber: "(765) 555-0142",
      linkedin: "linkedin.com/in/marcus-ferreira",
      profileGithub: "github.com/mferreira",
      personalWebsite: "marcusferreira.dev",
    })
  })
})

describe("a word broken across two lines", () => {
  test("by a soft hyphen joins back up without it", () => {
    const { resume } = read("Experience", [
      line([["Lab Manager", 36], ["2024 – Present", 480]], { bold: true }),
      line([["Purdue University", 36]], { italic: true }),
      line([["Run safety training and incident response; coor\u00AD", 54]], { bullet: true }),
      line([["dinate approvals with motion-", 54]]),
      line([["capture vendors", 54]]),
    ])
    expect(resume.workExperienceSection[0].workDescription).toBe("• Run safety training and incident response; coordinate approvals with motion-capture vendors")
  })

  test("joins back up in a list of skills too", () => {
    const { resume } = read("Skills", [line([["Software: Python, C++, MAT\u00AD", 36]]), line([["LAB, SQL", 36]])])
    expect(resume.skillsSection).toMatchObject([{ skillName: "Software", skillDetails: "Python, C++, MATLAB, SQL" }])
  })
})

describe("a paragraph", () => {
  /** Lines down a page, each with the right edge given: 560 for one that runs to its column's edge. */
  const edges = (lines: [Line, number][]): Line[] => lines.map(([each, right], i) => ({ ...each, box: [each.left, 100 + 12 * i, right, 110 + 12 * i] }))
  const title = line([["2026", 36], ["Study Abroad Instructional Staff", 120], ["Sendai, Japan", 480]], { bold: true })

  test("in justified text carries on through every line that runs to the edge", () => {
    const { resume } = read(
      "Experience",
      edges([
        [title, 560],
        [line([["Supported a study abroad program to Sendai for students during Summer", 120]]), 560],
        [line([["2026, combining language study with robotics and design courses for", 120]]), 560],
        [line([["40 students. Guided team projects between Purdue and Tohoku students.", 120]]), 560],
        [line([["Coordinated field trips and cultural activities in the final week.", 120]]), 420],
      ]),
    )
    expect(resume.workExperienceSection).toHaveLength(1)
    expect(resume.workExperienceSection[0]).toMatchObject({
      workRole: "Study Abroad Instructional Staff",
      workDescription:
        "• Supported a study abroad program to Sendai for students during Summer 2026, combining language study with robotics and design courses for 40 students. Guided team projects between Purdue and Tohoku students. Coordinated field trips and cultural activities in the final week.",
    })
  })

  test("doesn't take in the points after it in text that isn't justified", () => {
    const points = [
      "Built dashboards that the sales team checks every single morning before standup.",
      "Cut the weekly report from two days to two hours.",
      "Trained four analysts on SQL and Looker.",
    ]
    const { resume } = read(
      "Experience",
      edges([
        [line([["Data Analyst", 36], ["2022 – Present", 480]], { bold: true }), 560],
        [line([[points[0], 36]]), 560],
        [line([[points[1], 36]]), 380],
        [line([[points[2], 36]]), 300],
      ]),
    )
    expect(resume.workExperienceSection[0].workDescription).toBe(points.map((point) => `• ${point}`).join("\n"))
  })
})

describe("citations under sub-headings", () => {
  test("are read as citations, with the sub-headings set aside", () => {
    const label = (text: string, x: number) => line([[text, x]], { bold: true, italic: true })
    const { resume, unplaced } = read("Publications", [
      label("Conference", 89),
      line([["[1] W. Zhang and M. Torres, “Sparse Experts for Retrieval,” International", 127]]),
      line([["Conference on Learning Representations (ICLR), 2026.", 147]]),
      label("Thesis", 111),
      line([["[2] W. Zhang, “Reading Long Documents,” Ph.D. thesis, University of", 127]]),
      line([["Michigan, Ann Arbor, MI, USA, 2027.", 147]]),
    ])
    expect(resume.publicationsSection.map((paper) => [paper.publicationTitle, paper.publicationDate])).toEqual([
      ["Sparse Experts for Retrieval", "2026"],
      ["Reading Long Documents", "2027"],
    ])
    expect(unplaced).toEqual(["Conference", "Thesis"])
  })
})

describe("a link that wrapped after a slash", () => {
  test("joins back up without a space", () => {
    const { resume } = read("Publications", [
      line([["[1] W. Zhang, “Sparse Experts for Retrieval,” ICLR, Vienna, 2026, doi: 10.13031/", 127]]),
      line([["aim.202600531.", 147]]),
      line([["[2] W. Zhang, “Reading Long Documents,” Ph.D. thesis, 2027.", 127]]),
    ])
    expect(resume.publicationsSection[0].publicationLink).toBe("doi.org/10.13031/aim.202600531")
  })
})

describe("a line about an award", () => {
  test("goes to Couldn't place, with the line it wraps onto, not into the award's name", () => {
    const { resume, unplaced } = read("Awards", [
      line([["2026", 36], ["Rising Leader Award, Purdue Student Life Awards", 120]]),
      line([["Awarded to BoilerHacks XI while serving as Vice-President and Staff Advisor.", 120]]),
      line([["2022", 36], ["1st Place Overall, BoilerMake", 120]]),
      line([["Designed and built Balancer, a self-balancing robot with obstacle detection, in", 120]]),
      line([["under 36 hours at the Midwest’s largest hackathon.", 120]]),
    ])
    expect(resume.awardsSection).toMatchObject([
      { awardName: "Rising Leader Award", awardOrg: "Purdue Student Life Awards", awardDate: "2026" },
      { awardName: "1st Place Overall", awardOrg: "BoilerMake", awardDate: "2022" },
    ])
    expect(unplaced).toEqual([
      "Awarded to BoilerHacks XI while serving as Vice-President and Staff Advisor.",
      "Designed and built Balancer, a self-balancing robot with obstacle detection, in under 36 hours at the Midwest’s largest hackathon.",
    ])
  })

  test("isn't the rest of a name that wrapped", () => {
    const { resume } = read("Awards", [line([["Certified Emergency Nurse", 36], ["Mar 2025", 480]]), line([["(CEN)", 46]])])
    expect(resume.awardsSection).toMatchObject([{ awardName: "Certified Emergency Nurse (CEN)", awardDate: "Mar 2025" }])
  })
})

describe("a dated line under a title", () => {
  test("isn't text the title ran out of room for, when the title's place is set at the right edge", () => {
    const { resume } = read(
      "Education",
      onPage([
        line([["Purdue University", 36], ["West Lafayette, IN", 460]], { bold: true }),
        line([["M.S. in Mechanical Engineering, May 2027", 54]]),
        line([["Mentor: Prof. Ana Lucia Reyes", 54]]),
      ]),
    )
    expect(resume.educationSection[0]).toMatchObject({ schoolName: "Purdue University", degree: "M.S. in Mechanical Engineering", schoolEndDate: "May 2027" })
  })
})

describe("degrees under one school", () => {
  test("each keep the school, with advisors and theses set aside as details", () => {
    const { resume } = read("Education", [
      line([["Purdue University", 36], ["West Lafayette, IN", 460]], { bold: true }),
      line([["M.S. in Mechanical Engineering, May 2027", 54]]),
      line([["Mentor: Prof. Ana Lucia Reyes", 54]]),
      line([["B.S. (Honors) in Mechanical Engineering, December 2025", 54]]),
      line([["Thesis: Teaching Robot Kinematics with Physical Models", 54]]),
      line([["Advisor: Prof. Ana Lucia Reyes", 54]]),
      line([["B.A. in Economics, May 2021", 54]]),
      line([["Advisor: Prof. Wen Li", 54]]),
      line([["Tohoku University", 36], ["Sendai, Japan", 480]], { bold: true }),
      line([["Study Abroad, Robotics & Society, Summer 2025", 54]]),
    ])
    expect(resume.educationSection.map(({ schoolName, schoolLocation, degree, schoolEndDate }) => [schoolName, schoolLocation, degree, schoolEndDate])).toEqual([
      ["Purdue University", "West Lafayette, IN", "M.S. in Mechanical Engineering", "May 2027"],
      ["Purdue University", "West Lafayette, IN", "B.S. (Honors) in Mechanical Engineering", "December 2025"],
      ["Purdue University", "West Lafayette, IN", "B.A. in Economics", "May 2021"],
      ["Tohoku University", "Sendai, Japan", "Study Abroad, Robotics & Society", "Summer 2025"],
    ])
  })

  test("doesn't give a school to a certificate listed beside the schools", () => {
    const { resume } = read("Education", [
      line([["Purdue University", 36], ["2021 – 2025", 480]], { bold: true }),
      line([["B.S. in Mechanical Engineering", 36]], { italic: true }),
      line([["Certificate in Data Analytics", 36], ["2024", 480]], { bold: true }),
    ])
    expect(resume.educationSection.map((school) => school.schoolName)).toEqual(["Purdue University", ""])
  })
})

describe("a title with a separator in parentheses", () => {
  test("isn't split there", () => {
    const { resume } = read("Experience", [
      line([["2026", 36], ["Study Abroad Instructional Staff (UF in Japan: CCED)", 120], ["Univ. of Florida, Kyoto, Japan", 400]], { bold: true }),
    ])
    expect(resume.workExperienceSection[0]).toMatchObject({
      workRole: "Study Abroad Instructional Staff (UF in Japan: CCED)",
      companyName: "Univ. of Florida",
      workLocation: "Kyoto, Japan",
    })
  })

  test("is still split at one outside them", () => {
    const { resume } = read("Experience", [line([["Software Engineer (Contract) | Acme Corp", 36], ["2024", 480]], { bold: true })])
    expect(resume.workExperienceSection[0]).toMatchObject({ workRole: "Software Engineer (Contract)", companyName: "Acme Corp" })
  })
})

describe("a long title line with something set apart on its right", () => {
  test("is the entry's title, not a sentence", () => {
    const degree = "Bachelor of Science in Biomedical Sciences, Minors in Public Health & Psychology"
    const { resume, unplaced } = read("Education", [
      line([["University of Central Florida", 36], ["May 2027", 500]], { bold: true }),
      line([[degree, 36], ["GPA: 3.91/4.0", 500]], { italic: true }),
    ])
    expect(resume.educationSection[0]).toMatchObject({ schoolName: "University of Central Florida", degree, gpa: "3.91/4.0", schoolEndDate: "May 2027" })
    expect(unplaced).toEqual([])
  })

  test("doesn't make a long line on its own a title", () => {
    const { resume } = read("Experience", [
      line([["Data Analyst", 36], ["2023 – 2024", 480]], { bold: true }),
      line([["Acme Corp", 36]], { italic: true }),
      line([["Built the dashboards the sales team used every week to plan its calls and follow-ups with clients", 36]]),
    ])
    expect(resume.workExperienceSection).toHaveLength(1)
    expect(resume.workExperienceSection[0].workDescription).toBe(
      "• Built the dashboards the sales team used every week to plan its calls and follow-ups with clients",
    )
  })
  test("doesn't make a title of long text with a short label on its left", () => {
    const { resume } = read("Experience", [
      line([["2025", 36], ["Teaching Assistant, Robot Kinematics", 120], ["West Lafayette, IN", 480]], { bold: true }),
      line([["Rebuilt the course's labs", 130]], { bullet: true }),
      line([["Purdue Univ.", 36], ["Mentored a senior design team building an exam proctoring tool, now used by 600 students", 120]]),
    ])
    expect(resume.workExperienceSection).toHaveLength(1)
  })
})

describe("a sub-heading in a column of dates", () => {
  test("goes to Couldn't place, not into the entries around it", () => {
    const { resume, unplaced } = read(
      "Experience",
      onPage([
        line([["Industry", 72]], { italic: true }),
        line([["2026", 36], ["Instructional Staff, Robots in Society", 120], ["Sendai, Japan", 480]]),
        line([["2023 – 2025", 36], ["Lead Teaching Assistant, Robot Kinematics", 120], ["West Lafayette, IN", 470]]),
        line([["Mentoring", 66]], { italic: true }),
      ]),
    )
    expect(resume.workExperienceSection).toHaveLength(2)
    expect(resume.workExperienceSection).toMatchObject([
      { workRole: "Instructional Staff", companyName: "Robots in Society", workLocation: "Sendai, Japan", workEndDate: "2026" },
      { workRole: "Lead Teaching Assistant", companyName: "Robot Kinematics", workLocation: "West Lafayette, IN", workEndDate: "2025" },
    ])
    expect(unplaced).toEqual(["Industry", "Mentoring"])
  })

  test("isn't a place set under a date", () => {
    const { resume, unplaced } = read(
      "Experience",
      onPage([
        line([["2026", 36], ["Instructional Staff, Robots in Society", 120]]),
        line([["Sendai, Japan", 36]]),
        line([["2023 – 2025", 36], ["Lead Teaching Assistant, Robot Kinematics", 120]]),
      ]),
    )
    expect(resume.workExperienceSection[0]).toMatchObject({ workRole: "Instructional Staff", workLocation: "Sendai, Japan" })
    expect(unplaced).toEqual([])
  })
})

describe("a title with a dash in it", () => {
  test("stays whole when the organization has a line of its own", () => {
    const { resume, unplaced } = read("Experience", [
      line([["UF Health Heart Clinic", 36], ["Gainesville, FL", 480]], { bold: true }),
      line([["Physician Shadowing – Cardiology", 36], ["August 2026 – Present", 460]], { italic: true }),
      line([["Lab Research Assistant - Sample Preparation", 36], ["2025", 500]], { bold: true }),
      line([["Proteomics Core, State University", 36], ["Gainesville, FL", 480]], { italic: true }),
    ])
    expect(resume.workExperienceSection).toHaveLength(2)
    expect(resume.workExperienceSection[0]).toMatchObject({ workRole: "Physician Shadowing – Cardiology", companyName: "UF Health Heart Clinic" })
    expect(resume.workExperienceSection[1]).toMatchObject({
      workRole: "Lab Research Assistant - Sample Preparation",
      companyName: "Proteomics Core, State University",
    })
    expect(unplaced).toEqual([])
  })

  test("is still split into the organization and the role when it's all there is", () => {
    const { resume } = read("Leadership", [line([["ColorStack - National Member", 36], ["Sep. 2026 – Present", 460]], { bold: true })])
    expect(resume.leadershipExperienceSection[0]).toMatchObject({ leadershipOrg: "ColorStack", leadershipRole: "National Member" })
  })
})

describe("how much of a file couldn't be placed", () => {
  test("is nothing for a resume read right", () => {
    const { parsed } = read("Experience", [
      line([["Hospital Volunteer", 36], ["May 2025 – August 2025", 460]], { bold: true }),
      line([["Lakeview Medical Center", 36]], { italic: true }),
      line([["Escorted outpatients to imaging appointments", 54]], { bullet: true }),
    ])
    expect(unplacedShare(parsed)).toBe(0)
  })

  test("is most of a resume whose sections weren't found", () => {
    const parsed = parseResume([
      line([["Mara Lin", 36]], { size: 18, bold: true }),
      line([["mara@example.com", 36]]),
      line([["Hospital Volunteer at Lakeview Medical Center, May 2025 to August 2025", 36]]),
      line([["Escorted outpatients to imaging appointments and answered their families' questions", 54]], { bullet: true }),
      line([["Cleaned wheelchairs and kept the waiting areas tidy, following infection control rules", 54]], { bullet: true }),
    ])
    expect(unplacedShare(parsed)).toBeGreaterThan(MUCH_UNPLACED)
  })
})

describe("a role and organization that are hard to tell apart", () => {
  // Company first, then the role, as each entry here is set.
  const companyFirst = (company: string, role: string, dates: string) => [
    line([[company, 36], ["Orlando, FL", 480]], { bold: true }),
    line([[role, 36], [dates, 460]], { italic: true }),
  ]

  test("are read the way the section's other entries are", () => {
    const { resume } = read("Experience", [
      ...companyFirst("Lakeview Regional Medical Center", "Hospital Volunteer", "May 2025 – August 2025"),
      ...companyFirst("Seminole Heart & Vascular Clinic", "Physician Shadowing – Cardiology", "August 2026 – Present"),
      ...companyFirst("Department of Surgery, State University", "Undergraduate Researcher", "May 2026 – Present"),
    ])
    expect(resume.workExperienceSection[1]).toMatchObject({ workRole: "Physician Shadowing – Cardiology", companyName: "Seminole Heart & Vascular Clinic" })
  })

  test("are read the way the rest of the resume is, when their section has nothing to go by", () => {
    const parsed = parseResume([
      line([["Mara Lin", 36]], { size: 18, bold: true }),
      line([["Experience", 36]], { size: 12, bold: true }),
      line([["Data Analyst", 36], ["2024 – Present", 470]], { bold: true }),
      line([["Acme Corporation", 36], ["Atlanta, GA", 480]], { italic: true }),
      line([["Software Engineer Intern", 36], ["2023", 500]], { bold: true }),
      line([["Initech Group", 36], ["Atlanta, GA", 480]], { italic: true }),
      line([["Leadership", 36]], { size: 12, bold: true }),
      line([["Software Lead", 36], ["2022 – 2024", 470]], { bold: true }),
      line([["GT Solar Racing Engineering", 36], ["Atlanta, GA", 480]], { italic: true }),
    ])
    expect(toResumeContent(parsed).leadershipExperienceSection[0]).toMatchObject({ leadershipRole: "Software Lead", leadershipOrg: "GT Solar Racing Engineering" })
  })

  test("don't change one that's clear, whatever the others do", () => {
    const { resume } = read("Experience", [
      ...companyFirst("Lakeview Regional Medical Center", "Hospital Volunteer", "May 2025 – August 2025"),
      ...companyFirst("Department of Surgery, State University", "Undergraduate Researcher", "May 2026 – Present"),
      line([["Research Assistant", 36], ["2024", 500]], { bold: true }),
      line([["Proteomics Core Laboratory", 36], ["Orlando, FL", 480]], { italic: true }),
    ])
    expect(resume.workExperienceSection[2]).toMatchObject({ workRole: "Research Assistant", companyName: "Proteomics Core Laboratory" })
  })

  test("don't follow other sections, which may be set out another way, unless their scores tie", () => {
    const parsed = parseResume([
      line([["Mara Lin", 36]], { size: 18, bold: true }),
      line([["Experience", 36]], { size: 12, bold: true }),
      line([["Software Engineer, Backend - Google", 36], ["2024", 500]]),
      line([["Leadership", 36]], { size: 12, bold: true }),
      line([["ColorStack - National Member", 36], ["2025", 500]]),
      line([["Robotics Club - Treasurer", 36], ["2023", 500]]),
    ])
    expect(toResumeContent(parsed).workExperienceSection[0]).toMatchObject({ workRole: "Software Engineer, Backend", companyName: "Google" })
  })

  test("are read as before when nothing else on the resume says which comes first", () => {
    const { resume } = read("Experience", companyFirst("Seminole Heart & Vascular Clinic", "Physician Shadowing – Cardiology", "August 2026 – Present"))
    expect(resume.workExperienceSection[0]).toMatchObject({ workRole: "Seminole Heart & Vascular Clinic", companyName: "Physician Shadowing – Cardiology" })
  })
})

describe("a role set under its organization on a line of its own", () => {
  const organization = line([["Purdue University", 36], ["West Lafayette, IN", 460]], { bold: true })

  test("is the role, with the lines after it set aside, when bullets follow them", () => {
    const { resume, unplaced } = read("Experience", [
      organization,
      line([["Lab Manager & Instructional Staff", 54]]),
      line([["Robotics Teaching Lab", 54]]),
      line([["School of Engineering Education", 54]]),
      line([["Run a robotics teaching lab serving 120 students a semester", 64]], { bullet: true }),
      line([["Oversee $80,000 in robots, sensors and test equipment", 64]], { bullet: true }),
    ])
    expect(resume.workExperienceSection).toHaveLength(1)
    expect(resume.workExperienceSection[0]).toMatchObject({
      workRole: "Lab Manager & Instructional Staff",
      companyName: "Purdue University",
      workLocation: "West Lafayette, IN",
      workDescription: "• Run a robotics teaching lab serving 120 students a semester\n• Oversee $80,000 in robots, sensors and test equipment",
    })
    expect(unplaced).toEqual(["Robotics Teaching Lab", "School of Engineering Education"])
  })

  test("isn't taken from lines with no bullets after them", () => {
    const { resume } = read("Experience", [organization, line([["Robotics Teaching Lab", 54]]), line([["Ran the lab's front desk", 54]])])
    expect(resume.workExperienceSection[0]).toMatchObject({ workRole: "", workDescription: "• Robotics Teaching Lab\n• Ran the lab's front desk" })
  })

  test("isn't taken when the entry has a role already", () => {
    const { resume } = read("Experience", [
      line([["Lab Manager", 36], ["2024 – Present", 470]], { bold: true }),
      line([["Purdue University", 36], ["West Lafayette, IN", 460]], { italic: true }),
      line([["Robotics Teaching Lab", 54]]),
      line([["Run a robotics teaching lab serving 120 students a semester", 64]], { bullet: true }),
    ])
    expect(resume.workExperienceSection[0]).toMatchObject({
      workRole: "Lab Manager",
      companyName: "Purdue University",
      workDescription: "• Robotics Teaching Lab\n• Run a robotics teaching lab serving 120 students a semester",
    })
  })
})

describe("a title with a comma, then a dash or colon", () => {
  const resume = (work: Line[], leadership: Line[]) =>
    toResumeContent(
      parseResume([
        line([["Mara Lin", 36]], { size: 18, bold: true }),
        line([["Experience", 36]], { size: 12, bold: true }),
        ...work,
        line([["Leadership", 36]], { size: 12, bold: true }),
        ...leadership,
      ]),
    )
  const dated = (title: string, dates: string) => line([[title, 36], [dates, 470]])

  test("splits at the comma when the resume's other entries put the comma between role and organization", () => {
    const { workExperienceSection: work } = resume(
      [
        dated("Lead Teaching Assistant, ME 3410 - Robot Kinematics", "2023 – 2025"),
        dated("Instructional Staff, Purdue in Japan: RAS, ME 49700", "2026"),
        dated("Instructional Staff, ME 4630 - Engineering Design", "2025 – Present"),
      ],
      [dated("Vice-President, BoilerHacks XI", "2025"), dated("Technical Lead, Open Robotics Club", "2022 – 2024")],
    )
    expect(work[0]).toMatchObject({ workRole: "Lead Teaching Assistant", companyName: "ME 3410 - Robot Kinematics" })
    expect(work[1]).toMatchObject({ workRole: "Instructional Staff", companyName: "Purdue in Japan: RAS, ME 49700" })
    expect(work[2]).toMatchObject({ workRole: "Instructional Staff", companyName: "ME 4630 - Engineering Design" })
  })

  test("splits at the dash when nothing else on the resume puts a comma between them", () => {
    const { workExperienceSection: work } = resume([dated("Software Engineer, Backend - Google", "2024")], [dated("Robotics Club", "2022")])
    expect(work[0]).toMatchObject({ workRole: "Software Engineer, Backend", companyName: "Google" })
  })

  test("splits at the dash when the resume's other entries put a dash between them", () => {
    const { workExperienceSection: work } = resume(
      [dated("Software Engineer, Backend - Google", "2024")],
      [dated("National Member - ColorStack", "2025"), dated("Treasurer - Robotics Club", "2023"), dated("Vice-President, BoilerHacks XI", "2022")],
    )
    expect(work[0]).toMatchObject({ workRole: "Software Engineer, Backend", companyName: "Google" })
  })
})

describe("a line with something other than a date in a column of dates", () => {
  test("goes to Couldn't place with the lines it wraps onto, and isn't part of the entry above", () => {
    const { resume, unplaced } = read("Experience", [
      line([["2026", 36], ["Instructional Staff, Robots in Society", 120], ["Sendai, Japan", 480]]),
      line([["2023 – 2025", 36], ["Lead Teaching Assistant, Robot Kinematics", 120], ["West Lafayette, IN", 470]]),
      line([["Purdue Univ.", 36], ["L. Park → Salesforce, H. Ortiz → Eli Lilly. Senior design team, “Boiler Proctor:", 120]]),
      line([["Integrating Safe Exam Browser with Brightspace,” 2026.", 120]]),
    ])
    expect(resume.workExperienceSection).toHaveLength(2)
    expect(resume.workExperienceSection[1]).toMatchObject({ workRole: "Lead Teaching Assistant", companyName: "Robot Kinematics", workDescription: "" })
    expect(unplaced).toEqual([
      "Purdue Univ. L. Park → Salesforce, H. Ortiz → Eli Lilly. Senior design team, “Boiler Proctor: Integrating Safe Exam Browser with Brightspace,” 2026.",
    ])
  })

  test("isn't a place set beside the organization, under the date", () => {
    const { resume, unplaced } = read("Experience", [
      line([["2024 – Present", 36], ["Software Engineer", 120]], { bold: true }),
      line([["Seattle, WA", 36], ["Stripe", 120]], { italic: true }),
      line([["2022 – 2024", 36], ["Data Analyst", 120]], { bold: true }),
      line([["Austin, TX", 36], ["Indeed", 120]], { italic: true }),
    ])
    expect(resume.workExperienceSection).toMatchObject([
      { workRole: "Software Engineer", companyName: "Stripe", workLocation: "Seattle, WA" },
      { workRole: "Data Analyst", companyName: "Indeed", workLocation: "Austin, TX" },
    ])
    expect(unplaced).toEqual([])
  })
})

describe("a citation's venue without italics", () => {
  const paper = (citation: string) => read("Publications", [line([[citation, 44]])]).resume.publicationsSection[0]

  test("is the first piece after the title, and the rest is detail", () => {
    expect(
      paper("[1] L. Park and M. Ferreira, “Boiler Proctor: Integrating Safe Exam Browser,” Senior Design Project, School of Engineering, Purdue University, West Lafayette, IN, USA, Apr. 2026."),
    ).toMatchObject({
      publicationVenue: "Senior Design Project",
      publicationDetails: "School of Engineering, Purdue University, West Lafayette, IN, USA",
      publicationDate: "Apr. 2026",
    })
    expect(paper("[2] J. Kim and W. Zhang, “Benchmarking Long Documents,” Proc. Annual Meeting of the ACL, Vienna, Austria, pp. 410–422, Jul 2025.")).toMatchObject({
      publicationVenue: "Proc. Annual Meeting of the ACL",
      publicationDetails: "Vienna, Austria, pp. 410–422",
    })
  })

  test("keeps a list in its name whole", () => {
    expect(paper("[3] A. Smith, “Fair Ranking,” Proc. Conf. on Fairness, Accountability, and Transparency, Seoul, Korea, 2022.")).toMatchObject({
      publicationVenue: "Proc. Conf. on Fairness, Accountability, and Transparency",
      publicationDetails: "Seoul, Korea",
    })
  })
})
