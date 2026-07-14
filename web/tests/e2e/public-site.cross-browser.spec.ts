import { expect, test } from "@playwright/test"
import { clearV2State, gotoReady, mockExperienceAnalytics, setExperience } from "./helpers"

test.beforeEach(async ({ page }) => {
  await mockExperienceAnalytics(page)
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
})

test("first-time chooser and normal path work outside Chromium", async ({ page }) => {
  await clearV2State(page)

  await gotoReady(page, "/")
  await page.getByRole("button", { name: /open website/i }).click()

  await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
})

test("stored interactive preference reaches the interactive shell outside Chromium", async ({ page }) => {
  await setExperience(page, "interactive")

  await page.goto("/", { waitUntil: "domcontentloaded" })

  await page.waitForURL(/\/interactive$/, { timeout: 20_000, waitUntil: "domcontentloaded" })
  await expect(page.getByRole("link", { name: /exit to normal site/i })).toBeVisible()
})
