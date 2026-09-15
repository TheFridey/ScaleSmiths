import type { PublicClaim } from "./public-claims"

/**
 * Case-study results. A metric is only ever shown with a value from a verified public claim
 * (status verified, client-approved where required, within its review window, and permitted
 * on the case-study route and `project_metrics` component). Nothing here holds a number.
 */

export type MetricKey =
  | "organic-impressions"
  | "organic-clicks"
  | "search-visibility"
  | "enquiries"
  | "conversion-rate"
  | "performance-score"
  | "indexed-pages"

export const METRIC_DEFINITIONS: Record<MetricKey, { label: string; description: string }> = {
  "organic-impressions": { label: "Organic impressions", description: "Search Console impressions over the stated period." },
  "organic-clicks": { label: "Organic clicks", description: "Search Console clicks over the stated period." },
  "search-visibility": { label: "Search visibility", description: "Visibility for the tracked keyword set." },
  enquiries: { label: "Enquiries", description: "Qualified enquiries recorded over the stated period." },
  "conversion-rate": { label: "Conversion rate", description: "Enquiries as a share of sessions." },
  "performance-score": { label: "Performance score", description: "Lighthouse or field Core Web Vitals performance." },
  "indexed-pages": { label: "Indexed pages", description: "Pages indexed according to Search Console." },
}

export const METRICS_COMPONENT = "project_metrics"
export const OUTCOMES_COMPONENT = "project_outcomes"
export const CLIENT_QUOTE_COMPONENT = "client_quote"

export interface ResolvedMetric {
  key: MetricKey
  label: string
  value: string
  description: string
  verifiedAt: Date
}

export function resolveVerifiedMetrics(
  metrics: ReadonlyArray<{ key: MetricKey; claimId: string }> | undefined,
  claims: readonly PublicClaim[],
): ResolvedMetric[] {
  const permitted = new Map(claims.filter((claim) => claim.permittedComponents.includes(METRICS_COMPONENT)).map((claim) => [claim.id, claim]))
  return (metrics ?? []).flatMap(({ key, claimId }) => {
    const claim = permitted.get(claimId)
    if (!claim) return []
    return [{ key, label: METRIC_DEFINITIONS[key].label, description: METRIC_DEFINITIONS[key].description, value: claim.approvedWording, verifiedAt: claim.verifiedAt }]
  })
}

export interface ResolvedQuote {
  quote: string
  name: string
  business: string
}

export function resolveClientQuote(claimId: string | undefined, claims: readonly PublicClaim[]): ResolvedQuote | undefined {
  if (!claimId) return undefined
  const claim = claims.find((candidate) => candidate.id === claimId && candidate.permittedComponents.includes(CLIENT_QUOTE_COMPONENT))
  if (!claim || !["testimonial", "attributed_quote"].includes(claim.claimType)) return undefined
  if (!claim.attributionName || !claim.attributionBusiness) return undefined
  return { quote: claim.approvedWording, name: claim.attributionName, business: claim.attributionBusiness }
}

export function resolveOutcomes(claimIds: readonly string[], claims: readonly PublicClaim[]): string[] {
  const permitted = new Map(claims.filter((claim) => claim.permittedComponents.includes(OUTCOMES_COMPONENT)).map((claim) => [claim.id, claim]))
  return claimIds.map((id) => permitted.get(id)?.approvedWording).filter((value): value is string => Boolean(value))
}
