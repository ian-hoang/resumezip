import { readdirSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { render, samples } from "@/lib/import/testRender"
import { pageCount } from "@/lib/tune"
import {
  newTemplate,
  TEMPLATES,
  templateById,
  templateBySlug,
  templateImageAlt,
  templateMatches,
  templatePath,
  templateSlug,
} from "./templates"

const DAY_MS = 24 * 60 * 60 * 1000
const names = (search: string) => TEMPLATES.filter((template) => templateMatches(template, search)).map((template) => template.name)

describe("the templates page's search", () => {
  test("finds a template by its name, font or tags, in any case", () => {
    expect(names("harvard")).toEqual(["Harvard"])
    expect(names("GARAMOND")).toEqual(["Harvard"])
    expect(names("color")).toEqual(["Blueprint", "Ian's", "Accent"])
  })

  test("needs every word, wherever each is", () => {
    expect(names("lato blue")).toEqual([])
    expect(names("lato color")).toEqual(["Ian's"])
  })

  test("doesn't mind apostrophes, accents or hyphens", () => {
    expect(names("jakes")).toEqual(["Jake's", "Modern Jake's"])
    expect(names("Hárvard")).toEqual(["Harvard"])
    expect(names("sans serif")).toEqual(["Modern Jake's", "Blueprint", "Compact", "Ian's", "Swiss", "Accent", "Deedy"])
    expect(names("sansserif")).toEqual(names("Sans-serif"))
  })

  test("finds the starts of words, so serif isn't sans-serif", () => {
    expect(names("serif")).toEqual(["Jake's", "Harvard", "Margin", "zero2sudo"])
    expect(names("gar")).toEqual(["Harvard"])
    expect(names("arvard")).toEqual([])
  })

  test("with nothing typed, shows every template", () => {
    expect(names("")).toHaveLength(TEMPLATES.length)
    expect(names("  ")).toHaveLength(TEMPLATES.length)
  })
})

describe("the template marked new", () => {
  const added = Date.parse(templateById("zero2sudo").added)

  test("is the one added last", () => {
    expect(newTemplate(added + DAY_MS)?.id).toBe("zero2sudo")
  })

  test("isn't new for ever", () => {
    expect(newTemplate(added + 59 * DAY_MS)?.id).toBe("zero2sudo")
    expect(newTemplate(added + 60 * DAY_MS)).toBeUndefined()
  })
})

describe("each template's page", () => {
  test("is named after the template, never after an id that differs from its name", () => {
    expect(templatePath(templateById("jake"))).toBe("/templates/jakes")
    expect(templatePath(templateById("modernjack"))).toBe("/templates/modern-jakes")
    expect(templatePath(templateById("levelsfyi"))).toBe("/templates/blueprint")
    expect(templatePath(templateById("resumeworded"))).toBe("/templates/harvard")
    const ids: readonly string[] = TEMPLATES.map((template) => template.id)
    for (const template of TEMPLATES) {
      const slug = templateSlug(template)
      if (slug !== template.id) expect(ids, `${template.name}'s page`).not.toContain(slug)
    }
  })

  test("has an address of its own, in plain letters and hyphens", () => {
    const slugs = TEMPLATES.map(templateSlug)
    expect(new Set(slugs).size).toBe(TEMPLATES.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  test("leads back to its template, and an id isn't an address", () => {
    for (const template of TEMPLATES) expect(templateBySlug(templateSlug(template))).toBe(template)
    expect(templateBySlug("levelsfyi")).toBeUndefined()
  })
})

describe("each template's picture", () => {
  // Search engines go by a picture's address, and an id can be another
  // product's name: Blueprint's is levelsfyi.
  test("is named after its page, not its id", () => {
    for (const template of TEMPLATES) expect(template.image, template.name).toBe(`/previews/${templateSlug(template)}-resume-template.webp`)
  })

  test("is in public/previews, with no picture there that isn't a template's", () => {
    const files = readdirSync("public/previews").map((file) => `/previews/${file}`)
    expect(files.sort()).toEqual(TEMPLATES.map((template) => template.image).sort())
  })

  test("is of a one-page sample, as its alt text says", async () => {
    expect(templateImageAlt(templateById("levelsfyi"))).toBe("Blueprint resume template: a sample one-page resume")
    for (const sample of samples) expect(pageCount(await render(sample)), sample.selectedTemplate as string).toBe(1)
  })
})
