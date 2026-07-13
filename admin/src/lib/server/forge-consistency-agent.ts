import "server-only"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { evaluateForgeArtifactConsistency, FORGE_CONSISTENCY_ARTIFACT_TITLE } from "@/lib/forge-consistency"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { forgeArtifacts, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"

export async function runForgeConsistencyEvaluator(projectId: number, actor: string) {
  const artifacts = await db.select().from(forgeArtifacts).where(eq(forgeArtifacts.projectId, projectId)).orderBy(desc(forgeArtifacts.version))
  const report = evaluateForgeArtifactConsistency(artifacts.map((artifact) => ({
    id: artifact.id, type: artifact.type, title: artifact.title, version: artifact.version,
    content: artifact.content, metadataJson: artifact.metadataJson ?? null, outputHash: artifact.outputHash,
    upstreamArtifactIds: artifact.upstreamArtifactIds, upstreamArtifactHashes: artifact.upstreamArtifactHashes,
    qualityState: artifact.qualityState, approvalState: artifact.approvalState, supersededAt: artifact.supersededAt,
  })))
  const registry = getForgeAgentRegistryReference("consistency_evaluator")
  const now = new Date()
  const [task] = await db.insert(forgeTasks).values({
    projectId, title: "Evaluate cross-artifact consistency", description: "Review the complete approved project state for contradictions, omissions, unsafe lineage, and quality dependencies.",
    agentType: "qa", status: "completed", resultQuality: report.blocking ? "requires_review" : "validated",
    promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion,
    validationResult: { valid: true, findingCount: report.findings.length }, downstreamAllowed: !report.blocking, humanApprovalRequired: report.blocking, publicationBlocked: report.blocking,
    outputJson: { findingCount: report.findings.length, blocking: report.blocking }, startedAt: now, completedAt: now, updatedAt: now,
  }).returning()
  const upstream = artifacts.filter((artifact) => artifact.approvalState === "approved" && !artifact.supersededAt && artifact.type !== "consistency_report")
  const artifact = await saveVersionedForgeArtifact({
    projectId, type: "consistency_report", title: FORGE_CONSISTENCY_ARTIFACT_TITLE, content: JSON.stringify(report, null, 2),
    metadataJson: { kind: report.kind, report, status: "generated" }, actor, action: "consistency_evaluation_completed",
    message: `Cross-artifact consistency evaluation completed with ${report.findings.length} finding(s).`,
    provenance: {
      sourceTaskId: task.id, provider: "deterministic", model: "forge-consistency-rules-v1", promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion,
      upstreamArtifacts: upstream.map(({ id, outputHash }) => ({ id, outputHash })), inputContext: upstream.map(({ id, version, outputHash }) => ({ id, version, outputHash })), actor,
      validationResult: { valid: true, findingCount: report.findings.length }, qualityState: report.blocking ? "requires_review" : "validated", approvalState: "unapproved",
    },
  })
  return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
}
