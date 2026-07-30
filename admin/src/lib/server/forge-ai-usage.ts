import "server-only"
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  buildForgeAiBudgetStatus,
  emptyForgeAiUsageSummary,
  resolveForgeAiCostBudgetConfig,
  roundCost,
  type ForgeAiBudgetStatus,
  type ForgeAiUsageSummary,
} from "@/lib/forge-ai-usage"
import type { ForgeAiProvider, ForgeAiUsage } from "@/lib/forge-ai"
import {
  summarizeForgeCostQuality,
  type ForgeCostQualitySummary,
  type ForgeModelUsed,
  type ForgeStageCost,
} from "@/lib/forge-cost-quality"
import type { ForgeQaArtifactState } from "@/lib/forge-qa"
import { forgeActivityLogs, forgeAiUsage, forgeProjects, forgeTasks } from "@/lib/schema"

export interface ForgeAiUsageInput {
  projectId?: number | null
  taskId?: number | null
  provider: ForgeAiProvider
  model: string
  usage: ForgeAiUsage
  estimatedCost: number | null
  startedAt: Date
  completedAt: Date
}

export interface ForgeAiUsageBudgetSnapshot {
  project: ForgeAiBudgetStatus
  monthly: ForgeAiBudgetStatus
}

export interface ForgeAiDashboardMetrics {
  todaySpend: number
  monthSpend: number
  mostExpensiveProject: {
    projectId: number | null
    projectName: string
    businessName: string | null
    estimatedCost: number
  } | null
  averageCostPerSite: number
  budget: ForgeAiUsageBudgetSnapshot
}

export interface ForgeAiProjectMetrics {
  totals: ForgeAiUsageSummary
  today: ForgeAiUsageSummary
  week: ForgeAiUsageSummary
  month: ForgeAiUsageSummary
  budget: ForgeAiUsageBudgetSnapshot
  recent: Array<{
    id: number
    taskId: number | null
    provider: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
    completedAt: Date | string
  }>
}

export class ForgeAiBudgetExceededError extends Error {
  safeMessage: string

  constructor(safeMessage: string) {
    super(safeMessage)
    this.name = "ForgeAiBudgetExceededError"
    this.safeMessage = safeMessage
  }
}

export async function recordForgeAiUsage(input: ForgeAiUsageInput) {
  const promptTokens = Math.max(0, input.usage.inputTokens ?? 0)
  const completionTokens = Math.max(0, input.usage.outputTokens ?? 0)
  const totalTokens = Math.max(0, input.usage.totalTokens ?? promptTokens + completionTokens)
  const estimatedCost = roundCost(Math.max(0, input.estimatedCost ?? 0))

  await db.insert(forgeAiUsage).values({
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    provider: input.provider,
    model: input.model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost: estimatedCost.toFixed(6),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  })

  if (input.projectId) {
    const budgets = await loadForgeAiUsageBudgetSnapshot(input.projectId)
    if (budgets.project.warning || budgets.monthly.warning) {
      await db.insert(forgeActivityLogs).values({
        projectId: input.projectId,
        actor: "system",
        action: "ai_budget_warning",
        message: budgets.project.blocked || budgets.monthly.blocked
          ? "Forge AI budget limit has been reached."
          : "Forge AI usage is approaching a configured budget limit.",
        metadataJson: { budgets },
      })
    }
  }
}

export async function assertForgeAiBudgetAllowsRequest({
  projectId,
  estimatedMaxCost,
  env = process.env,
}: {
  projectId?: number | null
  estimatedMaxCost: number
  env?: Partial<Record<string, string | undefined>>
}) {
  if (!projectId) return

  const snapshot = await loadForgeAiUsageBudgetSnapshot(projectId, estimatedMaxCost, env)
  if (snapshot.project.blocked) {
    throw new ForgeAiBudgetExceededError(`Forge project AI budget limit would be exceeded ($${snapshot.project.limit}).`)
  }
  if (snapshot.monthly.blocked) {
    throw new ForgeAiBudgetExceededError(`Forge monthly AI budget limit would be exceeded ($${snapshot.monthly.limit}).`)
  }
}

export async function assertForgeAiBudgetAllowsJob(projectId: number, env: Partial<Record<string, string | undefined>> = process.env) {
  const snapshot = await loadForgeAiUsageBudgetSnapshot(projectId, 0, env)
  if (snapshot.project.blocked) {
    throw new ForgeAiBudgetExceededError(`Forge project AI budget limit has been reached ($${snapshot.project.limit}).`)
  }
  if (snapshot.monthly.blocked) {
    throw new ForgeAiBudgetExceededError(`Forge monthly AI budget limit has been reached ($${snapshot.monthly.limit}).`)
  }
}

export async function loadForgeAiUsageBudgetSnapshot(
  projectId: number,
  pendingCost = 0,
  env: Partial<Record<string, string | undefined>> = process.env,
): Promise<ForgeAiUsageBudgetSnapshot> {
  const config = resolveForgeAiCostBudgetConfig(env)
  const monthStart = startOfMonth(new Date())
  const [projectTotal, monthlyTotal] = await Promise.all([
    sumUsageCost(eq(forgeAiUsage.projectId, projectId)),
    sumUsageCost(gte(forgeAiUsage.completedAt, monthStart)),
  ])

  return {
    project: buildForgeAiBudgetStatus(projectTotal, config.maxProjectAiCost, pendingCost),
    monthly: buildForgeAiBudgetStatus(monthlyTotal, config.maxMonthlyAiCost, pendingCost),
  }
}

export async function loadForgeAiDashboardMetrics(): Promise<ForgeAiDashboardMetrics> {
  const now = new Date()
  const todayStart = startOfDay(now)
  const monthStart = startOfMonth(now)
  const [todaySpend, monthSpend, mostExpensiveRows, siteRows, budget] = await Promise.all([
    sumUsageCost(gte(forgeAiUsage.completedAt, todayStart)),
    sumUsageCost(gte(forgeAiUsage.completedAt, monthStart)),
    db
      .select({
        projectId: forgeAiUsage.projectId,
        projectName: forgeProjects.name,
        businessName: forgeProjects.businessName,
        estimatedCost: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)`,
      })
      .from(forgeAiUsage)
      .leftJoin(forgeProjects, eq(forgeProjects.id, forgeAiUsage.projectId))
      .where(and(gte(forgeAiUsage.completedAt, monthStart), sql`${forgeAiUsage.projectId} is not null`))
      .groupBy(forgeAiUsage.projectId, forgeProjects.name, forgeProjects.businessName)
      .orderBy(desc(sql`sum(${forgeAiUsage.estimatedCost})`))
      .limit(1),
    db
      .select({
        projectCount: sql<string>`count(distinct ${forgeAiUsage.projectId})`,
        completedSpend: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)`,
      })
      .from(forgeAiUsage)
      .innerJoin(forgeProjects, eq(forgeProjects.id, forgeAiUsage.projectId))
      .where(and(gte(forgeAiUsage.completedAt, monthStart), eq(forgeProjects.status, "deployed"))),
    loadGlobalMonthlyBudgetSnapshot(),
  ])

  const projectCount = Number(siteRows[0]?.projectCount ?? 0)
  const completedSpend = toCost(siteRows[0]?.completedSpend)
  const mostExpensive = mostExpensiveRows[0]

  return {
    todaySpend,
    monthSpend,
    mostExpensiveProject: mostExpensive
      ? {
          projectId: mostExpensive.projectId,
          projectName: mostExpensive.projectName ?? "Unassigned",
          businessName: mostExpensive.businessName ?? null,
          estimatedCost: toCost(mostExpensive.estimatedCost),
        }
      : null,
    averageCostPerSite: projectCount > 0 ? roundCost(completedSpend / projectCount) : 0,
    budget,
  }
}

export async function loadForgeAiProjectMetrics(projectId: number): Promise<ForgeAiProjectMetrics> {
  const now = new Date()
  const [totals, today, week, month, budget, recent] = await Promise.all([
    summarizeUsage(eq(forgeAiUsage.projectId, projectId)),
    summarizeUsage(and(eq(forgeAiUsage.projectId, projectId), gte(forgeAiUsage.completedAt, startOfDay(now)))),
    summarizeUsage(and(eq(forgeAiUsage.projectId, projectId), gte(forgeAiUsage.completedAt, startOfWeek(now)))),
    summarizeUsage(and(eq(forgeAiUsage.projectId, projectId), gte(forgeAiUsage.completedAt, startOfMonth(now)))),
    loadForgeAiUsageBudgetSnapshot(projectId),
    db
      .select({
        id: forgeAiUsage.id,
        taskId: forgeAiUsage.taskId,
        provider: forgeAiUsage.provider,
        model: forgeAiUsage.model,
        promptTokens: forgeAiUsage.promptTokens,
        completionTokens: forgeAiUsage.completionTokens,
        totalTokens: forgeAiUsage.totalTokens,
        estimatedCost: forgeAiUsage.estimatedCost,
        completedAt: forgeAiUsage.completedAt,
      })
      .from(forgeAiUsage)
      .where(eq(forgeAiUsage.projectId, projectId))
      .orderBy(desc(forgeAiUsage.completedAt))
      .limit(10),
  ])

  return {
    totals,
    today,
    week,
    month,
    budget,
    recent: recent.map((row) => ({
      ...row,
      estimatedCost: toCost(row.estimatedCost),
    })),
  }
}

// Combines real AI spend (grouped by build stage) with the QA report's quality signals into the
// cost/quality decision model surfaced in the project UI. The QA artifact is passed in so we reuse
// the value already loaded for the page instead of re-querying it.
export async function loadForgeCostQualityModel(projectId: number, qa: ForgeQaArtifactState): Promise<ForgeCostQualitySummary> {
  const [stageRows, modelRows, taskRows, totalCost] = await Promise.all([
    db
      .select({
        stage: forgeTasks.agentType,
        costUsd: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)`,
        tokens: sql<string>`coalesce(sum(${forgeAiUsage.totalTokens}), 0)`,
        calls: sql<string>`count(${forgeAiUsage.id})`,
      })
      .from(forgeAiUsage)
      .innerJoin(forgeTasks, eq(forgeTasks.id, forgeAiUsage.taskId))
      .where(eq(forgeAiUsage.projectId, projectId))
      .groupBy(forgeTasks.agentType),
    db
      .selectDistinct({ provider: forgeAiUsage.provider, model: forgeAiUsage.model })
      .from(forgeAiUsage)
      .where(eq(forgeAiUsage.projectId, projectId)),
    db
      .select({ outputJson: forgeTasks.outputJson })
      .from(forgeTasks)
      .where(eq(forgeTasks.projectId, projectId)),
    sumUsageCost(eq(forgeAiUsage.projectId, projectId)),
  ])

  const stageCosts: ForgeStageCost[] = stageRows.map((row) => ({
    stage: row.stage,
    costUsd: toCost(row.costUsd),
    tokens: Number(row.tokens ?? 0),
    calls: Number(row.calls ?? 0),
  }))
  // AI usage not tied to a task (or to a deleted task) is excluded by the join; surface the remainder
  // as "other" so the per-stage breakdown still reconciles with the project's real total spend.
  const trackedStageCost = stageCosts.reduce((sum, stage) => sum + stage.costUsd, 0)
  const untrackedCost = roundCost(totalCost - trackedStageCost)
  if (untrackedCost > 0.0001) {
    stageCosts.push({ stage: "other", costUsd: untrackedCost, tokens: 0, calls: 0 })
  }

  const models: ForgeModelUsed[] = modelRows.map((row) => ({ provider: row.provider, model: row.model }))
  const retries = taskRows.reduce((sum, row) => {
    const ai = (row.outputJson as { ai?: { retries?: unknown } } | null)?.ai
    const value = Number(ai?.retries)
    return sum + (Number.isFinite(value) && value > 0 ? value : 0)
  }, 0)

  const report = qa.report
  const buildCommand = report?.commands.find((command) => command.name === "build")

  return summarizeForgeCostQuality({
    stageCosts,
    retries,
    models,
    qaStatus: report?.status ?? "not_run",
    readinessScore: report?.readiness.score ?? null,
    readinessBand: report?.readiness.band ?? null,
    clientReady: report?.readiness.clientReady ?? false,
    qaFailures: report?.commands.filter((command) => command.status === "failed").length ?? 0,
    repairPasses: report?.repairHistory.filter((attempt) => attempt.status === "applied").length ?? 0,
    buildDurationMs: buildCommand && buildCommand.status !== "skipped" ? buildCommand.durationMs : null,
  })
}

export async function exportForgeAiUsageCsv(projectId?: number | null) {
  const where = projectId ? eq(forgeAiUsage.projectId, projectId) : undefined
  const rows = await db
    .select({
      id: forgeAiUsage.id,
      projectId: forgeAiUsage.projectId,
      projectName: forgeProjects.name,
      taskId: forgeAiUsage.taskId,
      taskTitle: forgeTasks.title,
      provider: forgeAiUsage.provider,
      model: forgeAiUsage.model,
      promptTokens: forgeAiUsage.promptTokens,
      completionTokens: forgeAiUsage.completionTokens,
      totalTokens: forgeAiUsage.totalTokens,
      estimatedCost: forgeAiUsage.estimatedCost,
      startedAt: forgeAiUsage.startedAt,
      completedAt: forgeAiUsage.completedAt,
    })
    .from(forgeAiUsage)
    .leftJoin(forgeProjects, eq(forgeProjects.id, forgeAiUsage.projectId))
    .leftJoin(forgeTasks, eq(forgeTasks.id, forgeAiUsage.taskId))
    .where(where)
    .orderBy(desc(forgeAiUsage.completedAt))

  const header = [
    "id",
    "projectId",
    "projectName",
    "taskId",
    "taskTitle",
    "provider",
    "model",
    "promptTokens",
    "completionTokens",
    "totalTokens",
    "estimatedCost",
    "startedAt",
    "completedAt",
  ]

  return [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvCell(row[key as keyof typeof row])).join(",")),
  ].join("\n")
}

async function loadGlobalMonthlyBudgetSnapshot(): Promise<ForgeAiUsageBudgetSnapshot> {
  const config = resolveForgeAiCostBudgetConfig()
  const monthlyTotal = await sumUsageCost(gte(forgeAiUsage.completedAt, startOfMonth(new Date())))
  return {
    project: buildForgeAiBudgetStatus(0, config.maxProjectAiCost),
    monthly: buildForgeAiBudgetStatus(monthlyTotal, config.maxMonthlyAiCost),
  }
}

async function summarizeUsage(where: SQL | undefined): Promise<ForgeAiUsageSummary> {
  if (!where) return emptyForgeAiUsageSummary()
  const [row] = await db
    .select({
      requests: sql<string>`count(*)`,
      promptTokens: sql<string>`coalesce(sum(${forgeAiUsage.promptTokens}), 0)`,
      completionTokens: sql<string>`coalesce(sum(${forgeAiUsage.completionTokens}), 0)`,
      totalTokens: sql<string>`coalesce(sum(${forgeAiUsage.totalTokens}), 0)`,
      estimatedCost: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)`,
    })
    .from(forgeAiUsage)
    .where(where)

  return {
    requests: Number(row?.requests ?? 0),
    promptTokens: Number(row?.promptTokens ?? 0),
    completionTokens: Number(row?.completionTokens ?? 0),
    totalTokens: Number(row?.totalTokens ?? 0),
    estimatedCost: toCost(row?.estimatedCost),
  }
}

async function sumUsageCost(where: SQL | undefined) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)` })
    .from(forgeAiUsage)
    .where(where)
  return toCost(row?.total)
}

function toCost(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return roundCost(Number.isFinite(parsed) ? parsed : 0)
}

function startOfDay(now: Date) {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfWeek(now: Date) {
  const date = startOfDay(now)
  const day = date.getDay()
  const diff = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - diff)
  return date
}

function startOfMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  const text = value instanceof Date ? value.toISOString() : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
