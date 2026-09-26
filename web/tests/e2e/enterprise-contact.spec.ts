import { expect, test, type Page } from "@playwright/test"
import { gotoReady, mockQuoteApi, rejectNonEssentialStorage, setExperience } from "./helpers"

async function fillOrganisation(page: Page) {
  await page.getByLabel(/^Name/, { exact: true }).fill("Alex Ops")
  await page.getByLabel(/Work email/i).fill("alex@example.com")
  await page.getByLabel(/^Phone/i).fill("+44 7700 900123")
  await page.getByLabel(/^Company/, { exact: true }).fill("Example Holdings")
  await page.getByLabel(/Job title/i).fill("Operations Director")
  await page.getByRole("radio", { name: "51–200" }).check()
  await page.getByLabel(/Number of sites/i).fill("12")
}

async function advanceCompleteWizard(page: Page) {
  await fillOrganisation(page)
  await page.getByRole("button", { name: /^Continue$/i }).click()

  await page.getByLabel(/What systems are you currently using/i).fill("ERP, spreadsheets, legacy inspection tool")
  await page.getByLabel(/What problem are you trying to solve/i).fill("Field checks and compliance evidence are fragmented across sites.")
  await page.getByLabel(/overlapping roles/i).fill("Two SaaS tools partially cover the same workflow.")
  await page.getByLabel(/manual processes/i).fill("Weekly spreadsheet reconciliations")
  await page.getByLabel(/operational friction/i).fill("No reliable audit trail for site checks")
  await page.getByRole("button", { name: /^Continue$/i }).click()

  await page.getByRole("checkbox", { name: /Operational platform/i }).check()
  await page.getByRole("checkbox", { name: /Compliance platform/i }).check()
  await page.getByRole("button", { name: /^Continue$/i }).click()

  await page.getByRole("radio", { name: /^Yes$/i }).first().check()
  await page.getByRole("button", { name: /^Continue$/i }).click()

  await page.getByLabel(/Approximate number of users/i).fill("180")
  await page.getByRole("radio", { name: /3–6 months/i }).check()
  await page.getByRole("radio", { name: /£100k–£250k/i }).check()
  await page.getByLabel(/Who else will be involved/i).fill("CIO and Finance Director")
  await page.getByRole("button", { name: /^Continue$/i }).click()

  await page.getByLabel(/Anything else we should know/i).fill("We want a controlled discovery before committing to rebuild.")
  await page.getByLabel(/store the information i submit/i).check()
}

test.describe("enterprise discovery enquiry", () => {
  test.describe.configure({ timeout: 180_000 })

  test.beforeEach(async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
  })

  test("validates required organisation fields before continuing", async ({ page }) => {
    let submissionCount = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/quote") && request.method() === "POST") submissionCount += 1
    })

    await gotoReady(page, "/enterprise/contact")
    await expect(page.getByRole("heading", { level: 1, name: /focused enterprise discovery/i })).toBeVisible()
    await expect(page.getByText("ScaleSmiths").first()).toBeVisible()

    await page.getByRole("button", { name: /^Continue$/i }).click()

    const alert = page.locator("[role='alert'][tabindex='-1']")
    await expect(alert).toContainText(/name/i)
    await expect(alert).toBeFocused()
    await expect(page.getByRole("heading", { level: 2, name: "Organisation", exact: true })).toBeVisible()
    expect(submissionCount).toBe(0)
  })

  test("navigates steps and restores draft state", async ({ page }) => {
    await gotoReady(page, "/enterprise/contact")
    await fillOrganisation(page)
    await page.getByRole("button", { name: /^Continue$/i }).click()
    await expect(page.getByRole("heading", { level: 2, name: "Current Situation", exact: true })).toBeVisible()
    await page.getByLabel(/What problem are you trying to solve/i).fill("Fragmented operational systems.")

    await page.getByRole("button", { name: /Previous step/i }).click()
    await expect(page.getByLabel(/^Name/, { exact: true })).toHaveValue("Alex Ops")

    await gotoReady(page, "/work")
    await gotoReady(page, "/enterprise/contact")
    await expect(page.getByRole("heading", { level: 2, name: "Organisation", exact: true })).toBeVisible()
    await expect(page.getByLabel(/^Name/, { exact: true })).toHaveValue("Alex Ops")
    await expect(page.getByLabel(/^Company/, { exact: true })).toHaveValue("Example Holdings")
  })

  test("submits a complete enterprise discovery enquiry", async ({ page }) => {
    let submittedPayload: Record<string, unknown> | undefined
    await mockQuoteApi(page, {
      ok: true,
      onRequest: (payload) => {
        submittedPayload = payload
      },
    })

    await gotoReady(page, "/enterprise/contact")
    await advanceCompleteWizard(page)
    await page.getByRole("button", { name: /Start Enterprise Discovery/i }).click()

    await expect(page).toHaveURL(/\/enterprise\/contact\/thanks$/)
    await expect(page.getByRole("heading", { name: /Discovery enquiry received/i })).toBeVisible()
    expect(submittedPayload?.funnelType).toBe("enterprise")
    expect(submittedPayload?.intent).toBe("enterprise")
    expect(submittedPayload?.budget).toBe("£100k–£250k")
    expect(submittedPayload?.consent).toBe(true)
    expect(String(submittedPayload?.brief ?? "")).toContain("Enterprise discovery brief")
    expect(JSON.stringify(submittedPayload)).not.toMatch(/password|secret/i)
  })

  test("surfaces submission failures without leaving the form", async ({ page }) => {
    await mockQuoteApi(page, { ok: false, status: 503, error: "Unable to submit your enquiry." })

    await gotoReady(page, "/enterprise/contact")
    await advanceCompleteWizard(page)
    await page.getByRole("button", { name: /Start Enterprise Discovery/i }).click()

    await expect(page.getByRole("alert")).toContainText(/Unable to submit your enquiry/i)
    await expect(page).toHaveURL(/\/enterprise\/contact$/)
    await expect(page.getByRole("heading", { level: 2, name: "Final Message", exact: true })).toBeVisible()
  })

  test("keeps the enquiry usable on mobile without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await gotoReady(page, "/enterprise/contact")

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("progressbar")).toBeVisible()
    await fillOrganisation(page)
    await page.getByRole("button", { name: /^Continue$/i }).click()
    await expect(page.getByRole("heading", { level: 2, name: "Current Situation", exact: true })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("supports keyboard progression through the first step", async ({ page }) => {
    await gotoReady(page, "/enterprise/contact")

    await page.getByLabel(/^Name/, { exact: true }).focus()
    await expect(page.getByLabel(/^Name/, { exact: true })).toBeFocused()
    await page.keyboard.type("Keyboard Lead")
    await page.keyboard.press("Tab")
    await page.keyboard.type("keyboard@example.com")
    await page.keyboard.press("Tab")
    await page.keyboard.type("+44 7700 900999")
    await page.keyboard.press("Tab")
    await page.keyboard.type("Keyboard Co")
    await page.keyboard.press("Tab")
    await page.keyboard.type("IT Director")
    await page.getByRole("radio", { name: "11–50" }).focus()
    await page.keyboard.press("Space")
    await expect(page.getByRole("radio", { name: "11–50" })).toBeChecked()

    await page.getByRole("button", { name: /^Continue$/i }).focus()
    await expect(page.getByRole("button", { name: /^Continue$/i })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("heading", { level: 2, name: "Current Situation", exact: true })).toBeVisible()
  })

  test("soft-indexes the form and noindexes the thanks route", async ({ page }) => {
    await gotoReady(page, "/enterprise/contact")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/enterprise\/contact$/)
    const robots = await page.locator('meta[name="robots"]').getAttribute("content")
    expect(robots ?? "").not.toMatch(/noindex/i)

    await gotoReady(page, "/enterprise/contact/thanks")
    const thanksRobots = await page.locator('meta[name="robots"]').getAttribute("content")
    expect(thanksRobots ?? "").toMatch(/noindex/i)
  })
})
