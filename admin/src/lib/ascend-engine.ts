/**
 * Operation ASCEND B2.8: pure execution-engine rules shared by the server, the founder command centre and tests.
 * The database trigger in migration 0104 enforces the same transition table independently.
 */
export const EXECUTION_STATES = ["created","pending_approval","approved","scheduled","queued","leased","running",
  "retry_scheduled","completed","failed","dead_lettered","cancelled","expired","superseded","ambiguous"] as const
export type ExecutionState = (typeof EXECUTION_STATES)[number]
export const TERMINAL_STATES: readonly ExecutionState[] = ["completed","failed","dead_lettered","cancelled","expired","superseded"]
export const ACTIVE_STATES: readonly ExecutionState[] = ["leased","running"]

export const TRANSITIONS: Readonly<Record<ExecutionState, readonly ExecutionState[]>> = {
  created: ["pending_approval","queued","scheduled","cancelled","expired","superseded"],
  pending_approval: ["approved","cancelled","expired","superseded"],
  approved: ["queued","scheduled","cancelled","expired","superseded"],
  scheduled: ["queued","cancelled","expired","superseded"],
  queued: ["leased","cancelled","expired","superseded"],
  retry_scheduled: ["leased","queued","cancelled","expired","dead_lettered","superseded"],
  leased: ["running","queued","retry_scheduled","failed","dead_lettered","cancelled","expired"],
  running: ["completed","retry_scheduled","queued","failed","dead_lettered","ambiguous","cancelled","expired"],
  ambiguous: ["completed","failed"],
  failed: ["pending_approval","queued"],
  dead_lettered: ["pending_approval","queued"],
  completed: [], cancelled: [], expired: [], superseded: [],
}
export const canTransition = (from: ExecutionState, to: ExecutionState) => from === to || TRANSITIONS[from].includes(to)

export const FAILURE_CLASSES = ["transient","database_unavailable","rate_limited","invalid_payload","authentication","permission",
  "approval_expired","policy_rejection","provider_failure","duplicate","ambiguous","business_rule","deadline_exceeded","cancelled"] as const
export type FailureClass = (typeof FAILURE_CLASSES)[number]
/** Only these are worth retrying automatically. Everything else is permanent and goes to founder review. */
export const RETRYABLE: ReadonlySet<FailureClass> = new Set(["transient","database_unavailable","rate_limited","provider_failure","deadline_exceeded"])

export class AscendFailure extends Error {
  constructor(readonly failureClass: FailureClass, message: string) { super(message); this.name = "AscendFailure" }
}

/** Map any thrown value to a class and a sanitised, bounded message. Never echoes raw driver errors. */
export function classifyFailure(error: unknown): { failureClass: FailureClass; message: string } {
  if (error instanceof AscendFailure) return { failureClass: error.failureClass, message: sanitiseError(error.message) }
  const code = String((error as { code?: unknown })?.code ?? (error as { cause?: { code?: unknown } })?.cause?.code ?? "")
  if (/^(08|57P0[1-3]|53)/.test(code) || /ECONNREFUSED|ECONNRESET|ETIMEDOUT/.test(code)) return { failureClass: "database_unavailable", message: "The database was temporarily unavailable." }
  if (code === "40001" || code === "40P01" || code === "55P03") return { failureClass: "transient", message: "A concurrent database operation conflicted; the work will be retried." }
  if (code === "23505") return { failureClass: "duplicate", message: "The operation duplicates an existing record." }
  if (/^(22|23)/.test(code)) return { failureClass: "business_rule", message: "The database refused the operation as invalid." }
  if ((error as { name?: unknown })?.name === "AbortError") return { failureClass: "deadline_exceeded", message: "The operation exceeded its execution time limit." }
  return { failureClass: "transient", message: "The operation failed unexpectedly." }
}

const SECRETISH = /(bearer\s+[A-Za-z0-9._~+/-]+=*|[A-Za-z0-9_-]{32,}|postgres(ql)?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.-]+)/gi
export function sanitiseError(message: string) {
  return message.replace(SECRETISH, "[redacted]").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 480)
}

/** Bounded exponential backoff with full jitter; deterministic under an injected random source. */
export function retryDelaySeconds(attempt: number, random: () => number = Math.random) {
  const ceiling = Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1))
  return Math.max(15, Math.round(ceiling / 2 + random() * (ceiling / 2)))
}

/** Stable JSON so digests do not depend on key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`
}
/** What an approval covers: exactly this action, payload, scope and policy version. The server hashes it. */
export function approvalBinding(input: { executionId: string; actionType: string; payloadSha256: string; scope: unknown; policyVersion: number }) {
  return canonicalJson({ v: 1, e: input.executionId, a: input.actionType, p: input.payloadSha256, s: input.scope, pv: input.policyVersion })
}

/* ---------------------------------------------------------------- action registry ------------------------------------------------ */

export type PayloadField = { type: "integer"; min: number; max: number } | { type: "enum"; values: readonly string[] }
export type ActionSpec = {
  type: string
  version: number
  title: string
  description: string
  category: "analysis" | "review_preparation"
  /** Read-only or internal-only actions are safe to re-run after a crash; anything else becomes `ambiguous`. */
  idempotent: boolean
  /**
   * B2.9 classification of what the handler writes besides ASCEND execution bookkeeping. "none" is enforced by running
   * the handler in a READ ONLY database transaction; "internal_review_state" writes ascend_review_jobs and its events only.
   */
  writes: "none" | "internal_review_state"
  effects: string
  payload: Readonly<Record<string, PayloadField>>
  defaults: Readonly<Record<string, number | string>>
}

/**
 * The complete set of executable actions. Every one is read-only analysis or internal founder-review preparation
 * (which does write internal review-task state; see `writes`).
 * Nothing contacts a prospect, partner or client, moves money, changes commission or changes a commercial record.
 */
export const ACTION_REGISTRY: Readonly<Record<string, ActionSpec>> = {
  "ops.queue_health": {
    type: "ops.queue_health", version: 1, category: "analysis", idempotent: true, writes: "none",
    title: "Operational health assessment",
    description: "Summarises ASCEND execution and review-queue health: backlog, dead letters, stale leases and stale workers.",
    effects: "Read-only (database-enforced). Engine-wide aggregate; stores a summary on the execution record.",
    payload: { staleWorkerMinutes: { type: "integer", min: 1, max: 1440 } }, defaults: { staleWorkerMinutes: 5 },
  },
  "pipeline.inactivity_scan": {
    type: "pipeline.inactivity_scan", version: 1, category: "analysis", idempotent: true, writes: "none",
    title: "Pipeline inactivity detection",
    description: "Counts open partner opportunities with no update beyond the threshold, by stage. No names or contact details are read.",
    effects: "Read-only aggregate. Founders follow up from the pipeline itself.",
    payload: { inactiveDays: { type: "integer", min: 3, max: 180 } }, defaults: { inactiveDays: 14 },
  },
  "onboarding.progress_check": {
    type: "onboarding.progress_check", version: 1, category: "analysis", idempotent: true, writes: "none",
    title: "Partner onboarding progress check",
    description: "Counts invited partners who have not activated, split into expired and still-valid invitations.",
    effects: "Read-only aggregate. Does not reissue invitations or contact anyone.",
    payload: { pendingDays: { type: "integer", min: 1, max: 90 } }, defaults: { pendingDays: 7 },
  },
  "delivery.handoff_readiness": {
    type: "delivery.handoff_readiness", version: 1, category: "analysis", idempotent: true, writes: "none",
    title: "Delivery handoff readiness check",
    description: "Counts contract-accepted opportunities that have not yet been handed to delivery.",
    effects: "Read-only aggregate. Handoff remains a founder decision in the delivery queue.",
    payload: {}, defaults: {},
  },
  "review.queue_preparation": {
    type: "review.queue_preparation", version: 1, category: "review_preparation", idempotent: true, writes: "internal_review_state",
    title: "Founder review queue preparation",
    description: "Prepares due B2.7 founder review tasks (validation only), up to the batch limit.",
    effects: "Not read-only: writes internal review-task state (ascend_review_jobs and its events) to ready, retry or dead. Never changes a sales, delivery, financial or agreement record and never notifies anyone.",
    payload: { batch: { type: "integer", min: 1, max: 25 } }, defaults: { batch: 10 },
  },
}
export const registeredActions = () => Object.values(ACTION_REGISTRY)

/** Named here so every interface can refuse them with an explicit policy reason. Also refused by a DB CHECK. */
export const PROHIBITED_ACTION_PATTERN = /(payout|withdraw|commission|ledger|payment|refund|invoice|clawback|agreement|publish|activat|permission|role|grant|retention|purge|delete|erase|email|mail|send|notify|dispatch|sms|social|contact)/i

export const MARKET_CODE = /^[A-Z]{2}$/

/** Validate and normalise a payload against the registered schema. Unknown keys are refused, not ignored. */
export function validatePayload(actionType: unknown, payload: unknown): { spec: ActionSpec; payload: Record<string, number | string> } {
  if (typeof actionType !== "string" || !/^[a-z][a-z0-9_.]{2,63}$/.test(actionType)) throw new AscendFailure("invalid_payload", "Unknown action type.")
  if (PROHIBITED_ACTION_PATTERN.test(actionType)) throw new AscendFailure("policy_rejection", "This action family is prohibited for automation and requires a founder in the relevant workspace.")
  const spec = ACTION_REGISTRY[actionType]
  if (!spec) throw new AscendFailure("invalid_payload", "Unknown action type.")
  const input = payload === undefined ? {} : payload
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AscendFailure("invalid_payload", "The payload must be an object.")
  const out: Record<string, number | string> = { ...spec.defaults }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const field = spec.payload[key]
    if (!field) throw new AscendFailure("invalid_payload", `Unsupported payload field: ${key.slice(0, 40)}.`)
    if (field.type === "integer") {
      if (!Number.isInteger(value) || (value as number) < field.min || (value as number) > field.max) throw new AscendFailure("invalid_payload", `${key} must be a whole number from ${field.min} to ${field.max}.`)
      out[key] = value as number
    } else {
      if (typeof value !== "string" || !field.values.includes(value)) throw new AscendFailure("invalid_payload", `${key} has an unsupported value.`)
      out[key] = value
    }
  }
  return { spec, payload: out }
}

/** Shape-only normalisation (sorted, de-duplicated markets; omitted markets mean the default). No policy check. */
export function normaliseScope(scope: unknown, defaultMarkets: readonly string[]): { markets: string[] } {
  const input = scope === undefined ? {} : scope
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AscendFailure("invalid_payload", "The scope must be an object.")
  const keys = Object.keys(input as object)
  if (keys.some((k) => k !== "markets")) throw new AscendFailure("invalid_payload", "Only a market scope is supported.")
  const raw = (input as { markets?: unknown }).markets ?? defaultMarkets
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50 || raw.some((m) => typeof m !== "string" || !MARKET_CODE.test(m))) throw new AscendFailure("invalid_payload", "Markets must be two-letter country codes.")
  return { markets: [...new Set(raw as string[])].sort() }
}

export function validateScope(scope: unknown, allowedMarkets: readonly string[]): { markets: string[] } {
  const { markets } = normaliseScope(scope, allowedMarkets)
  const outside = markets.filter((m) => !allowedMarkets.includes(m))
  if (outside.length) throw new AscendFailure("policy_rejection", `Market not authorised for this automation: ${outside.join(", ")}.`)
  return { markets }
}

export const SERVICE_CAPABILITIES = ["worker.execute","operations.submit","operations.read","operations.cancel"] as const
export type ServiceCapability = (typeof SERVICE_CAPABILITIES)[number]

/** Founder-facing words for each state; the UI never shows raw enum values alone. */
export const STATE_LABEL: Readonly<Record<ExecutionState, string>> = {
  created: "Created", pending_approval: "Awaiting approval", approved: "Approved", scheduled: "Scheduled", queued: "Queued",
  leased: "Claimed", running: "Running", retry_scheduled: "Retry scheduled", completed: "Completed", failed: "Failed",
  dead_lettered: "Dead letter", cancelled: "Cancelled", expired: "Expired", superseded: "Superseded", ambiguous: "Needs reconciliation",
}
