import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"

test.beforeAll(async () => { await mkdir("test-results/workspace-review", { recursive: true }) })

test("pipeline search, selection and focused panels preserve the correct prospect", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto("/prospects")
  const marker = `Workspace ${Date.now()}`
  const rows = await page.evaluate(async (marker) => {
    const results = []
    for (const suffix of ["Alpha", "Beta"]) {
      const response = await fetch("/api/prospects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessName: `${marker} ${suffix}`, contactName: suffix, stage: "found" }) })
      if (!response.ok) throw new Error(`Create prospect failed: ${response.status}`)
      results.push((await response.json()).prospect)
    }
    return results
  }, marker)
  await page.reload()
  const search = page.getByLabel("Find a prospect")
  await search.fill(`${marker} Alpha`)
  await expect(page.locator(".pipeline-list-row")).toHaveCount(1)
  await page.locator(".pipeline-list-row").click()
  await expect(page.locator(".pipeline-detail-heading")).toContainText(rows[0].businessName)
  await expect(page.locator(".pipeline-detail").getByLabel("Contact", { exact: true })).toHaveValue("Alpha")
  await expect(page.getByRole("button", { name: "Convert to Client", exact: true })).toBeInViewport()
  await page.locator(".pipeline-detail-tabs").getByRole("button", { name: "Activity", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Add Activity", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Generate Draft Proposal", exact: true })).toBeHidden()
  await search.fill(`${marker} Beta`)
  await page.locator(".pipeline-list-row").click()
  await expect(page.locator(".pipeline-detail").getByLabel("Contact", { exact: true })).toHaveValue("Beta")
  await page.screenshot({ path: "test-results/workspace-review/pipeline-desktop.png" })
  await page.getByRole("button", { name: "Board", exact: true }).click()
  await expect(page.locator(".pipeline-board")).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "List", exact: true }).click()
  await page.locator(".pipeline-list-row").click()
  await expect(page.locator(".pipeline-detail-heading")).toBeInViewport()
  await expect.poll(() => page.locator("#prospect-detail").evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(90)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: "test-results/workspace-review/pipeline-mobile.png" })
})

test("navigation search exposes relevant pages and Forge recovery remains reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto("/operations/forge")
  await page.getByLabel("Find a page").fill("pipeline")
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Pipeline", exact: true })).toBeVisible()
  await page.getByLabel("Find a page").fill("")
  await expect(page.getByRole("heading", { name: "Forge operations", exact: true })).toBeVisible()
  await page.screenshot({ path: "test-results/workspace-review/forge-operations.png" })
  await page.getByRole("link", { name: "Recovery actions", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Recovery actions", exact: true })).toBeInViewport()
  const favicon = await page.locator('link[rel="icon"]').first().getAttribute("href")
  expect(favicon).toBe("/brand/favicon.png")
  await expect(page.locator(".admin-brand-link img").first()).toHaveAttribute("src", /favicon/)
})


test("Forge restores overview after browser history removes a view and contains drawer focus", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto("/forge")
  const projectId = await page.evaluate(async () => {
    const response = await fetch("/api/forge/projects")
    if (!response.ok) throw new Error(`Read Forge projects failed: ${response.status}`)
    const { projects } = await response.json()
    const fixture = projects.find((project: { name: string }) => project.name === "E2E QA Failure")
    if (!fixture) throw new Error("Guarded E2E QA fixture is missing")
    return fixture.id as number
  })
  await page.goto(`/forge/${projectId}`)
  await page.evaluate(() => window.history.pushState(null, "", `${window.location.pathname}?view=advanced`))
  await expect(page.getByRole("button", { name: "Advanced", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.goBack()
  await expect(page.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "More project actions", exact: true }).click()
  await page.getByRole("button", { name: /^Open context/ }).click()
  await expect(page.getByRole("dialog", { name: "Project context", exact: true })).toBeVisible()
  await page.keyboard.press("Shift+Tab")
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Project context", exact: true })).toBeHidden()
  await page.screenshot({ path: "test-results/workspace-review/forge-project-desktop.png" })
})
