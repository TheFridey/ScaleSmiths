import "server-only"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildCanonicalApprovedProjectState, FORGE_REVIEW_COUNCIL_ARTIFACT_TITLE, runDeterministicForgeCouncil } from "@/lib/forge-review-council"
import { evaluateForgeArtifactConsistency } from "@/lib/forge-consistency"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { forgeArtifacts, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"

export async function runForgeReviewCouncil(projectId: number, actor: string) {
  const artifacts = await db.select().from(forgeArtifacts).where(eq(forgeArtifacts.projectId, projectId)).orderBy(desc(forgeArtifacts.version))
  const inputs = artifacts.map((artifact) => ({ id: artifact.id, type: artifact.type, title: artifact.title, version: artifact.version, content: artifact.content, metadataJson: artifact.metadataJson ?? null, outputHash: artifact.outputHash, upstreamArtifactIds: artifact.upstreamArtifactIds, upstreamArtifactHashes: artifact.upstreamArtifactHashes, qualityState: artifact.qualityState, approvalState: artifact.approvalState, supersededAt: artifact.supersededAt }))
  const canonical = buildCanonicalApprovedProjectState(inputs)
  if (!canonical.artifacts.length) throw new Error("The Forge review council requires at least one approved artifact.")
  const consistency = evaluateForgeArtifactConsistency(inputs)
  const report = runDeterministicForgeCouncil(canonical, consistency.findings)
  const reviewerRegistry = getForgeAgentRegistryReference("review_council")
  const synthesisRegistry = getForgeAgentRegistryReference("review_council_synthesis")
  const now = new Date()
  const findingCount = report.reviews.reduce((sum, review) => sum + review.findings.length, 0)
  const [task] = await db.insert(forgeTasks).values({ projectId, title: "Run multi-perspective review council", description: "Nine remit-bound reviewers assess the same canonical approved project snapshot, followed by a dissent-preserving synthesis.", agentType: "qa", status: "completed", resultQuality: report.synthesis.humanDecisions.length ? "requires_review" : "validated", promptIdentifier: reviewerRegistry.promptIdentifier, promptVersion: reviewerRegistry.promptVersion, schemaIdentifier: reviewerRegistry.schemaIdentifier, schemaVersion: reviewerRegistry.schemaVersion, validationResult: { valid: true, reviewerCount: report.reviews.length, findingCount }, downstreamAllowed: true, humanApprovalRequired: report.synthesis.humanDecisions.length > 0, publicationBlocked: false, outputJson: { findingCount, actionCount: report.synthesis.actionPlan.length, conflictCount: report.synthesis.conflicts.length, reviewerModelVersions: report.reviews.map((review) => ({ perspective: review.perspective, version: review.reviewerModelVersion })), synthesisModelVersion: report.synthesis.synthesisModelVersion, synthesisRegistry }, startedAt: now, completedAt: now, updatedAt: now }).returning()
  const upstream = artifacts.filter((artifact) => artifact.approvalState === "approved" && !artifact.supersededAt && !["consistency_report", "council_review"].includes(artifact.type))
  const artifact = await saveVersionedForgeArtifact({ projectId, type: "council_review", title: FORGE_REVIEW_COUNCIL_ARTIFACT_TITLE, content: JSON.stringify(report, null, 2), metadataJson: { kind: report.kind, report, reviewerRegistry, synthesisRegistry }, actor, action: "review_council_completed", message: `Review council completed with ${findingCount} finding(s), ${report.synthesis.conflicts.length} conflict(s), and ${report.synthesis.actionPlan.length} action(s).`, provenance: { sourceTaskId: task.id, provider: "deterministic", model: report.synthesis.synthesisModelVersion, promptIdentifier: reviewerRegistry.promptIdentifier, promptVersion: reviewerRegistry.promptVersion, schemaIdentifier: reviewerRegistry.schemaIdentifier, schemaVersion: reviewerRegistry.schemaVersion, upstreamArtifacts: upstream.map(({ id, outputHash }) => ({ id, outputHash })), inputContext: { canonicalSnapshotHash: canonical.snapshotHash, synthesisRegistry }, actor, validationResult: { valid: true, reviewerCount: report.reviews.length, findingCount }, qualityState: report.synthesis.humanDecisions.length ? "requires_review" : "validated", approvalState: "unapproved" } })
  return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
}
