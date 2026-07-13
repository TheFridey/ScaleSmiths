import "server-only"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { readForgeMigrationAnalysis, FORGE_MIGRATION_ANALYSIS_ARTIFACT_TITLE } from "@/lib/forge-migration-analysis"
import { approveForgeMigrationCandidate, createForgeMigrationCandidate, FORGE_MIGRATION_CANDIDATE_TITLE, readForgeMigrationCandidate, type ForgeMigrationApproval } from "@/lib/forge-migration-execution"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { readForgeSiteInventory, FORGE_SITE_INVENTORY_ARTIFACT_TITLE } from "@/lib/forge-site-inventory"
import { forgeActivityLogs, forgeArtifacts, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"

export async function runForgeMigrationExecutionAgent(projectId: number, actor: string) {
  const [analysisArtifact, inventoryArtifact, factArtifacts] = await Promise.all([
    currentApproved(projectId, "migration_analysis", FORGE_MIGRATION_ANALYSIS_ARTIFACT_TITLE),
    currentApproved(projectId, "site_inventory", FORGE_SITE_INVENTORY_ARTIFACT_TITLE),
    db.select({ id: forgeArtifacts.id, type: forgeArtifacts.type, content: forgeArtifacts.content, metadataJson: forgeArtifacts.metadataJson, outputHash: forgeArtifacts.outputHash }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.approvalState, "approved"), isNull(forgeArtifacts.supersededAt))),
  ])
  if (!analysisArtifact || !inventoryArtifact) throw new Error("Approve the current site inventory and migration analysis before creating a migration candidate.")
  const analysis = readForgeMigrationAnalysis(analysisArtifact.metadataJson?.report) ?? readForgeMigrationAnalysis(JSON.parse(analysisArtifact.content ?? "null"))
  const inventory = readForgeSiteInventory(inventoryArtifact.metadataJson?.inventory) ?? readForgeSiteInventory(JSON.parse(inventoryArtifact.content ?? "null"))
  if (!analysis || !inventory) throw new Error("Approved migration inputs are invalid or unreadable.")
  const approvedCopyRoutes = extractApprovedCopyRoutes(factArtifacts)
  const approvedFactText = factArtifacts.filter((item) => ["research_report", "copy_doc"].includes(item.type)).map((item) => item.content ?? "").join("\n")
  const sourceArtifactIds = [analysisArtifact.id, inventoryArtifact.id, ...factArtifacts.map((item) => item.id)]
  const candidate = createForgeMigrationCandidate({ analysis, inventory, sourceArtifactIds, approvedCopyRoutes, approvedFactText })
  return persistCandidate({ projectId, actor, candidate, upstream: [analysisArtifact, inventoryArtifact, ...factArtifacts], action: "migration_candidate_created", message: `Migration candidate ${candidate.candidateId} created with ${candidate.finalReport.blockers.length} blocker(s).` })
}

export async function approveForgeMigrationExecution(projectId: number, artifactId: number, actor: string, action: "redirect_export" | "deployment", reason: string) {
  if (!reason.trim()) throw new Error("An approval reason is required.")
  const [artifact] = await db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.id, artifactId), eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, "migration_candidate"))).limit(1)
  if (!artifact || artifact.supersededAt) throw new Error("The migration candidate is missing or superseded.")
  const candidate = readForgeMigrationCandidate(artifact.metadataJson?.candidate) ?? readForgeMigrationCandidate(JSON.parse(artifact.content ?? "null"))
  if (!candidate) throw new Error("The migration candidate is invalid.")
  const approval: ForgeMigrationApproval = { actor, reason: reason.trim(), at: new Date().toISOString() }
  const approved = approveForgeMigrationCandidate(candidate, action, approval)
  const history = [...(artifact.approvalHistory ?? []), { state: action === "redirect_export" ? "redirect_export_approved" : "deployment_approved", ...approval, mappingHash: approved.mappingHash }]
  await db.transaction(async (tx) => {
    await tx.update(forgeArtifacts).set({ metadataJson: { ...(artifact.metadataJson ?? {}), candidate: approved }, approvalState: action === "deployment" ? "approved" : "redirect_export_approved", approvalHistory: history, updatedAt: new Date() }).where(eq(forgeArtifacts.id, artifact.id))
    await tx.insert(forgeActivityLogs).values({ projectId, actor, action: `migration_${action}_approved`, message: `${action === "redirect_export" ? "Redirect export" : "Deployment"} approved for immutable candidate ${candidate.candidateId}.`, metadataJson: { artifactId, candidateId: candidate.candidateId, mappingHash: candidate.mappingHash, reason } })
  })
  return { ok: true as const, artifactId, candidate: approved }
}

export async function rollbackForgeMigrationCandidate(projectId: number, artifactId: number, actor: string, reason: string) {
  if (!reason.trim()) throw new Error("A rollback reason is required.")
  const [source] = await db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.id, artifactId), eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, "migration_candidate"))).limit(1)
  const prior = source && (readForgeMigrationCandidate(source.metadataJson?.candidate) ?? readForgeMigrationCandidate(JSON.parse(source.content ?? "null")))
  if (!source || !prior) throw new Error("The rollback candidate is missing or invalid.")
  const candidate = { ...prior, candidateId: `${prior.candidateId}-rollback-${Date.now()}`, createdAt: new Date().toISOString(), approvals: { redirectExport: null, deployment: null }, redirectConfiguration: { ...prior.redirectConfiguration, exportApproved: false as const }, rollbackOfCandidateId: prior.candidateId, finalReport: { ...prior.finalReport, readyForDeploymentApproval: false }, checklist: prior.checklist.map((item) => ["redirect_export_approval", "deployment_approval"].includes(item.key) ? { ...item, status: "pending" as const, evidence: "Approval reset by rollback candidate creation." } : item) }
  return persistCandidate({ projectId, actor, candidate, upstream: [source], action: "migration_candidate_rolled_back", message: `Created rollback candidate from ${prior.candidateId}: ${reason.trim()}` })
}

async function persistCandidate({ projectId, actor, candidate, upstream, action, message }: { projectId: number; actor: string; candidate: NonNullable<ReturnType<typeof readForgeMigrationCandidate>>; upstream: Array<{ id: number; outputHash: string }>; action: string; message: string }) {
  const registry = getForgeAgentRegistryReference("migration_execution")
  const now = new Date()
  const [task] = await db.insert(forgeTasks).values({ projectId, title: "Prepare controlled migration candidate", description: "Freeze mappings, validate content, links, metadata, assets, and redirects before separate human approvals.", agentType: "deploy", status: "completed", resultQuality: candidate.finalReport.blockers.length ? "requires_review" : "validated", promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion, validationResult: { valid: candidate.finalReport.blockers.length === 0, blockerCount: candidate.finalReport.blockers.length, mappingHash: candidate.mappingHash }, downstreamAllowed: false, humanApprovalRequired: true, publicationBlocked: true, outputJson: { candidateId: candidate.candidateId, blockerCount: candidate.finalReport.blockers.length, mappingHash: candidate.mappingHash }, startedAt: now, completedAt: now, updatedAt: now }).returning()
  const artifact = await saveVersionedForgeArtifact({ projectId, type: "migration_candidate", title: FORGE_MIGRATION_CANDIDATE_TITLE, content: JSON.stringify(candidate, null, 2), metadataJson: { kind: candidate.kind, candidate, immutableMappingHash: candidate.mappingHash }, actor, action, message, provenance: { sourceTaskId: task.id, provider: "deterministic", model: "forge-migration-execution-rules-v1", promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion, upstreamArtifacts: upstream, inputContext: { candidateId: candidate.candidateId, mappingHash: candidate.mappingHash, sourceArtifactIds: candidate.sourceArtifactIds, rollbackOfCandidateId: candidate.rollbackOfCandidateId }, actor, validationResult: { valid: candidate.finalReport.blockers.length === 0, checklist: candidate.checklist }, qualityState: candidate.finalReport.blockers.length ? "requires_review" : "validated", approvalState: "unapproved" } })
  return { ok: true as const, taskId: task.id, artifactId: artifact.id, candidate }
}
async function currentApproved(projectId: number, type: "site_inventory" | "migration_analysis", title: string) { return (await db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, type), eq(forgeArtifacts.title, title), eq(forgeArtifacts.approvalState, "approved"), isNull(forgeArtifacts.supersededAt))).orderBy(desc(forgeArtifacts.version)).limit(1))[0] }
function extractApprovedCopyRoutes(artifacts: Array<{ type: string; metadataJson: Record<string, unknown> | null }>) { return artifacts.filter((item) => item.type === "copy_doc").flatMap((item) => { const copy = item.metadataJson?.copy as { pages?: Array<{ path?: unknown }> } | undefined; return copy?.pages?.flatMap((page) => typeof page.path === "string" ? [page.path] : []) ?? [] }) }
