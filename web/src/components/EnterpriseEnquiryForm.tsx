"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { EnquiryConsent } from "@/components/EnquiryConsent"
import {
  ENTERPRISE_BUDGET_BANDS,
  ENTERPRISE_CLOUD_PROVIDERS,
  ENTERPRISE_COMPANY_SIZES,
  ENTERPRISE_CONTACT_THANKS_PATH,
  ENTERPRISE_ENQUIRY_STORAGE_KEY,
  ENTERPRISE_STAGES,
  ENTERPRISE_SYSTEM_AREAS,
  ENTERPRISE_TIMESCALES,
  ENTERPRISE_YES_NO_UNSURE,
  buildEnterpriseQuotePayload,
  emptyEnterpriseEnquiryDraft,
  validateEnterpriseStage,
  type EnterpriseEnquiryDraft,
} from "@/lib/enterprise-enquiry"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"
import { motionDistances, motionDurations, motionTransitions } from "@/lib/motion"

export function EnterpriseEnquiryForm() {
  const [stage, setStage] = useState(0)
  const [draft, setDraft] = useState<EnterpriseEnquiryDraft>(emptyEnterpriseEnquiryDraft)
  const [restored, setRestored] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [error, setError] = useState("")
  const [invalidField, setInvalidField] = useState<string | null>(null)
  const errorId = useId()
  const errorRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  const submissionInFlight = useRef(false)
  const reducedMotion = useReducedMotion()
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(ENTERPRISE_ENQUIRY_STORAGE_KEY) ?? "null") as {
        stage?: number
        draft?: EnterpriseEnquiryDraft
      } | null
      if (saved?.draft) setDraft({ ...emptyEnterpriseEnquiryDraft(), ...saved.draft, website: "" })
      if (Number.isInteger(saved?.stage)) setStage(Math.max(0, Math.min(ENTERPRISE_STAGES.length - 1, saved?.stage ?? 0)))
    } catch {
      window.sessionStorage.removeItem(ENTERPRISE_ENQUIRY_STORAGE_KEY)
    } finally {
      setRestored(true)
    }
  }, [])

  useEffect(() => {
    if (!restored) return
    window.sessionStorage.setItem(ENTERPRISE_ENQUIRY_STORAGE_KEY, JSON.stringify({ stage, draft: { ...draft, website: "" } }))
  }, [draft, restored, stage])

  useEffect(() => {
    if (!error) return
    const frame = window.requestAnimationFrame(() => errorRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [error])

  useEffect(() => {
    if (!restored) return
    const onPopState = (event: PopStateEvent) => {
      const historicStage = Number((event.state as { enterpriseStage?: number } | null)?.enterpriseStage)
      if (Number.isInteger(historicStage)) setStage(Math.max(0, Math.min(ENTERPRISE_STAGES.length - 1, historicStage)))
    }
    window.history.replaceState({ ...window.history.state, enterpriseStage: stage }, "")
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [restored, stage])

  function markStarted() {
    if (started.current) return
    started.current = true
    trackExperienceEvent("quote_form_started", {
      metadata: { source: "enterprise_contact", step: "form_started", funnelType: "enterprise" },
    })
  }

  function update<K extends keyof EnterpriseEnquiryDraft>(key: K, value: EnterpriseEnquiryDraft[K]) {
    markStarted()
    setError("")
    setInvalidField(null)
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function toggleSystemArea(value: string) {
    const current = draft.systemAreas
    update(
      "systemAreas",
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value].slice(0, 14),
    )
  }

  function validate(current: number) {
    const result = validateEnterpriseStage(current, draft)
    if (!result.ok) {
      setError(result.message)
      setInvalidField(result.field)
      return false
    }
    setError("")
    setInvalidField(null)
    return true
  }

  function continueStage() {
    if (!validate(stage)) return
    if (stage === ENTERPRISE_STAGES.length - 1) {
      void submitEnquiry()
      return
    }
    trackExperienceEvent("quote_form_started", {
      metadata: {
        source: "enterprise_contact",
        step: `step_${stage + 1}_completed`,
        funnelType: "enterprise",
      },
    })
    const nextStage = stage + 1
    setDirection(1)
    window.history.pushState({ ...window.history.state, enterpriseStage: nextStage }, "")
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
    window.history.pushState({ ...window.history.state, enterpriseStage: nextStage }, "")
    setStage(nextStage)
    setError("")
    setInvalidField(null)
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }

  async function submitEnquiry() {
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    setSubmitting(true)
    try {
      const payload = buildEnterpriseQuotePayload(draft)
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to submit your enquiry.")
      trackExperienceEvent("quote_form_submitted", {
        metadata: { source: "enterprise_contact", funnelType: "enterprise" },
      })
      window.sessionStorage.removeItem(ENTERPRISE_ENQUIRY_STORAGE_KEY)
      router.push(ENTERPRISE_CONTACT_THANKS_PATH)
    } catch (caught) {
      trackExperienceEvent("experience_error", {
        errorCategory: "quote_submission",
        metadata: { source: "enterprise_contact", funnelType: "enterprise" },
      })
      setInvalidField(null)
      setError(caught instanceof Error ? caught.message : "Unable to submit your enquiry.")
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  const progressLabel = `Step ${stage + 1} of ${ENTERPRISE_STAGES.length}: ${ENTERPRISE_STAGES[stage]}`

  return (
    <div>
      <button
        type="button"
        onClick={previousStage}
        className="mb-8 inline-flex min-h-10 items-center gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
      >
        <ArrowLeft size={15} aria-hidden="true" /> {stage === 0 ? "Back" : "Previous step"}
      </button>

      <div className="mb-9" aria-label="Enterprise enquiry progress">
        <div className="mb-4 flex items-center justify-between font-dm text-xs text-t3">
          <span>Enterprise discovery</span>
          <span>
            {stage + 1} of {ENTERPRISE_STAGES.length}
          </span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-b1"
          role="progressbar"
          aria-valuenow={stage + 1}
          aria-valuemin={1}
          aria-valuemax={ENTERPRISE_STAGES.length}
          aria-label={progressLabel}
        >
          <m.div
            className="h-full origin-left bg-acc"
            animate={{ scaleX: (stage + 1) / ENTERPRISE_STAGES.length }}
            initial={false}
            transition={reducedMotion ? { duration: 0 } : motionTransitions.ui}
          />
        </div>
      </div>

      <ol className="mb-9 hidden grid-cols-3 gap-3 lg:grid lg:grid-cols-6" aria-label="Enterprise discovery steps">
        {ENTERPRISE_STAGES.map((label, index) => (
          <li
            key={label}
            aria-current={index === stage ? "step" : undefined}
            className={`border-t pt-3 font-dm text-xs transition-colors ${
              index === stage ? "border-acc text-t1" : index < stage ? "border-acc/35 text-t2" : "border-b1 text-t3"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {index < stage ? <Check size={13} className="text-acc" aria-hidden="true" /> : `${index + 1}.`} {label}
            </span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <m.div
          key={stage}
          custom={direction}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: direction * motionDistances.enter }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -motionDistances.enter }}
          transition={reducedMotion ? { duration: motionDurations.instant } : motionTransitions.ui}
        >
          <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">
            Step {stage + 1} of {ENTERPRISE_STAGES.length}
          </p>
          <h2 id={`enterprise-stage-${stage}`} className="mt-2 font-syne text-3xl font-extrabold tracking-[-0.025em] md:text-4xl">
            {ENTERPRISE_STAGES[stage]}
          </h2>
          <p className="mb-8 mt-3 font-dm text-sm leading-relaxed text-t2" aria-live="polite">
            {stage === 0 && "Tell us who you are and enough organisational context to qualify a serious conversation."}
            {stage === 1 && "Describe the operating reality — systems, friction and the problem worth solving."}
            {stage === 2 && "Select the system areas that matter. Choose all that apply."}
            {stage === 3 && "Optional technical context. Skip anything that is not yet known."}
            {stage === 4 && "Share timescale, budget posture and who else will approve the work."}
            {stage === 5 && "Add anything else that helps discovery, confirm consent, and send."}
          </p>

          {error && (
            <m.div
              initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              ref={errorRef}
              id={errorId}
              role="alert"
              tabIndex={-1}
              className="mb-6 rounded-lg border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm text-t1"
            >
              {error}
            </m.div>
          )}

          <section aria-labelledby={`enterprise-stage-${stage}`} className="space-y-6">
            {stage === 0 && (
              <>
                <TextField id="name" label="Name" autoComplete="name" value={draft.name} onChange={(value) => update("name", value)} errorId={invalidField === "name" ? errorId : undefined} invalid={invalidField === "name"} required />
                <TextField id="email" label="Work email" type="email" autoComplete="email" value={draft.email} onChange={(value) => update("email", value)} errorId={invalidField === "email" ? errorId : undefined} invalid={invalidField === "email"} required />
                <TextField id="phone" label="Phone" type="tel" autoComplete="tel" value={draft.phone} onChange={(value) => update("phone", value)} errorId={invalidField === "phone" ? errorId : undefined} invalid={invalidField === "phone"} required />
                <TextField id="company" label="Company" autoComplete="organization" value={draft.company} onChange={(value) => update("company", value)} errorId={invalidField === "company" ? errorId : undefined} invalid={invalidField === "company"} required />
                <TextField id="jobTitle" label="Job title" autoComplete="organization-title" value={draft.jobTitle} onChange={(value) => update("jobTitle", value)} errorId={invalidField === "jobTitle" ? errorId : undefined} invalid={invalidField === "jobTitle"} required />
                <ChoiceGroup legend="Company size" name="companySize" options={ENTERPRISE_COMPANY_SIZES} value={draft.companySize} onChange={(value) => update("companySize", value)} />
                <TextField id="siteCount" label="Number of sites / locations" hint="Optional — leave blank if not relevant." value={draft.siteCount} onChange={(value) => update("siteCount", value)} />
              </>
            )}

            {stage === 1 && (
              <>
                <TextField id="currentSystems" label="What systems are you currently using?" multiline value={draft.currentSystems} onChange={(value) => update("currentSystems", value)} />
                <TextField id="problem" label="What problem are you trying to solve?" multiline value={draft.problem} onChange={(value) => update("problem", value)} errorId={invalidField === "problem" ? errorId : undefined} invalid={invalidField === "problem"} required />
                <TextField id="overlappingSystems" label="Are multiple systems performing overlapping roles?" multiline value={draft.overlappingSystems} onChange={(value) => update("overlappingSystems", value)} />
                <TextField id="manualProcesses" label="What manual processes still exist?" multiline value={draft.manualProcesses} onChange={(value) => update("manualProcesses", value)} />
                <TextField id="operationalFriction" label="What is creating the most operational friction?" multiline value={draft.operationalFriction} onChange={(value) => update("operationalFriction", value)} />
              </>
            )}

            {stage === 2 && (
              <>
                <fieldset>
                  <legend className="mb-3 font-dm text-sm text-t2">
                    System requirement areas <span className="text-acc">*</span>
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ENTERPRISE_SYSTEM_AREAS.map((option) => (
                      <Choice
                        key={option}
                        type="checkbox"
                        name="systemAreas"
                        option={option}
                        checked={draft.systemAreas.includes(option)}
                        onChange={() => toggleSystemArea(option)}
                      />
                    ))}
                  </div>
                </fieldset>
                {draft.systemAreas.includes("Other") && (
                  <TextField
                    id="systemAreasOther"
                    label="Describe the other requirement"
                    value={draft.systemAreasOther}
                    onChange={(value) => update("systemAreasOther", value)}
                    errorId={invalidField === "systemAreasOther" ? errorId : undefined}
                    invalid={invalidField === "systemAreasOther"}
                    required
                  />
                )}
              </>
            )}

            {stage === 3 && (
              <>
                <ChoiceGroup legend="Do you use Microsoft 365 / Entra ID?" name="microsoft365" options={ENTERPRISE_YES_NO_UNSURE} value={draft.microsoft365} onChange={(value) => update("microsoft365", value)} optional />
                <ChoiceGroup legend="Do you require SSO?" name="requireSso" options={ENTERPRISE_YES_NO_UNSURE} value={draft.requireSso} onChange={(value) => update("requireSso", value)} optional />
                <ChoiceGroup legend="Existing cloud provider" name="cloudProvider" options={ENTERPRISE_CLOUD_PROVIDERS} value={draft.cloudProvider} onChange={(value) => update("cloudProvider", value)} optional />
                <TextField id="existingApis" label="Existing APIs / integrations" hint="Optional." multiline value={draft.existingApis} onChange={(value) => update("existingApis", value)} />
                <ChoiceGroup legend="Data migration required?" name="dataMigration" options={ENTERPRISE_YES_NO_UNSURE} value={draft.dataMigration} onChange={(value) => update("dataMigration", value)} optional />
                <ChoiceGroup legend="Mobile / offline required?" name="mobileOffline" options={ENTERPRISE_YES_NO_UNSURE} value={draft.mobileOffline} onChange={(value) => update("mobileOffline", value)} optional />
                <ChoiceGroup legend="Security / procurement requirements known?" name="securityProcurement" options={ENTERPRISE_YES_NO_UNSURE} value={draft.securityProcurement} onChange={(value) => update("securityProcurement", value)} optional />
              </>
            )}

            {stage === 4 && (
              <>
                <TextField id="approxUsers" label="Approximate number of users" hint="Optional." value={draft.approxUsers} onChange={(value) => update("approxUsers", value)} />
                <TextField id="approxSites" label="Approximate number of sites" hint="Optional." value={draft.approxSites} onChange={(value) => update("approxSites", value)} />
                <ChoiceGroup legend="Desired timescale" name="timescale" options={ENTERPRISE_TIMESCALES} value={draft.timescale} onChange={(value) => update("timescale", value)} />
                <ChoiceGroup legend="Is budget already approved?" name="budgetApproved" options={ENTERPRISE_YES_NO_UNSURE} value={draft.budgetApproved} onChange={(value) => update("budgetApproved", value)} optional />
                <ChoiceGroup legend="Budget range" name="budgetRange" options={ENTERPRISE_BUDGET_BANDS} value={draft.budgetRange} onChange={(value) => update("budgetRange", value)} />
                <TextField id="approvers" label="Who else will be involved in approving this project?" hint="Optional — roles or names are fine." multiline value={draft.approvers} onChange={(value) => update("approvers", value)} />
              </>
            )}

            {stage === 5 && (
              <>
                <TextField
                  id="finalMessage"
                  label="Anything else we should know before discovery?"
                  multiline
                  rows={8}
                  value={draft.finalMessage}
                  onChange={(value) => update("finalMessage", value)}
                  errorId={invalidField === "finalMessage" ? errorId : undefined}
                  invalid={invalidField === "finalMessage"}
                  required
                />
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={draft.website}
                  onChange={(event) => update("website", event.target.value)}
                  className="hidden"
                  aria-hidden="true"
                />
                <EnquiryConsent
                  id="enterprise-enquiry-consent"
                  checked={draft.consent}
                  onChange={(checked) => update("consent", checked)}
                />
                <p className="font-dm text-xs leading-relaxed text-t3">
                  Your enquiry is handled under our{" "}
                  <Link href="/legal/privacy" className="underline decoration-white/30 underline-offset-2 hover:text-t1">
                    privacy notice
                  </Link>
                  . We use it only to qualify and respond to this enterprise discovery request.
                </p>
              </>
            )}

            <button
              type="button"
              onClick={continueStage}
              disabled={submitting}
              aria-busy={submitting}
              className="btn-primary min-h-11 font-dm text-sm disabled:cursor-wait disabled:opacity-60"
            >
              {submitting
                ? "Sending securely…"
                : stage === ENTERPRISE_STAGES.length - 1
                  ? "Start Enterprise Discovery"
                  : "Continue"}{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </section>
        </m.div>
      </AnimatePresence>
    </div>
  )
}

function TextField({
  id,
  label,
  type = "text",
  autoComplete = "off",
  value,
  onChange,
  multiline = false,
  rows = 5,
  hint,
  errorId,
  invalid = false,
  required = false,
}: {
  id: string
  label: string
  type?: string
  autoComplete?: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
  hint?: string
  errorId?: string
  invalid?: boolean
  required?: boolean
}) {
  const fieldId = `ent-${id}`
  const hintId = hint ? `${fieldId}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined
  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block font-dm text-sm text-t2">
        {label}
        {required ? <span className="text-acc"> *</span> : null}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className="field-control resize-y"
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className="field-control"
        />
      )}
      {hint ? (
        <span id={hintId} className="mt-1 block font-dm text-xs text-t3">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
  optional = false,
}: {
  legend: string
  name: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  optional?: boolean
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-dm text-sm text-t2">
        {legend}
        {optional ? <span className="text-t3"> (optional)</span> : <span className="text-acc"> *</span>}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Choice key={option} type="radio" name={name} option={option} checked={value === option} onChange={() => onChange(option)} />
        ))}
      </div>
    </fieldset>
  )
}

function Choice({
  type,
  name,
  option,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox"
  name: string
  option: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <m.label
      whileTap={{ scale: 0.99 }}
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 font-dm text-sm transition-[border-color,background-color,transform] ${
        checked
          ? "border-control-focus bg-acc/10 text-t1 shadow-[inset_3px_0_0_var(--acc)]"
          : "border-control text-t2 hover:border-control-hover"
      }`}
    >
      <input type={type} name={name} value={option} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--acc)]" />
      {option}
    </m.label>
  )
}
