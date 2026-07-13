import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE } from "@/lib/forge-frontend-code"
import { evaluateForgeStructuralOriginality, buildForgeStructuralFingerprint, FORGE_ORIGINALITY_ARTIFACT_TITLE } from "@/lib/forge-originality"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"

export async function runForgeOriginalityEvaluator(projectId: number, actor: string) {
  const rows = await db.select({
    artifactId: forgeArtifacts.id,
    projectId: forgeArtifacts.projectId,
    version: forgeArtifacts.version,
    metadataJson: forgeArtifacts.metadataJson,
    outputHash: forgeArtifacts.outputHash,
    approvalState: forgeArtifacts.approvalState,
    supersededAt: forgeArtifacts.supersededAt,
    industry: forgeProjects.industry,
  }).from(forgeArtifacts)
    .leftJoin(forgeProjects, eq(forgeProjects.id, forgeArtifacts.projectId))
    .where(and(eq(forgeArtifacts.type, "generated_code"), eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE)))
    .orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt))

  const fingerprints = rows
    .filter((row) => !row.supersededAt)
    .flatMap((row) => {
      const fingerprint = buildForgeStructuralFingerprint({ projectId: row.projectId, artifactId: row.artifactId, artifactVersion: row.version, industry: row.industry, metadataJson: row.metadataJson })
      return fingerprint ? [fingerprint] : []
    })
  const current = fingerprints.find((fingerprint) => fingerprint.projectId === projectId)
  if (!current) throw new Error("Generate site code before running the structural originality evaluator.")

  const report = evaluateForgeStructuralOriginality(current, fingerprints)
  const registry = getForgeAgentRegistryReference("originality_evaluator")
  const now = new Date()
  const [task] = await db.insert(forgeTasks).values({
    projectId,
    title: "Evaluate structural originality",
    description: "Compare privacy-safe generated-site structure fingerprints across projects for unacceptable templating.",
    agentType: "qa",
    status: "completed",
    resultQuality: report.humanReviewRequired ? "requires_review" : "validated",
    promptIdentifier: registry.promptIdentifier,
    promptVersion: registry.promptVersion,
    schemaIdentifier: registry.schemaIdentifier,
    schemaVersion: registry.schemaVersion,
    validationResult: { valid: true, findingCount: report.findings.length, similarityScore: report.similarityScore },
    downstreamAllowed: !report.humanReviewRequired,
    humanApprovalRequired: report.humanReviewRequired,
    publicationBlocked: report.humanReviewRequired,
    outputJson: { findingCount: report.findings.length, similarityScore: report.similarityScore, privacy: report.privacy },
    startedAt: now,
    completedAt: now,
    updatedAt: now,
  }).returning()

  const currentRow = rows.find((row) => row.artifactId === current.artifactId)
  const artifact = await saveVersionedForgeArtifact({
    projectId,
    type: "originality_report",
    title: FORGE_ORIGINALITY_ARTIFACT_TITLE,
    content: JSON.stringify(report, null, 2),
    metadataJson: { kind: report.kind, report, status: "generated" },
    actor,
    action: "originality_evaluation_completed",
    message: `Structural originality evaluation completed with score ${report.similarityScore}/100 and ${report.findings.length} finding(s).`,
    provenance: {
      sourceTaskId: task.id,
      provider: "deterministic",
      model: "forge-originality-rules-v1",
      promptIdentifier: registry.promptIdentifier,
      promptVersion: registry.promptVersion,
      schemaIdentifier: registry.schemaIdentifier,
      schemaVersion: registry.schemaVersion,
      upstreamArtifacts: currentRow ? [{ id: currentRow.artifactId, outputHash: currentRow.outputHash }] : [],
      inputContext: {
        projectId,
        currentFingerprint: current,
        comparedProjectIds: fingerprints.filter((fingerprint) => fingerprint.projectId !== projectId).map((fingerprint) => fingerprint.projectId),
        privacy: report.privacy,
      },
      actor,
      validationResult: { valid: true, findingCount: report.findings.length, similarityScore: report.similarityScore },
      qualityState: report.humanReviewRequired ? "requires_review" : "validated",
      approvalState: "unapproved",
    },
  })

  return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
}
