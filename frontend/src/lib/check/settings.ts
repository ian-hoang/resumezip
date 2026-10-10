// What the resume checker counts, and how much. Rule groups add their word
// lists and thresholds here too, so tuning the checker means changing this
// file only. See README.md.

import type { FieldKey, ProfileKey } from "@/components/editor/sections"

/**
 * The rubric's categories, in the order they're shown, what each is worth in
 * the resume score (100 in all, see score.ts), and what each checks, in a line.
 */
export const CATEGORIES = [
  { id: "contact", name: "Contact & personal details", points: 10, about: "Name, email, phone and location are there, and nothing private" },
  { id: "readable", name: "Readable by hiring software", points: 15, about: "Hiring software finds your details, sections and entries" },
  { id: "sections", name: "Sections & entries", points: 10, about: "The sections a resume needs, each entry filled in" },
  { id: "dates", name: "Dates", points: 10, about: "Clear dates on every entry, written one way, newest first" },
  { id: "bullets", name: "Bullets", points: 30, about: "Clear contributions, useful scope or results, and no repeats" },
  { id: "length", name: "Length & layout", points: 10, about: "The right length, well filled, with bullets that wrap well" },
  { id: "spelling", name: "Spelling & grammar", points: 15, about: "No typos or mixed-up words, and tech names spelled right" },
  // Every polish rule is advice that doesn't change the score, so Polish has
  // no points of its own; they went to Bullets, with 5 of Contact's, whose
  // serious problems are must-fixes that cap the score anyway. Give Polish
  // some back before making a polish rule count, or its bar divides by zero.
  { id: "polish", name: "Polish", points: 0, about: "Punctuation, capitals and spacing used one way throughout" },
] as const

export type CategoryId = (typeof CATEGORIES)[number]["id"]

/**
 * How sure a rule is. A "fix" is clearly wrong, so it can't be dismissed; a
 * "look" is a suggestion, and can be. In the score, a rule that finds
 * something takes up to `penalty` of its category's points (see score.ts).
 */
export const LEVELS = {
  fix: { name: "Must fix", penalty: 0.5 },
  look: { name: "Worth a look", penalty: 0.2 },
} as const

export type Level = keyof typeof LEVELS

/**
 * A rule that finds anything takes at least this share of its penalty,
 * however little of the resume it's about: one typo in thirty fields is still
 * a typo. The rest of the penalty grows with how much of the resume fails it.
 */
export const LEAST_PENALTY = 0.5

/** The most a resume can score while a must-fix problem is left. */
export const MUST_FIX_MAX = 89

/**
 * The word shown beside a score: each band's lowest score, highest first.
 * "Strong" starts above MUST_FIX_MAX, so a resume with a must-fix left is
 * never called strong.
 */
export const SCORE_BANDS = [
  { least: 100, name: "Perfect" },
  { least: 90, name: "Strong" },
  { least: 70, name: "Good" },
  { least: 0, name: "Needs work" },
] as const

/**
 * The color the score is shown in, on its ring, its number and its word
 * (styles/editor.css): each band's lowest score, highest first. They don't
 * split where the words do, so a 75 is "Good" in amber.
 */
export const SCORE_COLORS = [
  { least: 100, color: "perfect" },
  { least: 80, color: "green" },
  { least: 60, color: "amber" },
  { least: 0, color: "red" },
] as const

/** How many dismissed findings, and how many added words, a resume keeps. The oldest go first. */
export const MAX_DISMISSED = 500
export const MAX_WORDS = 500

/** Longer than this isn't a word, so "Add word" ignores it. */
export const MAX_WORD_LENGTH = 60

// Contact & personal details (C1–C10).

/** Plausibility bounds, not validation against every country's numbering plan. */
export const MIN_PHONE_DIGITS = 6
export const MAX_PHONE_DIGITS = 15
export const MAX_PHONE_EXTENSION_DIGITS = 10

/**
 * The end of a LinkedIn link LinkedIn made up, rather than one the person
 * chose: a hyphen, then at least this many letters and digits, with a digit
 * among them ("jake-ryan-8a7b6c123").
 */
export const LINKEDIN_RANDOM_ENDING = 6

/** Words that make a street address, after a house number: "12 Elm St". */
export const STREET_WORDS = [
  "St", "Street", "Ave", "Avenue", "Rd", "Road", "Blvd", "Boulevard", "Dr", "Drive", "Ln", "Lane", "Way",
  "Ct", "Court", "Pl", "Place", "Pkwy", "Parkway", "Hwy", "Highway", "Ter", "Terrace", "Cir", "Circle",
]

// Around a detail written as an item on its own, as in "Age 22 · Single ·
// Austin, TX": the start of the text or a separator before it, and the end or
// a separator after it. Some details are only flagged that way, so a
// "single-page app" or a "15-year-old codebase" isn't.
const START = String.raw`(?:^|[,;|·•(]\s*)`
const END = String.raw`\s*(?:$|[,;|·•)])`

// A label and its value, as on a form ("Gender: M", "DOB - 1st Jan 90"): the
// label says what the detail is, so the value can be written any way. A
// hyphen only separates with spaces around it, so "Sex-ed outreach" isn't one.
const labeled = (label: string) => String.raw`(?:my\s+)?(?:${label})(?:\s*[:=]|\s+[-–]\s)\s*[^\s,;|·•)][^,;|·•)]*`

const MONTH = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?`
const DAY = String.raw`\d{1,2}(?:st|nd|rd|th)?`
// "04/12/2003", "March 3rd, 2003", "12 Jan 03", "May 2003".
const BIRTH_DATE = String.raw`(?:(?:\d{1,4}[./ -]){0,2}\d{1,4}|${MONTH}\s+(?:${DAY},?\s+\d{2,4}|${DAY}|\d{4})|${DAY}\s+(?:of\s+)?${MONTH},?\s+\d{2,4})`

/**
 * Personal details to leave off, and how they're usually written. Nationality,
 * citizenship and clearance are never flagged: roles that need a security
 * clearance ask for them.
 */
export const PERSONAL_DETAILS = [
  {
    name: "date of birth",
    pattern: new RegExp(
      String.raw`${START}(?:${labeled(String.raw`date of birth|birth ?date|D\.?O\.?B\.?|born`)}|(?:(?:my\s+)?(?:date of birth|birth ?date|D\.?O\.?B\.?)\s*[-–]?\s*|(?:I was\s+)?born\s+(?:(?:on|in)\s+)?)${BIRTH_DATE}\.?)${END}`,
      "i",
    ),
  },
  {
    name: "age",
    pattern: new RegExp(
      String.raw`${START}(?:(?:my\s+)?age\s*[:=-]?\s*\d{1,3}|(?:(?:I am|I'm)\s+)?\d{1,3}[ -](?:years?|yrs?)\.?[ -](?:old|of age))\.?${END}`,
      "i",
    ),
  },
  {
    name: "gender",
    pattern: new RegExp(String.raw`${START}(?:${labeled("gender|sex")}|(?:male|female|non[- ]?binary|man|woman)\.?)${END}`, "i"),
  },
  {
    name: "marital status",
    pattern: new RegExp(
      String.raw`${START}(?:${labeled("marital status")}|(?:(?:I am|I'm)\s+)?(?:married|divorced|widowed|single)\.?)${END}`,
      "i",
    ),
  },
] as const

/**
 * A Social Security number, as it's usually written: 123-45-6789 or
 * 123 45 6789, or nine digits right after "SSN" or "Social Security". Nine
 * digits on their own aren't flagged, as LinkedIn's made-up link endings and
 * other IDs have them too.
 */
export const SSN = /\b\d{3}[- ]\d{2}[- ]\d{4}\b|\b(ssn|social security(\s+(number|no\.?))?)\s*[:#]?\s*\d{9}\b/i

// Sections & entries (S1–S10).

/** A skills line with this many items or more reads as a list to skim past. */
export const MAX_SKILLS_PER_LINE = 15

/** More courses than this, and the ones that matter get lost. */
export const MAX_COURSES = 8

/** A school whose college graduation is this many school years away or more is a freshman's, who can keep high school. */
export const FRESHMAN_YEARS_LEFT = 3

/** School years start in this month (0 = January), for counting how far away graduation is. */
export const SCHOOL_YEAR_STARTS = 7

/** How a college degree is usually written ("B.S. in…", "Master of…"). */
export const COLLEGE_DEGREE =
  /\b(bachelor|master|doctor|associate|ph\.?\s?d|mba|b\.?\s?(s|a|sc|eng|s\.?e|com|f\.?a|b\.?a)|m\.?\s?(s|a|sc|eng|b\.?a|phil|f\.?a)|a\.?\s?(a|s))\b\.?/i

/** How a college's name usually reads. */
export const COLLEGE_NAME = /\b(university|college|institute|polytechnic|universidad|université|universität)\b/i

/** How a high school's name usually reads. */
export const HIGH_SCHOOL_NAME = /\bhigh school\b/i

/** "References available upon request", however it's worded. */
export const REFERENCES_ON_REQUEST = /\breferences?\b[^.]{0,30}?\brequest(ed)?\b/i

// Dates (D1–D7).

/** Words for a date that hasn't come yet: an entry that's still going. */
export const PRESENT_WORDS = ["Present", "Current", "Now", "Ongoing", "Today"]

/** Words before a date that aren't part of it: "Expected May 2027", "Class of 2027". */
export const DATE_PREFIXES = ["Expected", "Anticipated", "Exp.", "Est.", "Estimated", "Graduated", "Graduating", "Graduation", "Class of"]

// Bullets (B1–B9).

/** Starts that describe a duty instead of what was done. */
export const WEAK_STARTS = [
  "Responsible for", "Worked on", "Work on", "Working on",
  "Tasked with", "Involved in", "In charge of", "Duties included",
]

/**
 * Action verbs, each as its present and past forms ("build built"): present
 * for what's still going, past for what has ended. Regular verbs in the past
 * ("Optimized") are known without being listed; they're here for their
 * present form and for suggesting other verbs.
 */
export const ACTION_VERBS = `
  help helped, assist assisted, participate participated,
  accelerate accelerated, achieve achieved, acquire acquired, adapt adapted, add added, address addressed, adopt adopted,
  administer administered, advise advised, advocate advocated, align aligned, allocate allocated, analyze analyzed,
  answer answered, apply applied, architect architected, arrange arranged, assemble assembled, assess assessed,
  audit audited, author authored, automate automated, balance balanced, begin began, benchmark benchmarked,
  boost boosted, brainstorm brainstormed, bring brought, build built, calculate calculated, champion championed,
  chair chaired, clarify clarified, clean cleaned, coach coached, code coded, collaborate collaborated,
  collect collected, communicate communicated, compile compiled, complete completed, compose composed,
  compute computed, conduct conducted, configure configured, consolidate consolidated, construct constructed,
  consult consulted, contribute contributed, convert converted, coordinate coordinated, create created,
  curate curated, cut cut, debug debugged, decrease decreased, define defined, delegate delegated, deliver delivered,
  demonstrate demonstrated, deploy deployed, design designed, detect detected, determine determined,
  develop developed, devise devised, diagnose diagnosed, direct directed, discover discovered, distill distilled,
  document documented, double doubled, draft drafted, drive drove, edit edited, educate educated,
  eliminate eliminated, embed embedded, employ employed, enable enabled, engineer engineered, enhance enhanced, establish established,
  evaluate evaluated, examine examined, execute executed, expand expanded, expedite expedited, explore explored,
  extend extended, extract extracted, facilitate facilitated, find found, fix fixed, forecast forecast,
  formulate formulated, gather gathered, generate generated, give gave, grow grew, guide guided, halve halved,
  handle handled, head headed, hire hired, hold held, host hosted, identify identified, implement implemented,
  import imported, improve improved, increase increased, initiate initiated, inspect inspected, install installed,
  instruct instructed, integrate integrated, interview interviewed, introduce introduced, invent invented,
  investigate investigated, keep kept, label labeled, launch launched, lead led, lower lowered, maintain maintained,
  make made, manage managed, map mapped, measure measured, meet met, mentor mentored, merge merged, migrate migrated,
  model modeled, modernize modernized, monitor monitored, move moved, negotiate negotiated, onboard onboarded,
  operate operated, optimize optimized, orchestrate orchestrated, organize organized, overhaul overhauled,
  oversee oversaw, own owned, partner partnered, perform performed, pilot piloted, pioneer pioneered, plan planned,
  prepare prepared, present presented, price priced, prioritize prioritized, process processed, produce produced,
  profile profiled, program programmed, promote promoted, propose proposed, prototype prototyped, provide provided,
  publish published, raise raised, rank ranked, rebuild rebuilt, recommend recommended, recruit recruited,
  redesign redesigned, reduce reduced, refactor refactored, refine refined, release released, remove removed,
  render rendered, replace replaced, replicate replicated, report reported, represent represented,
  research researched, resolve resolved, restructure restructured, review reviewed, revise revised,
  rewrite rewrote, route routed, run ran, save saved, scale scaled, schedule scheduled, score scored,
  scrape scraped, screen screened, script scripted, secure secured, segment segmented, sell sold, send sent, serve served, set set,
  ship shipped, simplify simplified, solve solved, sort sorted, speak spoke, spearhead spearheaded,
  standardize standardized, start started, streamline streamlined, strengthen strengthened, study studied,
  supervise supervised, support supported, survey surveyed, synthesize synthesized, take took, teach taught,
  test tested, track tracked, train trained, transform transformed, translate translated, triple tripled,
  troubleshoot troubleshot, tune tuned, tutor tutored, unify unified, update updated, upgrade upgraded, use used,
  validate validated, verify verified, visualize visualized, volunteer volunteered, win won, write wrote
`

/**
 * Words that end like verbs but describe a person ("Experienced in Python"),
 * so they don't count as starting with an action verb. Ones that are often
 * verbs too, like "Motivated", aren't here.
 */
export const NOT_ACTION_VERBS = [
  "experienced", "skilled", "talented", "seasoned", "dedicated", "interested", "excited", "oriented", "versed",
  "self-motivated", "hardworking", "outstanding", "willing",
]

/** Other verbs to suggest when one starts too many bullets. */
export const VERB_SYNONYMS: Record<string, string[]> = {
  analyze: ["assess", "evaluate", "investigate"],
  automate: ["streamline", "simplify", "script"],
  build: ["create", "develop", "engineer"],
  collaborate: ["partner", "coordinate", "align"],
  conduct: ["run", "perform", "lead"],
  coordinate: ["organize", "manage", "plan"],
  create: ["build", "design", "launch"],
  deploy: ["launch", "release", "ship"],
  design: ["architect", "plan", "prototype"],
  develop: ["build", "create", "engineer"],
  implement: ["build", "deploy", "integrate"],
  improve: ["boost", "enhance", "streamline"],
  increase: ["grow", "raise", "boost"],
  lead: ["direct", "head", "guide"],
  maintain: ["support", "run", "update"],
  manage: ["coordinate", "oversee", "direct"],
  mentor: ["coach", "guide", "train"],
  optimize: ["improve", "tune", "refine"],
  organize: ["coordinate", "plan", "arrange"],
  reduce: ["cut", "lower", "decrease"],
  research: ["investigate", "study", "explore"],
  support: ["enable", "maintain", "serve"],
  test: ["validate", "verify", "evaluate"],
  train: ["coach", "mentor", "teach"],
  use: ["apply", "adopt", "employ"],
  write: ["author", "implement", "draft"],
}

/** "Buzzwords": words anyone could claim, that say little on their own. */
export const BUZZWORDS = [
  "results-driven", "results-oriented", "detail-oriented", "team player", "self-starter", "go-getter", "hard-working",
  "hardworking", "passionate", "synergy", "synergies", "think outside the box", "proven track record", "best-in-class",
  "world-class", "cutting-edge", "rockstar", "ninja", "guru",
]

/** Vague words that stand in for saying which or how many. */
export const VAGUE_WORDS = ["various", "numerous", "a variety of", "etc.", "etc", "and so on"]

/** Words that count as a number in a bullet, as digits do. */
export const NUMBER_WORDS = [
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "dozen", "dozens",
  "hundred", "hundreds", "thousand", "thousands", "million", "millions", "billion", "billions", "doubled", "tripled", "halved",
]

/** A job with more bullets than this buries the best of them. */
export const MAX_BULLETS = 6

/** The same first word on this many bullets or more reads as repetitive. */
export const SAME_START = 3

/** Two bullets count as the same when they differ by one letter per this many, as "account" and "accounts" in a long bullet. */
export const NEAR_DUPLICATE_LENGTH = 25

// Polish (P1–P7).

/** US states and their abbreviations, to find one written both ways. */
export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
]

/** State names that are also countries, so a place written with one may not be in the US: "Tbilisi, Georgia". */
export const STATES_ALSO_COUNTRIES = ["Georgia"]

/** Degree abbreviations with dots and without, to find both on one resume. MBA goes either way, so it isn't here. */
export const DEGREE_ABBREVIATIONS: [string, string][] = [
  ["B.S.", "BS"], ["B.A.", "BA"], ["B.Sc.", "BSc"], ["B.S.E.", "BSE"], ["B.Eng.", "BEng"], ["B.B.A.", "BBA"],
  ["B.F.A.", "BFA"], ["M.S.", "MS"], ["M.A.", "MA"], ["M.Sc.", "MSc"], ["M.Eng.", "MEng"], ["M.F.A.", "MFA"],
  ["M.P.H.", "MPH"], ["Ph.D.", "PhD"], ["J.D.", "JD"], ["A.A.", "AA"], ["A.S.", "AS"],
]

/** Acronyms and names of 5 or more letters that are written in capitals. */
export const ACRONYMS = [
  "ABAQUS", "AECOM", "ANSYS", "ASCII", "AUTOSAR", "BASIC", "CATIA", "CISSP", "COBOL", "COMSOL", "CRISPR", "EBITDA",
  "ELISA", "FERPA", "FINRA", "FISMA", "FORTRAN", "HIPAA", "HTTPS", "IELTS", "LIDAR", "MATLAB", "NASDAQ", "NASTRAN",
  "NGINX", "NVIDIA", "OAUTH", "PMBOK", "POSIX", "PSPICE", "README", "SCADA", "SIGGRAPH", "SOLID", "SPICE", "STATA",
  "TOEFL", "UNESCO", "UNICEF",
]

/** Names written in lower case on purpose, which can start a bullet. */
export const LOWERCASE_NAMES = [
  "bash", "conda", "curl", "dbt", "eslint", "ffmpeg", "jest", "kubectl", "matplotlib", "npm", "numpy", "pandas", "pip",
  "pnpm", "pytest", "scikit-learn", "seaborn", "tmux", "vim", "vite", "webpack", "wget", "yarn", "zsh",
]

/**
 * Words after a number that make it a measurement or a size ("9 ms",
 * "2 weeks", "4 million"). Those are written in digits or words by their own
 * conventions, so they aren't compared with how counts are written.
 */
export const NUMBER_UNITS = [
  "thousand", "thousands", "million", "millions", "billion", "billions", "trillion", "k", "ns", "ms", "nanoseconds",
  "microseconds", "milliseconds", "s", "sec", "secs", "second", "seconds", "min", "mins", "minute", "minutes", "hr", "hrs",
  "hour", "hours", "day", "days", "week", "weeks", "month", "months", "yr", "yrs", "year", "years", "pt", "pts", "point",
  "points", "percent", "times", "x", "kb", "mb", "gb", "tb", "mm", "cm", "km", "in", "inches", "ft", "feet", "mile",
  "miles", "kg", "lbs", "degrees",
]

/**
 * Small words after a number that show it isn't counting the next word, as in
 * "from 9 days to 6 across 30 centers", where "6" is days.
 */
export const NOT_COUNTED_AFTER = [
  "a", "across", "after", "an", "and", "as", "at", "before", "between", "but", "by", "during", "for", "from", "in", "into",
  "of", "on", "onto", "or", "over", "per", "since", "than", "the", "to", "under", "until", "via", "with", "within",
]

/** Words before a number that make it a label rather than a count: "version 2", "phase 3". */
export const NUMBER_LABELS = [
  "version", "v", "release", "phase", "level", "tier", "step", "round", "part", "grade", "stage", "gen", "generation",
  "series", "chapter",
]

/**
 * Shorthand and slang, and the word to write instead. Not "&": "design &
 * build" reads fine, and it saves room on a line.
 */
export const SHORTHAND: [string, string][] = [
  ["w/o", "without"], ["w/", "with"], ["b/c", "because"], ["mgmt", "management"], ["mgr", "manager"],
  ["approx.", "about"], ["approx", "about"], ["govt", "government"], ["thru", "through"], ["esp.", "especially"],
  ["yrs", "years"], ["yr", "year"], ["hrs", "hours"], ["hr", "hour"],
]

// Readable by hiring software (R1–R6).

/**
 * Characters that may not come through hiring software: emoji, arrows,
 * stars, check marks, boxes and other symbols. FINE_SYMBOLS are exceptions.
 */
export const ODD_SYMBOLS =
  /[\p{Extended_Pictographic}\p{Co}\u2190-\u21FF\u2300-\u23FF\u2460-\u24FF\u25A0-\u25FF\u2600-\u27BF\u2900-\u297F\u2B00-\u2BFF]/u

/** Symbols that look like ODD_SYMBOLS but come through fine, as in a product's name. */
export const FINE_SYMBOLS = ["©", "®", "™"]

// Length & layout (L1–L5).

/** This many lines or fewer on the last page is a spill-over. */
export const SPILL_LINES = 5

/**
 * A bullet whose last line has this many words or fewer leaves a gap. Four
 * words fill enough of a line to leave be.
 */
export const SHORT_LAST_LINE = 3

/** A bullet that runs this many lines or more is hard to skim. */
export const LONG_BULLET_LINES = 3

/** A one-page resume should fill at least this share of the page. */
export const MIN_PAGE_FULL = 0.75

// Spelling & grammar (G1–G7). The grammar checker is Harper (harper.js), which
// runs in the browser; see grammar.ts.

/**
 * Fields that name things: people, companies, schools, groups, places,
 * projects and skills. Their words count as spelled right everywhere on the
 * resume, and they aren't checked for spelling themselves, but for the
 * skills (SKILL_FIELDS).
 */
export const NAME_FIELDS: readonly (ProfileKey | FieldKey)[] = [
  "fullName", "location", "companyName", "workLocation", "schoolName", "schoolLocation", "skillName",
  "skillDetails", "projectName", "techStack", "publicationAuthors", "publicationVenue", "volunteerOrg",
  "volunteerLocation", "leadershipOrg", "leadershipLocation", "awardOrg",
]

/**
 * Fields that list skills: names the grammar checker mostly doesn't know
 * ("Redux", "Kanban"), and words it does ("Communication"). G1 checks them
 * for slips in typing those words (MIN_SKILL_SLIP), and in tech names.
 */
export const SKILL_FIELDS: readonly FieldKey[] = ["skillName", "skillDetails", "techStack"]

/**
 * Tech names as their makers write them (G6), checked in any field. Names
 * that are also everyday words ("React", "Swift", "Excel", "Go") aren't here,
 * since "react" or "excel" in a bullet is usually the word.
 */
export const TECH_NAMES = [
  "JavaScript", "TypeScript", "GitHub", "GitLab", "Bitbucket", "PostgreSQL", "MySQL", "SQLite", "MongoDB", "DynamoDB",
  "NoSQL", "GraphQL", "gRPC", "Node.js", "Next.js", "Vue.js", "Nuxt.js", "Express.js", "jQuery", "iOS", "macOS",
  "iPadOS", "watchOS", "LinkedIn", "YouTube", "PowerPoint", "OpenAI", "ChatGPT", "TensorFlow", "PyTorch", "NumPy",
  "SciPy", "LaTeX", "MATLAB", "BigQuery", "PowerShell", "WordPress", "HubSpot", "Salesforce", "Kubernetes", "OAuth",
  "FastAPI", "CircleCI", "Jupyter", "AutoCAD", "SolidWorks", "Photoshop", "QuickBooks", "Xcode", "IntelliJ",
  "PyCharm", "WebSocket", "WebSockets", "Firebase", "Supabase", "Heroku", "Netlify", "Vercel", "Figma", "Jira",
  "Airtable", "Webflow", "Shopify", "Databricks", "Hadoop", "Kafka", "Elasticsearch", "Kotlin", "Docker",
  "Terraform", "Ansible", "Jenkins", "Linux", "Ubuntu", "Arduino", "Django", "Golang", "Haskell",
  "HTML", "CSS", "SQL", "AWS", "GCP", "JSON", "YAML", "XML", "PHP", "DevOps", "Tableau", "Python", "Java",
]

/**
 * Tech and work words that aren't in the dictionary but are spelled right
 * (G1). Names with capitals inside ("DuckDB", "eBPF") and words with digits
 * are usually names too. Clear known errors still count in all capitals.
 */
export const TECH_WORDS = [
  "magento",
  "async", "autograd", "autograder", "autoscaling", "backend", "backends", "backtest", "backtester", "backtesting",
  "changelog", "chatbot", "chatbots", "codebase", "codebases", "config", "configs", "cron", "dashboarding", "dataset",
  "datasets", "debugger", "dedupe", "devops", "e-commerce", "ecommerce", "edtech", "embeddings", "failover",
  "fintech", "frontend", "frontends", "fullstack", "geospatial", "hackathon", "hackathons", "healthtech", "linter",
  "malloc", "microservice", "microservices", "middleware", "monorepo", "onboarding", "pipelining", "preprocessing",
  "proptech", "quant", "refactor", "refactored", "refactoring", "repo", "repos", "runtime", "runtimes", "sharding",
  "startup", "startups", "tokenizer", "toolchain", "upskilling", "webhook", "webhooks", "ms", "ns",
  // Names one slip from a tech name above, which aren't slips of it (G1, G6).
  "openapi", "graphiql", "mssql", "mysqli", "youtuber", "youtubers",
]

/** Other words resumes use that aren't in the dictionary (G1): Latin honors, and kinds of work. */
export const RESUME_WORDS = ["cum", "laude", "magna", "summa", "externship", "externships"]

/** Words that are right twice in a row (G2): "what it had had". */
export const FINE_TWICE = ["had", "that"]

/**
 * Harper's rules behind each of our rules, by Harper's names for them. Any
 * other rule Harper has falls under G7, unless it's turned off below.
 */
export const GRAMMAR_RULES = {
  /** G1: words that aren't in the dictionary, or two words run together. */
  typos: ["SpellCheck", "SplitWords"],
  /** G2: "the the". */
  repeated: ["RepeatedWords"],
  /** G3: "a API", "an user". */
  aAn: ["AnA"],
  /** G4: its/it's, their/there, then/than, lose/loose. */
  mixUps: ["ItsContraction", "ItsPossessive", "TheirToThere", "TheirToTheyre", "ThereToTheir", "TheyreToTheir", "ThenThan", "ToLoseTooLoose"],
}

/**
 * Harper rules that are wrong for resumes, so they're off: "roadmap" isn't
 * "road map", "ms" doesn't need spelling out, and tech names' capitals are
 * G6's.
 */
export const GRAMMAR_RULES_OFF = ["RoadMap", "CompoundNouns", "ExpandTimeShorthands", "ExpandMemoryShorthands", "OrthographicConsistency"]

/**
 * Kinds of Harper findings that are about style rather than mistakes, which
 * G7 leaves out. Resumes are written in fragments, so long "sentences" and
 * missing commas aren't mistakes there; capitals are P5's and G6's.
 */
export const GRAMMAR_KINDS_OFF = ["Readability", "Style", "Enhancement", "Formatting", "Punctuation", "Regionalism", "Capitalization", "Redundancy"]

/**
 * "loose" where "lose" is meant (G4), which Harper doesn't catch on its own:
 * "never loose data". Harper finds "to loose" itself.
 */
export const LOOSE_FOR_LOSE = /\b(?:not|never|will|would|could|can|might|don't|didn't|won't|wouldn't|can't|couldn't)\s+(loose)\b/gi

/**
 * Words that start what was led, after "lead" as a verb (G5): "and lead the
 * migration", "and lead 4 engineers", "and lead weekly reviews". Without one,
 * "lead" may be the metal or a sales lead ("arsenic and lead", "conversion
 * and lead quality").
 */
export const LEAD_OBJECTS = [
  "the", "a", "an", "my", "our", "their", "his", "her", "its", "this", "that", "these", "those", "two", "three",
  "four", "five", "six", "seven", "eight", "nine", "ten", "twelve", "twenty", "dozens", "several", "multiple", "many",
  "all", "both", "each", "every", "daily", "weekly", "biweekly", "monthly", "quarterly", "annual", "yearly",
  "new", "key", "cross-functional", "company-wide", "global", "remote", "senior", "junior",
]

/** Tech names this long or longer are checked for slips ("TypeScirpt"): shorter ones are too close to other words ("CSS" and "CSV"). */
export const MIN_TECH_SLIP = 6

/**
 * Minimum length for recovering a known misspelling written in all capitals
 * ("RECIEVED"), so short unfamiliar acronyms stay exempt.
 */
export const MIN_SKILL_SLIP = 6

export const BULLET_INTRO_ADVERBS = ["successfully", "independently", "jointly", "collaboratively", "consistently", "proactively"]
export const BULLET_SCOPE_NOUNS = [
  "users", "customers", "clients", "patients", "students", "engineers", "employees", "volunteers", "teams", "partners",
  "locations", "sites", "branches", "countries", "departments", "records", "requests", "transactions", "orders", "applications",
  "attendees", "participants", "people", "members", "reports", "tools", "tasks", "tests", "services", "servers", "devices",
  "files", "documents", "events", "projects",
]
export const BULLET_GENERIC_WORDS = [
  "a", "an", "the", "and", "or", "for", "of", "on", "in", "to", "with", "by", "at", "from", "our", "their", "my", "some",
  "various", "several", "multiple", "many", "different", "new", "useful", "important", "daily", "weekly", "monthly", "other",
  "related", "assigned", "work", "task", "tasks", "thing", "things", "stuff", "tool", "tools", "report", "reports", "process",
  "processes", "project", "projects", "system", "systems", "service", "services", "activity", "activities", "duty", "duties",
  "team", "teams", "area", "areas", "business",
  "internal", "engineering", "using", "established", "methods", "implement", "requested", "features", "complete",
]
export const WORD_ACRONYMS = ["NASA", "NATO", "NAFTA", "NOAA", "UNESCO", "UNICEF", "ASCII", "SCUBA", "RADAR", "LASER", "AIDS", "OPEC"]
/** Repeated names stay names when written in capitals too. */
export const REPEATED_NAMES = ["bora bora", "walla walla", "pago pago", "baden baden", "duran duran"]
/** Clear spelling slips used by G1; dictionary similarity alone is only advice. */
export const COMMON_MISSPELLINGS: Readonly<Record<string, string>> = {
  recieved: "received", recieve: "receive", recieves: "receives", recieving: "receiving",
  acheived: "achieved", acheive: "achieve", acheiving: "achieving",
  controled: "controlled", identifys: "identifies", simplifys: "simplifies", verifys: "verifies",
  langauges: "languages", comunication: "communication", teamwrok: "teamwork", marketting: "marketing",
  adaptibility: "adaptability", programing: "programming", finace: "finance", writng: "writing", excell: "excel",
  childrn: "children", prototypd: "prototyped", occuring: "occurring", begining: "beginning",
  transfered: "transferred", comitted: "committed", managment: "management", experiance: "experience",
  developement: "development", enviroment: "environment", seperated: "separated", seperately: "separately",
  maintainance: "maintenance", succesful: "successful", sucessful: "successful", responsibilites: "responsibilities",
}
export const VARIABLE_ACRONYMS = ["SQL", "FAQ"]
export const AMBIGUOUS_TECH_NAMES = ["Java", "Python"]
export const LOOSE_VERB_OBJECTS = ["arrow", "arrows", "bolt", "bolts", "hounds", "dogs", "bonds", "ties", "grip", "restraints", "prisoners"]
export const LOST_OBJECTS = ["data", "work", "file", "files", "access", "time", "money", "customer", "customers", "revenue", "business", "sale", "sales", "job", "jobs", "record", "records", "progress"]
