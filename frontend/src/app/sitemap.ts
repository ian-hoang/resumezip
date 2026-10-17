import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { TEMPLATES, templatePath } from "@/lib/templates"

const url = (path: string) => new URL(path, SITE_URL).href

// The pages people search for, with each template's own, which lists its
// picture for image search. The editor, the dashboard and the Google Drive
// sign-in page say noindex instead.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...["/", "/templates"].map((path) => ({ url: url(path) })),
    ...TEMPLATES.map((template) => ({ url: url(templatePath(template)), images: [url(template.image)] })),
    ...["/templates/how-they-read", "/terms"].map((path) => ({ url: url(path) })),
  ]
}
