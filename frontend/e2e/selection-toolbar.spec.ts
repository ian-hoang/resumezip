import { expect, test, type Locator, type Page } from "./test"
import { expectText, pageErrors, preview, previewShown, printed, saveResumes, savedResume, selectInBox } from "./helpers"

// Selecting words in a styled box shows a toolbar over them: bold, italic,
// underline and link, each also on a key (⌘B, ⌘I, ⌘U, ⌘K). A link underlines
// its words, prints them alone, clickable, and the underline can be taken off
// without the link. Text saved before underline and links reads as it did.

const LABEL = "What you did"
const RESUME = {
  id: "toolbar",
  resumeTitle: "Toolbar",
  resumeTag: "professional",
  updatedAt: "2026-10-28T12:00:00.000Z",
  selectedTemplate: "jake",
  sectionOrder: ["Work", "Skills", "Education", "Projects"],
  headings: {},
  profileSection: { fullName: "Ada Lovelace" },
  educationSection: [],
  workExperienceSection: [{ id: 1, workRole: "Engineer", companyName: "Google", workDescription: "" }],
  projectsSection: [],
  publicationsSection: [],
  skillsSection: [],
  volunteerExperienceSection: [],
  leadershipExperienceSection: [],
  awardsSection: [],
}

const saved = async (page: Page) => (await savedResume(page, RESUME.id)).workExperienceSection?.[0]?.workDescription

/**
 * Opens the resume with `bullets` in its job, saved as now or, with `before`,
 * as before underline and links, and gives their box. On a `phone`, the
 * preview is behind its own tab, and isn't waited for.
 */
async function openBox(page: Page, bullets: string, { before = false, phone = false } = {}): Promise<Locator> {
  const resume = {
    ...RESUME,
    ...(!before && { marks: 2 }),
    workExperienceSection: [{ ...RESUME.workExperienceSection[0], workDescription: bullets }],
  }
  await saveResumes(page, [resume])
  await page.goto(`/create/new/${RESUME.id}`)
  if (!phone) await previewShown(page)
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  const box = page.getByLabel(LABEL)
  await box.focus()
  return box
}

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Text style" })

/** Where `words` are in the box, on screen. */
const wordsBox = (box: Locator, words: string) =>
  box.evaluate((element, words) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = (node as Text).data.indexOf(words)
      if (at < 0) continue
      const range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, at + words.length)
      const { top, bottom, left, right } = range.getBoundingClientRect()
      return { top, bottom, left, right }
    }
    throw new Error(`"${words}" isn't in the box`)
  }, words)

test("selecting words shows the toolbar over them, and its buttons style them without taking the selection away", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, "• Shipped the dashboard on time")
  await expect(toolbar(page)).toBeHidden()
  // "dashboard", with the mouse, as a person selects it.
  const words = await wordsBox(box, "dashboard")
  await page.mouse.dblclick((words.left + words.right) / 2, (words.top + words.bottom) / 2)
  await expect(toolbar(page)).toBeVisible()
  const bar = (await toolbar(page).boundingBox())!
  // Over the words, not on them, wherever they are now.
  expect(bar.y + bar.height).toBeLessThanOrEqual((await wordsBox(box, "dashboard")).top)
  const bold = toolbar(page).getByRole("button", { name: "Bold" })
  await expect(bold).toHaveAttribute("aria-pressed", "false")
  await bold.click()
  await expect(box.getByRole("strong")).toHaveText("dashboard")
  await expect(bold).toHaveAttribute("aria-pressed", "true")
  await expect(box).toBeFocused()
  await toolbar(page).getByRole("button", { name: "Italic" }).click()
  await toolbar(page).getByRole("button", { name: "Underline" }).click()
  await expect(toolbar(page).getByRole("button", { name: "Underline" })).toHaveAttribute("aria-pressed", "true")
  await expect.poll(() => saved(page)).toBe("• Shipped the __***dashboard***__ on time")
  // Undo takes the styles off a step at a time.
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => saved(page)).toBe("• Shipped the ***dashboard*** on time")
  // Clicking elsewhere in the box puts the cursor there, and the toolbar goes.
  await page.keyboard.press("ArrowRight")
  await expect(toolbar(page)).toBeHidden()
  expect(errors).toEqual([])
})

test("⌘U underlines, and ⌘K links, words; the link is underlined, and U takes the underline off and leaves the link", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, "• Shipped the dashboard on time")
  await selectInBox(box, 14, 23)
  await page.keyboard.press("ControlOrMeta+u")
  await expect(box.locator("u")).toHaveText("dashboard")
  await page.keyboard.press("ControlOrMeta+u")
  await expect(box.locator("u")).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+k")
  const address = page.getByRole("textbox", { name: "Link address" })
  await expect(address).toBeFocused()
  await address.fill("not a link")
  await address.press("Enter")
  await expect(page.getByRole("group", { name: "Link" }).getByRole("alert")).toHaveText("Paste a web or email address.")
  await address.fill("example.com/dash")
  await address.press("Enter")
  await expect(box).toBeFocused()
  const link = box.getByRole("link", { name: "dashboard" })
  await expect(link).toHaveAttribute("href", "https://example.com/dash")
  await expect(box.locator("u")).toHaveText("dashboard")
  await expect.poll(() => saved(page)).toBe("• Shipped the [__dashboard__](https://example.com/dash) on time")
  const linkButton = toolbar(page).getByRole("button", { name: "Link" })
  await expect(linkButton).toHaveAttribute("aria-pressed", "true")

  // An ordinary underline: taking it off leaves the link.
  await toolbar(page).getByRole("button", { name: "Underline" }).click()
  await expect.poll(() => saved(page)).toBe("• Shipped the [dashboard](https://example.com/dash) on time")
  await expect(link).toHaveAttribute("href", "https://example.com/dash")

  // Words typed after a link aren't in it.
  await page.keyboard.press("ArrowRight")
  await page.keyboard.type("!")
  await expect.poll(() => saved(page)).toBe("• Shipped the [dashboard](https://example.com/dash)! on time")

  // The PDF prints the words alone, clickable.
  await expect.poll(() => printed(page)).toContain("Shipped the dashboard! on time")
  expect(await printed(page)).not.toContain("example.com")
  await expect(preview(page).locator('.react-pdf__Page__annotations a[href="https://example.com/dash"]')).toHaveCount(1)

  // With the cursor in the link, ⌘K opens it, to change or remove.
  await selectInBox(box, 17)
  await page.keyboard.press("ControlOrMeta+k")
  await expect(address).toHaveValue("example.com/dash")
  await page.getByRole("button", { name: "Remove" }).click()
  await expect(box.getByRole("link")).toHaveCount(0)
  await expect.poll(() => saved(page)).toBe("• Shipped the dashboard! on time")
  expect(errors).toEqual([])
})

test("Escape closes the link box and puts the selection back", async ({ page }) => {
  const box = await openBox(page, "• Shipped the dashboard on time")
  await selectInBox(box, 14, 23)
  await toolbar(page).getByRole("button", { name: "Link" }).click()
  const address = page.getByRole("textbox", { name: "Link address" })
  await expect(address).toBeFocused()
  await address.press("Escape")
  await expect(box).toBeFocused()
  await expect(toolbar(page)).toBeVisible()
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("dashboard")
  expect(await saved(page)).toBe("• Shipped the dashboard on time")
})

test("text saved before underline and links reads as it did, and is saved so it stays that way", async ({ page }) => {
  const box = await openBox(page, "• Wrote __init__ and **Rust** code\n• Cited in [1](2)", { before: true })
  await expectText(box, "• Wrote __init__ and Rust code\n• Cited in [1](2)")
  await expect(box.locator("u")).toHaveCount(0)
  await expect(box.getByRole("link")).toHaveCount(0)
  await expect.poll(() => printed(page)).toContain("Wrote __init__ and Rust code")
  expect(await printed(page)).toContain("Cited in [1](2)")
  // Typing in it saves it, escaped, with the marks it has.
  await selectInBox(box, 48)
  await page.keyboard.type(".")
  await expect.poll(() => saved(page)).toBe(String.raw`• Wrote \_\_init\_\_ and **Rust** code` + "\n" + String.raw`• Cited in \[1\](2).`)
  expect((await savedResume(page, RESUME.id)).marks).toBe(2)
  // Typed as words, they stay words.
  await page.keyboard.type(" __x__ [a](https://b.co)")
  await expectText(box, "• Wrote __init__ and Rust code\n• Cited in [1](2). __x__ [a](https://b.co)")
  await expect(box.locator("u")).toHaveCount(0)
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the toolbar shows clear of the words selected and inside the screen, and its buttons work", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Checked in Chromium, whose touch emulation gives the page a phone's coarse pointer")
    const errors = pageErrors(page)
    const box = await openBox(page, "• Shipped the dashboard on time", { phone: true })
    await selectInBox(box, 14, 23)
    await expect(toolbar(page)).toBeVisible()
    const words = await wordsBox(box, "dashboard")
    const bar = (await toolbar(page).boundingBox())!
    // Below them where there's room, clear of the phone's own menu over them; here the pinned Edit / Preview bar is below them.
    expect(bar.y >= words.bottom || bar.y + bar.height <= words.top).toBe(true)
    expect(bar.x).toBeGreaterThanOrEqual(0)
    expect(bar.x + bar.width).toBeLessThanOrEqual(390)
    await toolbar(page).getByRole("button", { name: "Bold" }).tap()
    await expect(box.getByRole("strong")).toHaveText("dashboard")
    await expect.poll(() => saved(page)).toBe("• Shipped the **dashboard** on time")
    // Let the preview finish, so the compiler's download isn't cut off as the page closes. The
    // Edit / Preview switch steps aside while the keyboard is up, so the box is left first.
    await box.blur()
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Preview" }).tap()
    await previewShown(page)
    expect(errors).toEqual([])
  })
})
