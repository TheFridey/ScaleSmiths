"use client"

import { useEffect, useState } from "react"
import {
  ANALYTICS_OPT_OUT_COOKIE,
  ANALYTICS_SENT_KEY,
  ANALYTICS_SESSION_KEY,
  hasAnalyticsOptOut,
} from "@/lib/experience-analytics-client"
import {
  EXPERIENCE_EXPERIMENT_COOKIE,
  EXPERIENCE_EXPERIMENT_ID_COOKIE,
  EXPERIENCE_PREFERENCE_COOKIE,
} from "@/lib/experience-experiment"

const YEAR = 60 * 60 * 24 * 365

export function PrivacyStorageControls() {
  const [analyticsDisabled, setAnalyticsDisabled] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    setAnalyticsDisabled(hasAnalyticsOptOut())
  }, [])

  function setAnalyticsPreference(disabled: boolean) {
    if (disabled) {
      writeCookie(ANALYTICS_OPT_OUT_COOKIE, "1", YEAR)
      removeCookie(EXPERIENCE_EXPERIMENT_COOKIE)
      removeCookie(EXPERIENCE_EXPERIMENT_ID_COOKIE)
      safeStorageRemove("session", ANALYTICS_SESSION_KEY)
      safeStorageRemove("session", ANALYTICS_SENT_KEY)
      setMessage("Experience analytics is now off on this browser.")
    } else {
      removeCookie(ANALYTICS_OPT_OUT_COOKIE)
      setMessage("Experience analytics may now run in its privacy-minimised form on this browser.")
    }
    setAnalyticsDisabled(disabled)
  }

  function clearFunctionalPreferences() {
    safeStorageRemove("local", "scalesmiths.experience")
    safeStorageRemove("local", "scalesmiths.v2.industry")
    removeCookie(EXPERIENCE_PREFERENCE_COOKIE)
    setMessage("Saved experience and industry choices were cleared from this browser.")
  }

  return (
    <div className="rounded-xl border border-b1 bg-s1 p-5" aria-labelledby="storage-controls-heading">
      <h3 id="storage-controls-heading" className="font-syne text-lg font-bold text-t1">Your storage choices</h3>
      <p className="mt-2 text-sm text-t2">
        Experience analytics is {analyticsDisabled ? "off" : "on"} for this browser. Global Privacy Control and Do Not Track also stop analytics automatically.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn-primary font-dm text-sm" onClick={() => setAnalyticsPreference(!analyticsDisabled)}>
          {analyticsDisabled ? "Turn on experience analytics" : "Turn off experience analytics"}
        </button>
        <button type="button" className="rounded-lg border border-b2 px-4 py-2 font-dm text-sm text-t2 hover:text-t1" onClick={clearFunctionalPreferences}>
          Clear saved experience choices
        </button>
      </div>
      <p className="mt-3 min-h-5 text-xs text-t3" role="status" aria-live="polite">{message}</p>
    </div>
  )
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
}

function removeCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
}

function safeStorageRemove(storage: "local" | "session", key: string) {
  try {
    window[storage === "local" ? "localStorage" : "sessionStorage"].removeItem(key)
  } catch {
    // Storage restrictions must not prevent the visible preference controls working.
  }
}
