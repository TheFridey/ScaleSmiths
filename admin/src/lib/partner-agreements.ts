import { AdminIdentityError } from "@/lib/admin-users"

/** What the partner explicitly submits when accepting: the version and digest they were shown, their name, and the tick. */
export type AgreementAcceptanceInput = { versionId: string; sha256: string; signatoryName: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseAcceptance(input: unknown): AgreementAcceptanceInput {
  const value = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>
  if (value.accepted !== true) throw new AdminIdentityError("Read the agreement and tick the box to accept it.", 400, "agreement_not_accepted")
  const versionId = typeof value.versionId === "string" ? value.versionId : ""
  const sha256 = typeof value.sha256 === "string" ? value.sha256.toLowerCase() : ""
  if (!UUID.test(versionId) || !/^[0-9a-f]{64}$/.test(sha256)) throw new AdminIdentityError("Reload the page and read the current agreement before accepting.", 400, "agreement_changed")
  const signatoryName = typeof value.signatoryName === "string" ? value.signatoryName.normalize("NFC").replace(/\s+/g, " ").trim() : ""
  if (signatoryName.length < 2 || signatoryName.length > 120 || /[\u0000-\u001f\u007f<>]/.test(signatoryName)) throw new AdminIdentityError("Type your full legal name to accept the agreement.", 400, "signatory_invalid")
  return { versionId, sha256, signatoryName }
}

/** Server-generated statement stored with the acceptance. Deliberately makes no claim of legal effect. */
export function acceptanceStatement(name: string, title: string, version: number): string {
  return `I, ${name}, confirm that I have read "${title}" (version ${version}) in full and accept it.`.slice(0, 1000)
}

/**
 * B1.7: the partner's agreement state, derived only from their own records: the version currently issued to them
 * (expansion_partners.agreement_content_version_id), whether that version is still current (published and within its review date),
 * and the version of their latest acceptance. Acceptance is never inferred from an invitation.
 */
export type AgreementState = "none" | "awaiting_acceptance" | "accepted" | "update_awaiting_acceptance" | "unavailable"
export function agreementState(input: { issuedVersionId: string | null; issuedCurrent: boolean; acceptedVersionId: string | null }): AgreementState {
  if (!input.issuedVersionId) return "none"
  if (!input.issuedCurrent) return "unavailable"
  if (!input.acceptedVersionId) return "awaiting_acceptance"
  return input.acceptedVersionId === input.issuedVersionId ? "accepted" : "update_awaiting_acceptance"
}
/** Whether the partner must act through the existing agreement page (there is no second acceptance route). */
export const agreementNeedsAcceptance = (state: AgreementState) => state === "awaiting_acceptance" || state === "update_awaiting_acceptance"
