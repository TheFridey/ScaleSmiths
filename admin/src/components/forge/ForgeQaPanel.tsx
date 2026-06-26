"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bug, CheckCircle2, ChevronDown, Circle, Hammer, Play, ScrollText, XCircle } from "lucide-react"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import { FORGE_MANDATORY_QA_CHECKS, type ForgeQaArtifactState, type ForgeQaCommandResult, type ForgeQaReport } from "@/lib/forge-qa"
import type { ForgeVisualCritiqueArtifactState } from "@/lib/forge-visual-critique"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeQaPanel({
  projectId,
  initialWorkspace,
  initialGeneratedCode,
  initialVisualCritique = { report: null, status: "empty", score: null, approvedAt: null, approvedBy: null, autoFixAppliedAt: null },
  initialQa,
  disabled = false,
}: {
  projectId: number
  initialWorkspace: ForgeWorkspaceMetadata | null
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  initialVisualCritique?: ForgeVisualCritiqueArtifactState
  initialQa: ForgeQaArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const [report, setReport] = useState<ForgeQaReport | null>(initialQa.report)
  const [busy, setBusy] = useState<"qa" | "repair" | null>(null)
  const [error, setError] = useState("")
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    setReport(initialQa.report)
  }, [initialQa])

  const readiness = useMemo(() => {
    const missing: string[] = []
    if (!initialWorkspace) missing.push("generated workspace")
    if (initialGeneratedCode.status !== "generated") missing.push("generated site code")
    if (initialVisualCritique.status !== "approved") missing.push("approved visual critique")
    return missing
  }, [initialGeneratedCode.status, initialVisualCritique.status, initialWorkspace])
  const status = report?.status ?? "not_run"
  const canRunQa = !disabled && busy === null && readiness.length === 0
  const canRepair = canRunQa && status === "failed"

  async function runAction(action: "qa" | "repair") {
    setBusy(action)
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; report: ForgeQaReport }>(`/api/forge/projects/${projectId}/qa`, { action })

      if (!json.ok) {
        throw new Error(json.error || (action === "repair" ? "Unable to repair generated site." : "Unable to run QA."))
      }

      setReport(json.report)
      setShowLogs(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run Forge QA.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Bug size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Build / Test / Repair</h2>
            <Badge value={status} tone={status === "passed" ? "good" : status === "failed" ? "bad" : "muted"} />
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Runs the mandatory Forge QA gate after generation. Typecheck, build, content, CTA, schema, design, mobile, and metadata checks must pass before the build can become ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runAction("qa")}
            disabled={!canRunQa}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <Play size={15} aria-hidden="true" /> {busy === "qa" ? "Running..." : "Run QA"}
          </button>
          <button
            type="button"
            onClick={() => void runAction("repair")}
            disabled={!canRepair}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <Hammer size={15} aria-hidden="true" /> {busy === "repair" ? "Repairing..." : "Attempt Repair"}
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

      {disabled && <Notice text="Archived projects are locked from QA and repair changes." tone="muted" />}
      {!disabled && readiness.length > 0 && <Notice text={`Ready after: ${readiness.join(", ")}.`} tone="warn" />}

      {report && <ReadinessCard report={report} />}

      <MandatoryChecklist report={report} />

      {!report ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Bug size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No QA report has been run for this generated site yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Detail label="Status" value={report.status} />
            <Detail label="Workspace" value={report.workspacePath} />
            <Detail label="Completed" value={formatDate(report.completedAt)} />
            <Detail label="Repairs" value={String(report.repairHistory.length)} />
          </div>
          {report.failureSummary && (
            <div className="rounded-lg border px-4 py-3 font-dm text-sm leading-relaxed" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.25)", color:T.t1 }}>
              {report.failureSummary}
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-4">
            {report.commands.map((command) => <CommandCard key={command.name} command={command} />)}
          </div>
          {showLogs && <LogViewer report={report} />}
          {report.repairHistory.length > 0 && (
            <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Repair history</div>
              <div className="space-y-2">
                {report.repairHistory.map((attempt) => (
                  <div key={`${attempt.attempt}-${attempt.startedAt}`} className="rounded border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-dm text-sm font-semibold">Attempt {attempt.attempt}: {attempt.status}</div>
                      <div className="font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(attempt.completedAt)}</div>
                    </div>
                    <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{attempt.summary}</p>
                    {attempt.patches.length > 0 && (
                      <div className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>
                        Files: {attempt.patches.map((patch) => patch.path).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ReadinessCard({ report }: { report: ForgeQaReport }) {
  const readiness = report.readiness
  const tone = readiness.band === "client_ready" ? T.grn : readiness.band === "strong_draft" ? T.acc : readiness.band === "needs_review" ? T.amb : T.red

  return (
    <div className="mb-4 rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 font-syne text-lg font-bold" style={{ borderColor:tone, color:tone }}>
            {readiness.score}
          </div>
          <div>
            <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Forge readiness</div>
            <div className="font-syne text-base font-bold" style={{ color:tone }}>{readiness.label}</div>
            <div className="font-dm text-[11px]" style={{ color:T.t2 }}>Score {readiness.score}/100 · {readiness.clientReady ? "all hard checks passed" : "hard checks outstanding"}</div>
          </div>
        </div>
        <span className="inline-flex w-fit rounded px-3 py-1 font-dm text-[11px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s1, border:`1px solid ${tone}`, color:tone }}>
          {readiness.clientReady ? "Client ready" : "Not client ready"}
        </span>
      </div>
      {readiness.blockingReasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {readiness.blockingReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>
              <XCircle size={13} style={{ color:T.red, marginTop:2 }} aria-hidden="true" /> {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MandatoryChecklist({ report }: { report: ForgeQaReport | null }) {
  const statuses = new Map(report?.commands.map((command) => [command.name, command.status]) ?? [])

  return (
    <div className="mb-4 rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Mandatory QA checklist</div>
        <div className="font-dm text-[11px]" style={{ color:T.t3 }}>{report ? `${report.commands.length} checks recorded` : "Waiting for QA run"}</div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {FORGE_MANDATORY_QA_CHECKS.map((item) => {
          const status = statuses.get(item.name) ?? "not_run"
          const Icon = status === "passed" ? CheckCircle2 : status === "failed" ? XCircle : Circle
          const color = status === "passed" ? T.grn : status === "failed" ? T.red : T.t3
          return (
            <div key={item.name} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2" style={{ background:T.s1, borderColor:T.b1 }}>
              <Icon size={15} style={{ color }} aria-hidden="true" />
              <div className="min-w-0">
                <div className="truncate font-dm text-xs font-semibold" style={{ color:T.t1 }}>{item.label}</div>
                <div className="font-dm text-[10px] uppercase tracking-[.05em]" style={{ color }}>{status}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CommandCard({ command }: { command: ForgeQaCommandResult }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-dm text-sm font-semibold">{command.name}</div>
        <Badge value={command.status} tone={command.status === "passed" ? "good" : command.status === "failed" ? "bad" : "muted"} />
      </div>
      <div className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>{command.command}</div>
      <div className="mt-1 font-dm text-[11px]" style={{ color:T.t3 }}>{command.durationMs}ms / exit {command.exitCode ?? "n/a"}</div>
    </div>
  )
}

function LogViewer({ report }: { report: ForgeQaReport }) {
  return (
    <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Logs</div>
      <div className="space-y-3">
        {report.commands.map((command) => (
          <details key={command.name} open={command.status === "failed"} className="rounded border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
            <summary className="cursor-pointer font-dm text-sm font-semibold">{command.name} / {command.status}</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded p-3 font-mono text-[11px]" style={{ background:T.s3, color:T.t2 }}>
              {command.stdout || command.stderr || command.skippedReason || "No output captured."}
              {command.stderr ? `\n\nstderr:\n${command.stderr}` : ""}
            </pre>
          </details>
        ))}
      </div>
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

function Badge({ value, tone }: { value: string; tone: "good" | "bad" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "bad" ? T.red : T.t2

  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}
