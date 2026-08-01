import "server-only"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeAiUsage, forgeJobs, forgeRuns, forgeRunSteps } from "@/lib/schema"

export async function updateRunActualCost(runId: number, projectId: number) {
  const [run] = await db.select({ startedAt: forgeRuns.startedAt, createdAt: forgeRuns.createdAt }).from(forgeRuns).where(eq(forgeRuns.id, runId)).limit(1)
  if (!run) return
  const [cost] = await db.select({ total: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)` }).from(forgeAiUsage).where(and(eq(forgeAiUsage.projectId, projectId), sql`${forgeAiUsage.completedAt} >= ${run.startedAt ?? run.createdAt}`))
  await db.update(forgeRuns).set({ actualCostUsd: Number(cost?.total ?? 0).toFixed(6), updatedAt: new Date() }).where(eq(forgeRuns.id, runId))
}

export async function updateRunStepActualCost(stepId: number, job: typeof forgeJobs.$inferSelect) {
  if (!job.startedAt) return
  const end = job.completedAt ?? new Date()
  const [cost] = await db.select({ total: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)` }).from(forgeAiUsage).where(and(
    eq(forgeAiUsage.projectId, job.projectId),
    sql`${forgeAiUsage.startedAt} >= ${job.startedAt}`,
    sql`${forgeAiUsage.completedAt} <= ${end}`,
  ))
  await db.update(forgeRunSteps).set({ actualCostUsd: Number(cost?.total ?? 0).toFixed(6), updatedAt: new Date() }).where(eq(forgeRunSteps.id, stepId))
}
