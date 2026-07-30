import type { JsonValue } from "./forge-ai"

/**
 * Forge job queue primitives (framework-agnostic, no DB/Node imports so it is safe to import
 * from both server and client code).
 *
 * Long-running Forge actions are enqueued as jobs. The API creates a job and returns quickly;
 * a worker executes the mapped handler (which updates forgeTasks/forgeArtifacts/forgeActivityLogs).
 * A direct "inline" execution mode is kept as a development fallback.
 */

export const FORGE_JOB_KINDS = [
  "research",
  "sitemap",
  "copy",
  "design",
  "design_system",
  "component_spec",
  "accessibility_gate",
  "consistency_review",
  "copy_quality_review",
  "review_council",
  "originality_review",
  "site_inventory",
  "migration_analysis",
  "migration_execution",
  "generate_site",
  "seo",
  "quality_review",
  "visual_critique",
  "qa",
  "repair",
  "visual_qa",
  "preview_start",
  "proposal",
  "export",
] as const

export type ForgeJobKind = (typeof FORGE_JOB_KINDS)[number]

// Kinds that must execute inline because they cannot produce a JSON result that can be polled.
// Export jobs now return export metadata through the queue; downloads remain in the Export panel.
export const FORGE_JOB_INLINE_ONLY: readonly ForgeJobKind[] = []

export const FORGE_JOB_STATUSES = ["queued", "running", "completed", "failed", "cancelled", "dead_letter"] as const
export type ForgeJobStatus = (typeof FORGE_JOB_STATUSES)[number]

export type ForgeJobMode = "inline" | "background"

export interface ForgeJobView {
  id: number
  projectId: number
  kind: ForgeJobKind | string
  status: ForgeJobStatus
  error: string | null
  result: Record<string, JsonValue> | null
  attempts: number
  maxAttempts: number
  nextRetryAt: string | null
  retryable: boolean
  retryUnavailableReason: string | null
  createdAt: string | null
  startedAt: string | null
  completedAt: string | null
}

export function isForgeJobKind(value: unknown): value is ForgeJobKind {
  return typeof value === "string" && (FORGE_JOB_KINDS as readonly string[]).includes(value)
}

export function isForgeJobStatus(value: unknown): value is ForgeJobStatus {
  return typeof value === "string" && (FORGE_JOB_STATUSES as readonly string[]).includes(value)
}

export function isForgeJobInlineOnly(kind: ForgeJobKind): boolean {
  return FORGE_JOB_INLINE_ONLY.includes(kind)
}

export function isTerminalForgeJobStatus(status: ForgeJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled"
}

/**
 * Resolves the execution mode. Explicit `FORGE_JOBS_MODE=inline|background` always wins.
 * Otherwise production defaults to background (return quickly + worker), while development
 * defaults to inline so local changes get immediate, synchronous feedback.
 */
export function resolveForgeJobMode(env: Partial<Record<string, string | undefined>> = process.env): ForgeJobMode {
  const raw = (env.FORGE_JOBS_MODE ?? "").trim().toLowerCase()
  if (raw === "inline" || raw === "background") return raw
  return env.NODE_ENV === "production" ? "background" : "inline"
}

export function resolveForgeJobModeForKind(kind: ForgeJobKind, env: Partial<Record<string, string | undefined>> = process.env): ForgeJobMode {
  return isForgeJobInlineOnly(kind) ? "inline" : resolveForgeJobMode(env)
}

/** Normalises a raw job row into a client-safe view (no payload, only serialisable fields). */
export function toForgeJobView(row: {
  id: number
  projectId: number
  kind: string
  status: string
  error: string | null
  resultJson: Record<string, unknown> | null
  attempts: number
  createdAt: Date | string | null
  startedAt: Date | string | null
  completedAt: Date | string | null
  maxAttempts?: number
  scheduledAt?: Date | string | null
  operatorErrorJson?: { retryable?: boolean; recommendedAction?: string } | null
}): ForgeJobView {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    status: isForgeJobStatus(row.status) ? row.status : "queued",
    error: row.error ?? null,
    result: (row.resultJson as Record<string, JsonValue> | null) ?? null,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts ?? 3,
    nextRetryAt: row.status === "queued" ? toIso(row.scheduledAt ?? null) : null,
    retryable: ["failed", "cancelled", "dead_letter"].includes(row.status) && row.operatorErrorJson?.retryable !== false,
    retryUnavailableReason: ["failed", "cancelled", "dead_letter"].includes(row.status)
      ? row.operatorErrorJson?.retryable === false
        ? row.operatorErrorJson.recommendedAction ?? "The recorded failure is not retryable."
        : null
      : "Only terminal failed or cancelled jobs can be retried.",
    createdAt: toIso(row.createdAt),
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
  }
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
