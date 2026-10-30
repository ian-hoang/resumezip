import { type APIResponse, expect, test } from "./test"
import nextConfig from "../next.config.js"
import { newResume, preview } from "./helpers"

// The security headers (next.config.js) come with everything the site sends:
// pages, files, and the scripts its workers start from, which take their
// policy from their own response rather than from the page's.

const NAMES = ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"]

// The home page and the dashboard, a page built for each template, the editor
// at a resume's address, the page Google's sign-in comes back to, and one
// that isn't there.
const PAGES = ["/", "/templates/jakes", "/create/dashboard", "/create/new/a-resume", "/google-drive", "/does-not-exist"]

/** What next.config.js sends with every response, by header name in lower case. */
async function securityHeaders(): Promise<Record<string, string>> {
  const everywhere = (await nextConfig.headers()).find(({ source }) => source === "/:path*")
  return Object.fromEntries((everywhere?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]))
}

async function expectSecurityHeaders(response: APIResponse, what: string) {
  const expected = await securityHeaders()
  expect(Object.keys(expected).sort(), "the headers next.config.js sends with everything").toEqual([...NAMES].sort())
  for (const name of NAMES) expect(response.headers()[name], `${name} on ${what}`).toBe(expected[name])
}

test.describe("security headers", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "The server sends the same headers to every browser")

  test("are on every page, including the editor's and one that isn't found", async ({ request }) => {
    for (const path of PAGES) await expectSecurityHeaders(await request.get(path), path)
  })

  test("are on files, alongside the time browsers keep them for", async ({ request }) => {
    await expectSecurityHeaders(await request.get("/logo.svg"), "/logo.svg")
    const meadow = await request.get("/home/meadow.webp")
    await expectSecurityHeaders(meadow, "the home page's meadow")
    expect(meadow.headers()["cache-control"]).toBe("public, max-age=86400")
  })

  test("are on the scripts the PDF engine's, pdf.js's, the grammar checker's and the resume reader's workers start from", async ({
    page,
    request,
  }) => {
    const workers = new Set<string>()
    page.on("worker", (worker) => workers.add(worker.url()))
    await newResume(page)
    await page.getByLabel("Full name").fill("Ada Lovelace")
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("button", { name: /^Experience$/ })
      .click()
    await page.getByRole("button", { name: "Add experience" }).click()
    await page.getByLabel("Company").fill("Analytical Engines")
    await page.getByLabel(/^Description/).fill("Wrote the first program")
    await expect(
      preview(page)
        .getByText(/Analytical Engines/i)
        .first(),
    ).toBeVisible()

    // Check starts the grammar checker, and the resume reader reads the preview for it.
    await page
      .getByRole("tablist", { name: /check or style$/i })
      .getByRole("tab", { name: "ATS checks" })
      .click()
    await expect.poll(() => workers.size).toBe(4)
    for (const url of workers) {
      expect(new URL(url).pathname).toMatch(/^\/_next\/static\//)
      await expectSecurityHeaders(await request.get(url), url)
    }
  })
})

// What the policy is for: a script on the site, as one in a compromised
// package update, can't send a resume to a site connect-src doesn't name.
test("the content security policy refuses to send anything to a site it doesn't name", async ({ page }) => {
  // A request the policy let through would be answered here, not sent on.
  let sent = false
  await page.route("https://example.com/**", (route) => {
    sent = true
    return route.fulfill({ body: "" })
  })
  await page.goto("/create/dashboard")
  const result = await page.evaluate(async () => {
    const refused = new Promise<string>((resolve) =>
      document.addEventListener("securitypolicyviolation", (event) => resolve(event.effectiveDirective), { once: true }),
    )
    // no-cors, so a request let through resolves rather than failing on the answer's missing CORS header.
    const fetched = await fetch("https://example.com/", { method: "POST", body: "a resume", mode: "no-cors" }).then(
      () => true,
      () => false,
    )
    return { fetched, directive: await refused }
  })
  expect(result).toEqual({ fetched: false, directive: "connect-src" })
  expect(sent).toBe(false)
})
