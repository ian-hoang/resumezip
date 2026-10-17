import { type APIRequestContext, expect, test } from "./test"
import { TEMPLATES, templateImageAlt, templatePath } from "../src/lib/templates"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

const PAGES = [
  "/",
  "/templates",
  "/templates/jakes",
  "/templates/how-they-read",
  "/about",
  "/terms",
  "/create/dashboard",
  "/does-not-exist",
]

test("contact, on the about page, gives the support address to write to or copy", async ({ page, context, browserName }) => {
  // Contact is part of About now; its old address still leads to it.
  await page.goto("/contact")
  await expect(page).toHaveURL(/\/about#contact$/)
  const email = page.getByRole("link", { name: "hello@tryresumezip.com", exact: true })
  await expect(email).toHaveAttribute("href", "mailto:hello@tryresumezip.com")

  // Copied for those who write from a webmail, where the link opens nothing.
  test.skip(browserName !== "chromium", "Reading the clipboard back needs Chromium's permission")
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.getByRole("button", { name: "Copy email" }).click()
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("hello@tryresumezip.com")
})

// The blue Email bubble follows the pointer over the address, so at its right end it reaches over
// Copy email, and has to show above it there rather than under it.
test("the Email bubble shows above Copy email where they meet", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/about#contact")
  const email = page.getByRole("link", { name: "hello@tryresumezip.com", exact: true })
  const copy = page.getByRole("button", { name: "Copy email" })
  // Hovered at its right end, once the page has stopped scrolling to it.
  const { width, height } = (await email.boundingBox())!
  await email.hover({ position: { x: width - 6, y: height / 2 } })
  const bubble = email.getByText("Email", { exact: true })
  await expect(bubble).toHaveCSS("opacity", "1")
  const meet = (await copy.boundingBox())!
  // The bubble lets clicks through to the address; made to take them for a moment, the
  // browser says which is on top where it overlaps Copy email.
  const top = await bubble.evaluate((element, x) => {
    const bubble = element as HTMLElement
    bubble.style.pointerEvents = "auto"
    const shown = bubble.getBoundingClientRect()
    const hit = document.elementFromPoint(x, shown.top + shown.height / 2)
    bubble.style.pointerEvents = ""
    return hit === bubble || bubble.contains(hit)
  }, meet.x + 4)
  expect(top).toBe(true)
})

// Google's sign-in, for Save to Google Drive, links to the privacy policy this way.
test("/terms#privacy opens the privacy policy, and a tab's address opens it from the page too", async ({ page }) => {
  await page.goto("/terms#privacy")
  await expect(page.getByRole("tab", { name: "Privacy policy" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("tabpanel", { name: "Privacy policy" })).toContainText("save a PDF to your own Google Drive when you ask")

  await page.evaluate(() => (window.location.hash = "faq"))
  await expect(page.getByRole("tab", { name: "FAQ" })).toHaveAttribute("aria-selected", "true")
})

test("the pages that are mostly words are on the sheet the templates are on", async ({ page }) => {
  // The rounded corners of the page's main part, and of the frame round it.
  const sheet = async (path: string) => {
    await page.goto(path)
    return page
      .getByRole("main")
      .evaluate((main) => [getComputedStyle(main).borderRadius, getComputedStyle(main.parentElement!).borderRadius])
  }
  const templates = await sheet("/templates")
  for (const path of ["/terms", "/templates/how-they-read", "/does-not-exist"]) expect(await sheet(path), path).toEqual(templates)
})

// What a search engine reads: the HTML as served, before any script runs. The
// same in every browser, so it's read once.
test.describe("search engines", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Reads the served HTML, which doesn't depend on the browser")

  const head = async (request: APIRequestContext, path: string) => {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    return (await response.text()).split("</head>")[0]
  }
  const meta = (html: string, name: string) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1]
  const property = (html: string, name: string) => html.match(new RegExp(`<meta property="${name}" content="([^"]*)"`))?.[1]
  const sitemapUrls = async (request: APIRequestContext) =>
    [...(await (await request.get("/sitemap.xml")).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)
  // "https://…com" and "https://…com/" are the same address.
  const address = (url: string | undefined) => url && new URL(url).href

  test("find every page in the sitemap, each with its own description", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://www.tryresumezip.com/sitemap.xml")
    const paths = (await sitemapUrls(request)).map((url) => new URL(url).pathname)
    expect(paths).toEqual(expect.arrayContaining(["/", "/templates", "/about", "/terms"]))

    const descriptions = new Map<string, string>()
    for (const path of paths) {
      const html = await head(request, path)
      expect(meta(html, "robots"), path).toBeUndefined()
      const description = meta(html, "description")
      expect(description, path).toBeTruthy()
      expect(descriptions.get(description!), `${path} has the same description as`).toBeUndefined()
      descriptions.set(description!, path)
    }
  })

  // A page that sets no Open Graph data gets its parent's, which would give
  // every shared link the home page's title and address.
  test("list each page under its own address, and preview a link to it with its own title", async ({ request }) => {
    for (const url of await sitemapUrls(request)) {
      const path = new URL(url).pathname
      const html = await head(request, path)
      expect(address(html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]), `${path}'s canonical address`).toBe(url)
      expect(address(property(html, "og:url")), `${path}'s preview address`).toBe(url)
      expect(property(html, "og:title"), path).toBe(html.match(/<title>([^<]*)<\/title>/)?.[1])
      expect(property(html, "og:description"), path).toBe(meta(html, "description"))
    }
  })

  // Its own card for a template's page, drawn from its picture when the site
  // is built; the site's for the rest. Next leaves out a page's
  // opengraph-image when its metadata names a picture, so each is checked here.
  test("preview a link to a template's page with that template, and the rest with the site's picture", async ({ request }) => {
    const cards = new Map(TEMPLATES.map((template) => [templatePath(template), template]))
    for (const url of await sitemapUrls(request)) {
      const path = new URL(url).pathname
      const html = await head(request, path)
      const template = cards.get(path)
      const picture = new URL(property(html, "og:image")!)
      expect(picture.pathname, path).toBe(template ? `${path}/opengraph-image` : "/og.png")
      // React writes the apostrophe in "Jake's" as &#x27;.
      if (template) expect(property(html, "og:image:alt")?.replace(/&#x27;/g, "'"), path).toBe(templateImageAlt(template))
      expect([property(html, "og:image:width"), property(html, "og:image:height")], path).toEqual(["1200", "630"])
      const response = await request.get(picture.pathname)
      expect(response.ok(), `${path}'s picture`).toBe(true)
      expect(response.headers()["content-type"], `${path}'s picture`).toBe("image/png")
    }
  })

  test("are sent from the old contact address to About for good", async ({ request }) => {
    const response = await request.get("/contact", { maxRedirects: 0 })
    expect(response.status()).toBe(308)
    expect(response.headers().location).toBe("/about#contact")
  })

  // Named by id, before they were named after their pages. A template added
  // since had no picture under its id.
  test("are sent from a template picture's old address to its new one for good", async ({ request }) => {
    for (const template of TEMPLATES.filter(({ added }) => added <= "2026-10-12")) {
      const response = await request.get(`/previews/${template.id}.webp`, { maxRedirects: 0 })
      expect(response.status(), template.name).toBe(308)
      expect(response.headers().location, template.name).toBe(template.image)
    }
  })

  test("are asked to leave the dashboard and the editor out", async ({ request }) => {
    for (const path of ["/create/dashboard", "/create/new/a-resume"]) {
      expect(meta(await head(request, path), "robots"), path).toBe("noindex")
    }
  })

  const structuredData = async (request: APIRequestContext, path: string) =>
    [...(await (await request.get(path)).text()).matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(([, json]) =>
      JSON.parse(json),
    )

  test("read on the home page who makes resumezip, and that it's a free web app", async ({ request }) => {
    const [data] = await structuredData(request, "/")
    type Item = {
      "@type": string
      name: string
      alternateName?: string[]
      sameAs?: string[]
      logo?: { url: string }
      offers?: { price: string }
    }
    const item = (type: string) => (data["@graph"] as Item[]).find((item) => item["@type"] === type)
    expect(item("WebSite")?.name).toBe("resumezip")
    expect(item("WebSite")?.alternateName).toContain("tryresumezip.com")
    expect(item("Organization")?.sameAs).toContain("https://github.com/ian-hoang/resumezip")
    // The logo's address is on the live site, which serves the same file as this build.
    const logo = await request.get(new URL(item("Organization")!.logo!.url).pathname)
    expect(logo.headers()["content-type"]).toBe("image/png")
    expect(item("WebApplication")?.offers?.price).toBe("0")
  })

  test("read where each page under Templates sits, from the home page down to it", async ({ request }) => {
    const urls = await sitemapUrls(request)
    const under = urls.filter((url) => new URL(url).pathname.startsWith("/templates"))
    expect(under).toContain("https://www.tryresumezip.com/templates/jakes")
    for (const url of under) {
      const path = new URL(url).pathname
      const crumbs = (await structuredData(request, path)).find((data) => data["@type"] === "BreadcrumbList")
      const trail: string[] = crumbs?.itemListElement.map((crumb: { item: string }) => crumb.item) ?? []
      expect(trail[0], path).toBe("https://www.tryresumezip.com/")
      expect(trail.at(-1), path).toBe(url)
      for (const crumb of trail) expect(urls, `${path}'s breadcrumbs`).toContain(crumb)
    }
  })
})

for (const path of PAGES) {
  test(`${path} loads without errors and passes accessibility checks`, async ({ page }) => {
    const errors = pageErrors(page)
    await page.goto(path)
    // The home page's looping video can keep streaming in Safari. Readiness
    // for this layout/accessibility check is visible content with fonts loaded.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))

    expect(await seriousAccessibilityProblems(page)).toEqual([])
    // The 404 page's own "not found" response is expected, and browsers log it.
    // Only that exact message for this page is let through.
    const ownNotFound = (error: string) =>
      path === "/does-not-exist" &&
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\) \(at http:\/\/[^/]+\/does-not-exist\)$/.test(error)
    expect(errors.filter((error) => !ownNotFound(error))).toEqual([])
  })
}
