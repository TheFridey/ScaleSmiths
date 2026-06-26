import { Coins, Gauge, Hammer, RefreshCw, ShieldX, TrendingUp } from "lucide-react"
import type { ForgeCostQualitySummary } from "@/lib/forge-cost-quality"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

function formatUsd(value: number | null) {
  if (value === null) return "-"
  return `$${value.toFixed(value < 1 ? 4 : 2)}`
}

function formatDuration(ms: number | null) {
  if (ms === null) return "-"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ForgeCostQualityPanel({ costQuality }: { costQuality: ForgeCostQualitySummary }) {
  const { draft, refinement } = costQuality
  const qualityTone = costQuality.qualityScore === null
    ? T.t3
    : costQuality.qualityScore >= 90 ? T.grn : costQuality.qualityScore >= 75 ? T.acc : costQuality.qualityScore >= 60 ? T.amb : T.red
  const draftTone = draft.isDraft ? (draft.withinFirstPassBudget ? T.amb : T.red) : T.grn

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-4 flex items-center gap-2">
        <Coins size={16} style={{ color:T.acc }} aria-hidden="true" />
        <h2 className="font-syne text-lg font-bold">Cost &amp; Quality</h2>
        <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${draftTone}`, color:draftTone }}>
          {draft.label}
        </span>
      </div>

      {/* Headline decision metrics. */}
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Coins} label="Cost so far" value={formatUsd(costQuality.costSoFarUsd)} tone={T.t1} />
        <Metric icon={TrendingUp} label="Est. cost to improve" value={formatUsd(costQuality.estimatedCostToImproveUsd)} tone={T.t1} />
        <Metric icon={Gauge} label="Quality score" value={costQuality.qualityScore === null ? "Not run" : `${costQuality.qualityScore}/100`} tone={qualityTone} />
        <Metric icon={RefreshCw} label="Refinement pass" value={refinement.recommended ? "Recommended" : "Not needed"} tone={refinement.recommended ? T.amb : T.grn} />
      </div>

      {/* Draft rule + refinement guidance. */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border px-4 py-3" style={{ background:T.s2, borderColor:draftTone === T.grn ? T.b1 : draftTone }}>
          <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Readiness label</div>
          <div className="mt-1 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{draft.note}</div>
        </div>
        <div className="rounded-lg border px-4 py-3" style={{ background:T.s2, borderColor:refinement.recommended ? T.amb : T.b1 }}>
          <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Refinement recommendation</div>
          <div className="mt-1 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{refinement.reason}</div>
        </div>
      </div>

      {/* Tracked build/cost signals. */}
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Hammer} label="Build duration" value={formatDuration(costQuality.buildDurationMs)} tone={T.t1} />
        <Metric icon={RefreshCw} label="AI retries" value={String(costQuality.retries)} tone={costQuality.retries > 0 ? T.amb : T.t1} />
        <Metric icon={ShieldX} label="QA failures" value={String(costQuality.qaFailures)} tone={costQuality.qaFailures > 0 ? T.red : T.t1} />
        <Metric icon={Hammer} label="Repair passes" value={String(costQuality.repairPasses)} tone={costQuality.repairPasses > 0 ? T.amb : T.t1} />
      </div>

      {/* Per-stage cost breakdown. */}
      <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Cost per stage</div>
          <div className="font-dm text-[11px]" style={{ color:T.t3 }}>
            {costQuality.models.length ? costQuality.models.map((model) => `${model.provider}/${model.model}`).join(", ") : "No model usage recorded"}
          </div>
        </div>
        {costQuality.costPerStage.length === 0 ? (
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No AI spend recorded for this project yet.</p>
        ) : (
          <div className="space-y-2">
            {costQuality.costPerStage.map((stage) => {
              const pct = costQuality.totalCostUsd > 0 ? Math.round((stage.costUsd / costQuality.totalCostUsd) * 100) : 0
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between font-dm text-xs" style={{ color:T.t2 }}>
                    <span className="font-semibold capitalize" style={{ color:T.t1 }}>{stage.stage}</span>
                    <span>{formatUsd(stage.costUsd)} / {stage.calls} call{stage.calls === 1 ? "" : "s"} / {pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background:T.s3 }}>
                    <div className="h-full rounded-full" style={{ width:`${pct}%`, background:T.acc }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} style={{ color:T.t3 }} aria-hidden="true" />
        <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      </div>
      <div className="mt-1 font-syne text-lg font-bold" style={{ color:tone }}>{value}</div>
    </div>
  )
}
