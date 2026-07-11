export interface BudgetScope { name: "daily_global" | "project" | "task" | "provider"; spent: number; reserved: number; limit: number | null }
export function evaluateBudgetReservation(scopes: BudgetScope[], requested: number) {
  const blockers = scopes.filter((scope) => scope.limit !== null && scope.spent + scope.reserved + requested > scope.limit)
  const alerts = scopes.filter((scope) => scope.limit !== null && scope.limit > 0 && (scope.spent + scope.reserved + requested) / scope.limit >= 0.8)
  return { allowed:blockers.length === 0, blockers, alerts }
}
export function providerBudgetEnvKey(provider: string) { return `FORGE_AI_PROVIDER_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_DAILY_USD_BUDGET` }
