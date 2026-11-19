"use client"

import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"

export function PartnerApplicationForm({ privacyVersion, retentionDays }: { privacyVersion: string; retentionDays: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [complete, setComplete] = useState(false)
  const result = useRef<HTMLDivElement>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError("")
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/partner-applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form), privacyAcknowledged: form.get("privacyAcknowledged") === "on" }) })
      const body = await response.json()
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "We could not save your application.")
      setComplete(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again later.") }
    finally { setBusy(false); requestAnimationFrame(() => result.current?.focus()) }
  }

  if (complete) return <div ref={result} tabIndex={-1} role="status" className="rounded-2xl border border-[#c8aa6e]/50 bg-s1 p-8"><p className="text-sm uppercase tracking-widest text-[#dbc18e]">Application received</p><h3 className="mt-3 font-syne text-3xl font-bold">Thank you for introducing yourself.</h3><p className="mt-4 max-w-xl leading-relaxed text-t2">Your application has been saved for the ScaleSmiths founders to review. Applying does not create an account, confirm acceptance or authorise you to represent ScaleSmiths. We will contact you using the details you provided if we would like to discuss the next step.</p></div>

  const inputClass = "field-control mt-2"
  return <form onSubmit={submit} className="mt-8 grid gap-6" aria-describedby="partner-privacy-note">
    <input name="privacyVersion" type="hidden" value={privacyVersion} />
    <p className="text-sm text-t2">Fields marked * are required. Please leave out sensitive personal information and confidential details about third parties.</p>
    <div className="grid gap-6 sm:grid-cols-2">
      <label className="text-sm font-medium">Full name *<input name="name" required minLength={2} maxLength={120} autoComplete="name" className={inputClass} /></label>
      <label className="text-sm font-medium">Email *<input name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} /></label>
      <label className="text-sm font-medium">Telephone <span className="text-t3">(optional)</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} /></label>
      <label className="text-sm font-medium">Region *<input name="region" required minLength={2} maxLength={120} autoComplete="address-level1" className={inputClass} /></label>
    </div>
    <label className="text-sm font-medium">Relevant commercial experience *<textarea name="experience" required minLength={10} maxLength={2000} rows={4} className={inputClass} /></label>
    <label className="text-sm font-medium">Current independent business activity <span className="text-t3">(optional)</span><textarea name="businessActivity" maxLength={1000} rows={2} className={inputClass} /></label>
    <div className="grid gap-6 sm:grid-cols-2">
      <label className="text-sm font-medium">Professional networks <span className="text-t3">(optional)</span><textarea name="networks" maxLength={1000} rows={3} className={inputClass} /></label>
      <label className="text-sm font-medium">Industries you know <span className="text-t3">(optional)</span><textarea name="industries" maxLength={500} rows={3} className={inputClass} /></label>
    </div>
    <label className="text-sm font-medium">Why would you like to join? *<textarea name="motivation" required minLength={10} maxLength={2000} rows={4} className={inputClass} /></label>
    <label className="text-sm font-medium">LinkedIn profile <span className="text-t3">(optional)</span><input name="linkedin" type="url" maxLength={300} placeholder="https://www.linkedin.com/in/…" className={inputClass} /></label>
    <div className="hidden" aria-hidden="true"><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label></div>
    <div id="partner-privacy-note" className="rounded-xl border border-b1 bg-s1 p-5 text-sm leading-relaxed text-t2"><p>ScaleSmiths Ltd uses these details to assess your application and contact you about the independent partner programme. Access is restricted to authorised staff. Unsuccessful or withdrawn applications are retained for up to {retentionDays} days under the applicant retention process; an accepted application may form part of your partner record.</p><p className="mt-3">Read our <Link href="/legal/privacy" className="underline underline-offset-4">privacy information</Link> for your rights and contact details. Applicant notice version: {privacyVersion}. You can ask about access, correction or deletion at <a href="mailto:hello@scalesmiths.co.uk" className="underline underline-offset-4">hello@scalesmiths.co.uk</a>. Do not provide bank details or identity documents here.</p></div>
    <label className="flex items-start gap-3 text-sm leading-relaxed text-t2"><input name="privacyAcknowledged" type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-[#c8aa6e]" /><span>I have read the applicant privacy information and understand this is an application for an independent, commission-only commercial arrangement. *</span></label>
    <div ref={result} tabIndex={-1} role={error ? "alert" : undefined}>{error && <p className="rounded-lg border border-red-400/50 p-4 text-sm text-red-200">{error}</p>}</div>
    <button type="submit" disabled={busy} className="min-h-12 justify-self-start rounded-xl bg-[#c8aa6e] px-7 py-4 font-semibold text-black hover:bg-[#dbc18e] disabled:opacity-60">{busy ? "Saving application…" : "Send my application"}</button>
  </form>
}
