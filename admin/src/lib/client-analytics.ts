export type AnalyticsProviderId = "manual" | "google_search_console" | "google_analytics" | "plausible" | "uptime" | "core_web_vitals" | "custom"
export type AnalyticsMetricSource = "analytics" | "search_console" | "forms" | "phone" | "performance" | "errors" | "uptime" | "manual" | "custom"

export interface ClientAnalyticsConfigSafe {
  id: number
  clientId: number
  provider: AnalyticsProviderId
  displayName: string
  propertyId: string | null
  consentGranted: boolean
  consentNotes: string | null
  retentionDays: number
  enabled: boolean
  scopes: string[]
  sourceAttribution: string
  hasCredentials: boolean
  lastIngestedAt: string | null
}

export interface ClientAnalyticsDailyMetric {
  clientId: number
  configId?: number | null
  metricDate: string
  source: AnalyticsMetricSource
  sourceAttribution: string
  sessions?: number | null
  conversionEvents?: number | null
  formSubmissions?: number | null
  phoneClicks?: number | null
  ctaClicks?: number | null
  searchImpressions?: number | null
  searchClicks?: number | null
  errorCount?: number | null
  uptimeChecks?: number | null
  uptimeFailures?: number | null
  lcpP75Ms?: number | null
  inpP75Ms?: number | null
  clsP75?: number | null
  rawSummary?: Record<string, unknown>
}

export interface ClientAnalyticsSummary {
  configs: ClientAnalyticsConfigSafe[]
  totals: {
    sessions: number | null
    conversionEvents: number | null
    formSubmissions: number | null
    phoneClicks: number | null
    ctaClicks: number | null
    searchImpressions: number | null
    searchClicks: number | null
    errorCount: number | null
    uptimePercent: number | null
    lcpP75Ms: number | null
    inpP75Ms: number | null
    clsP75: number | null
  }
  bySource: Array<{ source: AnalyticsMetricSource; attribution: string; sessions: number | null; conversions: number | null; lastMetricAt: string | null }>
  missingData: string[]
}

export interface AnalyticsProviderAdapter {
  id: AnalyticsProviderId
  label: string
  supports: AnalyticsMetricSource[]
  requiresCredentials: boolean
  unknownBeaconRequired: false
  ingest(input: AnalyticsIngestInput): Promise<ClientAnalyticsDailyMetric[]>
}

export interface AnalyticsIngestInput {
  clientId: number
  configId: number
  propertyId: string | null
  sourceAttribution: string
  credentials: Record<string, unknown> | null
  from: Date
  to: Date
}

export function summarizeClientAnalytics(input: { configs: ClientAnalyticsConfigSafe[]; metrics: ClientAnalyticsDailyMetric[] }): ClientAnalyticsSummary {
  const metrics = input.metrics
  const sources = new Set(metrics.map((metric) => metric.source))
  const missingData = []
  if (!input.configs.some((config) => config.enabled && config.consentGranted)) missingData.push("No enabled analytics source has client consent.")
  if (!sources.has("analytics") && !sources.has("manual")) missingData.push("Sessions and conversion analytics are not connected.")
  if (!sources.has("search_console")) missingData.push("Search impressions/clicks are not connected.")
  if (!sources.has("performance")) missingData.push("Core Web Vitals are not connected.")
  if (!sources.has("uptime")) missingData.push("Uptime monitoring is not connected.")

  return {
    configs: input.configs,
    totals: {
      sessions: nullableSum(metrics.map((metric) => metric.sessions)),
      conversionEvents: nullableSum(metrics.map((metric) => metric.conversionEvents)),
      formSubmissions: nullableSum(metrics.map((metric) => metric.formSubmissions)),
      phoneClicks: nullableSum(metrics.map((metric) => metric.phoneClicks)),
      ctaClicks: nullableSum(metrics.map((metric) => metric.ctaClicks)),
      searchImpressions: nullableSum(metrics.map((metric) => metric.searchImpressions)),
      searchClicks: nullableSum(metrics.map((metric) => metric.searchClicks)),
      errorCount: nullableSum(metrics.map((metric) => metric.errorCount)),
      uptimePercent: uptimePercent(metrics),
      lcpP75Ms: latestNumber(metrics, "lcpP75Ms"),
      inpP75Ms: latestNumber(metrics, "inpP75Ms"),
      clsP75: latestNumber(metrics, "clsP75"),
    },
    bySource: Array.from(groupBy(metrics, (metric) => `${metric.source}:${metric.sourceAttribution}`).values()).map((rows) => ({
      source: rows[0].source,
      attribution: rows[0].sourceAttribution,
      sessions: nullableSum(rows.map((metric) => metric.sessions)),
      conversions: nullableSum(rows.map((metric) => metric.conversionEvents)),
      lastMetricAt: rows.map((metric) => metric.metricDate).sort().at(-1) ?? null,
    })),
    missingData,
  }
}

export function minimisedMetric(input: ClientAnalyticsDailyMetric): ClientAnalyticsDailyMetric {
  return {
    clientId: input.clientId,
    configId: input.configId ?? null,
    metricDate: input.metricDate,
    source: input.source,
    sourceAttribution: input.sourceAttribution,
    sessions: nonNegative(input.sessions),
    conversionEvents: nonNegative(input.conversionEvents),
    formSubmissions: nonNegative(input.formSubmissions),
    phoneClicks: nonNegative(input.phoneClicks),
    ctaClicks: nonNegative(input.ctaClicks),
    searchImpressions: nonNegative(input.searchImpressions),
    searchClicks: nonNegative(input.searchClicks),
    errorCount: nonNegative(input.errorCount),
    uptimeChecks: nonNegative(input.uptimeChecks),
    uptimeFailures: nonNegative(input.uptimeFailures),
    lcpP75Ms: nonNegative(input.lcpP75Ms),
    inpP75Ms: nonNegative(input.inpP75Ms),
    clsP75: typeof input.clsP75 === "number" && input.clsP75 >= 0 ? input.clsP75 : null,
    rawSummary: redactRawSummary(input.rawSummary ?? {}),
  }
}

function redactRawSummary(value: Record<string, unknown>) {
  const allowed = ["note", "provider", "status", "sampleSize", "collectionWindow", "warning"]
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => allowed.includes(key) && typeof item !== "object"))
}

function nonNegative(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null
}

function nullableSum(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null
}

function uptimePercent(metrics: ClientAnalyticsDailyMetric[]) {
  const checks = nullableSum(metrics.map((metric) => metric.uptimeChecks))
  const failures = nullableSum(metrics.map((metric) => metric.uptimeFailures))
  if (!checks || failures === null) return null
  return Math.round(((checks - failures) / checks) * 10_000) / 100
}

function latestNumber<T extends keyof ClientAnalyticsDailyMetric>(metrics: ClientAnalyticsDailyMetric[], key: T) {
  const latest = [...metrics].reverse().find((metric) => typeof metric[key] === "number")
  return latest ? latest[key] as number : null
}

function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const rows = map.get(key(item)) ?? []
    rows.push(item)
    map.set(key(item), rows)
  }
  return map
}
