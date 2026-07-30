import { expect, test, type Page } from "@playwright/test"

const viewports = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1600x900", width: 1600, height: 900 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "tablet-1024x768", width: 1024, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const

async function signIn(page: Page) {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for admin shell visual tests.")

  await page.goto("/login", { waitUntil: "domcontentloaded" })
  if (!page.url().includes("/login")) return

  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  if (process.env.ADMIN_TOTP) await page.getByLabel(/Authenticator code/).fill(process.env.ADMIN_TOTP)
  if (process.env.ADMIN_RECOVERY_CODE) {
    await page.getByText("Use a recovery code").click()
    await page.getByLabel("Recovery code").fill(process.env.ADMIN_RECOVERY_CODE)
  }
  await page.getByRole("button", { name: "Sign in" }).click()
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.getByText("Invalid credentials").waitFor().then(async () => {
      await page.getByLabel("Password").fill("")
      throw new Error("Admin visual-test credentials were rejected.")
    }),
  ])
}

async function assertViewportIntegrity(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && (rect.right > viewportWidth + 1 || rect.left < -1)
      })
      .slice(0, 10)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`)
    const clippedControls = Array.from(document.querySelectorAll<HTMLElement>("button, a, input, select, textarea"))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.right > viewportWidth + 1 || rect.left < -1)
      })
      .length
    return {
      documentOverflow: document.documentElement.scrollWidth - viewportWidth,
      offenders,
      clippedControls,
    }
  })

  expect(result.documentOverflow, `Horizontal overflow from: ${result.offenders.join(", ")}`).toBeLessThanOrEqual(1)
  expect(result.clippedControls).toBe(0)
  await expect(page.locator(".admin-topbar")).toBeVisible()
  await expect(page.locator(".admin-main")).toBeVisible()
}

for (const viewport of viewports) {
  test(`admin shell remains usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" })
    await signIn(page)
    await page.goto("/forge", { waitUntil: "domcontentloaded" })
    await page.locator(".workspace-shell").waitFor()
    await assertViewportIntegrity(page)

    if (viewport.width < 1280) {
      await expect(page.locator(".admin-sidebar")).toBeHidden()
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible()
    } else {
      await expect(page.locator(".admin-sidebar")).toBeVisible()
    }

    await expect(page).toHaveScreenshot(`admin-shell-${viewport.name}.png`, { fullPage: true })
  })
}

test("Forge focus mode is persistent and reversible", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await signIn(page)
  await page.goto("/forge", { waitUntil: "domcontentloaded" })
  const focusButton = page.getByRole("button", { name: "Focus mode" })
  await focusButton.click()
  await expect(page.locator(".admin-shell")).toHaveAttribute("data-focus-mode", "true")
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.locator(".admin-shell")).toHaveAttribute("data-focus-mode", "true")
  await page.getByRole("button", { name: "Exit focus" }).click()
  await expect(page.locator(".admin-shell")).toHaveAttribute("data-focus-mode", "false")
})
