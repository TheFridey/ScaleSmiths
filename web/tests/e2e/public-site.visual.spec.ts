import { expect, test } from "@playwright/test"
import { chooseNormalExperience, clearV2State, disableVisualNoise, gotoReady, openInteractivePlan, setExperience } from "./helpers"

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
})

test("first-time chooser visual baseline", async ({ page }, testInfo) => {
  await clearV2State(page)
  await gotoReady(page, "/")
  await disableVisualNoise(page)
  await expect(page.getByRole("heading", { name: /what experience would you like today/i })).toBeVisible()

  await expect(page).toHaveScreenshot(`chooser-${testInfo.project.name}.png`)
})

test("normal homepage visual baseline", async ({ page }, testInfo) => {
  await setExperience(page, "normal")
  await gotoReady(page, "/")
  await disableVisualNoise(page)
  await chooseNormalExperienceIfNeeded(page)

  await expect(page).toHaveScreenshot(`normal-home-${testInfo.project.name}.png`)
})

test("interactive plan visual baseline", async ({ page }, testInfo) => {
  await disableVisualNoise(page)
  await openInteractivePlan(page)

  await expect(page).toHaveScreenshot(`interactive-plan-${testInfo.project.name}.png`)
})

async function chooseNormalExperienceIfNeeded(page: import("@playwright/test").Page) {
  const chooser = page.getByRole("heading", { name: /what experience would you like today/i })
  if (await chooser.isVisible().catch(() => false)) {
    await chooseNormalExperience(page)
  }
}
