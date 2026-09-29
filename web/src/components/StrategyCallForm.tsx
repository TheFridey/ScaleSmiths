"use client"

import { FormEvent, useId, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { PageBreadcrumbs } from "@/components/Breadcrumbs"
import { EnquiryConsent } from "@/components/EnquiryConsent"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"
import type { EnquiryIntent } from "@/lib/enquiry-intents"
import { ENQUIRY_INTENTS } from "@/lib/enquiry-intents"

const PROBLEM_OPTIONS = [
  "Website not converting",
  "Local visibility / SEO",
  "Need a custom system or portal",
  "Operations / automation",
  "Enterprise / multi-site complexity",
  "Unsure: need clarity first",
] as const

const CONTACT_OPTIONS = ["Email", "Phone", "Video call", "No preference"] as const
const TIMING_OPTIONS = ["This week", "This month", "This quarter", "Just exploring"] as const

type FormState = {
  name: string
  biz: string
  websiteUrl: string
  email: string
  phone: string
  goal: string
  preferredContactMethod: string
  timeframe: string
  problems: string[]
  consent: boolean
  website: string
}

const initialState: FormState = {
  name: "",
  biz: "",
  websiteUrl: "",
  email: "",
  phone: "",
  goal: "",
  preferredContactMethod: "",
  timeframe: "",
  problems: [],
  consent: false,
  website: "",
}

interface StrategyCallFormProps {
  intent?: Extract<EnquiryIntent, "strategy_call" | "discovery_call">
}

export function StrategyCallForm({ intent = "strategy_call" }: StrategyCallFormProps) {
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState("")
  const [invalidField, setInvalidField] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const errorId = useId()
  const errorRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const label = ENQUIRY_INTENTS[intent]
  const submitLabel = intent === "discovery_call" ? "Request Discovery Call" : "Request Strategy Call"

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setError("")
    setInvalidField(null)
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleProblem(option: string) {
    const next = form.problems.includes(option)
      ? form.problems.filter((item) => item !== option)
      : [...form.problems, option]
    update("problems", next)
  }

  function validate() {
    if (!form.name.trim()) {
      setError("Please add your name.")
      setInvalidField("name")
      return false
    }
    if (!form.biz.trim()) {
      setError("Please add your business name.")
      setInvalidField("biz")
      return false
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please add a valid email address.")
      setInvalidField("email")
      return false
    }
    if (!form.goal.trim()) {
      setError("Please tell us what you are trying to solve.")
      setInvalidField("goal")
      return false
    }
    if (!form.preferredContactMethod) {
      setError("Please choose a preferred contact method.")
      setInvalidField("preferredContactMethod")
      return false
    }
    if (!form.timeframe) {
      setError("Please choose a preferred timing.")
      setInvalidField("timeframe")
      return false
    }
    if (!form.consent) {
      setError("Please confirm consent before submitting.")
      setInvalidField("consent")
      return false
    }
    setError("")
    setInvalidField(null)
    return true
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    if (!validate()) {
      window.requestAnimationFrame(() => errorRef.current?.focus())
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setError("")

    const problemLine = form.problems.length
      ? `Focus areas: ${form.problems.join(", ")}`
      : "Focus areas: not selected"
    const brief = [
      `${label} request`,
      "",
      `What they are trying to solve: ${form.goal.trim()}`,
      problemLine,
      `Preferred contact: ${form.preferredContactMethod}`,
      `Preferred timing: ${form.timeframe}`,
      form.phone.trim() ? `Phone: ${form.phone.trim()}` : "Phone: not provided",
      form.websiteUrl.trim() ? `Website: ${form.websiteUrl.trim()}` : "Website: not provided",
    ].join("\n")

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          biz: form.biz.trim(),
          websiteUrl: form.websiteUrl.trim(),
          phone: form.phone.trim(),
          goal: form.goal.trim(),
          needs: form.problems,
          preferredContactMethod: form.preferredContactMethod,
          timeframe: form.timeframe,
          intent,
          consent: form.consent,
          brief,
          website: form.website,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to send your request.")
      trackExperienceEvent("quote_form_submitted", { metadata: { source: "strategy_call", intent } })
      router.push(`/quote/thanks?intent=${encodeURIComponent(intent)}`)
    } catch (caught) {
      trackExperienceEvent("experience_error", { errorCategory: "quote_submission", metadata: { source: "strategy_call", intent } })
      setError(caught instanceof Error ? caught.message : "Unable to send your request.")
      inFlight.current = false
      setSubmitting(false)
      window.requestAnimationFrame(() => errorRef.current?.focus())
    }
  }

  const inputClass = "field-control"

  return (
    <main className="mx-auto max-w-[720px] px-6 py-12 md:px-12 md:py-16">
      <PageBreadcrumbs
        className="mb-8"
        items={[
          { name: "Home", path: "/" },
          { name: label, path: `/quote?intent=${intent}` },
        ]}
      />

      <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">Conversation first</p>
      <h1 className="mt-2 font-syne text-3xl font-extrabold tracking-[-0.025em] md:text-4xl">{label}</h1>
      <p className="mb-8 mt-3 max-w-[560px] font-dm text-sm leading-relaxed text-t2">
        A short request so we can understand the constraint and reply with a sensible next step.
        If you already know the project shape, use the{" "}
        <a href="/quote" className="font-semibold text-t1 underline underline-offset-2 hover:text-acc">
          full project brief
        </a>
        .
      </p>

      {error ? (
        <div
          ref={errorRef}
          id={errorId}
          role="alert"
          tabIndex={-1}
          className="mb-6 rounded-lg border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm text-t1"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-6" noValidate>
        <Field id="sc-name" label="Your name" errorId={invalidField === "name" ? errorId : undefined} invalid={invalidField === "name"}>
          <input
            id="sc-name"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={invalidField === "name" || undefined}
            aria-describedby={invalidField === "name" ? errorId : undefined}
            className={inputClass}
            required
          />
        </Field>

        <Field id="sc-biz" label="Business name" errorId={invalidField === "biz" ? errorId : undefined} invalid={invalidField === "biz"}>
          <input
            id="sc-biz"
            autoComplete="organization"
            value={form.biz}
            onChange={(event) => update("biz", event.target.value)}
            aria-invalid={invalidField === "biz" || undefined}
            aria-describedby={invalidField === "biz" ? errorId : undefined}
            className={inputClass}
            required
          />
        </Field>

        <Field id="sc-website" label="Website (optional)">
          <input
            id="sc-website"
            type="url"
            autoComplete="url"
            placeholder="https://"
            value={form.websiteUrl}
            onChange={(event) => update("websiteUrl", event.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="sc-email" label="Email" errorId={invalidField === "email" ? errorId : undefined} invalid={invalidField === "email"}>
            <input
              id="sc-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              aria-invalid={invalidField === "email" || undefined}
              aria-describedby={invalidField === "email" ? errorId : undefined}
              className={inputClass}
              required
            />
          </Field>
          <Field id="sc-phone" label="Phone (optional)">
            <input
              id="sc-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field id="sc-goal" label="What are you trying to solve?" errorId={invalidField === "goal" ? errorId : undefined} invalid={invalidField === "goal"}>
          <textarea
            id="sc-goal"
            rows={4}
            value={form.goal}
            onChange={(event) => update("goal", event.target.value)}
            aria-invalid={invalidField === "goal" || undefined}
            aria-describedby={invalidField === "goal" ? errorId : undefined}
            className={`${inputClass} resize-y`}
            required
          />
        </Field>

        <fieldset>
          <legend className="mb-3 font-dm text-sm text-t2">
            Where is the pressure? <span className="text-t3">(optional)</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROBLEM_OPTIONS.map((option) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 font-dm text-sm transition-[border-color,background-color] ${
                  form.problems.includes(option)
                    ? "border-control-focus bg-acc/10 text-t1 shadow-[inset_3px_0_0_var(--acc)]"
                    : "border-control text-t2 hover:border-control-hover"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.problems.includes(option)}
                  onChange={() => toggleProblem(option)}
                  className="h-4 w-4 accent-[var(--acc)]"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset aria-invalid={invalidField === "preferredContactMethod" || undefined}>
          <legend className="mb-3 font-dm text-sm text-t2">Preferred contact</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CONTACT_OPTIONS.map((option) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 font-dm text-sm transition-[border-color,background-color] ${
                  form.preferredContactMethod === option
                    ? "border-control-focus bg-acc/10 text-t1 shadow-[inset_3px_0_0_var(--acc)]"
                    : "border-control text-t2 hover:border-control-hover"
                }`}
              >
                <input
                  type="radio"
                  name="preferredContactMethod"
                  value={option}
                  checked={form.preferredContactMethod === option}
                  onChange={() => update("preferredContactMethod", option)}
                  className="h-4 w-4 accent-[var(--acc)]"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset aria-invalid={invalidField === "timeframe" || undefined}>
          <legend className="mb-3 font-dm text-sm text-t2">Preferred timing</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TIMING_OPTIONS.map((option) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 font-dm text-sm transition-[border-color,background-color] ${
                  form.timeframe === option
                    ? "border-control-focus bg-acc/10 text-t1 shadow-[inset_3px_0_0_var(--acc)]"
                    : "border-control text-t2 hover:border-control-hover"
                }`}
              >
                <input
                  type="radio"
                  name="timeframe"
                  value={option}
                  checked={form.timeframe === option}
                  onChange={() => update("timeframe", option)}
                  className="h-4 w-4 accent-[var(--acc)]"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => update("website", event.target.value)}
          className="hidden"
          aria-hidden="true"
        />

        <EnquiryConsent
          id="strategy-call-consent"
          checked={form.consent}
          onChange={(checked) => update("consent", checked)}
        />

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="btn-primary min-h-11 w-full justify-center font-dm text-sm disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Sending securely…" : submitLabel} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </form>
    </main>
  )
}

function Field({
  id,
  label,
  children,
  errorId,
  invalid = false,
}: {
  id: string
  label: string
  children: ReactNode
  errorId?: string
  invalid?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className={`mb-2 block font-dm text-sm ${invalid ? "text-t1" : "text-t2"}`}>
        {label}
      </label>
      {children}
      {errorId ? <span className="sr-only" id={`${id}-error-ref`} /> : null}
    </div>
  )
}
