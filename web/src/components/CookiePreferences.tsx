"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_MAX_AGE, COOKIE_POLICY_VERSION, defaultCookiePreferences, type CookiePreferences } from "@/lib/cookie-consent"
import { ANALYTICS_OPT_OUT_COOKIE, ANALYTICS_SENT_KEY, ANALYTICS_SESSION_KEY } from "@/lib/experience-analytics-client"

const OPEN_EVENT = "scalesmiths:open-cookie-settings"

export function CookiePreferences() {
  const [open, setOpen] = useState(false)
  const [manage, setManage] = useState(false)
  const [preferences, setPreferences] = useState(defaultCookiePreferences)

  useEffect(() => {
    const existing = readPreferences()
    if (existing) setPreferences(existing)
    else setOpen(true)
    const show = () => { setManage(true); setOpen(true) }
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  function save(next: Omit<CookiePreferences, "version" | "decidedAt">) {
    const value: CookiePreferences = { ...next, version: COOKIE_POLICY_VERSION, decidedAt: new Date().toISOString() }
    writeCookie(COOKIE_CONSENT_COOKIE, JSON.stringify(value), COOKIE_CONSENT_MAX_AGE)
    if (value.analytics) removeCookie(ANALYTICS_OPT_OUT_COOKIE)
    else {
      writeCookie(ANALYTICS_OPT_OUT_COOKIE, "1", 60 * 60 * 24 * 365)
      safeRemove("sessionStorage", ANALYTICS_SESSION_KEY)
      safeRemove("sessionStorage", ANALYTICS_SENT_KEY)
      removeCookie("ss_exp_id")
      removeCookie("ss_exp_variant")
    }
    if (!value.functional) {
      safeRemove("localStorage", "scalesmiths.experience")
      safeRemove("localStorage", "scalesmiths.v2.industry")
      removeCookie("ss_experience_preference")
    }
    setPreferences(value)
    setOpen(false)
    setManage(false)
    window.dispatchEvent(new CustomEvent("scalesmiths:cookie-preferences-changed", { detail: value }))
  }

  if (!open) return null
  return <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-6">
    <section role="dialog" aria-modal="false" aria-labelledby="cookie-heading" className="pointer-events-auto mx-auto w-full max-w-[760px] rounded-2xl border border-b2 bg-bg p-5 shadow-2xl sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Privacy choices</p>
      <h2 id="cookie-heading" className="mt-2 font-syne text-2xl font-bold">Cookies and browser storage</h2>
      <p className="mt-3 text-sm leading-relaxed text-t2">Necessary storage keeps requested services secure and remembers this choice. Functional and analytics storage are optional and remain off until you choose them. ScaleSmiths does not use advertising trackers.</p>
      {manage && <div className="mt-5 space-y-3 border-y border-b1 py-5">
        <Preference label="Strictly necessary" description="Portal security and remembering this privacy choice." checked disabled onChange={() => undefined} />
        <Preference label="Functional" description="Remember experience and industry choices you make." checked={preferences.functional} onChange={(functional) => setPreferences((current) => ({ ...current, functional }))} />
        <Preference label="Analytics" description="First-party journey statistics and Google Analytics website measurement. No advertising trackers." checked={preferences.analytics} onChange={(analytics) => setPreferences((current) => ({ ...current, analytics }))} />
      </div>}
      <p className="mt-4 text-xs leading-relaxed text-t3">Read the <Link href="/legal/cookies" className="underline underline-offset-2 hover:text-t1">Cookie Policy</Link>. You can change this choice later using Cookie Settings in the footer.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button type="button" className="rounded-lg border border-b2 px-4 py-3 text-sm font-semibold text-t1 hover:border-acc" onClick={() => save({ functional: false, analytics: false, marketing: false })}>Reject non-essential</button>
        {manage ? <button type="button" className="rounded-lg border border-b2 px-4 py-3 text-sm font-semibold text-t1 hover:border-acc" onClick={() => save({ functional: preferences.functional, analytics: preferences.analytics, marketing: false })}>Save preferences</button> : <button type="button" className="rounded-lg border border-b2 px-4 py-3 text-sm font-semibold text-t1 hover:border-acc" onClick={() => setManage(true)}>Manage preferences</button>}
        <button type="button" className="btn-primary min-h-11 justify-center" onClick={() => save({ functional: true, analytics: true, marketing: false })}>Accept all</button>
      </div>
    </section>
  </div>
}

export function openCookieSettings() { window.dispatchEvent(new Event(OPEN_EVENT)) }

function Preference({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-start justify-between gap-5"><span><strong className="block text-sm text-t1">{label}</strong><span className="mt-1 block text-xs leading-relaxed text-t3">{description}</span></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 accent-[var(--acc)]" /></label>
}
function readPreferences() { const raw = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`))?.split("=").slice(1).join("="); if (!raw) return null; try { const value = JSON.parse(decodeURIComponent(raw)) as CookiePreferences; return value.version === COOKIE_POLICY_VERSION ? value : null } catch { return null } }
function writeCookie(name: string, value: string, maxAge: number) { document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}` }
function removeCookie(name: string) { document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax` }
function safeRemove(storage: "localStorage" | "sessionStorage", key: string) { try { window[storage].removeItem(key) } catch { /* locked-down storage */ } }
