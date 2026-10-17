import { type Locator, type Page, expect, test } from "./test"
import { BEATS, STORY_LENGTH } from "../src/components/home/motion"
import { MARKS } from "../src/components/home/stage"
import { pageErrors, seriousAccessibilityProblems } from "./helpers"

// The home page is a story the scroll plays (src/components/home/HomeStory.tsx): the first screen
// on the meadow, then the editor rising out of the grass and marked by hand, one thing at a time,
// each with a note and an arrow, then the way in. Its parts are drawn as the page scrolls, so these
// scroll the way a person does.

const PHONE = { width: 390, height: 844 }

/** Each handwritten note, by its first line. */
const notes = (page: Page) => MARKS.map((mark) => page.getByText(mark.note[0], { exact: true }))
const wayIn = (page: Page) => page.getByRole("region", { name: "Your resume, on your own computer." })
const floatingStart = (page: Page) => page.getByRole("link", { name: "Start writing. It’s free." })

/** How much of it shows: the story fades its parts rather than hiding them. */
const opacity = (target: Locator) =>
  target.evaluate((element) => {
    let shown = 1
    for (let part: Element | null = element; part; part = part.parentElement) shown *= Number(getComputedStyle(part).opacity)
    return shown
  })

/**
 * Which of these notes, by their first lines, are written out whole and show: a note writes in from
 * the left, through a clip, and fades when it makes way. Run in the page.
 */
const writtenOut = (lines: Element[]) =>
  lines.flatMap((line, i) => {
    const note = line.parentElement as HTMLElement
    let shown = 1
    for (let part: Element | null = note; part; part = part.parentElement) shown *= Number(getComputedStyle(part).opacity)
    const right = Number(/inset\(-30% (-?[\d.]+)%/.exec(note.style.clipPath)?.[1] ?? 0)
    return getComputedStyle(note).visibility === "visible" && shown > 0.99 && right <= 0 ? [i] : []
  })

const noteLines = (page: Page) => Promise.all(notes(page).map(async (note) => (await note.elementHandle())!))

/** Which notes are written out and show, in order, once the story has caught up with the scroll. */
async function notesWritten(page: Page): Promise<boolean[]> {
  await page.evaluate(() => new Promise((done) => setTimeout(done, 250)))
  const written = await page.evaluate(writtenOut, await noteLines(page))
  return MARKS.map((_, i) => written.includes(i))
}

/**
 * Which of the editor's menus show open, by their pictures (HomeStory.tsx): a menu the story opens
 * is a picture of it open, laid over the editor's, and faded in and out. Run in the page.
 */
const menusOpen = () =>
  [...document.images].flatMap((image) => {
    const name = new URL(image.src).pathname.match(/\/home\/(\w+)-menu\.webp$/)?.[1]
    if (!name) return []
    let shown = 1
    for (let part: Element | null = image; part; part = part.parentElement) shown *= Number(getComputedStyle(part).opacity)
    return shown > 0.99 ? [name] : []
  })

/**
 * Scrolls down through the story `step` pixels at a time, as the wheel does at its gentlest, and
 * says at each step which notes are written out whole, and which menus are open.
 */
async function readThrough(page: Page, step: number): Promise<{ written: number[]; open: string[] }[]> {
  const steps: { written: number[]; open: string[] }[] = []
  const lines = await noteLines(page)
  const end = await page.evaluate((length) => (window.innerHeight * length) / 100, STORY_LENGTH)
  for (let y = 0; y <= end; y += step) {
    // Long enough for the story to catch up with the scroll.
    await page.evaluate(
      (y) =>
        new Promise((done) => {
          window.scrollTo({ top: y, behavior: "instant" })
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 70)))
        }),
      y,
    )
    steps.push({ written: await page.evaluate(writtenOut, lines), open: await page.evaluate(menusOpen) })
  }
  return steps
}

/**
 * Scrolls the story to `v`, in screens of scrolling times 100 (STORY_LENGTH is its end): the
 * story starts at the top of the page, a screen of it to each screen scrolled.
 */
async function playStoryTo(page: Page, v: number) {
  await expect
    .poll(async () => {
      const left = await page.evaluate((v) => (v / 100) * window.innerHeight - window.scrollY, v)
      if (left <= 0) return true
      // No further than it's going: a whole step past the story's end would scroll the stage away.
      await page.mouse.wheel(0, Math.min(400, Math.max(40, left + 2)))
      return false
    })
    .toBe(true)
}

test("the first screen says what resumezip is, with Start writing and the templates", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("resumezip")
  await expect(page.getByText("A free, open-source resume builder that runs in your browser")).toBeVisible()
  await expect(page.getByRole("link", { name: "Start writing" }).first()).toHaveAttribute("href", "/create/dashboard")
  await expect(page.getByRole("link", { name: "See templates" })).toHaveAttribute("href", "/templates")
  await expect(page.getByRole("link", { name: /Microsoft for Startups/ })).toBeVisible()
  // Nothing is marked yet.
  expect(await notesWritten(page)).toEqual(MARKS.map(() => false))
  expect(errors).toEqual([])
})

// The notes are handwriting, a picture; a screen reader is told what they say.
test("a screen reader is told what the notes on the editor say", async ({ page }) => {
  await page.goto("/")
  const said = page.getByRole("region", { name: "What it does" }).getByRole("listitem")
  await expect(said).toHaveText(MARKS.map((mark) => mark.said))
})

for (const [screen, size] of [
  ["a wide screen", { width: 1440, height: 900 }],
  ["a phone", PHONE],
] as const) {
  test(`on ${screen} the editor is marked left to right, a note at a time, each written out for a while`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto("/")
    const steps = (await readThrough(page, 30)).map(({ written }) => written)
    // Never more than one at once, and each in its turn.
    for (const written of steps) expect(written.length).toBeLessThanOrEqual(1)
    const order = steps.flat().filter((note, i, all) => note !== all[i - 1])
    expect(order).toEqual(MARKS.map((_, i) => i))
    // Each is written out whole for a while: over a fifth of a screen of scrolling.
    for (const [i] of MARKS.entries()) expect(steps.filter((written) => written[0] === i).length * 30).toBeGreaterThan(size.height / 5)
  })
}

// The template picker and the download menu are clicked open for their notes, as the story comes
// to them: one at a time, the gallery shut before the downloads open, each open while its note is.
test("the template gallery, then the download menu, open as their notes are written", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const steps = await readThrough(page, 30)
  for (const { open } of steps) expect(open.length).toBeLessThanOrEqual(1)
  const opened = steps.flatMap(({ open }) => open).filter((menu, i, all) => menu !== all[i - 1])
  expect(opened).toEqual(["templates", "download"])
  const templates = MARKS.findIndex((mark) => mark.menu?.open.src.includes("templates"))
  const download = MARKS.findIndex((mark) => mark.menu?.open.src.includes("download"))
  for (const { written, open } of steps) {
    if (written[0] === templates) expect(open).toEqual(["templates"])
    if (written[0] === download) expect(open).toEqual(["download"])
  }
})

test("on a wide screen each note is over what it's about, left to right across the editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.mouse.move(400, 400)
  await playStoryTo(page, STORY_LENGTH - 50)
  // Where each note was written, shown or not: they make way for one another.
  const at = (line: string) =>
    page.getByText(line, { exact: true }).evaluate((element) => {
      const box = element.getBoundingClientRect()
      return { middle: box.x + box.width / 2, y: box.y }
    })
  const notes = await Promise.all(MARKS.map((mark) => at(mark.note[0])))
  expect(notes.map(({ middle }) => middle)).toEqual(notes.map(({ middle }) => middle).sort((a, b) => a - b))
  // All in a row over the editor, a little tilted each way as they're written.
  for (const { y } of notes) expect(Math.abs(y - notes[0].y)).toBeLessThan(12)
})

test("the story ends on the way in, with Start writing and the address to write to", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/")
  await page.mouse.move(400, 400)
  await playStoryTo(page, STORY_LENGTH)
  const start = wayIn(page).getByRole("link", { name: "Start writing" })
  // It only takes a click once it has arrived.
  await start.click({ trial: true })
  await expect(start).toHaveAttribute("href", "/create/dashboard")
  await expect(wayIn(page).getByRole("link", { name: "hello@tryresumezip.com", exact: true })).toBeInViewport()
  expect(errors).toEqual([])
})

// The footer's Contact, and the old About page and its contact address, land here: the story's last
// screen, where the way in has the address to write to.
for (const from of ["/#contact", "/about#contact"]) {
  test(`${from} lands on the story's last screen, with the address and Start writing`, async ({ page }) => {
    await page.goto(from)
    await expect(page).toHaveURL(/\/#contact$/)
    // The story is all the main part holds, so on its last screen their foot is the window's. Checked
    // before the click, which would scroll to Start writing itself if it had to.
    await expect
      .poll(() => page.getByRole("main").evaluate((main) => Math.abs(main.getBoundingClientRect().bottom - window.innerHeight)))
      .toBeLessThan(1.5)
    await wayIn(page).getByRole("link", { name: "Start writing" }).click({ trial: true })
    await expect(page.getByRole("link", { name: "hello@tryresumezip.com", exact: true })).toBeInViewport()
  })
}

test("the small Start writing shows during the story, but not over the first screen or the way in", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  // A fixed wait: proving it doesn't show over the first screen, which has its own.
  await page.waitForTimeout(500)
  await expect(floatingStart(page)).toBeHidden()

  await page.mouse.move(400, 400)
  await playStoryTo(page, BEATS.notes[1][0])
  await expect(floatingStart(page)).toBeVisible()
  await expect(floatingStart(page)).toHaveAttribute("href", "/create/dashboard")

  await playStoryTo(page, STORY_LENGTH)
  await expect(floatingStart(page)).toBeHidden()
})

// The way in is kept wholly on screen by its height. Its text can reflow after it's first placed,
// as when its fonts arrive late, and it has to stay on a short window then too.
test("Start writing stays on screen when the way in's words reflow taller", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 })
  await page.goto("/")
  await page.mouse.move(400, 300)
  const start = wayIn(page).getByRole("link", { name: "Start writing" })
  await playStoryTo(page, STORY_LENGTH - 10)
  await start.click({ trial: true })
  await expect.poll(async () => (await start.boundingBox())!.y + (await start.boundingBox())!.height).toBeLessThanOrEqual(620)

  // Half as big again as it's set at this width: taller, but still shorter than the window.
  await page.getByRole("heading", { name: "Your resume, on your own computer." }).evaluate((heading) => (heading.style.fontSize = "64px"))
  await expect.poll(async () => (await start.boundingBox())!.y + (await start.boundingBox())!.height).toBeLessThanOrEqual(620)
})

// The page ends with the story, then the footer: nothing slides over the story's last screen.
test("nothing covers Start writing as the page scrolls on past the story", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 })
  await page.goto("/")
  await page.mouse.move(400, 400)
  await playStoryTo(page, STORY_LENGTH)
  // Exactly that far past the story's end: wheel steps would overshoot, and scroll the button up
  // under the header, as scrolling on does.
  await page.evaluate((length) => window.scrollTo({ top: (length / 100) * window.innerHeight + 130, behavior: "instant" }), STORY_LENGTH)
  // What's under the middle of the button is the button: asked of the browser where the page is,
  // as a click there would land, without scrolling to find a spot that's clear.
  const start = wayIn(page).getByRole("link", { name: "Start writing" })
  await expect
    .poll(() =>
      start.evaluate((link) => {
        const box = link.getBoundingClientRect()
        return link.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
      }),
    )
    .toBe(true)
})

// The story ends on grass, and the strip over the footer carries that grass on, then darkens, with
// no line where the two meet.
for (const [screen, size] of [
  ["a wide screen", { width: 1440, height: 900 }],
  ["a phone", PHONE],
] as const) {
  test(`the story's grass runs on into the footer without a line, on ${screen}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto("/")
    await page.mouse.move(size.width / 2, 300)
    await playStoryTo(page, STORY_LENGTH)
    await page.mouse.wheel(0, 150)
    // How far the footer's picture of the grass is from the stage's, in pixels: across, down, and in width.
    const apart = () =>
      page.getByRole("contentinfo").evaluate((footer) => {
        const layers = (list: string) => {
          const out = [""]
          let depth = 0
          for (const c of list) {
            if (c === "(") depth++
            if (c === ")") depth--
            if (c === "," && depth === 0) out.push("")
            else out[out.length - 1] += c
          }
          return out.map((layer) => layer.trim())
        }
        const strip = footer.previousElementSibling!
        const style = getComputedStyle(strip)
        const at = layers(style.backgroundImage).findIndex((image) => image.includes("/home/grass.webp"))
        const box = strip.getBoundingClientRect()
        const drawn = {
          left: box.left + parseFloat(layers(style.backgroundPositionX)[at]),
          top: box.top + parseFloat(layers(style.backgroundPositionY)[at]),
          width: parseFloat(layers(style.backgroundSize)[at]),
        }
        // The stage's grass sways by skewing its picture, so it's measured by the box it stands in.
        const picture = [...document.images].find((image) => new URL(image.src).pathname === "/home/grass.webp")!
        const grass = picture.parentElement!.getBoundingClientRect()
        return [drawn.left - grass.left, drawn.top - grass.top, drawn.width - grass.width].map((gap) => Math.round(Math.abs(gap)))
      })
    await expect.poll(apart).toEqual([0, 0, 0])
  })
}

test("with less motion, the story is told still: every note and the way in, already there", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" })
  const page = await context.newPage()
  const errors = pageErrors(page)
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("resumezip")
  for (const note of notes(page)) {
    await note.scrollIntoViewIfNeeded()
    await expect(note).toBeVisible()
    expect(await opacity(note)).toBe(1)
  }
  await wayIn(page).scrollIntoViewIfNeeded()
  await expect(wayIn(page).getByRole("link", { name: "Start writing" })).toBeVisible()
  await expect(wayIn(page)).toHaveCSS("border-radius", "28px")
  expect(await seriousAccessibilityProblems(page)).toEqual([])
  expect(errors).toEqual([])
  await context.close()
})
