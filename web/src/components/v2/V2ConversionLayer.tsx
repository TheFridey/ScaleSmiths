"use client"

import type { FormEvent, ReactNode } from "react"
import { useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { CheckCircle2, ClipboardList, MailCheck, Send, Sparkles } from "lucide-react"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"
import type { V2Industry } from "@/lib/v2/scenes"
import { getIndustryContent, industryContent } from "@/lib/v2/industryContent"

interface V2ConversionLayerProps {
  industry: V2Industry | null
}

interface ConversionFormData {
  name: string
  businessName: string
  email: string
  phone: string
  industry: V2Industry
  goal: string
  budget: string
  timeline: string
  website: string
}

type ConversionIntent = "Book a Strategy Call" | "Request a V2 Demo" | "Send Me This Plan"

const recommendedSystem = [
  "Website",
  "Quote/booking flow",
  "CRM",
  "Follow-up automation",
  "SEO foundation",
  "Analytics dashboard",
]

const budgetRanges = [
  "GBP 4,500-6,500",
  "GBP 8,000-15,000",
  "GBP 18,000-35,000+",
  "Ongoing care plan",
  "Not sure yet",
]

const timelines = [
  "ASAP, if the fit is right",
  "4-6 weeks",
  "8-12 weeks",
  "This quarter",
  "Planning ahead",
]

const industryOptions = Object.values(industryContent).map((content) => ({
  id: content.id,
  name: content.name,
}))

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function buildBrief({
  contentName,
  finalPitch,
  intent,
  goal,
  phone,
  journeyIndustry,
  formIndustry,
  modules,
  workflow,
}: {
  contentName: string
  finalPitch: string
  intent: ConversionIntent
  goal: string
  phone: string
  journeyIndustry: string
  formIndustry: string
  modules: string[]
  workflow: string[]
}) {
  return [
    "ScaleSmiths V2 interactive journey enquiry",
    "",
    `Requested next step: ${intent}`,
    `Journey industry: ${journeyIndustry}`,
    `Form industry: ${formIndustry}`,
    `Selected summary: ${contentName}`,
    `Final pitch shown: ${finalPitch}`,
    phone ? `Phone: ${phone}` : "Phone: Not provided",
    "",
    "Recommended ScaleSmiths system:",
    ...recommendedSystem.map((item) => `- ${item}`),
    "",
    "Journey modules shown:",
    ...modules.map((item) => `- ${item}`),
    "",
    "Simulated workflow shown:",
    ...workflow.map((item) => `- ${item}`),
    "",
    "What the website should do:",
    goal,
  ].join("\n")
}

export function V2ConversionLayer({ industry }: V2ConversionLayerProps) {
  const selectedIndustry = industry ?? "other"
  const [formData, setFormData] = useState<ConversionFormData>({
    name: "",
    businessName: "",
    email: "",
    phone: "",
    industry: selectedIndustry,
    goal: "",
    budget: "",
    timeline: "",
    website: "",
  })
  const [intent, setIntent] = useState<ConversionIntent>("Book a Strategy Call")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const reducedMotion = useReducedMotion()

  const journeyContent = getIndustryContent(selectedIndustry)
  const formContent = getIndustryContent(formData.industry)
  const moduleLabels = useMemo(() => journeyContent.modules.map((module) => module.label), [journeyContent.modules])

  function updateField<Key extends keyof ConversionFormData>(key: Key, value: ConversionFormData[Key]) {
    setError("")
    trackExperienceEvent("quote_form_started", { preference: "interactive", metadata: { source: "interactive_conversion", step: key } })
    setFormData((current) => ({ ...current, [key]: value }))
  }

  function chooseIntent(nextIntent: ConversionIntent) {
    setIntent(nextIntent)
    trackExperienceEvent("quote_cta_clicked", { preference: "interactive", metadata: { target: nextIntent } })
    formRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" })
  }

  function validateForm() {
    if (!formData.name.trim()) return "Please add your name."
    if (!formData.businessName.trim()) return "Please add your business name."
    if (!validateEmail(formData.email.trim())) return "Please add a valid email address."
    if (!formData.industry) return "Please choose an industry."
    if (!formData.goal.trim()) return "Please tell us what you want the website to do."
    if (!formData.budget) return "Please choose a budget range."
    if (!formData.timeline) return "Please choose a timeline."
    return ""
  }

  async function submitConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          biz: formData.businessName,
          websiteUrl: "",
          businessType: formContent.name,
          type: `ScaleSmiths V2 interactive journey - ${intent}`,
          budget: formData.budget,
          timeframe: formData.timeline,
          goal: formData.goal,
          needs: recommendedSystem.slice(0, 8),
          carePlanInterest: "Maybe",
          preferredContactMethod: formData.phone ? `Email and phone: ${formData.phone}` : "Email",
          consent: true,
          brief: buildBrief({
            contentName: formContent.name,
            finalPitch: formContent.finalPitch,
            intent,
            goal: formData.goal,
            phone: formData.phone,
            journeyIndustry: journeyContent.name,
            formIndustry: formContent.name,
            modules: moduleLabels,
            workflow: journeyContent.simulatedWorkflow,
          }),
          website: formData.website,
        }),
      })
      const json = await response.json()

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to send this plan right now.")
      }

      trackExperienceEvent("quote_form_submitted", { preference: "interactive", metadata: { source: "interactive_conversion" } })
      setSubmitted(true)
    } catch (err) {
      trackExperienceEvent("experience_error", { preference: "interactive", errorCategory: "quote_submission", metadata: { source: "interactive_conversion" } })
      setError(err instanceof Error ? err.message : "Unable to send this plan right now.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.aside
      aria-labelledby="v2-conversion-heading"
      className="rounded-lg border border-white/10 bg-bg/68 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl md:p-6"
      initial={reducedMotion ? false : { opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
    >
      <p className="inline-flex items-center gap-2 rounded-full border border-acc/30 bg-acc/10 px-3 py-1.5 font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-acc">
        <Sparkles size={13} aria-hidden="true" />
        Recommended next step
      </p>
      <h2 id="v2-conversion-heading" className="mt-5 font-syne text-2xl font-black leading-tight tracking-normal text-t1 md:text-3xl">
        {journeyContent.name} system summary
      </h2>
      <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{journeyContent.finalPitch}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="recommended-system-heading" className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <h3 id="recommended-system-heading" className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-t3">
            Recommended ScaleSmiths system
          </h3>
          <ul className="mt-3 grid gap-2">
            {recommendedSystem.map((item) => (
              <li key={item} className="flex items-center gap-2 font-dm text-sm text-t2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="journey-state-heading" className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <h3 id="journey-state-heading" className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-t3">
            Selected industry
          </h3>
          <p className="mt-3 font-syne text-xl font-black tracking-normal text-t1">{journeyContent.name}</p>
          <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{journeyContent.headline}</p>
        </section>
      </div>

      <div className="mt-5">
        <p className="mb-2 font-dm text-xs font-semibold uppercase tracking-[0.14em] text-t3">Choose how to continue</p>
      <div className="grid gap-2 sm:grid-cols-3" aria-label="Conversion options">
        {(["Book a Strategy Call", "Request a V2 Demo", "Send Me This Plan"] as ConversionIntent[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => chooseIntent(option)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 font-dm text-sm font-semibold text-t2 transition hover:-translate-y-0.5 hover:border-acc/40 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc data-[active=true]:border-acc/50 data-[active=true]:bg-acc/10 data-[active=true]:text-acc motion-reduce:transform-none"
            data-active={intent === option}
          >
            {option === "Book a Strategy Call" && <ClipboardList size={15} aria-hidden="true" />}
            {option === "Request a V2 Demo" && <Sparkles size={15} aria-hidden="true" />}
            {option === "Send Me This Plan" && <MailCheck size={15} aria-hidden="true" />}
            {option}
          </button>
        ))}
      </div>
      </div>

      {submitted ? (
        <div role="status" className="mt-6 rounded-lg border border-success/30 bg-success/10 p-5">
          <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
          <h3 className="mt-3 font-syne text-2xl font-black tracking-normal text-t1">Plan sent.</h3>
          <p className="mt-2 font-dm text-sm leading-relaxed text-t2">
            We have the V2 journey context and your project details. ScaleSmiths will review the fit and come back with the next sensible step.
          </p>
        </div>
      ) : (
        <form ref={formRef} onSubmit={submitConversion} className="mt-6 grid gap-4" noValidate>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={formData.website}
            onChange={(event) => updateField("website", event.target.value)}
            className="hidden"
            aria-hidden="true"
          />

          {error && (
            <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm text-t1" role="alert">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" id="v2-name" required>
              <input
                id="v2-name"
                autoComplete="name"
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="v2-form-field"
              />
            </Field>
            <Field label="Business name" id="v2-business-name" required>
              <input
                id="v2-business-name"
                autoComplete="organization"
                value={formData.businessName}
                onChange={(event) => updateField("businessName", event.target.value)}
                className="v2-form-field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" id="v2-email" required>
              <input
                id="v2-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="v2-form-field"
              />
            </Field>
            <Field label="Phone" id="v2-phone" optional>
              <input
                id="v2-phone"
                type="tel"
                autoComplete="tel"
                value={formData.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="v2-form-field"
              />
            </Field>
          </div>

          <Field label="Industry" id="v2-industry" required>
            <select
              id="v2-industry"
              value={formData.industry}
              onChange={(event) => updateField("industry", event.target.value as V2Industry)}
              className="v2-form-field"
            >
              {industryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What do you want the website to do?" id="v2-goal" required>
            <textarea
              id="v2-goal"
              rows={4}
              value={formData.goal}
              onChange={(event) => updateField("goal", event.target.value)}
              placeholder="Qualify leads, book appointments, sell products, reduce admin, improve local visibility..."
              className="v2-form-field resize-y"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget range" id="v2-budget" required>
              <select
                id="v2-budget"
                value={formData.budget}
                onChange={(event) => updateField("budget", event.target.value)}
                className="v2-form-field"
              >
                <option value="">Choose a range</option>
                {budgetRanges.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Timeline" id="v2-timeline" required>
              <select
                id="v2-timeline"
                value={formData.timeline}
                onChange={(event) => updateField("timeline", event.target.value)}
                className="v2-form-field"
              >
                <option value="">Choose timing</option>
                {timelines.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-acc px-5 py-3 font-dm text-sm font-semibold text-bg shadow-[0_0_42px_rgba(34,211,238,0.22)] transition hover:bg-[#67e8f9] disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc sm:justify-self-start"
          >
            {submitting ? "Sending..." : intent}
            <Send size={15} aria-hidden="true" />
          </button>
        </form>
      )}
    </motion.aside>
  )
}

function Field({
  id,
  label,
  optional,
  required,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-dm text-sm font-medium text-t2">
        {label}
        {required && <span className="text-acc"> *</span>}
        {optional && <span className="text-t3"> (optional)</span>}
      </label>
      {children}
    </div>
  )
}
