import "server-only"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "./db"
import { invoicePortalClients, portalClientDocumentAccessEvents, portalClientDocuments, portalDeliveryProjects } from "./schema"
export async function getPortalDocument(portalClientId: string, documentId: number) { const [document] = await db.select({ document: portalClientDocuments }).from(portalClientDocuments).innerJoin(portalDeliveryProjects, eq(portalClientDocuments.projectId, portalDeliveryProjects.id)).innerJoin(invoicePortalClients, eq(portalDeliveryProjects.clientId, invoicePortalClients.id)).where(and(eq(portalClientDocuments.id, documentId), eq(invoicePortalClients.portalClientId, portalClientId), eq(portalDeliveryProjects.clientVisible, true), eq(portalClientDocuments.visibility, "client_visible"), isNull(portalClientDocuments.archivedAt))).limit(1); return document?.document ?? null }
export async function auditPortalDocumentAccess(documentId: number, portalClientId: string) { await db.insert(portalClientDocumentAccessEvents).values({ documentId, portalClientId, action: "download", createdAt: new Date() }) }
