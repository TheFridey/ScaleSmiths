# Client-site analytics ingestion

ScaleSmiths admin now has a provider-neutral analytics ingestion foundation for launched client websites. It stores per-client source configuration and daily minimised metric rollups; it does not install or imply any public tracking beacon.

## Principles

- Per-client configuration and consent are mandatory before ingestion is enabled.
- Provider credentials are encrypted server-side and are never returned to the browser.
- Stored metrics are daily aggregates only.
- Source attribution is required for every connection and metric row.
- Missing sources are shown as missing, not inferred.
- Provider adapters are pluggable; the platform is not tied to one analytics vendor.
- No cross-client analytics query should omit `clientId`.

## Supported metric fields

- Sessions
- Conversion events
- Form submissions
- Phone clicks
- CTA clicks
- Search impressions
- Search clicks
- Core Web Vitals: LCP, INP, CLS
- Error count
- Uptime checks and failures

## Provider adapters

Adapters live behind the server-side analytics adapter interface. Current adapters are:

- `manual`: imports explicitly supplied daily metrics.
- `google_search_console`: adapter placeholder, safe no-op until credentials/API implementation is added.
- `google_analytics`: adapter placeholder, safe no-op until credentials/API implementation is added.
- `plausible`: adapter placeholder.
- `uptime`: adapter placeholder.
- `core_web_vitals`: adapter placeholder.
- `custom`: adapter placeholder.

No adapter requires an unknown third-party tracking beacon. If a future provider needs client-side collection, it must be reviewed as a separate explicit client-site implementation with consent.

## RBAC

- `analytics.read`: view analytics dashboards and API summaries.
- `analytics.write`: create/update analytics connections and run ingestion.

## Environment

Set `ANALYTICS_CREDENTIAL_ENCRYPTION_KEY` in production. It must encode exactly 32 bytes as base64 or 64 hexadecimal characters.

## Migration

Run the normal Drizzle migration flow. This stage adds:

- `analytics_provider`
- `analytics_metric_source`
- `client_analytics_configs`
- `client_analytics_daily_metrics`
- `client_analytics_audit_logs`

## Retention

Each connection has a configurable `retentionDays` value. The schema stores the policy; scheduled pruning can be added by deleting `client_analytics_daily_metrics` rows older than the connection’s retention window.
