import { DEFAULT_SITE_URL } from "./site-identity"
import type { ExperienceExperimentVariant, StoredExperiencePreference } from "./experience-experiment"

export const CRAWLER_HOMEPAGE_VARIANT: ExperienceExperimentVariant = "normal_with_interactive_cta"
export const EXPERIENCE_QUERY_PARAMETER = "experience"
export const NORMAL_EXPERIENCE_QUERY_VALUE: StoredExperiencePreference = "normal"

const SEARCH_CRAWLER_PATTERN = /\b(?:googlebot|google-inspectiontool|bingbot|bingpreview|duckduckbot|applebot|yandexbot|baiduspider|slurp)\b/i
const GENERAL_CRAWLER_PATTERN = /\b(?:bot|crawler|spider)\b/i

// Host-nginx publish ports from scripts/release-manager.mjs. Next.js nextUrl uses this
// loopback origin behind the reverse proxy; it must never appear in a client Location.
const HOST_NGINX_WEB_PORTS = new Set(["3100", "3200"])

export function isRecognizedCrawler(userAgent: string | null | undefined) {
  const value = userAgent ?? ""
  return SEARCH_CRAWLER_PATTERN.test(value) || GENERAL_CRAWLER_PATTERN.test(value)
}

export function normalizeExperienceQuery(value: string | null | undefined): StoredExperiencePreference | null {
  return value === NORMAL_EXPERIENCE_QUERY_VALUE ? NORMAL_EXPERIENCE_QUERY_VALUE : null
}

/**
 * Path and query for the legacy `/traditional` alias. Kept root-relative so the
 * destination is host-independent; `NextResponse.redirect()` still needs an
 * absolute URL (Next.js middleware's NextURL parser throws on relative Location).
 */
export function traditionalHomepageRedirectLocation() {
  return `/?${EXPERIENCE_QUERY_PARAMETER}=${NORMAL_EXPERIENCE_QUERY_VALUE}`
}

export function traditionalHomepageRedirectUrl(
  request: { nextUrl: URL; headers: Headers },
  env: NodeJS.Dict<string | undefined> = process.env,
) {
  return new URL(traditionalHomepageRedirectLocation(), resolvePublicRedirectOrigin(request, env))
}

/**
 * Origin for same-app redirects. `request.nextUrl.origin` is the Next.js listen
 * address (in production, the host-nginx loopback publish host
 * `https://localhost:3100`), not the public site. Prefer the nginx-overwritten
 * Host header. Never trust `x-forwarded-host`: the public proxy does not
 * overwrite it, so a client could inject an open redirect.
 */
export function resolvePublicRedirectOrigin(
  request: { nextUrl: URL; headers: Headers },
  env: NodeJS.Dict<string | undefined> = process.env,
) {
  const proto = requestProtocol(request)
  const hostHeader = firstHeaderValue(request.headers.get("host"))

  if (hostHeader) {
    if (isHostNginxPublishAddress(hostHeader, request.nextUrl.port)) {
      return configuredPublicOrigin(env)
    }
    return `${proto}://${hostHeader}`
  }

  if (isHostNginxPublishAddress(request.nextUrl.host, request.nextUrl.port)) {
    return configuredPublicOrigin(env)
  }

  return request.nextUrl.origin
}

function requestProtocol(request: { nextUrl: URL; headers: Headers }) {
  const forwarded = firstHeaderValue(request.headers.get("x-forwarded-proto"))
  if (forwarded === "http" || forwarded === "https") return forwarded
  return request.nextUrl.protocol === "http:" ? "http" : "https"
}

function configuredPublicOrigin(env: NodeJS.Dict<string | undefined>) {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "")
  if (configured) {
    try {
      const url = new URL(configured)
      if ((url.protocol === "http:" || url.protocol === "https:") && !isLoopbackHostname(url.hostname)) {
        return url.origin
      }
    } catch {
      // Invalid config must not leak into Location; fall through to the default public origin.
    }
  }
  return DEFAULT_SITE_URL
}

function isHostNginxPublishAddress(host: string, fallbackPort: string) {
  const port = portOf(host) || fallbackPort
  return Boolean(port && HOST_NGINX_WEB_PORTS.has(port) && isLoopbackHostname(hostnameOf(host)))
}

function firstHeaderValue(value: string | null | undefined) {
  const first = value?.split(",")[0]?.trim()
  return first || null
}

function hostnameOf(host: string) {
  if (host.startsWith("[")) {
    const end = host.indexOf("]")
    return end === -1 ? host : host.slice(1, end)
  }
  return host.split(":")[0] ?? host
}

function portOf(host: string) {
  if (host.startsWith("[")) {
    const marker = host.lastIndexOf("]:")
    return marker === -1 ? null : host.slice(marker + 2) || null
  }
  const separator = host.lastIndexOf(":")
  if (separator <= 0) return null
  return host.slice(separator + 1) || null
}

function isLoopbackHostname(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0" || host.endsWith(".localhost")
}
