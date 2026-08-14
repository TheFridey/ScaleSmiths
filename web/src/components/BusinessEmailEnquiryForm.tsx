"use client"

import { FormEvent, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { EnquiryConsent } from "./EnquiryConsent"
import Link from "next/link"
import { LEGAL_VERSION } from "@/lib/legal"

const providers = ["None", "Microsoft 365", "Google Workspace", "Existing hosting/email provider", "Other"]
const domainProviders = ["Cloudflare", "GoDaddy", "IONOS", "123 Reg", "Namecheap", "Squarespace", "Other", "Not sure"]

type FormState = {
  business: string
  name: string
  email: string
  domain: string
  ownsDomain: string
  currentProvider: string
  migration: string
  domainProvider: string
  mailbox1: string
  mailbox2: string
  mailbox3: string
  notes: string
  consent: boolean
  termsAccepted: boolean
  website: string
}

const initialState: FormState = {
  business: "", name: "", email: "", domain: "", ownsDomain: "", currentProvider: "", migration: "", domainProvider: "",
  mailbox1: "", mailbox2: "", mailbox3: "", notes: "", consent: false, termsAccepted: false, website: "",
}

export function BusinessEmailEnquiryForm() {
  const [form, setForm] = useState(initialState)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const router = useRouter()

  const update = (key: keyof FormState, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    if (!form.business || !form.name || !form.email || !form.domain || !form.ownsDomain || !form.currentProvider || !form.migration || !form.domainProvider || !form.mailbox1 || !form.mailbox2 || !form.mailbox3 || !form.consent || !form.termsAccepted) {
      setError("Please complete the required fields before sending your enquiry.")
      return
    }
    inFlight.current = true
    setSubmitting(true)
    setError("")
    const mailboxSummary = [form.mailbox1, form.mailbox2, form.mailbox3].map((value) => value.trim()).join(", ")
    const brief = [
      `Domain: ${form.domain}`,
      `Domain owned: ${form.ownsDomain}`,
      `Current email provider: ${form.currentProvider}`,
      `Migration required: ${form.migration}`,
      `DNS/registrar provider: ${form.domainProvider}`,
      `Preferred mailbox names: ${mailboxSummary}`,
      `Additional requirements: ${form.notes || "None provided"}`,
      `Business authority and legal terms version ${LEGAL_VERSION} accepted for onboarding: Yes`,
    ].join("\n")
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          biz: form.business,
          websiteUrl: `https://${form.domain.replace(/^https?:\/\//, "")}`,
          goal: `Set up Managed Business Email for ${form.domain}`,
          brief,
          funnelType: "business_email",
          intent: "business_email",
          consent: form.consent,
          website: form.website,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to send your enquiry.")
      router.push("/services/managed-business-email/thanks")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send your enquiry.")
      inFlight.current = false
      setSubmitting(false)
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-b2 bg-s2 px-4 py-3 text-base text-t1 outline-none transition-colors focus:border-acc focus-visible:ring-2 focus-visible:ring-acc"
  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      {error && <div role="alert" className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-t1">{error}</div>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" required><input value={form.business} onChange={(e) => update("business", e.target.value)} autoComplete="organization" className={inputClass} required /></Field>
        <Field label="Contact name" required><input value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" className={inputClass} required /></Field>
        <Field label="Contact email" required><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" className={inputClass} required /></Field>
        <Field label="Business domain" hint="For example: yourbusiness.co.uk" required><input value={form.domain} onChange={(e) => update("domain", e.target.value)} inputMode="url" autoComplete="url" className={inputClass} required /></Field>
      </div>
      <Choice label="Do you already own the domain?" name="owns-domain" value={form.ownsDomain} values={["Yes", "No"]} update={(value) => update("ownsDomain", value)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Select label="Current email provider" value={form.currentProvider} values={providers} update={(value) => update("currentProvider", value)} />
        <Select label="Who manages your domain?" value={form.domainProvider} values={domainProviders} update={(value) => update("domainProvider", value)} />
      </div>
      <Choice label="Do you need existing email migrated?" name="migration" value={form.migration} values={["Yes", "No", "Not sure"]} update={(value) => update("migration", value)} />
      <fieldset>
        <legend className="font-syne text-lg font-bold">Choose your three mailbox names</legend>
        <p className="mt-1 text-sm text-t3">Enter the part before @, such as hello, rhys or accounts.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["mailbox1", "mailbox2", "mailbox3"] as const).map((key, index) => <label key={key} className="text-sm text-t2">Mailbox {index + 1}<input value={form[key]} onChange={(e) => update(key, e.target.value)} className={inputClass} required /></label>)}
        </div>
      </fieldset>
      <Field label="Additional requirements" hint="Optional. Do not include passwords, payment-card details or other secrets."><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} className={`${inputClass} resize-y`} /></Field>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={(e) => update("website", e.target.value)} />
      <EnquiryConsent id="business-email-consent" checked={form.consent} onChange={(value) => update("consent", value)} />
      <label className="flex items-start gap-3 rounded-xl border border-b1 bg-s1 p-4 text-sm leading-relaxed text-t2"><input type="checkbox" required checked={form.termsAccepted} onChange={(event) => update("termsAccepted", event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--acc)]" /><span>I confirm that I am authorised to make this request wholly or mainly for a business and agree that any confirmed order is governed by the <Link href="/legal/service-terms" className="underline underline-offset-2">Service Terms</Link>, <Link href="/legal/email-terms" className="underline underline-offset-2">Managed Business Email Terms</Link>, <Link href="/legal/acceptable-use" className="underline underline-offset-2">Acceptable Use Policy</Link> and <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Notice</Link>. <span className="text-acc">*</span></span></label>
      <div className="rounded-xl border border-acc/20 bg-acc/[.05] p-4 text-sm leading-relaxed text-t2">
        We only ask who manages your domain at this stage. Never enter a registrar, DNS or email password in this form. Appropriate secure access is arranged during onboarding.
      </div>
      <button type="submit" disabled={submitting} aria-busy={submitting} className="btn-primary min-h-12 disabled:cursor-wait disabled:opacity-60">
        {submitting ? "Sending securely…" : "Send email setup enquiry"} <ArrowRight size={16} aria-hidden="true" />
      </button>
    </form>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-sm text-t2">{label}{required && <span className="text-acc"> *</span>}{children}{hint && <span className="mt-1 block text-xs text-t3">{hint}</span>}</label>
}

function Choice({ label, name, value, values, update }: { label: string; name: string; value: string; values: string[]; update: (value: string) => void }) {
  return <fieldset><legend className="mb-3 text-sm text-t2">{label} <span className="text-acc">*</span></legend><div className="flex flex-wrap gap-2">{values.map((item) => <label key={item} className={`cursor-pointer rounded-xl border px-5 py-3 text-sm transition-colors ${value === item ? "border-acc bg-acc/10 text-t1" : "border-b2 bg-s2 text-t2 hover:border-acc/50"}`}><input className="mr-2 accent-[var(--acc)]" type="radio" name={name} checked={value === item} onChange={() => update(item)} />{item}</label>)}</div></fieldset>
}

function Select({ label, value, values, update }: { label: string; value: string; values: string[]; update: (value: string) => void }) {
  return <label className="text-sm text-t2">{label} <span className="text-acc">*</span><select value={value} onChange={(e) => update(e.target.value)} required className="mt-2 w-full rounded-xl border border-b2 bg-s2 px-4 py-3 text-base text-t1 outline-none focus:border-acc focus-visible:ring-2 focus-visible:ring-acc"><option value="">Select one</option>{values.map((item) => <option key={item}>{item}</option>)}</select></label>
}
