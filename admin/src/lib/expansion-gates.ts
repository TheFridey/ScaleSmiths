/** Pure, conservative matching for the commercial acceptance gates (market eligibility and customer sector exclusivity). */
export type ExclusivityMatch = "none" | "review" | "restricted"
const norm = (value: unknown) => String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()

export interface ExclusivityRecord { clientId: number; sector: string; area: string }
export interface OpportunityFacts { clientId?: number | null; sector?: string | null; area?: string | null }

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
  const sector = norm(opportunity.sector), area = norm(opportunity.area)
  const exSector = norm(exclusivity.sector), exArea = norm(exclusivity.area)
  // Anything we cannot compare reliably needs a founder, on either side.
  if (!sector || !exSector || !exArea) return "review"
  const sameSector = sector === exSector
  if (!sameSector && !overlaps(stems(sector), stems(exSector))) return "none"
  if (!area) return "review"
  const nested = area === exArea || area.includes(exArea) || exArea.includes(area)
  // An exact sector in an equal or nested area is a confirmed restriction; any looser overlap is a founder review.
  if (nested) return sameSector ? "restricted" : "review"
  return overlaps(stems(area), stems(exArea)) ? "review" : "none"
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
  if (!market || market.status !== "approved" || !market.plan_keys.includes(planKey)) return "not_approved"
  return "approved"
}
