import { expect, test } from "@playwright/test"
import {
  PORTAL_E2E_ENABLED,
  PORTAL_LIFECYCLE_PASSWORD,
  clearPortalRateLimits,
  disablePortalAccount,
  loginToPortal,
  markPortalAccountResetRequired,
  portalApiRequest,
  withPortalLifecycleFixture,
} from "./portal-fixture"

test.skip(!PORTAL_E2E_ENABLED, "Requires the guarded isolated PostgreSQL E2E environment.")

test("a client completes invitation activation and first login into the linked workspace", async ({ browser }) => {
  await withPortalLifecycleFixture(async ({ fixture, page }) => {
    await page.goto(`/portal/activate?token=${encodeURIComponent(fixture.invitee.rawToken)}`)
    await page.getByLabel("New password").fill(fixture.password)
    await page.getByLabel("Confirm password").fill(fixture.password)
    await page.getByRole("button", { name: "Activate portal" }).click()
    await expect(page.getByRole("heading", { name: "Portal access ready" })).toBeVisible()

    const replay = await page.request.post("/portal/api/activate", {
      data: { token: fixture.invitee.rawToken, password: "Different-pass!739" },
    })
    expect(replay.status()).toBe(400)

    await page.getByRole("link", { name: "Continue to sign in" }).click()
    await page.getByLabel("Email", { exact: true }).fill(fixture.invitee.email)
    await page.getByLabel("Password", { exact: true }).fill(fixture.password)
    await page.getByRole("button", { name: /enter portal/i }).click()
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.invitee.portalClientId}$`))
    await expect(page.getByRole("heading", { name: /welcome back, casey/i })).toBeVisible()
    await expect(page.getByRole("complementary").getByText("Invitee Workshop Portal", { exact: true })).toBeVisible()
  }, browser)
})

test("login, logout, disabled accounts and reset tokens control the portal session", async ({ browser }) => {
  await withPortalLifecycleFixture(async ({ db, fixture, page }) => {
    await page.goto(`/portal/${fixture.clientA.portalClientId}`)
    await expect(page).toHaveURL(/\/portal\/login/)

    await loginToPortal(page, fixture.clientA.email, fixture.password)
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}$`))
    await expect(page.getByRole("heading", { name: /welcome back, alex/i })).toBeVisible()

    await page.getByRole("button", { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/portal\/login/)
    await page.goto(`/portal/${fixture.clientA.portalClientId}?tab=invoices`)
    await expect(page).toHaveURL(/\/portal\/login/)

    await loginToPortal(page, fixture.clientA.email, fixture.password)
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}$`))

    await disablePortalAccount(db, fixture.clientA.accountId)
    await page.goto(`/portal/${fixture.clientA.portalClientId}?tab=reports`)
    await expect(page).toHaveURL(/\/portal\/login/)
    await clearPortalRateLimits(db)
    await loginToPortal(page, fixture.clientA.email, fixture.password)
    await expect(page.getByText("Unable to sign in with those credentials.")).toBeVisible()
    await expect(page).toHaveURL(/\/portal\/login/)

    const resetToken = await markPortalAccountResetRequired(db, fixture.clientB.accountId)
    await loginToPortal(page, fixture.clientB.email, fixture.password)
    await expect(page.getByText("Unable to sign in with those credentials.")).toBeVisible()

    const nextPassword = "E2e-reset-pass!740"
    await page.goto(`/portal/activate?token=${encodeURIComponent(resetToken)}`)
    await page.getByLabel("New password").fill(nextPassword)
    await page.getByLabel("Confirm password").fill(nextPassword)
    await page.getByRole("button", { name: "Activate portal" }).click()
    await expect(page.getByRole("heading", { name: "Portal access ready" })).toBeVisible()
    await page.getByRole("link", { name: "Continue to sign in" }).click()
    await clearPortalRateLimits(db)
    await loginToPortal(page, fixture.clientB.email, nextPassword)
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientB.portalClientId}$`))
    await expect(page.getByRole("heading", { name: /welcome back, blair/i })).toBeVisible()

    await loginToPortal(page, fixture.clientB.email, PORTAL_LIFECYCLE_PASSWORD)
    await expect(page.getByText("Unable to sign in with those credentials.")).toBeVisible()
  }, browser)
})

test("requests, replies, reports, invoices, PDF and timeline stay on the authenticated workspace", async ({ browser }) => {
  await withPortalLifecycleFixture(async ({ fixture, page }) => {
    await loginToPortal(page, fixture.clientA.email, fixture.password)
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}$`))

    await expect(page.getByRole("heading", { name: fixture.clientA.visibleTimelineTitle })).toBeVisible()
    await expect(page.getByRole("heading", { name: fixture.clientA.publishedReportTitle })).toBeVisible()
    await expect(page.getByText(fixture.clientA.visibleReply)).toBeVisible()
    await expectSecretsHidden(page, fixture.clientA, fixture.clientB)

    await page.getByRole("link", { name: "Requests", exact: true }).click()
    await expect(page.getByRole("heading", { name: "New Request" })).toBeVisible()
    await expect(page.getByRole("link", { name: fixture.clientA.visibleRequestTitle })).toBeVisible()

    const createdTitle = `A-new-request-${fixture.suffix}`
    await page.getByPlaceholder("Homepage text change, contact form issue...").fill(createdTitle)
    await page.locator("textarea[name='description']").fill("Please add a services section.")
    await page.getByRole("button", { name: /submit request/i }).click()
    await expect(page.getByText("Request received. ScaleSmiths will triage it and reply within the usual portal response window.")).toBeVisible()
    await expect(page.getByRole("link", { name: createdTitle })).toBeVisible()

    await page.getByRole("link", { name: fixture.clientA.visibleRequestTitle }).click()
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}/requests/${fixture.clientA.visibleRequestId}$`))
    await expect(page.getByText(fixture.clientA.visibleReply, { exact: true })).toBeVisible()
    await expect(page.getByText(fixture.clientA.internalNote)).toHaveCount(0)

    const reply = `A-client-reply-${fixture.suffix}`
    await page.getByPlaceholder("Add an update, answer a question, or send extra context...").fill(reply)
    await page.getByRole("button", { name: /send reply/i }).click()
    await expect(page.getByText("Reply sent.")).toBeVisible()
    await expect(page.getByText(reply, { exact: true })).toBeVisible()

    await page.getByRole("link", { name: "Reports", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Monthly reports" })).toBeVisible()
    await expect(page.getByRole("heading", { name: fixture.clientA.publishedReportTitle })).toBeVisible()
    await expect(page.getByText(fixture.clientA.unpublishedReportTitle)).toHaveCount(0)
    await expect(page.getByText(fixture.clientB.publishedReportTitle)).toHaveCount(0)
    await page.getByRole("link", { name: "Open report" }).click()
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}/reports/${fixture.clientA.publishedReportId}$`))
    await expect(page.locator("iframe[title]")).toHaveAttribute("srcDoc", new RegExp(fixture.clientA.publishedReportPhrase))

    await page.goto(`/portal/${fixture.clientA.portalClientId}?tab=invoices`)
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible()
    await expect(page.getByText(fixture.clientA.publishedInvoiceNumber, { exact: true })).toBeVisible()
    await expect(page.getByText(fixture.clientA.unpublishedInvoiceNumber)).toHaveCount(0)
    await expect(page.getByText(fixture.clientB.publishedInvoiceNumber)).toHaveCount(0)
    await page.getByRole("link", { name: "View", exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}/invoices/${fixture.clientA.publishedInvoiceNumber}$`))
    await expect(page.getByRole("heading", { name: fixture.clientA.publishedInvoiceNumber })).toBeVisible()
    await expect(page.getByText("Published care")).toBeVisible()

    const pdf = await portalApiRequest(page, `/portal/api/invoices/${encodeURIComponent(fixture.clientA.publishedInvoiceNumber)}/pdf`)
    expect(pdf.status()).toBe(200)
    expect(pdf.headers()["content-type"]).toContain("application/pdf")
    expect(Buffer.from(await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-")
  }, browser)
})

test("published milestones and documents appear while unpublished assets stay hidden", async ({ browser }) => {
  await withPortalLifecycleFixture(async ({ fixture, page }) => {
    await loginToPortal(page, fixture.clientA.email, fixture.password)
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}$`))

    await page.getByRole("link", { name: "Board", exact: true }).click()
    await expect(page.getByRole("heading", { name: "North Workshop website" })).toBeVisible()
    await expect(page.getByRole("heading", { name: fixture.clientA.visibleMilestoneTitle })).toBeVisible()
    await expect(page.getByText(fixture.clientA.internalMilestoneTitle)).toHaveCount(0)
    await expect(page.getByText(fixture.clientA.unpublishedProjectName)).toHaveCount(0)
    await expect(page.getByText(fixture.clientB.visibleMilestoneTitle)).toHaveCount(0)

    await page.getByRole("link", { name: "Files", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Documents and assets" })).toBeVisible()
    await expect(page.getByText(fixture.clientA.visibleDocumentTitle)).toBeVisible()
    await expect(page.getByText(fixture.clientA.internalDocumentTitle)).toHaveCount(0)
    await expect(page.getByText(fixture.clientA.unpublishedDocumentTitle)).toHaveCount(0)
    await expect(page.getByText(fixture.clientA.archivedDocumentTitle)).toHaveCount(0)
    await expect(page.getByText(fixture.clientB.visibleDocumentTitle)).toHaveCount(0)

    const document = await portalApiRequest(page, `/portal/api/documents/${fixture.clientA.visibleDocumentId}`, { maxRedirects: 0 })
    expect(document.status()).toBeGreaterThanOrEqual(300)
    expect(document.status()).toBeLessThan(400)
    expect(document.headers().location).toBe(fixture.clientA.visibleDocumentUrl)
  }, browser)
})

test("direct URLs cannot cross client boundaries or expose unpublished records", async ({ browser }) => {
  await withPortalLifecycleFixture(async ({ fixture, page }) => {
    await page.goto(`/portal/${fixture.clientA.portalClientId}?tab=reports`)
    await expect(page).toHaveURL(/\/portal\/login/)

    await loginToPortal(page, fixture.clientA.email, fixture.password)
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}$`))

    await page.goto(`/portal/${fixture.clientB.portalClientId}?tab=board`)
    await expect(page).toHaveURL(new RegExp(`/portal/${fixture.clientA.portalClientId}`))
    await expectSecretsHidden(page, fixture.clientA, fixture.clientB)

    await page.goto(`/portal/${fixture.clientA.portalClientId}/requests/${fixture.clientB.visibleRequestId}`)
    await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible()
    await expect(page.getByText(fixture.clientB.visibleRequestTitle)).toHaveCount(0)

    await page.goto(`/portal/${fixture.clientA.portalClientId}/reports/${fixture.clientB.publishedReportId}`)
    await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible()
    await expect(page.getByText(fixture.clientB.publishedReportPhrase)).toHaveCount(0)

    await page.goto(`/portal/${fixture.clientA.portalClientId}/reports/${fixture.clientA.unpublishedReportId}`)
    await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible()
    await expect(page.getByText(fixture.clientA.unpublishedReportTitle)).toHaveCount(0)

    await page.goto(`/portal/${fixture.clientA.portalClientId}/invoices/${encodeURIComponent(fixture.clientB.publishedInvoiceNumber)}`)
    await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible()
    await expect(page.getByText(fixture.clientB.publishedInvoiceNumber)).toHaveCount(0)

    await page.goto(`/portal/${fixture.clientA.portalClientId}/invoices/${encodeURIComponent(fixture.clientA.unpublishedInvoiceNumber)}`)
    await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible()
    await expect(page.getByText(fixture.clientA.unpublishedInvoiceNumber)).toHaveCount(0)

    const foreignPdf = await portalApiRequest(page, `/portal/api/invoices/${encodeURIComponent(fixture.clientB.publishedInvoiceNumber)}/pdf`)
    expect(foreignPdf.status()).toBe(404)
    expect(await foreignPdf.json()).toMatchObject({ error: "Invoice not found." })

    const unpublishedPdf = await portalApiRequest(page, `/portal/api/invoices/${encodeURIComponent(fixture.clientA.unpublishedInvoiceNumber)}/pdf`)
    expect(unpublishedPdf.status()).toBe(404)

    const foreignDocument = await portalApiRequest(page, `/portal/api/documents/${fixture.clientB.visibleDocumentId}`)
    expect(foreignDocument.status()).toBe(404)
    expect(await foreignDocument.json()).toMatchObject({ error: "Not found." })

    const unpublishedDocument = await portalApiRequest(page, `/portal/api/documents/${fixture.clientA.unpublishedDocumentId}`)
    expect(unpublishedDocument.status()).toBe(404)
  }, browser)
})

async function expectSecretsHidden(
  page: import("@playwright/test").Page,
  clientA: { internalNote: string; internalMilestoneTitle: string; unpublishedProjectName: string; unpublishedReportTitle: string; unpublishedInvoiceNumber: string; internalTimelineTitle: string },
  clientB: { visibleReply: string; visibleRequestTitle: string; publishedReportTitle: string; publishedInvoiceNumber: string; visibleMilestoneTitle: string; visibleDocumentTitle: string; visibleTimelineTitle: string },
) {
  for (const secret of [
    clientA.internalNote,
    clientA.internalMilestoneTitle,
    clientA.unpublishedProjectName,
    clientA.unpublishedReportTitle,
    clientA.unpublishedInvoiceNumber,
    clientA.internalTimelineTitle,
    clientB.visibleReply,
    clientB.visibleRequestTitle,
    clientB.publishedReportTitle,
    clientB.publishedInvoiceNumber,
    clientB.visibleMilestoneTitle,
    clientB.visibleDocumentTitle,
    clientB.visibleTimelineTitle,
  ]) {
    await expect(page.getByText(secret)).toHaveCount(0)
  }
}
