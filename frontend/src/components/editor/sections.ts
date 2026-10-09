// The editor's list sections. Each is an array of entries stored on the resume
// under `dataKey`; field keys are what the PDF templates read (see
// lib/typst/resumeData.ts), so don't rename them. The resume's types
// (lib/resume.ts) are derived from the definitions here.

export type SectionName = "Education" | "Work" | "Skills" | "Projects" | "Publications" | "Volunteership" | "Leadership" | "Awards"

export interface FieldDef<Key extends string = string> {
  key: Key
  label: string
  placeholder: string
  /** Width in a 4-column row: sm = 1, md = 2, lg = 3, full = 4. */
  size: "sm" | "md" | "lg" | "full"
  /** "bullets" is a textarea with one bullet per line. */
  type?: "text" | "bullets"
}

/** A choice that applies to the whole section, stored on the resume under `key`. */
export interface ChoiceDef<Key extends string = string> {
  key: Key
  label: string
  /** The first option is the default. */
  options: readonly { value: string; label: string; hint: string }[]
}

// A section's definition, with its keys as type parameters: the definitions
// below are checked against Definition<string, ...>, and SectionDef then has
// the keys they define.
interface Definition<Field extends string, Data extends string, Heading extends string, Choice extends string> {
  name: SectionName
  /**
   * Shown in the editor, and printed as the section's heading unless the user
   * writes their own: every template's default heading is this one, so the
   * editor and the PDF never disagree (typst/headings.test.ts checks).
   */
  title: string
  dataKey: Data
  headingKey: Heading
  addLabel: string
  fields: readonly FieldDef<Field>[]
  /** Fields shown, in order, when an entry is collapsed. */
  summary: readonly Field[]
  choice?: ChoiceDef<Choice>
  /** Entries can also be added from a paper's DOI or link. */
  fromPaperLink?: boolean
  /**
   * Not on a new resume: the person adds it from Add section. Any section can
   * be deleted, and added back; a resume that has entries in it shows it
   * either way.
   */
  optional?: true
}

/**
 * A profile field: also how the browser can fill it in, whether it's a web
 * address, and whether it's a few lines of prose (a box that grows) rather than one.
 */
type ProfileFieldDef<Key extends string = string> = FieldDef<Key> & {
  inputType?: string
  autoComplete?: string
  web?: true
  multiline?: true
}

const PROFILE = [
  { key: "fullName", label: "Full name", placeholder: "Jake Ryan", size: "full", autoComplete: "name" },
  { key: "email", label: "Email", placeholder: "jake@example.com", size: "md", inputType: "email", autoComplete: "email" },
  { key: "phoneNumber", label: "Phone", placeholder: "123-456-7890", size: "md", inputType: "tel", autoComplete: "tel" },
  { key: "location", label: "Location", placeholder: "Austin, TX", size: "md" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/jake", size: "md", web: true },
  { key: "profileGithub", label: "GitHub", placeholder: "github.com/jake", size: "md", web: true },
  { key: "personalWebsite", label: "Website", placeholder: "jake.dev", size: "md", web: true },
  // Printed under its own heading, above the sections. A blank line starts a new paragraph.
  {
    key: "summary",
    label: "Summary",
    placeholder: "Software engineer who builds fast, reliable web apps.",
    size: "full",
    multiline: true,
  },
] as const satisfies readonly ProfileFieldDef[]

/** A profile field's key, like "email". */
export type ProfileKey = (typeof PROFILE)[number]["key"]

/** The profile's fields, stored on the resume under `profileSection`. */
export const PROFILE_FIELDS: readonly ProfileFieldDef<ProfileKey>[] = PROFILE

// The end's placeholder is a date: "Present" there read as what a blank end means, and a blank one prints nothing.
const dates = <Prefix extends string>(prefix: Prefix) =>
  [
    { key: `${prefix}StartDate`, label: "Start", placeholder: "Jan 2024", size: "sm" },
    { key: `${prefix}EndDate`, label: "End", placeholder: "Dec 2025", size: "sm" },
  ] as const

const bullets = <Key extends string>(key: Key) =>
  ({
    key,
    label: "What you did · one bullet per line",
    placeholder: "Built a service that cut page load time by 30%",
    size: "full",
    type: "bullets",
  }) as const

const DEFINITIONS = {
  Education: {
    name: "Education",
    title: "Education",
    dataKey: "educationSection",
    headingKey: "edu",
    addLabel: "Add education",
    summary: ["degree", "schoolName"],
    fields: [
      { key: "schoolName", label: "School", placeholder: "Stanford University", size: "md" },
      { key: "schoolLocation", label: "Location", placeholder: "Stanford, CA", size: "md" },
      { key: "degree", label: "Degree", placeholder: "B.S. in Computer Science", size: "lg" },
      { key: "gpa", label: "GPA", placeholder: "3.9 / 4.0", size: "sm" },
      { key: "schoolStartDate", label: "Start", placeholder: "Sep 2024", size: "sm" },
      { key: "schoolEndDate", label: "End", placeholder: "Jun 2028", size: "sm" },
      { key: "coursework", label: "Relevant coursework", placeholder: "Data Structures, Operating Systems", size: "full" },
      { key: "involvement", label: "Involvement", placeholder: "ACM, Google Developer Student Club", size: "full" },
    ],
  },
  Work: {
    name: "Work",
    title: "Experience",
    dataKey: "workExperienceSection",
    headingKey: "work",
    addLabel: "Add experience",
    summary: ["workRole", "companyName"],
    fields: [
      { key: "workRole", label: "Role", placeholder: "Software Engineer", size: "md" },
      { key: "companyName", label: "Company", placeholder: "Google", size: "md" },
      { key: "workLocation", label: "Location", placeholder: "Mountain View, CA", size: "md" },
      ...dates("work"),
      bullets("workDescription"),
    ],
  },
  Skills: {
    name: "Skills",
    title: "Skills",
    dataKey: "skillsSection",
    headingKey: "skills",
    addLabel: "Add skill group",
    summary: ["skillName", "skillDetails"],
    fields: [
      { key: "skillName", label: "Category", placeholder: "Languages", size: "sm" },
      { key: "skillDetails", label: "Skills", placeholder: "TypeScript, Python, Go", size: "lg" },
    ],
  },
  Projects: {
    name: "Projects",
    title: "Projects",
    dataKey: "projectsSection",
    headingKey: "projects",
    addLabel: "Add project",
    summary: ["projectName", "techStack"],
    choice: {
      key: "projectLinks",
      label: "Links",
      options: [
        { value: "show", label: "Show the link", hint: "Printed as text, like github.com/you/project. Easiest for ATS to read." },
        { value: "title", label: "Link the title", hint: "The project name links to its GitHub, or to its website if it has no GitHub." },
      ],
    },
    fields: [
      { key: "projectName", label: "Name", placeholder: "Gitlytics", size: "md" },
      { key: "projectDate", label: "Dates", placeholder: "Jun – Aug 2025", size: "md" },
      { key: "techStack", label: "Tech stack", placeholder: "Next.js, TypeScript, PostgreSQL", size: "full" },
      { key: "projectGithub", label: "GitHub", placeholder: "github.com/you/project", size: "md" },
      { key: "additionalLink", label: "Website", placeholder: "project.dev", size: "md" },
      { ...bullets("projectDescription"), label: "What it does · one bullet per line" },
    ],
  },
  Publications: {
    name: "Publications",
    title: "Publications",
    optional: true,
    dataKey: "publicationsSection",
    headingKey: "publications",
    addLabel: "Add publication",
    summary: ["publicationTitle", "publicationVenue"],
    fromPaperLink: true,
    fields: [
      { key: "publicationTitle", label: "Title", placeholder: "Sparse Attention for Long Documents", size: "full" },
      { key: "publicationAuthors", label: "Authors", placeholder: "J. Ryan, A. Smith", size: "lg" },
      { key: "publicationDate", label: "Date", placeholder: "Dec 2025", size: "sm" },
      { key: "publicationVenue", label: "Published in", placeholder: "Proc. NeurIPS", size: "md" },
      { key: "publicationDetails", label: "Details", placeholder: "Vancouver, Canada, pp. 112–120", size: "md" },
      { key: "publicationLink", label: "DOI or link", placeholder: "10.1145/1234567", size: "md" },
    ],
  },
  Volunteership: {
    name: "Volunteership",
    title: "Volunteer",
    optional: true,
    dataKey: "volunteerExperienceSection",
    headingKey: "volunteer",
    addLabel: "Add volunteering",
    summary: ["volunteerRole", "volunteerOrg"],
    fields: [
      { key: "volunteerRole", label: "Role", placeholder: "Volunteer coordinator", size: "md" },
      { key: "volunteerOrg", label: "Organization", placeholder: "Central Texas Food Bank", size: "md" },
      { key: "volunteerLocation", label: "Location", placeholder: "Austin, TX", size: "md" },
      ...dates("volunteer"),
      bullets("volunteerDescription"),
    ],
  },
  Leadership: {
    name: "Leadership",
    title: "Leadership",
    optional: true,
    dataKey: "leadershipExperienceSection",
    headingKey: "leadership",
    addLabel: "Add leadership",
    summary: ["leadershipRole", "leadershipOrg"],
    fields: [
      { key: "leadershipRole", label: "Role", placeholder: "President", size: "md" },
      { key: "leadershipOrg", label: "Organization", placeholder: "Student Council", size: "md" },
      { key: "leadershipLocation", label: "Location", placeholder: "University of Texas", size: "md" },
      ...dates("leadership"),
      bullets("leadershipDescription"),
    ],
  },
  Awards: {
    name: "Awards",
    title: "Awards & Certifications",
    optional: true,
    dataKey: "awardsSection",
    headingKey: "awards",
    addLabel: "Add award",
    summary: ["awardName", "awardOrg"],
    fields: [
      { key: "awardName", label: "Name", placeholder: "AWS Certified Solutions Architect", size: "lg" },
      { key: "awardDate", label: "Date", placeholder: "May 2023", size: "sm" },
      { key: "awardOrg", label: "Issued by", placeholder: "Amazon Web Services", size: "md" },
    ],
  },
} as const satisfies { [Name in SectionName]: Definition<string, string, string, string> & { name: Name } }

type Definitions = typeof DEFINITIONS

/** A section's field keys, like "schoolName" for Education. */
export type FieldKeyOf<Name extends SectionName> = Definitions[Name]["fields"][number]["key"]
/** A field key of any section. */
export type FieldKey = FieldKeyOf<SectionName>
/** Where a section's entries are stored on the resume, like "educationSection". */
export type DataKey = Definitions[SectionName]["dataKey"]
/** Where a section's own title is stored in the resume's headings, like "edu". */
export type HeadingKey = Definitions[SectionName]["headingKey"]
/** Where a section's choice is stored on the resume, like "projectLinks". */
export type ChoiceKey = Extract<Definitions[SectionName], { choice: unknown }>["choice"]["key"]

export type SectionDef = Definition<FieldKey, DataKey, HeadingKey, ChoiceKey>

export const SECTIONS: Record<SectionName, SectionDef> = DEFINITIONS

export const SECTION_NAMES = Object.keys(SECTIONS) as SectionName[]

/** The sections a new resume starts with, in their order; the others are added from Add section. */
export const CORE_SECTIONS = SECTION_NAMES.filter((name) => !SECTIONS[name].optional)

/**
 * Tailwind classes for a field's width in the form's grid: 2 columns, or 4
 * once the form itself is 32rem (512px) wide. It's the form's width, not the
 * window's, that counts, since the left bar and preview can take most of a
 * wide window.
 */
export const FIELD_SPAN: Record<FieldDef["size"], string> = {
  sm: "col-span-1",
  md: "col-span-2",
  lg: "col-span-2 @lg:col-span-3",
  full: "col-span-2 @lg:col-span-4",
}
