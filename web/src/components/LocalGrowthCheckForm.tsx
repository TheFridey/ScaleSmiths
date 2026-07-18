"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { EnquiryConsent } from "./EnquiryConsent"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"

interface LocalGrowthFormData {
  name: string
  biz: string
  websiteUrl: string
  email: string
  phone: string
  goal: string
  consent: boolean
  website: string
}

const initialForm: LocalGrowthFormData = {
  name: "",
  biz: "",
  websiteUrl: "",
  email: "",
  phone: "",
  goal: "",
  consent: false,
  website: "",
}

export function LocalGrowthCheckForm() {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    trackExperienceEvent("local_growth_check_viewed", { metadata: { funnelType: "local_growth_check" } })
  }, [])

  function markStarted() {
    if (started.current) return
    started.current = true
    trackExperienceEvent("local_growth_check_form_started", { metadata: { funnelType: "local_growth_check" } })
  }

  function update<Key extends keyof LocalGrowthFormData>(key: Key, value: LocalGrowthFormData[Key]) {
    setError("")
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim() || !form.biz.trim() || !form.email.trim() || !form.goal.trim() || !form.consent) {
      setError("Please complete the required fields and confirm consent.")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          funnelType: "local_growth_check",
          leadSource: "local_growth_check",
          intent: "local_growth_check",
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to send your local growth check.")

      trackExperienceEvent("local_growth_check_form_submitted", { metadata: { funnelType: "local_growth_check" } })
      setSubmitted(true)
    } catch (submissionError) {
      trackExperienceEvent("experience_error", { errorCategory: "local_growth_check_submission", metadata: { funnelType: "local_growth_check" } })
      setError(submissionError instanceof Error ? submissionError.message : "Unable to send your local growth check.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section aria-labelledby="growth-check-received" className="rounded-2xl border border-success/30 bg-success/10 p-6 md:p-8">
        <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
        <h2 id="growth-check-received" className="mt-4 font-syne text-2xl font-extrabold">Your details have been received.</h2>
        <p role="status" className="mt-3 max-w-xl font-dm text-sm leading-relaxed text-t2">
          A ScaleSmiths founder will review the public information you shared and your main goal. We will reply with a useful next step, without assuming you need a full website project.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalGrowthFullQuoteLink className="btn-primary font-dm text-sm">Continue to a full quote <ArrowRight size={15} aria-hidden="true" /></LocalGrowthFullQuoteLink>
          <LocalGrowthStrategyCallLink className="btn-ghost font-dm text-sm" />
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} onFocusCapture={markStarted} noValidate className="rounded-2xl border border-b1 bg-s1 p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] md:p-8" aria-describedby="local-growth-form-help">
      <h2 className="font-syne text-2xl font-extrabold">Request your local growth check</h2>
      <p id="local-growth-form-help" className="mt-2 font-dm text-sm leading-relaxed text-t2">One short screen. Required fields are marked with an asterisk.</p>

      {error && <div role="alert" className="mt-5 rounded-lg border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm">{error}</div>}

      <input name="website" value={form.website} onChange={(event) => update("website", event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field id="growth-name" label="Name" required>
          <input id="growth-name" name="name" autoComplete="name" required value={form.name} onChange={(event) => update("name", event.target.value)} className="growth-check-field" />
        </Field>
        <Field id="growth-business" label="Business name" required>
          <input id="growth-business" name="business" autoComplete="organization" required value={form.biz} onChange={(event) => update("biz", event.target.value)} className="growth-check-field" />
        </Field>
      </div>

      <Field id="growth-url" label="Website or social-page URL" optional>
        <input id="growth-url" name="websiteUrl" type="url" inputMode="url" autoComplete="url" placeholder="https://" value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} className="growth-check-field" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="growth-email" label="Email" required>
          <input id="growth-email" name="email" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={(event) => update("email", event.target.value)} className="growth-check-field" />
        </Field>
        <Field id="growth-phone" label="Phone" optional>
          <input id="growth-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} className="growth-check-field" />
        </Field>
      </div>

      <Field id="growth-goal" label="Primary problem or goal" required>
        <textarea id="growth-goal" name="goal" rows={5} required maxLength={1000} placeholder="What is getting in the way of more useful enquiries or growth?" value={form.goal} onChange={(event) => update("goal", event.target.value)} className="growth-check-field resize-y" />
      </Field>

      <EnquiryConsent id="growth-check-consent" checked={form.consent} onChange={(checked) => update("consent", checked)} />

      <button type="submit" disabled={submitting} className="btn-primary mt-5 min-h-12 w-full justify-center font-dm sm:w-auto">
        {submitting ? "Sending..." : "Request My Local Growth Check"} <ArrowRight size={15} aria-hidden="true" />
      </button>
    </form>
  )
}

export function LocalGrowthFullQuoteLink({ className, children }: { className: string; children: ReactNode }) {
  return <Link href="/quote" onClick={() => trackExperienceEvent("local_growth_check_full_quote_selected", { metadata: { target: "/quote", funnelType: "local_growth_check" } })} className={className}>{children}</Link>
}

export function LocalGrowthStrategyCallLink({ className }: { className: string }) {
  return <Link href="/quote?intent=strategy_call" onClick={() => trackExperienceEvent("local_growth_check_strategy_call_requested", { metadata: { target: "/quote?intent=strategy_call", funnelType: "local_growth_check" } })} className={className}>Request a Strategy Call</Link>
}

function Field({ id, label, required, optional, children }: { id: string; label: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="mb-2 block font-dm text-sm font-medium text-t1">
        {label}{required && <span className="text-acc" aria-hidden="true"> *</span>}{optional && <span className="font-normal text-t3"> (optional)</span>}
      </label>
      {children}
    </div>
  )
}
