import { expect, test } from "@playwright/test"
import { gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const

async function assertArchitectureFramework(page: import("@playwright/test").Page) {
  const framework = page.getByTestId("enterprise-architecture-framework")
  await expect(framework).toBeVisible()
  await expect(framework.getByRole("heading", { name: /architecture follows the problem/i })).toBeVisible()
  await expect(framework.getByRole("heading", { name: /typical enterprise architecture/i })).toBeVisible()
  await expect(framework.locator(".architecture-diagram")).toBeVisible()
  await expect(framework.locator(".architecture-diagram__node")).toHaveCount(8)

  for (const group of ["Identity", "Applications", "Data", "Integration", "Infrastructure", "Operations"]) {
    await expect(framework.getByRole("heading", { name: group, exact: true })).toBeVisible()
  }

  await expect(framework.getByText(/sso and scoped permissions|staff access the platform with existing corporate credentials/i).first()).toBeVisible()
  await expect(framework.getByRole("link", { name: /security & trust/i })).toHaveAttribute("href", "/security")
  await expect(framework.getByRole("link", { name: /enterprise delivery/i })).toHaveAttribute("href", "/enterprise/delivery")

  const report = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="enterprise-architecture-framework"]')
    if (!(root instanceof HTMLElement)) return { overflow: true, diagramWidth: 0, viewportWidth: window.innerWidth }
    const diagram = root.querySelector(".architecture-diagram")
    const diagramRect = diagram?.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      diagramWidth: diagramRect?.width ?? 0,
      viewportWidth: window.innerWidth,
      diagramWiderThanViewport: Boolean(diagramRect && diagramRect.width > window.innerWidth + 1),
    }
  })
  expect(report.overflow).toBe(false)
  expect(report.diagramWiderThanViewport).toBe(false)
  expect(report.diagramWidth).toBeGreaterThan(200)
}

test.describe("enterprise architecture framework", () => {
  test.describe.configure({ timeout: 300_000 })

  for (const viewport of VIEWPORTS) {
    test(`renders on /enterprise at ${viewport.name} without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)
      await gotoReady(page, "/enterprise")
      await assertArchitectureFramework(page)
      await expect(page.getByTestId("enterprise-architecture-framework").getByRole("link", { name: /^Enterprise systems$/i })).toHaveCount(0)
    })

    test(`renders on /custom-systems at ${viewport.name} without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)
      await gotoReady(page, "/custom-systems")
      await assertArchitectureFramework(page)
      await expect(page.getByTestId("enterprise-architecture-framework").getByRole("link", { name: /enterprise systems/i })).toHaveAttribute("href", "/enterprise")
    })
  }

  test("does not appear on the local-growth journey", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await gotoReady(page, "/local-growth")
    await expect(page.getByTestId("enterprise-architecture-framework")).toHaveCount(0)
  })
})
