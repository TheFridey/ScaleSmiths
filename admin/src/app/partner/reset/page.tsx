"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/Logo"
import "../activate/activate.css"

/* Operation EMPOWER B2.10: partner self-service password recovery. The one-time token lives in the URL fragment, never in logs. */
const resetToken = () => new URLSearchParams(window.location.hash.slice(1)).get("token")

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/partner/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Password reset is unavailable. Try again later.")
  return data as Record<string, unknown>
}

export default function PartnerPasswordResetPage() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [done, setDone] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { setToken(resetToken()); setReady(true) }, [])
  useEffect(() => { headingRef.current?.focus() }, [token, done, notice])

  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError("")
    try { setNotice(String((await post({ action: "request", email: new FormData(event.currentTarget).get("email") })).message)) }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Password reset is unavailable.") }
    finally { setBusy(false) }
  }
  async function reset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (form.get("password") !== form.get("confirmPassword")) { setError("The two passwords do not match."); return }
    setBusy(true); setError("")
    try { await post({ action: "reset", token, password: form.get("password") }); history.replaceState(null, "", window.location.pathname); setDone(true) }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Password reset is unavailable.") }
    finally { setBusy(false) }
  }

  return <main className="activate">
    <section className="activate-card" aria-labelledby="reset-heading">
      <Logo size={44} />
      <p className="activate-overline">Independent partner network</p>
      {!ready ? <p role="status">Loading…</p> : done ? <>
        <h1 id="reset-heading" ref={headingRef} tabIndex={-1}>Your password has been changed.</h1>
        <p>You have been signed out on every device. Sign in with your new password.</p>
        <Link className="activate-button" href="/login">Sign in</Link>
      </> : token ? <>
        <h1 id="reset-heading" ref={headingRef} tabIndex={-1}>Choose a new password.</h1>
        <p>Use at least 12 characters. Changing your password signs you out everywhere.</p>
        <form onSubmit={reset} className="activate-form">
          <label htmlFor="reset-password">New password</label>
          <input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
          <label htmlFor="reset-password-confirm">Confirm new password</label>
          <input id="reset-password-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
          {error ? <p role="alert" className="activate-error">{error}</p> : null}
          <button type="submit" className="activate-button" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
        <p className="activate-small"><Link href="/partner/reset" onClick={() => { history.replaceState(null, "", "/partner/reset"); setToken(null) }}>Request a new link</Link></p>
      </> : notice ? <>
        <h1 id="reset-heading" ref={headingRef} tabIndex={-1}>Check your email.</h1>
        <p role="status">{notice}</p>
        <p className="activate-small">No email after a few minutes? Check your spam folder, or contact ScaleSmiths at hello@scalesmiths.co.uk.</p>
        <Link className="activate-button" href="/login">Back to sign in</Link>
      </> : <>
        <h1 id="reset-heading" ref={headingRef} tabIndex={-1}>Reset your password.</h1>
        <p>Enter the email address you use to sign in to the partner portal. We will send you a secure link that works once and expires in one hour.</p>
        <form onSubmit={requestLink} className="activate-form">
          <label htmlFor="reset-email">Email address</label>
          <input id="reset-email" name="email" type="email" autoComplete="email" maxLength={254} required />
          {error ? <p role="alert" className="activate-error">{error}</p> : null}
          <button type="submit" className="activate-button" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
        <p className="activate-small"><Link href="/login">Back to sign in</Link></p>
      </>}
    </section>
  </main>
}
