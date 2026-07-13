import "server-only"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { evaluateForgeCopyQuality, FORGE_COPY_QUALITY_ARTIFACT_TITLE } from "@/lib/forge-copy-quality"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { forgeArtifacts, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"

export async function runForgeCopyQualityEvaluator(projectId: number, actor: string) {
  const artifacts = await db.select().from(forgeArtifacts).where(eq(forgeArtifacts.projectId, projectId)).orderBy(desc(forgeArtifacts.version))
  const inputs = artifacts.map((artifact) => ({
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    version: artifact.version,
    content: artifact.content,
    metadataJson: artifact.metadataJson ?? null,
    outputHash: artifact.outputHash,
    upstreamArtifactIds: artifact.upstreamArtifactIds,
    upstreamArtifactHashes: artifact.upstreamArtifactHashes,
    qualityState: artifact.qualityState,
    approvalState: artifact.approvalState,
    supersededAt: artifact.supersededAt,
  }))
  const report = evaluateForgeCopyQuality(inputs)
  const registry = getForgeAgentRegistryReference("copy_quality_evaluator")
  const now = new Date()
  const [task] = await db.insert(forgeTasks).values({
    projectId,
    title: "Evaluate copy specificity and anti-generic quality",
    description: "Review approved copy against approved business facts and research for specificity, evidence, conversion clarity, repetition, and unsafe claims.",
    agentType: "qa",
    status: "completed",
    resultQuality: report.humanReviewRequired ? "requires_review" : "validated",
    promptIdentifier: registry.promptIdentifier,
    promptVersion: registry.promptVersion,
    schemaIdentifier: registry.schemaIdentifier,
    schemaVersion: registry.schemaVersion,
    validationResult: { valid: true, findingCount: report.findings.length, scores: report.scores },
    downstreamAllowed: !report.humanReviewRequired,
    humanApprovalRequired: report.humanReviewRequired,
    publicationBlocked: report.findings.some((finding) => finding.severity === "critical"),
    outputJson: { findingCount: report.findings.length, scores: report.scores, humanReviewRequired: report.humanReviewRequired },
    startedAt: now,
    completedAt: now,
    updatedAt: now,
  }).returning()

  const upstream = artifacts.filter((artifact) =>
    artifact.approvalState === "approved" &&
    !artifact.supersededAt &&
    ["handover_doc", "research_report", "sitemap", "copy_doc"].includes(artifact.type)
  )
  const artifact = await saveVersionedForgeArtifact({
    projectId,
    type: "copy_quality_report",
    title: FORGE_COPY_QUALITY_ARTIFACT_TITLE,
    content: JSON.stringify(report, null, 2),
    metadataJson: { kind: report.kind, report, status: "generated" },
    actor,
    action: "copy_quality_evaluation_completed",
    message: `Copy quality evaluation completed with ${report.findings.length} finding(s).`,
    provenance: {
      sourceTaskId: task.id,
      provider: "deterministic",
      model: "forge-copy-quality-rules-v1",
      promptIdentifier: registry.promptIdentifier,
      promptVersion: registry.promptVersion,
      schemaIdentifier: registry.schemaIdentifier,
      schemaVersion: registry.schemaVersion,
      upstreamArtifacts: upstream.map(({ id, outputHash }) => ({ id, outputHash })),
      inputContext: upstream.map(({ id, type, version, outputHash }) => ({ id, type, version, outputHash })),
      actor,
      validationResult: { valid: true, findingCount: report.findings.length, scores: report.scores },
      qualityState: report.humanReviewRequired ? "requires_review" : "validated",
      approvalState: "unapproved",
    },
  })

  return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
}
