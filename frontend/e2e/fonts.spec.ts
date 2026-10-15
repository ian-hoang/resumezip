import { expect, test } from "./variant"

test("pages preload one file per font, with its Latin letters", async ({ page }) => {
  await page.goto("/")
  // Newsreader, Geist, Geist Mono and Outfit (app/layout.tsx). Other alphabets
  // download when a page shows a letter from them.
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(4)
})

test("a name with a letter that isn't preloaded still shows in the site's font", async ({ page }) => {
  await page.addInitScript((resume) => localStorage.setItem(`resume:${resume.id}`, JSON.stringify(resume)), {
    id: "polish",
    resumeTitle: "Łukasz Kowalski",
    resumeTag: "professional",
    updatedAt: "2026-10-06T12:00:00.000Z",
    selectedTemplate: "jake",
    profileSection: { fullName: "Łukasz Kowalski" },
  })
  await page.goto("/create/dashboard")
  await expect(page.getByRole("link", { name: "Łukasz Kowalski" })).toBeVisible()

  // Whether the page has downloaded a face of Geist, which the dashboard shows
  // names in, with "Ł" in it, rather than drawing the letter in the fallback font.
  const downloadedŁ = () =>
    page.evaluate(() =>
      [...document.fonts].some(
        (face) =>
          /^"?Geist"?$/.test(face.family) &&
          face.status === "loaded" &&
          face.unicodeRange.split(",").some((range) => {
            const [from, to = from] = range.trim().slice(2).split("-")
            return parseInt(from.replace(/\?/g, "0"), 16) <= 0x141 && 0x141 <= parseInt(to.replace(/\?/g, "f"), 16)
          }),
      ),
    )
  await expect.poll(downloadedŁ).toBe(true)
})
