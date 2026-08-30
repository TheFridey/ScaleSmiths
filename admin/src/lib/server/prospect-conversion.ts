import "server-only"

import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  clientServiceAssignments,
  clients,
  deliveryMilestones,
  deliveryProjects,
  invoiceCatalogueItems,
  invoices,
  kanbanCards,
  leadScoreSnapshots,
  outreachActivities,
  proposalTrackings,
  prospectConversions,
  prospects,
  salesProposals,
} from "@/lib/schema"
import {
  ProspectConversionError,
  buildConversionPlan,
  buildOpportunitySnapshot,
  defaultOnboardingTasks,
  matchExistingClients,
  parseConversionOptions,
  type ConversionPlan,
} from "@/lib/prospect-conversion"
import { createDeliveryProjectWithTx, type DeliveryActor } from "@/lib/server/delivery-project-service"
import { createInvoiceWithTx } from "@/lib/server/invoices"
import { prepareDisabledPortalAccountWithTx } from "@/lib/server/portal-users"
import { recordClientActivity } from "@/lib/server/client-activity"

export interface ConversionActor { id: string; email?: string | null; name?: string | null }
export type ProspectConversionRow = typeof prospectConversions.$inferSelect
export interface ConversionPlanResponse extends ConversionPlan {
  catalogue: Array<{ id: number; name: string; defaultUnitAmount: number; category: string | null }>
}

export async function loadConversionRecord(prospectId: number) {
  const [row] = await db.select().from(prospectConversions).where(eq(prospectConversions.prospectId, prospectId)).limit(1)
  return row ?? null
}

async function loadOpportunity(prospectId: number) {
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1)
  if (!prospect) throw new ProspectConversionError("Prospect not found.", 404, "not_found")
  const [activities, trackings, proposals, scores] = await Promise.all([
    db.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId)).orderBy(desc(outreachActivities.createdAt)),
    db.select().from(proposalTrackings).where(eq(proposalTrackings.prospectId, prospectId)).orderBy(desc(proposalTrackings.createdAt)),
    db.select().from(salesProposals).where(eq(salesProposals.prospectId, prospectId)).orderBy(desc(salesProposals.updatedAt)),
    db.select().from(leadScoreSnapshots).where(eq(leadScoreSnapshots.prospectId, prospectId)).orderBy(desc(leadScoreSnapshots.createdAt)).limit(1),
  ])
  return { prospect, activities, trackings, proposals, leadScore: scores[0] ?? null }
}

export function planInputs(data: Awaited<ReturnType<typeof loadOpportunity>>) {
  return {
    prospect: data.prospect as Record<string, unknown> & { id: number },
    activities: data.activities.map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: a.createdAt })),
    proposalTrackings: data.trackings.map((t) => ({ packageType: t.packageType, quotedAmount: t.quotedAmount, monthlyRetainerAmount: t.monthlyRetainerAmount, status: t.status, sentAt: t.sentAt, acceptedAt: t.acceptedAt })),
    salesProposals: data.proposals.map((p) => ({ status: p.status, selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice, packageType: null })),
    leadScore: data.leadScore ? { id: data.leadScore.id, score: data.leadScore.score } : null,
  }
}

export async function previewConversion(prospectId: number, _actor: ConversionActor): Promise<ConversionPlanResponse> {
  const data = await loadOpportunity(prospectId)
  const existing = await loadConversionRecord(prospectId)
  const [allClients, catalogue] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, contactEmail: clients.contactEmail, tier: clients.tier, mrr: clients.mrr }).from(clients),
    db.select({ id: invoiceCatalogueItems.id, name: invoiceCatalogueItems.name, defaultUnitAmount: invoiceCatalogueItems.defaultUnitAmount, category: invoiceCatalogueItems.category, active: invoiceCatalogueItems.active }).from(invoiceCatalogueItems).orderBy(invoiceCatalogueItems.position, invoiceCatalogueItems.name),
  ])
  const matchCandidates = matchExistingClients(
    { businessName: data.prospect.businessName, contactEmail: data.prospect.contactEmail },
    allClients,
  )
  const plan = buildConversionPlan({ ...planInputs(data), matchCandidates, existingConversionId: existing?.id ?? null })
  return { ...plan, catalogue: catalogue.filter((c) => c.active).map(({ active: _a, ...rest }) => rest) }
}

export interface ConversionRecordView extends ProspectConversionRow {
  deliveryProject: { id: number; name: string } | null
  draftInvoice: { id: number; status: string } | null
}

async function enrich(row: ProspectConversionRow): Promise<ConversionRecordView> {
  const deliveryProject = row.projectId
    ? (await db.select({ id: deliveryProjects.id, name: deliveryProjects.name }).from(deliveryProjects).where(eq(deliveryProjects.id, row.projectId)).limit(1))[0] ?? null
    : null
  const draftInvoice = row.draftInvoiceId
    ? (await db.select({ id: invoices.id, status: invoices.status }).from(invoices).where(eq(invoices.id, row.draftInvoiceId)).limit(1))[0] ?? null
    : null
  return { ...row, deliveryProject, draftInvoice }
}

function isPgUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505")
}

export async function executeConversion(prospectId: number, actor: ConversionActor, rawOptions: unknown): Promise<ConversionRecordView> {
  const options = parseConversionOptions(rawOptions)
  const deliveryActor: DeliveryActor = { id: actor.id, email: actor.email ?? null, name: actor.name ?? null }

  const record = await db.transaction(async (tx) => {
    const [prospect] = await tx.select().from(prospects).where(eq(prospects.id, prospectId)).for("update").limit(1)
    if (!prospect) throw new ProspectConversionError("Prospect not found.", 404, "not_found")

    const [existing] = await tx.select().from(prospectConversions).where(eq(prospectConversions.prospectId, prospectId)).limit(1)
    if (existing) return existing

    if (prospect.stage !== "won") throw new ProspectConversionError("Only won opportunities can be converted.", 409, "not_won")

    // 1. client — create or link
    let clientId: number
    let clientAction: "created" | "linked"
    if (options.client.mode === "link") {
      const [linked] = await tx.select({ id: clients.id, tier: clients.tier, invoiceClientCode: clients.invoiceClientCode })
        .from(clients).where(eq(clients.id, options.client.clientId)).limit(1)
      if (!linked) throw new ProspectConversionError("The selected client no longer exists.", 404, "client_not_found")
      clientId = linked.id
      clientAction = "linked"

      // CONTROLLER RULING 1 — one guarded tx.update(clients) on the shared transaction
      const patch: Record<string, unknown> = {}
      if (options.client.tier && !linked.tier) patch.tier = options.client.tier
      if (options.mrr > 0) patch.mrr = options.mrr
      if (options.client.invoiceClientCode && !linked.invoiceClientCode) patch.invoiceClientCode = options.client.invoiceClientCode
      if (Object.keys(patch).length > 0) {
        try {
          await tx.update(clients).set({ ...patch, updatedAt: new Date() }).where(eq(clients.id, clientId))
        } catch (error) {
          if (isPgUniqueViolation(error)) throw new ProspectConversionError("That invoice client code is already in use.", 409, "duplicate_client_code")
          throw error
        }
      }
    } else {
      try {
        const [created] = await tx.insert(clients).values({
          name: options.client.name,
          contactName: prospect.contactName,
          contactEmail: prospect.contactEmail,
          tier: options.client.tier,
          mrr: options.mrr,
          status: "active",
          progress: 0,
          invoiceClientCode: options.client.invoiceClientCode,
          updatedAt: new Date(),
        }).returning({ id: clients.id })
        clientId = created.id
        clientAction = "created"
      } catch (error) {
        if (isPgUniqueViolation(error)) throw new ProspectConversionError("That invoice client code is already in use.", 409, "duplicate_client_code")
        throw error
      }
    }
    const assignedTier = options.client.mode === "create" ? options.client.tier : options.client.tier ?? null

    // 2. service assignments
    const serviceAssignmentIds: number[] = []
    for (const catalogueItemId of options.catalogueItemIds) {
      const [row] = await tx.insert(clientServiceAssignments)
        .values({ clientId, catalogueItemId, sourceProspectId: prospectId, assignedBy: actor.id })
        .onConflictDoNothing({ target: [clientServiceAssignments.clientId, clientServiceAssignments.catalogueItemId] })
        .returning({ id: clientServiceAssignments.id })
      if (row) {
        serviceAssignmentIds.push(row.id)
      } else {
        const [existingAssign] = await tx.select({ id: clientServiceAssignments.id }).from(clientServiceAssignments)
          .where(and(eq(clientServiceAssignments.clientId, clientId), eq(clientServiceAssignments.catalogueItemId, catalogueItemId))).limit(1)
        if (existingAssign) serviceAssignmentIds.push(existingAssign.id)
      }
    }

    // 3. frozen opportunity snapshot
    const [activities, trackings, proposals, scores] = await Promise.all([
      tx.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId)).orderBy(desc(outreachActivities.createdAt)),
      tx.select().from(proposalTrackings).where(eq(proposalTrackings.prospectId, prospectId)).orderBy(desc(proposalTrackings.createdAt)),
      tx.select().from(salesProposals).where(eq(salesProposals.prospectId, prospectId)).orderBy(desc(salesProposals.updatedAt)),
      tx.select().from(leadScoreSnapshots).where(eq(leadScoreSnapshots.prospectId, prospectId)).orderBy(desc(leadScoreSnapshots.createdAt)).limit(1),
    ])
    const opportunitySnapshot = buildOpportunitySnapshot({
      prospect: prospect as Record<string, unknown> & { id: number },
      activities: activities.map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: a.createdAt })),
      proposalTrackings: trackings.map((t) => ({ packageType: t.packageType, quotedAmount: t.quotedAmount, monthlyRetainerAmount: t.monthlyRetainerAmount, status: t.status, sentAt: t.sentAt, acceptedAt: t.acceptedAt })),
      salesProposals: proposals.map((p) => ({ status: p.status, selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice, packageType: null })),
      leadScore: scores[0] ? { id: scores[0].id, score: scores[0].score } : null,
    })

    // 4. delivery project (optional)
    let projectId: number | null = null
    if (options.createProject) {
      const project = await createDeliveryProjectWithTx(tx, {
        clientId,
        name: options.projectName,
        summary: `Converted from opportunity #${prospectId} (${prospect.businessName}).`,
      }, deliveryActor)
      projectId = project.id
    }

    // 5. onboarding tasks (delivery milestones when there is a project, else kanban cards)
    const onboardingTaskIds: number[] = []
    if (options.onboardingTasks) {
      const tasks = defaultOnboardingTasks()
      if (projectId) {
        const rows = await tx.insert(deliveryMilestones).values(tasks.map((task, index) => ({
          projectId: projectId!, title: task.title, status: "planned" as const,
          clientVisible: false, weight: 1, position: index,
        }))).returning({ id: deliveryMilestones.id })
        onboardingTaskIds.push(...rows.map((r) => r.id))
      } else {
        const rows = await tx.insert(kanbanCards).values(tasks.map((task, index) => ({
          title: task.title, clientId, column: "backlog" as const, priority: "med", tag: "onboarding", position: index,
        }))).returning({ id: kanbanCards.id })
        onboardingTaskIds.push(...rows.map((r) => r.id))
      }
    }

    // 6. draft invoice (optional)
    let draftInvoiceId: number | null = null
    if (options.createDraftInvoice) {
      const selected = await tx.select().from(invoiceCatalogueItems).where(inArray(invoiceCatalogueItems.id, options.catalogueItemIds))
      if (selected.length !== options.catalogueItemIds.length) throw new ProspectConversionError("One or more selected services no longer exist.", 409, "catalogue_missing")
      const invoice = await createInvoiceWithTx(tx, {
        clientId,
        items: selected.map((item) => ({ catalogueItemId: item.id, title: item.name, description: item.description ?? null, quantity: 1, unitAmount: item.defaultUnitAmount })),
      }, actor.id)
      draftInvoiceId = invoice.id
    }

    // 7. disabled portal account (optional)
    let portalProvisioningPrepared = false
    let portalAccountId: number | undefined
    if (options.preparePortal) {
      const prepared = await prepareDisabledPortalAccountWithTx(tx, clientId)
      portalProvisioningPrepared = true
      portalAccountId = prepared.portalAccountId
    }

    // 8. conversion record
    const [conversion] = await tx.insert(prospectConversions).values({
      prospectId,
      clientId,
      projectId,
      draftInvoiceId,
      actorUserId: actor.id,
      clientAction,
      assignedTier,
      portalProvisioningPrepared,
      onboardingTaskIds,
      metadataJson: {
        capturedAt: new Date().toISOString(),
        options,
        opportunitySnapshot,
        steps: {
          services: options.catalogueItemIds.length ? "done" : "skipped",
          project: options.createProject ? "done" : "skipped",
          tasks: options.onboardingTasks ? "done" : "skipped",
          invoice: options.createDraftInvoice ? "done" : "skipped",
          portal: options.preparePortal ? "done" : "skipped",
        },
        serviceAssignmentIds,
        ...(portalAccountId ? { portalAccountId } : {}),
      },
    }).returning()

    // 9. prospect link
    await tx.update(prospects).set({
      convertedClientId: clientId,
      wonAt: prospect.wonAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(prospects.id, prospectId))

    // 10. internal timeline event
    await recordClientActivity(tx, {
      clientRecordId: clientId,
      sourceDomain: "manual",
      sourceReference: `prospect-conversion:${prospectId}`,
      type: "prospect_converted",
      title: "Converted from opportunity",
      description: `${prospect.businessName} was converted from opportunity #${prospectId}.`,
      visibility: "internal",
      actor: { type: "admin", id: actor.id, label: actor.name ?? actor.email ?? "ScaleSmiths" },
      metadata: { prospectId, clientAction },
      idempotencyKey: `prospect-conversion:${prospectId}`,
    })

    return conversion
  })

  return enrich(record)
}
