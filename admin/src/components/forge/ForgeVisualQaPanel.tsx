"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Gauge, Play, ScrollText } from "lucide-react"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import type {
  ForgeQualityBadge,
  ForgeSmokeTest,
  ForgeVisualQaArtifactState,
  ForgeVisualQaReport,
} from "@/lib/forge-visual-qa"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeVisualQaPanel({
  projectId,
  initialWorkspace,
  initialGeneratedCode,
  initialVisualQa,
  disabled = false,
}: {
  projectId: number
  initialWorkspace: ForgeWorkspaceMetadata | null
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  initialVisualQa: ForgeVisualQaArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const [report, setReport] = useState<ForgeVisualQaReport | null>(initialVisualQa.report)
  const [badges, setBadges] = useState<ForgeQualityBadge[]>(initialVisualQa.badges)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    setReport(initialVisualQa.report)
    setBadges(initialVisualQa.badges)
  }, [initialVisualQa])

  const readiness = useMemo(() => {
    const missing: string[] = []
    if (!initialWorkspace) missing.push("generated workspace")
    if (initialGeneratedCode.status !== "generated") missing.push("generated site code")
    return missing
  }, [initialGeneratedCode.status, initialWorkspace])

  const status = report?.status ?? "skipped"
  const canRun = !disabled && !busy && readiness.length === 0

  async function run() {
    setBusy(true)
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/visual-qa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to run Lighthouse & visual QA.")
      }

      setReport(json.report)
      setBadges(json.report?.badges ?? [])
      setShowLogs(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run Lighthouse & visual QA.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Gauge size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Lighthouse & Visual QA</h2>
            <Badge value={status} tone={status === "passed" ? "good" : status === "failed" ? "bad" : "muted"} />
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Runs Lighthouse scoring (performance, accessibility, best practices, SEO) and browser smoke tests (homepage, navigation, contact form, service pages, console errors, mobile viewport). Fails gracefully when Lighthouse/Playwright are unavailable so progress is never blocked.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={!canRun}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <Play size={15} aria-hidden="true" /> {busy ? "Running..." : "Run Visual QA"}
          </button>
          <button
            type="button"
            onClick={() => setShowLogs((value) => !value)}
            disabled={!report}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <ScrollText size={15} aria-hidden="true" /> View Logs <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && <Notice text="Archived projects are locked from visual QA." tone="muted" />}
      {!disabled && readiness.length > 0 && <Notice text={`Ready after: ${readiness.join(", ")}.`} tone="warn" />}

      {badges.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Quality badges</div>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => <QualityBadge key={badge.key} badge={badge} />)}
          </div>
        </div>
      )}

      {!report ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Gauge size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No Lighthouse or visual QA run has been recorded for this generated site yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>{report.summary}</p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ScoreCard label="Performance" value={report.lighthouse.scores.performance} available={report.lighthouse.available} />
            <ScoreCard label="Accessibility" value={report.lighthouse.scores.accessibility} available={report.lighthouse.available} />
            <ScoreCard label="Best Practices" value={report.lighthouse.scores.bestPractices} available={report.lighthouse.available} />
            <ScoreCard label="SEO" value={report.lighthouse.scores.seo} available={report.lighthouse.available} />
          </div>

          {!report.lighthouse.available && (
            <Notice text={report.lighthouse.unavailableReason ?? "Lighthouse was unavailable in this environment."} tone="muted" />
          )}

          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Smoke tests</div>
            <div className="grid gap-2 md:grid-cols-2">
              {report.smokeTests.map((test) => <SmokeCard key={test.name} test={test} />)}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Detail label="Mobile viewport" value={`${report.mobile.status} — ${report.mobile.detail}`} />
            <Detail label="Console errors" value={`${report.consoleErrors.status} — ${report.consoleErrors.count}/${report.consoleErrors.threshold} allowed`} />
          </div>

          {report.recommendations.length > 0 && (
            <div className="rounded-lg border px-4 py-3" style={{ background:"rgba(245,158,11,.08)", borderColor:T.amb }}>
              <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Recommendations</div>
              <ul className="space-y-1">
                {report.recommendations.map((item) => <li key={item} className="font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>• {item}</li>)}
              </ul>
            </div>
          )}

          {showLogs && (
            <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Logs</div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded p-3 font-mono text-[11px]" style={{ background:T.s3, color:T.t2 }}>
                {report.logs.length ? report.logs.join("\n") : "No logs captured."}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function QualityBadge({ badge }: { badge: ForgeQualityBadge }) {
  const tone = badge.status === "pass" ? T.grn : badge.status === "fail" ? T.red : badge.status === "warn" ? T.amb : T.t3
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-dm text-xs font-semibold" style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background:tone }} aria-hidden="true" />
      {badge.label}
      <span className="font-normal" style={{ color:T.t3 }}>{badge.value}</span>
    </span>
  )
}

function ScoreCard({ label, value, available }: { label: string; value: number | null; available: boolean }) {
  const display = !available || value === null ? "—" : String(value)
  const tone = value === null ? T.t3 : value >= 90 ? T.grn : value >= 50 ? T.amb : T.red
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-1 font-syne text-2xl font-extrabold" style={{ color:tone }}>{display}{available && value !== null && <span className="font-dm text-sm font-normal" style={{ color:T.t3 }}>/100</span>}</div>
    </div>
  )
}

function SmokeCard({ test }: { test: ForgeSmokeTest }) {
  return (
    <div className="rounded border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-dm text-sm font-semibold">{test.name}</div>
        <Badge value={test.status} tone={test.status === "passed" ? "good" : test.status === "failed" ? "bad" : test.status === "warning" ? "warn" : "muted"} />
      </div>
      <p className="mt-1 font-dm text-[11px] leading-relaxed" style={{ color:T.t2 }}>{test.detail}</p>
    </div>
  )
}

function Notice({ text, tone }: { text: string; tone: "warn" | "muted" }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:tone === "warn" ? T.amb : T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-1 break-words font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{value}</div>
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "bad" | "warn" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "bad" ? T.red : tone === "warn" ? T.amb : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
