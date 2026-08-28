"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Circle, MinusCircle, Rocket, ShieldCheck, XCircle } from "lucide-react"
import {
  FORGE_DEPLOY_METHODS,
  buildForgeDeploymentNotesContent,
  type ForgeDeployArtifactState,
  type ForgeDeployChecklistItem,
  type ForgeDeployConfirmations,
  type ForgeDeployManualKey,
  type ForgeDeployMethod,
  type ForgeDeploymentNotes,
} from "@/lib/forge-deploy"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeDeployPanel({
  projectId,
  initialDeploy,
  siteReady,
  disabled = false,
}: {
  projectId: number
  initialDeploy: ForgeDeployArtifactState
  siteReady: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [notes, setNotes] = useState<ForgeDeploymentNotes | null>(initialDeploy.notes)
  const [method, setMethod] = useState<ForgeDeployMethod>(initialDeploy.method)
  const [confirmations, setConfirmations] = useState<ForgeDeployConfirmations>(initialDeploy.confirmations)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setNotes(initialDeploy.notes)
    setMethod(initialDeploy.method)
    setConfirmations(initialDeploy.confirmations)
  }, [initialDeploy])

  const lifecycle = notes?.lifecycle ?? "draft"
  const ready = notes?.readiness.ready ?? false
  const canAct = !disabled && busy === null && siteReady

  async function call(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action)
    setError("")
    try {
      const response = await fetch(`/api/forge/projects/${projectId}/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || "Unable to run deployment workflow.")
      setNotes(json.notes)
      if (json.notes?.confirmations) setConfirmations(json.notes.confirmations)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run deployment workflow.")
    } finally {
      setBusy(null)
    }
  }

  function toggleConfirmation(key: ForgeDeployManualKey) {
    const next = { ...confirmations, [key]: !confirmations[key] }
    setConfirmations(next)
    void call("update_checklist", { confirmations: next })
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Rocket size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Deployment</h2>
            <Badge value={lifecycle} tone={lifecycle === "deployed" ? "good" : lifecycle === "ready" ? "accent" : "muted"} />
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Controlled deployment workflow. ScaleSmiths generates instructions and config — it never mutates a client server automatically. Work the checklist, mark ready, then mark deployed once live.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && <Notice text="Archived projects are locked from deployment." />}
      {!disabled && !siteReady && <Notice text="Generate the site before preparing a deployment." />}

      <DeploymentCandidates projectId={projectId} disabled={disabled || !siteReady} />

      <div className="mb-4">
        <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Deployment method</div>
        <div className="grid gap-2 md:grid-cols-3">
          {FORGE_DEPLOY_METHODS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMethod(option.id)}
              className="rounded-lg border p-3 text-left"
              style={{ background: method === option.id ? "rgba(99,102,241,.08)" : T.s2, borderColor: method === option.id ? T.acc : T.b1 }}
            >
              <div className="font-dm text-sm font-semibold">{option.label}</div>
              <p className="mt-1 font-dm text-[11px] leading-relaxed" style={{ color:T.t2 }}>{option.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void call("prepare", { method, confirmations })}
            disabled={!canAct}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <Rocket size={15} aria-hidden="true" /> {busy === "prepare" ? "Generating..." : "Generate Deployment Notes"}
          </button>
          <button
            type="button"
            onClick={() => void call("mark_ready")}
            disabled={!canAct || lifecycle === "deployed"}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <ShieldCheck size={15} aria-hidden="true" /> {busy === "mark_ready" ? "Marking..." : "Mark Ready to Deploy"}
          </button>
          <button
            type="button"
            onClick={() => void call("mark_deployed")}
            disabled={!canAct || lifecycle !== "ready"}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <CheckCircle2 size={15} aria-hidden="true" /> {busy === "mark_deployed" ? "Marking..." : "Mark Deployed"}
          </button>
        </div>
      </div>

      {!notes ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Rocket size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No deployment has been prepared for this project yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor: ready ? T.grn : T.b1 }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Deployment checklist</div>
              <span className="font-dm text-xs font-semibold" style={{ color: ready ? T.grn : T.amb }}>{ready ? "Ready" : "Incomplete"}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {notes.checklist.map((item) => (
                <ChecklistRow
                  key={item.key}
                  item={item}
                  disabled={disabled || busy !== null}
                  onToggle={item.source === "manual" && item.status !== "skipped" ? () => toggleConfirmation(item.key as ForgeDeployManualKey) : undefined}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Deployment notes ({notes.method})</div>
            <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap rounded p-3 font-mono text-[12px] leading-relaxed" style={{ background:T.s3, color:T.t1 }}>
              {buildForgeDeploymentNotesContent(notes)}
            </pre>
          </div>
        </div>
      )}
    </section>
  )
}

type CandidateDependencyReport = { status: "passed" | "failed"; policyVersion: string; evidenceTimestamp: string; packageCount: number; warningCount: number; blockedCount: number; blockingReasons: string[]; warnings: string[]; lockfileHash: string }
type CandidateRow = { id: number; candidateNumber: number; state: string; workspaceHash: string; repositoryCommit: string | null; approvedArtifactsJson: Array<{ id: number }>; fallbackDependenciesJson: Array<{ id: number; qualityState: string }>; dependencyReportJson: CandidateDependencyReport | null; dependencyReportHash: string | null; dependencySbomHash: string | null; dependencySbomAvailable: boolean; releaseNotes: string; rollbackPlan: string; createdBy: string; createdAt: string; comparisonFromPrevious: null | { workspaceChanged: boolean; artifactsAdded: Array<{ id: number }>; artifactsRemoved: Array<{ id: number }>; artifactsChanged: Array<{ id: number }>; evidenceChanged: boolean } }
type GateResult = { allowed: boolean; summary: string; gates: Array<{ key: string; label: string; status: "passed" | "blocked" | "overridden" | "not_applicable"; reason: string; overridable: boolean; approvalActor?: string; approvalTime?: string; approvalReason?: string }> }
type DeploymentActivity = { actor: string; action: string; message: string; createdAt: string; metadataJson: { outcome?: string; failureCategory?: string } }

function DeploymentCandidates({ projectId, disabled }: { projectId: number; disabled: boolean }) {
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [releaseNotes, setReleaseNotes] = useState("")
  const [rollbackPlan, setRollbackPlan] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [gates, setGates] = useState<GateResult | null>(null)
  const [activity, setActivity] = useState<DeploymentActivity[]>([])
  const load = useCallback(async () => { const response = await fetch(`/api/forge/projects/${projectId}/deployment-candidates`); const json = await response.json(); if (response.ok) { setRows(json.candidates ?? []); setGates(json.gates ?? null); setActivity(json.deploymentActivity ?? []) } }, [projectId])
  useEffect(() => { void load() }, [load])
  async function act(action: string, candidateId?: number, gateKey?: string) { setBusy(true); setError(""); try { const response = await fetch(`/api/forge/projects/${projectId}/deployment-candidates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, candidateId, gateKey, releaseNotes, rollbackPlan, reason }) }); const json = await response.json(); if (!response.ok) throw new Error(json.error || "Candidate action failed."); setReleaseNotes(""); setRollbackPlan(""); setReason(""); await load() } catch (caught) { setError(caught instanceof Error ? caught.message : "Candidate action failed.") } finally { setBusy(false) } }
  const latest = rows[0]
  return <div className="mb-5 rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
    <div className="mb-2 flex items-center justify-between gap-2"><div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Immutable deployment candidates</div>{latest && <Badge value={`#${latest.candidateNumber} ${latest.state}`} tone={latest.state === "approved" ? "good" : "muted"} />}</div>
    <p className="mb-3 font-dm text-xs" style={{ color:T.t2 }}>A submitted candidate freezes the workspace hash, approved artifacts, QA/security/accessibility/performance evidence, screenshots, dependencies, SBOM and release requirements. Changes require a new candidate.</p>
    {error && <p className="mb-2 font-dm text-xs" style={{ color:T.red }}>{error}</p>}
    <div className="grid gap-2 md:grid-cols-2"><textarea aria-label="Candidate release notes" value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} placeholder="Release notes" className="min-h-20 rounded border p-2 text-sm" style={{ background:T.s1, borderColor:T.b1 }} /><textarea aria-label="Candidate rollback plan" value={rollbackPlan} onChange={(event) => setRollbackPlan(event.target.value)} placeholder="Rollback plan" className="min-h-20 rounded border p-2 text-sm" style={{ background:T.s1, borderColor:T.b1 }} /></div>
    <button type="button" disabled={disabled || busy || !releaseNotes.trim() || !rollbackPlan.trim()} onClick={() => void act("create")} className="mt-2 rounded border px-3 py-2 font-dm text-xs disabled:opacity-50" style={{ borderColor:T.b2 }}>Create candidate snapshot</button>
    {latest && <DependencyEvidenceSummary candidate={latest} />}
    {latest && <div className="mt-3 rounded border p-3" style={{ borderColor:T.b1, background:T.s1 }}><div className="flex flex-wrap gap-3 font-dm text-xs" style={{ color:T.t2 }}><span>Workspace {latest.workspaceHash.slice(0, 12)}</span><span>{latest.approvedArtifactsJson.length} approved artifacts</span><span>{latest.fallbackDependenciesJson.length} degraded/fallback dependencies</span>{latest.repositoryCommit && <span>Commit {latest.repositoryCommit.slice(0, 12)}</span>}</div><p className="mt-2 font-dm text-xs">{latest.releaseNotes}</p>{latest.comparisonFromPrevious && <p className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>Previous comparison: workspace {latest.comparisonFromPrevious.workspaceChanged ? "changed" : "unchanged"}; artifacts +{latest.comparisonFromPrevious.artifactsAdded.length} / −{latest.comparisonFromPrevious.artifactsRemoved.length} / changed {latest.comparisonFromPrevious.artifactsChanged.length}; evidence {latest.comparisonFromPrevious.evidenceChanged ? "changed" : "unchanged"}.</p>}
      <textarea aria-label="Candidate decision reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required approval/rejection reason" className="mt-2 min-h-14 w-full rounded border p-2 text-sm" style={{ background:T.s2, borderColor:T.b1 }} />
      <div className="mt-2 flex gap-2">{latest.state === "draft" && <button type="button" disabled={busy} onClick={() => void act("submit", latest.id)} className="rounded border px-3 py-2 font-dm text-xs" style={{ borderColor:T.b2 }}>Submit for approval</button>}{latest.state === "submitted" && <><button type="button" disabled={busy || !reason.trim()} onClick={() => void act("approve", latest.id)} className="rounded border px-3 py-2 font-dm text-xs" style={{ borderColor:T.grn }}>Approve</button><button type="button" disabled={busy || !reason.trim()} onClick={() => void act("reject", latest.id)} className="rounded border px-3 py-2 font-dm text-xs" style={{ borderColor:T.red }}>Reject</button></>}</div>
      {gates && <div className="mt-4"><div className="mb-2 font-dm text-xs font-semibold" style={{ color:gates.allowed ? T.grn : T.red }}>{gates.summary}</div><div className="grid gap-2 md:grid-cols-2">{gates.gates.map((gate) => <div key={gate.key} className="rounded border p-2" style={{ borderColor:gate.status === "blocked" ? T.red : gate.status === "overridden" ? T.amb : T.b1 }}><div className="flex items-center justify-between gap-2"><span className="font-dm text-xs font-semibold">{gate.label}</span><span className="font-dm text-[10px] uppercase" style={{ color:gate.status === "blocked" ? T.red : gate.status === "overridden" ? T.amb : T.grn }}>{gate.status}</span></div><p className="mt-1 font-dm text-[11px]" style={{ color:T.t2 }}>{gate.reason}</p>{gate.approvalActor && <p className="mt-1 font-dm text-[10px]" style={{ color:T.t3 }}>{gate.approvalActor} · {gate.approvalTime ? new Date(gate.approvalTime).toLocaleString() : ""} · {gate.approvalReason}</p>}{gate.status === "blocked" && latest.state !== "draft" && <div className="mt-2 flex gap-1">{(gate.key === "client_approval" || gate.key === "migration_plan") && <button type="button" disabled={busy || !reason.trim()} onClick={() => void act("gate_approve", latest.id, gate.key)} className="rounded border px-2 py-1 font-dm text-[10px]" style={{ borderColor:T.grn }}>Record approval</button>}{gate.overridable && <button type="button" disabled={busy || !reason.trim()} onClick={() => void act("gate_override", latest.id, gate.key)} className="rounded border px-2 py-1 font-dm text-[10px]" style={{ borderColor:T.amb }}>Owner override</button>}</div>}</div>)}</div></div>}
    </div>}
    {activity.length > 0 && <div className="mt-4 rounded border p-3" style={{ borderColor:T.b1, background:T.s1 }}><div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Recent deployment record</div>{activity.map((item, index) => <div key={`${item.createdAt}-${index}`} className="border-t py-2 first:border-t-0" style={{ borderColor:T.b1 }}><div className="flex flex-wrap justify-between gap-2 font-dm text-[11px]"><span style={{ color:item.action === "release_attempt_failed" ? T.red : T.t1 }}>{item.message}</span><span style={{ color:T.t3 }}>{new Date(item.createdAt).toLocaleString()}</span></div><p className="mt-1 font-dm text-[10px]" style={{ color:T.t3 }}>{item.actor} · {item.metadataJson?.failureCategory ?? item.metadataJson?.outcome ?? item.action}</p></div>)}</div>}
  </div>
}

function DependencyEvidenceSummary({ candidate }: { candidate: CandidateRow }) {
  const report = candidate.dependencyReportJson
  if (!report) return <p className="mt-3 rounded border p-3 font-dm text-xs" style={{ borderColor:T.red, color:T.red }}>Dependency evidence and the generated-site SPDX SBOM are missing. This candidate cannot be approved or deployed.</p>
  return <div className="mt-3 rounded border p-3" style={{ borderColor:report.status === "passed" ? T.grn : T.red, background:T.s1 }}>
    <div className="flex flex-wrap items-center gap-2"><Badge value={`Dependencies ${report.status}`} tone={report.status === "passed" ? "good" : "muted"} /><span className="font-dm text-[11px]" style={{ color:T.t2 }}>Policy {report.policyVersion} · {report.packageCount} locked packages · {report.warningCount} warning(s) · {report.blockedCount} blocker(s)</span></div>
    <p className="mt-1 font-dm text-[10px]" style={{ color:T.t3 }}>Report {candidate.dependencyReportHash?.slice(0, 12)} · SBOM {candidate.dependencySbomHash?.slice(0, 12)} · lockfile {report.lockfileHash.slice(0, 12)} · captured {new Date(report.evidenceTimestamp).toLocaleString()}</p>
    {report.blockingReasons.slice(0, 5).map((item) => <p key={item} className="mt-1 font-dm text-[11px]" style={{ color:T.red }}>Blocked: {item}</p>)}
    {report.warnings.slice(0, 3).map((item) => <p key={item} className="mt-1 font-dm text-[11px]" style={{ color:T.amb }}>Warning: {item}</p>)}
  </div>
}

function ChecklistRow({ item, disabled, onToggle }: { item: ForgeDeployChecklistItem; disabled: boolean; onToggle?: () => void }) {
  const Icon = item.status === "passed" ? CheckCircle2 : item.status === "failed" ? XCircle : item.status === "skipped" ? MinusCircle : Circle
  const color = item.status === "passed" ? T.grn : item.status === "failed" ? T.red : item.status === "skipped" ? T.t3 : T.amb
  const interactive = Boolean(onToggle)

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || !interactive}
      className="flex items-start gap-2 rounded-lg border p-3 text-left disabled:cursor-default"
      style={{ background:T.s1, borderColor:T.b1, cursor: interactive && !disabled ? "pointer" : "default" }}
    >
      <Icon size={16} style={{ color }} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-dm text-sm font-semibold">{item.label}</span>
        <span className="ml-2 font-dm text-[10px] uppercase tracking-[.05em]" style={{ color }}>{item.status}</span>
        <p className="mt-0.5 font-dm text-[11px] leading-relaxed" style={{ color:T.t2 }}>{item.detail}</p>
      </span>
    </button>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "accent" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "accent" ? T.acc : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
