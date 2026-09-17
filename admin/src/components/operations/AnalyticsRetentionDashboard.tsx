"use client"

import { useState } from "react"
import type { AnalyticsRetentionPublicState } from "@/lib/analytics-retention"

export function AnalyticsRetentionDashboard({ initialState, canWrite }: { initialState: AnalyticsRetentionPublicState; canWrite: boolean }) {
  const [state, setState] = useState(initialState)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function runNow() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/operations/analytics-retention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      })
      const payload = await response.json().catch(() => null) as { publicState?: AnalyticsRetentionPublicState; error?: string } | null
      if (!response.ok || !payload?.publicState) {
        setMessage(payload?.error ?? "Retention job did not run.")
        return
      }
      setState(payload.publicState)
      setMessage(payload.publicState.status === "skipped" ? "A lease is already held; no second run started." : `Run finished: ${payload.publicState.status}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <header>
        <h1 className="font-syne text-3xl font-bold">Analytics retention</h1>
        <p className="mt-1 max-w-3xl text-sm text-t2">
          Scheduled tenant-scoped pruning of client analytics metrics, audits, unused encrypted credentials and derived optimisation proposals. This screen shows counts and timestamps only.
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Last status" value={state.status ?? "never run"} />
        <Metric label="Last success" value={formatWhen(state.lastSuccessAt)} />
        <Metric label="Last failure" value={formatWhen(state.lastFailureAt)} />
        <Metric label="Error category" value={state.lastErrorCategory ?? "none"} />
        <Metric label="Tenants scanned" value={state.tenantsScanned} />
        <Metric label="Tenants failed" value={state.tenantsFailed} />
        <Metric label="Metrics deleted" value={state.metricsDeleted} />
        <Metric label="Audits deleted" value={state.auditsDeleted} />
        <Metric label="Credentials cleared" value={state.credentialsCleared} />
        <Metric label="Proposals deleted" value={state.proposalsDeleted} />
        <Metric label="Batches" value={state.batches} />
        <Metric label="Lease held" value={state.leaseHeld ? "yes" : "no"} />
      </section>
      <p className="text-sm text-t2">Last finished {formatWhen(state.lastFinishedAt)}. Cursor client id {state.cursorClientId}.</p>
      {canWrite ? (
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void runNow()}>
          {busy ? "Running…" : "Run retention now"}
        </button>
      ) : null}
      {message ? <p className="text-sm text-t2">{message}</p> : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-b1 bg-s1 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-t3">{label}</p>
      <p className="mt-2 font-syne text-2xl font-bold">{typeof value === "number" ? value.toLocaleString("en-GB") : value}</p>
    </div>
  )
}

function formatWhen(value: string | null) {
  if (!value) return "never"
  return new Date(value).toLocaleString("en-GB")
}
