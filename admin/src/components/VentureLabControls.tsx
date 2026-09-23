"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Approval = { id: string; action: string; amountMinor: number; target: string; purpose: string; status: string }
type ServiceIdentity = { id: string; displayName: string; active: boolean; revokedAt: Date | string | null }

export function VentureLabControls({
  paused,
  approvals,
  services,
  canApprove,
  canStop,
  canRevoke,
}: {
  paused: boolean
  approvals: Approval[]
  services: ServiceIdentity[]
  canApprove: boolean
  canStop: boolean
  canRevoke: boolean
}) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Venture Lab control failed.")
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Venture Lab control failed.")
    } finally {
      setBusy(false)
    }
  }

  const pending = approvals.filter((approval) => approval.status === "REQUESTED")
  const activeServices = services.filter((service) => service.active && !service.revokedAt)

  return (
    <section className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Human control plane</h2>
        <p className="mt-1 text-sm text-zinc-600">These controls call scoped Admin endpoints. The database still enforces approval identity, STOP, revocation and budget rules independently.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      <label className="block text-sm font-medium text-zinc-700">
        Decision / control reason
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
          placeholder="Record why this action is being taken."
        />
      </label>

      {canStop ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !reason.trim() || paused}
            onClick={() => post("/api/venture-lab/runtime", { action: "stop", reason })}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Emergency STOP
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim() || !paused}
            onClick={() => post("/api/venture-lab/runtime", { action: "resume", reason })}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-40"
          >
            Resume Venture Lab
          </button>
        </div>
      ) : null}

      {canApprove ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Pending spend approvals</h3>
          {pending.length ? (
            <div className="mt-2 space-y-2">
              {pending.map((approval) => (
                <div key={approval.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
                  <div className="text-sm">
                    <div className="font-medium text-zinc-900">{approval.action}</div>
                    <div className="text-zinc-600">£{(approval.amountMinor / 100).toFixed(2)} · {approval.target} · {approval.purpose}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => post(`/api/venture-lab/approvals/${approval.id}/approve`, { reason })}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Approve exact request
                  </button>
                </div>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-zinc-500">No pending spend approvals.</p>}
        </div>
      ) : null}

      {canRevoke ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Service identities</h3>
          <div className="mt-2 space-y-2">
            {activeServices.map((service) => (
              <div key={service.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
                <div className="text-sm"><span className="font-medium text-zinc-900">{service.displayName}</span><span className="ml-2 text-zinc-500">{service.id}</span></div>
                <button
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={() => post(`/api/venture-lab/service-accounts/${encodeURIComponent(service.id)}/revoke`, { reason })}
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-40"
                >
                  Revoke permanently
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
