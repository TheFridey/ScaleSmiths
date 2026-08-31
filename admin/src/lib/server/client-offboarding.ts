import "server-only"
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm"
import { CLIENT_OFFBOARDING_CHECKLIST, CLIENT_OFFBOARDING_CHECKLIST_VERSION, isOffboardingItemStatus, validateOffboardingCompletion } from "@/lib/client-offboarding"
import { db } from "@/lib/db"
import { clientAnalyticsConfigs, clientDocuments, clientOffboardingAuditLogs, clientOffboardingCases, clientOffboardingItems, clientRequests, clients, clientServiceAssignments, deliveryOnboardingItems, deliveryProjects, deliveryResources, forgeProjects, invoices } from "@/lib/schema"

export class ClientOffboardingError extends Error {
  constructor(public safeMessage: string, public status = 400, public code = "offboarding_invalid") { super(safeMessage) }
}
type Actor = { id: string; email: string; displayName: string }

export async function getClientOffboarding(clientId: number) {
  const [client] = await db.select({ id: clients.id, name: clients.name, status: clients.status, portalClientId: clients.portalClientId }).from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) throw new ClientOffboardingError("Client not found.", 404, "client_not_found")
  const cases = await db.select().from(clientOffboardingCases).where(eq(clientOffboardingCases.clientId, clientId)).orderBy(desc(clientOffboardingCases.createdAt))
  const active = cases.find((item) => ["draft", "in_progress", "ready"].includes(item.status)) ?? cases[0] ?? null
  if (!active) return { client, case: null, items: [], audit: [], assessment: await assessClientOffboarding(clientId, client.portalClientId) }
  const [items, audit] = await Promise.all([
    db.select().from(clientOffboardingItems).where(eq(clientOffboardingItems.caseId, active.id)).orderBy(clientOffboardingItems.id),
    db.select().from(clientOffboardingAuditLogs).where(eq(clientOffboardingAuditLogs.caseId, active.id)).orderBy(desc(clientOffboardingAuditLogs.createdAt)),
  ])
  return { client, case: active, items, audit, assessment: active.assessmentSnapshot }
}

export async function startClientOffboarding(clientId: number, input: Record<string, unknown>, actor: Actor) {
  const [client] = await db.select({ id: clients.id, name: clients.name, portalClientId: clients.portalClientId }).from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) throw new ClientOffboardingError("Client not found.", 404, "client_not_found")
  const assessment = await assessClientOffboarding(clientId, client.portalClientId)
  const commercialEndAt = dateValue(input.commercialEndAt, "Commercial end date")
  const retentionReviewAt = dateValue(input.retentionReviewAt, "Retention review date")
  if (!retentionReviewAt) throw new ClientOffboardingError("A retention review date is required.")
  const retentionNotes = textValue(input.retentionNotes, 4000)
  const productionHandoffNotes = textValue(input.productionHandoffNotes, 4000)
  if (!retentionNotes) throw new ClientOffboardingError("Retention basis and exceptions are required.")
  if (!productionHandoffNotes) throw new ClientOffboardingError("Production ownership and handoff notes are required.")
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(clientOffboardingCases).values({ clientId, status: "in_progress", checklistVersion: CLIENT_OFFBOARDING_CHECKLIST_VERSION, assessmentSnapshot: assessment, commercialEndAt, retentionReviewAt, retentionNotes, productionHandoffNotes, createdBy: actor.id }).returning()
      await tx.insert(clientOffboardingItems).values(CLIENT_OFFBOARDING_CHECKLIST.map((item) => ({ caseId: created.id, itemKey: item.key, category: item.category, title: item.title, destructive: item.destructive })))
      await tx.insert(clientOffboardingAuditLogs).values({ caseId: created.id, clientId, actorUserId: actor.id, action: "offboarding_started", metadataJson: { checklistVersion: CLIENT_OFFBOARDING_CHECKLIST_VERSION, assessment } })
      return created
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new ClientOffboardingError("This client already has an active offboarding case.", 409, "offboarding_exists")
    throw error
  }
}

export async function updateOffboardingItem(clientId: number, caseId: number, itemId: number, input: Record<string, unknown>, actor: Actor) {
  const status = input.status
  if (!isOffboardingItemStatus(status)) throw new ClientOffboardingError("Select a valid checklist status.")
  const [offboardingCase] = await db.select().from(clientOffboardingCases).where(and(eq(clientOffboardingCases.id, caseId), eq(clientOffboardingCases.clientId, clientId))).limit(1)
  if (!offboardingCase || !["draft", "in_progress", "ready"].includes(offboardingCase.status)) throw new ClientOffboardingError("The active offboarding case was not found.", 404)
  const [item] = await db.select().from(clientOffboardingItems).where(and(eq(clientOffboardingItems.id, itemId), eq(clientOffboardingItems.caseId, caseId))).limit(1)
  if (!item) throw new ClientOffboardingError("Checklist item not found.", 404)
  const blocker = textValue(input.blocker, 2000)
  const evidence = textValue(input.evidence, 4000)
  if (status === "blocked" && !blocker) throw new ClientOffboardingError("A blocker is required for blocked checklist items.")
  if (status === "completed" && !evidence) throw new ClientOffboardingError("Completion evidence is required.")
  if (item.destructive && status === "completed" && input.confirmation !== `CONFIRM ${item.itemKey}`) throw new ClientOffboardingError(`Type CONFIRM ${item.itemKey} to confirm this destructive or access-removal check.`)
  return db.transaction(async (tx) => {
    const now = new Date()
    const [updated] = await tx.update(clientOffboardingItems).set({ status, blocker, evidence, completedAt: status === "completed" ? now : null, completedBy: status === "completed" ? actor.id : null, updatedAt: now }).where(eq(clientOffboardingItems.id, item.id)).returning()
    const remaining = await tx.select({ status: clientOffboardingItems.status }).from(clientOffboardingItems).where(eq(clientOffboardingItems.caseId, caseId))
    const ready = remaining.every((row) => ["completed", "not_applicable"].includes(row.status))
    await tx.update(clientOffboardingCases).set({ status: ready ? "ready" : "in_progress", updatedAt: now }).where(eq(clientOffboardingCases.id, caseId))
    await tx.insert(clientOffboardingAuditLogs).values({ caseId, clientId, actorUserId: actor.id, action: "checklist_item_updated", metadataJson: { itemKey: item.itemKey, previousStatus: item.status, status, destructive: item.destructive, evidenceRecorded: Boolean(evidence) } })
    return updated
  })
}

export async function completeClientOffboarding(clientId: number, caseId: number, input: Record<string, unknown>, actor: Actor) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  const [offboardingCase] = await db.select().from(clientOffboardingCases).where(and(eq(clientOffboardingCases.id, caseId), eq(clientOffboardingCases.clientId, clientId))).limit(1)
  if (!client || !offboardingCase) throw new ClientOffboardingError("Offboarding case not found.", 404)
  const items = await db.select().from(clientOffboardingItems).where(eq(clientOffboardingItems.caseId, caseId))
  const invalid = validateOffboardingCompletion({ caseStatus: offboardingCase.status, clientName: client.name, confirmation: input.confirmation, productionAction: input.productionAction, items })
  if (invalid) throw new ClientOffboardingError(invalid, 409, "completion_not_confirmed")

  return db.transaction(async (tx) => {
    const now = new Date()
    const projects = await tx.select({ id: deliveryProjects.id, forgeProjectId: deliveryProjects.forgeProjectId }).from(deliveryProjects).where(eq(deliveryProjects.clientId, clientId))
    const projectIds = projects.map((project) => project.id)
    const forgeIds = projects.map((project) => project.forgeProjectId).filter((id): id is number => id !== null)
    await tx.update(clients).set({ status: "archived", mrr: 0, updatedAt: now }).where(eq(clients.id, clientId))
    await tx.update(clientServiceAssignments).set({ active: false }).where(eq(clientServiceAssignments.clientId, clientId))
    await tx.update(clientAnalyticsConfigs).set({ enabled: false, credentialsEncrypted: null, updatedAt: now }).where(eq(clientAnalyticsConfigs.clientId, clientId))
    if (client.portalClientId) {
      await tx.execute(sql`UPDATE portal_client_accounts SET active=false,status='disabled',disabled_at=${now},updated_at=${now} WHERE client_id=${client.portalClientId}`)
      await tx.execute(sql`UPDATE portal_account_tokens SET revoked_at=${now} WHERE account_id IN (SELECT id FROM portal_client_accounts WHERE client_id=${client.portalClientId}) AND used_at IS NULL AND revoked_at IS NULL`)
      await tx.update(clientRequests).set({ status: "cancelled", updatedAt: now }).where(and(eq(clientRequests.clientId, client.portalClientId), ne(clientRequests.status, "completed"), ne(clientRequests.status, "cancelled")))
    }
    if (projectIds.length) {
      await tx.update(deliveryOnboardingItems).set({ status: "not_required", completedAt: null, blocker: null, updatedAt: now }).where(and(inArray(deliveryOnboardingItems.projectId, projectIds), ne(deliveryOnboardingItems.status, "completed"), ne(deliveryOnboardingItems.status, "not_required")))
      await tx.update(deliveryProjects).set({ status: "cancelled", clientVisible: false, clientStagingVisible: false, clientNextStep: "Commercial relationship ended; refer to the recorded handoff.", completedAt: null, updatedAt: now }).where(and(eq(deliveryProjects.clientId, clientId), inArray(deliveryProjects.status, ["active", "paused"])))
    }
    if (forgeIds.length) await tx.update(forgeProjects).set({ status: "archived", updatedAt: now }).where(and(inArray(forgeProjects.id, forgeIds), ne(forgeProjects.status, "archived")))
    const [completed] = await tx.update(clientOffboardingCases).set({ status: "completed", completedBy: actor.id, completedAt: now, updatedAt: now }).where(eq(clientOffboardingCases.id, caseId)).returning()
    await tx.insert(clientOffboardingAuditLogs).values({ caseId, clientId, actorUserId: actor.id, action: "offboarding_completed", metadataJson: { portalDisabled: Boolean(client.portalClientId), projectIds, forgeProjectIds: forgeIds, analyticsCredentialsRemoved: true, productionAction: "left_untouched", financialRecordsDeleted: false, recordsDeleted: false } })
    return completed
  })
}

export async function reactivateClient(clientId: number, caseId: number, input: Record<string, unknown>, actor: Actor) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  const [offboardingCase] = await db.select().from(clientOffboardingCases).where(and(eq(clientOffboardingCases.id, caseId), eq(clientOffboardingCases.clientId, clientId))).limit(1)
  if (!client || !offboardingCase || offboardingCase.status !== "completed") throw new ClientOffboardingError("A completed offboarding case is required for reactivation.", 409)
  if (input.confirmation !== `REACTIVATE ${client.name}`) throw new ClientOffboardingError(`Type REACTIVATE ${client.name} to confirm reactivation.`)
  return db.transaction(async (tx) => {
    const now = new Date()
    await tx.update(clients).set({ status: "active", updatedAt: now }).where(eq(clients.id, clientId))
    const [updated] = await tx.update(clientOffboardingCases).set({ status: "reactivated", reactivatedBy: actor.id, reactivatedAt: now, updatedAt: now }).where(eq(clientOffboardingCases.id, caseId)).returning()
    await tx.insert(clientOffboardingAuditLogs).values({ caseId, clientId, actorUserId: actor.id, action: "client_reactivated", metadataJson: { portalRemainsDisabled: true, servicesRemainInactive: true, projectsRemainClosed: true } })
    return updated
  })
}

async function assessClientOffboarding(clientId: number, portalClientId: string | null) {
  const projects = await db.select({ id: deliveryProjects.id }).from(deliveryProjects).where(eq(deliveryProjects.clientId, clientId))
  const projectIds = projects.map((project) => project.id)
  const portalAccounts = portalClientId ? await db.execute(sql`SELECT count(*)::int count FROM portal_client_accounts WHERE client_id=${portalClientId} AND active=true`) : { rows: [{ count: 0 }] }
  const [services, outstandingInvoices, activeProjects, activeRequests, futureTasks, documents, resources, credentialConfigs] = await Promise.all([
    db.select({ id: clientServiceAssignments.id }).from(clientServiceAssignments).where(and(eq(clientServiceAssignments.clientId, clientId), eq(clientServiceAssignments.active, true))),
    db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, total: invoices.total }).from(invoices).where(and(eq(invoices.clientId, clientId), eq(invoices.status, "issued"))),
    db.select({ id: deliveryProjects.id }).from(deliveryProjects).where(and(eq(deliveryProjects.clientId, clientId), inArray(deliveryProjects.status, ["active", "paused"]))),
    portalClientId ? db.select({ id: clientRequests.id }).from(clientRequests).where(and(eq(clientRequests.clientId, portalClientId), ne(clientRequests.status, "completed"), ne(clientRequests.status, "cancelled"))) : Promise.resolve([]),
    projectIds.length ? db.select({ id: deliveryOnboardingItems.id }).from(deliveryOnboardingItems).where(and(inArray(deliveryOnboardingItems.projectId, projectIds), ne(deliveryOnboardingItems.status, "completed"), ne(deliveryOnboardingItems.status, "not_required"))) : Promise.resolve([]),
    db.select({ id: clientDocuments.id }).from(clientDocuments).where(eq(clientDocuments.clientId, clientId)),
    projectIds.length ? db.select({ id: deliveryResources.id }).from(deliveryResources).where(inArray(deliveryResources.projectId, projectIds)) : Promise.resolve([]),
    db.select({ id: clientAnalyticsConfigs.id }).from(clientAnalyticsConfigs).where(and(eq(clientAnalyticsConfigs.clientId, clientId), sql`${clientAnalyticsConfigs.credentialsEncrypted} is not null`)),
  ])
  return { assessedAt: new Date().toISOString(), activePortalAccounts: Number(portalAccounts.rows[0]?.count ?? 0), activeServices: services.length, outstandingInvoices, activeProjects: activeProjects.length, activeRequests: activeRequests.length, futureTasks: futureTasks.length, hostedDocuments: documents.length, linkedResources: resources.length, storedCredentialConfigurations: credentialConfigs.length, productionResourcesWillNotBeModified: true }
}

function textValue(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null }
function dateValue(value: unknown, label: string) { if (!value) return null; const date = new Date(String(value)); if (Number.isNaN(date.getTime())) throw new ClientOffboardingError(`${label} is invalid.`); return date }
function isUniqueViolation(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505") }
