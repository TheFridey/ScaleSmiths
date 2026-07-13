"use client"

import { FormEvent, useState, type InputHTMLAttributes } from "react"
import { Calculator, Save, TrendingUp } from "lucide-react"
import type { ProjectEstimateResult } from "@/lib/project-estimator"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export interface ProjectEstimateSnapshot {
  id: number
  projectId: number
  estimatedHours: number
  confidence: string
  confidenceRange: ProjectEstimateResult["confidenceRange"]
  complexityRating: string
  riskFactors: ProjectEstimateResult["riskFactors"]
  suggestedBuildPrice: number
  suggestedRetainer: number
  minimumViableScope: string[]
  optionalEnhancements: string[]
  estimatedDeliveryRange: ProjectEstimateResult["estimatedDeliveryRange"]
  marginEstimate: ProjectEstimateResult["marginEstimate"]
  knownInputs: ProjectEstimateResult["knownInputs"]
  assumptions: ProjectEstimateResult["assumptions"]
  underpricingRisks: string[]
  disclaimer: string
  modelVersion: string
  manualHours: number | null
  manualBuildPrice: number | null
  manualRetainer: number | null
  manualReason: string | null
  manualBy: string | null
  manualAt: Date | string | null
  actualHours: number | null
  actualBuildPrice: number | null
  actualRetainer: number | null
  actualNotes: string | null
  actualRecordedAt: Date | string | null
  createdAt: Date | string
}

export function ForgeEstimatorPanel({ projectId, initialEstimate, disabled = false }: { projectId: number; initialEstimate: ProjectEstimateSnapshot | null; disabled?: boolean }) {
  const [estimate, setEstimate] = useState(initialEstimate)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const effectiveHours = estimate?.manualHours ?? estimate?.estimatedHours ?? 0
  const effectiveBuild = estimate?.manualBuildPrice ?? estimate?.suggestedBuildPrice ?? 0
  const effectiveRetainer = estimate?.manualRetainer ?? estimate?.suggestedRetainer ?? 0

  async function createEstimate() {
    await call("estimate", "POST", {})
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await call("adjust", "PATCH", { action: "adjust", ...Object.fromEntries(new FormData(event.currentTarget)) })
  }

  async function recordActuals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await call("actuals", "PATCH", { action: "actuals", ...Object.fromEntries(new FormData(event.currentTarget)) })
  }

  async function call(key: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(key)
    setError("")
    try {
      const response = await fetch(`/api/forge/projects/${projectId}/estimate`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.ok === false) throw new Error(json.error || "Estimator request failed.")
      setEstimate(json.snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Estimator request failed.")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-syne text-lg font-bold"><Calculator size={17} style={{ color:T.acc }} /> Project Estimator</h2>
            <p className="mt-1 max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>Internal quote support only. Estimates separate known inputs from assumptions and are not guarantees.</p>
          </div>
          <button onClick={createEstimate} disabled={disabled || Boolean(busy)} className="rounded-lg px-3 py-2 font-dm text-sm font-semibold text-white disabled:opacity-60" style={{ background:T.acc }}>{busy === "estimate" ? "Estimating..." : estimate ? "Re-estimate" : "Create estimate"}</button>
        </div>
        {error && <div className="mt-3 rounded border px-3 py-2 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>{error}</div>}
      </div>

      {!estimate ? (
        <div className="rounded-[8px] border border-dashed p-5 font-dm text-sm" style={{ borderColor:T.b1, color:T.t2 }}>No internal project estimate has been created yet.</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Hours" value={`${effectiveHours}h`} sub={`${estimate.confidenceRange.low}-${estimate.confidenceRange.high}h ${estimate.confidence} confidence`} />
            <Metric label="Build price" value={money(effectiveBuild)} sub={`Margin ${estimate.marginEstimate.grossMarginPercent}% before overhead`} />
            <Metric label="Retainer" value={`${money(effectiveRetainer)}/mo`} sub={estimate.complexityRating} />
            <Metric label="Delivery" value={`${estimate.estimatedDeliveryRange.minWeeks}-${estimate.estimatedDeliveryRange.maxWeeks} wks`} sub="range, not guarantee" />
          </div>

          {estimate.manualReason && <Notice tone="warn" text={`Manual adjustment by ${estimate.manualBy ?? "admin"}: ${estimate.manualReason}`} />}
          <Notice tone="warn" text={estimate.disclaimer} />

          <Section title="Known Inputs" items={estimate.knownInputs.map((item) => `${item.label}: ${String(item.value)} - ${item.evidence}`)} />
          <Section title="Assumptions" items={estimate.assumptions.map((item) => `${item.label}: ${String(item.value)} - ${item.evidence}`)} />
          <Section title="Risk Factors" items={estimate.riskFactors.map((risk) => `${risk.severity}: ${risk.explanation} (+${risk.impactHours}h)`)} />
          <Section title="Underpricing Risks" items={estimate.underpricingRisks} />
          <Section title="Minimum Viable Scope" items={estimate.minimumViableScope} />
          <Section title="Optional Enhancements" items={estimate.optionalEnhancements.slice(0, 8)} />

          <div className="grid gap-4 lg:grid-cols-2">
            <form onSubmit={adjust} className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
              <h3 className="mb-3 flex items-center gap-2 font-syne text-sm font-bold"><Save size={15} style={{ color:T.amb }} /> Manual Adjustment</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Hours" name="hours" type="number" min="0" defaultValue={String(effectiveHours)} />
                <Field label="Build price" name="buildPrice" type="number" min="0" defaultValue={String(effectiveBuild)} />
                <Field label="Retainer" name="retainer" type="number" min="0" defaultValue={String(effectiveRetainer)} />
              </div>
              <Field label="Reason" name="reason" defaultValue={estimate.manualReason ?? ""} placeholder="Why human judgement changes this estimate" />
              <button disabled={disabled || busy === "adjust"} className="mt-3 rounded-lg px-3 py-2 font-dm text-sm font-semibold text-white disabled:opacity-60" style={{ background:T.amb }}>{busy === "adjust" ? "Saving..." : "Save adjustment"}</button>
            </form>

            <form onSubmit={recordActuals} className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
              <h3 className="mb-3 flex items-center gap-2 font-syne text-sm font-bold"><TrendingUp size={15} style={{ color:T.grn }} /> Actual Effort</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Actual hours" name="actualHours" type="number" min="0" defaultValue={String(estimate.actualHours ?? effectiveHours)} />
                <Field label="Actual build" name="actualBuildPrice" type="number" min="0" defaultValue={String(estimate.actualBuildPrice ?? effectiveBuild)} />
                <Field label="Actual retainer" name="actualRetainer" type="number" min="0" defaultValue={String(estimate.actualRetainer ?? effectiveRetainer)} />
              </div>
              <Field label="Notes" name="notes" defaultValue={estimate.actualNotes ?? ""} placeholder="Calibration notes after delivery" />
              <button disabled={disabled || busy === "actuals"} className="mt-3 rounded-lg px-3 py-2 font-dm text-sm font-semibold text-white disabled:opacity-60" style={{ background:T.grn }}>{busy === "actuals" ? "Saving..." : "Record actuals"}</button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}><div className="font-dm text-[11px]" style={{ color:T.t3 }}>{label}</div><div className="mt-1 font-syne text-2xl font-extrabold">{value}</div><div className="font-dm text-[11px]" style={{ color:T.t2 }}>{sub}</div></div>
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return <section className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}><h3 className="font-syne text-sm font-bold">{title}</h3><ul className="mt-2 space-y-1">{items.map((item) => <li key={item} className="font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{item}</li>)}</ul></section>
}

function Notice({ tone, text }: { tone: "warn" | "good"; text: string }) {
  return <div className="rounded-[8px] border px-3 py-2 font-dm text-sm leading-relaxed" style={{ background:tone === "warn" ? "rgba(245,158,11,.08)" : "rgba(16,185,129,.08)", borderColor:tone === "warn" ? "rgba(245,158,11,.3)" : "rgba(16,185,129,.3)", color:T.t1 }}>{text}</div>
}

function Field({ label, name, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="mt-2 block font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>{label}</span><input name={name} {...props} /></label>
}

function money(value: number) {
  return `GBP ${value.toLocaleString()}`
}
