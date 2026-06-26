"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Eye, Hammer, Play, Sparkles } from "lucide-react"
import type { ForgeComponentSpecArtifactState } from "@/lib/forge-component-spec"
import type { ForgeCopyArtifactState } from "@/lib/forge-copy"
import type { ForgeDesignArtifactState } from "@/lib/forge-design"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import { submitForgeJob } from "@/lib/forge-job-client"
import type { ForgeVisualCritiqueArtifactState, ForgeVisualCritiqueReport, ForgeVisualCritiqueRecommendation } from "@/lib/forge-visual-critique"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeVisualCritiquePanel({
  projectId,
  initialDesign,
  initialCopy,
  initialComponentSpec,
  initialGeneratedCode,
  initialCritique,
  disabled = false,
}: {
  projectId: number
  initialDesign: ForgeDesignArtifactState
  initialCopy: ForgeCopyArtifactState
  initialComponentSpec: ForgeComponentSpecArtifactState
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  initialCritique: ForgeVisualCritiqueArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const [report, setReport] = useState<ForgeVisualCritiqueReport | null>(initialCritique.report)
  const [busy, setBusy] = useState<"run" | "approve" | "auto_fix" | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setReport(initialCritique.report)
  }, [initialCritique])

  const readiness = useMemo(() => {
    const missing: string[] = []
    if (initialDesign.status !== "approved") missing.push("approved design direction")
    if (initialCopy.status !== "approved") missing.push("approved copy")
    if (initialComponentSpec.status !== "approved") missing.push("approved component specification")
    if (initialGeneratedCode.status !== "generated") missing.push("generated site")
    return missing
  }, [initialComponentSpec.status, initialCopy.status, initialDesign.status, initialGeneratedCode.status])

  const safeFixes = report?.recommendations.filter((item) => item.safeAutoFix && item.safeFixType !== "none") ?? []
  const status = report?.status ?? "empty"
  const canRun = !disabled && busy === null && readiness.length === 0
  const canApprove = canRun && Boolean(report) && report?.status !== "approved"
  const canAutoFix = canRun && Boolean(report) && safeFixes.length > 0

  async function runAction(action: "run" | "approve" | "auto_fix") {
    setBusy(action)
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; report: ForgeVisualCritiqueReport }>(
        `/api/forge/projects/${projectId}/visual-critique`,
        { action },
      )

      if (!json.ok) {
        throw new Error(json.error || "Unable to run visual critique.")
      }

      setReport(json.report)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run visual critique.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Eye size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Visual Critique</h2>
            <Badge value={status} tone={status === "approved" ? "good" : status === "draft" ? "warn" : "muted"} />
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Reviews the generated site against approved design, copy, and component specification before QA. Auto-fix is restricted to spacing, safe section-ordering guidance, CTA positioning, and trust placement notes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void runAction("run")} disabled={!canRun} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ background:T.acc }}>
            <Play size={15} aria-hidden="true" /> {busy === "run" ? "Running..." : "Run Critique"}
          </button>
          <button type="button" onClick={() => void runAction("approve")} disabled={!canApprove} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60" style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}>
            <CheckCircle2 size={15} aria-hidden="true" /> {busy === "approve" ? "Approving..." : "Approve Recommendations"}
          </button>
          <button type="button" onClick={() => void runAction("auto_fix")} disabled={!canAutoFix} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60" style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}>
            <Hammer size={15} aria-hidden="true" /> {busy === "auto_fix" ? "Applying..." : "Apply Safe Fixes"}
          </button>
        </div>
      </div>

      {error && <Notice text={error} tone="bad" />}
      {disabled && <Notice text="Archived projects are locked from visual critique." tone="muted" />}
      {!disabled && readiness.length > 0 && <Notice text={`Ready after: ${readiness.join(", ")}.`} tone="warn" />}

      {!report ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Sparkles size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No visual critique has been generated for this site yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Score label="Overall" value={report.overallScore} />
            <Score label="Brand Fit" value={report.scores.brandFit} />
            <Score label="Visual Quality" value={report.scores.visualQuality} />
            <Score label="CTA Relevance" value={report.scores.ctaRelevance} />
            <Score label="Specificity" value={report.scores.contentSpecificity} />
            <Score label="SEO/AEO" value={report.scores.seoAeoQuality} />
            <Score label="Accessibility" value={report.scores.accessibility} />
            <Score label="Mobile" value={report.scores.mobileReadiness} />
            <Score label="Client Ready" value={report.scores.clientReadiness} />
          </div>

          <p className="font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>{report.summary}</p>

          <div className="grid gap-3 lg:grid-cols-2">
            <ListBlock title="Strengths" items={report.strengths} tone="good" />
            <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Weaknesses</div>
              <div className="space-y-2">
                {report.weaknesses.map((item) => (
                  <div key={`${item.category}-${item.finding}`} className="rounded border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-dm text-sm font-semibold">{item.category}</div>
                      <Badge value={item.severity} tone={severityTone(item.severity)} />
                    </div>
                    <p className="font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{item.finding}</p>
                    <p className="mt-1 font-dm text-[11px]" style={{ color:T.t3 }}>{item.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Recommendations items={report.recommendations} />

          {report.autoFixesApplied.length > 0 && (
            <ListBlock title="Safe Fixes Applied" items={report.autoFixesApplied} tone="accent" />
          )}
        </div>
      )}
    </section>
  )
}

function Recommendations({ items }: { items: ForgeVisualCritiqueRecommendation[] }) {
  return (
    <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Recommendations</div>
      <div className="grid gap-2 lg:grid-cols-2">
        {items.map((item) => (
          <div key={`${item.category}-${item.title}`} className="rounded border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="font-dm text-sm font-semibold">{item.title}</div>
              <Badge value={item.safeAutoFix ? item.safeFixType : item.severity} tone={item.safeAutoFix ? "good" : severityTone(item.severity)} />
            </div>
            <p className="font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{item.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: "good" | "accent" }) {
  return (
    <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{title}</div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="font-dm text-xs leading-relaxed" style={{ color:tone === "good" ? T.grn : T.t2 }}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  const color = value >= 85 ? T.grn : value >= 70 ? T.amb : T.red
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-1 font-syne text-2xl font-extrabold" style={{ color }}>{value}<span className="font-dm text-sm font-normal" style={{ color:T.t3 }}>/100</span></div>
    </div>
  )
}

function Notice({ text, tone }: { text: string; tone: "warn" | "muted" | "bad" }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:tone === "bad" ? "rgba(239,68,68,.08)" : T.s2, borderColor:tone === "warn" ? T.amb : tone === "bad" ? "rgba(239,68,68,.3)" : T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "warn" | "bad" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "bad" ? T.red : tone === "warn" ? T.amb : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}

function severityTone(severity: string): "good" | "warn" | "bad" | "muted" {
  if (severity === "High") return "bad"
  if (severity === "Medium") return "warn"
  if (severity === "Low") return "good"
  return "muted"
}
