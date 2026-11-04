import type { MetadataRoute } from "next"
import { PROMISES } from "@/lib/promises"
import { SITE_URL } from "@/lib/site"
import { TEMPLATES, templatePath } from "@/lib/templates"

const url = (path: string) => new URL(path, SITE_URL).href

// The pages people search for: each template's own, which lists its picture
// for image search, and one for each thing resumezip promises among them. The
// editor, the dashboard and the Google Drive sign-in page say noindex instead.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...["/", "/templates", "/review"].map((path) => ({ url: url(path) })),
    ...TEMPLATES.map((template) => ({ url: url(templatePath(template)), images: [url(template.image)] })),
    ...[...PROMISES.map((promise) => promise.path), "/terms", "/contact"].map((path) => ({ url: url(path) })),
  ]
}
