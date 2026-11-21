"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/Logo"
import { SafeMarkdown } from "@/components/empower/SafeMarkdown"
import "./activate.css"

type Agreement = { versionId: string; slug: string; version: number; title: string; body: string; sha256: string; publishedAt: string; reviewBy: string }
type Step = "start" | "read" | "done"

// The invitation lives in the URL fragment: it never reaches server access logs or referrers.
const invitationToken = () => new URLSearchParams(window.location.hash.slice(1)).get("token")

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/partner/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Activation is unavailable. Try again later.")
  return data
}

export default function PartnerActivationPage() {
  const [step, setStep] = useState<Step>("start")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [readToEnd, setReadToEnd] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus() }, [step])
  // Acceptance unlocks once the end of the agreement has been on screen; keyboard and screen-reader users reach it by reading on.
  useEffect(() => {
    if (step !== "read" || !endRef.current) return
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setReadToEnd(true) }, { threshold: 0.5 })
    observer.observe(endRef.current)
    return () => observer.disconnect()
  }, [step, agreement])

  async function openAgreement() {
    setBusy(true); setError("")
    try {
      const data = await post({ action: "preview", token: invitationToken() })
      setAgreement(data.agreement as Agreement); setReadToEnd(false); setStep("read")
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Activation is unavailable.") }
    finally { setBusy(false) }
  }

  async function activate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!agreement) return
    const form = new FormData(event.currentTarget)
    if (form.get("password") !== form.get("confirmPassword")) { setError("The two passwords do not match."); return }
    setBusy(true); setError("")
    try {
      await post({ token: invitationToken(), password: form.get("password"), acceptance: { accepted: form.get("accepted") === "on", signatoryName: form.get("signatoryName"), versionId: agreement.versionId, sha256: agreement.sha256 } })
      window.history.replaceState(null, "", "/partner/activate")
      setStep("done")
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Activation is unavailable.") }
    finally { setBusy(false) }
  }

  return <main className="activate">
    <section className={step === "read" ? "activate-card activate-card-wide" : "activate-card"} aria-labelledby="activate-heading">
      <Logo size={44} />
      <p className="activate-overline">Independent partner network</p>
      <ol className="activate-progress" aria-label="Activation steps">
        {["Your invitation", "Read and accept the agreement", "Account active"].map((label, i) => {
          const current = ["start", "read", "done"].indexOf(step)
          return <li key={label} data-state={i < current ? "done" : i === current ? "current" : "todo"} aria-current={i === current ? "step" : undefined}>{label}</li>
        })}
      </ol>

      {step === "start" && <>
        <h1 id="activate-heading" ref={headingRef} tabIndex={-1}>Welcome to ScaleSmiths.</h1>
        <p>Your application has been approved by the ScaleSmiths founders. To activate your partner account, read the partner agreement issued to you, accept it, and set a password.</p>
        <ul className="activate-facts">
          <li>Your invitation link works once and expires 48 hours after it was issued.</li>
          <li>Your acceptance is recorded with the agreement version, a fingerprint of its exact text and the time.</li>
          <li>You can download a copy of what you accepted from your partner portal at any time.</li>
        </ul>
        {error ? <p role="alert" className="activate-error">{error}</p> : null}
        <button type="button" className="activate-button" onClick={openAgreement} disabled={busy}>{busy ? "Opening…" : "Read the partner agreement"}</button>
      </>}

      {step === "read" && agreement && <>
        <h1 id="activate-heading" ref={headingRef} tabIndex={-1}>{agreement.title}</h1>
        <p className="activate-meta">Version {agreement.version} · published {agreement.publishedAt.slice(0, 10)} · fingerprint <code title="SHA-256 of the agreement text">{agreement.sha256.slice(0, 16)}…</code></p>
        <div className="activate-document" role="region" aria-label="Agreement text" tabIndex={0}>
          <SafeMarkdown source={agreement.body} className="activate-markdown" />
          <div ref={endRef} className="activate-end">End of agreement</div>
        </div>
        <form onSubmit={activate} className="activate-form" noValidate={false}>
          {!readToEnd ? <p className="activate-hint" role="status">Scroll to the end of the agreement to continue.</p> : null}
          <fieldset disabled={!readToEnd || busy}>
            <legend className="sr-only">Accept the agreement and set your password</legend>
            <label htmlFor="signatory">Your full legal name</label>
            <input id="signatory" name="signatoryName" autoComplete="name" minLength={2} maxLength={120} required />
            <label className="activate-check"><input type="checkbox" name="accepted" required /><span>I have read this agreement in full and I accept it.</span></label>
            <label htmlFor="partner-password">New password</label>
            <input id="partner-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required aria-describedby="password-hint" />
            <p id="password-hint" className="activate-hint">At least 12 characters; at most 72 UTF-8 bytes.</p>
            <label htmlFor="partner-password-confirm">Confirm password</label>
            <input id="partner-password-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
            {error ? <p role="alert" className="activate-error">{error}</p> : null}
            <button className="activate-button" type="submit">{busy ? "Activating…" : "Accept and activate my account"}</button>
          </fieldset>
          <p className="activate-small">This records your acceptance in the ScaleSmiths partner portal. It is not a qualified electronic signature. If anything in the agreement is unclear, do not accept it yet: reply to the person who invited you.</p>
        </form>
      </>}

      {step === "done" && <div role="status">
        <h1 id="activate-heading" ref={headingRef} tabIndex={-1}>Your partner account is active.</h1>
        <p>Sign in with the email address your invitation was sent to and your new password. Your portal shows your next steps, the agreement you accepted and how to submit your first introduction.</p>
        <Link href="/login" className="activate-button">Continue to sign in</Link>
      </div>}
    </section>
  </main>
}
