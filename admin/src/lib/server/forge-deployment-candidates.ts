import "server-only"
import { createHash } from "node:crypto"
import { and, desc, eq, isNull, max } from "drizzle-orm"
import { db } from "@/lib/db"
import { compareDeploymentCandidates, degradedCandidateDependencies, verifyCandidateSnapshot, type CandidateArtifact } from "@/lib/forge-deployment-candidates"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeDeploymentCandidates, forgeMemories, forgeProjects } from "@/lib/schema"
import { forgeReleaseGateDecisions } from "@/lib/schema"
import { evaluateReleaseGates, releaseGateDecisionAllowed, type ReleaseGateDecision, type ReleaseGateKey } from "@/lib/forge-release-gates"
import { verifyForgeDependencyEvidence, type ForgeDependencyAdmissionReport } from "@/lib/forge-dependency-admission"
import { assertForgeWorkspaceExecutionSafe, listForgeWorkspaceFiles, readForgeWorkspaceFile } from "./forge-workspace"
import { collectForgeDependencyEvidence } from "./forge-dependency-admission"
import { isCurrentHumanApprovedArtifact } from "@/lib/forge-approval-semantics"

export class ForgeDeploymentCandidateError extends Error {
  constructor(public safeMessage: string, public status = 400) { super(safeMessage); this.name = "ForgeDeploymentCandidateError" }
}

const excludedSegments = new Set(["node_modules", ".next", ".git", "coverage"])

export async function hashForgeWorkspace(workspace: NonNullable<ReturnType<typeof readForgeWorkspaceMemory>>) {
  await assertForgeWorkspaceExecutionSafe(workspace)
  const files = (await listForgeWorkspaceFiles(workspace)).filter((file) => !file.split(/[\\/]/).some((segment) => excludedSegments.has(segment)))
  const digest = createHash("sha256")
  for (const file of files) {
    digest.update(file.replaceAll("\\", "/")); digest.update("\0")
    digest.update(await readForgeWorkspaceFile(workspace, file)); digest.update("\0")
  }
  return { hash: digest.digest("hex"), files }
}

export async function listDeploymentCandidates(projectId: number) {
  const rows = await db.select().from(forgeDeploymentCandidates).where(eq(forgeDeploymentCandidates.projectId, projectId)).orderBy(desc(forgeDeploymentCandidates.candidateNumber))
  return rows.map((candidate, index) => {
    const previous = rows[index + 1]
    const { dependencySbomJson, dependencyReportJson, ...safeCandidate } = candidate
    const dependencyReportSummary = dependencyReportJson ? summarizeDependencyReport(dependencyReportJson) : null
    return { ...safeCandidate, dependencyReportJson: dependencyReportSummary, dependencySbomAvailable: Boolean(dependencySbomJson), comparisonFromPrevious: previous ? compareDeploymentCandidates(previous as typeof previous & { approvedArtifactsJson: CandidateArtifact[] }, candidate as typeof candidate & { approvedArtifactsJson: CandidateArtifact[] }) : null }
  })
}

export async function listDeploymentActivity(projectId: number) {
  const rows = await db.select({ actor: forgeActivityLogs.actor, action: forgeActivityLogs.action, message: forgeActivityLogs.message, metadataJson: forgeActivityLogs.metadataJson, createdAt: forgeActivityLogs.createdAt }).from(forgeActivityLogs).where(eq(forgeActivityLogs.projectId, projectId)).orderBy(desc(forgeActivityLogs.createdAt)).limit(50)
  return rows.filter((row) => ["release_attempt_failed", "deploy_marked_ready", "deploy_marked_deployed", "deployment_status_changed"].includes(row.action)).slice(0, 10)
}

function summarizeDependencyReport(report: ForgeDependencyAdmissionReport) { const { dependencies, ...summary } = report; void dependencies; return summary }

export async function createDeploymentCandidate(input: { projectId: number; actor: string; releaseNotes: string; rollbackPlan: string; environmentRequirements?: string[]; migrationRequirements?: string[]; parentCandidateId?: number }) {
  if (!input.releaseNotes.trim() || !input.rollbackPlan.trim()) throw new ForgeDeploymentCandidateError("Release notes and a rollback plan are required.")
  const snapshot = await loadCurrentSnapshot(input.projectId)
  if (!snapshot.workspace) throw new ForgeDeploymentCandidateError("Generate a tracked Forge workspace before creating a deployment candidate.")
  const trackedWorkspace = snapshot.workspace
  const workspace = await hashForgeWorkspace(trackedWorkspace)
  if (!workspace.files.length) throw new ForgeDeploymentCandidateError("The tracked Forge workspace is empty.")
  const artifacts = snapshot.artifacts.filter(isCurrentHumanApprovedArtifact)
  if (!artifacts.length) throw new ForgeDeploymentCandidateError("Approve the required Forge artifacts before creating a deployment candidate.")
  const dependencyEvidence = await collectForgeDependencyEvidence(trackedWorkspace, workspace.hash)
  const [numberResult] = await db.select({ value: max(forgeDeploymentCandidates.candidateNumber) }).from(forgeDeploymentCandidates).where(eq(forgeDeploymentCandidates.projectId, input.projectId))
  const candidateNumber = (numberResult?.value ?? 0) + 1
  const evidence = { ...categorizeEvidence(snapshot.allArtifacts), dependencyAdmission: { reportHash: dependencyEvidence.reportHash, sbomHash: dependencyEvidence.sbomHash, packageJsonHash: dependencyEvidence.packageJsonHash, lockfileHash: dependencyEvidence.lockfileHash, workspaceHash: workspace.hash, policyVersion: dependencyEvidence.report.policyVersion, evidenceTimestamp: dependencyEvidence.report.evidenceTimestamp } }
  const now = new Date()
  const [candidate] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeDeploymentCandidates).values({
      projectId: input.projectId, candidateNumber, parentCandidateId: input.parentCandidateId ?? null, workspaceVersion: trackedWorkspace.updatedAt,
      workspacePath: trackedWorkspace.relativePath, workspaceHash: workspace.hash, repositoryCommit: process.env.GIT_COMMIT_SHA ?? process.env.ERROR_MONITORING_RELEASE ?? null,
      approvedArtifactsJson: artifacts, evidenceJson: evidence, fallbackDependenciesJson: degradedCandidateDependencies(artifacts),
      dependencyReportJson: dependencyEvidence.report, dependencyReportHash: dependencyEvidence.reportHash,
      dependencySbomJson: dependencyEvidence.sbom, dependencySbomHash: dependencyEvidence.sbomHash,
      dependencyPackageJsonHash: dependencyEvidence.packageJsonHash, dependencyLockfileHash: dependencyEvidence.lockfileHash,
      dependencyPolicyVersion: dependencyEvidence.report.policyVersion, dependencyEvidenceCreatedAt: new Date(dependencyEvidence.report.evidenceTimestamp),
      environmentRequirementsJson: cleanList(input.environmentRequirements), migrationRequirementsJson: cleanList(input.migrationRequirements),
      releaseNotes: input.releaseNotes.trim(), rollbackPlan: input.rollbackPlan.trim(), createdBy: input.actor, updatedAt: now,
    }).returning()
    await tx.insert(forgeActivityLogs).values({ projectId: input.projectId, actor: input.actor, action: "deployment_candidate_created", message: `Created deployment candidate #${candidateNumber}.`, metadataJson: { candidateId: created.id, candidateNumber, workspaceHash: workspace.hash, dependencyReportHash: dependencyEvidence.reportHash, dependencySbomHash: dependencyEvidence.sbomHash, dependencyPolicyVersion: dependencyEvidence.report.policyVersion, dependencyStatus: dependencyEvidence.report.status, approvedArtifactIds: artifacts.map((item) => item.id), automaticDeployment: false } })
    return [created]
  })
  return candidate
}

export async function submitDeploymentCandidate(projectId: number, candidateId: number, actor: string) {
  const candidate = await loadCandidate(projectId, candidateId)
  if (candidate.state !== "draft") throw new ForgeDeploymentCandidateError("Only draft candidates can be submitted.")
  const verification = await verifyPersistedCandidate(candidate)
  if (!verification.valid) throw new ForgeDeploymentCandidateError(`Candidate verification failed: ${verification.errors.join(" ")}`)
  const now = new Date()
  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(forgeDeploymentCandidates).set({ state: "submitted", submittedBy: actor, submittedAt: now, updatedAt: now }).where(and(eq(forgeDeploymentCandidates.id, candidateId), eq(forgeDeploymentCandidates.state, "draft"))).returning()
    await tx.insert(forgeActivityLogs).values({ projectId, actor, action: "deployment_candidate_submitted", message: `Submitted deployment candidate #${candidate.candidateNumber} for approval.`, metadataJson: { candidateId, verification, immutable: true, automaticDeployment: false } })
    return [row]
  })
  return updated
}

export async function decideDeploymentCandidate(projectId: number, candidateId: number, actor: string, decision: "approve" | "reject", reason: string) {
  if (!reason.trim()) throw new ForgeDeploymentCandidateError("An approval or rejection reason is required.")
  const candidate = await loadCandidate(projectId, candidateId)
  if (candidate.state !== "submitted") throw new ForgeDeploymentCandidateError("Only submitted candidates can be approved or rejected.")
  if (decision === "approve") {
    const verification = await verifyPersistedCandidate(candidate)
    if (!verification.valid) throw new ForgeDeploymentCandidateError(`Candidate verification failed: ${verification.errors.join(" ")}`)
  }
  const now = new Date(); const state = decision === "approve" ? "approved" : "rejected"
  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(forgeDeploymentCandidates).set(decision === "approve" ? { state, approvedBy: actor, approvedAt: now, approvalReason: reason.trim(), updatedAt: now } : { state, rejectedBy: actor, rejectedAt: now, rejectionReason: reason.trim(), updatedAt: now }).where(and(eq(forgeDeploymentCandidates.id, candidateId), eq(forgeDeploymentCandidates.state, "submitted"))).returning()
    await tx.insert(forgeActivityLogs).values({ projectId, actor, action: `deployment_candidate_${state}`, message: `${decision === "approve" ? "Approved" : "Rejected"} deployment candidate #${candidate.candidateNumber}.`, metadataJson: { candidateId, reason: reason.trim(), automaticDeployment: false } })
    return [row]
  })
  return updated
}

export async function requireVerifiedApprovedDeploymentCandidate(projectId: number) {
  const [candidate] = await db.select().from(forgeDeploymentCandidates).where(and(eq(forgeDeploymentCandidates.projectId, projectId), eq(forgeDeploymentCandidates.state, "approved"))).orderBy(desc(forgeDeploymentCandidates.candidateNumber)).limit(1)
  if (!candidate) throw new ForgeDeploymentCandidateError("An approved immutable deployment candidate is required before deployment.")
  const verification = await verifyPersistedCandidate(candidate)
  if (!verification.valid) throw new ForgeDeploymentCandidateError(`The approved deployment candidate no longer matches the workspace or artifacts: ${verification.errors.join(" ")}`)
  const gates = await evaluateCandidateReleaseGates(candidate, verification)
  if (!gates.allowed) throw new ForgeDeploymentCandidateError(gates.summary)
  return candidate
}

export async function getCandidateReleaseGates(projectId: number, candidateId: number) {
  const candidate = await loadCandidate(projectId, candidateId)
  return evaluateCandidateReleaseGates(candidate, await verifyPersistedCandidate(candidate))
}

export async function recordReleaseGateDecision(input: { projectId: number; candidateId: number; gateKey: ReleaseGateKey; decision: "approved" | "override" | "revoked"; actor: string; actorRole: string; reason: string }) {
  if (!input.reason.trim()) throw new ForgeDeploymentCandidateError("A release-gate decision reason is required.")
  const candidate = await loadCandidate(input.projectId, input.candidateId)
  if (candidate.state !== "submitted" && candidate.state !== "approved") throw new ForgeDeploymentCandidateError("Release-gate decisions require a submitted or approved candidate.")
  if (input.decision === "override") {
    if (!releaseGateDecisionAllowed(input.gateKey, input.decision, input.actorRole)) throw new ForgeDeploymentCandidateError("Only an owner can override an explicitly permitted release gate.", 403)
  } else if (!releaseGateDecisionAllowed(input.gateKey, input.decision, input.actorRole)) {
    throw new ForgeDeploymentCandidateError("This gate is evaluated from immutable candidate evidence and cannot be manually approved.", 403)
  }
  const now = new Date()
  const [decision] = await db.transaction(async (tx) => {
    const [saved] = await tx.insert(forgeReleaseGateDecisions).values({ projectId: input.projectId, candidateId: input.candidateId, candidateWorkspaceHash: candidate.workspaceHash, gateKey: input.gateKey, decision: input.decision, actorId: input.actor, actorRole: input.actorRole, reason: input.reason.trim(), decidedAt: now }).onConflictDoUpdate({ target: [forgeReleaseGateDecisions.candidateId, forgeReleaseGateDecisions.gateKey], set: { candidateWorkspaceHash: candidate.workspaceHash, decision: input.decision, actorId: input.actor, actorRole: input.actorRole, reason: input.reason.trim(), decidedAt: now } }).returning()
    await tx.insert(forgeActivityLogs).values({ projectId: input.projectId, actor: input.actor, action: `release_gate_${input.decision}`, message: `${input.decision === "override" ? "Overrode" : input.decision === "revoked" ? "Revoked" : "Approved"} release gate ${input.gateKey} for candidate #${candidate.candidateNumber}.`, metadataJson: { candidateId: candidate.id, candidateWorkspaceHash: candidate.workspaceHash, gateKey: input.gateKey, decision: input.decision, actorRole: input.actorRole, reason: input.reason.trim(), automaticDeployment: false } })
    return [saved]
  })
  return decision
}

export async function verifyPersistedCandidate(candidate: typeof forgeDeploymentCandidates.$inferSelect) {
  const snapshot = await loadCurrentSnapshot(candidate.projectId)
  if (!snapshot.workspace || snapshot.workspace.relativePath !== candidate.workspacePath) return failedCandidateVerification("Tracked workspace path does not match the candidate.")
  const workspace = await hashForgeWorkspace(snapshot.workspace)
  const snapshotVerification = verifyCandidateSnapshot({ workspaceHash: candidate.workspaceHash, approvedArtifactsJson: candidate.approvedArtifactsJson as CandidateArtifact[] }, { workspaceHash: workspace.hash, artifacts: snapshot.artifacts })
  let dependencyVerification: ReturnType<typeof verifyForgeDependencyEvidence>
  try {
    const [packageJson, packageLock] = await Promise.all([readForgeWorkspaceFile(snapshot.workspace, "package.json"), readForgeWorkspaceFile(snapshot.workspace, "package-lock.json")])
    dependencyVerification = verifyForgeDependencyEvidence({ report: candidate.dependencyReportJson, reportHash: candidate.dependencyReportHash, sbom: candidate.dependencySbomJson, sbomHash: candidate.dependencySbomHash, packageJson, packageLock, workspaceHash: candidate.workspaceHash, storedPackageJsonHash: candidate.dependencyPackageJsonHash, storedLockfileHash: candidate.dependencyLockfileHash, storedPolicyVersion: candidate.dependencyPolicyVersion, storedEvidenceTimestamp: candidate.dependencyEvidenceCreatedAt?.toISOString() ?? null })
  } catch {
    dependencyVerification = { valid: false, errors: ["Generated dependency manifest or lockfile evidence is missing."], report: {} as ForgeDependencyAdmissionReport }
  }
  const errors = [...snapshotVerification.errors, ...dependencyVerification.errors]
  return { valid: errors.length === 0, errors, snapshotValid: snapshotVerification.valid, snapshotErrors: snapshotVerification.errors, dependency: dependencyVerification }
}

async function evaluateCandidateReleaseGates(candidate: typeof forgeDeploymentCandidates.$inferSelect, verification: Awaited<ReturnType<typeof verifyPersistedCandidate>>) {
  const decisions = await db.select().from(forgeReleaseGateDecisions).where(eq(forgeReleaseGateDecisions.candidateId, candidate.id))
  const validDecisions: ReleaseGateDecision[] = decisions.filter((item) => item.candidateWorkspaceHash === candidate.workspaceHash).map((item) => ({ gateKey: item.gateKey, decision: item.decision, actorId: item.actorId, actorRole: item.actorRole, reason: item.reason, decidedAt: item.decidedAt.toISOString(), candidateWorkspaceHash: item.candidateWorkspaceHash }))
  const evidence = candidate.evidenceJson as Record<string, unknown>
  const qa = artifactMetadataList(evidence.qaResults)[0]
  const qaReport = objectValue(objectValue(qa?.metadata).report)
  const qaCommands = Array.isArray(qaReport?.commands) ? qaReport.commands.flatMap((item) => { const row = objectValue(item); return typeof row?.name === "string" && typeof row.status === "string" ? [{ name: row.name, status: row.status }] : [] }) : []
  const accessibility = artifactMetadataList(evidence.accessibilityScan)[0]
  const accessibilityReport = objectValue(objectValue(accessibility?.metadata).report)
  const visual = artifactMetadataList(evidence.performanceResults)[0]
  const visualReport = objectValue(objectValue(visual?.metadata).report)
  const security = artifactMetadataList(evidence.securityScan)[0]
  const securityMetadata = objectValue(security?.metadata)
  const securityFindings = Array.isArray(securityMetadata.securityFindings) ? securityMetadata.securityFindings : []
  return evaluateReleaseGates({
    integrityValid: verification.snapshotValid, integrityErrors: verification.snapshotErrors, qaCommands,
    accessibilityPassed: accessibilityReport?.status === "passed" && accessibilityReport.blocking !== true, accessibilityReason: accessibilityReport ? `Accessibility status is ${String(accessibilityReport.status)} with ${String(accessibilityReport.criticalCount ?? 0)} critical finding(s).` : "Accessibility evidence is missing.",
    securityPassed: securityFindings.length === 0 && securityMetadata.securityStatus === "passed", securityReason: securityMetadata.securityStatus ? `Security scan status is ${String(securityMetadata.securityStatus)} with ${securityFindings.length} finding(s).` : "Security scan evidence is missing.",
    approvedArtifactTypes: (candidate.approvedArtifactsJson as CandidateArtifact[]).map((item) => item.type), fallbackDependencies: candidate.fallbackDependenciesJson.length,
    visualQaPassed: visualReport?.status === "passed", visualQaReason: visualReport ? `Visual QA status is ${String(visualReport.status)}.` : "Visual QA evidence is missing.",
    dependencyPolicyPassed: verification.dependency.valid, dependencyPolicyReason: verification.dependency.valid ? `Dependency admission passed under policy ${verification.dependency.report.policyVersion}; report and SPDX SBOM hashes match this candidate.` : verification.dependency.errors.join(" "),
    migrationRequired: candidate.migrationRequirementsJson.length > 0, candidateApproved: candidate.state === "approved",
  }, validDecisions)
}

function failedCandidateVerification(error: string) { return { valid: false, errors: [error], snapshotValid: false, snapshotErrors: [error], dependency: { valid: false, errors: ["Dependency evidence cannot be verified without the tracked workspace."], report: {} as ForgeDependencyAdmissionReport } } }

function artifactMetadataList(value: unknown) { return Array.isArray(value) ? value.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item)) : [] }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} }

async function loadCurrentSnapshot(projectId: number) {
  const [project] = await db.select({ id: forgeProjects.id }).from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeDeploymentCandidateError("Forge project not found.", 404)
  const [memories, allArtifacts] = await Promise.all([
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY))).limit(1),
    db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), isNull(forgeArtifacts.supersededAt))).orderBy(desc(forgeArtifacts.version)),
  ])
  const artifacts: CandidateArtifact[] = allArtifacts.map((item) => ({ id: item.id, type: item.type, title: item.title, version: item.version, outputHash: item.outputHash, qualityState: item.qualityState, approvalState: item.approvalState }))
  return { workspace: readForgeWorkspaceMemory(memories[0]?.value), artifacts, allArtifacts }
}

function categorizeEvidence(artifacts: Array<typeof forgeArtifacts.$inferSelect>) {
  const refs = (types: string[]) => artifacts.filter((item) => types.includes(item.type)).map((item) => ({ id: item.id, type: item.type, version: item.version, outputHash: item.outputHash, validationResult: item.validationResult, metadata: item.metadataJson }))
  return { qaResults: refs(["qa_report"]), securityScan: refs(["qa_report"]), accessibilityScan: refs(["accessibility_report"]), performanceResults: refs(["visual_qa"]), visualScreenshots: refs(["visual_qa", "visual_critique"]), dependencyInventory: refs(["generated_code", "qa_report"]), sbom: refs(["generated_code", "qa_report"]) }
}
function cleanList(value: string[] | undefined) { return (value ?? []).map((item) => item.trim()).filter(Boolean) }
async function loadCandidate(projectId: number, candidateId: number) { const [row] = await db.select().from(forgeDeploymentCandidates).where(and(eq(forgeDeploymentCandidates.id, candidateId), eq(forgeDeploymentCandidates.projectId, projectId))).limit(1); if (!row) throw new ForgeDeploymentCandidateError("Deployment candidate not found.", 404); return row }
