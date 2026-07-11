import "server-only"
import { and, eq, gt, gte, sql } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { evaluateBudgetReservation, providerBudgetEnvKey, type BudgetScope } from "@/lib/forge-budget-reservations"
import { forgeActivityLogs, forgeAiBudgetReservations, forgeAiUsage } from "@/lib/schema"

export class ForgeBudgetReservationError extends Error { constructor(public safeMessage: string, public code: string) { super(safeMessage); this.name = "ForgeBudgetReservationError" } }
export interface ReserveInput { projectId?: number | null; taskId?: number | null; provider: string; model: string; estimatedMaxCost: number; idempotencyKey?: string; env?: Partial<Record<string, string | undefined>>; now?: Date }

export async function reserveForgeAiBudget(input: ReserveInput) {
  const env = input.env ?? process.env, now = input.now ?? new Date(), expiresAt = new Date(now.getTime() + positive(env.FORGE_AI_RESERVATION_TIMEOUT_MS, 15 * 60_000))
  const idempotencyKey = input.idempotencyKey ?? (input.taskId ? `task:${input.taskId}:${input.provider}:${input.model}` : `call:${randomUUID()}`)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(736264438)`)
    await tx.update(forgeAiBudgetReservations).set({ status:"abandoned", updatedAt:now, failureCategory:"reservation_expired" }).where(and(eq(forgeAiBudgetReservations.status, "reserved"), sql`${forgeAiBudgetReservations.expiresAt} <= ${now}`))
    const [existing] = await tx.select().from(forgeAiBudgetReservations).where(eq(forgeAiBudgetReservations.idempotencyKey, idempotencyKey)).limit(1)
    if (existing) throw new ForgeBudgetReservationError(existing.status === "reserved" ? "An identical AI task is already in progress." : "This AI task execution has already been accounted for.", "replayed_task")
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
    const scopes = await loadScopes(tx, input, dayStart, env)
    const decision = evaluateBudgetReservation(scopes, input.estimatedMaxCost)
    if (!decision.allowed) throw new ForgeBudgetReservationError(`AI budget reservation rejected: ${decision.blockers.map((item) => item.name).join(", ")} hard limit would be exceeded.`, "budget_exceeded")
    const [reservation] = await tx.insert(forgeAiBudgetReservations).values({ idempotencyKey, projectId:input.projectId ?? null, taskId:input.taskId ?? null, provider:input.provider, model:input.model, reservedCost:input.estimatedMaxCost.toFixed(6), expiresAt, createdAt:now, updatedAt:now }).returning()
    if (input.projectId && decision.alerts.length) await tx.insert(forgeActivityLogs).values({ projectId:input.projectId, actor:"system", action:"ai_budget_reservation_warning", message:"AI budget reservation crossed an alert threshold.", metadataJson:{ reservationId:reservation.id, scopes:decision.alerts.map((item) => item.name) } })
    return reservation
  }, { isolationLevel:"serializable" })
}

export async function reconcileForgeAiBudget(input: { reservationId: number; actualCost: number | null; usageKnown: boolean; fallbackProvider?: string | null; failureCategory?: string | null; now?: Date }) {
  const now = input.now ?? new Date(), actual = input.actualCost === null ? null : Math.max(0, input.actualCost)
  const [row] = await db.update(forgeAiBudgetReservations).set({ status:input.failureCategory ? "failed" : "reconciled", actualCost:actual?.toFixed(6) ?? null, usageKnown:input.usageKnown, fallbackProvider:input.fallbackProvider ?? null, failureCategory:input.failureCategory ?? null, reconciledAt:now, updatedAt:now }).where(and(eq(forgeAiBudgetReservations.id, input.reservationId), eq(forgeAiBudgetReservations.status, "reserved"))).returning()
  return row ?? null
}
export async function releaseForgeAiBudget(reservationId: number, failureCategory: string, now = new Date()) { return reconcileForgeAiBudget({ reservationId, actualCost:0, usageKnown:true, failureCategory, now }) }
export async function abandonExpiredForgeAiReservations(now = new Date()) { return db.update(forgeAiBudgetReservations).set({ status:"abandoned", failureCategory:"reservation_expired", updatedAt:now }).where(and(eq(forgeAiBudgetReservations.status, "reserved"), sql`${forgeAiBudgetReservations.expiresAt} <= ${now}`)).returning({ id:forgeAiBudgetReservations.id }) }

async function loadScopes(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], input: ReserveInput, dayStart: Date, env: Partial<Record<string, string | undefined>>): Promise<BudgetScope[]> {
  const active = and(eq(forgeAiBudgetReservations.status, "reserved"), gt(forgeAiBudgetReservations.expiresAt, input.now ?? new Date()))
  const usage = async (where: ReturnType<typeof and>) => Number((await tx.select({ total:sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}),0)` }).from(forgeAiUsage).where(where))[0]?.total ?? 0)
  const reservations = async (where: ReturnType<typeof and>) => Number((await tx.select({ total:sql<string>`coalesce(sum(${forgeAiBudgetReservations.reservedCost}),0)` }).from(forgeAiBudgetReservations).where(and(active, where)))[0]?.total ?? 0)
  const unknown = async (where: ReturnType<typeof and>) => Number((await tx.select({ total:sql<string>`coalesce(sum(${forgeAiBudgetReservations.actualCost}),0)` }).from(forgeAiBudgetReservations).where(and(eq(forgeAiBudgetReservations.status, "failed"), eq(forgeAiBudgetReservations.usageKnown, false), where)))[0]?.total ?? 0)
  const dailyLimit = nullable(env.FORGE_AI_DAILY_USD_BUDGET, 10), projectLimit = input.projectId ? nullable(env.FORGE_MAX_PROJECT_AI_COST, 25) : null, taskLimit = input.taskId ? nullable(env.FORGE_AI_MAX_TASK_USD_BUDGET, null) : null, providerLimit = nullable(env[providerBudgetEnvKey(input.provider)], null)
  const scopes: BudgetScope[] = [{ name:"daily_global", spent:await usage(and(gte(forgeAiUsage.completedAt, dayStart))) + await unknown(and(gte(forgeAiBudgetReservations.createdAt, dayStart))), reserved:await reservations(and(gte(forgeAiBudgetReservations.createdAt, dayStart))), limit:dailyLimit }]
  if (input.projectId) scopes.push({ name:"project", spent:await usage(and(eq(forgeAiUsage.projectId, input.projectId))) + await unknown(and(eq(forgeAiBudgetReservations.projectId, input.projectId))), reserved:await reservations(and(eq(forgeAiBudgetReservations.projectId, input.projectId))), limit:projectLimit })
  if (input.taskId) scopes.push({ name:"task", spent:await usage(and(eq(forgeAiUsage.taskId, input.taskId))) + await unknown(and(eq(forgeAiBudgetReservations.taskId, input.taskId))), reserved:await reservations(and(eq(forgeAiBudgetReservations.taskId, input.taskId))), limit:taskLimit })
  scopes.push({ name:"provider", spent:await usage(and(eq(forgeAiUsage.provider, input.provider), gte(forgeAiUsage.completedAt, dayStart))) + await unknown(and(eq(forgeAiBudgetReservations.provider, input.provider), gte(forgeAiBudgetReservations.createdAt, dayStart))), reserved:await reservations(and(eq(forgeAiBudgetReservations.provider, input.provider), gte(forgeAiBudgetReservations.createdAt, dayStart))), limit:providerLimit })
  return scopes
}
function nullable(value: string | undefined, fallback: number | null) { if (!value) return fallback; const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback }
function positive(value: string | undefined, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback }
