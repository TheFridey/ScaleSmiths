"use client"

import type { ExperienceDeviceClass, ExperienceEventName, ExperiencePreferenceValue } from "./experience-analytics"
import { EXPERIENCE_EXPERIMENT_COOKIE } from "./experience-experiment"
import { readCookiePreferences } from "./cookie-consent"

export const ANALYTICS_SESSION_KEY = "scalesmiths.analytics.session"
export const ANALYTICS_SENT_KEY = "scalesmiths.analytics.sent"
export const ANALYTICS_OPT_OUT_COOKIE = "ss_analytics_opt_out"

const EXPERIENCE_EVENTS_ENDPOINT = "/api/experience-events"
const inFlightEventKeys = new Set<string>()

type TrackInput = {
  preference?: ExperiencePreferenceValue
  returningPreference?: boolean
  fromExperience?: ExperiencePreferenceValue | null
  toExperience?: ExperiencePreferenceValue | null
  interactiveStep?: string | null
  completionDepth?: number | null
  errorCategory?: string | null
  metadata?: Record<string, unknown>
}

export function trackExperienceEvent(eventName: ExperienceEventName, input: TrackInput = {}) {
  if (typeof window === "undefined" || shouldSkipAnalytics()) return

  const sessionId = getSessionId()
  const eventKey = `${sessionId}:${eventName}:${input.interactiveStep ?? ""}:${input.toExperience ?? ""}:${input.metadata?.target ?? ""}`
  if (inFlightEventKeys.has(eventKey) || alreadySent(eventKey)) return

  const metadata = { variant: readCookie(EXPERIENCE_EXPERIMENT_COOKIE), ...input.metadata }
  const payload = {
    eventName,
    eventKey,
    sessionId,
    path: window.location.pathname,
    deviceClass: deviceClass(),
    preference: input.preference ?? readPreference(),
    returningPreference: input.returningPreference ?? false,
    fromExperience: input.fromExperience ?? null,
    toExperience: input.toExperience ?? null,
    interactiveStep: input.interactiveStep ?? null,
    completionDepth: input.completionDepth ?? null,
    referrer: document.referrer || null,
    campaign: campaignAttribution(),
    errorCategory: input.errorCategory ?? null,
    metadata,
  }

  const body = JSON.stringify(payload)
  // A true sendBeacon() result means the browser queued the request, not that the server stored it.
  if (queueBeacon(body)) {
    markSent(eventKey)
    return
  }

  sendWithFetch(eventKey, body)
}

export function trackQuoteCta(target = "/quote") {
  trackExperienceEvent("quote_cta_clicked", { metadata: { target } })
}

export function hasAnalyticsOptOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string }
  const consent = readCookiePreferences(document.cookie)
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || readCookie(ANALYTICS_OPT_OUT_COOKIE) === "1" || !consent?.analytics
}

function shouldSkipAnalytics() {
  return hasAnalyticsOptOut()
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY)
    if (existing) return existing
    const next = `sess_${crypto.randomUUID()}`
    window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, next)
    return next
  } catch {
    return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`
  }
}

function queueBeacon(body: string) {
  try {
    if (typeof navigator.sendBeacon !== "function") return false
    return navigator.sendBeacon(EXPERIENCE_EVENTS_ENDPOINT, new Blob([body], { type: "application/json" }))
  } catch {
    return false
  }
}

function sendWithFetch(eventKey: string, body: string) {
  inFlightEventKeys.add(eventKey)
  const release = () => { inFlightEventKeys.delete(eventKey) }
  try {
    void fetch(EXPERIENCE_EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    })
      .then((response) => { if (isFinalResponse(response.status)) markSent(eventKey) })
      .catch(() => undefined)
      .finally(release)
  } catch {
    release()
  }
}

// Client errors other than timeout/rate limiting will fail identically on resend.
function isFinalResponse(status: number) {
  return status >= 200 && status < 500 && status !== 408 && status !== 429
}

function alreadySent(eventKey: string) {
  try {
    return readSentKeys().includes(eventKey)
  } catch {
    return false
  }
}

function markSent(eventKey: string) {
  try {
    const sent = new Set(readSentKeys())
    sent.add(eventKey)
    window.sessionStorage.setItem(ANALYTICS_SENT_KEY, JSON.stringify(Array.from(sent).slice(-80)))
  } catch {
    // Storage may be unavailable (private mode, quota); the server de-duplicates on eventKey.
  }
}

function readSentKeys() {
  return JSON.parse(window.sessionStorage.getItem(ANALYTICS_SENT_KEY) ?? "[]") as string[]
}

function readPreference(): ExperiencePreferenceValue {
  try {
    const value = window.localStorage.getItem("scalesmiths.experience")
    return value === "normal" || value === "interactive" ? value : "none"
  } catch {
    return "unknown"
  }
}

function deviceClass(): ExperienceDeviceClass {
  const width = window.innerWidth
  if (!Number.isFinite(width)) return "unknown"
  if (width < 768) return "mobile"
  if (width < 1024) return "tablet"
  return "desktop"
}

function campaignAttribution() {
  const params = new URLSearchParams(window.location.search)
  return {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    name: params.get("utm_campaign"),
  }
}

function readCookie(name: string) {
  try {
    const prefix = `${name}=`
    const match = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix))
    return match ? decodeURIComponent(match.slice(prefix.length)) : undefined
  } catch {
    return undefined
  }
}
