"use client"

import Script from "next/script"
import { useEffect } from "react"
import { COOKIE_CONSENT_COOKIE, COOKIE_POLICY_VERSION, type CookiePreferences } from "@/lib/cookie-consent"

export const GOOGLE_ANALYTICS_ID = "G-24NM2GTZ0C"
const PREFERENCES_CHANGED_EVENT = "scalesmiths:cookie-preferences-changed"

type GoogleWindow = Window & {
  dataLayer?: unknown[][]
  gtag?: (...args: unknown[]) => void
  "ga-disable-G-24NM2GTZ0C"?: boolean
}

export function GoogleAnalytics() {
  useEffect(() => {
    applyAnalyticsPreference(readAnalyticsConsent())
    const onChange = (event: Event) => applyAnalyticsPreference(Boolean((event as CustomEvent<CookiePreferences>).detail?.analytics))
    window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange)
  }, [])

  return <>
    <Script id="google-analytics">
      {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', { analytics_storage: 'denied' });
gtag('js', new Date());`}
    </Script>
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
      strategy="afterInteractive"
      onLoad={() => applyAnalyticsPreference(readAnalyticsConsent())}
    />
  </>
}

function applyAnalyticsPreference(analytics: boolean) {
  const googleWindow = window as GoogleWindow
  googleWindow["ga-disable-G-24NM2GTZ0C"] = !analytics

  if (googleWindow.gtag) {
    googleWindow.gtag("consent", "update", { analytics_storage: analytics ? "granted" : "denied" })
    if (analytics) googleWindow.gtag("config", GOOGLE_ANALYTICS_ID)
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
