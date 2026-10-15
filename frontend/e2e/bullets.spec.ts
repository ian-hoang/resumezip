import { expect, test, type Locator, type Page } from "./variant"
import { boxText, cursorInBox, pageErrors, selectInBox } from "./helpers"

// The bullets box shows bold and italic words as they print, without their
// marks, and makes every edit itself: typing, Enter (a new bullet), ⌘B and
// ⌘I, Alt+↑ and Alt+↓ (moving a line), pasting, and deleting. Words typed on
// a line with no bullet get one, and a list typed or pasted gets one bullet a
// line. Each edit is undone and redone, as typing is.

const LABEL = "What you did"
const BULLETS = "• Built the search index\n• Cut serving costs by 30%"
const RESUME = {
  id: "undo",
  resumeTitle: "Undo",
  resumeTag: "professional",
  updatedAt: "2026-10-08T12:00:00.000Z",
  selectedTemplate: "jake",
  sectionOrder: ["Work", "Skills", "Education", "Projects", "Publications", "Volunteership", "Leadership", "Awards"],
  headings: {},
  profileSection: { fullName: "Ada Lovelace" },
  educationSection: [],
  workExperienceSection: [{ id: 1, workRole: "Engineer", companyName: "Google", workDescription: BULLETS }],
  projectsSection: [],
  publicationsSection: [],
  skillsSection: [],
  volunteerExperienceSection: [],
  leadershipExperienceSection: [],
  awardsSection: [],
}

const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z")
const redo = (page: Page) => page.keyboard.press("ControlOrMeta+Shift+z")

/** The bullets as saved in this browser. */
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").workExperienceSection?.[0]?.workDescription, `resume:${RESUME.id}`)

const expectText = (box: Locator, text: string) => expect.poll(() => boxText(box)).toBe(text)

// Copying and pasting send the events the page gets for them, so the test
// doesn't depend on how each browser's clipboard works when run by Playwright.

/** Copies what's selected in the box, and gives what it put on the clipboard. */
const copy = (box: Locator) =>
  box.evaluate((element) => {
    const clipboardData = new DataTransfer()
    element.dispatchEvent(new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true }))
    return { text: clipboardData.getData("text/plain"), html: clipboardData.getData("text/html") }
  })

/** Pastes `text` at the cursor, as text copied from anywhere reaches the box. */
const paste = (box: Locator, text: string) =>
  box.evaluate((element, text) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData("text/plain", text)
    const event = new InputEvent("beforeinput", { inputType: "insertFromPaste", dataTransfer, bubbles: true, cancelable: true })
    // WebKit's InputEvent constructor drops dataTransfer, which a paste in Safari has.
    if (!event.dataTransfer) Object.defineProperty(event, "dataTransfer", { value: dataTransfer })
    element.dispatchEvent(event)
  }, text)

/** Opens the resume with `bullets` in its job, and focuses their box. */
async function openBox(page: Page, bullets: string): Promise<Locator> {
  const resume = { ...RESUME, workExperienceSection: [{ ...RESUME.workExperienceSection[0], workDescription: bullets }] }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: `resume:${RESUME.id}`, value: JSON.stringify(resume) },
  )
  await page.goto(`/create/new/${RESUME.id}`)
  // The preview first, so the PDF compiler's download isn't cut off, which Safari logs as an error.
  await expect(page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: /^Experience$/ })
    .click()
  const box = page.getByLabel(LABEL)
  await box.focus()
  return box
}

test("bold and italic words show as they print, without their marks, and are saved with them", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, "• Built the **search** index\n• Cut *serving* costs")
  await expectText(box, "• Built the search index\n• Cut serving costs")
  await expect(box.getByRole("strong")).toHaveText("search")
  await expect(box.getByRole("emphasis")).toHaveText("serving")

  // ⌘B on words selected bolds them, and again takes it off.
  await selectInBox(box, "• Built the search ".length, "• Built the search index".length)
  await page.keyboard.press("ControlOrMeta+b")
  await expect(box.getByRole("strong")).toHaveText(["search", "index"])
  await expect.poll(() => saved(page)).toBe("• Built the **search** **index**\n• Cut *serving* costs")
  await page.keyboard.press("ControlOrMeta+b")
  await expect(box.getByRole("strong")).toHaveText(["search"])

  // Typing after a bold word carries on in bold, as in a word processor.
  await selectInBox(box, "• Built the search".length)
  await page.keyboard.type("es")
  await expect(box.getByRole("strong")).toHaveText("searches")

  // ⌘I with nothing selected makes the next words typed italic, and again, plain.
  const end = "• Built the searches index\n• Cut serving costs".length
  await selectInBox(box, end)
  await page.keyboard.type(" by ")
  await page.keyboard.press("ControlOrMeta+i")
  await page.keyboard.type("half")
  await page.keyboard.press("ControlOrMeta+i")
  await expect(box.getByRole("emphasis")).toHaveText(["serving", "half"])

  // Marks typed as words turn bold or italic as they print, and what's typed after them is plain again.
  await page.keyboard.type(" in **Rust** now")
  await expect(box.getByRole("strong")).toHaveText(["searches", "Rust"])
  await expectText(box, "• Built the searches index\n• Cut serving costs by half in Rust now")
  await expect.poll(() => saved(page)).toBe("• Built the **searches** index\n• Cut *serving* costs by *half* in **Rust** now")

  // Enter in bold words leaves both halves bold.
  await selectInBox(box, "• Built the search".length)
  await page.keyboard.press("Enter")
  await expect.poll(() => saved(page)).toBe("• Built the **search**\n• **es** index\n• Cut *serving* costs by *half* in **Rust** now")
  expect(await cursorInBox(box)).toBe("• Built the search\n• ".length)

  expect(errors).toEqual([])
})

test("each of the bullets box's edits is undone and redone, as typing is", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, BULLETS)

  // Enter starts a new bullet. Undone, the bullet is whole again; redone, split again.
  const split = "• Built the search\n• index\n• Cut serving costs by 30%"
  await selectInBox(box, "• Built the search".length)
  await page.keyboard.press("Enter")
  await expectText(box, split)
  await undo(page)
  await expectText(box, BULLETS)
  await redo(page)
  await expectText(box, split)
  await undo(page)
  await expectText(box, BULLETS)

  // Bold and italic.
  const search = ["• Built the ".length, "• Built the search".length] as const
  await selectInBox(box, ...search)
  await page.keyboard.press("ControlOrMeta+b")
  await expect.poll(() => saved(page)).toBe("• Built the **search** index\n• Cut serving costs by 30%")
  await undo(page)
  await expect(box.getByRole("strong")).toHaveCount(0)
  await expect.poll(() => saved(page)).toBe(BULLETS)
  await selectInBox(box, ...search)
  await page.keyboard.press("ControlOrMeta+i")
  await expect.poll(() => saved(page)).toBe("• Built the *search* index\n• Cut serving costs by 30%")
  await undo(page)
  await expect.poll(() => saved(page)).toBe(BULLETS)

  // Moving a line.
  const moved = "• Cut serving costs by 30%\n• Built the search index"
  await selectInBox(box, 0)
  await page.keyboard.press("Alt+ArrowDown")
  await expectText(box, moved)
  await undo(page)
  await expectText(box, BULLETS)
  await redo(page)
  await expectText(box, moved)
  await undo(page)
  await expectText(box, BULLETS)

  // Typing, as in any text box: a word typed is undone in one go.
  await selectInBox(box, BULLETS.length)
  await page.keyboard.type(" again")
  await expectText(box, `${BULLETS} again`)
  await undo(page)
  await expectText(box, BULLETS)

  // Words typed on a line with no bullet get one, in the same edit.
  await selectInBox(box, 0, BULLETS.length)
  await page.keyboard.type("L")
  await expectText(box, "• L")
  await expect.poll(() => saved(page)).toBe("• L")
  // Undone, and saved that way, so the preview and the PDF follow.
  await undo(page)
  await expectText(box, BULLETS)
  await expect.poll(() => saved(page)).toBe(BULLETS)

  expect(errors).toEqual([])
})

test("Backspace at the start of a bullet joins it to the line above, and Delete at the end of a line brings the next one up", async ({
  page,
}) => {
  const errors = pageErrors(page)
  const box = await openBox(page, BULLETS)

  await selectInBox(box, "• Built the search index\n• ".length)
  await page.keyboard.press("Backspace")
  await expectText(box, "• Built the search indexCut serving costs by 30%")
  expect(await cursorInBox(box)).toBe("• Built the search index".length)
  await page.keyboard.press("Enter")
  await expectText(box, BULLETS)

  await selectInBox(box, "• Built the search index".length)
  await page.keyboard.press("Delete")
  await expectText(box, "• Built the search indexCut serving costs by 30%")
  await expect.poll(() => saved(page)).toBe("• Built the search indexCut serving costs by 30%")

  // The first line's bullet stays: every line has one.
  await selectInBox(box, 2)
  await page.keyboard.press("Backspace")
  await expectText(box, "• Built the search indexCut serving costs by 30%")

  expect(errors).toEqual([])
})

test("a list typed or pasted gets one bullet a line, and words copied from the box keep their bold and their left-out bullet", async ({
  page,
}) => {
  const errors = pageErrors(page)
  const bullets = "• Built the **search** index\n○ Fed the cat\n• Cut serving costs by 30%"
  const box = await openBox(page, bullets)

  // Copied from the box, it goes on the clipboard as it shows, and in bold for a document.
  await selectInBox(box, "• Built the ".length, "• Built the search".length)
  expect(await copy(box)).toEqual({ text: "search", html: "<strong>search</strong>" })
  const shown = "• Built the search index\n○ Fed the cat\n• Cut serving costs by 30%"
  await selectInBox(box, shown.length)
  await page.keyboard.type(" for ")
  await paste(box, "search")
  await expect(box.getByRole("strong")).toHaveText(["search", "search"])

  // A left-out bullet copied, and pasted onto a new line's bullet, stays left out.
  await selectInBox(box, "• Built the search index\n".length, "• Built the search index\n○ Fed the cat".length)
  await copy(box)
  const typed = `${shown} for search`
  await selectInBox(box, typed.length)
  await page.keyboard.press("Enter")
  await paste(box, "○ Fed the cat")
  await expectText(box, `${typed}\n○ Fed the cat`)

  // "- " typed after a bullet goes, as the bullet's there already.
  await page.keyboard.press("Enter")
  await page.keyboard.type("- Ran the tests")
  await expectText(box, `${typed}\n○ Fed the cat\n• Ran the tests`)

  // A list from Google Docs, whose sub-bullets start with "○": printed, with one bullet each.
  await page.keyboard.press("Enter")
  await paste(box, "● Led the team\n    ○ Hired two people")
  await expectText(box, `${typed}\n○ Fed the cat\n• Ran the tests\n• Led the team\n• Hired two people`)
  await expect
    .poll(() => saved(page))
    .toBe(
      "• Built the **search** index\n○ Fed the cat\n• Cut serving costs by 30% for **search**\n○ Fed the cat\n• Ran the tests\n• Led the team\n• Hired two people",
    )

  expect(errors).toEqual([])
})

test("an edit the browser makes itself, as a phone's keyboard does, is read back and saved in its style", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, "• Built the **search** index")

  // Some keyboards' edits can't be stopped, so the browser changes the words itself, then says so.
  await box.evaluate((element) => {
    const bold = element.querySelector("strong")!.firstChild as Text
    bold.data = "searches"
    getSelection()!.setBaseAndExtent(bold, 8, bold, 8)
    element.dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", data: "es", bubbles: true }))
  })
  await expect.poll(() => saved(page)).toBe("• Built the **searches** index")
  expect(await cursorInBox(box)).toBe("• Built the searches".length)
  await undo(page)
  await expect.poll(() => saved(page)).toBe("• Built the **search** index")

  expect(errors).toEqual([])
})

test("words an input method composes go in where they're typed, in the style there", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "an input method is driven through Chrome's DevTools protocol")
  const errors = pageErrors(page)
  const box = await openBox(page, "• Built the **search** index")
  await selectInBox(box, "• Built the search".length)

  const devTools = await page.context().newCDPSession(page)
  await devTools.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 })
  await devTools.send("Input.imeSetComposition", { text: "日本", selectionStart: 2, selectionEnd: 2 })
  await devTools.send("Input.insertText", { text: "日本" })
  await expect.poll(() => saved(page)).toBe("• Built the **search日本** index")
  await expectText(box, "• Built the search日本 index")
  await page.keyboard.type("!")
  await expect.poll(() => saved(page)).toBe("• Built the **search日本!** index")

  expect(errors).toEqual([])
})

test("words composed go in once, in the order Safari sends them: composing ends, then the words come", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, "")
  await box.evaluate((element) => {
    const line = element.firstElementChild!
    getSelection()!.setBaseAndExtent(line, 0, line, 0)
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    line.replaceChildren("に")
    element.dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", data: "に", isComposing: true, bubbles: true }))
    element.dispatchEvent(new CompositionEvent("compositionend", { data: "日本", bubbles: true }))
    // Safari puts the words in after composing ends, in place of what was being composed.
    element.dispatchEvent(
      new InputEvent("beforeinput", { inputType: "insertFromComposition", data: "日本", bubbles: true, cancelable: true }),
    )
    // Where it kept what was being composed: the first character of the text it composed in.
    const text = line.firstChild as Text
    text.replaceData(0, 1, "日本")
    getSelection()!.setBaseAndExtent(text, 2, text, 2)
    element.dispatchEvent(new InputEvent("input", { inputType: "insertFromComposition", data: "日本", bubbles: true }))
  })
  await expect.poll(() => saved(page)).toBe("• 日本")
  await expectText(box, "• 日本")
  expect(await cursorInBox(box)).toBe("• 日本".length)

  expect(errors).toEqual([])
})

test("words composed after ⌘B with nothing selected go in bold", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, "")
  await box.evaluate((element) => getSelection()!.setBaseAndExtent(element.firstElementChild!, 0, element.firstElementChild!, 0))
  await page.keyboard.press("ControlOrMeta+b")
  // As Chrome sends them: the words go in as they're composed, in the style of the text around them, then composing ends.
  await box.evaluate((element) => {
    const line = element.firstElementChild!
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    line.replaceChildren("日本")
    getSelection()!.setBaseAndExtent(line.firstChild!, 2, line.firstChild!, 2)
    element.dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", data: "日本", isComposing: true, bubbles: true }))
    element.dispatchEvent(new CompositionEvent("compositionend", { data: "日本", bubbles: true }))
  })
  await expect.poll(() => saved(page)).toBe("• **日本**")
  await expect(box.getByRole("strong")).toHaveText(["日本"])
  await page.keyboard.type("!")
  await expect.poll(() => saved(page)).toBe("• **日本!**")

  expect(errors).toEqual([])
})

test("typing changes a line's words where they are, so an input method or a screen reader keeps its place", async ({ page }) => {
  const errors = pageErrors(page)
  const box = await openBox(page, BULLETS)
  const words = await box.evaluateHandle((element) => element.firstElementChild!.firstChild!)
  await selectInBox(box, "• Built the search index".length)
  await page.keyboard.type("es")
  await expectText(box, "• Built the search indexes\n• Cut serving costs by 30%")
  expect(await words.evaluate((text) => [text.isConnected, text.textContent])).toEqual([true, "• Built the search indexes"])

  expect(errors).toEqual([])
})
