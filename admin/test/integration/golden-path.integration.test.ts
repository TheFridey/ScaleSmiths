import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import path from "node:path"
import { promisify } from "node:util"
import { execFile } from "node:child_process"
import bcrypt from "bcryptjs"
import { Pool } from "pg"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "../../src/lib/schema"
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety"
import { migrateSharedTestDatabase } from "./shared-migration-harness"

const run = promisify(execFile)
const actor = { id: "00000000-0000-0000-0000-000000000111", email: "golden-owner@example.test", name: "Golden Path Owner" }
let pool: Pool
let adminPool: Pool
let webPool: Pool
let adminDb: ReturnType<typeof drizzle>
let state: Record<string, number | string> = {}

beforeAll(async () => {
  const url = assertSafeIntegrationDatabaseUrl(process.env.TEST_DATABASE_URL)
  const webUrl = roleUrl(url, "ss_test_web", "web-password")
  const adminUrl = roleUrl(url, "ss_test_admin", "admin-password")
  const migrationUrl = roleUrl(url, "ss_test_migration", "migration-password")
  process.env.DATABASE_URL = adminUrl
  process.env.ADMIN_DATABASE_URL = adminUrl
  process.env.MIGRATION_DATABASE_URL = migrationUrl
  process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3999"
  process.env.RESEND_FROM = "billing@example.test"
  pool = new Pool({ connectionString: url, max: 5 })
  await pool.query("drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public")
  const provisionEnv = { ...process.env, POSTGRES_PROVISIONING_DATABASE_URL: url, WEB_DATABASE_URL: webUrl, ADMIN_DATABASE_URL: adminUrl, MIGRATION_DATABASE_URL: migrationUrl, READONLY_DATABASE_URL: roleUrl(url, "ss_test_readonly", "readonly-password") }
  await run(process.execPath, [path.resolve("scripts/provision-postgres-roles.mjs"), "--confirm-provision"], { env: provisionEnv })
  const migrationPool = new Pool({ connectionString: migrationUrl, max: 2 })
  try { await migrateSharedTestDatabase(migrationPool) } finally { await migrationPool.end() }
  await run(process.execPath, [path.resolve("scripts/provision-postgres-roles.mjs"), "--confirm-provision"], { env: provisionEnv })
  adminPool = new Pool({ connectionString: adminUrl, max: 5 })
  webPool = new Pool({ connectionString: webUrl, max: 2 })
  adminDb = drizzle(adminPool)
  await runGoldenLifecycle()
}, 120_000)

afterAll(async () => { await Promise.all([pool?.end(), adminPool?.end(), webPool?.end()]) })

describe("ScaleSmiths Golden Path", () => {
  it("converts the won opportunity once with a client, service, portal identity and project", async () => {
    expect(state.clientId).toBeTypeOf("number")
    expect((await adminDb.select().from(schema.prospectConversions)).length).toBe(1)
    expect((await adminDb.select().from(schema.clients)).length).toBe(2)
    expect((await adminDb.select().from(schema.clientServiceAssignments).where(eq(schema.clientServiceAssignments.clientId, Number(state.clientId)))).length).toBe(1)
    expect((await adminDb.select().from(schema.deliveryProjects).where(eq(schema.deliveryProjects.clientId, Number(state.clientId)))).length).toBe(1)
    const account = await adminPool.query("select active,status from portal_client_accounts where client_id=$1", [state.portalClientId])
    expect(account.rows).toEqual([{ active: true, status: "active" }])
  })

  it("records delivery, approval and deployment with complete progress and retry-safe events", async () => {
    const [progress] = await adminDb.select().from(schema.deliveryProjectProgress).where(eq(schema.deliveryProjectProgress.projectId, Number(state.projectId)))
    expect(progress.progress).toBe(100)
    const decisions = await adminDb.select().from(schema.deliveryDecisions).where(eq(schema.deliveryDecisions.projectId, Number(state.projectId)))
    expect(decisions[0]).toMatchObject({ status: "resolved", clientVisible: true })
    const requests = await adminDb.select().from(schema.clientRequests).where(eq(schema.clientRequests.clientId, String(state.portalClientId)))
    expect(requests[0].status).toBe("completed")
    const deploymentEvents = await adminDb.select().from(schema.clientTimelineEvents).where(and(eq(schema.clientTimelineEvents.projectId, Number(state.projectId)), eq(schema.clientTimelineEvents.type, "production_deployment_completed")))
    expect(deploymentEvents).toHaveLength(1)
  })

  it("issues an immutable invoice, publishes it, safely records payment and deduplicates delivery", async () => {
    const [invoice] = await adminDb.select().from(schema.invoices).where(eq(schema.invoices.id, Number(state.invoiceId)))
    expect(invoice).toMatchObject({ status: "paid", invoiceNumber: "SS-GOLD-0001" })
    expect(invoice.portalPublishedAt).toBeInstanceOf(Date)
    expect(invoice.documentPdfSha256).toMatch(/^[a-f0-9]{64}$/)
    expect((await adminDb.select().from(schema.invoiceDeliveryAttempts).where(eq(schema.invoiceDeliveryAttempts.invoiceId, invoice.id))).length).toBe(1)
    expect((await adminDb.select().from(schema.invoiceAuditLogs).where(eq(schema.invoiceAuditLogs.invoiceId, invoice.id))).map((row) => row.action)).toEqual(expect.arrayContaining(["invoice_issued", "invoice_portal_published", "invoice_email_sent", "invoice_marked_paid"]))
  })

  it("publishes an immutable monthly report and exposes only the owning client's portal projection", async () => {
    const [report] = await adminDb.select().from(schema.monthlyReports).where(eq(schema.monthlyReports.id, Number(state.reportId)))
    expect(report.status).toBe("published")
    await expect(adminPool.query("update monthly_reports set summary='mutated' where id=$1", [report.id])).rejects.toThrow(/immutable/)
    const portalInvoices = await webPool.query("select invoice_number from invoices i join clients c on c.id=i.client_id where c.portal_client_id=$1 and i.portal_published_at is not null", [state.portalClientId])
    const portalReports = await webPool.query("select title from monthly_reports where client_id=$1 and status='published'", [state.portalClientId])
    const foreignReports = await webPool.query("select title from monthly_reports where client_id=$1 and status='published'", [state.foreignPortalClientId])
    expect(portalInvoices.rows).toEqual([{ invoice_number: "SS-GOLD-0001" }])
    expect(portalReports.rows).toHaveLength(1)
    expect(foreignReports.rows).toHaveLength(0)
    await expect(webPool.query("select * from invoice_audit_logs")).rejects.toMatchObject({ code: "42501" })
  })

  it("enforces RBAC at API policy boundaries", async () => {
    const { authorizeRequest } = await import("../../src/lib/rbac")
    expect(authorizeRequest("viewer", { pathname: "/api/invoices/1", method: "PATCH" }).allowed).toBe(false)
    expect(authorizeRequest("finance", { pathname: "/api/invoices/1", method: "PATCH" }).allowed).toBe(true)
    expect(authorizeRequest("developer", { pathname: "/api/portal-users", method: "POST" }).allowed).toBe(false)
    expect(authorizeRequest("owner", { pathname: "/api/monthly-reports/1", method: "PATCH" }).allowed).toBe(true)
  })
})

async function runGoldenLifecycle() {
  await adminDb.insert(schema.adminUsers).values({ id: actor.id, email: actor.email, displayName: actor.name, passwordHash: await bcrypt.hash("GoldenPath!2026", 4), role: "owner" })
  await adminDb.insert(schema.invoiceSupplierSettings).values({ id: 1, legalName: "ScaleSmiths Ltd", addressLine1: "1 Test Street", city: "Leeds", postcode: "LS1 1AA", country: "United Kingdom", contactEmail: "billing@example.test", paymentInstructions: "Test bank transfer", paymentAccountName: "ScaleSmiths" })
  const [catalogue] = await adminDb.insert(schema.invoiceCatalogueItems).values({ name: "Growth partnership", description: "Monthly delivery", defaultUnitAmount: 50000, position: 1 }).returning()
  const [prospect] = await adminDb.insert(schema.prospects).values({ businessName: "Golden Path Client", contactName: "Alex Client", contactEmail: "alex@golden.example", stage: "won", estimatedProjectValue: 6000, estimatedMonthlyRetainer: 500, wonAt: new Date() }).returning()
  await adminDb.insert(schema.proposalTrackings).values({ prospectId: prospect.id, packageType: "growth", quotedAmount: 600000, monthlyRetainerAmount: 50000, status: "accepted", acceptedAt: new Date() })
  const { executeConversion } = await import("../../src/lib/server/prospect-conversion")
  const options = { client: { mode: "create" as const, name: "Golden Path Client", tier: "Retainer", invoiceClientCode: "GOLD" }, mrr: 50000, catalogueItemIds: [catalogue.id], createProject: true, projectName: "Golden Path Website", onboardingTasks: true, createDraftInvoice: true, preparePortal: false }
  const conversion = await executeConversion(prospect.id, actor, options)
  const retry = await executeConversion(prospect.id, actor, options)
  expect(retry.id).toBe(conversion.id)
  const [client] = await adminDb.select().from(schema.clients).where(eq(schema.clients.id, conversion.clientId))
  await adminDb.update(schema.clients).set({ billingAddressLine1: "2 Client Road", billingCity: "Leeds", billingPostcode: "LS2 2BB", billingCountry: "United Kingdom" }).where(eq(schema.clients.id, client.id))
  const [assignment] = await adminDb.select().from(schema.clientServiceAssignments).where(eq(schema.clientServiceAssignments.clientId, client.id))
  state = { clientId: client.id, projectId: conversion.projectId!, invoiceId: conversion.draftInvoiceId!, portalClientId: "", foreignPortalClientId: "foreign-golden" }

  const { provisionPortalAccount } = await import("../../src/lib/server/portal-users")
  const operationKey = "golden-path-portal-provision"
  const provisioned = await provisionPortalAccount({ clientId: client.id, email: client.contactEmail, sendWelcome: false, operationKey }, actor)
  const replay = await provisionPortalAccount({ clientId: client.id, email: client.contactEmail, sendWelcome: false, operationKey }, actor)
  expect(replay.replayed).toBe(true)
  state.portalClientId = provisioned.portalClientId!
  await adminPool.query("update portal_client_accounts set password_hash=$1,active=true,status='active',activated_at=now(),updated_at=now() where id=$2", [await bcrypt.hash("PortalGolden!2026", 4), provisioned.accountId])
  await adminPool.query("update portal_account_tokens set used_at=now() where account_id=$1 and revoked_at is null", [provisioned.accountId])
  await adminDb.insert(schema.clients).values({ name: "Foreign Client", portalClientId: String(state.foreignPortalClientId), invoiceClientCode: "FOREIGN" })

  const delivery = await import("../../src/lib/server/delivery-project-service")
  const milestones = await adminDb.select().from(schema.deliveryMilestones).where(eq(schema.deliveryMilestones.projectId, conversion.projectId!))
  for (const milestone of milestones) await delivery.updateDeliveryMilestone(conversion.projectId!, milestone.id, { status: "completed" }, actor)
  const decision = await delivery.createDeliveryDecision(conversion.projectId!, { title: "Approve launch", description: "Client approval to deploy.", clientVisible: true }, actor)
  await delivery.updateDeliveryDecision(conversion.projectId!, decision.id, { status: "resolved", resolution: "Approved for production." }, actor)
  const [request] = await adminDb.insert(schema.clientRequests).values({ clientId: String(state.portalClientId), title: "Update launch copy", description: "Final approved wording", status: "in_progress" }).returning()
  await adminDb.insert(schema.clientRequestMessages).values({ requestId: request.id, senderType: "client", senderName: "Alex Client", body: "Please use the approved headline.", visibility: "client_visible" })
  await adminDb.update(schema.clientRequests).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(schema.clientRequests.id, request.id))
  const [forge] = await adminDb.insert(schema.forgeProjects).values({ name: "Golden Forge Build", businessName: "Golden Path Client", clientId: client.id, status: "build" }).returning()
  await adminDb.update(schema.deliveryProjects).set({ clientVisible: true }).where(eq(schema.deliveryProjects.id, conversion.projectId!))
  const forgeDelivery = await import("../../src/lib/server/delivery-forge-integration")
  await forgeDelivery.linkForgeToDeliveryProject(conversion.projectId!, { forgeProjectId: forge.id }, actor)
  await forgeDelivery.projectInternalForgeEvent(forge.id, "build_started", actor)
  await forgeDelivery.projectInternalForgeEvent(forge.id, "deployed", actor)
  await forgeDelivery.projectInternalForgeEvent(forge.id, "deployed", actor)
  await delivery.updateDeliveryProject(conversion.projectId!, { status: "completed", currentPhase: "launch" }, actor)

  const invoiceService = await import("../../src/lib/server/invoices")
  await invoiceService.updateDraftInvoice(Number(state.invoiceId), { clientId: client.id, projectId: conversion.projectId, serviceAssignmentId: assignment.id, items: [{ catalogueItemId: catalogue.id, quantity: 1 }] }, actor.id)
  const issued = await invoiceService.transitionInvoice(Number(state.invoiceId), "issue", actor.id)
  await expect(invoiceService.updateDraftInvoice(issued.id, { items: [{ title: "Mutation", quantity: 1, unitAmount: 1 }] }, actor.id)).rejects.toThrow(/Only draft invoices can be edited/)
  const deliveryService = await import("../../src/lib/server/invoice-delivery")
  await deliveryService.publishInvoiceToPortal(issued.id, actor.id)
  const mail = { async send() { return { id: "local-golden-mail-1" } } }
  await deliveryService.sendInvoiceDelivery({ invoiceId: issued.id, kind: "invoice", recipient: client.contactEmail, operationKey: "golden-invoice-send", actorUserId: actor.id }, mail)
  await deliveryService.sendInvoiceDelivery({ invoiceId: issued.id, kind: "invoice", recipient: client.contactEmail, operationKey: "golden-invoice-send", actorUserId: actor.id }, mail)
  await invoiceService.transitionInvoice(issued.id, "mark_paid", actor.id)

  const now = new Date()
  const generated = await (await import("../../src/lib/server/monthly-report-generator")).generateMonthlyClientReport({ clientId: String(state.portalClientId), month: now.getUTCMonth() + 1, year: now.getUTCFullYear() })
  const [report] = await adminDb.insert(schema.monthlyReports).values({ clientId: String(state.portalClientId), month: now.getUTCMonth() + 1, year: now.getUTCFullYear(), title: generated.title, summary: generated.summary, htmlContent: generated.htmlContent, status: "draft", generatedBy: generated.generatedBy, version: 1, sourceSnapshot: generated.sourceSnapshot, reviewedAt: now, reviewedBy: actor.email }).returning()
  await adminDb.transaction(async (tx) => {
    await tx.update(schema.monthlyReports).set({ status: "published", publishedAt: now, publishedBy: actor.email, updatedAt: now }).where(eq(schema.monthlyReports.id, report.id))
    await tx.insert(schema.monthlyReportAuditLogs).values({ reportId: report.id, clientId: String(state.portalClientId), action: "published", actor: actor.email, metadataJson: { goldenPath: true } })
    await tx.insert(schema.clientTimelineEvents).values({ clientId: String(state.portalClientId), clientRecordId: client.id, projectId: conversion.projectId, sourceDomain: "report", sourceReference: `report:${report.id}:published`, type: "monthly_report_published", title: "Monthly report published", description: generated.title, visibility: "client_visible", createdBy: actor.email, actorType: "admin", actorId: actor.id, actorLabel: actor.name, idempotencyKey: `report:${report.id}:published`, occurredAt: now })
  })
  state.reportId = report.id
  expect(createHash("sha256").update(issued.documentPdf!).digest("hex")).toBe(issued.documentPdfSha256)
}

function roleUrl(base: string, username: string, password: string) { const value = new URL(base); value.username = username; value.password = password; return value.toString() }
