import { expect, test, type Locator, type Page } from "@playwright/test"
import { pageErrors, settled, transitionsDone } from "./helpers"

// What a click brings up fades in, rather than appearing all at once, unless
// the visitor asks for less motion.

/**
 * Records opacity transitions from before the click, then waits for the new
 * content and for everything around it to settle. A one-time snapshot can miss
 * a short fade on a busy CI worker, or run before React inserts the new
 * content or the fade has started.
 */
async function fadingIn(control: Locator, shown: Locator): Promise<string[]> {
  await transitionsDone(control.page())
  const recording = await control.evaluateHandle((element: HTMLElement) => {
    const transitions: { target: Element; text: string }[] = []
    const record = (event: TransitionEvent) => {
      if (event.propertyName === "opacity" && event.target instanceof Element) {
        transitions.push({ target: event.target, text: event.target.textContent ?? "" })
      }
    }
    document.addEventListener("transitionrun", record)
    element.click()
    return { transitions, stop: () => document.removeEventListener("transitionrun", record) }
  })
  try {
    await expect(shown).toBeVisible()
    await settled(shown)
    // Preview rendering has its own fades. This assertion concerns the opened
    // content, including a surrounding dialog overlay or panel transition.
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

async function newResume(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Start writing" }).first().click()
  await expect(page).toHaveURL(/\/create\/new\//)
  // The section buttons are replaced by draggable ones once drag and drop
  // loads. fadingIn finds its button and then clicks it, so on a busy machine
  // the click could land on the old one, no longer on the page.
  await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Reorder Experience" })).toBeVisible()
}

test("a section, Write, Check or Style, and the template gallery fade in as they're chosen", async ({ page }) => {
  const errors = pageErrors(page)
  await newResume(page)
  const sections = page.getByRole("navigation", { name: "Sections" })

  const experience = await fadingIn(
    sections.getByRole("button", { name: /^\d+ Experience$/ }),
    page.getByRole("heading", { name: "Experience" }),
  )
  expect(experience.some((text) => text.includes("Add experience"))).toBe(true)
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible()

  const check = await fadingIn(
    page.getByRole("tablist", { name: "Write, check or style" }).getByRole("tab", { name: /^Check/ }),
    page.getByRole("heading", { name: "Resume score" }),
  )
  expect(check.some((text) => text.includes("Resume score"))).toBe(true)
  const write = await fadingIn(page.getByRole("tab", { name: "Write" }), sections)
  expect(write.some((text) => text.includes("Profile"))).toBe(true)

  // The Style tab shows Fine-tune in the left panel.
  const style = await fadingIn(page.getByRole("tab", { name: "Style" }), page.getByRole("region", { name: "Style" }))
  expect(style.some((text) => text.includes("Fine-tune"))).toBe(true)
  await page.getByRole("tab", { name: "Write" }).click()
  await expect(page.getByRole("region", { name: "Style" })).toBeHidden()

  // Let the preview finish, so the compiler's download isn't cut off as the page closes.
  // (Narrower, below, the preview is behind the Edit / Preview switch.)
  await expect(page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()

  // Narrower, the gallery opens from the Template button.
  await page.setViewportSize({ width: 1024, height: 768 })
  const gallery = await fadingIn(page.getByRole("button", { name: /^Template/ }), page.getByRole("dialog", { name: "Choose a template" }))
  expect(gallery.some((text) => text.includes("Templates"))).toBe(true)
  await expect(page.getByRole("dialog", { name: "Choose a template" })).toBeVisible()
  await page.keyboard.press("Escape")
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
  await expect(page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()
  expect(errors).toEqual([])
})

test.describe("with less motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("nothing fades: it's all there at once", async ({ page }) => {
    await newResume(page)
    expect(
      await fadingIn(
        page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^\d+ Experience$/ }),
        page.getByRole("heading", { name: "Experience" }),
      ),
    ).toEqual([])
    expect(await fadingIn(page.getByRole("tab", { name: /^Check/ }), page.getByRole("heading", { name: "Resume score" }))).toEqual([])
    expect(await fadingIn(page.getByRole("tab", { name: "Style" }), page.getByRole("region", { name: "Style" }))).toEqual([])
    await expect(page.getByRole("region", { name: "Live preview" }).locator(".react-pdf__Page__canvas").first()).toBeVisible()
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(
      await fadingIn(page.getByRole("button", { name: /^Template/ }), page.getByRole("dialog", { name: "Choose a template" })),
    ).toEqual([])
    await page.keyboard.press("Escape")
  })
})
