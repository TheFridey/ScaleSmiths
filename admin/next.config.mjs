import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production"

// This admin app lives in a monorepo (ScaleSmiths root + web app + generated-sites).
// Pin the file-tracing root to THIS app so `next build` does not walk the parent tree
// (web/, .git/, generated-sites/, root node_modules). Tracing the whole monorepo makes the
// trace/copy stall on unrelated or locked files (e.g. a generated-site preview holding
// handles), which is what makes the build hang after page-data collection instead of exiting.
const appDir = dirname(fileURLToPath(import.meta.url))

// `output: "standalone"` copies node_modules into .next/standalone. That copy is what the
// production Docker image needs, but on a local dev machine (especially Windows, where each
// copied file is scanned synchronously) it adds a long, stalling I/O tail so `next build`
// appears to hang and is slow to exit. The Linux Docker build sets NEXT_OUTPUT_STANDALONE=1
// to opt in; a plain local `npm run build` skips the copy and exits cleanly. No routes,
// features, or runtime behaviour change either way.
const enableStandalone = process.env.NEXT_OUTPUT_STANDALONE === "1"

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://cloudflareinsights.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
]

const nextConfig = {
  ...(enableStandalone ? { output: "standalone" } : {}),
  outputFileTracingRoot: appDir,
  outputFileTracingExcludes: {
    "*": [
      "../generated-sites/**",
      "../web/**",
      "../.git/**",
    ],
  },
  // Optional Forge visual-QA tooling. These are resolved at runtime via createRequire only when
  // installed; marking them external stops webpack from trying to bundle/resolve them at build time.
  serverExternalPackages: ["lighthouse", "chrome-launcher", "playwright"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
