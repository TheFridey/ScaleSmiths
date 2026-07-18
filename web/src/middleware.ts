import { NextRequest, NextResponse } from "next/server"
import {
  EXPERIENCE_EXPERIMENT_COOKIE,
  EXPERIENCE_EXPERIMENT_HEADER,
  EXPERIENCE_EXPERIMENT_ID_COOKIE,
  EXPERIENCE_PREFERENCE_COOKIE,
  EXPERIENCE_PREFERENCE_HEADER,
  assignExperienceVariant,
  normalizeStoredPreference,
  resolveExperienceExperimentConfig,
} from "@/lib/experience-experiment"
import {
  CRAWLER_HOMEPAGE_VARIANT,
  EXPERIENCE_QUERY_PARAMETER,
  isRecognizedCrawler,
  normalizeExperienceQuery,
  traditionalHomepageRedirectUrl,
} from "@/lib/experience-routing"
import { shouldRespectPrivacyOptOut } from "@/lib/experience-analytics"
import { normalizeRequestId, REQUEST_ID_HEADER } from "@/lib/request-correlation"

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  const requestId = normalizeRequestId(request.headers.get(REQUEST_ID_HEADER))
  headers.set(REQUEST_ID_HEADER, requestId)
  headers.set("x-pathname", request.nextUrl.pathname)
  let experimentId: string | null = null
  let variantToPersist: string | null = null
  let clearExperimentCookies = false
  const correlated = <T extends NextResponse>(response: T) => {
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }

  if (request.nextUrl.pathname === "/traditional") {
    return correlated(NextResponse.redirect(traditionalHomepageRedirectUrl(request.nextUrl), 308))
  }

  if (request.nextUrl.pathname === "/") {
    const config = resolveExperienceExperimentConfig()
    if (isRecognizedCrawler(request.headers.get("user-agent"))) {
      headers.set(EXPERIENCE_EXPERIMENT_HEADER, CRAWLER_HOMEPAGE_VARIANT)
      return homeResponse(correlated(NextResponse.next({ request: { headers } })))
    }

    const preference = normalizeStoredPreference(request.cookies.get(EXPERIENCE_PREFERENCE_COOKIE)?.value)
    const requestedPreference = normalizeExperienceQuery(request.nextUrl.searchParams.get(EXPERIENCE_QUERY_PARAMETER))
    const effectivePreference = requestedPreference ?? preference
    if (effectivePreference) headers.set(EXPERIENCE_PREFERENCE_HEADER, effectivePreference)
    const privacyOptOut = shouldRespectPrivacyOptOut(request.headers)
    let variant = requestedPreference
      ? CRAWLER_HOMEPAGE_VARIANT
      : effectivePreference
        ? "returning_preference"
        : config.defaultVariant

    clearExperimentCookies = (!config.enabled || privacyOptOut) && Boolean(
      request.cookies.get(EXPERIENCE_EXPERIMENT_ID_COOKIE) || request.cookies.get(EXPERIENCE_EXPERIMENT_COOKIE),
    )

    if (config.enabled && !privacyOptOut) {
      experimentId = request.cookies.get(EXPERIENCE_EXPERIMENT_ID_COOKIE)?.value ?? crypto.randomUUID()
      variant = assignExperienceVariant({
        experimentId,
        existingVariant: request.cookies.get(EXPERIENCE_EXPERIMENT_COOKIE)?.value,
        preference: effectivePreference,
        enabled: true,
        defaultVariant: config.defaultVariant,
        weights: config.weights,
      })
      variantToPersist = variant
    }

    headers.set(EXPERIENCE_EXPERIMENT_HEADER, variant)
  }

  const response = correlated(NextResponse.next({ request: { headers } }))

  if (experimentId && variantToPersist) {
    response.cookies.set(EXPERIENCE_EXPERIMENT_ID_COOKIE, experimentId, experimentCookieOptions())
    response.cookies.set(EXPERIENCE_EXPERIMENT_COOKIE, variantToPersist, experimentCookieOptions())
    response.headers.set("Vary", appendVary(response.headers.get("Vary"), "Cookie"))
  }

  if (clearExperimentCookies) {
    response.cookies.set(EXPERIENCE_EXPERIMENT_ID_COOKIE, "", { ...experimentCookieOptions(), maxAge: 0 })
    response.cookies.set(EXPERIENCE_EXPERIMENT_COOKIE, "", { ...experimentCookieOptions(), maxAge: 0 })
    response.headers.set("Vary", appendVary(response.headers.get("Vary"), "Cookie"))
  }

  if (request.nextUrl.pathname === "/" && normalizeExperienceQuery(request.nextUrl.searchParams.get(EXPERIENCE_QUERY_PARAMETER))) {
    response.cookies.set(EXPERIENCE_PREFERENCE_COOKIE, "normal", preferenceCookieOptions())
  }

  return request.nextUrl.pathname === "/" ? homeResponse(response) : response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

function experimentCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  }
}

function preferenceCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  }
}

function homeResponse<T extends NextResponse>(response: T) {
  response.headers.set("Vary", appendVary(appendVary(response.headers.get("Vary"), "User-Agent"), "Cookie"))
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function appendVary(current: string | null, value: string) {
  if (!current) return value
  const parts = current.split(",").map((part) => part.trim().toLowerCase())
  return parts.includes(value.toLowerCase()) ? current : `${current}, ${value}`
}
