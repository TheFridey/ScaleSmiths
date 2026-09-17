"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  confirmationPhraseFor,
  type ForgeOpsAlert,
  type ForgeOpsJobRow,
  type ForgeOpsPreviewRow,
  type ForgeOpsRecoveryAction,
  type ForgeOpsSnapshot,
} from "@/lib/forge-ops-health"

export function ForgeOpsDashboard({ snapshot, canRecover }: { snapshot: ForgeOpsSnapshot; canRecover: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [retryJobId, setRetryJobId] = useState(String(snapshot.deadLetters.items[0]?.id ?? ""))

  const retryPhrase = useMemo(
    () => confirmationPhraseFor("retry_dead_letter", { jobId: Number(retryJobId) || undefined }),
    [retryJobId],
  )

  async function recover(action: ForgeOpsRecoveryAction, confirmation: string, jobId?: number) {
    setBusy(action)
    setError(null)
    setNotice(null)
    const response = await fetch("/api/operations/forge-health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, confirmation, jobId }),
    })
    const payload = await response.json().catch(() => null) as { error?: string; result?: { message?: string } } | null
    setBusy(null)
    if (!response.ok) {
      setError(payload?.error ?? "Recovery action failed.")
      return
    }
    setNotice(payload?.result?.message ?? "Recovery action completed.")
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <header className="space-y-2">
        <p className="text-sm text-cyan-300">Operations</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-syne text-3xl font-bold">Forge queue and preview health</h1>
            <p className="max-w-3xl text-sm text-t2">
              Durable queue depth, leases, retries, dead letters and preview ownership. This view shows identifiers and sanitised operator summaries only — not prompts, generated sites or secret-bearing failures.
            </p>
          </div>
          <div className="rounded border border-b1 bg-s1 px-4 py-3 text-sm text-t2">
            Generated {new Date(snapshot.generatedAt).toLocaleString("en-GB")}
            <div>Worker {snapshot.workerEnabled ? "enabled" : "disabled"} · {snapshot.workers.length} heartbeat(s)</div>
          </div>
        </div>
      </header>

      {snapshot.alerts.length > 0 && (
        <section className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <h2 className="font-semibold">Threshold alerts</h2>
          <p className="mt-1 text-amber-100/80">These codes are the same signals a later monitoring adapter can page on. They do not require Sentry to render here.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {snapshot.alerts.map((alert) => <AlertItem key={`${alert.code}:${alert.severity}`} alert={alert} />)}
          </ul>
        </section>
      )}

      {error && <p className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>}
      {notice && <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Queue depth" value={snapshot.queue.depth.toLocaleString()} detail={ageDetail(snapshot.queue.oldestQueuedAgeMs, snapshot.queue.oldestQueuedJobId)} />
        <Metric label="Active leases" value={snapshot.leases.active.toLocaleString()} detail={`${snapshot.leases.expired} expired`} />
        <Metric label="Retry storm" value={snapshot.retries.stormCount.toLocaleString()} detail={`Attempts ≥ ${snapshot.retries.minAttempts}`} />
        <Metric label="Dead letters" value={snapshot.deadLetters.count.toLocaleString()} detail="Retained for investigation" />
        <Metric label="Previews running" value={snapshot.previews.running.toLocaleString()} detail={`${snapshot.previews.abandoned} abandoned`} />
        <Metric label="Inaccessible owners" value={snapshot.previews.inaccessible.toLocaleString()} detail="Live lease, unreachable instance" />
        <Metric label="Workers" value={snapshot.workers.length.toLocaleString()} detail={snapshot.workers.map((worker) => worker.state).join(", ") || "none"} />
        <Metric label="Queued by status" value={String(snapshot.queue.byStatus.queued ?? 0)} detail={Object.entries(snapshot.queue.byStatus).map(([status, count]) => `${status}:${count}`).join(" · ") || "empty"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Workers">
          {snapshot.workers.length === 0 ? <Empty>No worker heartbeats recorded.</Empty> : (
            <Table headers={["Worker", "Host", "Jobs", "State", "Heartbeat"]}>
              {snapshot.workers.map((worker) => (
                <tr key={worker.workerId}>
                  <td className="font-mono text-xs">{worker.workerId}</td>
                  <td>{worker.hostname}:{worker.processId}</td>
                  <td>{worker.activeJobCount}</td>
                  <td>{worker.state}</td>
                  <td>{formatTime(worker.lastHeartbeatAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
        <Panel title="Oldest queued work">
          <JobTable jobs={snapshot.queue.oldestQueued} empty="Queue is empty." />
        </Panel>
        <Panel title="Active and expired leases">
          {snapshot.leases.items.length === 0 ? <Empty>No running leases.</Empty> : (
            <Table headers={["Job", "Project", "Worker", "Expiry", "State"]}>
              {snapshot.leases.items.map((lease) => (
                <tr key={lease.jobId}>
                  <td><JobLink id={lease.jobId} kind={lease.kind} /></td>
                  <td><ProjectLink id={lease.projectId} name={lease.projectName} /></td>
                  <td className="font-mono text-xs">{lease.workerId}</td>
                  <td>{formatTime(lease.leaseExpiresAt)}</td>
                  <td>{lease.expired ? "expired" : "active"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
        <Panel title="Retry storms">
          <JobTable jobs={snapshot.retries.items} empty="No in-flight jobs have retried above the threshold." />
        </Panel>
        <Panel title="Dead letters">
          <JobTable jobs={snapshot.deadLetters.items} empty="No dead letters." showFailure />
        </Panel>
        <Panel title="Preview ownership">
          {snapshot.previews.items.length === 0 ? <Empty>No preview rows.</Empty> : (
            <Table headers={["Project", "Status", "Ownership", "Owner", "Lease"]}>
              {snapshot.previews.items.map((preview) => (
                <tr key={preview.projectId}>
                  <td><ProjectLink id={preview.projectId} name={preview.projectName} /></td>
                  <td>{preview.status}</td>
                  <td>{ownershipLabel(preview)}</td>
                  <td className="font-mono text-xs">{preview.owner ?? "none"}</td>
                  <td>{preview.leaseExpiresAt ? formatTime(preview.leaseExpiresAt) : "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </section>

      <section className="rounded border border-b1 bg-s1 p-4">
        <h2 className="font-syne text-xl font-semibold">Documented recovery</h2>
        <p className="mt-1 max-w-3xl text-sm text-t2">
          Each action requires an exact confirmation phrase and writes a Forge activity audit entry. Live leases are never taken over. Inaccessible preview owners must wait until their lease expires, then use preview reconciliation.
        </p>
        {!canRecover && <p className="mt-3 text-sm text-t2">Recovery requires <code>forge.configure</code>. This role can inspect health only.</p>}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <RecoveryCard
            title="Retry dead letter"
            phrase={retryPhrase}
            disabled={!canRecover || busy !== null || snapshot.deadLetters.count === 0}
            busy={busy === "retry_dead_letter"}
            extra={(
              <label className="block text-sm text-t2">
                Job id
                <input
                  className="mt-1 w-full rounded border border-b2 bg-s2 px-3 py-2 text-t1"
                  value={retryJobId}
                  onChange={(event) => setRetryJobId(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            )}
            onSubmit={(confirmation) => recover("retry_dead_letter", confirmation, Number(retryJobId))}
          />
          <RecoveryCard
            title="Reap expired leases"
            phrase={confirmationPhraseFor("reap_expired_leases")}
            disabled={!canRecover || busy !== null}
            busy={busy === "reap_expired_leases"}
            onSubmit={(confirmation) => recover("reap_expired_leases", confirmation)}
          />
          <RecoveryCard
            title="Reconcile abandoned previews"
            phrase={confirmationPhraseFor("reconcile_abandoned_previews")}
            disabled={!canRecover || busy !== null}
            busy={busy === "reconcile_abandoned_previews"}
            onSubmit={(confirmation) => recover("reconcile_abandoned_previews", confirmation)}
          />
        </div>
      </section>
    </div>
  )
}

function RecoveryCard({
  title,
  phrase,
  disabled,
  busy,
  extra,
  onSubmit,
}: {
  title: string
  phrase: string
  disabled: boolean
  busy: boolean
  extra?: ReactNode
  onSubmit: (confirmation: string) => void
}) {
  const [confirmation, setConfirmation] = useState("")
  return (
    <form
      className="space-y-3 rounded border border-b2 bg-s2 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(confirmation)
      }}
    >
      <h3 className="font-semibold">{title}</h3>
      {extra}
      <label className="block text-sm text-t2">
        Type <span className="font-mono text-t1">{phrase}</span>
        <input
          className="mt-1 w-full rounded border border-b2 bg-s1 px-3 py-2 font-mono text-sm text-t1"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
        />
      </label>
      <button type="submit" disabled={disabled || confirmation !== phrase} className="rounded-lg border border-b2 px-3 py-2 text-sm disabled:opacity-50">
        {busy ? "Working…" : "Confirm and run"}
      </button>
    </form>
  )
}

function JobTable({ jobs, empty, showFailure }: { jobs: ForgeOpsJobRow[]; empty: string; showFailure?: boolean }) {
  if (!jobs.length) return <Empty>{empty}</Empty>
  return (
    <Table headers={showFailure ? ["Job", "Project", "Attempts", "Age", "Failure"] : ["Job", "Project", "Status", "Attempts", "Age"]}>
      {jobs.map((job) => (
        <tr key={job.id}>
          <td><JobLink id={job.id} kind={job.kind} /></td>
          <td><ProjectLink id={job.projectId} name={job.projectName} /></td>
          {showFailure ? <td>{job.attempts}/{job.maxAttempts}</td> : <td>{job.status}{job.leaseExpired ? " · expired lease" : ""}</td>}
          {showFailure ? null : <td>{job.attempts}/{job.maxAttempts}</td>}
          <td>{formatAge(job.ageMs)}</td>
          {showFailure ? <td>{job.failureSummary ?? "—"}</td> : null}
        </tr>
      ))}
    </Table>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-b1 bg-s1 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-t2">{label}</div>
      <div className="font-syne text-2xl font-bold">{value}</div>
      <div className="text-sm text-t2">{detail}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-b1 bg-s1 p-4">
      <h2 className="mb-3 font-syne text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="text-t2">
            {headers.map((header) => <th key={header} className="pb-2 pr-3 font-medium">{header}</th>)}
          </tr>
        </thead>
        <tbody className="align-top [&_td]:py-1.5 [&_td]:pr-3">{children}</tbody>
      </table>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-t2">{children}</p>
}

function AlertItem({ alert }: { alert: ForgeOpsAlert }) {
  return <li><span className="font-mono">{alert.code}</span> · {alert.severity} · {alert.summary}</li>
}

function JobLink({ id, kind }: { id: number; kind: string }) {
  return <span className="font-medium">{kind} #{id}</span>
}

function ProjectLink({ id, name }: { id: number; name: string | null }) {
  return <Link className="underline decoration-b2 underline-offset-2" href={`/forge/${id}`}>{name ?? `Project ${id}`}</Link>
}

function ownershipLabel(preview: ForgeOpsPreviewRow) {
  if (preview.ownership === "inaccessible") return "inaccessible owner"
  if (preview.ownership === "abandoned") return "abandoned"
  if (preview.ownership === "remote_healthy") return "owned elsewhere"
  if (preview.ownership === "local") return "this instance"
  return "idle"
}

function ageDetail(ageMs: number | null, jobId: number | null) {
  if (ageMs === null) return "Nothing waiting"
  return `Oldest ${formatAge(ageMs)}${jobId ? ` · job #${jobId}` : ""}`
}

function formatAge(ageMs: number) {
  const minutes = Math.round(ageMs / 60_000)
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h`
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-GB")
}
