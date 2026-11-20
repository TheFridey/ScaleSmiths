/** Pure, conservative matching for the commercial acceptance gates (market eligibility and customer sector exclusivity). */
export type ExclusivityMatch = "none" | "review" | "restricted"
const norm = (value: unknown) => String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()

/** `areaPath` is the founder-approved area followed by every ancestor, most specific first (null when the wording is not in the taxonomy). */
export interface ExclusivityRecord { clientId: number; sector: string; area: string; sectorId?: string | null; areaPath?: readonly string[] | null }
/** `areaVerified` is true only when a founder entered the area (a researched candidate). A partner-typed area is an unverified assertion, so it can match but can never CLEAR. */
export interface OpportunityFacts { clientId?: number | null; sector?: string | null; area?: string | null; sectorId?: string | null; areaPath?: readonly string[] | null; areaVerified?: boolean }

/**
 * Same sector and an equal or nested area (by wording or by the founder-approved area tree) -> restricted. Same sector with an unknown area, an
 * unclassified area, or an unknown sector -> founder review. Only a positive, classified difference clears. A customer is never restricted by its own exclusivity.
 */
export function matchExclusivity(opportunity: OpportunityFacts, exclusivity: ExclusivityRecord): ExclusivityMatch {
  if (opportunity.clientId != null && opportunity.clientId === exclusivity.clientId) return "none"
  const area = norm(opportunity.area), exArea = norm(exclusivity.area)
  if (!exArea) return "review"
  // "none" needs POSITIVE evidence. The absence of a shared word is never evidence: wording can only confirm, never clear.
  const classified = Boolean(opportunity.sectorId && exclusivity.sectorId)
  let sameSector: boolean
  if (classified) {
    if (opportunity.sectorId !== exclusivity.sectorId) return "none"   // founder-authoritative: different canonical sectors
    sameSector = true
  } else {
    // At least one side is unclassified (including a classified prospect against a legacy unclassified exclusivity).
    const sector = norm(opportunity.sector), exSector = norm(exclusivity.sector)
    if (!sector || !exSector) return "review"
    if (sector !== exSector) return "review"                          // cannot prove they differ: a founder must classify or decide
    sameSector = true                                                  // identical wording is a reliable positive match
  }
  if (!area) return "review"
  const nested = area === exArea || area.includes(exArea) || exArea.includes(area)
  if (nested) return sameSector ? "restricted" : "review"
  // Geography is decided from the founder-approved area tree, never from wording. Containment in either direction ("Manchester" inside
  // "North West England", "Hucknall" inside "Nottinghamshire") is a match. Two areas that are both classified and neither contains the other
  // are positively different. Anything not in the taxonomy cannot prove a difference, so it goes to a founder.
  const a = opportunity.areaPath, e = exclusivity.areaPath
  if (a?.length && e?.length) {
    if (a.includes(e[0]) || e.includes(a[0])) return sameSector ? "restricted" : "review"
    return opportunity.areaVerified ? "none" : "review"   // only a founder-entered area may prove a difference
  }
  return "review"
}

export function normaliseCountry(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null
  const code = String(value).trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Use a two-letter ISO country code.")
  return code
}

export type MarketGate = "approved" | "not_approved" | "unknown"
export function marketGate(country: string | null, market: { status: string; plan_keys: string[] } | undefined, planKey: string): MarketGate {
  if (!country) return "unknown"
  // "*" is the legacy standard-v1 path: it needs an approved market, whichever plans that market allows.
  if (!market || market.status !== "approved" || (planKey !== "*" && !market.plan_keys.includes(planKey))) return "not_approved"
  return "approved"
}
