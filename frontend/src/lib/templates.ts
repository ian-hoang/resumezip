// Every resume template, in the order they're shown. The home page, the
// templates page, the editor's template picker and the dashboard all read
// this list, and each id needs a matching src/lib/typst/templates/<id>.typ
// and a picture of its first page in public/previews/<id>.webp, made from
// the sample resume in src/lib/typst/preview-samples/<id>.json. `font` is
// the family its text is set in, `weights` the weights of it the template
// uses when its family has more, and `alsoFonts` any other family it sets
// some words in; they're downloaded before its first PDF. `firstColumn` names
// the sections a template prints in a column of its own on the left, which
// its PDF holds before the rest; keep it in step with the template.

export const TEMPLATES = [
  { id: "jake", name: "Jake's", image: "/previews/jake.webp", font: "New Computer Modern" },
  { id: "modernjack", name: "Modern Jake's", image: "/previews/modernjack.webp", font: "Lato", weights: [400, 700] },
  { id: "levelsfyi", name: "Blueprint", image: "/previews/levelsfyi.webp", font: "TeX Gyre Heros" },
  { id: "referme", name: "Compact", image: "/previews/referme.webp", font: "TeX Gyre Heros" },
  { id: "ian", name: "Ian's", image: "/previews/ian.webp", font: "Lato", weights: [400, 700] },
  { id: "resumeworded", name: "Harvard", image: "/previews/resumeworded.webp", font: "EB Garamond" },
  { id: "margin", name: "Margin", image: "/previews/margin.webp", font: "Charis SIL" },
  { id: "swiss", name: "Swiss", image: "/previews/swiss.webp", font: "TeX Gyre Heros" },
  { id: "mono", name: "Mono", image: "/previews/mono.webp", font: "IBM Plex Mono" },
  { id: "accent", name: "Accent", image: "/previews/accent.webp", font: "Source Sans 3" },
  {
    id: "deedy",
    name: "Deedy",
    image: "/previews/deedy.webp",
    font: "Lato",
    alsoFonts: ["Raleway-v4020"],
    firstColumn: ["Education", "Skills"],
  },
] as const

export type Template = (typeof TEMPLATES)[number]
export type TemplateId = Template["id"]

export const DEFAULT_TEMPLATE: TemplateId = "jake"

/** A font family a template prints in, and the weights of it it uses when not all of them. */
export interface FontUse {
  family: string
  weights?: readonly number[]
}

/** Every font family a template prints in: its text's first. */
export const fontsOf = (template: Template): FontUse[] => [
  "weights" in template ? { family: template.font, weights: template.weights } : { family: template.font },
  ...("alsoFonts" in template ? template.alsoFonts.map((family) => ({ family })) : []),
]

/** The sections a template prints in a column on the left, before the rest. */
export const firstColumnOf = (template: Template): readonly string[] => ("firstColumn" in template ? template.firstColumn : [])

/** The template with this id, falling back to the default. */
export function templateById(id: unknown): Template {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]
}
