"use client"

import Script from "next/script"
import { useEffect } from "react"
import { COOKIE_CONSENT_COOKIE, COOKIE_POLICY_VERSION, type CookiePreferences } from "@/lib/cookie-consent"

/**
 * GA4 measurement ID. Configured through the environment so a different property can be used per
 * deployment, and so a preview or fork does not report into the production property. The current
 * production ID remains the default, because removing it would silently stop measurement on an
 * existing deployment that has not yet set the variable.
 *
 * Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=""` to disable Google Analytics entirely; the component then
 * renders nothing and no Google script is requested.
 */
export const GOOGLE_ANALYTICS_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-24NM2GTZ0C"

const PREFERENCES_CHANGED_EVENT = "scalesmiths:cookie-preferences-changed"

type GoogleWindow = Window & {
  dataLayer?: unknown[][]
  gtag?: (...args: unknown[]) => void
} & Record<string, unknown>

/** gtag's opt-out flag is a window property named after the measurement ID. */
const disableFlag = (id: string) => `ga-disable-${id}`

export function GoogleAnalytics() {
  const measurementId = GOOGLE_ANALYTICS_ID

  useEffect(() => {
    if (!measurementId) return
    applyAnalyticsPreference(measurementId, readAnalyticsConsent())
    const onChange = (event: Event) =>
      applyAnalyticsPreference(measurementId, Boolean((event as CustomEvent<CookiePreferences>).detail?.analytics))
    window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange)
  }, [measurementId])

  if (!measurementId) return null

  return <>
    <Script id="google-analytics">
      {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', { analytics_storage: 'denied' });
gtag('js', new Date());`}
    </Script>
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
      onLoad={() => applyAnalyticsPreference(measurementId, readAnalyticsConsent())}
    />
  </>
}

function applyAnalyticsPreference(measurementId: string, analytics: boolean) {
  const googleWindow = window as unknown as GoogleWindow
  googleWindow[disableFlag(measurementId)] = !analytics

  if (googleWindow.gtag) {
    googleWindow.gtag("consent", "update", { analytics_storage: analytics ? "granted" : "denied" })
    if (analytics) googleWindow.gtag("config", measurementId)
  }
  if (!analytics) removeGoogleAnalyticsCookies()
}

function readAnalyticsConsent() {
  const raw = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`))?.split("=").slice(1).join("=")
  if (!raw) return false
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<CookiePreferences>
    return value.version === COOKIE_POLICY_VERSION && value.analytics === true
  } catch {
    return false
  }
}

function removeGoogleAnalyticsCookies() {
  const parentDomain = location.hostname.split(".").slice(-2).join(".")
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (name === "_ga" || name?.startsWith("_ga_")) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
      if (parentDomain.includes(".")) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${parentDomain}; SameSite=Lax`
    }
  }
}
