export const DEPLOYMENT_CANDIDATE_STATES = ["draft", "submitted", "approved", "rejected", "superseded"] as const
export type DeploymentCandidateState = (typeof DEPLOYMENT_CANDIDATE_STATES)[number]
export const DEPLOYMENT_CANDIDATE_STATE_LABELS: Record<DeploymentCandidateState, string> = { draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected", superseded: "Superseded" }
export function isDeploymentCandidateState(value: unknown): value is DeploymentCandidateState { return typeof value === "string" && DEPLOYMENT_CANDIDATE_STATES.includes(value as DeploymentCandidateState) }
export type CandidateArtifact = { id: number; type: string; title: string; version: number; outputHash: string; qualityState: string; approvalState: string }

export function verifyCandidateSnapshot(candidate: { workspaceHash: string; approvedArtifactsJson: CandidateArtifact[] }, current: { workspaceHash: string; artifacts: CandidateArtifact[] }) {
  const errors: string[] = []
  if (candidate.workspaceHash !== current.workspaceHash) errors.push("Workspace content no longer matches this candidate.")
  const currentById = new Map(current.artifacts.map((item) => [item.id, item]))
  for (const frozen of candidate.approvedArtifactsJson) {
    const live = currentById.get(frozen.id)
    if (!live || live.outputHash !== frozen.outputHash || live.version !== frozen.version) errors.push(`Artifact #${frozen.id} no longer matches its frozen version and hash.`)
    if (frozen.approvalState !== "approved") errors.push(`Artifact #${frozen.id} was not approved when captured.`)
  }
  return { valid: errors.length === 0, errors }
}

export function compareDeploymentCandidates(left: { workspaceHash: string; approvedArtifactsJson: CandidateArtifact[]; evidenceJson: Record<string, unknown> }, right: { workspaceHash: string; approvedArtifactsJson: CandidateArtifact[]; evidenceJson: Record<string, unknown> }) {
  const leftArtifacts = new Map(left.approvedArtifactsJson.map((item) => [item.id, item]))
  const rightArtifacts = new Map(right.approvedArtifactsJson.map((item) => [item.id, item]))
  return {
    workspaceChanged: left.workspaceHash !== right.workspaceHash,
    artifactsAdded: right.approvedArtifactsJson.filter((item) => !leftArtifacts.has(item.id)),
    artifactsRemoved: left.approvedArtifactsJson.filter((item) => !rightArtifacts.has(item.id)),
    artifactsChanged: right.approvedArtifactsJson.filter((item) => { const prior = leftArtifacts.get(item.id); return prior && (prior.outputHash !== item.outputHash || prior.version !== item.version) }),
    evidenceChanged: stableJson(left.evidenceJson) !== stableJson(right.evidenceJson),
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined"
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`
}

export function degradedCandidateDependencies(artifacts: CandidateArtifact[]) {
  return artifacts.filter((artifact) => artifact.qualityState === "fallback" || artifact.qualityState === "degraded").map((artifact) => ({ id: artifact.id, type: artifact.type, title: artifact.title, version: artifact.version, qualityState: artifact.qualityState }))
}
