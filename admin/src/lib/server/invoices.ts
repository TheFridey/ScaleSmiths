import "server-only"
import { createHash } from "node:crypto"

import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { InvoiceDomainError, assertDraft, calculateInvoice, defaultInvoiceDates, formatInvoiceNumber, nextInvoiceStatus, normalizeInvoiceClientCode, type InvoiceItemInput } from "@/lib/invoices"
import { buildInvoiceDocumentData, INVOICE_TEMPLATE_VERSION, paymentSnapshot, supplierSnapshot, validateDocumentIdentity } from "@/lib/invoice-document"
import { clientServiceAssignments, clients, deliveryProjects, invoiceAuditLogs, invoiceCatalogueItems, invoiceItems, invoiceSupplierSettings, invoices } from "@/lib/schema"
import { renderInvoicePdf } from "./invoice-pdf"
import { recordClientActivity } from "./client-activity"

type ItemPayload = Partial<InvoiceItemInput> & { catalogueItemId?: number | null }
interface InvoicePayload { clientId?: unknown; projectId?: unknown; serviceAssignmentId?: unknown; invoiceDate?: unknown; dueDate?: unknown; internalNotes?: unknown; customerNotes?: unknown; items?: unknown }

export async function assignClientInvoiceCode(clientId: number, rawCode: unknown) {
  const code = normalizeInvoiceClientCode(rawCode)
  try {
    const [client] = await db.update(clients).set({ invoiceClientCode: code, updatedAt: new Date() })
      .where(and(eq(clients.id, clientId), sql`${clients.invoiceClientCode} is null`)).returning()
    if (!client) throw new InvoiceDomainError("Client code is already assigned and cannot be silently changed.", 409, "client_code_locked")
    return client
  } catch (error) { throwUniqueCode(error) }
}

export async function createInvoice(payload: InvoicePayload, actorUserId: string) {
  return db.transaction((tx) => createInvoiceWithTx(tx, payload, actorUserId))
}

export async function createInvoiceWithTx(tx: AdminDatabaseTransaction, payload: InvoicePayload, actorUserId: string) {
  const clientId = positiveInteger(payload.clientId, "Client")
  const [client] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) throw new InvoiceDomainError("Client not found.", 404, "client_not_found")
  const projectId = optionalPositiveInteger(payload.projectId, "Project")
  const serviceAssignmentId = optionalPositiveInteger(payload.serviceAssignmentId, "Service assignment")
  if (projectId) await requireInvoiceProject(tx, projectId, clientId)
  if (serviceAssignmentId) await requireServiceAssignment(tx, serviceAssignmentId, clientId)

  const dates = invoiceDates(payload)
  const calculation = await resolveItems(tx, payload.items)
  const [invoice] = await tx.insert(invoices).values({
    invoiceNumber: null, clientId, projectId, serviceAssignmentId, sequenceNumber: null, clientCodeSnapshot: client.invoiceClientCode,
    clientNameSnapshot: client.name, billingContactNameSnapshot: client.contactName, billingEmailSnapshot: client.contactEmail,
    billingAddressLine1Snapshot: client.billingAddressLine1, billingAddressLine2Snapshot: client.billingAddressLine2,
    billingCitySnapshot: client.billingCity, billingCountySnapshot: client.billingCounty,
    billingPostcodeSnapshot: client.billingPostcode, billingCountrySnapshot: client.billingCountry,
    currency: "GBP", ...dates, status: "draft", subtotal: calculation.subtotal, total: calculation.total,
    internalNotes: optionalText(payload.internalNotes), customerNotes: optionalText(payload.customerNotes),
  }).returning()
  await tx.insert(invoiceItems).values(calculation.items.map((item) => ({ invoiceId: invoice.id, ...item })))
  await audit(tx, invoice.id, actorUserId, "invoice_created")
  return loadInvoice(tx, invoice.id)
}

export async function createProjectInvoiceDraft(projectId: number, serviceAssignmentId: number, actorUserId: string) {
  return db.transaction(async (tx) => {
    const project = await requireInvoiceProject(tx, projectId)
    if (project.status === "cancelled") throw new InvoiceDomainError("A cancelled project cannot create a new invoice draft.", 409, "project_not_billable")
    const assignment = await requireServiceAssignment(tx, serviceAssignmentId, project.clientId)
    if (!assignment.active || !assignment.catalogueActive) throw new InvoiceDomainError("The selected client service is not active.", 409, "service_not_billable")
    return createInvoiceWithTx(tx, {
      clientId: project.clientId, projectId, serviceAssignmentId,
      internalNotes: `Draft generated from project: ${project.name}`,
      items: [{ catalogueItemId: assignment.catalogueItemId, quantity: 1 }],
    }, actorUserId)
  })
}

export async function updateDraftInvoice(invoiceId: number, payload: InvoicePayload, actorUserId: string) {
  return db.transaction(async (tx) => {
    const current = await getInvoice(tx, invoiceId)
    assertDraft(current.status)
    if (payload.clientId !== undefined && positiveInteger(payload.clientId, "Client") !== current.clientId) throw new InvoiceDomainError("Changing an invoice client is not supported; create a new draft instead.", 409)
    const calculation = payload.items === undefined ? null : await resolveItems(tx, payload.items)
    const dates = invoiceDates(payload, current.invoiceDate, current.dueDate)
    await tx.update(invoices).set({ ...dates, ...(calculation ? { subtotal: calculation.subtotal, total: calculation.total } : {}), internalNotes: optionalText(payload.internalNotes), customerNotes: optionalText(payload.customerNotes), updatedAt: new Date() }).where(eq(invoices.id, invoiceId))
    if (calculation) {
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId))
      await tx.insert(invoiceItems).values(calculation.items.map((item) => ({ invoiceId, ...item })))
    }
    await audit(tx, invoiceId, actorUserId, "invoice_updated")
    return loadInvoice(tx, invoiceId)
  })
}

export async function transitionInvoice(invoiceId: number, action: "issue" | "mark_paid" | "void", actorUserId: string) {
  return db.transaction(async (tx) => {
    const current = await getInvoice(tx, invoiceId)
    const status = nextInvoiceStatus(current.status, action)
    const now = new Date()
    if (status === "issued") return issueDraft(tx, current, actorUserId, now)
    const timestamps = status === "paid" ? { paidAt: now } : { voidedAt: now }
    const [updated] = await tx.update(invoices).set({ status, ...timestamps, updatedAt: now }).where(and(eq(invoices.id, invoiceId), eq(invoices.status, current.status))).returning()
    if (!updated) throw new InvoiceDomainError("Invoice changed concurrently; reload and try again.", 409, "concurrent_change")
    await audit(tx, invoiceId, actorUserId, status === "paid" ? "invoice_marked_paid" : "invoice_voided")
    if (status === "paid") await recordClientActivity(tx, { clientRecordId: updated.clientId, projectId: updated.projectId, sourceDomain: "invoice", sourceReference: `invoice:${invoiceId}:paid`, type: "invoice_paid", title: `${updated.invoiceNumber} paid`, description: "Payment has been recorded for this invoice.", visibility: updated.portalPublishedAt ? "client_visible" : "internal", actor: { type: "admin", id: actorUserId, label: "ScaleSmiths" }, metadata: { invoiceNumber: updated.invoiceNumber }, occurredAt: now, idempotencyKey: `invoice:${invoiceId}:paid` })
    return loadInvoice(tx, invoiceId)
  })
}

async function issueDraft(tx: AdminDatabaseTransaction, current: typeof invoices.$inferSelect, actorUserId: string, now: Date) {
  assertDraft(current.status)
  const persistedItems = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, current.id)).orderBy(invoiceItems.position)
  const calculation = calculateInvoice(persistedItems.map((item) => ({ catalogueItemId: item.catalogueItemId, title: item.title, description: item.description, quantity: item.quantity, unitAmount: item.unitAmount })))
  if (current.dueDate < current.invoiceDate) throw new InvoiceDomainError("Due date cannot be before invoice date.")

  const [settings] = await tx.select().from(invoiceSupplierSettings).where(eq(invoiceSupplierSettings.id, 1)).limit(1)
  if (!settings) throw new InvoiceDomainError("Complete invoice supplier settings before issuing.", 409, "supplier_settings_required")
  const issuedSupplier = supplierSnapshot(settings)
  const issuedPayment = paymentSnapshot(settings)

  const [client] = await tx.update(clients).set({ nextInvoiceSequence: sql`${clients.nextInvoiceSequence} + 1` })
    .where(and(eq(clients.id, current.clientId), sql`${clients.invoiceClientCode} is not null`, sql`${clients.nextInvoiceSequence} <= 9999`))
    .returning({
      name: clients.name, contactName: clients.contactName, contactEmail: clients.contactEmail, invoiceClientCode: clients.invoiceClientCode,
      billingAddressLine1: clients.billingAddressLine1, billingAddressLine2: clients.billingAddressLine2, billingCity: clients.billingCity,
      billingCounty: clients.billingCounty, billingPostcode: clients.billingPostcode, billingCountry: clients.billingCountry,
      sequenceNumber: sql<number>`${clients.nextInvoiceSequence} - 1`,
    })
  if (!client?.invoiceClientCode) throw new InvoiceDomainError("This client needs a permanent invoice code before the draft can be issued.", 409, "client_code_required")
  validateDocumentIdentity(issuedSupplier, { businessName: client.name, contactName: client.contactName, email: client.contactEmail, addressLine1: client.billingAddressLine1, addressLine2: client.billingAddressLine2, city: client.billingCity, county: client.billingCounty, postcode: client.billingPostcode, country: client.billingCountry })
  const invoiceNumber = formatInvoiceNumber(client.invoiceClientCode, client.sequenceNumber)
  const document = buildInvoiceDocumentData({ status: "issued", invoiceNumber, invoiceDate: current.invoiceDate, dueDate: current.dueDate, issuedAt: now, paidAt: null, customerNotes: current.customerNotes, supplier: issuedSupplier, payment: issuedPayment, customer: { businessName: client.name, contactName: client.contactName, email: client.contactEmail, addressLine1: client.billingAddressLine1, addressLine2: client.billingAddressLine2, city: client.billingCity, county: client.billingCounty, postcode: client.billingPostcode, country: client.billingCountry }, items: persistedItems })
  const documentPdf = Buffer.from(await renderInvoicePdf(document))
  const documentPdfSha256 = createHash("sha256").update(documentPdf).digest("hex")
  const [updated] = await tx.update(invoices).set({
    status: "issued", invoiceNumber, sequenceNumber: client.sequenceNumber, issuedAt: now,
    clientCodeSnapshot: client.invoiceClientCode, clientNameSnapshot: client.name,
    billingContactNameSnapshot: client.contactName, billingEmailSnapshot: client.contactEmail,
    billingAddressLine1Snapshot: client.billingAddressLine1, billingAddressLine2Snapshot: client.billingAddressLine2,
    billingCitySnapshot: client.billingCity, billingCountySnapshot: client.billingCounty,
    billingPostcodeSnapshot: client.billingPostcode, billingCountrySnapshot: client.billingCountry,
    documentTemplateVersion: INVOICE_TEMPLATE_VERSION, supplierSnapshot: issuedSupplier, paymentSnapshot: issuedPayment, documentPdf, documentPdfSha256,
    subtotal: calculation.subtotal, total: calculation.total, updatedAt: now,
  }).where(and(eq(invoices.id, current.id), eq(invoices.status, "draft"), sql`${invoices.invoiceNumber} is null`, sql`${invoices.sequenceNumber} is null`)).returning()
  if (!updated) throw new InvoiceDomainError("Invoice changed concurrently; reload and try again.", 409, "concurrent_change")
  await audit(tx, current.id, actorUserId, "invoice_issued", { invoiceNumber, documentTemplateVersion: INVOICE_TEMPLATE_VERSION })
  await recordClientActivity(tx, { clientRecordId: current.clientId, projectId: current.projectId, sourceDomain: "invoice", sourceReference: `invoice:${current.id}:issued`, type: "invoice_issued", title: `${invoiceNumber} issued`, description: "A new invoice has been issued.", visibility: "internal", actor: { type: "admin", id: actorUserId, label: "ScaleSmiths" }, metadata: { invoiceNumber, total: updated.total, currency: updated.currency }, occurredAt: now, idempotencyKey: `invoice:${current.id}:issued` })
  return loadInvoice(tx, current.id)
}

export async function deleteDraftInvoice(invoiceId: number) {
  return db.transaction(async (tx) => {
    const current = await getInvoice(tx, invoiceId)
    assertDraft(current.status)
    await tx.delete(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.status, "draft")))
  })
}

export async function listInvoicesForAdmin() {
  return db.select({ invoice: invoices, projectName: deliveryProjects.name, serviceName: invoiceCatalogueItems.name }).from(invoices)
    .leftJoin(deliveryProjects, eq(invoices.projectId, deliveryProjects.id))
    .leftJoin(clientServiceAssignments, eq(invoices.serviceAssignmentId, clientServiceAssignments.id))
    .leftJoin(invoiceCatalogueItems, eq(clientServiceAssignments.catalogueItemId, invoiceCatalogueItems.id))
    .orderBy(desc(invoices.createdAt)).then((rows) => rows.map(({ invoice, ...links }) => ({ ...invoice, ...links })))
}

export async function loadProjectFinanceSummary(projectId: number) {
  const project = await requireInvoiceProject(db, projectId)
  const [linkedInvoices, assignments] = await Promise.all([
    db.select().from(invoices).where(eq(invoices.projectId, projectId)).orderBy(desc(invoices.createdAt)),
    db.select({ id: clientServiceAssignments.id, active: clientServiceAssignments.active, catalogueItemId: invoiceCatalogueItems.id, name: invoiceCatalogueItems.name, description: invoiceCatalogueItems.description, defaultUnitAmount: invoiceCatalogueItems.defaultUnitAmount })
      .from(clientServiceAssignments).innerJoin(invoiceCatalogueItems, eq(clientServiceAssignments.catalogueItemId, invoiceCatalogueItems.id))
      .where(eq(clientServiceAssignments.clientId, project.clientId)).orderBy(invoiceCatalogueItems.position, invoiceCatalogueItems.name),
  ])
  return { invoices: linkedInvoices, serviceAssignments: assignments }
}

export async function loadInvoiceForAdmin(invoiceId: number) {
  const invoice = await db.transaction((tx) => loadInvoice(tx, invoiceId))
  const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).limit(1)
  return { ...invoice, client: client ?? null }
}

export async function listInvoiceClients() {
  return db.select().from(clients).orderBy(clients.name)
}

export async function listInvoiceCatalogue() {
  return db.select().from(invoiceCatalogueItems).orderBy(invoiceCatalogueItems.position, invoiceCatalogueItems.name)
}

async function resolveItems(tx: AdminDatabaseTransaction, raw: unknown) {
  if (!Array.isArray(raw)) throw new InvoiceDomainError("Invoice items are required.")
  const payloads = raw as ItemPayload[]
  const ids = [...new Set(payloads.map((item) => item.catalogueItemId).filter((id): id is number => Number.isSafeInteger(id)))]
  const catalogue = ids.length ? await tx.select().from(invoiceCatalogueItems).where(inArray(invoiceCatalogueItems.id, ids)) : []
  const byId = new Map(catalogue.map((item) => [item.id, item]))
  const snapshots = payloads.map((item, index): InvoiceItemInput => {
    const template = item.catalogueItemId ? byId.get(item.catalogueItemId) : undefined
    if (item.catalogueItemId && !template) throw new InvoiceDomainError(`Catalogue item ${index + 1} was not found.`)
    return {
      catalogueItemId: template?.id ?? null,
      title: typeof item.title === "string" ? item.title : template?.name ?? "",
      description: item.description !== undefined ? optionalText(item.description) : template?.description ?? null,
      quantity: item.quantity ?? 1,
      unitAmount: item.unitAmount ?? template?.defaultUnitAmount ?? Number.NaN,
    }
  })
  return calculateInvoice(snapshots)
}

async function getInvoice(tx: AdminDatabaseTransaction, id: number) {
  const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1)
  if (!invoice) throw new InvoiceDomainError("Invoice not found.", 404, "not_found")
  return invoice
}
async function requireInvoiceProject(tx: Pick<AdminDatabaseTransaction, "select">, projectId: number, expectedClientId?: number) {
  const [project] = await tx.select({ id: deliveryProjects.id, clientId: deliveryProjects.clientId, name: deliveryProjects.name, status: deliveryProjects.status }).from(deliveryProjects).where(eq(deliveryProjects.id, projectId)).limit(1)
  if (!project) throw new InvoiceDomainError("Project not found.", 404, "project_not_found")
  if (expectedClientId !== undefined && project.clientId !== expectedClientId) throw new InvoiceDomainError("Project belongs to a different client.", 409, "invoice_project_client_mismatch")
  return project
}
async function requireServiceAssignment(tx: Pick<AdminDatabaseTransaction, "select">, assignmentId: number, expectedClientId: number) {
  const [assignment] = await tx.select({ id: clientServiceAssignments.id, clientId: clientServiceAssignments.clientId, active: clientServiceAssignments.active, catalogueItemId: clientServiceAssignments.catalogueItemId, catalogueActive: invoiceCatalogueItems.active }).from(clientServiceAssignments).innerJoin(invoiceCatalogueItems, eq(clientServiceAssignments.catalogueItemId, invoiceCatalogueItems.id)).where(eq(clientServiceAssignments.id, assignmentId)).limit(1)
  if (!assignment) throw new InvoiceDomainError("Client service assignment not found.", 404, "service_assignment_not_found")
  if (assignment.clientId !== expectedClientId) throw new InvoiceDomainError("Service assignment belongs to a different client.", 409, "invoice_service_client_mismatch")
  return assignment
}
async function loadInvoice(tx: AdminDatabaseTransaction, id: number) {
  const invoice = await getInvoice(tx, id)
  return { ...invoice, items: await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(invoiceItems.position) }
}
async function audit(tx: AdminDatabaseTransaction, invoiceId: number, actorUserId: string, action: string, metadataJson: Record<string, unknown> = {}) { await tx.insert(invoiceAuditLogs).values({ invoiceId, actorUserId, action, metadataJson }) }
function positiveInteger(value: unknown, label: string) { const parsed = typeof value === "number" ? value : Number(value); if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new InvoiceDomainError(`${label} id is invalid.`); return parsed }
function optionalPositiveInteger(value: unknown, label: string) { return value === undefined || value === null || value === "" ? null : positiveInteger(value, label) }
function optionalText(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null }
function dateValue(value: unknown, fallback: Date, label: string) { if (value === undefined) return fallback; const date = new Date(String(value)); if (Number.isNaN(date.getTime())) throw new InvoiceDomainError(`${label} is invalid.`); return date }
function invoiceDates(payload: InvoicePayload, existingInvoiceDate?: Date, existingDueDate?: Date) {
  const defaults = defaultInvoiceDates()
  const invoiceDate = dateValue(payload.invoiceDate, existingInvoiceDate ?? defaults.invoiceDate, "Invoice date")
  const dueDate = dateValue(payload.dueDate, existingDueDate ?? (payload.invoiceDate === undefined ? defaults.dueDate : defaultInvoiceDates(invoiceDate).dueDate), "Due date")
  if (dueDate < invoiceDate) throw new InvoiceDomainError("Due date cannot be before invoice date.")
  return { invoiceDate, dueDate }
}
function throwUniqueCode(error: unknown): never { if (error && typeof error === "object" && "code" in error && error.code === "23505") throw new InvoiceDomainError("That invoice client code is already in use.", 409, "duplicate_client_code"); throw error }
