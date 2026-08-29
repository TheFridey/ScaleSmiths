import "server-only"

import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import { db } from "./db"
import {
  invoicePortalClients,
  portalDeliveryDecisions,
  portalDeliveryDeliverables,
  portalDeliveryMilestones,
  portalDeliveryProjects,
  portalDeliveryProjectProgress,
  portalClientDocuments,
} from "./schema"

export async function listPortalProjectProgress(portalClientId: string) {
  const projects = await db.select({
    id: portalDeliveryProjects.id,
    name: portalDeliveryProjects.name,
    summary: portalDeliveryProjects.summary,
    status: portalDeliveryProjects.status,
    currentPhase: portalDeliveryProjects.currentPhase,
    clientStatus: portalDeliveryProjects.clientStatus,
    clientNextStep: portalDeliveryProjects.clientNextStep,
    stagingUrl: sql<string | null>`case when ${portalDeliveryProjects.clientStagingVisible} then ${portalDeliveryProjects.clientStagingUrl} else null end`,
    targetStartDate: portalDeliveryProjects.targetStartDate,
    targetEndDate: portalDeliveryProjects.targetEndDate,
    updatedAt: portalDeliveryProjects.updatedAt,
    progress: portalDeliveryProjectProgress.progress,
  }).from(portalDeliveryProjects)
    .innerJoin(invoicePortalClients, eq(portalDeliveryProjects.clientId, invoicePortalClients.id))
    .innerJoin(portalDeliveryProjectProgress, eq(portalDeliveryProjectProgress.projectId, portalDeliveryProjects.id))
    .where(and(eq(invoicePortalClients.portalClientId, portalClientId), eq(portalDeliveryProjects.clientVisible, true), ne(portalDeliveryProjects.status, "cancelled")))
    .orderBy(asc(portalDeliveryProjects.createdAt))

  if (!projects.length) return []
  const projectIds = projects.map(({ id }) => id)
  const [milestones, deliverables, resources, decisions] = await Promise.all([
    db.select({ id: portalDeliveryMilestones.id, projectId: portalDeliveryMilestones.projectId, title: portalDeliveryMilestones.title, description: portalDeliveryMilestones.description, status: portalDeliveryMilestones.status, weight: portalDeliveryMilestones.weight, position: portalDeliveryMilestones.position, targetDate: portalDeliveryMilestones.targetDate, completedAt: portalDeliveryMilestones.completedAt })
      .from(portalDeliveryMilestones).where(and(inArray(portalDeliveryMilestones.projectId, projectIds), eq(portalDeliveryMilestones.clientVisible, true))).orderBy(asc(portalDeliveryMilestones.position)),
    db.select({ id: portalDeliveryDeliverables.id, projectId: portalDeliveryDeliverables.projectId, milestoneId: portalDeliveryDeliverables.milestoneId, title: portalDeliveryDeliverables.title, description: portalDeliveryDeliverables.description, status: portalDeliveryDeliverables.status, targetDate: portalDeliveryDeliverables.targetDate, position: portalDeliveryDeliverables.position })
      .from(portalDeliveryDeliverables).where(and(inArray(portalDeliveryDeliverables.projectId, projectIds), eq(portalDeliveryDeliverables.clientVisible, true))).orderBy(asc(portalDeliveryDeliverables.position)),
    db.select({ id: portalClientDocuments.id, projectId: portalClientDocuments.projectId, deliverableId: portalClientDocuments.deliverableId, source: portalClientDocuments.source, documentType: portalClientDocuments.documentType, title: portalClientDocuments.title, description: portalClientDocuments.description, originalFilename: portalClientDocuments.originalFilename, mimeType: portalClientDocuments.mimeType, sizeBytes: portalClientDocuments.sizeBytes, version: portalClientDocuments.version, createdAt: portalClientDocuments.createdAt })
      .from(portalClientDocuments).where(and(inArray(portalClientDocuments.projectId, projectIds), eq(portalClientDocuments.visibility, "client_visible"), isNull(portalClientDocuments.archivedAt))).orderBy(asc(portalClientDocuments.createdAt)),
    db.select({ id: portalDeliveryDecisions.id, projectId: portalDeliveryDecisions.projectId, milestoneId: portalDeliveryDecisions.milestoneId, title: portalDeliveryDecisions.title, description: portalDeliveryDecisions.description, status: portalDeliveryDecisions.status, requestedFrom: portalDeliveryDecisions.requestedFrom, targetDate: portalDeliveryDecisions.targetDate, resolution: portalDeliveryDecisions.resolution, resolvedAt: portalDeliveryDecisions.resolvedAt })
      .from(portalDeliveryDecisions).where(and(inArray(portalDeliveryDecisions.projectId, projectIds), eq(portalDeliveryDecisions.clientVisible, true))).orderBy(asc(portalDeliveryDecisions.createdAt)),
  ])

  return projects.map((project) => {
    const projectMilestones = milestones.filter((milestone) => milestone.projectId === project.id)
    return {
      ...project,
      milestones: projectMilestones,
      deliverables: deliverables.filter((deliverable) => deliverable.projectId === project.id),
      resources: resources.filter((resource) => resource.projectId === project.id),
      decisions: decisions.filter((decision) => decision.projectId === project.id),
    }
  })
}
