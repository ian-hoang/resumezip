import { expect, test, type Locator, type Page } from "./test"
import { editorHeading, newResume, pageErrors, previewShown, saveResumes, settled, transitionsDone } from "./helpers"
import { MARA } from "./resumes"

// What a click brings up fades in, rather than appearing all at once, unless
// the visitor asks for less motion.

/**
 * Records opacity transitions from before the click, then waits for the new
 * content and for everything around it to settle. A one-time snapshot can miss
 * a short fade on a busy CI worker, or run before React inserts the new
 * content or the fade has started.
 */
async function fadingIn(control: Locator, shown: Locator): Promise<string[]> {
  const page = control.page()
  await transitionsDone(page)
  const recording = await page.evaluateHandle(() => {
    const transitions: { target: Element; text: string }[] = []
    const record = (event: TransitionEvent) => {
      if (event.propertyName === "opacity" && event.target instanceof Element) {
        transitions.push({ target: event.target, text: event.target.textContent ?? "" })
      }
    }
    document.addEventListener("transitionrun", record)
    return { transitions, stop: () => document.removeEventListener("transitionrun", record) }
  })
  try {
    // Playwright's click finds the control again if it's replaced, as the
    // section buttons are once drag and drop loads. A click on an element
    // found a step before can land on a detached one, which React never hears.
    await control.click()
    await expect(shown).toBeVisible()
    await settled(shown)
    // The preview has fades of its own: only those on what opened, or on what
    // it's in, as the backdrop round a dialog, count.
    return await shown.evaluate(
      (element, { transitions }) =>
        transitions.filter(({ target }) => target.contains(element) || element.contains(target)).map(({ text }) => text),
      recording,
    )
  } finally {
    await recording.evaluate(({ stop }) => stop())
    await recording.dispose()
  }
}

/** Starts a new resume, and waits for drag and drop to load. */
async function startWriting(page: Page) {
  await newResume(page)
  // The section buttons are replaced by draggable ones once drag and drop
  // loads. fadingIn finds its button and then clicks it, so on a busy machine
  // the click could land on the old one, no longer on the page.
  await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Reorder Experience" })).toBeVisible()
}

test("a section, the ATS checks or Style, and on a narrow screen the template gallery, fade in as they're chosen", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  const sections = page.getByRole("navigation", { name: "Sections" })

  const experience = await fadingIn(sections.getByRole("button", { name: /^Experience$/ }), editorHeading(page, "Experience"))
  expect(experience.some((text) => text.includes("Add experience"))).toBe(true)
  await expect(editorHeading(page, "Experience")).toBeVisible()

  const check = await fadingIn(
    page.getByRole("tablist", { name: /check or style$/i }).getByRole("tab", { name: "ATS checks" }),
    page.getByRole("heading", { name: "ATS score" }),
  )
  expect(check.some((text) => text.includes("ATS score"))).toBe(true)
  // Choosing the checks again brings the form back.
  const write = await fadingIn(page.getByRole("tab", { name: "ATS checks" }), editorHeading(page, "Experience"))
  expect(write.some((text) => text.includes("Add experience"))).toBe(true)

  // The Style tab shows Fine-tune in the form's place.
  const style = await fadingIn(page.getByRole("tab", { name: "Style" }), page.getByRole("region", { name: "Style" }))
  expect(style.some((text) => text.includes("Fine-tune"))).toBe(true)
  await page.getByRole("tab", { name: "Style" }).click()
  await expect(page.getByRole("region", { name: "Style" })).toBeHidden()

  // Let the preview finish, so the compiler's download isn't cut off as the page closes.
  await previewShown(page)

  // Under 1024px the gallery is a dialog over a dimmed screen, which fades in with it.
  await page.setViewportSize({ width: 800, height: 900 })
  const gallery = await fadingIn(page.getByRole("button", { name: /^Template/ }), page.getByRole("dialog", { name: "Choose a template" }))
  expect(gallery.some((text) => text.includes("Templates"))).toBe(true)
  await expect(page.getByRole("dialog", { name: "Choose a template" })).toBeVisible()
  await page.keyboard.press("Escape")
  expect(errors).toEqual([])
})

test("the template gallery fades away as it closes, rather than vanishing", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  // Let the preview finish first, so the compiler's download isn't cut off as the page closes.
  await previewShown(page)
  await page.getByRole("button", { name: /^Template/ }).click()
  const gallery = page.getByRole("dialog", { name: "Choose a template" })
  await expect(gallery).toBeVisible()
  await settled(gallery)
  await transitionsDone(page)

  // From here on, whether the gallery fades: an opacity transition on it or on what holds it, or
  // its opacity times theirs part way. Looked at as the page changes as well as each frame: frames
  // came 700ms apart in WebKit on CI, and the 260ms fade fell between two of them, but as the
  // gallery starts to close, its transition is already there. Read from the page rather than
  // transition events, which WebKit doesn't always deliver.
  const seen = await page.evaluateHandle(() => {
    const seen = { fading: false }
    const look = () => {
      let opacity = 1
      for (
        let element = document.querySelector('[role="dialog"][aria-label="Choose a template"]');
        element;
        element = element.parentElement
      ) {
        opacity *= Number(getComputedStyle(element).opacity)
        if (element.getAnimations().some((animation) => "transitionProperty" in animation && animation.transitionProperty === "opacity")) {
          seen.fading = true
        }
      }
      if (opacity > 0 && opacity < 1) seen.fading = true
    }
    new MutationObserver(look).observe(document.body, { attributes: true, childList: true, subtree: true })
    const frame = () => {
      look()
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return seen
  })
  await gallery.getByRole("button", { name: "Close" }).click()
  await expect(page.getByRole("button", { name: /^Template/ })).toBeFocused()
  await expect(gallery).toBeHidden()
  // One that vanished would go from solid to gone, with nothing in between.
  expect((await seen.jsonValue()).fading).toBe(true)
  expect(errors).toEqual([])
})

/**
 * From here on, the least opacity the panel matching `selector` (times what
 * holds it) and what's in it have shown, looked at as the page changes as well
 * as each frame. Frames came 700ms apart in WebKit on CI, which starts an
 * animation's clock as it's made, so the contents' 220ms fade was over by the
 * first frame; as the panel is put on the page, they're at its start. Read
 * from their computed styles rather than animation events, which WebKit
 * doesn't always deliver.
 */
async function lowestOpacity(page: Page, selector: string) {
  const lowest = await page.evaluateHandle((selector) => {
    const seen = { panel: 1, contents: 1 }
    const look = () => {
      const panel = document.querySelector(selector)
      if (!panel) return
      let opacity = 1
      for (let element: Element | null = panel; element; element = element.parentElement)
        opacity *= Number(getComputedStyle(element).opacity)
      seen.panel = Math.min(seen.panel, opacity)
      for (const child of panel.children) seen.contents = Math.min(seen.contents, Number(getComputedStyle(child).opacity))
    }
    new MutationObserver(look).observe(document.body, { childList: true, subtree: true })
    const frame = () => {
      look()
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return seen
  }, selector)
  return () => lowest.jsonValue()
}

test("the Add section menu grows in solid, and only what's in it fades in", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  await transitionsDone(page)
  const lowest = await lowestOpacity(page, '[role="menu"][aria-label="Add section"]')

  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Add section", exact: true }).click()
  const menu = page.getByRole("menu", { name: "Add section" })
  await expect(menu.getByRole("menuitem", { name: "Custom section" })).toBeVisible()
  await settled(menu)
  // See-through glass doesn't blur what's behind it, so a menu fading in would
  // show the page plainly through it, then frost over at once as it ended.
  const seen = await lowest()
  expect(seen.panel).toBe(1)
  expect(seen.contents).toBeLessThan(1)
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  expect(errors).toEqual([])
})

test("on a wide screen the template gallery drops in solid, and only what's in it fades in", async ({ page }) => {
  const errors = pageErrors(page)
  await startWriting(page)
  // Let the preview finish, so the compiler's download isn't cut off as the page closes.
  await previewShown(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await transitionsDone(page)
  const lowest = await lowestOpacity(page, '[role="dialog"][aria-label="Choose a template"]')

  await page.getByRole("button", { name: /^Template/ }).click()
  const gallery = page.getByRole("dialog", { name: "Choose a template" })
  await expect(gallery).toBeVisible()
  await settled(gallery)
  // Faded in with what holds it, the glass showed the page plainly through it, then frosted over.
  const seen = await lowest()
  expect(seen.panel).toBe(1)
  expect(seen.contents).toBeLessThan(1)
  await page.keyboard.press("Escape")
  expect(errors).toEqual([])
})

test("back on the dashboard from a resume, the page comes in on the switch's one crossfade, with its resumes", async ({ page }) => {
  const errors = pageErrors(page)
  await saveResumes(page, [MARA])
  await page.goto("/create/dashboard")
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document && "types" in ViewTransition.prototype)),
    "The page shrinks back into its place only with typed view transitions",
  )
  await page
    .getByRole("link", { name: /Mara at Stripe/ })
    .first()
    .click()
  await previewShown(page)
  // From here on, whether anything in the dashboard's sheet faded in on its own. A resume's
  // page and name are pictured apart from the rest in the switch, so they'd be there well
  // before the sheet and the greeting, which faded in twice.
  const fadedAlone = await page.evaluateHandle(() => {
    const seen = { faded: false }
    const look = () => {
      for (const child of document.querySelectorAll("main > *"))
        if (child.getAnimations().some((animation) => (animation as CSSAnimation).animationName === "page-in")) seen.faded = true
    }
    new MutationObserver(look).observe(document.body, { childList: true, subtree: true })
    return seen
  })
  await page.getByRole("link", { name: "Dashboard" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mara")
  await expect(page.getByRole("link", { name: /Mara at Stripe/ }).first()).toBeVisible()
  expect((await fadedAlone.jsonValue()).faded).toBe(false)
  expect(errors).toEqual([])
})

test("the New resume dialog fades in", async ({ page }) => {
  const errors = pageErrors(page)
  await page.goto("/create/dashboard")

  const creating = await fadingIn(
    page.getByRole("button", { name: "New resume" }).first(),
    page.getByRole("dialog", { name: "New resume" }),
  )
  expect(creating.some((text) => text.includes("New resume"))).toBe(true)
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/create\/new\//)
  // Finish the compiler load before navigating away, as in the editor transition tests.
  await previewShown(page)
  expect(errors).toEqual([])
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("nothing fades: it's all there at once", async ({ page }) => {
    const errors = pageErrors(page)
    await startWriting(page)
    expect(
      await fadingIn(
        page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^Experience$/ }),
        editorHeading(page, "Experience"),
      ),
    ).toEqual([])
    expect(await fadingIn(page.getByRole("tab", { name: "ATS checks" }), page.getByRole("heading", { name: "ATS score" }))).toEqual([])
    expect(await fadingIn(page.getByRole("tab", { name: "Style" }), page.getByRole("region", { name: "Style" }))).toEqual([])
    await previewShown(page)
    expect(
      await fadingIn(page.getByRole("button", { name: /^Template/ }), page.getByRole("dialog", { name: "Choose a template" })),
    ).toEqual([])
    await page.keyboard.press("Escape")
    expect(errors).toEqual([])
  })
})
