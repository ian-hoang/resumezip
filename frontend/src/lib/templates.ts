// Every resume template, in the order they're shown. The home page, the
// templates page, the editor's template picker and the dashboard all read
// this list, and each id needs a matching src/lib/typst/templates/<id>.typ
// and a picture of its first page in public/previews/<id>.webp, made from
// the sample resume in src/lib/typst/preview-samples/<id>.json. `font` is
// the family its text is set in, which is downloaded before its first PDF.
// `added` is the day it reached the site (the first four were there by
// 2025-04-20), which marks the newest as new for a while: see newTemplate.
// `tags` are what the templates page filters by, and must be true of the
// template's .typ file.

/** What the templates page filters by. A tag that fits every template, or none, filters nothing, so isn't one. */
// prettier-ignore
export const TEMPLATE_TAGS = [
  "Serif",          // Computer Modern, Garamond
  "Sans-serif",     // Lato, Heros
  "Color headings", // headings printed in blue
  "Fits a lot",     // 10pt text or smaller, on margins of half an inch or less
  "LaTeX look",     // set in Computer Modern, as LaTeX prints
  "Students",       // a format career offices give students
] as const

export type TemplateTag = (typeof TEMPLATE_TAGS)[number]

interface TemplateInfo {
  id: string
  name: string
  image: string
  font: string
  /** YYYY-MM-DD. */
  added: string
  tags: readonly TemplateTag[]
}

export const TEMPLATES = [
  {
    id: "jake",
    name: "Jake's",
    image: "/previews/jake.webp",
    font: "New Computer Modern",
    added: "2025-04-20",
    tags: ["Serif", "LaTeX look"],
  },
  {
    id: "modernjack",
    name: "Modern Jake's",
    image: "/previews/modernjack.webp",
    font: "Lato",
    added: "2025-04-20",
    tags: ["Sans-serif"],
  },
  {
    id: "levelsfyi",
    name: "Blueprint",
    image: "/previews/levelsfyi.webp",
    font: "TeX Gyre Heros",
    added: "2025-04-20",
    tags: ["Sans-serif", "Color headings", "Fits a lot"],
  },
  {
    id: "referme",
    name: "Compact",
    image: "/previews/referme.webp",
    font: "TeX Gyre Heros",
    added: "2025-04-20",
    tags: ["Sans-serif", "Fits a lot"],
  },
  {
    id: "ian",
    name: "Ian's",
    image: "/previews/ian.webp",
    font: "Lato",
    added: "2026-10-05",
    tags: ["Sans-serif", "Color headings", "Fits a lot"],
  },
  {
    id: "resumeworded",
    name: "Harvard",
    image: "/previews/resumeworded.webp",
    font: "EB Garamond",
    added: "2026-10-05",
    tags: ["Serif", "Students"],
  },
] as const satisfies readonly TemplateInfo[]

export type Template = (typeof TEMPLATES)[number]
export type TemplateId = Template["id"]

export const DEFAULT_TEMPLATE: TemplateId = "jake"

/** The template with this id, falling back to the default. */
export function templateById(id: unknown): Template {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]
}

/** How long the newest template is marked as new. */
const NEW_FOR_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The template added last, while it's under NEW_FOR_DAYS old at `now` (ms
 * since 1970). Of two added the same day, the later in the list.
 */
export function newTemplate(now: number): Template | undefined {
  const newest = TEMPLATES.reduce<Template>((last, template) => (template.added >= last.added ? template : last), TEMPLATES[0])
  return now - Date.parse(newest.added) < NEW_FOR_DAYS * DAY_MS ? newest : undefined
}

// Leaves out case, accents and apostrophes, and splits words at hyphens, so
// "jakes" finds "Jake's". Sans-serif stays one word, or "serif" would find it.
const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f'’]/g, "")
    .toLowerCase()
    .replace(/sans[\s-]*serif/g, "sansserif")
    .split(/[\s-]+/)
    .filter(Boolean)

/**
 * Whether a template is one the templates page's search and tag pick out:
 * each word searched for starts a word of its name, font or tags.
 */
export function templateMatches(template: Template, search: string, tag?: TemplateTag): boolean {
  const tags: readonly TemplateTag[] = template.tags
  if (tag && !tags.includes(tag)) return false
  const own = words([template.name, template.font, ...tags].join(" "))
  return words(search).every((word) => own.some((its) => its.startsWith(word)))
}
