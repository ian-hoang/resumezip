import { test as base, type Browser, type BrowserContext } from "@playwright/test"

export * from "@playwright/test"

// A temporary experiment, not for main: CI's WebKit, which draws without a
// GPU, runs each test about 2.5x slower since the redesign, and Chromium
// doesn't. Each variant (WEBKIT_VARIANT) turns one suspect off in WebKit,
// with a stylesheet laid over the app's own, which stays as it is, so the
// variants' times can be compared with the baseline's. The lens
// (LiquidLens.tsx) isn't one: it only draws in Chromium.
const BLUR = `*, *::before, *::after { -webkit-backdrop-filter: none !important; backdrop-filter: none !important }`
// The sky stays a picture but scrolls with the page, rather than being fixed.
const SKY_SCROLLS = `.desk, .desk-bright .desk { background-attachment: scroll !important }`
// No picture and no grid of dots: the sky's flat blue.
const FLAT_SKY = `.desk, .desk-bright .desk { background-image: none !important; background-attachment: scroll !important }`
// Endless animations (loaders, the score's dot, the arrows, the About story's
// sway) run once, so nothing keeps the page drawing frames.
const ONCE = `*, *::before, *::after { animation-iteration-count: 1 !important }`

const VARIANTS: Record<string, string> = {
  baseline: "",
  "no-blur": BLUR,
  "sky-scrolls": SKY_SCROLLS,
  "flat-sky": FLAT_SKY,
  "no-endless-animations": ONCE,
  "all-off": [BLUR, FLAT_SKY, ONCE].join("\n"),
}

const variant = process.env.WEBKIT_VARIANT ?? "baseline"
if (!(variant in VARIANTS)) throw new Error(`Unknown WEBKIT_VARIANT: ${variant}`)
const css = VARIANTS[variant]

// An adopted stylesheet, not a <style> element: an element the server didn't
// render would be a hydration mismatch, which the tests count as an error.
const adopt = (text: string) => {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(text)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}

const patched = new WeakSet<Browser>()

export const test = base.extend<object, { variantStyles: void }>({
  // Every context a test opens, its own or one from browser.newContext(), gets the stylesheet.
  variantStyles: [
    async ({ browser, browserName }, use) => {
      if (browserName === "webkit" && css && !patched.has(browser)) {
        patched.add(browser)
        const newContext = browser.newContext.bind(browser)
        browser.newContext = async (...args: Parameters<Browser["newContext"]>): Promise<BrowserContext> => {
          const context = await newContext(...args)
          await context.addInitScript(adopt, css)
          return context
        }
      }
      await use()
    },
    { scope: "worker", auto: true },
  ],
})
