"use client"

import { useMemo, useState } from "react"
import { PUBLIC_CLAIM_APPROVAL_STATUSES, PUBLIC_CLAIM_STATUSES, PUBLIC_CLAIM_TYPES } from "@/lib/public-claims"

interface ClaimRow {
  id: string
  approvedWording: string
  claimType: string
  sourceName: string | null
  attributionName: string | null
  attributionBusiness: string | null
  clientApprovalStatus: string
  status: string
  verifiedBy: string | null
  verifiedAt: Date | string | null
  reviewExpiresAt: Date | string | null
  permittedRoutes: string[]
  permittedComponents: string[]
  evidenceDescription: string | null
  evidenceReference: string | null
  updatedAt: Date | string
}

interface AuditRow {
  id: number
  claimId: string
  actorUserId: string
  action: string
  previousStatus: string | null
  newStatus: string | null
  metadataJson: unknown
  createdAt: Date | string
}

interface FormState {
  approvedWording: string
  claimType: string
  sourceName: string
  attributionName: string
  attributionBusiness: string
  clientApprovalStatus: string
  status: string
  reviewExpiresAt: string
  permittedRoutes: string
  permittedComponents: string
  evidenceDescription: string
  evidenceReference: string
  reason: string
}

export function ClaimsReviewPanel({ initialClaims, initialAudit, canManage }: { initialClaims: ClaimRow[]; initialAudit: AuditRow[]; canManage: boolean }) {
  const [claims, setClaims] = useState(initialClaims)
  const [audit, setAudit] = useState(initialAudit)
  const [selectedId, setSelectedId] = useState(initialClaims[0]?.id ?? "")
  const selected = claims.find((claim) => claim.id === selectedId) ?? null
  const [form, setForm] = useState<FormState>(() => formFromClaim(initialClaims[0]))
  const [filter, setFilter] = useState("all")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const visibleClaims = useMemo(() => filter === "all" ? claims : claims.filter((claim) => claim.status === filter), [claims, filter])

  function chooseClaim(claim: ClaimRow) {
    setSelectedId(claim.id)
    setForm(formFromClaim(claim))
    setMessage("")
  }

  async function refresh(preferredId = selectedId) {
    const response = await fetch("/api/claims", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Unable to load claims.")
    setClaims(data.claims)
    setAudit(data.audit)
    const next = data.claims.find((claim: ClaimRow) => claim.id === preferredId) ?? data.claims[0]
    if (next) {
      setSelectedId(next.id)
      setForm(formFromClaim(next))
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch(`/api/claims/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          reviewExpiresAt: form.reviewExpiresAt || null,
          permittedRoutes: splitLines(form.permittedRoutes),
          permittedComponents: splitLines(form.permittedComponents),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to save claim review.")
      await refresh(selected.id)
      setMessage("Review saved and audit event recorded.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save claim review.")
    } finally {
      setBusy(false)
    }
  }

  const claimAudit = audit.filter((entry) => entry.claimId === selectedId).slice(0, 8)

  return <div className="mx-auto max-w-7xl space-y-5 p-3">
    <header>
      <h1 className="font-syne text-3xl font-bold">Public claims and testimonials</h1>
      <p className="mt-1 max-w-3xl text-sm text-t2">Only verified, in-date entries are available to the public site. Evidence references stay inside the admin database and are never returned by the public view.</p>
    </header>

    {!canManage && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Read-only access. An owner or administrator must change review state.</div>}
    {message && <div role="status" className="rounded-lg border border-b1 bg-s1 p-3 text-sm">{message}</div>}

    <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.6fr)]">
      <section className="overflow-hidden rounded-xl border border-b1 bg-s1">
        <div className="flex items-center justify-between gap-3 border-b border-b1 p-3">
          <strong className="text-sm">Registry ({claims.length})</strong>
          <select aria-label="Filter claims by status" value={filter} onChange={(event) => setFilter(event.target.value)} className="text-sm">
            <option value="all">All statuses</option>
            {PUBLIC_CLAIM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {visibleClaims.map((claim) => <button key={claim.id} type="button" onClick={() => chooseClaim(claim)} className="block w-full border-b border-b1/60 p-3 text-left" style={{ background: claim.id === selectedId ? "rgba(56,189,248,.08)" : undefined }}>
            <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-xs">{claim.id}</span><StatusBadge status={claim.status} /></div>
            <p className="mt-2 line-clamp-2 text-sm">{claim.approvedWording}</p>
            <p className="mt-1 text-xs text-t2">{claim.claimType} · {claim.sourceName || "No source recorded"}</p>
          </button>)}
          {!visibleClaims.length && <p className="p-4 text-sm text-t2">No claims match this filter.</p>}
        </div>
      </section>

      {selected ? <div className="space-y-5">
        <form onSubmit={save} className="space-y-4 rounded-xl border border-b1 bg-s1 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-mono text-xs text-t2">{selected.id}</div><h2 className="font-syne text-xl font-bold">Review record</h2></div><StatusBadge status={selected.status} /></div>
          <label className="block text-sm">Exact approved public wording<textarea rows={4} value={form.approvedWording} onChange={(event) => setForm({ ...form, approvedWording: event.target.value })} className="mt-1 w-full" required disabled={!canManage} /></label>
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Claim type" value={form.claimType} values={PUBLIC_CLAIM_TYPES} disabled={!canManage} onChange={(value) => setForm({ ...form, claimType: value })} />
            <SelectField label="Review status" value={form.status} values={PUBLIC_CLAIM_STATUSES} disabled={!canManage} onChange={(value) => setForm({ ...form, status: value })} />
            <SelectField label="Client approval" value={form.clientApprovalStatus} values={PUBLIC_CLAIM_APPROVAL_STATUSES} disabled={!canManage} onChange={(value) => setForm({ ...form, clientApprovalStatus: value })} />
          </div>
          <div className="grid gap-3 md:grid-cols-3"><TextField label="Source/client" value={form.sourceName} disabled={!canManage} onChange={(value) => setForm({ ...form, sourceName: value })} /><TextField label="Attribution name" value={form.attributionName} disabled={!canManage} onChange={(value) => setForm({ ...form, attributionName: value })} /><TextField label="Attribution business" value={form.attributionBusiness} disabled={!canManage} onChange={(value) => setForm({ ...form, attributionBusiness: value })} /></div>
          <div className="grid gap-3 md:grid-cols-2"><TextField label="Permitted routes (one per line)" value={form.permittedRoutes} disabled={!canManage} multiline onChange={(value) => setForm({ ...form, permittedRoutes: value })} /><TextField label="Permitted components (one per line)" value={form.permittedComponents} disabled={!canManage} multiline onChange={(value) => setForm({ ...form, permittedComponents: value })} /></div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"><h3 className="text-sm font-semibold text-amber-100">Private evidence — never public</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><TextField label="Evidence description" value={form.evidenceDescription} disabled={!canManage} multiline onChange={(value) => setForm({ ...form, evidenceDescription: value })} /><TextField label="Private evidence reference/location" value={form.evidenceReference} disabled={!canManage} multiline onChange={(value) => setForm({ ...form, evidenceReference: value })} /></div></div>
          <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Review/expiry date<input type="date" value={form.reviewExpiresAt} onChange={(event) => setForm({ ...form, reviewExpiresAt: event.target.value })} className="mt-1 w-full" disabled={!canManage} /></label><TextField label="Required review reason" value={form.reason} disabled={!canManage} multiline onChange={(value) => setForm({ ...form, reason: value })} /></div>
          <p className="text-xs text-t2">Verified entries require evidence, an approved/not-required client decision, and a future review date. Moving an entry out of verified state clears its verification timestamp.</p>
          {canManage && <button disabled={busy} className="rounded-lg bg-acc px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save review"}</button>}
        </form>

        <section className="rounded-xl border border-b1 bg-s1 p-4"><h2 className="font-syne text-lg font-bold">Audit history</h2><div className="mt-3 space-y-2">{claimAudit.map((entry) => <div key={entry.id} className="rounded-lg border border-b1/60 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{entry.action.replaceAll("_", " ")}</strong><time className="text-xs text-t2">{new Date(entry.createdAt).toLocaleString()}</time></div><div className="mt-1 text-xs text-t2">{entry.previousStatus || "none"} → {entry.newStatus || "none"} · actor {entry.actorUserId}</div>{auditReason(entry.metadataJson) && <p className="mt-2 text-xs">{auditReason(entry.metadataJson)}</p>}</div>)}{!claimAudit.length && <p className="text-sm text-t2">No review events recorded yet.</p>}</div></section>
      </div> : <div className="rounded-xl border border-b1 bg-s1 p-6 text-sm text-t2">Select a claim to review.</div>}
    </div>
  </div>
}

function formFromClaim(claim?: ClaimRow): FormState {
  return {
    approvedWording: claim?.approvedWording ?? "",
    claimType: claim?.claimType ?? "customer_result",
    sourceName: claim?.sourceName ?? "",
    attributionName: claim?.attributionName ?? "",
    attributionBusiness: claim?.attributionBusiness ?? "",
    clientApprovalStatus: claim?.clientApprovalStatus ?? "pending",
    status: claim?.status ?? "draft",
    reviewExpiresAt: claim?.reviewExpiresAt ? new Date(claim.reviewExpiresAt).toISOString().slice(0, 10) : "",
    permittedRoutes: claim?.permittedRoutes.join("\n") ?? "/",
    permittedComponents: claim?.permittedComponents.join("\n") ?? "proof",
    evidenceDescription: claim?.evidenceDescription ?? "",
    evidenceReference: claim?.evidenceReference ?? "",
    reason: "",
  }
}

function splitLines(value: string) { return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) }
function auditReason(value: unknown) { return value && typeof value === "object" && "reason" in value && typeof value.reason === "string" ? value.reason : null }
function StatusBadge({ status }: { status: string }) { const tone = status === "verified" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : status === "draft" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-red-500/30 bg-red-500/10 text-red-200"; return <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>{status}</span> }
function SelectField({ label, value, values, disabled, onChange }: { label: string; value: string; values: readonly string[]; disabled: boolean; onChange: (value: string) => void }) { return <label className="text-sm">{label}<select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full">{values.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> }
function TextField({ label, value, disabled, multiline = false, onChange }: { label: string; value: string; disabled: boolean; multiline?: boolean; onChange: (value: string) => void }) { return <label className="text-sm">{label}{multiline ? <textarea rows={3} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full" /> : <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full" />}</label> }
