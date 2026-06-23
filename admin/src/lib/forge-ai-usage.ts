export const FORGE_AI_BUDGET_WARNING_RATIO = 0.8

export interface ForgeAiCostBudgetConfig {
  maxProjectAiCost: number | null
  maxMonthlyAiCost: number | null
}

export interface ForgeAiBudgetStatus {
  limit: number | null
  used: number
  remaining: number | null
  ratio: number | null
  blocked: boolean
  warning: boolean
}

export interface ForgeAiUsageSummary {
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
}

export function resolveForgeAiCostBudgetConfig(env: Partial<Record<string, string | undefined>> = process.env): ForgeAiCostBudgetConfig {
  return {
    maxProjectAiCost: parseForgeAiCostLimit(env.FORGE_MAX_PROJECT_AI_COST),
    maxMonthlyAiCost: parseForgeAiCostLimit(env.FORGE_MAX_MONTHLY_AI_COST),
  }
}

export function parseForgeAiCostLimit(value: string | undefined): number | null {
  if (!value || !value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Number(parsed.toFixed(6))
}

export function buildForgeAiBudgetStatus(used: number, limit: number | null, pendingCost = 0): ForgeAiBudgetStatus {
  const normalisedUsed = roundCost(Math.max(0, used))
  const normalisedPending = roundCost(Math.max(0, pendingCost))
  if (limit === null) {
    return {
      limit,
      used: normalisedUsed,
      remaining: null,
      ratio: null,
      blocked: false,
      warning: false,
    }
  }

  const nextUsed = normalisedUsed + normalisedPending
  const ratio = limit > 0 ? nextUsed / limit : 0
  return {
    limit,
    used: normalisedUsed,
    remaining: roundCost(Math.max(0, limit - normalisedUsed)),
    ratio: Number(ratio.toFixed(4)),
    blocked: nextUsed >= limit,
    warning: ratio >= FORGE_AI_BUDGET_WARNING_RATIO,
  }
}

export function emptyForgeAiUsageSummary(): ForgeAiUsageSummary {
  return {
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  }
}

export function roundCost(value: number) {
  return Number(value.toFixed(6))
}

export function formatForgeAiCost(value: number) {
  return `$${value.toFixed(value >= 10 ? 2 : 4)}`
}
