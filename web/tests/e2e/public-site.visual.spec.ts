import { expect, test } from "@playwright/test"
import { clearV2State, disableVisualNoise, gotoReady, mockExperienceAnalytics, openInteractivePlan, rejectNonEssentialStorage, setExperience } from "./helpers"

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await mockExperienceAnalytics(page)
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
})

test("normal homepage visual baseline", async ({ page }, testInfo) => {
  await clearV2State(page)
  await gotoReady(page, "/")
  await disableVisualNoise(page)
  await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()

  await expect(page).toHaveScreenshot(`normal-home-${testInfo.project.name}.png`)
})

test("normal homepage with stored preference visual baseline", async ({ page }, testInfo) => {
  await setExperience(page, "normal")
  await gotoReady(page, "/")
  await disableVisualNoise(page)
  await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()

  await expect(page).toHaveScreenshot(`normal-home-pref-${testInfo.project.name}.png`)
})

test("interactive plan visual baseline", async ({ page }, testInfo) => {
  await rejectNonEssentialStorage(page)
  await openInteractivePlan(page)
  await disableVisualNoise(page)

  await expect(page).toHaveScreenshot(`interactive-plan-${testInfo.project.name}.png`)
})
