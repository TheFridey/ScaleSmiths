import { NextRequest, NextResponse } from "next/server"
import {
  EXPERIENCE_EXPERIMENT_COOKIE,
  EXPERIENCE_EXPERIMENT_HEADER,
  EXPERIENCE_EXPERIMENT_ID_COOKIE,
  EXPERIENCE_PREFERENCE_COOKIE,
  assignExperienceVariant,
  normalizeStoredPreference,
  resolveExperienceExperimentConfig,
} from "@/lib/experience-experiment"

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set("x-pathname", request.nextUrl.pathname)
  let experimentId: string | null = null
  let variantToPersist: string | null = null

  if (request.nextUrl.pathname === "/") {
    const config = resolveExperienceExperimentConfig()
    if (isLikelyCrawler(request.headers.get("user-agent"))) {
      headers.set(EXPERIENCE_EXPERIMENT_HEADER, config.defaultVariant)
      return NextResponse.next({ request: { headers } })
    }

    experimentId = request.cookies.get(EXPERIENCE_EXPERIMENT_ID_COOKIE)?.value ?? crypto.randomUUID()
    const preference = normalizeStoredPreference(request.cookies.get(EXPERIENCE_PREFERENCE_COOKIE)?.value)
    const variant = assignExperienceVariant({
      experimentId,
      existingVariant: request.cookies.get(EXPERIENCE_EXPERIMENT_COOKIE)?.value,
      preference,
      enabled: config.enabled,
      defaultVariant: config.defaultVariant,
      weights: config.weights,
    })

    headers.set(EXPERIENCE_EXPERIMENT_HEADER, variant)
    variantToPersist = variant
  }

  const response = NextResponse.next({ request: { headers } })

  if (experimentId && variantToPersist) {
    response.cookies.set(EXPERIENCE_EXPERIMENT_ID_COOKIE, experimentId, experimentCookieOptions())
    response.cookies.set(EXPERIENCE_EXPERIMENT_COOKIE, variantToPersist, experimentCookieOptions())
    response.headers.set("Vary", appendVary(response.headers.get("Vary"), "Cookie"))
  }

  return response
}

function isLikelyCrawler(userAgent: string | null) {
  return /\b(bot|crawler|spider|slurp|duckduckbot|bingpreview|facebookexternalhit|linkedinbot|whatsapp|telegrambot)\b/i.test(userAgent ?? "")
}

export const config = {
  matcher: ["/", "/portal/:path*"],
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

function appendVary(current: string | null, value: string) {
  if (!current) return value
  const parts = current.split(",").map((part) => part.trim().toLowerCase())
  return parts.includes(value.toLowerCase()) ? current : `${current}, ${value}`
}
