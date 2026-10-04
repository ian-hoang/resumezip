// Every resume template, in the order they're shown. The home page, the
// templates page, the editor's template picker and the dashboard all read
// this list, and each id needs a matching src/lib/typst/templates/<id>.typ.

export const TEMPLATES = [
  { id: "jake", name: "Jake's", image: "/jakeresume.webp" },
  { id: "modernjack", name: "Modern", image: "/modernjack.webp" },
  { id: "levelsfyi", name: "levels.fyi", image: "/levelsfyi.webp" },
  { id: "referme", name: "refer.me", image: "/referme.webp" },
] as const

export type Template = (typeof TEMPLATES)[number]
export type TemplateId = Template["id"]

export const DEFAULT_TEMPLATE: TemplateId = "jake"

/** The template with this id, falling back to the default. */
export function templateById(id: unknown): Template {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]
}
