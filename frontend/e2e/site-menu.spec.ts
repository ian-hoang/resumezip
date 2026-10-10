import { expect, test } from "@playwright/test"

// Below 768px the header's links fold into a menu, which drops over the page
// rather than pushing it down.

const PHONE = { width: 390, height: 844 }

// The home page's header sits on its video; every other page's, at the top of the page.
for (const path of ["/", "/about"]) {
  test(`the menu on ${path} opens over the page without moving it`, async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(path)
    const heading = page.getByRole("heading", { level: 1 })
    const before = await heading.boundingBox()

    await page.getByRole("button", { name: "Open menu" }).click()
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "About" })).toBeVisible()
    expect(await heading.boundingBox()).toEqual(before)
  })
}

test("the menu closes on Escape or a tap elsewhere, and Tab skips it while it fades out", async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto("/about")
  const button = page.getByRole("button", { name: "Open menu" })
  const menu = page.getByRole("navigation", { name: "Main" })

  await button.click()
  await expect(menu).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(button).toBeFocused()
  // Checked at once, while it's still fading: once it's gone Tab can't reach it anyway.
  await page.keyboard.press("Tab")
  // The phone menu comes after the wide screens' links, which are hidden here.
  const fading = page.getByRole("navigation", { name: "Main", includeHidden: true }).last()
  expect(await fading.evaluate((nav) => nav.contains(document.activeElement))).toBe(false)
  await expect(menu).toBeHidden()

  await button.click()
  await expect(menu).toBeVisible()
  // The page's side margin, clear of the menu and of any link.
  await page.mouse.click(5, PHONE.height - 5)
  await expect(menu).toBeHidden()
  await expect(button).toHaveAttribute("aria-expanded", "false")
})

test("the menu is shut after the phone turns sideways and back", async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto("/about")
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible()

  // Sideways, the header has room for its own links, and the menu and its button go.
  await page.setViewportSize({ width: PHONE.height, height: PHONE.width })
  const toggle = page.getByRole("button", { name: /menu/, includeHidden: true })
  await expect(toggle).toBeHidden()
  // Waits for the menu to shut before turning back, as that happens a frame after the resize.
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await page.setViewportSize(PHONE)
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden()
})
