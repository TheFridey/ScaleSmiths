export const CLIENT_ACTIVITY_SOURCE_DOMAINS = ["client", "portal", "project", "request", "message", "decision", "report", "invoice", "forge", "deployment", "document", "manual"] as const
export type ClientActivitySourceDomain = typeof CLIENT_ACTIVITY_SOURCE_DOMAINS[number]
export type ClientActivityVisibility = "internal" | "client_visible"
export type ClientActivityActorType = "admin" | "client" | "system"

export interface ClientActivityInput {
  clientRecordId: number
  portalClientId?: string | null
  projectId?: number | null
  requestId?: number | null
  sourceDomain: ClientActivitySourceDomain
  sourceReference: string
  type: string
  title: string
  description: string
  visibility: ClientActivityVisibility
  actor: { type: ClientActivityActorType; id?: string | null; label: string }
  metadata?: Record<string, unknown>
  occurredAt?: Date
  idempotencyKey: string
}

export function normaliseClientActivity(input: ClientActivityInput) {
  if (!Number.isInteger(input.clientRecordId) || input.clientRecordId < 1) throw new Error("A valid client record is required.")
  if (!input.sourceReference.trim() || !input.idempotencyKey.trim()) throw new Error("Source reference and idempotency key are required.")
  return {
    ...input,
    sourceReference: input.sourceReference.trim().slice(0, 300),
    idempotencyKey: input.idempotencyKey.trim().slice(0, 300),
    title: input.title.trim().slice(0, 180),
    description: input.description.trim().slice(0, 2000),
    actor: { ...input.actor, label: input.actor.label.trim().slice(0, 180) || "ScaleSmiths" },
    metadata: sanitiseMetadata(input.metadata ?? {}),
    occurredAt: input.occurredAt ?? new Date(),
  }
}

export function clientVisibleActivity<T extends { visibility: ClientActivityVisibility }>(rows: T[]) {
  return rows.filter((row) => row.visibility === "client_visible")
}

export function orderActivityNewestFirst<T extends { id: number; occurredAt: Date }>(rows: T[]) {
  return [...rows].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id - a.id)
}

function sanitiseMetadata(value: Record<string, unknown>) {
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") result[key.slice(0, 80)] = typeof item === "string" ? item.slice(0, 500) : item
  }
  return result
}
