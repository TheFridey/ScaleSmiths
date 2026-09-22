export const VENTURE_STATUSES = [
  "DISCOVERED",
  "RESEARCHING",
  "VALIDATION_CANDIDATE",
  "VALIDATING",
  "VALIDATED",
  "BUILD_APPROVED",
  "BUILDING",
  "QA",
  "LAUNCH_APPROVAL",
  "LIVE",
  "MEASURING",
  "SCALE",
  "MAINTAIN",
  "KILL",
] as const

export type VentureStatus = (typeof VENTURE_STATUSES)[number]

export const APPROVAL_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "CONSUMED",
] as const

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export type VentureActorKind = "human" | "advisor" | "agent" | "service"

export type VentureAuthority =
  | "final_capital"
  | "strategy_recommendation"
  | "technical_integrity"
  | "emergency_stop"
  | "research_execution"

export interface VentureActor {
  id: string
  name: string
  kind: VentureActorKind
  authorities: VentureAuthority[]
}

export interface EvidenceSnapshotInput {
  sourceUrl: string
  sourceTitle?: string | null
  evidenceType: string
  claim: string
  summary: string
  supportingExcerpt?: string | null
  observedAt?: string | null
}

export interface EvidenceSnapshot extends EvidenceSnapshotInput {
  capturedAt: string
  contentHash: string
}

export interface ApprovalPayload {
  action: string
  ventureId?: string | number | null
  experimentId?: string | number | null
  amountMinor?: number | null
  currency?: string | null
  target?: string | null
  purpose?: string | null
  metadata?: Record<string, unknown> | null
}

export interface ApprovalRecord {
  id: string
  status: ApprovalStatus
  payloadHash: string
  idempotencyKey: string
  requestedBy: string
  approvedBy?: string | null
  requestedAt: string
  expiresAt?: string | null
  consumedAt?: string | null
}

export interface LedgerPosting {
  account: string
  debitMinor: number
  creditMinor: number
}

export interface ExperimentZeroAttack {
  id: string
  category: "capital" | "approval" | "authority" | "state" | "prompt_injection" | "evidence" | "recovery"
  description: string
  expected: "REJECT" | "BLOCK" | "PASS"
}
