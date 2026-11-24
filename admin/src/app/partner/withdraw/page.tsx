"use client"

import { useEffect, useRef, useState } from "react"
import { Logo } from "@/components/Logo"
import "../activate/activate.css"

/* Operation EMPOWER B2.10: applicant self-withdrawal. Identity is proven by a one-time link sent to the application's email address. */
const withdrawalToken = () => new URLSearchParams(window.location.hash.slice(1)).get("token")

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/partner/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "This service is unavailable. Try again later.")
  return data as Record<string, unknown>
}

export default function ApplicationWithdrawalPage() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [submittedOn, setSubmittedOn] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [done, setDone] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const t = withdrawalToken(); setToken(t); setReady(true)
    if (t) post({ action: "preview", token: t }).then((d) => setSubmittedOn(String(d.submittedOn))).catch((e) => setError(e instanceof Error ? e.message : "This link is invalid."))
  }, [])
  useEffect(() => { headingRef.current?.focus() }, [token, done, notice])

  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError("")
    try { setNotice(String((await post({ action: "request", email: new FormData(event.currentTarget).get("email") })).message)) }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This service is unavailable.") }
    finally { setBusy(false) }
  }
  async function confirm() {
    setBusy(true); setError("")
    try { await post({ action: "confirm", token }); history.replaceState(null, "", window.location.pathname); setDone(true) }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This service is unavailable.") }
    finally { setBusy(false) }
  }

  return <main className="activate">
    <section className="activate-card" aria-labelledby="withdraw-heading">
      <Logo size={44} />
      <p className="activate-overline">Independent partner network</p>
      {!ready ? <p role="status">Loading…</p> : done ? <>
        <h1 id="withdraw-heading" ref={headingRef} tabIndex={-1}>Your application has been withdrawn.</h1>
        <p>Thank you for your interest in ScaleSmiths. We will not progress your application. Your record is kept for the period stated in the applicant privacy notice and then deleted.</p>
        <p className="activate-small">You are welcome to apply again in future at scalesmiths.co.uk/partners.</p>
      </> : token ? <>
        <h1 id="withdraw-heading" ref={headingRef} tabIndex={-1}>Withdraw your application?</h1>
        {submittedOn ? <p>This withdraws the partner application you submitted on {new Date(submittedOn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. ScaleSmiths will stop reviewing it, and any invitation already sent will no longer work.</p> : null}
        {error ? <p role="alert" className="activate-error">{error}</p> : null}
        {submittedOn ? <button type="button" className="activate-button" onClick={confirm} disabled={busy}>{busy ? "Withdrawing…" : "Withdraw my application"}</button> : null}
      </> : notice ? <>
        <h1 id="withdraw-heading" ref={headingRef} tabIndex={-1}>Check your email.</h1>
        <p role="status">{notice}</p>
        <p className="activate-small">Nothing changes until you use the link in that email.</p>
      </> : <>
        <h1 id="withdraw-heading" ref={headingRef} tabIndex={-1}>Withdraw your partner application.</h1>
        <p>Enter the email address you applied with. We will send a secure link to confirm the withdrawal; nothing changes until you use it.</p>
        <form onSubmit={requestLink} className="activate-form">
          <label htmlFor="withdraw-email">Email address</label>
          <input id="withdraw-email" name="email" type="email" autoComplete="email" maxLength={254} required />
          {error ? <p role="alert" className="activate-error">{error}</p> : null}
          <button type="submit" className="activate-button" disabled={busy}>{busy ? "Sending…" : "Send confirmation link"}</button>
        </form>
      </>}
    </section>
  </main>
}
