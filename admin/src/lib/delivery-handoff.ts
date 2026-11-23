/** Operation ASCEND B2.6 — immutable commercial-to-delivery handoff contract. */
export interface HandoffSource {
  opportunityId: string
  opportunityStatus: string
  contractId: string | null
  contractClientId: number | null
  opportunityClientId: number | null
  acceptedAt: string | null
  agreementReference: string | null
  scopeVersion: number | null
  scopeSnapshot: unknown
  cancelled: boolean
  existingHandoffId: string | null
}
export type HandoffReadiness = { ready: boolean; blockers: string[]; alreadyHandedOff: boolean }

export function handoffReadiness(source: HandoffSource): HandoffReadiness {
  const blockers: string[] = []
  if (source.opportunityStatus !== "contract_accepted") blockers.push("The opportunity does not have an accepted contract.")
  if (!source.contractId || !source.acceptedAt) blockers.push("An authoritative accepted contract is required.")
  if (!source.contractClientId || source.contractClientId < 1 || source.opportunityClientId !== source.contractClientId) blockers.push("The contract and opportunity must reference the same existing client.")
  if (!source.scopeVersion || !Number.isSafeInteger(source.scopeVersion) || source.scopeVersion < 1 ||
      !source.scopeSnapshot || typeof source.scopeSnapshot !== "object" || Array.isArray(source.scopeSnapshot))
    blockers.push("An accepted, versioned scope snapshot is required.")
  if (!source.agreementReference?.trim()) blockers.push("The accepted agreement reference is missing.")
  if (source.cancelled) blockers.push("The contract has a recorded cancellation.")
  if (source.existingHandoffId) blockers.push("This opportunity has already been handed over.")
  return { ready: blockers.length === 0, blockers, alreadyHandedOff: Boolean(source.existingHandoffId) }
}

/** A founder must give explicit, durable approval; no implicit conversion from an accepted deal. */
export function validateHandoffApproval(input: { confirm?: unknown; reason?: unknown; opportunityId?: unknown; expectedContractId?: unknown }) {
  if (input.confirm !== true) throw new RangeError("Explicit founder confirmation is required.")
  if (typeof input.opportunityId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.opportunityId))
    throw new RangeError("Choose a valid accepted opportunity.")
  if (typeof input.expectedContractId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.expectedContractId))
    throw new RangeError("The expected contract ID is required.")
  if (typeof input.reason !== "string" || input.reason.trim().length < 10 || input.reason.trim().length > 1000)
    throw new RangeError("Provide a founder handoff note between 10 and 1000 characters.")
  return { opportunityId: input.opportunityId, expectedContractId: input.expectedContractId, reason: input.reason.trim() }
}
