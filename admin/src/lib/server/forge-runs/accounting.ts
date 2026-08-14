import "server-only"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeAiUsage, forgeRuns, forgeRunSteps } from "@/lib/schema"

export async function updateRunActualCost(runId: number) {
  const [cost] = await db
    .select({ total: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)` })
    .from(forgeAiUsage)
    .where(eq(forgeAiUsage.runId, runId))
  await db
    .update(forgeRuns)
    .set({ actualCostUsd: Number(cost?.total ?? 0).toFixed(6), updatedAt: new Date() })
    .where(eq(forgeRuns.id, runId))
}

export async function updateRunStepActualCost(stepId: number, jobId: number) {
  const [cost] = await db
    .select({ total: sql<string>`coalesce(sum(${forgeAiUsage.estimatedCost}), 0)` })
    .from(forgeAiUsage)
    .where(eq(forgeAiUsage.jobId, jobId))
  await db
    .update(forgeRunSteps)
    .set({ actualCostUsd: Number(cost?.total ?? 0).toFixed(6), updatedAt: new Date() })
    .where(eq(forgeRunSteps.id, stepId))
}
