export type ForgeApprovalSemantic = "generated" | "validated" | "policy_approved" | "human_approved" | "client_approved" | "rejected" | "superseded"

export interface ForgeArtifactApprovalInput {
  qualityState: string
  approvalState: string
  approvalHistory?: Array<Record<string, unknown>> | null
  supersededAt?: Date | string | null
}

export function deriveArtifactApprovalSemantics(artifact: ForgeArtifactApprovalInput): ForgeApprovalSemantic[] {
  if (artifact.supersededAt) return ["superseded"]
  const states = new Set<ForgeApprovalSemantic>(["generated"])
  if (artifact.qualityState === "validated") states.add("validated")
  if (artifact.approvalState === "rejected" || hasDecision(artifact.approvalHistory, "rejected")) states.add("rejected")
  if (artifact.approvalState === "system_validated" || hasActor(artifact.approvalHistory, "forge-run-policy")) states.add("policy_approved")
  if (artifact.approvalState === "approved" && hasNonPolicyApproval(artifact.approvalHistory)) states.add("human_approved")
  if (hasClientApproval(artifact.approvalHistory)) states.add("client_approved")
  return [...states]
}

export function artifactApprovalLabels(artifact: ForgeArtifactApprovalInput) {
  const labels: Record<ForgeApprovalSemantic, string> = {
    generated: "Generated",
    validated: "Automated checks passed",
    policy_approved: "Accepted by run policy",
    human_approved: "Internally approved",
    client_approved: "Client approved",
    rejected: "Rejected",
    superseded: "Superseded by newer output",
  }
  const states = deriveArtifactApprovalSemantics(artifact)
  if (!states.some((state) => ["policy_approved", "human_approved", "client_approved", "rejected", "superseded"].includes(state))) {
    states.push("generated")
    return [...new Set(states)].map((state) => labels[state]).concat("Awaiting internal approval")
  }
  return states.map((state) => labels[state])
}

export function isCurrentHumanApprovedArtifact(artifact: ForgeArtifactApprovalInput) {
  const states = deriveArtifactApprovalSemantics(artifact)
  return states.includes("human_approved") && !states.includes("superseded") && !states.includes("rejected")
}

export function hasClientDeploymentApproval(projectStatus: string, activity: Array<{ action: string; metadataJson?: Record<string, unknown> | null }>) {
  return ["ready_to_deploy", "deployed"].includes(projectStatus) && activity.some((entry) => entry.action === "client_approval_recorded" && entry.metadataJson?.approvalScope === "client")
}

function hasDecision(history: ForgeArtifactApprovalInput["approvalHistory"], decision: string) {
  return (history ?? []).some((entry) => entry.state === decision || entry.decision === decision || (entry.approvalDecision as Record<string, unknown> | undefined)?.decision === decision)
}

function hasActor(history: ForgeArtifactApprovalInput["approvalHistory"], actor: string) {
  return (history ?? []).some((entry) => entry.actor === actor || (entry.approvalDecision as Record<string, unknown> | undefined)?.actor === actor)
}

function hasNonPolicyApproval(history: ForgeArtifactApprovalInput["approvalHistory"]) {
  return (history ?? []).some((entry) => {
    const nested = entry.approvalDecision as Record<string, unknown> | undefined
    const approved = entry.state === "approved" || entry.decision === "approved" || nested?.decision === "approved"
    const actor = entry.actor ?? nested?.actor
    return approved && typeof actor === "string" && actor !== "forge-run-policy"
  })
}

function hasClientApproval(history: ForgeArtifactApprovalInput["approvalHistory"]) {
  return (history ?? []).some((entry) => entry.approvalScope === "client" && (entry.state === "approved" || entry.decision === "approved"))
}
