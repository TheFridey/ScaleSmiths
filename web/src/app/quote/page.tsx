"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"

const STEPS = [
  {
    label: "Contact",
    fields: [
      { key: "name", label: "Full Name", placeholder: "Your name", type: "text", auto: "name" },
      { key: "email", label: "Email Address", placeholder: "you@business.com", type: "email", auto: "email" },
      { key: "biz", label: "Company Name", placeholder: "Your company name", type: "text", auto: "organization" },
      { key: "websiteUrl", label: "Current Website", placeholder: "https://yourbusiness.co.uk", type: "url", auto: "url", optional: true },
    ],
  },
  {
    label: "Business Type",
    opts: ["Local service business", "E-commerce brand", "SaaS / platform", "Professional services", "Community / membership", "Other"],
    field: "businessType",
  },
  {
    label: "Project Type",
    opts: ["Conversion Website", "Website Redesign", "E-Commerce", "Custom Web App", "SEO / Local Growth", "Care Plan"],
    field: "type",
  },
  {
    label: "Budget",
    opts: ["GBP 4,500-6,500", "GBP 8,000-15,000", "GBP 18,000-35,000+", "Ongoing care plan", "Not sure yet"],
    field: "budget",
  },
  {
    label: "Launch Timeframe",
    opts: ["ASAP, if the fit is right", "4-6 weeks", "8-12 weeks", "This quarter", "Planning ahead"],
    field: "timeframe",
  },
  {
    label: "What needs to move?",
    fields: [
      {
        key: "goal",
        label: "Main Business Goal",
        placeholder: "More qualified enquiries, better local visibility, online sales, operational efficiency...",
        type: "textarea",
        auto: "off",
      },
    ],
  },
  {
    label: "What do you need?",
    opts: ["SEO", "Hosting", "Care Plan", "Custom Functionality", "Payments", "Client Portal", "Analytics", "Not sure"],
    field: "needs",
    multiple: true,
  },
  {
    label: "Care Plan Interest",
    opts: ["Yes", "Maybe", "No", "Not sure"],
    field: "carePlanInterest",
  },
  {
    label: "Preferred Contact",
    opts: ["Email", "Phone", "Video call", "No preference"],
    field: "preferredContactMethod",
  },
  {
    label: "Your Brief",
    fields: [
      {
        key: "brief",
        label: "Project Brief",
        placeholder: "Tell us what is happening now, what needs to change, and what a successful result looks like.",
        type: "textarea",
        auto: "off",
      },
    ],
  },
] as const

type FormData = Record<string, string>
type Step = (typeof STEPS)[number]

function needsValue(data: FormData) {
  return data.needs ? data.needs.split("|").filter(Boolean) : []
}

export default function QuotePage() {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const [data, setData] = useState<FormData>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const curr = STEPS[step]
  const isLast = step === STEPS.length - 1

  function validateStep(current: Step) {
    if ("fields" in current && current.fields) {
      const missing = current.fields.find((field) => !("optional" in field && field.optional) && !(data[field.key] ?? "").trim())
      if (missing) {
        setError(`Please add your ${missing.label.toLowerCase()}.`)
        return false
      }

      if (current.fields.some((field) => field.key === "email")) {
        const email = data.email ?? ""
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError("Please add a valid email address.")
          return false
        }
      }
    }

    if ("field" in current && current.field && !data[current.field]) {
      setError("Please choose an option before continuing.")
      return false
    }

    setError("")
    return true
  }

  function continueOrSubmit() {
    if (!validateStep(curr)) return
    if (isLast && data.consent !== "true") {
      setError("Please confirm consent before submitting.")
      return
    }
    if (isLast) {
      submitQuote()
      return
    }
    setStep((s) => s + 1)
  }

  async function submitQuote() {
    setSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/quote", {
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
          needs: needsValue(data),
          carePlanInterest: data.carePlanInterest ?? "",
          preferredContactMethod: data.preferredContactMethod ?? "",
          consent: data.consent === "true",
          brief: data.brief ?? "",
          website: data.website ?? "",
        }),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Unable to submit your brief.")
      }

      trackExperienceEvent("quote_form_submitted", { metadata: { source: "standard_quote" } })
      router.push("/quote/thanks")
    } catch (err) {
      trackExperienceEvent("experience_error", { errorCategory: "quote_submission", metadata: { source: "standard_quote" } })
      setError(err instanceof Error ? err.message : "Unable to submit your brief.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[680px] px-6 py-16 md:px-12">
      <button
        onClick={() => (step === 0 ? window.history.back() : setStep((s) => s - 1))}
        className="mb-10 inline-flex items-center gap-1.5 font-dm text-sm text-t2 transition-colors hover:text-t1"
        aria-label={step === 0 ? "Go back" : "Previous step"}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {step === 0 ? "Back" : "Previous"}
      </button>

      <div
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={`Step ${step + 1} of ${STEPS.length}`}
        className="mb-11 flex gap-1.5"
      >
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= step ? "var(--acc)" : "var(--b1)" }}
          />
        ))}
      </div>

      <div className="mb-2 font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">
        Step {step + 1} of {STEPS.length}
      </div>
      <h1 className="mb-3 font-syne text-3xl font-extrabold tracking-[-0.025em]">{curr.label}</h1>
      <p className="mb-8 font-dm text-sm leading-relaxed text-t2">
        This keeps the first call useful. We qualify fit, scope, timeline, and the commercial reason for the work.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {[
          ["/services", "View services"],
          ["/pricing", "Pricing guidance"],
          ["/work", "Work / build logs"],
        ].map(([href, label]) => (
          <Link key={href} href={href} prefetch={false} className="rounded-lg border border-b1 bg-s1 px-3 py-2 font-dm text-xs text-t2 transition-colors hover:text-t1">
            {label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="mb-5 rounded-[10px] border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm text-t1">
          {error}
        </div>
      )}

      {"fields" in curr && curr.fields && (
        <div className="flex flex-col gap-4">
          {isLast && (
            <>
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={data.website ?? ""}
                onChange={(e) => setData((d) => ({ ...d, website: e.target.value }))}
                className="hidden"
                aria-hidden="true"
              />
              <label className="mb-2 flex items-start gap-3 rounded-xl border border-b1 bg-s1 p-4 font-dm text-sm leading-relaxed text-t2">
                <input
                  type="checkbox"
                  checked={data.consent === "true"}
                  onChange={(e) => {
                    setError("")
                    setData((d) => ({ ...d, consent: e.target.checked ? "true" : "" }))
                  }}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                I consent to ScaleSmiths storing this enquiry and contacting me about the project.
              </label>
            </>
          )}
          {curr.fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={`q-${field.key}`} className="mb-1.5 block font-dm text-sm text-t2">
                {field.label}{"optional" in field && field.optional ? " (optional)" : ""}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`q-${field.key}`}
                  rows={5}
                  value={data[field.key] ?? ""}
                  onChange={(e) => {
                    setError("")
                    trackExperienceEvent("quote_form_started", { metadata: { source: "standard_quote", step: field.key } })
                    setData((d) => ({ ...d, [field.key]: e.target.value }))
                  }}
                  placeholder={field.placeholder}
                  className="w-full resize-y rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm text-t1 outline-none transition-colors focus:border-acc/50"
                />
              ) : (
                <input
                  id={`q-${field.key}`}
                  type={field.type}
                  autoComplete={field.auto}
                  required={!("optional" in field && field.optional)}
                  value={data[field.key] ?? ""}
                  onChange={(e) => {
                    setError("")
                    trackExperienceEvent("quote_form_started", { metadata: { source: "standard_quote", step: field.key } })
                    setData((d) => ({ ...d, [field.key]: e.target.value }))
                  }}
                  placeholder={field.placeholder}
                  className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm text-t1 outline-none transition-colors focus:border-acc/50"
                />
              )}
            </div>
          ))}
          <button
            onClick={continueOrSubmit}
            disabled={submitting}
            className="btn-primary mt-2 self-start font-dm text-sm"
          >
            {submitting ? "Sending..." : isLast ? "Submit Brief" : "Continue"} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {"opts" in curr && curr.opts && (
        <div role="radiogroup" aria-label={curr.label} className="flex flex-wrap gap-2.5">
          {curr.opts.map((option) => {
            const isMultiple = "multiple" in curr && curr.multiple
            const selected = isMultiple ? needsValue(data).includes(option) : data[curr.field] === option

            return (
              <button
                key={option}
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setError("")
                  trackExperienceEvent("quote_form_started", { metadata: { source: "standard_quote", step: curr.field } })
                  if (isMultiple) {
                    setData((d) => {
                      const selectedNeeds = needsValue(d)
                      const next = selectedNeeds.includes(option)
                        ? selectedNeeds.filter((item) => item !== option)
                        : [...selectedNeeds, option]
                      return { ...d, [curr.field]: next.join("|") }
                    })
                    return
                  }

                  setData((d) => ({ ...d, [curr.field]: option }))
                  setTimeout(() => setStep((s) => s + 1), 180)
                }}
                className="rounded-[10px] px-5 py-3 font-dm text-sm font-medium transition-all"
                style={{
                  border: `1px solid ${selected ? "var(--acc)" : "var(--b2)"}`,
                  background: selected ? "var(--acc-dim)" : "none",
                  color: selected ? "var(--t1)" : "var(--t2)",
                }}
              >
                {option}
              </button>
            )
          })}
          {"multiple" in curr && curr.multiple && (
            <button onClick={continueOrSubmit} className="btn-primary mt-4 basis-full justify-center font-dm text-sm md:basis-auto">
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
