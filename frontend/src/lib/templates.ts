// Every resume template, in the order they're shown. The home page, the
// templates page, the editor's template picker and the dashboard all read
// this list, and each id needs a matching src/lib/typst/templates/<id>.typ
// and a picture of its first page in public/previews/<id>.webp, made from
// the sample resume in src/lib/typst/preview-samples/<id>.json.

export const TEMPLATES = [
  { id: "jake", name: "Jake's", image: "/previews/jake.webp" },
  { id: "modernjack", name: "Modern", image: "/previews/modernjack.webp" },
  { id: "levelsfyi", name: "levels.fyi", image: "/previews/levelsfyi.webp" },
  { id: "referme", name: "refer.me", image: "/previews/referme.webp" },
] as const

export type Template = (typeof TEMPLATES)[number]
export type TemplateId = Template["id"]

export const DEFAULT_TEMPLATE: TemplateId = "jake"

/** The template with this id, falling back to the default. */
export function templateById(id: unknown): Template {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]
}
