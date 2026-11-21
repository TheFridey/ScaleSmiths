"use client"

import { useCallback, useEffect, useState } from "react"
import { AcademyShell, type PartnerNav } from "@/components/empower/AcademyShell"
import { SafeMarkdown } from "@/components/empower/SafeMarkdown"

type Issued = { versionId: string; version: number; title: string; body: string; sha256: string; publishedAt: string }
type Overview = {
  issued: Issued | null
  issuedCurrent: boolean
  accepted: { acceptanceId: string; versionId: string; version: number; title: string; sha256: string; acceptedAt: string; signatoryName: string } | null
  pending: boolean
  history: { acceptanceId: string; version: number; title: string; acceptedAt: string; method: string }[]
}
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC"

export function PartnerAgreement({ nav }: { nav: PartnerNav }) {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const load = useCallback(async () => {
    setError("")
    try {
      const response = await fetch("/api/partner/agreement", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Your agreement could not be loaded.")
      setData(body)
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Your agreement could not be loaded.") }
  }, [])
  useEffect(() => { void load() }, [load])

  async function accept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data?.issued) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch("/api/partner/agreement", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: form.get("accepted") === "on", signatoryName: form.get("signatoryName"), versionId: data.issued.versionId, sha256: data.issued.sha256 }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Your acceptance could not be recorded.")
      setMessage("Thank you. Your acceptance of the new version is recorded.")
      await load()
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Your acceptance could not be recorded.") }
    finally { setBusy(false) }
  }

  return <AcademyShell current="agreement" nav={nav}>
    <header className="ac-page-head"><p className="ac-overline">Your partnership</p><h1>Partner agreement</h1>
      <p>The agreement you accepted with ScaleSmiths, any updated version awaiting your acceptance, and downloadable copies.</p></header>
    {error && <div className="ac-callout ac-callout-error" role="alert"><p>{error}</p><button type="button" className="ac-link" onClick={() => void load()}>Try again</button></div>}
    {message && <p className="ac-callout" role="status">{message}</p>}
    {!data && !error && <div className="ac-skeleton" aria-busy="true" aria-label="Loading your agreement"><span /><span /><span /></div>}
    {data && <>
      <section className="ac-card" aria-labelledby="current-heading">
        <h2 id="current-heading">Current status</h2>
        {data.accepted
          ? <p>You accepted <strong>{data.accepted.title}</strong>, version {data.accepted.version}, on {when(data.accepted.acceptedAt)} as {data.accepted.signatoryName}.</p>
          : <p>No accepted agreement is on record. Contact ScaleSmiths.</p>}
        {data.pending && data.issued && <p className="ac-callout"><strong>Action needed:</strong> ScaleSmiths has issued version {data.issued.version}. Read it below and accept it to keep your records current.</p>}
        {!data.pending && data.issued && !data.issuedCurrent && <p className="ac-callout">The version issued to you is being updated by ScaleSmiths. You will be asked to review the new version when it is published.</p>}
        {data.accepted && <p><a className="ac-button-secondary" href={`/api/partner/agreement?download=${data.accepted.acceptanceId}`} download>Download what you accepted</a></p>}
      </section>

      {data.pending && data.issued && <section className="ac-card" aria-labelledby="new-heading">
        <h2 id="new-heading">{data.issued.title} · version {data.issued.version}</h2>
        <p className="ac-meta">Published {data.issued.publishedAt.slice(0, 10)} · fingerprint <code title="SHA-256 of the agreement text">{data.issued.sha256.slice(0, 16)}…</code></p>
        <div className="ac-document" role="region" aria-label="Agreement text" tabIndex={0}><SafeMarkdown source={data.issued.body} /></div>
        <form onSubmit={accept} className="ac-form">
          <fieldset disabled={busy}>
            <legend className="sr-only">Accept the updated agreement</legend>
            <label htmlFor="signatory">Your full legal name</label>
            <input id="signatory" name="signatoryName" autoComplete="name" minLength={2} maxLength={120} required />
            <label className="ac-check"><input type="checkbox" name="accepted" required /><span>I have read this version in full and I accept it.</span></label>
            <button className="ac-button" type="submit">{busy ? "Recording…" : "Accept this version"}</button>
          </fieldset>
          <p className="ac-small">This records your acceptance in the ScaleSmiths partner portal. It is not a qualified electronic signature. If anything is unclear, contact ScaleSmiths before accepting.</p>
        </form>
      </section>}

      <section className="ac-card" aria-labelledby="history-heading">
        <h2 id="history-heading">Acceptance history</h2>
        {data.history.length ? <ul className="ac-history">{data.history.map((h) => <li key={h.acceptanceId}>
          <span><strong>{h.title}</strong> · version {h.version} · {when(h.acceptedAt)} · {h.method === "activation" ? "on activation" : "updated version"}</span>
          <a href={`/api/partner/agreement?download=${h.acceptanceId}`} download aria-label={`Download version ${h.version}`}>Download</a></li>)}</ul>
          : <p>No acceptances recorded.</p>}
      </section>
    </>}
  </AcademyShell>
}
