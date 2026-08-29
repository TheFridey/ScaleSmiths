import "server-only"
import { and, eq } from "drizzle-orm"
import { normaliseClientActivity, type ClientActivityInput } from "@/lib/client-activity"
import { clientTimelineEvents, clients, deliveryProjects } from "@/lib/schema"
import { db } from "@/lib/db"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function recordClientActivity(tx: Tx, raw: ClientActivityInput) {
  const input = normaliseClientActivity(raw)
  const [client] = await tx.select({ id: clients.id, portalClientId: clients.portalClientId }).from(clients).where(eq(clients.id, input.clientRecordId)).limit(1)
  if (!client) throw new Error("Client activity client does not exist.")
  if (input.projectId) {
    const [project] = await tx.select({ id: deliveryProjects.id }).from(deliveryProjects).where(and(eq(deliveryProjects.id, input.projectId), eq(deliveryProjects.clientId, client.id))).limit(1)
    if (!project) throw new Error("Client activity project does not belong to the client.")
  }
  const [event] = await tx.insert(clientTimelineEvents).values({
    clientId: input.portalClientId ?? client.portalClientId ?? `internal:${client.id}`,
    clientRecordId: client.id, projectId: input.projectId ?? null, requestId: input.requestId ?? null,
    sourceDomain: input.sourceDomain, sourceReference: input.sourceReference, type: input.type,
    title: input.title, description: input.description, visibility: input.visibility,
    createdBy: input.actor.label, actorType: input.actor.type, actorId: input.actor.id ?? null, actorLabel: input.actor.label,
    metadataJson: input.metadata, idempotencyKey: input.idempotencyKey, occurredAt: input.occurredAt,
  }).onConflictDoNothing({ target: clientTimelineEvents.idempotencyKey }).returning()
  return event ?? null
}
