import { expect, test } from "@playwright/test"
import { clearV2State, gotoReady, installConsoleGuards, mockExperienceAnalytics, setExperience } from "./helpers"

test.describe.configure({ timeout: 90_000 })

test.beforeEach(async ({ page }) => {
  await mockExperienceAnalytics(page)
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
})

test("homepage defaults to the normal site outside Chromium", async ({ page }) => {
  const consoleGuard = await installConsoleGuards(page)
  await clearV2State(page)

  await gotoReady(page, "/")
  await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /what experience would you like today/i })).toBeHidden()
  await consoleGuard.expectClean()
})

test("stored interactive preference does not hijack the homepage outside Chromium", async ({ page }) => {
  const consoleGuard = await installConsoleGuards(page)
  await setExperience(page, "interactive")

  await gotoReady(page, "/")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
  await consoleGuard.expectClean()
})

test("service buyers can reach both differentiated journeys outside Chromium", async ({ page }) => {
  await gotoReady(page, "/services")
  await expect(page.getByRole("link", { name: /explore local growth/i }).first()).toHaveAttribute("href", "/local-growth")
  await expect(page.getByRole("link", { name: /explore custom systems/i }).first()).toHaveAttribute("href", "/custom-systems")

  await gotoReady(page, "/local-growth")
  await expect(page.getByRole("heading", { level: 1, name: /trusted enquiries and bookings/i })).toBeVisible()

  await gotoReady(page, "/custom-systems")
  await expect(page.getByRole("heading", { level: 1, name: /workflow actually needs/i })).toBeVisible()
})
