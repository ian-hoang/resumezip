import { expect, test, type Page } from "./test"
import { pageErrors, preview, previewShown, saveResumes } from "./helpers"

// Double-clicking a word on the preview, or selecting a few words there,
// opens the field that printed them in the form, with the same words
// selected (components/editor/previewPick.ts).

const notes = "44444444-4444-4444-8444-444444444444"
const RESUME = {
  id: "pick",
  resumeTitle: "Pick",
  resumeTag: "professional",
  updatedAt: "2026-10-28T12:00:00.000Z",
  selectedTemplate: "jake",
  sectionOrder: ["Work", `extra:${notes}`],
  headings: {},
  profileSection: { fullName: "Ada Lovelace", summary: "Builds **fast** analytical engines." },
  workExperienceSection: [
    {
      id: 1,
      workRole: "Research Engineer",
      companyName: "Babbage Works",
      workStartDate: "Jan 2024",
      workEndDate: "Present",
      workDescription: "• Wrote the first published program for the engine\n• Translated the lecture notes from Italian",
    },
    {
      id: 2,
      workRole: "Tutor",
      companyName: "Somerville House",
      workStartDate: "Mar 2021",
      workEndDate: "Dec 2023",
      workDescription: "• Taught mathematics to younger students",
    },
  ],
  extraSections: { [notes]: { kind: "text", heading: "Notes", text: "Speaks **French** and Italian." } },
}

/** Opens the resume, and below 1280px wide, where the form shows first, switches to the preview. */
async function open(page: Page, size = { width: 1440, height: 900 }) {
  await page.setViewportSize(size)
  await saveResumes(page, [RESUME])
  await page.goto(`/create/new/${RESUME.id}`)
  if (size.width < 1280) await page.getByRole("button", { name: "Preview", exact: true }).click()
  await previewShown(page)
}

/** Where `words` are on the preview, on screen: the middle of their first letter, and the end of their last. */
async function wordsOnPreview(page: Page, words: string) {
  const layer = preview(page).locator(".textLayer").filter({ hasText: words }).first()
  await expect(layer.locator(".endOfContent")).toBeAttached()
  return layer.evaluate((layer, words) => {
    const nodes: Text[] = []
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
    const at = nodes
      .map((node) => node.data)
      .join("")
      .indexOf(words)
    const point = (offset: number) => {
      for (const node of nodes) {
        if (offset < node.data.length) return { node, offset }
        offset -= node.data.length
      }
      throw new Error("past the end")
    }
    const letter = (offset: number) => {
      const { node, offset: inNode } = point(offset)
      const range = document.createRange()
      range.setStart(node, inNode)
      range.setEnd(node, inNode + 1)
      const box = range.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, right: box.right }
    }
    const end = letter(at + words.length - 1)
    return { first: letter(at), last: { x: end.right - 0.5, y: end.y } }
  }, words)
}

/** Whether the preview's text is what's under a point, not the stand-in page fading out over the first preview. */
const textAt = (page: Page, { x, y }: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".textLayer"), { x, y })

async function doubleClick(page: Page, word: string) {
  const { first, last } = await wordsOnPreview(page, word)
  const middle = { x: (first.x + last.x) / 2, y: first.y }
  await expect.poll(() => textAt(page, middle)).toBe(true)
  await page.mouse.dblclick(middle.x, middle.y)
}

async function dragOver(page: Page, words: string) {
  const { first, last } = await wordsOnPreview(page, words)
  await expect.poll(() => textAt(page, first)).toBe(true)
  await page.mouse.move(first.x - 1, first.y)
  await page.mouse.down()
  await page.mouse.move(last.x, last.y, { steps: 5 })
  await page.mouse.up()
}

/** The field with the cursor. */
const focused = (page: Page) => page.locator(":focus")

/** The words selected in the field with the cursor, or null outside the form. */
const selectedInForm = (page: Page) =>
  page.evaluate(() => {
    const field = document.activeElement
    if (!field?.closest("main")) return null
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
      return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)
    return getSelection()?.toString() ?? null
  })

test("double-clicking a word on the preview opens its field with the word selected", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page)

  // A bullet, in a section that isn't open.
  await doubleClick(page, "published")
  await expect(focused(page)).toHaveAccessibleName("What you did")
  await expect.poll(() => selectedInForm(page)).toBe("published")

  // The summary.
  await doubleClick(page, "analytical")
  await expect(focused(page)).toHaveAccessibleName("Summary")
  await expect.poll(() => selectedInForm(page)).toBe("analytical")

  // A text section, where "Italian" is printed by a bullet too.
  await doubleClick(page, "French")
  await expect(focused(page)).toHaveAccessibleName("Text")
  await expect.poll(() => selectedInForm(page)).toBe("French")

  // A title, a company, and a date of the second job, which opens.
  await doubleClick(page, "Tutor")
  await expect(focused(page)).toHaveAccessibleName("Role")
  await expect.poll(() => selectedInForm(page)).toBe("Tutor")
  await doubleClick(page, "Somerville")
  await expect(focused(page)).toHaveAccessibleName("Company")
  await expect.poll(() => selectedInForm(page)).toBe("Somerville")
  await doubleClick(page, "2021")
  await expect.poll(() => selectedInForm(page)).toBe("2021")
  await expect(focused(page)).toHaveAccessibleName("Start")

  expect(errors).toEqual([])
})

test("selecting words on the preview keeps them selected to copy, and lights them up in their field", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page)
  await dragOver(page, "lecture notes from")

  // They stay selected on the preview, and copy from there as plain text.
  await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe("lecture notes from")
  const copied = await preview(page)
    .locator(".textLayer")
    .first()
    .evaluate((layer) => {
      const clipboardData = new DataTransfer()
      layer.dispatchEvent(new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true }))
      return clipboardData.getData("text/plain")
    })
  expect(copied).toBe("lecture notes from")

  // Their field opens with them lit up, and the cursor stays out of the form.
  const lit = () =>
    page.evaluate(() => {
      const [range] = CSS.highlights.get("picked") ?? []
      const box = range?.startContainer.parentElement?.closest("[contenteditable]")
      return range ? { words: range.toString(), field: box?.getAttribute("aria-labelledby") ?? null } : null
    })
  await expect.poll(lit).toMatchObject({ words: "lecture notes from" })
  const box = page.getByRole("textbox", { name: "What you did" }).first()
  expect((await lit())?.field).toBe(await box.getAttribute("aria-labelledby"))
  await expect(box).toBeInViewport()
  expect(await selectedInForm(page)).toBeNull()

  // An input can't light up its words, so it lights up as a whole. A click anywhere puts the light out.
  await dragOver(page, "Somerville House")
  await expect(page.getByRole("textbox", { name: "Company" }).last()).toHaveAttribute("data-picked", "")
  await expect.poll(lit).toBeNull()
  await page.getByLabel("Live preview").click({ position: { x: 5, y: 5 } })
  await expect(page.locator("[data-picked]")).toHaveCount(0)

  // A single click selects nothing, so it opens nothing.
  await page.getByRole("button", { name: "Profile" }).first().click()
  const { first } = await wordsOnPreview(page, "Somerville")
  await page.mouse.click(first.x, first.y)
  await expect.poll(() => selectedInForm(page)).toBeNull()
  await expect(page.getByLabel("Full name")).toBeVisible()

  expect(errors).toEqual([])
})

test("on a phone, a word double-clicked on the preview opens the form", async ({ page }) => {
  const errors = pageErrors(page)
  await open(page, { width: 390, height: 844 })
  await doubleClick(page, "mathematics")
  await expect(preview(page)).toBeHidden()
  await expect(focused(page)).toHaveAccessibleName("What you did")
  await expect.poll(() => selectedInForm(page)).toBe("mathematics")
  expect(errors).toEqual([])
})
