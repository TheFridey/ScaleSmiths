"use client"

import { useEffect, useState } from "react"
import { CLIENT_SERVICE_TIER_OPTIONS } from "@/lib/clients"
import {
  blocksConvert,
  buildSubmitOptions,
  formatMoney,
  initialFormState,
  type ConversionPlanView,
  type ModalFormState,
} from "./convert-prospect-options"

const T = { s1:"var(--s1)",s2:"var(--s2)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",acc:"var(--acc)",grn:"var(--grn)",red:"var(--red)",amb:"var(--amb)" }

export function ConvertProspectModal({ prospectId, open, onClose, onConverted }: { prospectId: number; open: boolean; onClose: () => void; onConverted: (clientId: number) => void }): JSX.Element | null {
  const [plan, setPlan] = useState<ConversionPlanView | null>(null)
  const [form, setForm] = useState<ModalFormState | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ clientId: number; projectId: number | null; draftInvoiceId: number | null; portalProvisioningPrepared: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    setPlan(null); setForm(null); setError(""); setResult(null)
    fetch(`/api/prospects/${prospectId}/conversion`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.ok === false) throw new Error(json.error || "Unable to load the conversion preview.")
        const p = json.plan as ConversionPlanView
        setPlan(p)
        setForm(initialFormState(p))
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load the conversion preview."))
  }, [open, prospectId])

  if (!open) return null

  const update = <K extends keyof ModalFormState>(key: K, value: ModalFormState[K]) => setForm((f) => f && ({ ...f, [key]: value }))
  const toggleService = (id: number) => setForm((f) => f && ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] }))

  async function submit() {
    if (!form) return
    setBusy(true); setError("")
    try {
      const options = buildSubmitOptions(form)
      const res = await fetch(`/api/prospects/${prospectId}/conversion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) throw new Error(json.error || "Conversion failed.")
      const c = json.conversion
      setResult({ clientId: c.clientId, projectId: c.projectId ?? null, draftInvoiceId: c.draftInvoiceId ?? null, portalProvisioningPrepared: Boolean(c.portalProvisioningPrepared) })
      onConverted(c.clientId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="mt-10 w-full max-w-[720px] rounded-[8px] border p-5" style={{ background:T.s1, borderColor:T.b2 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-syne text-lg font-bold">Convert opportunity to client</h2>
          <button onClick={onClose} className="rounded border px-2 py-1 font-dm text-xs" style={{ borderColor:T.b2 }}>Close</button>
        </div>

        {error && <div className="mb-3 rounded border px-3 py-2 font-dm text-sm" style={{ borderColor:"rgba(239,68,68,.35)", color:T.t1 }}>{error}</div>}
        {!plan && !error && <div className="font-dm text-sm" style={{ color:T.t2 }}>Loading preview…</div>}

        {result ? (
          <div className="space-y-2 font-dm text-sm">
            <div style={{ color:T.grn }}>Conversion completed.</div>
            <ul className="list-disc pl-5" style={{ color:T.t2 }}>
              <li><a href={`/clients/${result.clientId}`} style={{ color:T.acc }}>Open client</a></li>
              {result.projectId && <li><a href={`/projects/${result.projectId}`} style={{ color:T.acc }}>Open delivery project</a></li>}
              {result.draftInvoiceId && <li><a href={`/finance`} style={{ color:T.acc }}>Draft invoice created</a></li>}
              {result.portalProvisioningPrepared && <li>Disabled portal account prepared — set credentials in Portal Users</li>}
            </ul>
          </div>
        ) : plan && form && (
          <div className="space-y-4">
            {plan.warnings.map((w) => (
              <div key={w.code} className="rounded border px-3 py-2 font-dm text-xs" style={{ borderColor: w.blocksExecute ? "rgba(239,68,68,.4)" : "rgba(245,158,11,.35)", color:T.t1 }}>{w.message}</div>
            ))}

            <label className="font-dm text-sm block"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Client</span>
              <select value={form.mode} onChange={(e) => update("mode", e.target.value as "create" | "link")}>
                <option value="create">Create new client</option>
                <option value="link">Link to existing client</option>
              </select>
            </label>

            {form.mode === "link" && (
              <label className="font-dm text-sm block"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Existing client</span>
                <select value={form.linkClientId ?? ""} onChange={(e) => update("linkClientId", Number(e.target.value) || null)}>
                  <option value="">Select…</option>
                  {plan.matchCandidates.map((c) => <option key={c.clientId} value={c.clientId}>{c.name} (matched: {c.matchedOn.join(", ")})</option>)}
                </select>
              </label>
            )}

            {form.mode === "create" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Name</span><input value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Invoice code (permanent)</span><input value={form.code} onChange={(e) => update("code", e.target.value)} /></label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Tier</span>
                <select value={form.tier} onChange={(e) => update("tier", e.target.value)}>
                  {CLIENT_SERVICE_TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>MRR</span><input type="number" min="0" value={form.mrr} onChange={(e) => update("mrr", Number(e.target.value))} /></label>
            </div>

            <fieldset className="font-dm text-sm">
              <legend className="mb-1 text-[11px]" style={{ color:T.t2 }}>Services</legend>
              <div className="space-y-1">
                {plan.catalogue.length === 0 && <div className="text-[11px]" style={{ color:T.t3 }}>No catalogue items configured.</div>}
                {plan.catalogue.map((item) => (
                  <label key={item.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={form.serviceIds.includes(item.id)} onChange={() => toggleService(item.id)} /> {item.name} — {formatMoney(item.defaultUnitAmount)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2 font-dm text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.createProject} onChange={(e) => update("createProject", e.target.checked)} /> Create delivery project</label>
              {form.createProject && <input value={form.projectName} onChange={(e) => update("projectName", e.target.value)} className="w-full" />}
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.onboardingTasks} onChange={(e) => update("onboardingTasks", e.target.checked)} /> Seed onboarding tasks ({plan.defaults.onboardingTasks.length})</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.createDraftInvoice} disabled={form.serviceIds.length === 0} onChange={(e) => update("createDraftInvoice", e.target.checked)} /> Create draft invoice (from selected services)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.preparePortal} onChange={(e) => update("preparePortal", e.target.checked)} /> Prepare portal access</label>
              <p className="text-[11px]" style={{ color:T.t3 }}>Prepares a disabled portal account — no credentials are generated or sent. The draft invoice is not issued.</p>
            </div>

            <button onClick={submit} disabled={busy || !form || blocksConvert(plan, form)} className="w-full rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
              {busy ? "Converting…" : "Convert to client"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
