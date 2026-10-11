import { expect, test } from "@playwright/test"
import { disableVisualNoise, gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

test.describe("enterprise architecture visual baselines", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
  })

  test("enterprise page architecture framework visual baseline", async ({ page }, testInfo) => {
    await gotoReady(page, "/enterprise")
    await disableVisualNoise(page)
    const framework = page.getByTestId("enterprise-architecture-framework")
    await framework.scrollIntoViewIfNeeded()
    await expect(framework.getByRole("heading", { name: /architecture follows the problem/i })).toBeVisible()
    await expect(framework).toHaveScreenshot(`enterprise-architecture-${testInfo.project.name}.png`)
  })

  test("custom-systems architecture framework visual baseline", async ({ page }, testInfo) => {
    await gotoReady(page, "/custom-systems")
    await disableVisualNoise(page)
    const framework = page.getByTestId("enterprise-architecture-framework")
    await framework.scrollIntoViewIfNeeded()
    await expect(framework.getByRole("heading", { name: /architecture follows the problem/i })).toBeVisible()
    await expect(framework).toHaveScreenshot(`custom-systems-architecture-${testInfo.project.name}.png`)
  })
})
