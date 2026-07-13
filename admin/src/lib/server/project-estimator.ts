import "server-only"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { estimateProjectEffort, type ProjectEstimateResult } from "@/lib/project-estimator"
import { readForgeComponentSpecArtifact } from "@/lib/forge-component-spec"
import { readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { readForgeGeneratedCodeArtifact } from "@/lib/forge-frontend-code"
import { readForgeQaArtifact } from "@/lib/forge-qa"
import { readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { readForgeVisualQaArtifact } from "@/lib/forge-visual-qa"
import { forgeActivityLogs, forgeArtifacts, forgeIntegrationConfigs, forgeProjects, forgeTasks, projectEstimateSnapshots } from "@/lib/schema"

export type ProjectEstimateSnapshotRow = typeof projectEstimateSnapshots.$inferSelect

export async function createProjectEstimateSnapshot(projectId: number) {
  const context = await loadProjectEstimateContext(projectId)
  if (!context) return null
  const estimate = estimateProjectEffort(context)

  const [snapshot] = await db
    .insert(projectEstimateSnapshots)
    .values(toInsert(projectId, estimate))
    .returning()

  await db.insert(forgeActivityLogs).values({
    projectId,
    actor: "estimator",
    action: "project_estimate_created",
    message: `Created internal project estimate: ${estimate.estimatedHours}h, ${estimate.complexityRating} complexity, GBP ${estimate.suggestedBuildPrice}.`,
    metadataJson: { snapshotId: snapshot.id, modelVersion: estimate.modelVersion },
  })

  return snapshot
}

export async function getLatestProjectEstimateSnapshot(projectId: number) {
  const [snapshot] = await db
    .select()
    .from(projectEstimateSnapshots)
    .where(eq(projectEstimateSnapshots.projectId, projectId))
    .orderBy(desc(projectEstimateSnapshots.createdAt))
    .limit(1)

  return snapshot ?? null
}

export async function applyProjectEstimateManualAdjustment(input: { projectId: number; hours: number; buildPrice: number; retainer: number; reason: string; actor: string }) {
  const latest = await getLatestProjectEstimateSnapshot(input.projectId) ?? await createProjectEstimateSnapshot(input.projectId)
  if (!latest) return null

  const [snapshot] = await db
    .update(projectEstimateSnapshots)
    .set({
      manualHours: input.hours,
      manualBuildPrice: input.buildPrice,
      manualRetainer: input.retainer,
      manualReason: input.reason,
      manualBy: input.actor,
      manualAt: new Date(),
    })
    .where(eq(projectEstimateSnapshots.id, latest.id))
    .returning()

  return snapshot
}

export async function recordProjectEstimateActuals(input: { projectId: number; actualHours: number; actualBuildPrice: number; actualRetainer: number; notes: string | null }) {
  const latest = await getLatestProjectEstimateSnapshot(input.projectId) ?? await createProjectEstimateSnapshot(input.projectId)
  if (!latest) return null

  const [snapshot] = await db
    .update(projectEstimateSnapshots)
    .set({
      actualHours: input.actualHours,
      actualBuildPrice: input.actualBuildPrice,
      actualRetainer: input.actualRetainer,
      actualNotes: input.notes,
      actualRecordedAt: new Date(),
    })
    .where(eq(projectEstimateSnapshots.id, latest.id))
    .returning()

  return snapshot
}

async function loadProjectEstimateContext(projectId: number) {
  const database = db
  const [project] = await database.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) return null

  const [artifacts, integrations, tasks] = await Promise.all([
    database.select().from(forgeArtifacts).where(eq(forgeArtifacts.projectId, projectId)).orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt)),
    database.select({ provider: forgeIntegrationConfigs.provider, enabled: forgeIntegrationConfigs.enabled }).from(forgeIntegrationConfigs).where(eq(forgeIntegrationConfigs.projectId, projectId)),
    database.select({ resultQuality: forgeTasks.resultQuality }).from(forgeTasks).where(eq(forgeTasks.projectId, projectId)),
  ])

  const latest = (type: string) => artifacts.find((artifact) => artifact.type === type && !artifact.supersededAt)
  const degradedOrFallbackCount = [
    ...tasks.filter((task) => task.resultQuality === "degraded" || task.resultQuality === "fallback"),
    ...artifacts.filter((artifact) => artifact.qualityState === "degraded" || artifact.qualityState === "fallback"),
  ].length

  return {
    project,
    sitemap: readForgeSitemapStrategyArtifact(latest("sitemap")?.metadataJson),
    copy: readForgeCopyDocumentArtifact(latest("copy_doc")?.metadataJson),
    componentSpec: readForgeComponentSpecArtifact(latest("component_spec")?.metadataJson),
    generatedCode: readForgeGeneratedCodeArtifact(latest("generated_code")?.metadataJson),
    qa: readForgeQaArtifact(latest("qa_report")?.metadataJson),
    visualQa: readForgeVisualQaArtifact(latest("visual_qa")?.metadataJson),
    integrations,
    approvedArtifactCount: artifacts.filter((artifact) => artifact.approvalState === "approved" && !artifact.supersededAt).length,
    degradedOrFallbackCount,
    taskCount: tasks.length,
  }
}

function toInsert(projectId: number, estimate: ProjectEstimateResult): typeof projectEstimateSnapshots.$inferInsert {
  return {
    projectId,
    estimatedHours: estimate.estimatedHours,
    confidence: estimate.confidence,
    confidenceRange: estimate.confidenceRange,
    complexityRating: estimate.complexityRating,
    riskFactors: estimate.riskFactors,
    suggestedBuildPrice: estimate.suggestedBuildPrice,
    suggestedRetainer: estimate.suggestedRetainer,
    minimumViableScope: estimate.minimumViableScope,
    optionalEnhancements: estimate.optionalEnhancements,
    estimatedDeliveryRange: estimate.estimatedDeliveryRange,
    marginEstimate: estimate.marginEstimate,
    knownInputs: estimate.knownInputs,
    assumptions: estimate.assumptions,
    underpricingRisks: estimate.underpricingRisks,
    disclaimer: estimate.disclaimer,
    modelVersion: estimate.modelVersion,
  }
}
