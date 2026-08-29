import "server-only"

import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  adminUsers,
  clientTimelineEvents,
  clients,
  deliveryDecisions,
  deliveryDeliverables,
  deliveryMilestones,
  deliveryProjectAuditLogs,
  deliveryProjectProgress,
  deliveryProjects,
  deliveryResources,
  forgeDeploymentCandidates,
  forgeProjects,
} from "@/lib/schema"
import {
  assertMilestoneTransition,
  assertDeliverableTransition,
  assertProjectTransition,
  booleanValue,
  calculateProjectProgress,
  DELIVERY_DECISION_STATUSES,
  DELIVERY_DELIVERABLE_STATUSES,
  DELIVERY_MILESTONE_STATUSES,
  DELIVERY_PROJECT_PHASES,
  DELIVERY_PROJECT_STATUSES,
  DeliveryProjectError,
  enumValue,
  optionalDate,
  optionalPositiveId,
  optionalUuid,
  optionalText,
  positionValue,
  requiredText,
  weightValue,
} from "@/lib/delivery-projects"

export interface DeliveryActor { id: string; email?: string | null; name?: string | null }

export async function listDeliveryProjectsForAdmin() {
  const rows = await db.select({
    project: deliveryProjects,
    clientName: clients.name,
    ownerName: adminUsers.displayName,
  }).from(deliveryProjects)
    .innerJoin(clients, eq(deliveryProjects.clientId, clients.id))
    .leftJoin(adminUsers, eq(deliveryProjects.ownerUserId, adminUsers.id))
    .orderBy(desc(deliveryProjects.updatedAt))

  const progressRows = rows.length
    ? await db.select().from(deliveryProjectProgress).where(inArray(deliveryProjectProgress.projectId, rows.map(({ project }) => project.id)))
    : []

  return rows.map(({ project, clientName, ownerName }) => ({
    ...project,
    clientName,
    ownerName,
    progress: progressRows.find((entry) => entry.projectId === project.id)?.progress ?? 0,
  }))
}

export async function getDeliveryProjectForAdmin(projectId: number) {
  const [row] = await db.select({
    project: deliveryProjects,
    clientName: clients.name,
    portalClientId: clients.portalClientId,
    ownerName: adminUsers.displayName,
    forgeProjectName: forgeProjects.name,
    deploymentCandidateNumber: forgeDeploymentCandidates.candidateNumber,
  }).from(deliveryProjects)
    .innerJoin(clients, eq(deliveryProjects.clientId, clients.id))
    .leftJoin(adminUsers, eq(deliveryProjects.ownerUserId, adminUsers.id))
    .leftJoin(forgeProjects, eq(deliveryProjects.forgeProjectId, forgeProjects.id))
    .leftJoin(forgeDeploymentCandidates, eq(deliveryProjects.deploymentCandidateId, forgeDeploymentCandidates.id))
    .where(eq(deliveryProjects.id, projectId)).limit(1)
  if (!row) throw new DeliveryProjectError("Project not found.", 404)

  const [milestones, deliverables, resources, decisions, audit] = await Promise.all([
    db.select().from(deliveryMilestones).where(eq(deliveryMilestones.projectId, projectId)).orderBy(asc(deliveryMilestones.position), asc(deliveryMilestones.id)),
    db.select().from(deliveryDeliverables).where(eq(deliveryDeliverables.projectId, projectId)).orderBy(asc(deliveryDeliverables.position), asc(deliveryDeliverables.id)),
    db.select().from(deliveryResources).where(eq(deliveryResources.projectId, projectId)).orderBy(desc(deliveryResources.createdAt)),
    db.select().from(deliveryDecisions).where(eq(deliveryDecisions.projectId, projectId)).orderBy(desc(deliveryDecisions.createdAt)),
    db.select().from(deliveryProjectAuditLogs).where(eq(deliveryProjectAuditLogs.projectId, projectId)).orderBy(desc(deliveryProjectAuditLogs.createdAt)).limit(100),
  ])

  const [progressRow] = await db.select({ progress: deliveryProjectProgress.progress }).from(deliveryProjectProgress).where(eq(deliveryProjectProgress.projectId, projectId)).limit(1)
  return { ...row, progress: progressRow?.progress ?? calculateProjectProgress(milestones), milestones, deliverables, resources, decisions, audit }
}

export async function getDeliveryProjectLinkForForge(forgeProjectId: number) {
  const [project] = await db.select({ id: deliveryProjects.id, name: deliveryProjects.name, status: deliveryProjects.status, currentPhase: deliveryProjects.currentPhase })
    .from(deliveryProjects).where(eq(deliveryProjects.forgeProjectId, forgeProjectId)).limit(1)
  return project ?? null
}

export async function createDeliveryProject(input: Record<string, unknown>, actor: DeliveryActor) {
  const clientId = optionalPositiveId(input.clientId, "Client ID")
  if (!clientId) throw new DeliveryProjectError("Client ID is required.")
  const values = {
    clientId,
    name: requiredText(input.name, "Project name"),
    summary: optionalText(input.summary, 2000),
    internalNotes: optionalText(input.internalNotes, 4000),
    clientVisible: booleanValue(input.clientVisible, false),
    currentPhase: input.currentPhase ? enumValue(input.currentPhase, DELIVERY_PROJECT_PHASES, "Current phase") : "discovery" as const,
    ownerUserId: optionalUuid(input.ownerUserId, "Owner user ID"),
    targetStartDate: optionalDate(input.targetStartDate, "Target start date"),
    targetEndDate: optionalDate(input.targetEndDate, "Target end date"),
    forgeProjectId: optionalPositiveId(input.forgeProjectId, "Forge project ID"),
    deploymentCandidateId: optionalPositiveId(input.deploymentCandidateId, "Deployment candidate ID"),
  }
  assertDateOrder(values.targetStartDate, values.targetEndDate)

  return db.transaction(async (tx) => {
    await assertClientAndLinkage(tx, values.clientId, values.forgeProjectId, values.deploymentCandidateId)
    await assertOwner(tx, values.ownerUserId)
    const [project] = await tx.insert(deliveryProjects).values(values).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId: project.id, actorUserId: actor.id, action: "project_created", metadataJson: { clientId, phase: project.currentPhase, clientVisible: project.clientVisible } })
    if (project.clientVisible) await publishTimeline(tx, project, actor, "project_published", project.name, project.summary ?? "A new delivery project has been published.")
    return project
  })
}

export async function updateDeliveryProject(projectId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(deliveryProjects).where(eq(deliveryProjects.id, projectId)).limit(1)
    if (!current) throw new DeliveryProjectError("Project not found.", 404)
    const status = input.status === undefined ? current.status : enumValue(input.status, DELIVERY_PROJECT_STATUSES, "Project status")
    const currentPhase = input.currentPhase === undefined ? current.currentPhase : enumValue(input.currentPhase, DELIVERY_PROJECT_PHASES, "Current phase")
    assertProjectTransition(current.status, status)
    if (status === "completed") {
      const projectMilestones = await tx.select({ status: deliveryMilestones.status }).from(deliveryMilestones).where(eq(deliveryMilestones.projectId, projectId))
      if (!projectMilestones.some((milestone) => milestone.status === "completed")) throw new DeliveryProjectError("Complete at least one milestone before completing the project.", 409)
      if (projectMilestones.some((milestone) => ["planned", "active", "blocked"].includes(milestone.status))) throw new DeliveryProjectError("Complete or skip every milestone before completing the project.", 409)
    }
    const targetStartDate = input.targetStartDate === undefined ? current.targetStartDate : optionalDate(input.targetStartDate, "Target start date")
    const targetEndDate = input.targetEndDate === undefined ? current.targetEndDate : optionalDate(input.targetEndDate, "Target end date")
    assertDateOrder(targetStartDate, targetEndDate)
    const forgeProjectId = input.forgeProjectId === undefined ? current.forgeProjectId : optionalPositiveId(input.forgeProjectId, "Forge project ID")
    const deploymentCandidateId = input.deploymentCandidateId === undefined ? current.deploymentCandidateId : optionalPositiveId(input.deploymentCandidateId, "Deployment candidate ID")
    const ownerUserId = input.ownerUserId === undefined ? current.ownerUserId : optionalUuid(input.ownerUserId, "Owner user ID")
    await assertClientAndLinkage(tx, current.clientId, forgeProjectId, deploymentCandidateId)
    await assertOwner(tx, ownerUserId)

    const [updated] = await tx.update(deliveryProjects).set({
      name: input.name === undefined ? current.name : requiredText(input.name, "Project name"),
      summary: input.summary === undefined ? current.summary : optionalText(input.summary, 2000),
      internalNotes: input.internalNotes === undefined ? current.internalNotes : optionalText(input.internalNotes, 4000),
      clientVisible: input.clientVisible === undefined ? current.clientVisible : booleanValue(input.clientVisible, current.clientVisible),
      status,
      currentPhase,
      ownerUserId,
      targetStartDate,
      targetEndDate,
      completedAt: status === "completed" ? current.completedAt ?? new Date() : null,
      forgeProjectId,
      deploymentCandidateId,
      updatedAt: new Date(),
    }).where(eq(deliveryProjects.id, projectId)).returning()

    const changes = changedFields(current, updated, ["name", "summary", "internalNotes", "clientVisible", "status", "currentPhase", "ownerUserId", "targetStartDate", "targetEndDate", "forgeProjectId", "deploymentCandidateId"])
    if (changes.length) await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "project_updated", metadataJson: { changes } })
    if (current.status !== status || current.currentPhase !== currentPhase) {
      await publishTimeline(tx, updated, actor, "project_status_changed", `${updated.name}: ${humanise(currentPhase)}`, `Project is ${humanise(status)} in the ${humanise(currentPhase)} phase.`)
    } else if (!current.clientVisible && updated.clientVisible) {
      await publishTimeline(tx, updated, actor, "project_published", updated.name, updated.summary ?? "This delivery project is now available in your portal.")
    }
    return updated
  })
}

export async function createDeliveryMilestone(projectId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, projectId)
    const status = "planned" as const
    const [milestone] = await tx.insert(deliveryMilestones).values({
      projectId,
      title: requiredText(input.title, "Milestone title"),
      description: optionalText(input.description, 2000),
      internalNotes: optionalText(input.internalNotes, 4000),
      status,
      clientVisible: booleanValue(input.clientVisible, false),
      weight: weightValue(input.weight),
      position: positionValue(input.position),
      targetDate: optionalDate(input.targetDate, "Target date"),
      completedAt: null,
    }).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "milestone_created", metadataJson: { milestoneId: milestone.id, status, clientVisible: milestone.clientVisible } })
    if (milestone.clientVisible) await publishTimeline(tx, project, actor, "project_milestone_created", milestone.title, milestone.description ?? "A new project milestone has been published.")
    return milestone
  })
}

export async function updateDeliveryMilestone(projectId: number, milestoneId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, projectId)
    const [current] = await tx.select().from(deliveryMilestones).where(and(eq(deliveryMilestones.id, milestoneId), eq(deliveryMilestones.projectId, projectId))).limit(1)
    if (!current) throw new DeliveryProjectError("Milestone not found.", 404)
    const status = input.status === undefined ? current.status : enumValue(input.status, DELIVERY_MILESTONE_STATUSES, "Milestone status")
    assertMilestoneTransition(current.status, status)
    const [updated] = await tx.update(deliveryMilestones).set({
      title: input.title === undefined ? current.title : requiredText(input.title, "Milestone title"),
      description: input.description === undefined ? current.description : optionalText(input.description, 2000),
      internalNotes: input.internalNotes === undefined ? current.internalNotes : optionalText(input.internalNotes, 4000),
      status,
      clientVisible: input.clientVisible === undefined ? current.clientVisible : booleanValue(input.clientVisible, current.clientVisible),
      weight: input.weight === undefined ? current.weight : weightValue(input.weight),
      position: input.position === undefined ? current.position : positionValue(input.position),
      targetDate: input.targetDate === undefined ? current.targetDate : optionalDate(input.targetDate, "Target date"),
      completedAt: status === "completed" ? current.completedAt ?? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(deliveryMilestones.id, milestoneId)).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "milestone_updated", metadataJson: { milestoneId, fromStatus: current.status, toStatus: status, clientVisible: updated.clientVisible } })
    if (updated.clientVisible && (current.status !== status || !current.clientVisible)) {
      await publishTimeline(tx, project, actor, "project_milestone_changed", updated.title, `Milestone is now ${humanise(status)}.`)
    }
    return updated
  })
}

export async function createDeliveryDeliverable(projectId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    await requireProject(tx, projectId)
    const milestoneId = optionalPositiveId(input.milestoneId, "Milestone ID")
    if (milestoneId) await requireMilestone(tx, projectId, milestoneId)
    const status = "planned" as const
    const ownerUserId = optionalUuid(input.ownerUserId, "Owner user ID")
    await assertOwner(tx, ownerUserId)
    const [deliverable] = await tx.insert(deliveryDeliverables).values({
      projectId, milestoneId, title: requiredText(input.title, "Deliverable title"), description: optionalText(input.description, 2000),
      internalNotes: optionalText(input.internalNotes, 4000), status, clientVisible: booleanValue(input.clientVisible, false),
      ownerUserId,
      targetDate: optionalDate(input.targetDate, "Target date"), position: positionValue(input.position),
      completedAt: null,
    }).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "deliverable_created", metadataJson: { deliverableId: deliverable.id, milestoneId, status } })
    return deliverable
  })
}

export async function updateDeliveryDeliverable(projectId: number, deliverableId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    await requireProject(tx, projectId)
    const [current] = await tx.select().from(deliveryDeliverables).where(and(eq(deliveryDeliverables.id, deliverableId), eq(deliveryDeliverables.projectId, projectId))).limit(1)
    if (!current) throw new DeliveryProjectError("Deliverable not found.", 404)
    const milestoneId = input.milestoneId === undefined ? current.milestoneId : optionalPositiveId(input.milestoneId, "Milestone ID")
    if (milestoneId) await requireMilestone(tx, projectId, milestoneId)
    const status = input.status === undefined ? current.status : enumValue(input.status, DELIVERY_DELIVERABLE_STATUSES, "Deliverable status")
    assertDeliverableTransition(current.status, status)
    const ownerUserId = input.ownerUserId === undefined ? current.ownerUserId : optionalUuid(input.ownerUserId, "Owner user ID")
    await assertOwner(tx, ownerUserId)
    const [updated] = await tx.update(deliveryDeliverables).set({
      milestoneId, title: input.title === undefined ? current.title : requiredText(input.title, "Deliverable title"),
      description: input.description === undefined ? current.description : optionalText(input.description, 2000),
      internalNotes: input.internalNotes === undefined ? current.internalNotes : optionalText(input.internalNotes, 4000),
      status, clientVisible: input.clientVisible === undefined ? current.clientVisible : booleanValue(input.clientVisible, current.clientVisible),
      ownerUserId,
      targetDate: input.targetDate === undefined ? current.targetDate : optionalDate(input.targetDate, "Target date"),
      position: input.position === undefined ? current.position : positionValue(input.position),
      completedAt: status === "delivered" ? current.completedAt ?? new Date() : null, updatedAt: new Date(),
    }).where(eq(deliveryDeliverables.id, deliverableId)).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "deliverable_updated", metadataJson: { deliverableId, fromStatus: current.status, toStatus: status } })
    return updated
  })
}

export async function createDeliveryResource(projectId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    await requireProject(tx, projectId)
    const deliverableId = optionalPositiveId(input.deliverableId, "Deliverable ID")
    if (deliverableId) {
      const [match] = await tx.select({ id: deliveryDeliverables.id }).from(deliveryDeliverables).where(and(eq(deliveryDeliverables.id, deliverableId), eq(deliveryDeliverables.projectId, projectId))).limit(1)
      if (!match) throw new DeliveryProjectError("Deliverable does not belong to this project.", 409)
    }
    const url = requiredText(input.url, "Resource URL", 2000)
    assertSafeResourceUrl(url)
    const [resource] = await tx.insert(deliveryResources).values({
      projectId, deliverableId, kind: enumValue(input.kind, ["file", "link"] as const, "Resource kind"),
      title: requiredText(input.title, "Resource title"), url,
      visibility: input.visibility === "client_visible" ? "client_visible" : "internal", createdBy: actor.id,
    }).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "resource_added", metadataJson: { resourceId: resource.id, kind: resource.kind, visibility: resource.visibility } })
    return resource
  })
}

export async function createDeliveryDecision(projectId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, projectId)
    const milestoneId = optionalPositiveId(input.milestoneId, "Milestone ID")
    if (milestoneId) await requireMilestone(tx, projectId, milestoneId)
    const [decision] = await tx.insert(deliveryDecisions).values({
      projectId, milestoneId, title: requiredText(input.title, "Decision title"), description: optionalText(input.description, 2000),
      internalNotes: optionalText(input.internalNotes, 4000), clientVisible: booleanValue(input.clientVisible, true),
      requestedFrom: optionalText(input.requestedFrom, 180), targetDate: optionalDate(input.targetDate, "Target date"),
    }).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "decision_requested", metadataJson: { decisionId: decision.id, clientVisible: decision.clientVisible } })
    if (decision.clientVisible) await publishTimeline(tx, project, actor, "project_decision_required", decision.title, decision.description ?? "A decision is required to keep delivery moving.")
    return decision
  })
}

export async function updateDeliveryDecision(projectId: number, decisionId: number, input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, projectId)
    const [current] = await tx.select().from(deliveryDecisions).where(and(eq(deliveryDecisions.id, decisionId), eq(deliveryDecisions.projectId, projectId))).limit(1)
    if (!current) throw new DeliveryProjectError("Decision not found.", 404)
    const status = input.status === undefined ? current.status : enumValue(input.status, DELIVERY_DECISION_STATUSES, "Decision status")
    if (current.status !== "open" && status !== current.status) throw new DeliveryProjectError("Resolved or cancelled decisions are terminal.", 409)
    const resolution = input.resolution === undefined ? current.resolution : optionalText(input.resolution, 4000)
    if (status === "resolved" && !resolution) throw new DeliveryProjectError("A resolution is required to resolve a decision.")
    const [updated] = await tx.update(deliveryDecisions).set({
      status, resolution, resolvedAt: status === "resolved" ? current.resolvedAt ?? new Date() : null,
      resolvedBy: status === "resolved" ? actor.id : null,
      title: input.title === undefined ? current.title : requiredText(input.title, "Decision title"),
      description: input.description === undefined ? current.description : optionalText(input.description, 2000),
      internalNotes: input.internalNotes === undefined ? current.internalNotes : optionalText(input.internalNotes, 4000),
      clientVisible: input.clientVisible === undefined ? current.clientVisible : booleanValue(input.clientVisible, current.clientVisible),
      requestedFrom: input.requestedFrom === undefined ? current.requestedFrom : optionalText(input.requestedFrom, 180),
      targetDate: input.targetDate === undefined ? current.targetDate : optionalDate(input.targetDate, "Target date"), updatedAt: new Date(),
    }).where(eq(deliveryDecisions.id, decisionId)).returning()
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "decision_updated", metadataJson: { decisionId, fromStatus: current.status, toStatus: status } })
    if (updated.clientVisible && current.status !== status) await publishTimeline(tx, project, actor, "project_decision_changed", updated.title, status === "resolved" ? "Decision resolved." : "Decision cancelled.")
    return updated
  })
}

async function requireProject(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], projectId: number) {
  const [project] = await tx.select().from(deliveryProjects).where(eq(deliveryProjects.id, projectId)).limit(1)
  if (!project) throw new DeliveryProjectError("Project not found.", 404)
  return project
}

async function requireMilestone(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], projectId: number, milestoneId: number) {
  const [milestone] = await tx.select({ id: deliveryMilestones.id }).from(deliveryMilestones).where(and(eq(deliveryMilestones.id, milestoneId), eq(deliveryMilestones.projectId, projectId))).limit(1)
  if (!milestone) throw new DeliveryProjectError("Milestone does not belong to this project.", 409)
}

async function assertClientAndLinkage(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], clientId: number, forgeProjectId: number | null, candidateId: number | null) {
  const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) throw new DeliveryProjectError("Client not found.", 404)
  if (!forgeProjectId && candidateId) throw new DeliveryProjectError("A deployment candidate requires a linked Forge project.", 409)
  if (forgeProjectId) {
    const [forge] = await tx.select({ id: forgeProjects.id, clientId: forgeProjects.clientId }).from(forgeProjects).where(eq(forgeProjects.id, forgeProjectId)).limit(1)
    if (!forge) throw new DeliveryProjectError("Forge project not found.", 404)
    if (forge.clientId !== clientId) throw new DeliveryProjectError("Forge project belongs to a different client.", 409)
  }
  if (candidateId) {
    const [candidate] = await tx.select({ projectId: forgeDeploymentCandidates.projectId }).from(forgeDeploymentCandidates).where(eq(forgeDeploymentCandidates.id, candidateId)).limit(1)
    if (!candidate || candidate.projectId !== forgeProjectId) throw new DeliveryProjectError("Deployment candidate does not belong to the linked Forge project.", 409)
  }
}

async function assertOwner(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ownerUserId: string | null) {
  if (!ownerUserId) return
  const [owner] = await tx.select({ id: adminUsers.id }).from(adminUsers).where(and(eq(adminUsers.id, ownerUserId), eq(adminUsers.active, true))).limit(1)
  if (!owner) throw new DeliveryProjectError("Project owner must be an active admin user.", 409)
}

async function publishTimeline(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], project: { id: number; clientId: number }, actor: DeliveryActor, type: string, title: string, description: string) {
  const [client] = await tx.select({ portalClientId: clients.portalClientId }).from(clients).where(eq(clients.id, project.clientId)).limit(1)
  if (!client?.portalClientId) return
  await tx.insert(clientTimelineEvents).values({ clientId: client.portalClientId, projectId: project.id, type, title, description, visibility: "client_visible", createdBy: actor.email ?? actor.name ?? actor.id })
}

function assertDateOrder(start: Date | null, end: Date | null) {
  if (start && end && end < start) throw new DeliveryProjectError("Target end date cannot be before the target start date.")
}

function assertSafeResourceUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new DeliveryProjectError("Resource URL must be an absolute URL.") }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new DeliveryProjectError("Resource URL must use HTTP or HTTPS.")
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>, fields: readonly string[]) {
  return fields.filter((field) => String(before[field] ?? "") !== String(after[field] ?? ""))
}

function humanise(value: string) { return value.replaceAll("_", " ") }
