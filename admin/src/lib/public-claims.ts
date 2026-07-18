import type { PublicClaimApprovalStatus, PublicClaimStatus } from "./schema"

export const PUBLIC_CLAIM_STATUSES = ["draft", "verified", "expired", "rejected"] as const
export const PUBLIC_CLAIM_APPROVAL_STATUSES = ["pending", "approved", "declined", "not_required"] as const
export const PUBLIC_CLAIM_TYPES = [
  "numerical", "revenue", "retention", "project_count", "customer_result", "testimonial",
  "attributed_quote", "paid_for_itself", "timeline", "performance", "pricing",
] as const

export interface PublicClaimReviewInput {
  approvedWording: string
  claimType: (typeof PUBLIC_CLAIM_TYPES)[number]
  sourceName: string | null
  attributionName: string | null
  attributionBusiness: string | null
  clientApprovalStatus: PublicClaimApprovalStatus
  status: PublicClaimStatus
  reviewExpiresAt: Date | null
  permittedRoutes: string[]
  permittedComponents: string[]
  evidenceDescription: string | null
  evidenceReference: string | null
  reason: string
}

export function parsePublicClaimReviewInput(value: unknown): { ok: true; data: PublicClaimReviewInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "A claim review payload is required." }
  const input = value as Record<string, unknown>
  const approvedWording = clean(input.approvedWording, 1_000)
  const claimType = clean(input.claimType, 50)
  const status = clean(input.status, 30)
  const clientApprovalStatus = clean(input.clientApprovalStatus, 30)
  const reason = clean(input.reason, 1_000)
  const routes = stringList(input.permittedRoutes, 30, 160)
  const components = stringList(input.permittedComponents, 30, 100)
  const reviewExpiresAt = dateOrNull(input.reviewExpiresAt)

  if (!approvedWording) return { ok: false, error: "Exact approved public wording is required." }
  if (!PUBLIC_CLAIM_TYPES.includes(claimType as PublicClaimReviewInput["claimType"])) return { ok: false, error: "A supported claim type is required." }
  if (!PUBLIC_CLAIM_STATUSES.includes(status as PublicClaimStatus)) return { ok: false, error: "A supported claim status is required." }
  if (!PUBLIC_CLAIM_APPROVAL_STATUSES.includes(clientApprovalStatus as PublicClaimApprovalStatus)) return { ok: false, error: "A supported client approval status is required." }
  if (!reason) return { ok: false, error: "A review reason is required." }
  if (!routes.length || routes.some((route) => !route.startsWith("/"))) return { ok: false, error: "At least one absolute permitted public route is required." }
  if (!components.length || components.some((component) => !/^[a-z0-9_]+$/.test(component))) return { ok: false, error: "At least one valid permitted component is required." }
  if (status === "verified") {
    if (!clientApprovalStatus || !["approved", "not_required"].includes(clientApprovalStatus)) return { ok: false, error: "Verified claims require recorded client approval or an explicit not-required decision." }
    if (!reviewExpiresAt || reviewExpiresAt.getTime() <= Date.now()) return { ok: false, error: "Verified claims require a future review or expiry date." }
    if (!clean(input.evidenceDescription, 2_000) || !clean(input.evidenceReference, 1_000)) return { ok: false, error: "Verified claims require private evidence description and reference fields." }
  }

  return {
    ok: true,
    data: {
      approvedWording,
      claimType: claimType as PublicClaimReviewInput["claimType"],
      sourceName: clean(input.sourceName, 300),
      attributionName: clean(input.attributionName, 200),
      attributionBusiness: clean(input.attributionBusiness, 300),
      clientApprovalStatus: clientApprovalStatus as PublicClaimApprovalStatus,
      status: status as PublicClaimStatus,
      reviewExpiresAt,
      permittedRoutes: routes,
      permittedComponents: components,
      evidenceDescription: clean(input.evidenceDescription, 2_000),
      evidenceReference: clean(input.evidenceReference, 1_000),
      reason,
    },
  }
}

export function parsePublicClaimId(value: unknown) {
  const id = clean(value, 160)
  return id && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id) ? id : null
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized ? normalized.slice(0, max) : null
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => clean(item, maxLength)).filter((item): item is string => Boolean(item)))].slice(0, maxItems)
}

function dateOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
