export type ReleaseGateKey = "workspace_integrity" | "build" | "typecheck" | "lint" | "accessibility" | "security" | "content_approval" | "design_approval" | "fallback_warning" | "visual_qa" | "client_approval" | "release_authorisation" | "dependency_policy" | "migration_plan"
export type ReleaseGateStatus = "passed" | "blocked" | "overridden" | "not_applicable"
export type ReleaseGateDecision = { gateKey: string; decision: "approved" | "override" | "revoked"; actorId: string; actorRole: string; reason: string; decidedAt: string; candidateWorkspaceHash: string }
export type ReleaseGate = { key: ReleaseGateKey; label: string; status: ReleaseGateStatus; reason: string; overridable: boolean; approvalActor?: string; approvalTime?: string; approvalReason?: string }

export const OVERRIDABLE_RELEASE_GATES = new Set<ReleaseGateKey>(["accessibility", "security", "fallback_warning", "visual_qa", "dependency_policy", "migration_plan"])
export const MANUAL_APPROVAL_GATES = new Set<ReleaseGateKey>(["client_approval", "migration_plan"])
export const RELEASE_GATE_KEYS: ReleaseGateKey[] = ["workspace_integrity", "build", "typecheck", "lint", "accessibility", "security", "content_approval", "design_approval", "fallback_warning", "visual_qa", "client_approval", "release_authorisation", "dependency_policy", "migration_plan"]
export function isReleaseGateKey(value: unknown): value is ReleaseGateKey { return typeof value === "string" && RELEASE_GATE_KEYS.includes(value as ReleaseGateKey) }
export function releaseGateDecisionAllowed(gateKey: ReleaseGateKey, decision: "approved" | "override" | "revoked", actorRole: string) {
  if (decision === "revoked") return true
  if (decision === "override") return actorRole === "owner" && OVERRIDABLE_RELEASE_GATES.has(gateKey)
  return MANUAL_APPROVAL_GATES.has(gateKey)
}

export interface ReleaseGateEvidence {
  integrityValid: boolean
  integrityErrors: string[]
  qaCommands: Array<{ name: string; status: string }>
  accessibilityPassed: boolean
  accessibilityReason: string
  securityPassed: boolean
  securityReason: string
  approvedArtifactTypes: string[]
  fallbackDependencies: number
  visualQaPassed: boolean
  visualQaReason: string
  dependencyPolicyPassed: boolean
  dependencyPolicyReason: string
  migrationRequired: boolean
  candidateApproved: boolean
}

export function evaluateReleaseGates(evidence: ReleaseGateEvidence, decisions: ReleaseGateDecision[]) {
  const decisionByGate = new Map(decisions.filter((item) => item.decision !== "revoked").map((item) => [item.gateKey, item]))
  const command = (name: string) => evidence.qaCommands.find((item) => item.name === name)?.status === "passed"
  const approved = new Set(evidence.approvedArtifactTypes)
  const raw: Array<Omit<ReleaseGate, "status"> & { passed: boolean; applicable?: boolean }> = [
    gate("workspace_integrity", "Workspace and artifact integrity", evidence.integrityValid, evidence.integrityValid ? "Candidate hashes match the tracked workspace and artifacts." : evidence.integrityErrors.join(" ")),
    gate("build", "Production build", command("build"), commandReason("build", evidence.qaCommands)),
    gate("typecheck", "Typecheck", command("typecheck"), commandReason("typecheck", evidence.qaCommands)),
    gate("lint", "Lint", command("lint"), commandReason("lint", evidence.qaCommands)),
    gate("accessibility", "Critical accessibility findings", evidence.accessibilityPassed, evidence.accessibilityReason),
    gate("security", "Critical security findings", evidence.securityPassed, evidence.securityReason),
    gate("content_approval", "Approved content", approved.has("copy_doc"), approved.has("copy_doc") ? "Approved copy artifact captured." : "No approved copy artifact is captured."),
    gate("design_approval", "Approved design", approved.has("design_direction") || approved.has("design_system"), approved.has("design_direction") || approved.has("design_system") ? "Approved design artifact captured." : "No approved design artifact is captured."),
    gate("fallback_warning", "Fallback and degraded dependencies", evidence.fallbackDependencies === 0, evidence.fallbackDependencies ? `${evidence.fallbackDependencies} fallback or degraded dependency warning(s) remain.` : "No fallback or degraded dependencies are captured."),
    gate("visual_qa", "Visual QA accepted", evidence.visualQaPassed, evidence.visualQaReason),
    gate("client_approval", "Required client approval", decisionByGate.get("client_approval")?.decision === "approved", decisionByGate.has("client_approval") ? "Client approval recorded." : "Client approval has not been recorded."),
    gate("release_authorisation", "Owner or authorised developer approval", evidence.candidateApproved, evidence.candidateApproved ? "Deployment candidate is approved by an authorised actor." : "Deployment candidate has not been approved."),
    gate("dependency_policy", "Dependency policy", evidence.dependencyPolicyPassed, evidence.dependencyPolicyReason),
    { ...gate("migration_plan", "Migration plan approval", !evidence.migrationRequired || decisionByGate.get("migration_plan")?.decision === "approved", evidence.migrationRequired ? decisionByGate.has("migration_plan") ? "Migration plan approval recorded." : "Migration requirements exist but their plan is not approved." : "No migration requirements apply."), applicable: evidence.migrationRequired },
  ]
  const gates: ReleaseGate[] = raw.map((item) => {
    const decision = decisionByGate.get(item.key)
    const overridable = OVERRIDABLE_RELEASE_GATES.has(item.key)
    const status: ReleaseGateStatus = item.applicable === false ? "not_applicable" : item.passed ? "passed" : overridable && decision?.decision === "override" ? "overridden" : "blocked"
    return { key: item.key, label: item.label, status, reason: status === "overridden" ? `${item.reason} Owner override: ${decision?.reason}` : item.reason, overridable, approvalActor: decision?.actorId, approvalTime: decision?.decidedAt, approvalReason: decision?.reason }
  })
  const blockers = gates.filter((item) => item.status === "blocked")
  return { allowed: blockers.length === 0, gates, blockers, summary: blockers.length ? `Deployment blocked by ${blockers.length} release gate(s): ${blockers.map((item) => item.label).join(", ")}.` : "All applicable release gates are satisfied." }
}

function gate(key: ReleaseGateKey, label: string, passed: boolean, reason: string) { return { key, label, passed, reason, overridable: OVERRIDABLE_RELEASE_GATES.has(key) } }
function commandReason(name: string, commands: Array<{ name: string; status: string }>) { const status = commands.find((item) => item.name === name)?.status; return status === "passed" ? `${name} passed.` : status ? `${name} status is ${status}.` : `${name} result is missing.` }
