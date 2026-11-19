/** Pure, conservative matching for the commercial acceptance gates (market eligibility and customer sector exclusivity). */
export type ExclusivityMatch = "none" | "review" | "restricted"
const norm = (value: unknown) => String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()

export interface ExclusivityRecord { clientId: number; sector: string; area: string; sectorId?: string | null }
export interface OpportunityFacts { clientId?: number | null; sector?: string | null; area?: string | null; sectorId?: string | null }

/**
 * Same sector and an equal or nested area -> restricted. Same sector with an unknown area, or an unknown sector, -> founder review.
 * Anything that can be positively distinguished -> none. A customer is never restricted by its own exclusivity.
 */
const STOP = new Set(["and", "the", "of", "for", "in", "ltd", "limited", "services", "service", "uk"])
/** Word stems (first four letters) so "dental", "dentist" and "dentistry" overlap. Non-Latin text yields none. */
const stems = (value: string) => new Set(value.split(" ").filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => w.slice(0, 4)))
const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((t) => b.has(t))

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
  return overlaps(stems(area), stems(exArea)) ? "review" : "none"      // same sector, geographically positively different
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
