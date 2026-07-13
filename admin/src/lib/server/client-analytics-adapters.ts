import "server-only"
import type { AnalyticsProviderAdapter, AnalyticsProviderId } from "@/lib/client-analytics"
import { minimisedMetric } from "@/lib/client-analytics"

const manualAdapter: AnalyticsProviderAdapter = {
  id: "manual",
  label: "Manual / imported daily metrics",
  supports: ["manual", "analytics", "forms", "phone", "performance", "errors", "uptime", "search_console"],
  requiresCredentials: false,
  unknownBeaconRequired: false,
  async ingest(input) {
    const metrics = Array.isArray(input.credentials?.metrics) ? input.credentials.metrics : []
    return metrics.map((metric) => minimisedMetric({
      clientId: input.clientId,
      configId: input.configId,
      metricDate: typeof metric === "object" && metric && "metricDate" in metric && typeof metric.metricDate === "string" ? metric.metricDate : input.to.toISOString(),
      source: "manual",
      sourceAttribution: input.sourceAttribution,
      ...(typeof metric === "object" && metric ? metric as Record<string, unknown> : {}),
    }))
  },
}

function unavailableAdapter(id: AnalyticsProviderId, label: string, supports: AnalyticsProviderAdapter["supports"], requiresCredentials = true): AnalyticsProviderAdapter {
  return {
    id,
    label,
    supports,
    requiresCredentials,
    unknownBeaconRequired: false,
    async ingest() {
      return []
    },
  }
}

export const ANALYTICS_PROVIDER_ADAPTERS: Record<AnalyticsProviderId, AnalyticsProviderAdapter> = {
  manual: manualAdapter,
  google_search_console: unavailableAdapter("google_search_console", "Google Search Console", ["search_console"]),
  google_analytics: unavailableAdapter("google_analytics", "Google Analytics", ["analytics", "forms", "phone", "custom"]),
  plausible: unavailableAdapter("plausible", "Plausible", ["analytics", "custom"]),
  uptime: unavailableAdapter("uptime", "Uptime monitor", ["uptime", "errors"], false),
  core_web_vitals: unavailableAdapter("core_web_vitals", "Core Web Vitals", ["performance"], false),
  custom: unavailableAdapter("custom", "Custom analytics source", ["custom"]),
}

export function analyticsAdapterFor(provider: AnalyticsProviderId) {
  return ANALYTICS_PROVIDER_ADAPTERS[provider]
}
