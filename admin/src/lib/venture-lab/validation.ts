import { sha256Canonical } from "./canonical"

export const CARE_FLOOR_MINOR = 45_000

export const QUALIFICATION_REASONS = ["site_removed", "files_not_handed_over", "ownership_retained", "meaningful_buyout", "provider_controls_domain", "asset_cannot_move"] as const
export const VALIDATION_PATHS = ["migration", "rebuild", "unknown"] as const
export const OWNERSHIP_AWARENESS = ["knows", "believes_other", "unknown"] as const
export const CANCELLATION_BELIEFS = ["site_removed", "files_withheld", "domain_lost", "believes_they_own", "unknown", "other"] as const
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const
export const SPEND_BANDS = ["under_50_pcm", "50_to_99_pcm", "100_to_249_pcm", "250_pcm_or_more", "unknown"] as const
export const SATISFACTION = ["satisfied", "mixed", "dissatisfied", "unknown"] as const
export const TIMING = ["in_minimum_term", "renewal_within_90_days", "rolling_or_no_known_date", "not_planning_to_move", "unknown"] as const
export const CONSIDERED = ["yes", "no", "unknown"] as const
export const PROJECT_ACCEPTANCE = ["accepted", "declined", "deferred", "not_offered"] as const
export const CARE_ACCEPTANCE = ["accepted", "declined", "deferred", "not_offered"] as const
export const COMMITMENT = ["deposit_ready", "written_commitment", "none"] as const
export const OUTCOME_STATUSES = ["care_accepted", "priced_next_step", "no_priced_step", "incomplete"] as const

export type ValidationOutcomeStatus = (typeof OUTCOME_STATUSES)[number]

export type ValidationSubmission = {
  opportunityId: string
  prospectCode: string
  businessUrl: string
  qualificationEvidenceId: string
  supplier: string
  qualificationReason: (typeof QUALIFICATION_REASONS)[number]
  path: (typeof VALIDATION_PATHS)[number]
  ownershipAwareness: (typeof OWNERSHIP_AWARENESS)[number]
  cancellationBelief: (typeof CANCELLATION_BELIEFS)[number]
  controlMatters: (typeof YES_NO_UNKNOWN)[number]
  spendBand: (typeof SPEND_BANDS)[number]
  satisfaction: (typeof SATISFACTION)[number]
  timing: (typeof TIMING)[number]
  alternativeConsidered: (typeof CONSIDERED)[number]
  pricedProjectAcceptance: (typeof PROJECT_ACCEPTANCE)[number]
  careAcceptance: (typeof CARE_ACCEPTANCE)[number]
  strongCommitment: (typeof COMMITMENT)[number]
  supersedesOutcomeId: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class ValidationInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationInputError"
  }
}

export function deriveValidationOutcomeStatus(input: Pick<ValidationSubmission, "pricedProjectAcceptance" | "careAcceptance">): ValidationOutcomeStatus {
  if (input.pricedProjectAcceptance === "accepted" && input.careAcceptance === "accepted") return "care_accepted"
  if (input.pricedProjectAcceptance === "accepted") return "priced_next_step"
  if (input.pricedProjectAcceptance === "declined") return "no_priced_step"
  return "incomplete"
}

export function validationPayloadHash(experimentId: number, submission: ValidationSubmission, outcomeStatus: ValidationOutcomeStatus) {
  return sha256Canonical({ experimentId, ...submission, outcomeStatus })
}

export function evidenceSupportsQualification(input: {
  evidenceType: string
  opportunityId: string | null
  expectedOpportunityId: string
  supplier: string
  sourceTitle: string
  claim: string
  summary: string
}) {
  if (input.evidenceType.trim().toLowerCase() === "connection-smoke") return false
  if (!input.opportunityId || input.opportunityId !== input.expectedOpportunityId) return false
  if (input.supplier.toLowerCase() === "unknown") return true
  const haystack = `${input.sourceTitle}\n${input.claim}\n${input.summary}`.toLowerCase()
  return haystack.includes(input.supplier.toLowerCase())
}

export function parseValidationSubmission(args: Record<string, unknown>): ValidationSubmission {
  const submission: ValidationSubmission = {
    opportunityId: requiredUuid(args.opportunityId, "opportunityId"),
    prospectCode: prospectCode(args.prospectCode),
    businessUrl: publicBusinessUrl(args.businessUrl),
    qualificationEvidenceId: requiredUuid(args.qualificationEvidenceId, "qualificationEvidenceId"),
    supplier: supplierName(args.supplier),
    qualificationReason: oneOf(args.qualificationReason, QUALIFICATION_REASONS, "qualificationReason"),
    path: oneOf(args.path, VALIDATION_PATHS, "path"),
    ownershipAwareness: oneOf(args.ownershipAwareness, OWNERSHIP_AWARENESS, "ownershipAwareness"),
    cancellationBelief: oneOf(args.cancellationBelief, CANCELLATION_BELIEFS, "cancellationBelief"),
    controlMatters: oneOf(args.controlMatters, YES_NO_UNKNOWN, "controlMatters"),
    spendBand: oneOf(args.spendBand, SPEND_BANDS, "spendBand"),
    satisfaction: oneOf(args.satisfaction, SATISFACTION, "satisfaction"),
    timing: oneOf(args.timing, TIMING, "timing"),
    alternativeConsidered: oneOf(args.alternativeConsidered, CONSIDERED, "alternativeConsidered"),
    pricedProjectAcceptance: oneOf(args.pricedProjectAcceptance, PROJECT_ACCEPTANCE, "pricedProjectAcceptance"),
    careAcceptance: oneOf(args.careAcceptance, CARE_ACCEPTANCE, "careAcceptance"),
    strongCommitment: oneOf(args.strongCommitment, COMMITMENT, "strongCommitment"),
    supersedesOutcomeId: args.supersedesOutcomeId == null || args.supersedesOutcomeId === ""
      ? null
      : requiredUuid(args.supersedesOutcomeId, "supersedesOutcomeId"),
  }
  if (submission.pricedProjectAcceptance === "accepted" && submission.path === "unknown") {
    throw new ValidationInputError("pricedProjectAcceptance cannot be accepted when path is unknown.")
  }
  return submission
}

function prospectCode(value: unknown) {
  if (typeof value !== "string" || !/^P(0[1-9]|1[0-9]|20)$/.test(value)) {
    throw new ValidationInputError("prospectCode must be P01 through P20.")
  }
  return value
}

function supplierName(value: unknown) {
  if (typeof value !== "string") throw new ValidationInputError("supplier is required.")
  const text = value.trim()
  if (!text || text.length > 120) throw new ValidationInputError("supplier must be between 1 and 120 characters.")
  return text
}

function requiredUuid(value: unknown, field: string) {
  if (typeof value !== "string" || !UUID.test(value)) throw new ValidationInputError(`${field} must be a UUID.`)
  return value
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ValidationInputError(`${field} is not an allowed value.`)
  }
  return value
}

export function publicBusinessUrl(value: unknown) {
  if (typeof value !== "string") throw new ValidationInputError("businessUrl is required.")
  const raw = value.trim()
  if (!raw || raw.length > 2000) throw new ValidationInputError("businessUrl must be between 1 and 2000 characters.")
  let url: URL
  try { url = new URL(raw) } catch { throw new ValidationInputError("businessUrl must be a valid URL.") }
  if (url.username || url.password) throw new ValidationInputError("businessUrl must not include credentials.")
  if (!["http:", "https:"].includes(url.protocol)) throw new ValidationInputError("businessUrl must use HTTP or HTTPS.")
  url.search = ""
  url.hash = ""
  return url.toString()
}
