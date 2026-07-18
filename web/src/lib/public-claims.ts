export interface PublicClaim {
  id: string
  approvedWording: string
  claimType: string
  attributionName: string | null
  attributionBusiness: string | null
  permittedRoutes: string[]
  permittedComponents: string[]
  verifiedAt: Date
  reviewExpiresAt: Date
}

export interface PublicClaimCandidate extends PublicClaim {
  status?: string
  clientApprovalStatus?: string
  evidenceDescription?: unknown
  evidenceReference?: unknown
  verifiedBy?: unknown
}

export function selectVerifiedPublicClaims(
  candidates: readonly PublicClaimCandidate[],
  placement: { route: string; component?: string; now?: Date },
): PublicClaim[] {
  const now = placement.now ?? new Date()
  return candidates
    .filter((claim) => claim.status === undefined || claim.status === "verified")
    .filter((claim) => claim.clientApprovalStatus === undefined || ["approved", "not_required"].includes(claim.clientApprovalStatus))
    .filter((claim) => validDate(claim.verifiedAt) && claim.verifiedAt.getTime() <= now.getTime())
    .filter((claim) => validDate(claim.reviewExpiresAt) && claim.reviewExpiresAt.getTime() > now.getTime())
    .filter((claim) => claim.permittedRoutes.some((pattern) => routeMatches(pattern, placement.route)))
    .filter((claim) => !placement.component || claim.permittedComponents.includes(placement.component))
    .map(toPublicClaim)
}

export function publicClaimMap(claims: readonly PublicClaim[]) {
  return new Map(claims.map((claim) => [claim.id, claim]))
}

export function claimWording(claims: ReadonlyMap<string, PublicClaim>, id: string, fallback: string) {
  return claims.get(id)?.approvedWording ?? fallback
}

function toPublicClaim(claim: PublicClaimCandidate): PublicClaim {
  return {
    id: claim.id,
    approvedWording: claim.approvedWording,
    claimType: claim.claimType,
    attributionName: claim.attributionName,
    attributionBusiness: claim.attributionBusiness,
    permittedRoutes: [...claim.permittedRoutes],
    permittedComponents: [...claim.permittedComponents],
    verifiedAt: new Date(claim.verifiedAt),
    reviewExpiresAt: new Date(claim.reviewExpiresAt),
  }
}

function routeMatches(pattern: string, route: string) {
  if (pattern === route) return true
  return pattern.endsWith("/*") && route.startsWith(pattern.slice(0, -1))
}

function validDate(value: Date) {
  return value instanceof Date && Number.isFinite(value.getTime())
}
