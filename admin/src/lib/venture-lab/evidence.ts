import { sha256Canonical } from "./canonical"
import type { EvidenceSnapshot, EvidenceSnapshotInput } from "./types"

export const MAX_SUPPORTING_EXCERPT_CHARS = 1_000

export function captureEvidence(
  input: EvidenceSnapshotInput,
  capturedAt = new Date().toISOString(),
): EvidenceSnapshot {
  const sourceUrl = input.sourceUrl.trim()
  const claim = input.claim.trim()
  const summary = input.summary.trim()
  const sourceTitle = input.sourceTitle?.trim() || null
  const supportingExcerpt = input.supportingExcerpt?.trim() || null
  const observedAt = input.observedAt?.trim() || null

  if (!sourceUrl) throw new Error("Evidence sourceUrl is required.")
  if (!claim) throw new Error("Evidence claim is required.")
  if (!summary) throw new Error("Evidence summary is required.")
  if (supportingExcerpt && supportingExcerpt.length > MAX_SUPPORTING_EXCERPT_CHARS) {
    throw new Error(`Evidence excerpt exceeds ${MAX_SUPPORTING_EXCERPT_CHARS} characters.`)
  }

  const hashMaterial = {
    sourceUrl,
    sourceTitle,
    evidenceType: input.evidenceType,
    claim,
    summary,
    supportingExcerpt,
    observedAt,
  }

  return {
    ...hashMaterial,
    capturedAt,
    contentHash: sha256Canonical(hashMaterial),
  }
}
