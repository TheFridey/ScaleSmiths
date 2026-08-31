import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { assertSafeClientStagingUrl, sanitiseInternalDeliveryEvent, type InternalDeliveryEvent } from "@/lib/delivery-projection"
import { clients, deliveryForgeIntegrations, deliveryProjectAuditLogs, deliveryProjects, forgeDeploymentCandidates, forgeProjects, forgeRuns } from "@/lib/schema"
import { DeliveryProjectError } from "@/lib/delivery-projects"
import type { DeliveryActor } from "./delivery-project-service"
import { recordClientActivity } from "./client-activity"

export interface InternalForgeLinkInput { forgeProjectId: number; latestRunId?: number | null; deploymentCandidateId?: number | null; internalReleaseId?: string | null; stagingDeploymentId?: string | null; productionDeploymentId?: string | null; internalBuildStatus?: string | null; internalQaStatus?: string | null; internalDeploymentStatus?: string | null }

export async function linkForgeToDeliveryProject(projectId: number, input: InternalForgeLinkInput, actor: DeliveryActor) {
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(deliveryProjects).where(eq(deliveryProjects.id, projectId)).limit(1)
    if (!project) throw new DeliveryProjectError("Project not found.", 404)
    const [forge] = await tx.select({ id: forgeProjects.id, clientId: forgeProjects.clientId }).from(forgeProjects).where(eq(forgeProjects.id, input.forgeProjectId)).limit(1)
    if (!forge || forge.clientId !== project.clientId) throw new DeliveryProjectError("Forge project must belong to the same client.", 409)
    if (input.latestRunId) { const [run] = await tx.select({ id: forgeRuns.id }).from(forgeRuns).where(and(eq(forgeRuns.id, input.latestRunId), eq(forgeRuns.projectId, forge.id))).limit(1); if (!run) throw new DeliveryProjectError("Forge run does not belong to the linked Forge project.", 409) }
    if (input.deploymentCandidateId) { const [candidate] = await tx.select({ id: forgeDeploymentCandidates.id }).from(forgeDeploymentCandidates).where(and(eq(forgeDeploymentCandidates.id, input.deploymentCandidateId), eq(forgeDeploymentCandidates.projectId, forge.id))).limit(1); if (!candidate) throw new DeliveryProjectError("Deployment candidate does not belong to the linked Forge project.", 409) }
    const now = new Date(), [integration] = await tx.insert(deliveryForgeIntegrations).values({ projectId, ...input, lastInternalEventAt: now, updatedAt: now }).onConflictDoUpdate({ target: deliveryForgeIntegrations.projectId, set: { ...input, lastInternalEventAt: now, updatedAt: now } }).returning()
    await tx.update(deliveryProjects).set({ forgeProjectId: forge.id, deploymentCandidateId: input.deploymentCandidateId ?? null, updatedAt: now }).where(eq(deliveryProjects.id, projectId))
    await tx.insert(deliveryProjectAuditLogs).values({ projectId, actorUserId: actor.id, action: "forge_integration_linked", metadataJson: { forgeProjectId: forge.id, runId: input.latestRunId ?? null, deploymentCandidateId: input.deploymentCandidateId ?? null } })
    return integration
  })
}

export async function projectInternalForgeEventSafely(forgeProjectId: number, event: InternalDeliveryEvent, actor: { id?: string; name?: string | null; email?: string | null }, options: Parameters<typeof projectInternalForgeEvent>[3] = {}) {
  try { return await projectInternalForgeEvent(forgeProjectId, event, actor, options) }
  catch (error) { console.error("Internal delivery projection failed", { forgeProjectId, event, error: error instanceof Error ? error.message : "unknown" }); return { projected: false as const, reason: "projection_failed" as const } }
}

export async function projectInternalForgeEvent(forgeProjectId: number, event: InternalDeliveryEvent, actor: { id?: string; name?: string | null; email?: string | null }, options: { expectedProjectId?: number; stagingUrl?: string; publishStaging?: boolean; latestRunId?: number; deploymentCandidateId?: number; internalBuildStatus?: string; internalQaStatus?: string; internalDeploymentStatus?: string } = {}) {
  return db.transaction(async (tx) => {
    const [integration] = await tx.select().from(deliveryForgeIntegrations).where(eq(deliveryForgeIntegrations.forgeProjectId, forgeProjectId)).limit(1)
    if (!integration) return { projected: false as const, reason: "unlinked" as const }
    if (options.expectedProjectId && integration.projectId !== options.expectedProjectId) throw new DeliveryProjectError("Forge integration does not belong to this delivery project.", 409)
    if (options.latestRunId) { const [run] = await tx.select({ id: forgeRuns.id }).from(forgeRuns).where(and(eq(forgeRuns.id, options.latestRunId), eq(forgeRuns.projectId, forgeProjectId))).limit(1); if (!run) throw new DeliveryProjectError("Forge run does not belong to the linked Forge project.", 409) }
    if (options.deploymentCandidateId) { const [candidate] = await tx.select({ id: forgeDeploymentCandidates.id }).from(forgeDeploymentCandidates).where(and(eq(forgeDeploymentCandidates.id, options.deploymentCandidateId), eq(forgeDeploymentCandidates.projectId, forgeProjectId))).limit(1); if (!candidate) throw new DeliveryProjectError("Deployment candidate does not belong to the linked Forge project.", 409) }
    const [project] = await tx.select().from(deliveryProjects).where(eq(deliveryProjects.id, integration.projectId)).limit(1)
    if (!project) throw new DeliveryProjectError("Linked delivery project not found.", 404)
    const projection = sanitiseInternalDeliveryEvent(event), stagingUrl = options.publishStaging && options.stagingUrl ? assertSafeClientStagingUrl(options.stagingUrl) : null, now = new Date()
    await tx.update(deliveryForgeIntegrations).set({ latestRunId: options.latestRunId ?? integration.latestRunId, deploymentCandidateId: options.deploymentCandidateId ?? integration.deploymentCandidateId, internalBuildStatus: options.internalBuildStatus ?? integration.internalBuildStatus, internalQaStatus: options.internalQaStatus ?? integration.internalQaStatus, internalDeploymentStatus: options.internalDeploymentStatus ?? integration.internalDeploymentStatus, lastInternalEventAt: now, updatedAt: now }).where(eq(deliveryForgeIntegrations.projectId, project.id))
    await tx.update(deliveryProjects).set({ clientStatus: projection.status, clientNextStep: projection.nextStep, clientStagingUrl: stagingUrl ?? project.clientStagingUrl, clientStagingVisible: stagingUrl ? true : project.clientStagingVisible, updatedAt: now }).where(eq(deliveryProjects.id, project.id))
    await tx.insert(deliveryProjectAuditLogs).values({ projectId: project.id, actorUserId: actor.id ?? null, action: "forge_event_projected", metadataJson: { event, status: projection.status } })
    if (project.clientVisible && (project.clientStatus !== projection.status || event === "staging_ready")) { const [client] = await tx.select({ portalClientId: clients.portalClientId }).from(clients).where(eq(clients.id, project.clientId)).limit(1); await recordClientActivity(tx, { clientRecordId: project.clientId, portalClientId: client?.portalClientId, projectId: project.id, sourceDomain: event === "staging_ready" || event === "deployed" ? "deployment" : "forge", sourceReference: `delivery-projection:${project.id}:${event}:${options.latestRunId ?? "none"}:${options.deploymentCandidateId ?? "none"}`, type: event === "staging_ready" ? "staging_published" : event === "deployed" ? "production_deployment_completed" : `project_${projection.status}`, title: projection.title, description: projection.description, visibility: "client_visible", actor: { type: "system", id: actor.id, label: "ScaleSmiths" }, metadata: { status: projection.status }, occurredAt: now, idempotencyKey: `delivery-projection:${project.id}:${event}:${options.latestRunId ?? "none"}:${options.deploymentCandidateId ?? "none"}` }) }
    return { projected: true as const, projectId: project.id, status: projection.status }
  })
}
