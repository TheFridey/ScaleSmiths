/**
 * Privacy-minimised acquisition context stored with an enquiry.
 * Paths stay on this site. External referrers keep the hostname only.
 * Campaign labels are the three UTM fields already present on the link.
 */

export const ENQUIRY_ATTRIBUTION_STORAGE_KEY = "scalesmiths.enquiry.attribution"

export interface EnquiryAttribution {
  landingPath: string | null
  submissionPath: string | null
  referrerHost: string | null
  referrerPath: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

export const EMPTY_ENQUIRY_ATTRIBUTION: EnquiryAttribution = {
  landingPath: null,
  submissionPath: null,
  referrerHost: null,
  referrerPath: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
}

const MAX_PATH = 240
const MAX_UTM = 80
const SENSITIVE_QUERY = /email|phone|token|secret|password|session|auth/i

export function sanitizeEnquiryAttribution(input: unknown, siteHost = ""): EnquiryAttribution {
  if (!input || typeof input !== "object") return { ...EMPTY_ENQUIRY_ATTRIBUTION }
  const record = input as Record<string, unknown>
  const referrerHost = sanitizeHost(record.referrerHost)
  const sameSite = Boolean(referrerHost && isSameSiteHost(referrerHost, siteHost))
  const utmSource = sanitizeUtm(record.utmSource)
  const utmMedium = sanitizeUtm(record.utmMedium)
  const utmCampaign = sanitizeUtm(record.utmCampaign)
  return {
    landingPath: sanitizePublicPath(record.landingPath),
    submissionPath: sanitizePublicPath(record.submissionPath),
    referrerHost,
    referrerPath: sameSite ? sanitizePublicPath(record.referrerPath) : null,
    utmSource,
    utmMedium,
    utmCampaign,
  }
}

export function attributionFromLocation(pageUrl: string, referrer: string, siteHost: string): EnquiryAttribution {
  let page: URL
  let previous: URL | null = null
  try {
    page = new URL(pageUrl)
  } catch {
    return { ...EMPTY_ENQUIRY_ATTRIBUTION }
  }
  try {
    if (referrer) previous = new URL(referrer)
  } catch {
    previous = null
  }
  const referrerHost = previous ? sanitizeHost(previous.hostname) : null
  const sameSite = Boolean(referrerHost && isSameSiteHost(referrerHost, siteHost))
  return sanitizeEnquiryAttribution({
    submissionPath: `${page.pathname}${page.search}`,
    referrerHost,
    referrerPath: sameSite && previous ? `${previous.pathname}${previous.search}` : null,
    utmSource: page.searchParams.get("utm_source"),
    utmMedium: page.searchParams.get("utm_medium"),
    utmCampaign: page.searchParams.get("utm_campaign"),
  }, siteHost)
}

export function mergeEnquiryAttribution(firstTouch: EnquiryAttribution | null, current: EnquiryAttribution, siteHost: string): EnquiryAttribution {
  return sanitizeEnquiryAttribution({
    landingPath: firstTouch?.landingPath ?? null,
    submissionPath: current.submissionPath,
    referrerHost: firstTouch?.referrerHost ?? current.referrerHost,
    referrerPath: firstTouch?.referrerPath ?? current.referrerPath,
    utmSource: current.utmSource ?? firstTouch?.utmSource ?? null,
    utmMedium: current.utmMedium ?? firstTouch?.utmMedium ?? null,
    utmCampaign: current.utmCampaign ?? firstTouch?.utmCampaign ?? null,
  }, siteHost)
}

export function sanitizePublicPath(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return null
  let url: URL
  try {
    url = new URL(trimmed, "https://scalesmiths.invalid")
  } catch {
    return null
  }
  if (url.username || url.password || url.pathname.includes("@") || url.origin !== "https://scalesmiths.invalid") return null
  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY.test(key)) url.searchParams.delete(key)
  }
  const path = `${url.pathname}${url.search}`
  return path.slice(0, MAX_PATH)
}

function sanitizeUtm(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, MAX_UTM)
  if (!/^[A-Za-z0-9 ._+~-]{1,80}$/.test(trimmed)) return null
  return trimmed
}

function sanitizeHost(value: unknown): string | null {
  if (typeof value !== "string") return null
  const host = value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.startsWith(".") || host.endsWith(".")) return null
  return host
}

function isSameSiteHost(referrerHost: string, siteHost: string) {
  const host = referrerHost.toLowerCase()
  const configured = siteHost.toLowerCase().replace(/:\d+$/, "")
  const allowed = new Set(["scalesmiths.co.uk", "www.scalesmiths.co.uk", "localhost", "127.0.0.1"])
  if (configured) allowed.add(configured)
  return allowed.has(host)
}
