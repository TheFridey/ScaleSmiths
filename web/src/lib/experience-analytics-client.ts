"use client"

import type { ExperienceDeviceClass, ExperienceEventName, ExperiencePreferenceValue } from "./experience-analytics"
import { EXPERIENCE_EXPERIMENT_COOKIE } from "./experience-experiment"

const SESSION_KEY = "scalesmiths.analytics.session"
const SENT_KEY = "scalesmiths.analytics.sent"

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
  if (alreadySent(eventKey)) return

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
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/experience-events", new Blob([body], { type: "application/json" }))
    return
  }

  void fetch("/api/experience-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

export function trackQuoteCta(target = "/quote") {
  trackExperienceEvent("quote_cta_clicked", { metadata: { target } })
}

function shouldSkipAnalytics() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string }
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1"
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const next = `sess_${crypto.randomUUID()}`
    window.sessionStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`
  }
}

function alreadySent(eventKey: string) {
  try {
    const sent = new Set(JSON.parse(window.sessionStorage.getItem(SENT_KEY) ?? "[]") as string[])
    if (sent.has(eventKey)) return true
    sent.add(eventKey)
    window.sessionStorage.setItem(SENT_KEY, JSON.stringify(Array.from(sent).slice(-80)))
    return false
  } catch {
    return false
  }
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
