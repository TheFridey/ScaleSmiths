import "server-only"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { planForgeWorkflow, type ForgeAdaptiveTask, type ForgePlannerFacts } from "@/lib/forge-workflow-planner"
import { forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"

export async function buildPersistedForgeWorkflowPlan(projectId: number) {
  const [projects, tasks, artifacts] = await Promise.all([
    db.select({ status: forgeProjects.status }).from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1),
    db.select({ id: forgeTasks.id, agentType: forgeTasks.agentType, resultQuality: forgeTasks.resultQuality, humanApprovalRequired: forgeTasks.humanApprovalRequired, qualityApprovedAt: forgeTasks.qualityApprovedAt, status: forgeTasks.status }).from(forgeTasks).where(eq(forgeTasks.projectId, projectId)),
    db.select({ type: forgeArtifacts.type, metadataJson: forgeArtifacts.metadataJson, approvalState: forgeArtifacts.approvalState }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), isNull(forgeArtifacts.supersededAt))),
  ])
  const project = projects[0]
  if (!project) return null
  const metadata = artifacts.map((item) => item.metadataJson ?? {})
  const strings = (keys: string[]) => metadata.flatMap((value) => keys.flatMap((key) => stringArray(value[key])))
  const previousTaskCounts: Partial<Record<ForgeAdaptiveTask, number>> = {}
  for (const task of tasks) {
    const plannerTask = readPlannerTask(task.id, metadata)
    if (plannerTask) previousTaskCounts[plannerTask] = (previousTaskCounts[plannerTask] ?? 0) + 1
  }
  const facts: ForgePlannerFacts = {
    projectState: project.status,
    contradictoryIntake: strings(["contradictions", "knownContradictions"]),
    missingClientFacts: strings(["missingFacts", "clarificationQuestions"]),
    researchWeaknesses: strings(["researchWeaknesses", "researchGaps"]),
    missingTrustEvidence: strings(["missingTrustSignals", "missingTrustEvidence"]),
    unsupportedClaims: strings(["unsupportedClaims", "highRiskClaims"]),
    copyRejectionCount: artifacts.filter((item) => item.type === "copy_doc" && item.approvalState === "rejected").length,
    visualQaFailures: strings(["visualQaFailures", "blockingVisualFindings"]),
    mobileFailures: strings(["mobileFailures", "responsiveFailures"]),
    degradedUpstreamTaskIds: tasks.filter((task) => ["degraded", "fallback"].includes(task.resultQuality) && !task.qualityApprovedAt).map((task) => task.id),
    unresolvedRequiredApprovalIds: tasks.filter((task) => task.humanApprovalRequired && !task.qualityApprovedAt && task.status === "completed").map((task) => task.id),
    previousTaskCounts,
  }
  return { facts, plan: planForgeWorkflow(facts) }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
}

function readPlannerTask(taskId: number, metadata: Record<string, unknown>[]): ForgeAdaptiveTask | null {
  for (const item of metadata) {
    if (item.plannerSourceTaskId === taskId && typeof item.plannerTask === "string") return item.plannerTask as ForgeAdaptiveTask
  }
  return null
}
