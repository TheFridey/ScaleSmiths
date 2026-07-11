import "server-only"
import { desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeProviderHealth } from "@/lib/schema"
import { FORGE_AI_PROVIDERS, isForgeAiProvider, type ForgeAiProvider } from "@/lib/forge-ai"
import type { RetryCategory } from "@/lib/forge-retry-policy"
import {
  createBreakerState,
  evaluateAttempt,
  recordFailure as reduceFailure,
  recordSuccess as reduceSuccess,
  resolveBreakerConfig,
  type BreakerState,
  type BreakerTransition,
  type ProviderBreakerState,
} from "@/lib/forge-circuit-breaker"

declare global {
  var __forgeProviderBreakers: Record<string, ProviderBreakerState> | undefined
}

const REAL_PROVIDERS = FORGE_AI_PROVIDERS.filter((p): p is Exclude<ForgeAiProvider, "mock"> => p !== "mock")

export interface ProviderHealthEventContext {
  projectId?: number | null
  taskId?: number | null
  model?: string | null
  actor?: string | null
}

export interface ProviderHealthEntry {
  provider: ForgeAiProvider
  state: BreakerState
  recentFailures: number
  lastCategory: string | null
  opensUntil: string | null
  cooldownRemainingMs: number
}

export interface ProviderHealthEventRow {
  id: number
  provider: string
  event: string
  fromState: string | null
  toState: string | null
  category: string | null
  detail: string | null
  model: string | null
  createdAt: string
}

export interface ProviderHealthSnapshot {
  providers: ProviderHealthEntry[]
  recentEvents: ProviderHealthEventRow[]
}

function breakers(): Record<string, ProviderBreakerState> {
  if (!globalThis.__forgeProviderBreakers) globalThis.__forgeProviderBreakers = {}
  return globalThis.__forgeProviderBreakers
}

function getState(provider: ForgeAiProvider): ProviderBreakerState {
  const store = breakers()
  if (!store[provider]) store[provider] = createBreakerState()
  return store[provider]
}

export function resolveFailoverTarget(from: ForgeAiProvider, env: Record<string, string | undefined>): ForgeAiProvider | null {
  const raw = env.FORGE_AI_FAILOVER_ALLOW?.trim()
  if (!raw) return null
  for (const pair of raw.split(",")) {
    const [source, target] = pair.split(":").map((part) => part.trim().toLowerCase())
    if (source !== from) continue
    if (!isForgeAiProvider(target) || target === "mock" || target === from) continue
    return target
  }
  return null
}

export async function providerCanAttempt(
  provider: ForgeAiProvider,
  ctx?: ProviderHealthEventContext,
): Promise<{ allowed: boolean; state: BreakerState; reason: string }> {
  const config = resolveBreakerConfig(process.env)
  const result = evaluateAttempt(getState(provider), Date.now(), config)
  breakers()[provider] = result.next
  await maybeRecordTransition(provider, result.transition, null, "state_change", ctx)
  return { allowed: result.allowed, state: result.next.state, reason: result.reason }
}

export async function recordProviderSuccess(provider: ForgeAiProvider): Promise<void> {
  const result = reduceSuccess(getState(provider), Date.now())
  breakers()[provider] = result.next
  await maybeRecordTransition(provider, result.transition, null, "state_change")
}

export async function recordProviderFailure(
  provider: ForgeAiProvider,
  category: RetryCategory,
  detail: string,
  ctx?: ProviderHealthEventContext,
): Promise<void> {
  const config = resolveBreakerConfig(process.env)
  const result = reduceFailure(getState(provider), category, Date.now(), config)
  breakers()[provider] = result.next
  await maybeRecordTransition(provider, result.transition, category, "state_change", { ...ctx, detail } as ProviderHealthEventContext & { detail?: string })
}

export async function recordProviderFailover(input: {
  from: ForgeAiProvider
  to: ForgeAiProvider
  reason: string
  ctx?: ProviderHealthEventContext
}): Promise<void> {
  await db.insert(forgeProviderHealth).values({
    provider: input.from,
    event: "failover",
    fromState: input.from,
    toState: input.to,
    category: null,
    detail: input.reason,
    model: input.ctx?.model ?? null,
    projectId: input.ctx?.projectId ?? null,
    taskId: input.ctx?.taskId ?? null,
    actor: input.ctx?.actor ?? "system",
  })
}

async function maybeRecordTransition(
  provider: ForgeAiProvider,
  transition: BreakerTransition | null,
  category: RetryCategory | null,
  event: string,
  ctx?: ProviderHealthEventContext & { detail?: string },
): Promise<void> {
  if (!transition) return
  await db.insert(forgeProviderHealth).values({
    provider,
    event,
    fromState: transition.from,
    toState: transition.to,
    category,
    detail: ctx?.detail ?? null,
    model: ctx?.model ?? null,
    projectId: ctx?.projectId ?? null,
    taskId: ctx?.taskId ?? null,
    actor: ctx?.actor ?? "system",
  })
}

export async function loadProviderHealthSnapshot(): Promise<ProviderHealthSnapshot> {
  const now = Date.now()
  const config = resolveBreakerConfig(process.env)
  const providers: ProviderHealthEntry[] = REAL_PROVIDERS.map((provider) => {
    const state = getState(provider)
    const recentFailures = state.failures.filter((ts) => now - ts < config.windowMs).length
    return {
      provider,
      state: state.state,
      recentFailures,
      lastCategory: state.lastCategory,
      opensUntil: state.opensUntil ? new Date(state.opensUntil).toISOString() : null,
      cooldownRemainingMs: state.opensUntil ? Math.max(0, state.opensUntil - now) : 0,
    }
  })

  const rows = await db
    .select({
      id: forgeProviderHealth.id,
      provider: forgeProviderHealth.provider,
      event: forgeProviderHealth.event,
      fromState: forgeProviderHealth.fromState,
      toState: forgeProviderHealth.toState,
      category: forgeProviderHealth.category,
      detail: forgeProviderHealth.detail,
      model: forgeProviderHealth.model,
      createdAt: forgeProviderHealth.createdAt,
    })
    .from(forgeProviderHealth)
    .orderBy(desc(forgeProviderHealth.createdAt))
    .limit(20)

  return {
    providers,
    recentEvents: rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })),
  }
}
