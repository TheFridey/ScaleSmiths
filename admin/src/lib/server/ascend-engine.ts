import "server-only"
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import { hasCapability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"
import {
  ACTION_REGISTRY, ACTIVE_STATES, AscendFailure, RETRYABLE, SERVICE_CAPABILITIES, TERMINAL_STATES, approvalBinding, canonicalJson,
  classifyFailure, normaliseScope, retryDelaySeconds, sanitiseError, validatePayload, validateScope,
  type ExecutionState, type FailureClass, type ServiceCapability,
} from "@/lib/ascend-engine"
import { requireCapability } from "./rbac"
import { runAscendAction } from "./ascend-engine-actions"

/*
 * Operation ASCEND B2.8 execution engine. Every state change happens in a transaction, is validated by the
 * migration 0104 trigger, and writes an append-only event. Execution is at-least-once with lease tokens and
 * compare-and-set completion; registered actions are idempotent, and any non-idempotent action whose lease is lost
 * mid-run becomes `ambiguous` for founder reconciliation instead of being retried or reported as done.
 */

type Row = Record<string, unknown>
type Exec = { execute: (q: SQL) => Promise<{ rows: unknown }> }
const rowsOf = async (tx: Exec, q: SQL): Promise<Row[]> => (await tx.execute(q)).rows as Row[]
const one = async (tx: Exec, q: SQL): Promise<Row | undefined> => (await rowsOf(tx, q))[0]
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")
const iso = (v: unknown) => (v == null ? null : new Date(String(v)).toISOString())

export class AscendError extends Error {
  constructor(message: string, readonly status = 400, readonly failureClass?: FailureClass) { super(message); this.name = "AscendError" }
}
const fromFailure = (e: AscendFailure, status = 422) => new AscendError(e.message, status, e.failureClass)

export const ascendEngineEnabled = () => process.env.ASCEND_ENGINE_ENABLED === "true"
export const ascendSchedulerEnabled = () => process.env.ASCEND_SCHEDULER_ENABLED === "true"
export const ascendAgentApiEnabled = () => process.env.ASCEND_AGENT_API_ENABLED === "true"
const globalConcurrency = () => {
  const n = Number(process.env.ASCEND_MAX_GLOBAL_CONCURRENCY ?? 4)
  return Number.isInteger(n) && n >= 1 && n <= 32 ? n : 4
}
const LEASE_GRACE_SECONDS = 15
const CLAIM_LOCK_KEY = 734_028_104

/* ------------------------------------------------------------------ identities ------------------------------------------------ */

export type FounderActor = { kind: "founder"; id: string; role: AdminRole }
export type ServiceActor = { kind: "service"; id: string; name: string; identityKind: "worker" | "agent"; capabilities: ServiceCapability[]; allowedActions: string[] }
export type Actor = FounderActor | ServiceActor | { kind: "system" }
const actorRef = (a: Actor) => (a.kind === "founder" ? a.id : a.kind === "service" ? `service:${a.name}` : "scheduler")
const actorKind = (a: Actor) => (a.kind === "founder" ? "founder" : a.kind === "service" ? "service" : "system")

/** Founder authority is re-read from the database on every command, so revocation applies immediately. */
export async function authorisedFounder(): Promise<FounderActor> {
  if (!ascendEngineEnabled()) throw new AscendError("The ASCEND execution engine is unavailable.", 404)
  const actor = await requireCapability("expansion.manage")
  const row = await one(db, sql`select role, active, session_version from admin_users where id = ${actor.id}`)
  if (!row?.active || Number(row.session_version) !== Number(actor.sessionVersion) || !hasCapability(row.role as AdminRole, "expansion.manage"))
    throw new AscendError("Founder authorisation was revoked.", 403, "permission")
  return { kind: "founder", id: actor.id, role: row.role as AdminRole }
}

/** Bearer token -> scoped service identity. Constant-time digest comparison; no session or founder authority. */
export async function authenticateService(headers: Headers, capability: ServiceCapability): Promise<ServiceActor> {
  if (!ascendEngineEnabled()) throw new AscendError("The ASCEND execution engine is unavailable.", 404)
  const match = /^Bearer (asc_[A-Za-z0-9_-]{43})$/.exec(headers.get("authorization") ?? "")
  if (!match) throw new AscendError("Service authentication is required.", 401, "authentication")
  const digest = sha256(match[1])
  const row = await one(db, sql`select id, name, kind, token_sha256, capabilities, allowed_actions, active from ascend_service_identities where token_sha256 = ${digest}`)
  if (!row || !timingSafeEqual(Buffer.from(String(row.token_sha256), "hex"), Buffer.from(digest, "hex")))
    throw new AscendError("Service authentication failed.", 401, "authentication")
  if (!row.active) throw new AscendError("This service identity has been revoked.", 403, "authentication")
  const capabilities = (row.capabilities as string[]).filter((c): c is ServiceCapability => (SERVICE_CAPABILITIES as readonly string[]).includes(c))
  if (!capabilities.includes(capability)) throw new AscendError("This service identity lacks the required capability.", 403, "permission")
  return { kind: "service", id: String(row.id), name: String(row.name), identityKind: row.kind as "worker" | "agent", capabilities, allowedActions: row.allowed_actions as string[] }
}

/* ------------------------------------------------------------------ definitions and controls ---------------------------------- */

async function ensureDefinitions(tx: Exec) {
  for (const spec of Object.values(ACTION_REGISTRY))
    await tx.execute(sql`insert into ascend_automation_definitions (action_type) values (${spec.type}) on conflict (action_type) do nothing`)
}
type Definition = { actionType: string; enabled: boolean; intervalSeconds: number | null; cooldownSeconds: number; maxConcurrency: number; maxAttempts: number;
  timeoutSeconds: number; requiresApproval: boolean; approvalTtlSeconds: number; policyVersion: number; marketScope: string[]; expiresAt: string | null }
const definitionOf = (r: Row): Definition => ({
  actionType: String(r.action_type), enabled: Boolean(r.enabled), intervalSeconds: r.interval_seconds == null ? null : Number(r.interval_seconds),
  cooldownSeconds: Number(r.cooldown_seconds), maxConcurrency: Number(r.max_concurrency), maxAttempts: Number(r.max_attempts), timeoutSeconds: Number(r.timeout_seconds),
  requiresApproval: Boolean(r.requires_approval), approvalTtlSeconds: Number(r.approval_ttl_seconds), policyVersion: Number(r.policy_version),
  marketScope: r.market_scope as string[], expiresAt: iso(r.expires_at),
})
async function suspension(tx: Exec, actionType: string): Promise<string | null> {
  const rows = await rowsOf(tx, sql`select scope, reason from ascend_automation_controls where suspended and scope in ('global', ${"action:" + actionType})`)
  const g = rows.find((r) => r.scope === "global")
  return g ? `Global emergency stop: ${String(g.reason)}` : rows[0] ? `Action suspended: ${String(rows[0].reason)}` : null
}
async function event(tx: Exec, executionId: string, name: string, from: string | null, to: string | null, actor: Actor, detail: Record<string, unknown> = {}) {
  await tx.execute(sql`insert into ascend_execution_events (execution_id, event, from_status, to_status, actor_kind, actor_ref, detail)
    values (${executionId}, ${name}, ${from}, ${to}, ${actorKind(actor)}, ${actorRef(actor)}, ${JSON.stringify(detail)}::jsonb)`)
}
async function controlEvent(tx: Exec, name: string, subject: string, actorId: string | null, detail: Record<string, unknown>) {
  await tx.execute(sql`insert into ascend_control_events (event, subject, actor_id, detail) values (${name}, ${subject}, ${actorId}, ${JSON.stringify(detail)}::jsonb)`)
}

/* ------------------------------------------------------------------ submission -------------------------------------------------- */

export type SubmitInput = { actionType: unknown; payload?: unknown; scope?: unknown; idempotencyKey?: unknown; correlationId?: unknown; originRef?: string }
const IDEMPOTENCY = /^[A-Za-z0-9._:-]{8,200}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function submitExecution(actor: Actor, input: SubmitInput, now = new Date()) {
  let validated
  try { validated = validatePayload(input.actionType, input.payload) } catch (e) { if (e instanceof AscendFailure) throw fromFailure(e); throw e }
  const { spec, payload } = validated
  if (actor.kind === "service" && !actor.allowedActions.includes(spec.type)) throw new AscendError("This service identity may not request that action.", 403, "permission")
  const origin = actor.kind === "founder" ? "founder" : actor.kind === "service" ? "agent" : "schedule"
  const idempotencyKey = input.idempotencyKey === undefined ? `${origin}:${randomUUID()}` : input.idempotencyKey
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY.test(idempotencyKey)) throw new AscendError("The idempotency key must be 8-200 safe characters.", 400, "invalid_payload")
  const correlationId = input.correlationId === undefined ? randomUUID() : input.correlationId
  if (typeof correlationId !== "string" || !UUID.test(correlationId)) throw new AscendError("The correlation identifier must be a UUID.", 400, "invalid_payload")
  const payloadJson = canonicalJson(payload)
  const payloadSha = sha256(`${spec.type}@${spec.version}:${payloadJson}`)

  if (actor.kind === "founder" && /^(agent|schedule):/.test(idempotencyKey)) throw new AscendError("That idempotency key prefix is reserved for machine callers.", 400, "invalid_payload")

  return db.transaction(async (tx) => {
    await ensureDefinitions(tx)
    // B2.9: lock the definition exclusively so concurrent submissions of one automation serialise. Under a shared lock two
    // requests with different keys could both pass the cooldown check below and both insert.
    const def = definitionOf((await one(tx, sql`select * from ascend_automation_definitions where action_type = ${spec.type} for update`))!)
    let requested
    try { requested = normaliseScope(input.scope, def.marketScope) } catch (e) { if (e instanceof AscendFailure) throw fromFailure(e); throw e }
    const scopeJson = canonicalJson(requested)
    // Replays return the original record; a key reused for different work (action, payload or market scope) is refused, never merged.
    const sameWork = (r: Row) => r.action_type === spec.type && r.payload_sha256 === payloadSha && canonicalJson(r.scope) === scopeJson
    const existing = await one(tx, sql`select id, status, action_type, payload_sha256, scope, correlation_id from ascend_executions where idempotency_key = ${idempotencyKey}`)
    if (existing) {
      if (!sameWork(existing)) throw new AscendError("This idempotency key was already used for different work.", 409, "duplicate")
      return { id: String(existing.id), status: String(existing.status) as ExecutionState, correlationId: String(existing.correlation_id), replay: true }
    }
    const rules: string[] = []
    if (!def.enabled) throw new AscendError("This automation is disabled. A founder must enable it first.", 409, "policy_rejection")
    if (def.expiresAt && new Date(def.expiresAt) <= now) throw new AscendError("This automation definition has expired.", 409, "policy_rejection")
    let scope
    try { scope = validateScope(input.scope, def.marketScope) } catch (e) { if (e instanceof AscendFailure) throw fromFailure(e); throw e }
    rules.push(`markets ${scope.markets.join(",")} within ${def.marketScope.join(",")}`)
    if (def.cooldownSeconds > 0) {
      const recent = await one(tx, sql`select id from ascend_executions where action_type = ${spec.type} and payload_sha256 = ${payloadSha} and scope = ${scopeJson}::jsonb
        and created_at > ${new Date(now.getTime() - def.cooldownSeconds * 1000)} and status not in ('cancelled','expired','superseded','failed','dead_lettered') limit 1`)
      if (recent) throw new AscendError(`The same operation ran within its ${def.cooldownSeconds}s cooldown.`, 429, "rate_limited")
      rules.push(`cooldown ${def.cooldownSeconds}s clear`)
    }
    const status: ExecutionState = def.requiresApproval ? "pending_approval" : "queued"
    rules.push(def.requiresApproval ? "founder approval required" : "approval not required by policy")
    const id = randomUUID()
    const deadline = new Date(now.getTime() + (def.requiresApproval ? def.approvalTtlSeconds : 0) * 1000 + 6 * 3600 * 1000)
    const decision = { decision: "accepted", policyVersion: def.policyVersion, requiresApproval: def.requiresApproval, rules, evaluatedAt: now.toISOString() }
    const inserted = await rowsOf(tx, sql`insert into ascend_executions (id, correlation_id, idempotency_key, action_type, payload_version, payload, payload_sha256, scope,
        policy_version, policy_decision, origin, origin_ref, requested_by_admin, requested_by_service, status, approval_required, deadline_at, available_at,
        max_attempts, created_at, updated_at)
      values (${id}, ${correlationId}, ${idempotencyKey}, ${spec.type}, ${spec.version}, ${payloadJson}::jsonb, ${payloadSha}, ${JSON.stringify(scope)}::jsonb,
        ${def.policyVersion}, ${JSON.stringify(decision)}::jsonb, ${origin}, ${input.originRef ?? null}, ${actor.kind === "founder" ? actor.id : null},
        ${actor.kind === "service" ? actor.id : null}, ${status}, ${def.requiresApproval}, ${deadline}, ${now}, ${def.maxAttempts}, ${now}, ${now})
      on conflict (idempotency_key) do nothing returning id`)
    if (!inserted.length) {
      // A concurrent request with the same key committed first: return its record (or refuse a mismatched reuse).
      const winner = (await one(tx, sql`select id, status, action_type, payload_sha256, scope, correlation_id from ascend_executions where idempotency_key = ${idempotencyKey}`))!
      if (!sameWork(winner)) throw new AscendError("This idempotency key was already used for different work.", 409, "duplicate")
      return { id: String(winner.id), status: String(winner.status) as ExecutionState, correlationId: String(winner.correlation_id), replay: true }
    }
    await event(tx, id, "created", null, status, actor, { policyVersion: def.policyVersion, origin })
    return { id, status, correlationId, replay: false }
  })
}

/* ------------------------------------------------------------------ founder decisions ------------------------------------------ */

async function lockExecution(tx: Exec, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new AscendError("Invalid execution identifier.", 400, "invalid_payload")
  const row = await one(tx, sql`select * from ascend_executions where id = ${id} for update`)
  if (!row) throw new AscendError("Execution not found.", 404)
  return row
}

/** Approval binds the exact payload digest and policy version the founder reviewed. */
export async function approveExecution(actor: FounderActor, id: unknown, expected: { payloadSha256: unknown; policyVersion: unknown }, now = new Date()) {
  return db.transaction(async (tx) => {
    const row = await lockExecution(tx, id)
    if (row.status !== "pending_approval") throw new AscendError("Only executions awaiting approval can be approved.", 409, "business_rule")
    const def = definitionOf((await one(tx, sql`select * from ascend_automation_definitions where action_type = ${row.action_type} for share`))!)
    if (expected.payloadSha256 !== row.payload_sha256) throw new AscendError("The operation changed since you reviewed it. Reload before approving.", 409, "policy_rejection")
    if (Number(expected.policyVersion) !== Number(row.policy_version) || def.policyVersion !== Number(row.policy_version))
      throw new AscendError("The automation policy changed since this was requested. Cancel it and request it again.", 409, "policy_rejection")
    if (!def.enabled) throw new AscendError("This automation is disabled.", 409, "policy_rejection")
    const digest = sha256(approvalBinding({ executionId: String(row.id), actionType: String(row.action_type), payloadSha256: String(row.payload_sha256), scope: row.scope, policyVersion: Number(row.policy_version) }))
    const expires = new Date(now.getTime() + def.approvalTtlSeconds * 1000)
    await tx.execute(sql`update ascend_executions set status = 'approved', approved_by = ${actor.id}, approved_at = ${now}, approval_expires_at = ${expires},
      approval_digest = ${digest}, updated_at = ${now} where id = ${row.id}`)
    await event(tx, String(row.id), "approved", "pending_approval", "approved", actor, { approvalExpiresAt: expires.toISOString(), policyVersion: Number(row.policy_version) })
    await tx.execute(sql`update ascend_executions set status = 'queued', available_at = ${now}, updated_at = ${now} where id = ${row.id}`)
    await event(tx, String(row.id), "queued", "approved", "queued", actor)
    return { id: String(row.id), status: "queued" as const, approvalExpiresAt: expires.toISOString() }
  })
}

function cleanReason(reason: unknown) {
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.length > 500) throw new AscendError("Give a reason of 3 to 500 characters.", 400, "invalid_payload")
  return sanitiseError(reason.trim())
}

export async function rejectExecution(actor: FounderActor, id: unknown, reason: unknown, now = new Date()) {
  const why = cleanReason(reason)
  return db.transaction(async (tx) => {
    const row = await lockExecution(tx, id)
    if (row.status !== "pending_approval") throw new AscendError("Only executions awaiting approval can be rejected.", 409, "business_rule")
    await tx.execute(sql`update ascend_executions set status = 'cancelled', failure_class = 'policy_rejection', last_error = ${"Rejected by founder: " + why},
      completed_at = ${now}, updated_at = ${now} where id = ${row.id}`)
    await event(tx, String(row.id), "rejected", "pending_approval", "cancelled", actor, { reason: why })
    return { id: String(row.id), status: "cancelled" as const }
  })
}

/** Cancels anything not yet running. A running execution is asked to stop; it is never reported cancelled until it is. */
export async function cancelExecution(actor: FounderActor | ServiceActor, id: unknown, reason: unknown, now = new Date()) {
  const why = cleanReason(reason)
  return db.transaction(async (tx) => {
    const row = await lockExecution(tx, id)
    if (actor.kind === "service" && row.requested_by_service !== actor.id) throw new AscendError("Execution not found.", 404)
    const from = String(row.status) as ExecutionState
    if (TERMINAL_STATES.includes(from) || from === "ambiguous") throw new AscendError("This execution has already finished.", 409, "business_rule")
    if (from === "running") {
      await tx.execute(sql`update ascend_executions set cancel_requested = true, updated_at = ${now} where id = ${row.id}`)
      await event(tx, String(row.id), "cancel_requested", from, from, actor, { reason: why })
      return { id: String(row.id), status: from, cancelRequested: true }
    }
    await tx.execute(sql`update ascend_executions set status = 'cancelled', cancel_requested = true, failure_class = 'cancelled', last_error = ${"Cancelled: " + why},
      lease_token = null, lease_owner = null, lease_expires_at = null, completed_at = ${now}, updated_at = ${now} where id = ${row.id}`)
    await event(tx, String(row.id), "cancelled", from, "cancelled", actor, { reason: why })
    return { id: String(row.id), status: "cancelled" as const, cancelRequested: true }
  })
}

/** A manual retry re-enters current policy: it is re-approved if policy requires, and keeps the same execution identity. */
export async function retryExecution(actor: FounderActor, id: unknown, now = new Date()) {
  return db.transaction(async (tx) => {
    const row = await lockExecution(tx, id)
    const from = String(row.status)
    if (from !== "failed" && from !== "dead_lettered") throw new AscendError("Only failed or dead-letter executions can be retried.", 409, "business_rule")
    if (row.failure_class === "invalid_payload") throw new AscendError("An invalid payload cannot be retried. Request a corrected operation.", 409, "invalid_payload")
    const def = definitionOf((await one(tx, sql`select * from ascend_automation_definitions where action_type = ${row.action_type} for share`))!)
    if (!def.enabled) throw new AscendError("This automation is disabled.", 409, "policy_rejection")
    try { validateScope(row.scope, def.marketScope) } catch (e) { if (e instanceof AscendFailure) throw fromFailure(e, 409); throw e }
    const to: ExecutionState = def.requiresApproval ? "pending_approval" : "queued"
    const deadline = new Date(now.getTime() + (def.requiresApproval ? def.approvalTtlSeconds : 0) * 1000 + 6 * 3600 * 1000)
    await tx.execute(sql`update ascend_executions set status = ${to}, attempts = 0, max_attempts = ${def.maxAttempts}, policy_version = ${def.policyVersion},
      approved_by = null, approved_at = null, approval_expires_at = null, approval_digest = null, failure_class = null, last_error = null, result = null,
      cancel_requested = false, completed_at = null, available_at = ${now}, deadline_at = ${deadline}, updated_at = ${now} where id = ${row.id}`)
    await event(tx, String(row.id), "manual_retry", from, to, actor, { policyVersion: def.policyVersion })
    return { id: String(row.id), status: to }
  })
}

export async function reconcileAmbiguous(actor: FounderActor, id: unknown, outcome: unknown, note: unknown, now = new Date()) {
  const why = cleanReason(note)
  if (outcome !== "completed" && outcome !== "failed") throw new AscendError("Choose whether the operation completed or failed.", 400, "invalid_payload")
  return db.transaction(async (tx) => {
    const row = await lockExecution(tx, id)
    if (row.status !== "ambiguous") throw new AscendError("Only executions needing reconciliation can be reconciled.", 409, "business_rule")
    await tx.execute(sql`update ascend_executions set status = ${outcome}, failure_class = ${outcome === "failed" ? "ambiguous" : null},
      last_error = ${outcome === "failed" ? "Reconciled as failed: " + why : null}, completed_at = ${now}, updated_at = ${now} where id = ${row.id}`)
    await event(tx, String(row.id), "reconciled", "ambiguous", outcome, actor, { note: why })
    return { id: String(row.id), status: outcome }
  })
}

/* ------------------------------------------------------------------ controls and definitions ---------------------------------- */

export async function setControl(actor: FounderActor, scope: unknown, suspended: unknown, reason: unknown, expectedVersion?: unknown) {
  const why = cleanReason(reason)
  if (typeof suspended !== "boolean") throw new AscendError("Choose suspend or resume.", 400, "invalid_payload")
  if (typeof scope !== "string" || !(scope === "global" || (/^action:/.test(scope) && ACTION_REGISTRY[scope.slice(7)])))
    throw new AscendError("Unknown control scope.", 400, "invalid_payload")
  return db.transaction(async (tx) => {
    const current = await one(tx, sql`select suspended, version from ascend_automation_controls where scope = ${scope} for update`)
    if (current && expectedVersion !== undefined && Number(expectedVersion) !== Number(current.version))
      throw new AscendError("The control changed since you loaded it. Reload and try again.", 409, "business_rule")
    const version = current ? Number(current.version) + 1 : 1
    await tx.execute(sql`insert into ascend_automation_controls (scope, suspended, reason, changed_by, changed_at, version) values (${scope}, ${suspended}, ${why}, ${actor.id}, now(), ${version})
      on conflict (scope) do update set suspended = excluded.suspended, reason = excluded.reason, changed_by = excluded.changed_by, changed_at = now(), version = ${version}`)
    await controlEvent(tx, suspended ? "suspended" : "resumed", scope, actor.id, { reason: why, version })
    return { scope, suspended, version }
  })
}

const DEFINITION_FIELDS = { enabled: "boolean", intervalSeconds: "interval", cooldownSeconds: [0, 2592000], maxConcurrency: [1, 8], maxAttempts: [1, 10],
  timeoutSeconds: [1, 50], requiresApproval: "boolean", approvalTtlSeconds: [300, 604800], marketScope: "markets", expiresAt: "date" } as const

/** Any change other than enabling or disabling increments the policy version, invalidating outstanding approvals. */
export async function updateDefinition(actor: FounderActor, actionType: unknown, patch: unknown) {
  if (typeof actionType !== "string" || !ACTION_REGISTRY[actionType]) throw new AscendError("Unknown automation.", 404)
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new AscendError("Changes are required.", 400, "invalid_payload")
  const p = patch as Record<string, unknown>
  const sets: SQL[] = []; let material = false; const changed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(p)) {
    const rule = (DEFINITION_FIELDS as Record<string, unknown>)[key]
    if (!rule) throw new AscendError(`Unsupported setting: ${key.slice(0, 40)}.`, 400, "invalid_payload")
    const column = key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())
    if (rule === "boolean") { if (typeof value !== "boolean") throw new AscendError(`${key} must be true or false.`, 400, "invalid_payload") }
    else if (rule === "interval") { if (value !== null && (!Number.isInteger(value) || (value as number) < 300 || (value as number) > 2592000)) throw new AscendError("The schedule interval must be empty or 300 to 2,592,000 seconds.", 400, "invalid_payload") }
    else if (rule === "markets") { if (!Array.isArray(value) || !value.length || value.length > 50 || value.some((m) => typeof m !== "string" || !/^[A-Z]{2}$/.test(m))) throw new AscendError("Markets must be two-letter country codes.", 400, "invalid_payload") }
    else if (rule === "date") { if (value !== null && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) throw new AscendError("The expiry must be a date or empty.", 400, "invalid_payload") }
    else { const [min, max] = rule as readonly [number, number]; if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new AscendError(`${key} must be from ${min} to ${max}.`, 400, "invalid_payload") }
    if (key !== "enabled") material = true
    changed[key] = value
    sets.push(rule === "markets" ? sql`${sql.identifier(column)} = ${`{${[...new Set(value as string[])].sort().join(",")}}`}::text[]` : sql`${sql.identifier(column)} = ${value as never}`)
  }
  if (!sets.length) throw new AscendError("Changes are required.", 400, "invalid_payload")
  if (material) sets.push(sql`policy_version = policy_version + 1`)
  sets.push(sql`updated_by = ${actor.id}`, sql`updated_at = now()`)
  return db.transaction(async (tx) => {
    await ensureDefinitions(tx)
    const row = await one(tx, sql`update ascend_automation_definitions set ${sql.join(sets, sql`, `)} where action_type = ${actionType} returning *`)
    const def = definitionOf(row!)
    await controlEvent(tx, "definition_updated", `action:${actionType}`, actor.id, { changed, policyVersion: def.policyVersion })
    return def
  })
}

/* ------------------------------------------------------------------ service identities ---------------------------------------- */

export async function createServiceIdentity(actor: FounderActor, input: { name: unknown; kind: unknown; capabilities: unknown; allowedActions?: unknown }) {
  const { name, kind } = input
  if (typeof name !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(name)) throw new AscendError("Use a lowercase name of 3-63 letters, digits or hyphens.", 400, "invalid_payload")
  if (kind !== "worker" && kind !== "agent") throw new AscendError("Choose a worker or agent identity.", 400, "invalid_payload")
  const caps = Array.isArray(input.capabilities) ? [...new Set(input.capabilities)] : []
  const permitted = kind === "worker" ? ["worker.execute"] : ["operations.submit", "operations.read", "operations.cancel"]
  if (!caps.length || caps.some((c) => !permitted.includes(String(c)))) throw new AscendError(`A ${kind} identity may only hold: ${permitted.join(", ")}.`, 400, "permission")
  const actions = Array.isArray(input.allowedActions) ? [...new Set(input.allowedActions)] : []
  if (actions.some((a) => typeof a !== "string" || !ACTION_REGISTRY[a])) throw new AscendError("Allowed actions must be registered automations.", 400, "invalid_payload")
  if (kind === "agent" && caps.includes("operations.submit") && !actions.length) throw new AscendError("An agent that submits work needs at least one allowed action.", 400, "invalid_payload")
  // B2.9: a worker executes only the automations it is assigned. An empty list claims nothing (fail closed).
  if (kind === "worker" && !actions.length) throw new AscendError("A worker needs at least one automation it may execute.", 400, "invalid_payload")
  const token = `asc_${randomBytes(32).toString("base64url")}`
  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.execute(sql`insert into ascend_service_identities (id, name, kind, token_sha256, capabilities, allowed_actions, created_by)
      values (${id}, ${name}, ${kind}, ${sha256(token)}, ${`{${caps.join(",")}}`}::text[], ${`{${actions.join(",")}}`}::text[], ${actor.id})`)
    await controlEvent(tx, "identity_created", `identity:${name}`, actor.id, { kind, capabilities: caps, allowedActions: actions })
  })
  // The only time the token exists in plain text. It is never stored or logged.
  return { id, name, kind, token }
}
export async function rotateServiceIdentity(actor: FounderActor, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new AscendError("Invalid identity.", 400)
  const token = `asc_${randomBytes(32).toString("base64url")}`
  return db.transaction(async (tx) => {
    const row = await one(tx, sql`update ascend_service_identities set token_sha256 = ${sha256(token)}, rotated_at = now() where id = ${id} and active returning name`)
    if (!row) throw new AscendError("Only an active identity can be rotated.", 409)
    await controlEvent(tx, "identity_rotated", `identity:${String(row.name)}`, actor.id, {})
    return { id, name: String(row.name), token }
  })
}
export async function revokeServiceIdentity(actor: FounderActor, id: unknown, reason: unknown) {
  const why = cleanReason(reason)
  if (typeof id !== "string" || !UUID.test(id)) throw new AscendError("Invalid identity.", 400)
  return db.transaction(async (tx) => {
    const row = await one(tx, sql`update ascend_service_identities set active = false, revoked_at = now(), revoked_by = ${actor.id} where id = ${id} and active returning name`)
    if (!row) throw new AscendError("This identity is already revoked.", 409)
    await tx.execute(sql`update ascend_workers set status = 'stopped' where service_identity_id = ${id}`)
    await controlEvent(tx, "identity_revoked", `identity:${String(row.name)}`, actor.id, { reason: why })
    return { id, revoked: true }
  })
}

/* ------------------------------------------------------------------ worker lifecycle -------------------------------------------- */

const WORKER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/
export async function heartbeat(service: ServiceActor, input: { workerId: unknown; version: unknown; maxConcurrency: unknown; inFlight: unknown; status?: unknown }, now = new Date()) {
  if (service.identityKind !== "worker") throw new AscendError("Only worker identities can register workers.", 403, "permission")
  const { workerId, version } = input
  const maxConcurrency = Number(input.maxConcurrency), inFlight = Number(input.inFlight)
  if (typeof workerId !== "string" || !WORKER_ID.test(workerId)) throw new AscendError("Invalid worker identifier.", 400, "invalid_payload")
  if (typeof version !== "string" || !/^[A-Za-z0-9._+-]{1,80}$/.test(version)) throw new AscendError("Invalid worker version.", 400, "invalid_payload")
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 8 || !Number.isInteger(inFlight) || inFlight < 0 || inFlight > maxConcurrency)
    throw new AscendError("Invalid worker load.", 400, "invalid_payload")
  const status = input.status === "draining" || input.status === "stopped" ? input.status : "active"
  const row = await one(db, sql`insert into ascend_workers (id, service_identity_id, version, status, max_concurrency, in_flight, started_at, last_heartbeat_at)
    values (${workerId}, ${service.id}, ${version}, ${status}, ${maxConcurrency}, ${inFlight}, ${now}, ${now})
    on conflict (id) do update set version = excluded.version, status = excluded.status, max_concurrency = excluded.max_concurrency,
      in_flight = excluded.in_flight, last_heartbeat_at = excluded.last_heartbeat_at
    where ascend_workers.service_identity_id = excluded.service_identity_id returning id`)
  if (!row) throw new AscendError("That worker identifier belongs to another identity.", 403, "permission")
  return { workerId, status }
}

/** Recover leases abandoned by a crashed or partitioned worker. Idempotent actions re-queue; others need reconciliation. */
export async function reapExpiredLeases(now = new Date()) {
  return db.transaction(async (tx) => {
    const expired = await rowsOf(tx, sql`select id, status, action_type, attempts, max_attempts from ascend_executions
      where status in ('leased','running') and lease_expires_at <= ${now} order by lease_expires_at limit 100 for update skip locked`)
    const outcome = { requeued: 0, deadLettered: 0, ambiguous: 0 }
    for (const r of expired) {
      const from = String(r.status)
      const idempotent = ACTION_REGISTRY[String(r.action_type)]?.idempotent === true
      const to = from === "running" && !idempotent ? "ambiguous" : Number(r.attempts) >= Number(r.max_attempts) ? "dead_lettered" : "retry_scheduled"
      await tx.execute(sql`update ascend_executions set status = ${to}, lease_token = null, lease_owner = null, lease_expires_at = null, available_at = ${now},
        failure_class = ${to === "ambiguous" ? "ambiguous" : "transient"}, last_error = ${to === "ambiguous" ? "The worker lease expired during a non-idempotent operation; outcome unknown." : "The worker lease expired before the operation finished."},
        completed_at = ${to === "dead_lettered" ? now : null}, updated_at = ${now} where id = ${r.id}`)
      await event(tx, String(r.id), "lease_expired", from, to, { kind: "system" }, { attempt: Number(r.attempts) })
      if (to === "ambiguous") outcome.ambiguous++; else if (to === "dead_lettered") outcome.deadLettered++; else outcome.requeued++
    }
    return outcome
  })
}

/** Expire work whose deadline has passed before it could run. */
async function expireOverdue(tx: Exec, now: Date) {
  const rows = await rowsOf(tx, sql`update ascend_executions set status = 'expired', failure_class = 'deadline_exceeded', last_error = 'The execution deadline passed before it ran.',
    completed_at = ${now}, updated_at = ${now} where id in (select id from ascend_executions where status in ('pending_approval','approved','scheduled','queued','retry_scheduled')
    and deadline_at <= ${now} order by deadline_at limit 100 for update skip locked) returning id`)
  for (const r of rows) await event(tx, String(r.id), "expired", null, "expired", { kind: "system" })
  return rows.length
}

export type Claim = { id: string; token: string; actionType: string; attempt: number; leaseExpiresAt: string; timeoutSeconds: number }

/**
 * Atomic claim: one due execution, row-locked with SKIP LOCKED so concurrent workers never take the same row.
 * Per-action concurrency is serialised on the definition row; global backpressure caps total in-flight work.
 */
export async function claimExecution(service: ServiceActor, workerId: string, now = new Date()): Promise<Claim | null> {
  if (service.identityKind !== "worker") throw new AscendError("Only worker identities can claim work.", 403, "permission")
  await reapExpiredLeases(now)
  return db.transaction(async (tx) => {
    // Serialise the claim decision so global and per-action concurrency caps are exact under concurrent workers.
    // Held only for this short transaction; the execution itself runs outside it.
    await tx.execute(sql`select pg_advisory_xact_lock(${CLAIM_LOCK_KEY})`)
    // B2.9: claim only the automations this worker identity is assigned, re-read inside the claim lock so a narrowed
    // or revoked identity takes effect immediately. An identity with no assignment claims nothing.
    const identity = await one(tx, sql`select active, allowed_actions from ascend_service_identities where id = ${service.id}`)
    if (!identity?.active) throw new AscendError("This service identity has been revoked.", 403, "authentication")
    const permitted = (identity.allowed_actions as string[]).filter((a) => ACTION_REGISTRY[a])
    if (!permitted.length) return null
    const worker = await one(tx, sql`select status from ascend_workers where id = ${workerId} and service_identity_id = ${service.id}`)
    if (!worker) throw new AscendError("Register the worker with a heartbeat first.", 409, "authentication")
    if (worker.status !== "active") return null
    await expireOverdue(tx, now)
    const globalStop = await one(tx, sql`select 1 from ascend_automation_controls where scope = 'global' and suspended`)
    if (globalStop) return null
    const active = Number((await one(tx, sql`select count(*)::int c from ascend_executions where status in ('leased','running')`))!.c)
    if (active >= globalConcurrency()) return null
    const excluded: string[] = []
    for (let i = 0; i < 5; i++) {
      const candidate = await one(tx, sql`select e.id, e.action_type from ascend_executions e
        where e.status in ('queued','retry_scheduled') and e.available_at <= ${now} and e.deadline_at > ${now} and e.attempts < e.max_attempts
          and e.action_type in (${sql.join(permitted.map((a) => sql`${a}`), sql`, `)})
          and not exists (select 1 from ascend_automation_controls c where c.suspended and c.scope = 'action:' || e.action_type)
          ${excluded.length ? sql`and e.action_type not in (${sql.join(excluded.map((x) => sql`${x}`), sql`, `)})` : sql``}
        order by e.available_at, e.id for update of e skip locked limit 1`)
      if (!candidate) return null
      const actionType = String(candidate.action_type)
      const def = definitionOf((await one(tx, sql`select * from ascend_automation_definitions where action_type = ${actionType} for update`))!)
      const running = Number((await one(tx, sql`select count(*)::int c from ascend_executions where action_type = ${actionType} and status in ('leased','running')`))!.c)
      if (running >= def.maxConcurrency) { excluded.push(actionType); continue }
      const token = randomUUID()
      const leaseExpires = new Date(now.getTime() + (def.timeoutSeconds + LEASE_GRACE_SECONDS) * 1000)
      const claimed = (await one(tx, sql`update ascend_executions set status = 'leased', attempts = attempts + 1, lease_token = ${token}, lease_owner = ${workerId},
        lease_expires_at = ${leaseExpires}, updated_at = ${now} where id = ${candidate.id} returning attempts, status`))!
      await event(tx, String(candidate.id), "claimed", null, "leased", service, { workerId, attempt: Number(claimed.attempts) })
      return { id: String(candidate.id), token, actionType, attempt: Number(claimed.attempts), leaseExpiresAt: leaseExpires.toISOString(), timeoutSeconds: def.timeoutSeconds }
    }
    return null
  })
}

type StartDecision = { run: true; payload: Record<string, unknown>; scope: { markets: string[] } } | { run: false; status: ExecutionState; reason: string }

/** B2.9: a lease is honoured only for a worker registered to the calling identity, not merely for whoever holds the token. */
const ownedBy = (service: ServiceActor) => sql`and lease_owner in (select w.id from ascend_workers w where w.service_identity_id = ${service.id})`

/** Revalidate everything immediately before execution, inside the row lock. Any doubt stops the run. */
export async function startExecution(service: ServiceActor, claim: Pick<Claim, "id" | "token">, now = new Date()): Promise<StartDecision> {
  return db.transaction(async (tx) => {
    const row = await one(tx, sql`select * from ascend_executions where id = ${claim.id} and lease_token = ${claim.token} and status = 'leased' ${ownedBy(service)} for update`)
    if (!row) return { run: false, status: "leased", reason: "The lease is no longer held by this worker." }
    const settle = async (to: ExecutionState, failureClass: FailureClass | null, reason: string, extra: SQL = sql``) => {
      const terminal = TERMINAL_STATES.includes(to)
      await tx.execute(sql`update ascend_executions set status = ${to}, lease_token = null, lease_owner = null, lease_expires_at = null,
        failure_class = ${failureClass}, last_error = ${failureClass ? reason : null}, completed_at = ${terminal ? now : null}, updated_at = ${now} ${extra} where id = ${row.id}`)
      await event(tx, String(row.id), "start_refused", "leased", to, service, { reason, failureClass })
      return { run: false as const, status: to, reason }
    }
    const stop = await suspension(tx, String(row.action_type))
    // Emergency stop keeps the work recoverable: it goes back to the queue without consuming the attempt.
    if (stop) return settle("queued", null, stop, sql`, attempts = attempts - 1`)
    if (row.cancel_requested) return settle("cancelled", "cancelled", "Cancelled before execution started.")
    if (new Date(String(row.deadline_at)) <= now) return settle("expired", "deadline_exceeded", "The execution deadline passed.")
    const def = definitionOf((await one(tx, sql`select * from ascend_automation_definitions where action_type = ${row.action_type} for share`))!)
    if (!def.enabled) return settle("failed", "policy_rejection", "The automation was disabled after this was requested.")
    if (def.policyVersion !== Number(row.policy_version)) return settle("failed", "policy_rejection", "The automation policy changed after approval. Request the operation again.")
    if (def.expiresAt && new Date(def.expiresAt) <= now) return settle("failed", "policy_rejection", "The automation definition has expired.")
    try { validateScope(row.scope, def.marketScope) } catch { return settle("failed", "policy_rejection", "A market in this operation is no longer authorised.") }
    if (row.approval_required) {
      if (!row.approval_expires_at || new Date(String(row.approval_expires_at)) <= now) return settle("failed", "approval_expired", "The founder approval has expired.")
      const expected = sha256(approvalBinding({ executionId: String(row.id), actionType: String(row.action_type), payloadSha256: String(row.payload_sha256), scope: row.scope, policyVersion: Number(row.policy_version) }))
      if (expected !== row.approval_digest) return settle("failed", "policy_rejection", "The approval does not match this operation.")
      const approver = await one(tx, sql`select role, active from admin_users where id = ${row.approved_by}`)
      if (!approver?.active || !hasCapability(approver.role as AdminRole, "expansion.manage")) return settle("failed", "permission", "The approving founder's authority has been revoked.")
    }
    // B2.9: the executing identity's authority is re-read here too, so revocation or narrowing between claim and start stops the run.
    const executor = await one(tx, sql`select active, capabilities, allowed_actions from ascend_service_identities where id = ${service.id}`)
    if (!executor?.active || !(executor.capabilities as string[]).includes("worker.execute") || !(executor.allowed_actions as string[]).includes(String(row.action_type)))
      return settle("queued", null, "The worker identity is no longer authorised for this automation.", sql`, attempts = attempts - 1`)
    if (row.requested_by_service) {
      const requester = await one(tx, sql`select active from ascend_service_identities where id = ${row.requested_by_service}`)
      if (!requester?.active) return settle("failed", "authentication", "The requesting service identity has been revoked.")
    }
    try { validatePayload(row.action_type, row.payload) } catch { return settle("failed", "invalid_payload", "The stored payload no longer matches the registered schema.") }
    await tx.execute(sql`update ascend_executions set status = 'running', updated_at = ${now} where id = ${row.id}`)
    await event(tx, String(row.id), "started", "leased", "running", service, { attempt: Number(row.attempts) })
    return { run: true, payload: row.payload as Record<string, unknown>, scope: row.scope as { markets: string[] } }
  })
}

/** Compare-and-set on the lease token: a stale or duplicate completion changes nothing. */
export async function completeExecution(service: ServiceActor, claim: Pick<Claim, "id" | "token">, outcome: { ok: true; result: Record<string, unknown> } | { ok: false; error: unknown }, now = new Date(), random = Math.random) {
  return db.transaction(async (tx) => {
    const row = await one(tx, sql`select id, attempts, max_attempts, cancel_requested from ascend_executions where id = ${claim.id} and lease_token = ${claim.token} and status = 'running' ${ownedBy(service)} for update`)
    if (!row) throw new AscendError("The execution lease expired or changed; this result was not recorded.", 409, "duplicate")
    const clear = sql`lease_token = null, lease_owner = null, lease_expires_at = null, updated_at = ${now}`
    if (outcome.ok) {
      // A cancellation that arrives during a completed run is reported truthfully as completed.
      await tx.execute(sql`update ascend_executions set status = 'completed', result = ${JSON.stringify(outcome.result)}::jsonb, completed_at = ${now}, ${clear} where id = ${row.id}`)
      await event(tx, String(row.id), "completed", "running", "completed", service, { cancelRequested: Boolean(row.cancel_requested) })
      return { id: String(row.id), status: "completed" as const }
    }
    const { failureClass, message } = classifyFailure(outcome.error)
    const attempt = Number(row.attempts)
    let to: ExecutionState
    let availableAt = now
    if (row.cancel_requested) to = "cancelled"
    else if (!RETRYABLE.has(failureClass)) to = "failed"
    else if (attempt >= Number(row.max_attempts)) to = "dead_lettered"
    else { to = "retry_scheduled"; availableAt = new Date(now.getTime() + retryDelaySeconds(attempt, random) * 1000) }
    const terminal = TERMINAL_STATES.includes(to)
    await tx.execute(sql`update ascend_executions set status = ${to}, failure_class = ${to === "cancelled" ? "cancelled" : failureClass}, last_error = ${message},
      available_at = ${availableAt}, completed_at = ${terminal ? now : null}, ${clear} where id = ${row.id}`)
    await event(tx, String(row.id), to === "retry_scheduled" ? "retry_scheduled" : to === "dead_lettered" ? "dead_lettered" : to === "cancelled" ? "cancelled" : "failed",
      "running", to, service, { failureClass, attempt, nextAvailableAt: to === "retry_scheduled" ? availableAt.toISOString() : null })
    return { id: String(row.id), status: to, failureClass, availableAt: availableAt.toISOString() }
  })
}

export async function renewLease(service: ServiceActor, claim: Pick<Claim, "id" | "token">, now = new Date()) {
  return db.transaction(async (tx) => {
    const row = await one(tx, sql`select e.id, e.action_type, e.cancel_requested, d.timeout_seconds from ascend_executions e join ascend_automation_definitions d using (action_type)
      where e.id = ${claim.id} and e.lease_token = ${claim.token} and e.status in ('leased','running')
        and e.lease_owner in (select w.id from ascend_workers w where w.service_identity_id = ${service.id}) for update of e`)
    if (!row) throw new AscendError("The lease is no longer held.", 409, "duplicate")
    if (row.cancel_requested || (await suspension(tx, String(row.action_type)))) return { renewed: false as const, reason: "stop_requested" }
    const until = new Date(now.getTime() + (Number(row.timeout_seconds) + LEASE_GRACE_SECONDS) * 1000)
    await tx.execute(sql`update ascend_executions set lease_expires_at = ${until}, updated_at = ${now} where id = ${row.id}`)
    return { renewed: true as const, leaseExpiresAt: until.toISOString() }
  })
}

/** One bounded unit of worker progress: heartbeat, optional scheduling, then at most one execution. */
export async function workerTick(service: ServiceActor, input: { workerId: unknown; version: unknown; maxConcurrency: unknown; inFlight: unknown; status?: unknown }, now = new Date()) {
  const beat = await heartbeat(service, input, now)
  const scheduled = ascendSchedulerEnabled() ? await scheduleDue(now) : 0
  if (beat.status !== "active") return { workerId: beat.workerId, scheduled, claimed: null }
  const claim = await claimExecution(service, beat.workerId, now)
  if (!claim) return { workerId: beat.workerId, scheduled, claimed: null }
  const start = await startExecution(service, claim, now)
  if (!start.run) return { workerId: beat.workerId, scheduled, claimed: { id: claim.id, status: start.status, reason: start.reason } }
  let outcome: { ok: true; result: Record<string, unknown> } | { ok: false; error: unknown }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), claim.timeoutSeconds * 1000)
  try { outcome = { ok: true, result: await runAscendAction(claim.actionType, start.payload, start.scope, controller.signal, now, { timeoutMs: claim.timeoutSeconds * 1000 }) } }
  catch (error) { outcome = { ok: false, error: controller.signal.aborted ? new AscendFailure("deadline_exceeded", "The operation exceeded its execution time limit.") : error } }
  finally { clearTimeout(timer) }
  const done = await completeExecution(service, claim, outcome)
  return { workerId: beat.workerId, scheduled, claimed: { id: claim.id, status: done.status } }
}

/** Create due scheduled executions. The idempotency key per interval bucket makes this safe to run from every worker. */
export async function scheduleDue(now = new Date()) {
  if (!ascendSchedulerEnabled()) return 0
  const defs = (await rowsOf(db, sql`select * from ascend_automation_definitions d where enabled and interval_seconds is not null
    and (expires_at is null or expires_at > ${now})
    and not exists (select 1 from ascend_automation_controls c where c.suspended and c.scope in ('global', 'action:' || d.action_type))`)).map(definitionOf)
  let created = 0
  for (const def of defs) {
    if (!ACTION_REGISTRY[def.actionType]) continue
    const bucket = Math.floor(now.getTime() / 1000 / def.intervalSeconds!)
    try {
      const r = await submitExecution({ kind: "system" }, { actionType: def.actionType, idempotencyKey: `schedule:${def.actionType}:${def.policyVersion}:${bucket}`, originRef: `interval:${def.intervalSeconds}` }, now)
      if (!r.replay) created++
    } catch (error) {
      if (error instanceof AscendError && (error.failureClass === "rate_limited" || error.failureClass === "policy_rejection")) continue
      throw error
    }
  }
  return created
}

/* ------------------------------------------------------------------ founder read models ----------------------------------------- */

export async function engineOverview(now = new Date()) {
  const [controls, counts, throughput, latency, workers, definitions, identities, controlLog, recentFailures] = await Promise.all([
    rowsOf(db, sql`select scope, suspended, reason, changed_at, version from ascend_automation_controls order by scope`),
    rowsOf(db, sql`select status, count(*)::int c from ascend_executions group by status`),
    one(db, sql`select count(*) filter (where status = 'completed' and completed_at > ${new Date(now.getTime() - 3600e3)})::int completed_hour,
      count(*) filter (where status = 'completed' and completed_at > ${new Date(now.getTime() - 86400e3)})::int completed_day,
      count(*) filter (where status in ('failed','dead_lettered') and completed_at > ${new Date(now.getTime() - 86400e3)})::int failed_day from ascend_executions
      where completed_at > ${new Date(now.getTime() - 86400e3)}`),
    one(db, sql`select percentile_cont(0.5) within group (order by extract(epoch from s.occurred_at - e.created_at)) p50,
      percentile_cont(0.95) within group (order by extract(epoch from s.occurred_at - e.created_at)) p95, count(*)::int n
      from ascend_execution_events s join ascend_executions e on e.id = s.execution_id
      where s.event = 'started' and s.occurred_at > ${new Date(now.getTime() - 86400e3)} and not e.approval_required`),
    rowsOf(db, sql`select w.id, w.version, w.status, w.max_concurrency, w.in_flight, w.started_at, w.last_heartbeat_at, i.name identity, i.active identity_active,
      (select count(*)::int from ascend_executions e where e.lease_owner = w.id and e.status in ('leased','running')) leases
      from ascend_workers w join ascend_service_identities i on i.id = w.service_identity_id order by w.last_heartbeat_at desc limit 50`),
    rowsOf(db, sql`select d.*, (select max(created_at) from ascend_executions e where e.action_type = d.action_type) last_run,
      (select count(*)::int from ascend_executions e where e.action_type = d.action_type and e.created_at > ${new Date(now.getTime() - 7 * 86400e3)}) runs_week
      from ascend_automation_definitions d order by d.action_type`),
    rowsOf(db, sql`select id, name, kind, capabilities, allowed_actions, active, created_at, rotated_at, revoked_at from ascend_service_identities order by created_at desc limit 100`),
    rowsOf(db, sql`select event, subject, detail, occurred_at from ascend_control_events order by id desc limit 20`),
    rowsOf(db, sql`select count(*)::int c from ascend_execution_events where event = 'retry_scheduled' and occurred_at > ${new Date(now.getTime() - 86400e3)}`),
  ])
  const byStatus = Object.fromEntries(counts.map((r) => [String(r.status), Number(r.c)])) as Partial<Record<ExecutionState, number>>
  const staleCutoff = now.getTime() - 5 * 60e3
  // Every registered action is listed; a missing row (never expected after migration 0104) shows as safely disabled.
  const registeredDefs = Object.values(ACTION_REGISTRY).map((spec) => definitions.find((d) => d.action_type === spec.type) ?? {
    action_type: spec.type, enabled: false, interval_seconds: null, cooldown_seconds: 3600, max_concurrency: 1, max_attempts: 5, timeout_seconds: 30, requires_approval: true,
    approval_ttl_seconds: 86400, policy_version: 1, market_scope: ["GB"], expires_at: null, last_run: null, runs_week: 0 })
  return {
    generatedAt: now.toISOString(),
    flags: { engine: ascendEngineEnabled(), scheduler: ascendSchedulerEnabled(), agentApi: ascendAgentApiEnabled(), maxGlobalConcurrency: globalConcurrency() },
    controls: controls.map((c) => ({ scope: String(c.scope), suspended: Boolean(c.suspended), reason: String(c.reason), changedAt: iso(c.changed_at), version: Number(c.version) })),
    counts: byStatus,
    queue: {
      pendingApproval: byStatus.pending_approval ?? 0, queued: (byStatus.queued ?? 0) + (byStatus.retry_scheduled ?? 0),
      active: ACTIVE_STATES.reduce((n, s) => n + (byStatus[s] ?? 0), 0), deadLetters: byStatus.dead_lettered ?? 0, ambiguous: byStatus.ambiguous ?? 0, failed: byStatus.failed ?? 0,
    },
    throughput: { completedLastHour: Number(throughput?.completed_hour ?? 0), completedLastDay: Number(throughput?.completed_day ?? 0), failedLastDay: Number(throughput?.failed_day ?? 0), retriesLastDay: Number(recentFailures[0]?.c ?? 0) },
    latency: { sample: Number(latency?.n ?? 0), p50Seconds: latency?.p50 == null ? null : Math.round(Number(latency.p50)), p95Seconds: latency?.p95 == null ? null : Math.round(Number(latency.p95)) },
    workers: workers.map((w) => ({
      id: String(w.id), identity: String(w.identity), identityActive: Boolean(w.identity_active), version: String(w.version), status: String(w.status),
      maxConcurrency: Number(w.max_concurrency), inFlight: Number(w.in_flight), leases: Number(w.leases), startedAt: iso(w.started_at), lastHeartbeatAt: iso(w.last_heartbeat_at),
      stale: new Date(String(w.last_heartbeat_at)).getTime() < staleCutoff && w.status !== "stopped",
    })),
    definitions: registeredDefs.map((d) => ({ ...definitionOf(d), spec: ACTION_REGISTRY[String(d.action_type)], lastRun: iso(d.last_run), runsLastWeek: Number(d.runs_week) })),
    identities: identities.map((i) => ({ id: String(i.id), name: String(i.name), kind: String(i.kind), capabilities: i.capabilities as string[], allowedActions: i.allowed_actions as string[],
      active: Boolean(i.active), createdAt: iso(i.created_at), rotatedAt: iso(i.rotated_at), revokedAt: iso(i.revoked_at) })),
    controlLog: controlLog.map((c) => ({ event: String(c.event), subject: String(c.subject), detail: c.detail, occurredAt: iso(c.occurred_at) })),
  }
}

const listColumns = sql`id, correlation_id, idempotency_key, action_type, status, origin, origin_ref, approval_required, attempts, max_attempts, failure_class, last_error,
  created_at, updated_at, completed_at, available_at, deadline_at, lease_owner, policy_version, cancel_requested`
const listItem = (r: Row) => ({
  id: String(r.id), correlationId: String(r.correlation_id), idempotencyKey: String(r.idempotency_key), actionType: String(r.action_type), status: String(r.status) as ExecutionState,
  origin: String(r.origin), originRef: r.origin_ref ? String(r.origin_ref) : null, approvalRequired: Boolean(r.approval_required), attempts: Number(r.attempts), maxAttempts: Number(r.max_attempts),
  failureClass: r.failure_class ? String(r.failure_class) : null, error: r.last_error ? String(r.last_error) : null, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
  completedAt: iso(r.completed_at), availableAt: iso(r.available_at), deadlineAt: iso(r.deadline_at), leaseOwner: r.lease_owner ? String(r.lease_owner) : null,
  policyVersion: Number(r.policy_version), cancelRequested: Boolean(r.cancel_requested),
})

/** Keyset-paginated explorer with bounded filters. */
export async function listExecutions(filter: { status?: unknown; actionType?: unknown; q?: unknown; from?: unknown; to?: unknown; before?: unknown; limit?: unknown }) {
  const where: SQL[] = [sql`true`]
  const statuses = typeof filter.status === "string" && filter.status ? filter.status.split(",").filter((s) => /^[a-z_]{3,20}$/.test(s)).slice(0, 15) : []
  if (statuses.length) where.push(sql`status in (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})`)
  if (typeof filter.actionType === "string" && ACTION_REGISTRY[filter.actionType]) where.push(sql`action_type = ${filter.actionType}`)
  if (typeof filter.q === "string" && /^[0-9a-f-]{4,36}$/i.test(filter.q)) where.push(sql`(id::text like ${filter.q.toLowerCase() + "%"} or correlation_id::text like ${filter.q.toLowerCase() + "%"})`)
  if (typeof filter.from === "string" && Number.isFinite(Date.parse(filter.from))) where.push(sql`created_at >= ${new Date(filter.from)}`)
  if (typeof filter.to === "string" && Number.isFinite(Date.parse(filter.to))) where.push(sql`created_at < ${new Date(filter.to)}`)
  if (typeof filter.before === "string") {
    const [t, id] = filter.before.split("|")
    if (Number.isFinite(Date.parse(t)) && UUID.test(id ?? "")) where.push(sql`(created_at, id) < (${new Date(t)}, ${id}::uuid)`)
  }
  const limit = Math.min(100, Math.max(1, Number.isInteger(Number(filter.limit)) ? Number(filter.limit) : 50))
  const rows = await rowsOf(db, sql`select ${listColumns} from ascend_executions where ${sql.join(where, sql` and `)} order by created_at desc, id desc limit ${limit + 1}`)
  const items = rows.slice(0, limit).map(listItem)
  const last = items[items.length - 1]
  return { items, next: rows.length > limit && last ? `${last.createdAt}|${last.id}` : null }
}

export async function executionDetail(id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new AscendError("Invalid execution identifier.", 400)
  const row = await one(db, sql`select e.*, a.display_name approver_name from ascend_executions e left join admin_users a on a.id = e.approved_by where e.id = ${id}`)
  if (!row) throw new AscendError("Execution not found.", 404)
  const events = await rowsOf(db, sql`select event, from_status, to_status, actor_kind, actor_ref, detail, occurred_at from ascend_execution_events where execution_id = ${id} order by id limit 200`)
  const related = await rowsOf(db, sql`select id, action_type, status, created_at from ascend_executions where correlation_id = ${row.correlation_id} and id <> ${id} order by created_at limit 20`)
  return {
    ...listItem(row), payload: row.payload, payloadSha256: String(row.payload_sha256), payloadVersion: Number(row.payload_version), scope: row.scope, policyDecision: row.policy_decision,
    approval: row.approved_by ? { by: row.approver_name ? String(row.approver_name) : "Founder", at: iso(row.approved_at), expiresAt: iso(row.approval_expires_at) } : null,
    result: row.result ?? null, spec: ACTION_REGISTRY[String(row.action_type)] ?? null,
    events: events.map((e) => ({ event: String(e.event), from: e.from_status ? String(e.from_status) : null, to: e.to_status ? String(e.to_status) : null, actorKind: String(e.actor_kind),
      actorRef: e.actor_ref ? String(e.actor_ref) : null, detail: e.detail, occurredAt: iso(e.occurred_at) })),
    related: related.map((r) => ({ id: String(r.id), actionType: String(r.action_type), status: String(r.status), createdAt: iso(r.created_at) })),
  }
}

/* ------------------------------------------------------------------ agent (TITAN OS) contract ---------------------------------- */

export const AGENT_CONTRACT_VERSION = "ascend.operations/v1"
export async function agentCapabilities(service: ServiceActor) {
  const defs = (await rowsOf(db, sql`select * from ascend_automation_definitions`)).map(definitionOf)
  return {
    contract: AGENT_CONTRACT_VERSION, identity: { name: service.name, capabilities: service.capabilities },
    actions: service.allowedActions.filter((t) => ACTION_REGISTRY[t]).map((t) => {
      const spec = ACTION_REGISTRY[t]; const def = defs.find((d) => d.actionType === t)
      return { type: t, version: spec.version, title: spec.title, description: spec.description, effects: spec.effects, payload: spec.payload, defaults: spec.defaults,
        enabled: def?.enabled ?? false, requiresApproval: def?.requiresApproval ?? true, markets: def?.marketScope ?? [], policyVersion: def?.policyVersion ?? 1 }
    }),
    guarantees: ["Agents cannot approve, change controls, administer identities or bypass emergency stops.", "Execution is at-least-once with idempotency keys; results are never claimed exactly-once."],
  }
}
export async function agentOperation(service: ServiceActor, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new AscendError("Operation not found.", 404)
  const row = await one(db, sql`select ${listColumns}, result, requested_by_service from ascend_executions where id = ${id}`)
  // Another identity's operation is indistinguishable from a missing one.
  if (!row || row.requested_by_service !== service.id) throw new AscendError("Operation not found.", 404)
  const item = listItem(row)
  return { contract: AGENT_CONTRACT_VERSION, id: item.id, correlationId: item.correlationId, actionType: item.actionType, status: item.status, attempts: item.attempts,
    failureClass: item.failureClass, error: item.error, createdAt: item.createdAt, completedAt: item.completedAt, result: item.status === "completed" ? row.result : null }
}
