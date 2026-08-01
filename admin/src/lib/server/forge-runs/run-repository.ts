import "server-only"
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeArtifacts, forgePreviews, forgeRuns, forgeRunEvents, forgeRunSteps, forgeTasks } from "@/lib/schema"
import type { ForgeRunMode, ForgeRunPolicy, ForgeRunStatus, ForgeStageEvaluationContext } from "@/lib/forge-run-stages"
import { ForgeRunError } from "./errors"

const CURRENT_RUN_STATUSES: ForgeRunStatus[] = ["draft", "running", "paused", "failed"]

export async function getCurrentForgeRun(projectId: number) {
  const [run] = await db.select().from(forgeRuns).where(and(eq(forgeRuns.projectId, projectId), inArray(forgeRuns.status, CURRENT_RUN_STATUSES))).orderBy(desc(forgeRuns.createdAt)).limit(1)
  return run ? loadForgeRun(run.id) : null
}

export async function getActiveForgeRun(projectId: number) {
  const [run] = await db.select().from(forgeRuns).where(and(eq(forgeRuns.projectId, projectId), inArray(forgeRuns.status, ["draft", "running", "paused"]))).orderBy(desc(forgeRuns.createdAt)).limit(1)
  return run ? loadForgeRun(run.id) : null
}

export async function loadForgeRun(runId: number) {
  const [run] = await db.select().from(forgeRuns).where(eq(forgeRuns.id, runId)).limit(1)
  if (!run) return null
  const [steps, events] = await Promise.all([
    db.select().from(forgeRunSteps).where(eq(forgeRunSteps.runId, runId)).orderBy(asc(forgeRunSteps.sequence)),
    db.select().from(forgeRunEvents).where(eq(forgeRunEvents.runId, runId)).orderBy(desc(forgeRunEvents.createdAt)).limit(200),
  ])
  const remainingEstimatedCostUsd = steps.filter((step) => ["pending", "queued", "running", "blocked", "failed"].includes(step.status)).reduce((sum, step) => sum + Number(step.estimatedCostUsd), 0)
  return { ...run, estimatedCostUsd: Number(run.estimatedCostUsd), actualCostUsd: Number(run.actualCostUsd), remainingEstimatedCostUsd, steps, events }
}

export async function requireRun(runId: number) {
  const [run] = await db.select().from(forgeRuns).where(eq(forgeRuns.id, runId)).limit(1)
  if (!run) throw new ForgeRunError("Forge run not found.", 404, "run_not_found")
  return run
}

export async function requireStep(runId: number, stageKey: string) {
  const [step] = await db.select().from(forgeRunSteps).where(and(eq(forgeRunSteps.runId, runId), eq(forgeRunSteps.stage, stageKey))).limit(1)
  if (!step) throw new ForgeRunError("Forge run step not found.", 404, "step_not_found")
  return step
}

export async function loadStageContext(projectId: number, mode: ForgeRunMode, policy: ForgeRunPolicy): Promise<ForgeStageEvaluationContext & { artifactIdsByType: Map<string, number[]>; artifactHashesByType: Map<string, string[]> }> {
  const [artifacts, preview, latestQa] = await Promise.all([
    db.select({ id: forgeArtifacts.id, type: forgeArtifacts.type, outputHash: forgeArtifacts.outputHash, qualityState: forgeArtifacts.qualityState, approvalState: forgeArtifacts.approvalState }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), isNull(forgeArtifacts.supersededAt))).orderBy(desc(forgeArtifacts.version)),
    db.select({ projectId: forgePreviews.projectId }).from(forgePreviews).where(and(eq(forgePreviews.projectId, projectId), eq(forgePreviews.status, "running"))).limit(1),
    db.select({ resultQuality: forgeTasks.resultQuality, status: forgeTasks.status }).from(forgeTasks).where(and(eq(forgeTasks.projectId, projectId), inArray(forgeTasks.agentType, ["qa", "repair"]))).orderBy(desc(forgeTasks.createdAt)).limit(1),
  ])
  const valid = artifacts.filter((artifact) => artifact.qualityState === "validated" || artifact.approvalState === "approved")
  const artifactIdsByType = new Map<string, number[]>()
  const artifactHashesByType = new Map<string, string[]>()
  for (const artifact of valid) {
    artifactIdsByType.set(artifact.type, [...(artifactIdsByType.get(artifact.type) ?? []), artifact.id])
    artifactHashesByType.set(artifact.type, [...(artifactHashesByType.get(artifact.type) ?? []), artifact.outputHash])
  }
  const types = new Set(valid.map((artifact) => artifact.type))
  return { mode, policy, availableArtifacts: types, latestQaFailed: latestQa[0]?.status === "failed" || latestQa[0]?.resultQuality === "failed", latestQaPassed: latestQa[0]?.status === "completed" && latestQa[0]?.resultQuality === "validated", previewAvailable: preview.length > 0, deploymentReady: types.has("deployment_notes"), artifactIdsByType, artifactHashesByType }
}

export function validArtifactIds(context: Awaited<ReturnType<typeof loadStageContext>>, types: readonly string[]) {
  return types.flatMap((type) => context.artifactIdsByType.get(type) ?? []).filter((id, index, values) => values.indexOf(id) === index)
}
