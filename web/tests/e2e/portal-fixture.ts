import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { type Browser, type BrowserContext, type Page } from "@playwright/test"
import { Client } from "pg"
import { hashPortalActivationToken } from "../../src/lib/portal-activation"
import { connectGuardedE2eDatabase } from "./database"
import { rejectNonEssentialStorage } from "./helpers"

export const PORTAL_LIFECYCLE_PASSWORD = "E2e-lifecycle!739"
export const PORTAL_E2E_ENABLED =
  process.env.SCALESMITHS_TEST_ENVIRONMENT === "forge-v2-e2e" && Boolean(process.env.WEB_DATABASE_URL)

const MINIMAL_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<>\n%%EOF\n")
const MINIMAL_PDF_SHA256 = createHash("sha256").update(MINIMAL_PDF).digest("hex")

export interface PortalClientFixture {
  recordId: number
  accountId: number
  portalClientId: string
  email: string
  name: string
  contactFirstName: string
  publishedProjectId: number
  unpublishedProjectId: number
  visibleMilestoneTitle: string
  internalMilestoneTitle: string
  unpublishedProjectName: string
  visibleDocumentId: number
  visibleDocumentTitle: string
  visibleDocumentUrl: string
  internalDocumentTitle: string
  unpublishedDocumentId: number
  unpublishedDocumentTitle: string
  archivedDocumentTitle: string
  publishedReportId: number
  publishedReportTitle: string
  publishedReportPhrase: string
  unpublishedReportId: number
  unpublishedReportTitle: string
  publishedInvoiceNumber: string
  unpublishedInvoiceNumber: string
  visibleRequestId: number
  visibleRequestTitle: string
  visibleReply: string
  internalNote: string
  visibleTimelineTitle: string
  internalTimelineTitle: string
}

export interface PortalInviteeFixture {
  recordId: number
  accountId: number
  portalClientId: string
  email: string
  name: string
  rawToken: string
}

export interface PortalLifecycleFixture {
  password: string
  suffix: string
  clientA: PortalClientFixture
  clientB: PortalClientFixture
  invitee: PortalInviteeFixture
}

export async function loginToPortal(page: Page, email: string, password: string) {
  await page.goto("/portal/login")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: /enter portal/i }).click()
}

export async function clearPortalRateLimits(db: Client) {
  await db.query("delete from login_rate_limits")
  await db.query("delete from web_rate_limits")
}

export async function disablePortalAccount(db: Client, accountId: number) {
  await db.query(
    "update portal_client_accounts set active = false, status = 'disabled', disabled_at = now(), updated_at = now() where id = $1",
    [accountId],
  )
}

export async function markPortalAccountResetRequired(db: Client, accountId: number) {
  const rawToken = randomBytes(32).toString("base64url")
  await db.query(
    "update portal_client_accounts set active = false, status = 'reset_required', updated_at = now() where id = $1",
    [accountId],
  )
  await db.query(
    "update portal_account_tokens set revoked_at = now() where account_id = $1 and used_at is null and revoked_at is null",
    [accountId],
  )
  await db.query(
    "insert into portal_account_tokens (account_id, purpose, token_hash, expires_at, created_by) values ($1, 'reset', $2, now() + interval '48 hours', 'e2e')",
    [accountId, hashPortalActivationToken(rawToken)],
  )
  return rawToken
}

export async function withPortalLifecycleFixture<T>(
  run: (input: { db: Client; fixture: PortalLifecycleFixture; page: Page; context: BrowserContext }) => Promise<T>,
  browser: Browser,
): Promise<T> {
  const db = await connectGuardedE2eDatabase()
  const fixture = await seedPortalLifecycle(db)
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await rejectNonEssentialStorage(page)

  try {
    return await run({ db, fixture, page, context })
  } finally {
    await context.close().catch(() => undefined)
    await cleanupPortalLifecycle(db, fixture).catch(() => undefined)
    await db.end().catch(() => undefined)
  }
}

async function seedPortalLifecycle(db: Client): Promise<PortalLifecycleFixture> {
  await clearPortalRateLimits(db)

  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`
  const passwordHash = await bcrypt.hash(PORTAL_LIFECYCLE_PASSWORD, 4)

  const clientA = await seedOwnedClient(db, {
    suffix,
    key: "a",
    name: "North Workshop",
    contactName: "Alex Client",
    passwordHash,
  })
  const clientB = await seedOwnedClient(db, {
    suffix,
    key: "b",
    name: "South Workshop",
    contactName: "Blair Client",
    passwordHash,
  })
  const invitee = await seedInvitee(db, suffix)

  return {
    password: PORTAL_LIFECYCLE_PASSWORD,
    suffix,
    clientA,
    clientB,
    invitee,
  }
}

async function seedOwnedClient(
  db: Client,
  input: { suffix: string; key: "a" | "b"; name: string; contactName: string; passwordHash: string },
): Promise<PortalClientFixture> {
  const portalClientId = `portal-life-${input.key}-${input.suffix}`
  const email = `portal-life-${input.key}-${input.suffix}@example.test`
  const contactFirstName = input.contactName.split(/\s+/)[0] ?? "Client"
  const visibleMilestoneTitle = `${input.key}-visible-milestone-${input.suffix}`
  const internalMilestoneTitle = `${input.key}-internal-milestone-${input.suffix}`
  const unpublishedProjectName = `${input.key}-unpublished-project-${input.suffix}`
  const visibleDocumentTitle = `${input.key}-visible-doc-${input.suffix}`
  const visibleDocumentUrl = `https://example.test/portal-docs/${input.key}-${input.suffix}`
  const internalDocumentTitle = `${input.key}-internal-doc-${input.suffix}`
  const unpublishedDocumentTitle = `${input.key}-unpublished-doc-${input.suffix}`
  const archivedDocumentTitle = `${input.key}-archived-doc-${input.suffix}`
  const publishedReportTitle = `${input.key}-published-report-${input.suffix}`
  const publishedReportPhrase = `${input.key}-report-body-${input.suffix}`
  const unpublishedReportTitle = `${input.key}-draft-report-${input.suffix}`
  const publishedInvoiceNumber = `SS-${input.key.toUpperCase()}P-${input.suffix}`
  const unpublishedInvoiceNumber = `SS-${input.key.toUpperCase()}U-${input.suffix}`
  const visibleRequestTitle = `${input.key}-visible-request-${input.suffix}`
  const visibleReply = `${input.key}-visible-reply-${input.suffix}`
  const internalNote = `${input.key}-internal-note-${input.suffix}`
  const visibleTimelineTitle = `${input.key}-visible-timeline-${input.suffix}`
  const internalTimelineTitle = `${input.key}-internal-timeline-${input.suffix}`

  const client = await db.query<{ id: number }>(
    "insert into clients (name, contact_name, tier, status, portal_client_id) values ($1, $2, 'Care', 'active', $3) returning id",
    [input.name, input.contactName, portalClientId],
  )
  const recordId = client.rows[0].id
  const account = await db.query<{ id: number }>(
    "insert into portal_client_accounts (client_id, email, password_hash, active, status, activated_at) values ($1, $2, $3, true, 'active', now()) returning id",
    [portalClientId, email, input.passwordHash],
  )

  const publishedProject = await db.query<{ id: number }>(
    `insert into delivery_projects (
      client_id, name, summary, client_visible, status, current_phase, client_status, client_next_step,
      portal_welcome_title, portal_welcome_content
    ) values ($1, $2, $3, true, 'active', 'build', 'build_in_progress', $4, $5, $6) returning id`,
    [
      recordId,
      `${input.name} website`,
      "Published delivery plan for the authenticated client.",
      "Review the staging copy.",
      "Welcome to delivery",
      "Milestones below are the client-visible plan.",
    ],
  )
  const unpublishedProject = await db.query<{ id: number }>(
    "insert into delivery_projects (client_id, name, summary, client_visible, status) values ($1, $2, $3, false, 'active') returning id",
    [recordId, unpublishedProjectName, "Internal-only plan that must not reach the portal."],
  )

  await db.query(
    `insert into delivery_milestones (project_id, title, description, status, client_visible, weight, position, completed_at)
     values ($1, $2, 'Discovery complete.', 'completed', true, 1, 0, now())`,
    [publishedProject.rows[0].id, visibleMilestoneTitle],
  )
  await db.query(
    `insert into delivery_milestones (project_id, title, description, status, client_visible, weight, position)
     values ($1, $2, 'Do not show this milestone.', 'planned', false, 1, 1)`,
    [publishedProject.rows[0].id, internalMilestoneTitle],
  )
  await db.query(
    `insert into delivery_milestones (project_id, title, status, client_visible, weight, position)
     values ($1, $2, 'planned', false, 1, 0)`,
    [unpublishedProject.rows[0].id, `${input.key}-unpublished-milestone-${input.suffix}`],
  )

  const visibleDocument = await db.query<{ id: number }>(
    `insert into client_documents (
      client_id, project_id, document_type, source, title, description, storage_provider, storage_key, visibility, version
    ) values ($1, $2, 'brief', 'link', $3, 'Published handoff notes.', 'external', $4, 'client_visible', 1) returning id`,
    [recordId, publishedProject.rows[0].id, visibleDocumentTitle, visibleDocumentUrl],
  )
  await db.query(
    `insert into client_documents (
      client_id, project_id, document_type, source, title, storage_provider, storage_key, visibility, version
    ) values ($1, $2, 'technical', 'link', $3, 'external', $4, 'internal', 1)`,
    [recordId, publishedProject.rows[0].id, internalDocumentTitle, `${visibleDocumentUrl}/internal`],
  )
  const unpublishedDocument = await db.query<{ id: number }>(
    `insert into client_documents (
      client_id, project_id, document_type, source, title, storage_provider, storage_key, visibility, version
    ) values ($1, $2, 'other', 'link', $3, 'external', $4, 'client_visible', 1) returning id`,
    [recordId, unpublishedProject.rows[0].id, unpublishedDocumentTitle, `${visibleDocumentUrl}/unpublished`],
  )
  await db.query(
    `insert into client_documents (
      client_id, project_id, document_type, source, title, storage_provider, storage_key, visibility, version, archived_at
    ) values ($1, $2, 'report', 'link', $3, 'external', $4, 'client_visible', 1, now())`,
    [recordId, publishedProject.rows[0].id, archivedDocumentTitle, `${visibleDocumentUrl}/archived`],
  )

  const publishedReport = await insertReport(db, {
    portalClientId,
    month: 8,
    year: 2026,
    title: publishedReportTitle,
    summary: "Published monthly overview.",
    html: `<p>${publishedReportPhrase}</p>`,
    publish: true,
  })
  const unpublishedReport = await insertReport(db, {
    portalClientId,
    month: 7,
    year: 2026,
    title: unpublishedReportTitle,
    summary: "Draft that must stay off the portal.",
    html: `<p>${unpublishedReportTitle}</p>`,
    publish: false,
  })

  await insertIssuedInvoice(db, {
    recordId,
    projectId: publishedProject.rows[0].id,
    invoiceNumber: publishedInvoiceNumber,
    sequenceNumber: 1,
    clientName: input.name,
    publish: true,
    title: "Published care",
  })
  await insertIssuedInvoice(db, {
    recordId,
    projectId: publishedProject.rows[0].id,
    invoiceNumber: unpublishedInvoiceNumber,
    sequenceNumber: 2,
    clientName: input.name,
    publish: false,
    title: "Unpublished care",
  })

  const request = await db.query<{ id: number }>(
    "insert into client_requests (client_id, title, description, category, priority, status) values ($1, $2, $3, 'website_update', 'medium', 'in_progress') returning id",
    [portalClientId, visibleRequestTitle, "Please update the hero."],
  )
  await db.query(
    "insert into client_request_messages (request_id, sender_type, sender_name, body, visibility) values ($1, 'client', 'Client', 'Please update the hero.', 'client_visible')",
    [request.rows[0].id],
  )
  await db.query(
    "insert into client_request_messages (request_id, sender_type, sender_name, body, visibility) values ($1, 'admin', 'ScaleSmiths', $2, 'client_visible')",
    [request.rows[0].id, visibleReply],
  )
  await db.query(
    "insert into client_request_messages (request_id, sender_type, sender_name, body, visibility) values ($1, 'admin', 'ScaleSmiths', $2, 'internal')",
    [request.rows[0].id, internalNote],
  )
  await db.query(
    "insert into client_timeline_events (client_id, request_id, type, title, description, visibility, created_by, source_domain) values ($1, $2, 'request_updated', $3, 'A client-visible delivery update.', 'client_visible', 'ScaleSmiths', 'requests')",
    [portalClientId, request.rows[0].id, visibleTimelineTitle],
  )
  await db.query(
    "insert into client_timeline_events (client_id, request_id, type, title, description, visibility, created_by, source_domain) values ($1, $2, 'request_updated', $3, 'Internal-only note.', 'internal', 'ScaleSmiths', 'requests')",
    [portalClientId, request.rows[0].id, internalTimelineTitle],
  )

  return {
    recordId,
    accountId: account.rows[0].id,
    portalClientId,
    email,
    name: input.name,
    contactFirstName,
    publishedProjectId: publishedProject.rows[0].id,
    unpublishedProjectId: unpublishedProject.rows[0].id,
    visibleMilestoneTitle,
    internalMilestoneTitle,
    unpublishedProjectName,
    visibleDocumentId: visibleDocument.rows[0].id,
    visibleDocumentTitle,
    visibleDocumentUrl,
    internalDocumentTitle,
    unpublishedDocumentId: unpublishedDocument.rows[0].id,
    unpublishedDocumentTitle,
    archivedDocumentTitle,
    publishedReportId: publishedReport,
    publishedReportTitle,
    publishedReportPhrase,
    unpublishedReportId: unpublishedReport,
    unpublishedReportTitle,
    publishedInvoiceNumber,
    unpublishedInvoiceNumber,
    visibleRequestId: request.rows[0].id,
    visibleRequestTitle,
    visibleReply,
    internalNote,
    visibleTimelineTitle,
    internalTimelineTitle,
  }
}

async function seedInvitee(db: Client, suffix: string): Promise<PortalInviteeFixture> {
  const portalClientId = `portal-life-invite-${suffix}`
  const email = `portal-life-invite-${suffix}@example.test`
  const name = "Invitee Workshop"
  const rawToken = randomBytes(32).toString("base64url")
  const client = await db.query<{ id: number }>(
    "insert into clients (name, contact_name, status, portal_client_id) values ($1, $2, 'active', $3) returning id",
    [name, "Casey Client", portalClientId],
  )
  const account = await db.query<{ id: number }>(
    "insert into portal_client_accounts (client_id, email, password_hash, active, status, invited_at) values ($1, $2, $3, false, 'invited', now()) returning id",
    [portalClientId, email, "unusable-placeholder"],
  )
  await db.query(
    "insert into portal_account_tokens (account_id, purpose, token_hash, expires_at, created_by) values ($1, 'activation', $2, now() + interval '48 hours', 'e2e')",
    [account.rows[0].id, hashPortalActivationToken(rawToken)],
  )
  return {
    recordId: client.rows[0].id,
    accountId: account.rows[0].id,
    portalClientId,
    email,
    name,
    rawToken,
  }
}

async function insertReport(
  db: Client,
  input: { portalClientId: string; month: number; year: number; title: string; summary: string; html: string; publish: boolean },
) {
  const inserted = await db.query<{ id: number }>(
    `insert into monthly_reports (client_id, month, year, title, summary, html_content, status, generated_by, version, source_snapshot)
     values ($1, $2, $3, $4, $5, $6, 'draft', 'manual', 1, '{}'::jsonb) returning id`,
    [input.portalClientId, input.month, input.year, input.title, input.summary, input.html],
  )
  const id = inserted.rows[0].id
  if (input.publish) {
    await db.query(
      "update monthly_reports set status = 'published', published_at = now(), published_by = 'e2e' where id = $1",
      [id],
    )
  }
  return id
}

async function insertIssuedInvoice(
  db: Client,
  input: {
    recordId: number
    projectId: number
    invoiceNumber: string
    sequenceNumber: number
    clientName: string
    publish: boolean
    title: string
  },
) {
  const invoice = await db.query<{ id: number }>(
    `insert into invoices (
      invoice_number, client_id, project_id, sequence_number, client_name_snapshot, currency, invoice_date, due_date,
      status, subtotal, total, issued_at, document_template_version, supplier_snapshot, payment_snapshot, document_pdf,
      document_pdf_sha256, portal_published_at
    ) values (
      $1, $2, $3, $4, $5, 'GBP', timestamptz '2026-08-01 00:00:00+00', timestamptz '2026-08-15 00:00:00+00',
      'issued', 12000, 12000, now(), 'scalesmiths-v1', '{}'::jsonb, '{}'::jsonb, $6, $7, $8
    ) returning id`,
    [
      input.invoiceNumber,
      input.recordId,
      input.projectId,
      input.sequenceNumber,
      input.clientName,
      MINIMAL_PDF,
      MINIMAL_PDF_SHA256,
      input.publish ? new Date() : null,
    ],
  )
  await db.query(
    "insert into invoice_items (invoice_id, title, description, quantity, unit_amount, line_amount, position) values ($1, $2, $3, 1, 12000, 12000, 0)",
    [invoice.rows[0].id, input.title, input.publish ? "Published portal invoice" : "Issued but unpublished"],
  )
}

async function cleanupPortalLifecycle(db: Client, fixture: PortalLifecycleFixture) {
  const portalIds = [fixture.clientA.portalClientId, fixture.clientB.portalClientId, fixture.invitee.portalClientId]
  const recordIds = [fixture.clientA.recordId, fixture.clientB.recordId, fixture.invitee.recordId]
  const emails = [fixture.clientA.email, fixture.clientB.email, fixture.invitee.email]

  await db.query("delete from invoice_portal_access_events where portal_client_id = any($1::text[])", [portalIds])
  await db.query("delete from client_document_access_events where portal_client_id = any($1::text[])", [portalIds])
  await db.query(
    "delete from invoice_items where invoice_id in (select id from invoices where client_id = any($1::int[]))",
    [recordIds],
  )
  await db.query("delete from invoices where client_id = any($1::int[])", [recordIds])
  await db.query("delete from client_documents where client_id = any($1::int[])", [recordIds])
  await db.query(
    "delete from delivery_milestones where project_id in (select id from delivery_projects where client_id = any($1::int[]))",
    [recordIds],
  )
  await db.query("delete from delivery_projects where client_id = any($1::int[])", [recordIds])
  await db.query("delete from client_timeline_events where client_id = any($1::text[])", [portalIds])
  await db.query("delete from client_requests where client_id = any($1::text[])", [portalIds])
  await db.query(
    `delete from monthly_report_audit_logs
     where client_id = any($1::text[])
       and report_id in (select id from monthly_reports where client_id = any($1::text[]) and status <> 'published')`,
    [portalIds],
  )
  await db.query("delete from monthly_reports where client_id = any($1::text[]) and status <> 'published'", [portalIds])
  await db.query("delete from portal_client_accounts where email = any($1::text[])", [emails])
  await db.query("delete from clients where id = any($1::int[])", [recordIds])
}
