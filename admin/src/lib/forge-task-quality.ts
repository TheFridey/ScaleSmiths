export const FORGE_RESULT_QUALITIES = ["validated", "degraded", "fallback", "requires_review", "failed"] as const
export type ForgeTaskResultQuality = typeof FORGE_RESULT_QUALITIES[number]

export interface ForgeTaskQualityRecord {
  status: string
  resultQuality: ForgeTaskResultQuality
  humanApprovalRequired: boolean
  qualityApprovedAt: Date | string | null
  qualityApprovalReason: string | null
}

export function taskBlocksDeployment(task: ForgeTaskQualityRecord) {
  if (task.status !== "completed") return task.status === "failed"
  if (task.resultQuality === "failed" || task.resultQuality === "requires_review") return true
  if (task.resultQuality === "degraded" || task.resultQuality === "fallback") {
    return task.humanApprovalRequired && (!task.qualityApprovedAt || !task.qualityApprovalReason?.trim())
  }
  return false
}

export function inferTaskQuality(input: { status: string; provider?: string | null; validationPassed?: boolean | null; fallbackReason?: string | null }): ForgeTaskResultQuality {
  if (input.status === "failed") return "failed"
  if (input.fallbackReason || input.provider === "mock") return "fallback"
  if (input.validationPassed === true) return "validated"
  if (input.validationPassed === false) return "degraded"
  return "requires_review"
}
