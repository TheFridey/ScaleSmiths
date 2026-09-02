import { withSentryConfig } from "@sentry/nextjs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production"
const appDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(appDir, "..")

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://cloudflareinsights.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; "),
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
]

// RFC 8288 agent-discovery links. Duplicated from src/lib/agent-discovery.ts because a
// Next config cannot use the TypeScript path alias; agent-discovery.test.ts asserts the
// two stay in step.
const siteOrigin = (process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://scalesmiths.co.uk").replace(/\/+$/, "")
const agentDiscoveryLinkHeader = [
  `<${siteOrigin}/.well-known/api-catalog>; rel="api-catalog"`,
  `<${siteOrigin}/openapi.json>; rel="service-desc"; type="application/json"`,
  `<${siteOrigin}/api/health>; rel="status"`,
  `<${siteOrigin}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
  `<${siteOrigin}/llms.txt>; rel="describedby"; type="text/plain"`,
  `<${siteOrigin}/>; rel="canonical"`,
].join(", ")

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: repositoryRoot,
  transpilePackages: ["@react-three/fiber", "three"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 365,
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // RFC 8288 discovery links. Kept to the homepage and the API surface so the
        // header stays small; every target is a resource this app actually serves.
        source: "/",
        headers: [{ key: "Link", value: agentDiscoveryLinkHeader }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Link", value: agentDiscoveryLinkHeader }],
      },
    ]
  },
};

const sentrySourceMapUploadConfigured = Boolean(
  process.env.SENTRY_AUTH_TOKEN
  && process.env.SENTRY_ORG
  && process.env.SENTRY_WEB_PROJECT
  && process.env.ERROR_MONITORING_RELEASE,
)

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_WEB_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: process.env.ERROR_MONITORING_RELEASE ? { name: process.env.ERROR_MONITORING_RELEASE } : undefined,
  telemetry: false,
  silent: !process.env.CI,
  sourcemaps: sentrySourceMapUploadConfigured
    ? { deleteSourcemapsAfterUpload: true }
    : { disable: true },
  webpack: { treeshake: { removeDebugLogging: true } },
});
