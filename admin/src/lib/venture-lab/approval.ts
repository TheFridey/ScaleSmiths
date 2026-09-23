import { sha256Canonical } from "./canonical"
import { assertMinorUnits } from "./money"
import type { ApprovalPayload, ApprovalRecord } from "./types"

export function hashApprovalPayload(payload: ApprovalPayload): string {
  if (payload.amountMinor !== null && payload.amountMinor !== undefined) {
    assertMinorUnits(payload.amountMinor)
  }

  return sha256Canonical({
    action: payload.action,
    ventureId: payload.ventureId ?? null,
    experimentId: payload.experimentId ?? null,
    amountMinor: payload.amountMinor ?? null,
    currency: payload.currency?.trim().toUpperCase() ?? null,
    target: payload.target?.trim() ?? null,
    purpose: payload.purpose?.trim() ?? null,
    metadata: payload.metadata ?? null,
  })
}

export function assertApprovalConsumable(
  approval: ApprovalRecord,
  payload: ApprovalPayload,
  now = new Date(),
): void {
  if (approval.status !== "APPROVED") {
    throw new Error(`Approval ${approval.id} is not consumable from state ${approval.status}.`)
  }

  if (approval.consumedAt) {
    throw new Error(`Approval ${approval.id} has already been consumed.`)
  }

  if (approval.expiresAt && new Date(approval.expiresAt).getTime() <= now.getTime()) {
    throw new Error(`Approval ${approval.id} has expired.`)
  }

  const payloadHash = hashApprovalPayload(payload)
  if (payloadHash !== approval.payloadHash) {
    throw new Error(`Approval ${approval.id} does not match the requested action payload.`)
  }
}
