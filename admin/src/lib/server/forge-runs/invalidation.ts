import "server-only"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeArtifacts, forgeRunSteps } from "@/lib/schema"
import { getForgeRunStage, type ForgeRunStage } from "@/lib/forge-run-stages"
import { recordRunEvent } from "./events"
import { loadStageContext } from "./run-repository"
import { computeInputHash } from "./stage-outcomes"

export async function invalidateDownstreamForChangedInput(runId: number, projectId: number, stageKey: ForgeRunStage, actor: string) {
  const definition = getForgeRunStage(stageKey)
  if (!definition?.invalidatedDownstreamStages.length) return
  const context = await loadStageContext(projectId, "standard", {})
  const steps = await db.select().from(forgeRunSteps).where(and(eq(forgeRunSteps.runId, runId), inArray(forgeRunSteps.stage, definition.invalidatedDownstreamStages)))
  const invalid = steps.filter((step) => {
    const stage = getForgeRunStage(step.stage)
    return stage && step.inputHash && step.inputHash !== computeInputHash(context, stage.requiredInputs) && ["completed", "awaiting_approval"].includes(step.status)
  })
  if (!invalid.length) return
  const invalidStages = invalid.map((step) => step.stage)
  const artifactIds = invalid.flatMap((step) => step.outputArtifactIds)
  const artifactTypes = invalidStages.flatMap((stage) => getForgeRunStage(stage)?.producedArtifacts ?? [])
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(forgeRunSteps).set({ status: "pending", jobId: null, taskId: null, outputArtifactIds: [], approvedBy: null, approvedAt: null, completedAt: null, failureCategory: "upstream_changed", failureMessage: "Upstream artifact changed; previous output is stale.", updatedAt: now }).where(inArray(forgeRunSteps.id, invalid.map((step) => step.id)))
    if (artifactIds.length) await tx.update(forgeArtifacts).set({ supersededAt: now, updatedAt: now }).where(and(eq(forgeArtifacts.projectId, projectId), inArray(forgeArtifacts.id, artifactIds), isNull(forgeArtifacts.supersededAt)))
  })
  await recordRunEvent(runId, null, "downstream_invalidated", actor, "Marked downstream run output stale after an upstream change.", { stages: invalidStages, artifactTypes })
}
