"use client"

import { FormEvent, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { EnquiryConsent } from "./EnquiryConsent"
import { LEGAL_VERSION } from "@/lib/legal"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"

type AuditForm = Record<string, string> & { consent: string; terms: string; websiteTrap: string }
const initial: AuditForm = { business: "", name: "", email: "", website: "", location: "", industry: "", offer: "", idealCustomer: "", discovery: "", working: "", friction: "", leadProcess: "", operations: "", tools: "", goal: "", notes: "", consent: "", terms: "", websiteTrap: "" }
const goals = ["More enquiries", "Higher-value clients", "More bookings or sales", "Improved efficiency", "Stronger digital presence", "Better systems", "Other"]

export function BusinessGrowthAuditForm() {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const started = useRef(false)
  const inFlight = useRef(false)
  const router = useRouter()
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const acquisitionSource = () => {
    if (typeof window === "undefined") return "audit_intake"
    const source = new URLSearchParams(window.location.search).get("source")
    return source === "local_growth_check" || source === "quote" || source === "homepage" ? source : "audit_intake"
  }
  const markStarted = () => { if (started.current) return; started.current = true; trackExperienceEvent("quote_form_started", { metadata: { funnelType: "business_growth_audit", source: acquisitionSource() } }) }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    const required = ["business", "name", "email", "website", "location", "industry", "offer", "idealCustomer", "discovery", "friction", "leadProcess", "operations", "goal", "consent", "terms"]
    if (required.some((key) => !form[key]?.trim())) { setError("Please complete the required fields before sending your Audit request."); return }
    inFlight.current = true; setSubmitting(true); setError("")
    const brief = [
      `Location / service area: ${form.location}`, `Industry: ${form.industry}`, `What the business sells: ${form.offer}`, `Ideal customer: ${form.idealCustomer}`,
      `How customers find the business: ${form.discovery}`, `What is working: ${form.working || "Not provided"}`, `What is not working / biggest frustration: ${form.friction}`,
      `Current enquiry and follow-up process: ${form.leadProcess}`, `Time-consuming operations / automation opportunities: ${form.operations}`, `Current tools: ${form.tools || "Not provided"}`,
      `6–12 month goal: ${form.goal}`, `Additional context: ${form.notes || "Not provided"}`, `Acquisition source: ${acquisitionSource()}`, `B2B authority and legal terms version ${LEGAL_VERSION} accepted for Audit onboarding: Yes`,
    ].join("\n\n")
    try {
      const response = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, biz: form.business, websiteUrl: form.website, businessType: form.industry, goal: form.friction, brief, funnelType: "business_growth_audit", intent: "business_growth_audit", consent: form.consent === "yes", website: form.websiteTrap }) })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to send your Audit request.")
      trackExperienceEvent("quote_form_submitted", { metadata: { funnelType: "business_growth_audit", source: acquisitionSource() } })
      router.push("/services/business-growth-audit/thanks")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send your Audit request."); inFlight.current = false; setSubmitting(false) }
  }

  return <form onSubmit={submit} onFocusCapture={markStarted} noValidate className="space-y-10">
    {error && <div role="alert" className="rounded-xl border border-red/30 bg-red/10 p-4 text-sm">{error}</div>}
    <FormSection number="01" title="Business details"><div className="grid gap-5 sm:grid-cols-2"><Field label="Business name" value={form.business} update={(v) => update("business", v)} autoComplete="organization" /><Field label="Contact name" value={form.name} update={(v) => update("name", v)} autoComplete="name" /><Field label="Contact email" value={form.email} update={(v) => update("email", v)} type="email" autoComplete="email" /><Field label="Website or primary digital presence" value={form.website} update={(v) => update("website", v)} type="url" autoComplete="url" /><Field label="Location or service area" value={form.location} update={(v) => update("location", v)} /><Field label="Industry" value={form.industry} update={(v) => update("industry", v)} /></div></FormSection>
    <FormSection number="02" title="Business context"><Area label="What does the business sell?" value={form.offer} update={(v) => update("offer", v)} /><Area label="Who is the ideal customer?" value={form.idealCustomer} update={(v) => update("idealCustomer", v)} /><Area label="How do most customers currently find you?" value={form.discovery} update={(v) => update("discovery", v)} /><Area label="What is working well?" value={form.working} update={(v) => update("working", v)} optional /><Area label="What feels like it is not working, or is the biggest growth frustration?" value={form.friction} update={(v) => update("friction", v)} /></FormSection>
    <FormSection number="03" title="Leads and operations"><Area label="How do enquiries arrive, and what happens next?" value={form.leadProcess} update={(v) => update("leadProcess", v)} /><Area label="Which repetitive processes consume the most time?" value={form.operations} update={(v) => update("operations", v)} /><Area label="Which tools or software does the business rely on?" value={form.tools} update={(v) => update("tools", v)} optional /></FormSection>
    <FormSection number="04" title="Goals"><fieldset><legend className="mb-3 text-sm text-t2">Primary goal over the next 6–12 months <span className="text-acc">*</span></legend><div className="grid gap-2 sm:grid-cols-2">{goals.map((goal) => <label key={goal} className={`cursor-pointer rounded-xl border p-4 text-sm ${form.goal === goal ? "border-acc bg-acc/10 text-t1" : "border-b2 bg-s2 text-t2"}`}><input type="radio" name="goal" value={goal} checked={form.goal === goal} onChange={() => update("goal", goal)} className="mr-2 accent-[var(--acc)]" />{goal}</label>)}</div></fieldset><Area label="Anything else we should understand?" value={form.notes} update={(v) => update("notes", v)} optional /></FormSection>
    <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.websiteTrap} onChange={(e) => update("websiteTrap", e.target.value)} />
    <EnquiryConsent id="audit-consent" checked={form.consent === "yes"} onChange={(checked) => update("consent", checked ? "yes" : "")} />
    <label className="flex items-start gap-3 rounded-xl border border-b1 bg-s1 p-4 text-sm leading-relaxed text-t2"><input type="checkbox" checked={form.terms === "yes"} onChange={(e) => update("terms", e.target.checked ? "yes" : "")} className="mt-1 h-4 w-4 accent-[var(--acc)]" /><span>I confirm this request is wholly or mainly for business purposes, I am authorised to make it, and I agree that a confirmed Audit engagement will be governed by the <Link href="/legal/service-terms" className="underline">Service Terms</Link>, <Link href="/legal/cancellations" className="underline">Cancellation Policy</Link> and <Link href="/legal/privacy" className="underline">Privacy Notice</Link>. <span className="text-acc">*</span></span></label>
    <p className="rounded-xl border border-acc/20 bg-acc/[.05] p-4 text-sm leading-relaxed text-t2">Do not submit passwords, hosting or DNS credentials, payment-card details, social-media passwords or API secrets. If deeper access is needed, ScaleSmiths will arrange an appropriate secure route after the engagement is confirmed.</p>
    <button type="submit" disabled={submitting} aria-busy={submitting} className="btn-primary min-h-12 disabled:opacity-60">{submitting ? "Sending securely…" : "Send my Audit request"}<ArrowRight size={16} /></button>
  </form>
}

function FormSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <fieldset className="space-y-5"><legend className="mb-3 flex items-center gap-3 font-syne text-2xl font-bold"><span className="text-xs text-acc">{number}</span>{title}</legend>{children}</fieldset> }
const control = "mt-2 w-full rounded-xl border border-b2 bg-s2 px-4 py-3 text-base text-t1 outline-none focus:border-acc focus-visible:ring-2 focus-visible:ring-acc"
function Field({ label, value, update, type = "text", autoComplete = "off" }: { label: string; value: string; update: (v: string) => void; type?: string; autoComplete?: string }) { return <label className="text-sm text-t2">{label} <span className="text-acc">*</span><input type={type} value={value} onChange={(e) => update(e.target.value)} autoComplete={autoComplete} required className={control} /></label> }
function Area({ label, value, update, optional }: { label: string; value: string; update: (v: string) => void; optional?: boolean }) { return <label className="block text-sm text-t2">{label} {!optional && <span className="text-acc">*</span>}{optional && <span className="text-t3">(optional)</span>}<textarea rows={3} value={value} onChange={(e) => update(e.target.value)} className={`${control} resize-y`} /></label> }
