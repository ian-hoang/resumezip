// The editor's list sections. Each is an array of entries stored on the resume
// under `dataKey`; field keys are what the PDF templates read (see
// lib/typst/resumeData.ts), so don't rename them.

export type SectionName = "Education" | "Work" | "Skills" | "Projects" | "Publications" | "Volunteership" | "Leadership" | "Awards"

export interface FieldDef {
  key: string
  label: string
  placeholder: string
  /** Width in a 4-column row: sm = 1, md = 2, lg = 3, full = 4. */
  size: "sm" | "md" | "lg" | "full"
  /** "bullets" is a textarea with one bullet per line. */
  type?: "text" | "bullets"
}

/** A choice that applies to the whole section, stored on the resume under `key`. */
export interface ChoiceDef {
  key: string
  label: string
  /** The first option is the default. */
  options: { value: string; label: string; hint: string }[]
}

export interface SectionDef {
  name: SectionName
  /** Shown in the editor; the resume uses the user's heading or the template's default. */
  title: string
  dataKey: string
  headingKey: string
  addLabel: string
  fields: FieldDef[]
  /** Fields shown, in order, when an entry is collapsed. */
  summary: string[]
  choice?: ChoiceDef
}

/** The profile's fields, stored on the resume under `profileSection`. */
export const PROFILE_FIELDS: (FieldDef & { inputType?: string })[] = [
  { key: "fullName", label: "Full name", placeholder: "Jake Ryan", size: "full" },
  { key: "email", label: "Email", placeholder: "jake@example.com", size: "md", inputType: "email" },
  { key: "phoneNumber", label: "Phone", placeholder: "123-456-7890", size: "md", inputType: "tel" },
  { key: "location", label: "Location", placeholder: "Austin, TX", size: "md" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/jake", size: "md" },
  { key: "profileGithub", label: "GitHub", placeholder: "github.com/jake", size: "md" },
  { key: "personalWebsite", label: "Website", placeholder: "jake.dev", size: "md" },
]

const dates = (prefix: string): FieldDef[] => [
  { key: `${prefix}StartDate`, label: "Start", placeholder: "Jan 2024", size: "sm" },
  { key: `${prefix}EndDate`, label: "End", placeholder: "Present", size: "sm" },
]

const bullets = (key: string): FieldDef => ({
  key,
  label: "What you did · one bullet per line",
  placeholder: "Built a service that cut page load time by 30%",
  size: "full",
  type: "bullets",
})

export const SECTIONS: Record<SectionName, SectionDef> = {
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
    dataKey: "publicationsSection",
    headingKey: "publications",
    addLabel: "Add publication",
    summary: ["publicationTitle", "publicationVenue"],
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
    title: "Volunteering",
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
    title: "Awards",
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
}

export const SECTION_NAMES = Object.keys(SECTIONS) as SectionName[]

/** Tailwind classes for a field's width in the 2-column (mobile) / 4-column grid. */
export const FIELD_SPAN: Record<FieldDef["size"], string> = {
  sm: "col-span-1",
  md: "col-span-2",
  lg: "col-span-2 sm:col-span-3",
  full: "col-span-2 sm:col-span-4",
}
