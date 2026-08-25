"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { EnquiryConsent } from "@/components/EnquiryConsent"
import { AuditAcquisitionLink } from "@/components/AuditAcquisitionLink"
import { formatAuditPrice } from "@/lib/business-growth-audit"
import { enquiryIntentFromLocation } from "@/lib/enquiry-intents"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"
import { motionDistances, motionDurations, motionTransitions } from "@/lib/motion"

const STORAGE_KEY = "scalesmiths.quote.draft.v2"
const STAGES = ["About You", "What Needs Changing", "Commercial Fit", "Brief and Consent"] as const
const BUSINESS_TYPES = ["Local service business", "E-commerce brand", "SaaS / platform", "Professional services", "Community / membership", "Other"]
const PROJECT_TYPES = ["Conversion Website", "Website Redesign", "E-Commerce", "Custom Web App", "SEO / Local Growth", "Digital Growth Partnership"]
const NEEDS = ["SEO", "Hosting", "Digital Growth Partnership", "Custom Functionality", "Payments", "Client Portal", "Analytics", "Not sure"]
const BUDGETS = ["GBP 4,500-6,500", "GBP 8,000-15,000", "GBP 18,000-35,000+", "Ongoing Digital Growth Partnership", "Not sure yet"]
const TIMEFRAMES = ["ASAP, if the fit is right", "4-6 weeks", "8-12 weeks", "This quarter", "Planning ahead"]
const CARE = ["Yes", "Maybe", "No", "Not sure"]
const CONTACT = ["Email", "Phone", "Video call", "No preference"]

type FormData = Record<string, string>

export default function QuotePage() {
  const [stage, setStage] = useState(0)
  const [data, setData] = useState<FormData>({})
  const [restored, setRestored] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [error, setError] = useState("")
  const [invalidField, setInvalidField] = useState<string | null>(null)
  const errorId = useId()
  const errorRef = useRef<HTMLDivElement>(null)
  const submissionInFlight = useRef(false)
  const reducedMotion = useReducedMotion()
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as { stage?: number; data?: FormData } | null
      if (saved?.data) setData(saved.data)
      if (Number.isInteger(saved?.stage)) setStage(Math.max(0, Math.min(3, saved?.stage ?? 0)))
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } finally {
      setRestored(true)
    }
  }, [])

  useEffect(() => {
    if (!restored) return
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stage, data }))
  }, [data, restored, stage])

  useEffect(() => {
    if (!error) return
    const frame = window.requestAnimationFrame(() => errorRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [error])

  useEffect(() => {
    if (!restored) return
    const onPopState = (event: PopStateEvent) => {
      const historicStage = Number((event.state as { quoteStage?: number } | null)?.quoteStage)
      if (Number.isInteger(historicStage)) setStage(Math.max(0, Math.min(3, historicStage)))
    }
    window.history.replaceState({ ...window.history.state, quoteStage: stage }, "")
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [restored, stage])

  function update(key: string, value: string) {
    setError("")
    setInvalidField(null)
    setData((current) => ({ ...current, [key]: value }))
    trackExperienceEvent("quote_form_started", { metadata: { source: "standard_quote", step: key } })
  }

  function selectedNeeds() {
    return data.needs ? data.needs.split("|").filter(Boolean) : []
  }

  function toggleNeed(value: string) {
    const current = selectedNeeds()
    update("needs", (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]).join("|"))
  }

  function validate(current: number) {
    const required: Array<[string, string]> = current === 0
      ? [["name", "full name"], ["email", "email address"], ["biz", "company name"], ["businessType", "business type"]]
      : current === 1
        ? [["type", "project type"], ["goal", "main business goal"], ["needs", "required functionality"]]
        : current === 2
          ? [["budget", "budget"], ["timeframe", "timeframe"], ["carePlanInterest", "care-plan preference"], ["preferredContactMethod", "preferred contact method"]]
          : []
    const missing = required.find(([key]) => !(data[key] ?? "").trim())
    if (missing) {
      setError(`Please add or choose your ${missing[1]}.`)
      setInvalidField(missing[0])
      return false
    }
    if (current === 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email ?? "")) {
      setError("Please add a valid email address.")
      setInvalidField("email")
      return false
    }
    if (current === 3 && data.consent !== "true") {
      setError("Please confirm consent before submitting.")
      setInvalidField("consent")
      return false
    }
    setError("")
    setInvalidField(null)
    return true
  }

  function continueStage() {
    if (!validate(stage)) return
    if (stage === 3) {
      void submitQuote()
      return
    }
    const nextStage = stage + 1
    setDirection(1)
    window.history.pushState({ ...window.history.state, quoteStage: nextStage }, "")
    setStage(nextStage)
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }

  function previousStage() {
    if (stage === 0) {
      window.history.back()
      return
    }
    const nextStage = stage - 1
    setDirection(-1)
    window.history.pushState({ ...window.history.state, quoteStage: nextStage }, "")
    setStage(nextStage)
    setError("")
    setInvalidField(null)
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }

  async function submitQuote() {
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    setSubmitting(true)
    const intent = enquiryIntentFromLocation(window.location.search)
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name ?? "",
          email: data.email ?? "",
          biz: data.biz ?? "",
          websiteUrl: data.websiteUrl ?? "",
          businessType: data.businessType ?? "",
          type: data.type ?? "",
          budget: data.budget ?? "",
          timeframe: data.timeframe ?? "",
          goal: data.goal ?? "",
          needs: selectedNeeds(),
          carePlanInterest: data.carePlanInterest ?? "",
          preferredContactMethod: data.preferredContactMethod ?? "",
          intent,
          consent: data.consent === "true",
          brief: data.brief ?? "",
          website: data.website ?? "",
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to submit your brief.")
      trackExperienceEvent("quote_form_submitted", { metadata: { source: "standard_quote", intent } })
      window.sessionStorage.removeItem(STORAGE_KEY)
      router.push(`/quote/thanks?intent=${encodeURIComponent(intent)}`)
    } catch (caught) {
      trackExperienceEvent("experience_error", { errorCategory: "quote_submission", metadata: { source: "standard_quote", intent } })
      setInvalidField(null)
      setError(caught instanceof Error ? caught.message : "Unable to submit your brief.")
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-[780px] px-6 py-12 md:px-12 md:py-16">
      <button
        type="button"
        onClick={previousStage}
        className="mb-8 inline-flex min-h-10 items-center gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
      >
        <ArrowLeft size={15} aria-hidden="true" /> {stage === 0 ? "Back" : "Previous stage"}
      </button>

      {stage === 0 && (
        <aside className="mb-7 grid gap-3 rounded-xl border border-b1 bg-s1 p-4 font-dm text-sm sm:grid-cols-[1fr_auto] sm:items-center" aria-label="Business Growth Audit alternative">
          <div><strong className="text-t1">Not sure what to fix first?</strong><p className="mt-1 text-t2">Use the Growth Audit if the business needs improving but the right project is not yet clear. Already know what you need? Continue with this project quote.</p></div>
          <div className="sm:text-right"><p className="font-semibold text-acc">Business Growth Audit · {formatAuditPrice()}</p><AuditAcquisitionLink source="quote" className="mt-1 inline-flex items-center gap-1 font-semibold text-t1">Explore the Audit <ArrowRight size={14} aria-hidden="true" /></AuditAcquisitionLink><p className="mt-1 text-xs text-t3">Full fee credited against an eligible build.</p></div>
        </aside>
      )}

      <div className="mb-9" aria-label="Quote progress">
        <div className="mb-4 flex items-center justify-between font-dm text-xs text-t3"><span>Project brief</span><span>{stage + 1} of {STAGES.length}</span></div>
        <div className="h-1 overflow-hidden rounded-full bg-b1" role="progressbar" aria-valuenow={stage + 1} aria-valuemin={1} aria-valuemax={STAGES.length} aria-label={`Stage ${stage + 1} of ${STAGES.length}: ${STAGES[stage]}`}>
          <m.div className="h-full origin-left bg-acc" animate={{ scaleX: (stage + 1) / STAGES.length }} initial={false} transition={reducedMotion ? { duration: 0 } : motionTransitions.ui} />
        </div>
      </div>
      <ol className="mb-9 hidden grid-cols-4 gap-3 md:grid" aria-label="Project brief stages">
        {STAGES.map((label, index) => (
          <li key={label} aria-current={index === stage ? "step" : undefined} className={`border-t pt-3 font-dm text-xs transition-colors ${index === stage ? "border-acc text-t1" : index < stage ? "border-acc/35 text-t2" : "border-b1 text-t3"}`}>
            <span className="flex items-center gap-1.5">{index < stage ? <Check size={13} className="text-acc" aria-hidden="true" /> : `${index + 1}.`} {label}</span>
          </li>
        ))}
      </ol>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <m.div key={stage} custom={direction} initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: direction * motionDistances.enter }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -motionDistances.enter }} transition={reducedMotion ? { duration: motionDurations.instant } : motionTransitions.ui}>
          <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">Stage {stage + 1} of 4</p>
          <h1 className="mt-2 font-syne text-3xl font-extrabold tracking-[-0.025em]">{STAGES[stage]}</h1>
          <p className="mb-8 mt-3 font-dm text-sm leading-relaxed text-t2" aria-live="polite">{stage === 0 && "Tell us who you are and what kind of business we are helping."}{stage === 1 && "Choose the project shape once, then describe the commercial result and functionality."}{stage === 2 && "Share practical budget, timing and contact preferences."}{stage === 3 && "Add any useful detail, confirm consent and send the complete brief."}</p>

      {error && <m.div initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} ref={errorRef} id={errorId} role="alert" tabIndex={-1} className="mb-6 rounded-lg border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm text-t1">{error}</m.div>}

      <section aria-labelledby={`stage-${stage}`} className="space-y-6">
        <h2 id={`stage-${stage}`} className="sr-only">{STAGES[stage]} fields</h2>
        {stage === 0 && <>
          <TextField id="name" label="Full Name" autoComplete="name" value={data.name} update={update} errorId={invalidField === "name" ? errorId : undefined} invalid={invalidField === "name"} />
          <TextField id="email" label="Email Address" type="email" autoComplete="email" value={data.email} update={update} errorId={invalidField === "email" ? errorId : undefined} invalid={invalidField === "email"} />
          <TextField id="biz" label="Company Name" autoComplete="organization" value={data.biz} update={update} errorId={invalidField === "biz" ? errorId : undefined} invalid={invalidField === "biz"} />
          <TextField id="websiteUrl" label="Current Website (optional)" type="url" autoComplete="url" value={data.websiteUrl} update={update} />
          <ChoiceGroup legend="Business Type" name="businessType" options={BUSINESS_TYPES} value={data.businessType} update={update} />
        </>}
        {stage === 1 && <>
          <ChoiceGroup legend="Project Type" name="type" options={PROJECT_TYPES} value={data.type} update={update} />
          <TextField id="goal" label="Main Business Goal" multiline value={data.goal} update={update} errorId={invalidField === "goal" ? errorId : undefined} invalid={invalidField === "goal"} />
          <fieldset>
            <legend className="mb-3 font-dm text-sm text-t2">Functionality and needs <span className="text-t3">(choose all that apply)</span></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {NEEDS.map((option) => <Choice key={option} type="checkbox" name="needs" option={option} checked={selectedNeeds().includes(option)} onChange={() => toggleNeed(option)} />)}
            </div>
          </fieldset>
        </>}
        {stage === 2 && <>
          <ChoiceGroup legend="Budget" name="budget" options={BUDGETS} value={data.budget} update={update} />
          <ChoiceGroup legend="Launch Timeframe" name="timeframe" options={TIMEFRAMES} value={data.timeframe} update={update} />
          <ChoiceGroup legend="Digital Growth Partnership Interest" name="carePlanInterest" options={CARE} value={data.carePlanInterest} update={update} />
          <ChoiceGroup legend="Preferred Contact" name="preferredContactMethod" options={CONTACT} value={data.preferredContactMethod} update={update} />
        </>}
        {stage === 3 && <>
          <details className="rounded-xl bg-s1 p-4">
            <summary className="cursor-pointer font-dm text-sm font-semibold text-t1">Add an expanded project brief <span className="text-t3">(optional)</span></summary>
            <div className="mt-4"><TextField id="brief" label="Project Brief" multiline value={data.brief} update={update} /></div>
          </details>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={data.website ?? ""} onChange={(event) => update("website", event.target.value)} className="hidden" aria-hidden="true" />
          <EnquiryConsent id="quote-enquiry-consent" checked={data.consent === "true"} onChange={(checked) => update("consent", checked ? "true" : "")} />
        </>}
        <button type="button" onClick={continueStage} disabled={submitting} aria-busy={submitting} className="btn-primary min-h-11 font-dm text-sm disabled:cursor-wait disabled:opacity-60">
          {submitting ? "Sending securely…" : stage === 3 ? "Submit Brief" : "Continue"} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </section>
        </m.div>
      </AnimatePresence>
    </main>
  )
}

function TextField({ id, label, type = "text", autoComplete = "off", value = "", update, multiline = false, errorId, invalid = false }: {
  id: string; label: string; type?: string; autoComplete?: string; value?: string; update: (key: string, value: string) => void; multiline?: boolean; errorId?: string; invalid?: boolean
}) {
  const classes = "w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-base text-t1 outline-none transition-colors focus:border-acc focus-visible:ring-2 focus-visible:ring-acc"
  return <div><label htmlFor={`q-${id}`} className="mb-2 block font-dm text-sm text-t2">{label}</label>{multiline
    ? <textarea id={`q-${id}`} rows={5} value={value} onChange={(event) => update(id, event.target.value)} aria-describedby={errorId} aria-invalid={invalid || undefined} className={`${classes} resize-y`} />
    : <input id={`q-${id}`} type={type} autoComplete={autoComplete} value={value} onChange={(event) => update(id, event.target.value)} aria-describedby={errorId} aria-invalid={invalid || undefined} className={classes} />}</div>
}

function ChoiceGroup({ legend, name, options, value, update }: { legend: string; name: string; options: string[]; value?: string; update: (key: string, value: string) => void }) {
  return <fieldset><legend className="mb-3 font-dm text-sm text-t2">{legend}</legend><div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <Choice key={option} type="radio" name={name} option={option} checked={value === option} onChange={() => update(name, option)} />)}</div></fieldset>
}

function Choice({ type, name, option, checked, onChange }: { type: "radio" | "checkbox"; name: string; option: string; checked: boolean; onChange: () => void }) {
  return <m.label whileTap={{ scale: 0.99 }} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 font-dm text-sm transition-[border-color,background-color,transform] ${checked ? "border-acc bg-acc/10 text-t1 shadow-[inset_3px_0_0_var(--acc)]" : "border-b2 text-t2 hover:border-acc/50"}`}>
    <input type={type} name={name} value={option} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--acc)]" />
    {option}
  </m.label>
}
