"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, Archive, ArrowLeft, CheckCircle2, RefreshCcw, ShieldAlert } from "lucide-react"
import { CLIENT_OFFBOARDING_ITEM_STATUSES, type ClientOffboardingItemStatus } from "@/lib/client-offboarding"

interface Item { id: number; itemKey: string; category: string; title: string; status: ClientOffboardingItemStatus; destructive: boolean; blocker: string | null; evidence: string | null }
interface OffboardingCase { id: number; status: string; retentionReviewAt: string | Date | null; completedAt: string | Date | null }
interface Data { case: OffboardingCase | null; items: Item[]; assessment: Record<string, unknown>; audit: Array<{ id: number; action: string; createdAt: string | Date }> }

export function ClientOffboardingManager({ client }: { client: { id: number; name: string; status: string } }) {
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [startForm, setStartForm] = useState({ commercialEndAt: "", retentionReviewAt: "", retentionNotes: "", productionHandoffNotes: "" })
  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh() { const response = await fetch(`/api/clients/${client.id}/offboarding`, { cache: "no-store" }); const json = await response.json(); if (!response.ok) throw new Error(json.error); setData(json) }
  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true); setError("")
    try { const response = await fetch(`/api/clients/${client.id}/offboarding`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const json = await response.json(); if (!response.ok) throw new Error(json.error); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update offboarding.") }
    finally { setBusy(false) }
  }
  async function start(event: React.FormEvent) { event.preventDefault(); await request("POST", startForm) }
  async function saveItem(item: Item, status: ClientOffboardingItemStatus, evidence: string, blocker: string) {
    const confirmation = item.destructive && status === "completed" ? window.prompt(`Type CONFIRM ${item.itemKey} to confirm access removal or archival.`) : undefined
    await request("PATCH", { action: "update_item", caseId: data!.case!.id, itemId: item.id, status, evidence, blocker, confirmation })
  }
  async function complete() { const confirmation = window.prompt(`This archives the client, disables portal access and closes operational work. Production is not deleted. Type OFFBOARD ${client.name}`); if (!confirmation) return; await request("PATCH", { action: "complete", caseId: data!.case!.id, confirmation, productionAction: "leave_untouched" }) }
  async function reactivate() { const confirmation = window.prompt(`Type REACTIVATE ${client.name}. Portal access, services and projects will remain disabled until separately reviewed.`); if (!confirmation) return; await request("PATCH", { action: "reactivate", caseId: data!.case!.id, confirmation }) }

  return <div className="mx-auto max-w-5xl">
    <Link href={`/clients/${client.id}/edit`} className="mb-4 inline-flex items-center gap-2 font-dm text-sm text-t2 hover:text-t1"><ArrowLeft size={14} /> Client record</Link>
    <div className="mb-6"><div className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">Controlled lifecycle</div><h1 className="mt-2 font-syne text-3xl font-extrabold">Offboard {client.name}</h1><p className="mt-2 max-w-3xl font-dm text-sm text-t2">Offboarding archives access and operations with evidence. It does not delete financial history, production sites, deployment records or client documents.</p></div>
    {error && <div role="alert" className="mb-4 rounded-xl border border-red/30 bg-red/10 p-4 text-sm">{error}</div>}
    {!data ? <p className="text-t2">Loading assessment…</p> : !data.case ? <form onSubmit={start} className="space-y-5 rounded-2xl border border-b1 bg-s1 p-6">
      <div><h2 className="font-syne text-xl font-bold">Start an offboarding case</h2><p className="mt-1 text-sm text-t2">This only creates the case and checklist. It does not change access or client state.</p></div>
      <Assessment value={data.assessment} />
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Commercial end date"><input type="date" value={startForm.commercialEndAt} onChange={(e) => setStartForm({ ...startForm, commercialEndAt: e.target.value })} /></Field><Field label="Retention review date"><input required type="date" value={startForm.retentionReviewAt} onChange={(e) => setStartForm({ ...startForm, retentionReviewAt: e.target.value })} /></Field></div>
      <Field label="Retention basis and exceptions"><textarea required value={startForm.retentionNotes} onChange={(e) => setStartForm({ ...startForm, retentionNotes: e.target.value })} /></Field>
      <Field label="Production ownership and handoff"><textarea required value={startForm.productionHandoffNotes} onChange={(e) => setStartForm({ ...startForm, productionHandoffNotes: e.target.value })} /></Field>
      <button disabled={busy} className="rounded-lg bg-acc px-4 py-2.5 font-semibold text-white"><Archive size={15} className="mr-2 inline" />Create checklist</button>
    </form> : <div className="space-y-5">
      <div className="rounded-2xl border border-b1 bg-s1 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-syne text-xl font-bold">Case #{data.case.id}</h2><p className="text-sm text-t2">State: {data.case.status.replaceAll("_", " ")}</p></div><Assessment value={data.assessment} /></div></div>
      <div className="space-y-3">{data.items.map((item) => <ChecklistItem key={item.id} item={item} busy={busy} save={saveItem} />)}</div>
      {data.case.status === "ready" && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><h2 className="font-syne text-lg font-bold"><ShieldAlert size={18} className="mr-2 inline" />Final confirmation</h2><p className="my-3 text-sm text-t2">This disables portal access and tokens, stops services, cancels open requests and future onboarding tasks, closes active delivery projects, archives linked Forge projects, and sets the client to archived. Production systems and retained records remain untouched.</p><button disabled={busy} onClick={() => void complete()} className="rounded-lg bg-red px-4 py-2.5 font-semibold text-white">Complete offboarding</button></div>}
      {data.case.status === "completed" && <div className="rounded-2xl border border-b1 bg-s1 p-5"><h2 className="font-syne text-lg font-bold"><CheckCircle2 size={18} className="mr-2 inline text-grn" />Offboarded, not deleted</h2><p className="my-3 text-sm text-t2">Historical and financial records remain retained. Reactivation restores the client status only; access and services require separate secure review.</p><button disabled={busy} onClick={() => void reactivate()} className="rounded-lg border border-b2 px-4 py-2.5"><RefreshCcw size={15} className="mr-2 inline" />Reactivate client record</button></div>}
    </div>}
  </div>
}

function ChecklistItem({ item, busy, save }: { item: Item; busy: boolean; save: (item: Item, status: ClientOffboardingItemStatus, evidence: string, blocker: string) => Promise<void> }) {
  const [status, setStatus] = useState(item.status); const [evidence, setEvidence] = useState(item.evidence ?? ""); const [blocker, setBlocker] = useState(item.blocker ?? "")
  return <div className="rounded-xl border border-b1 bg-s1 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wide text-t3">{item.category}</div><h3 className="font-semibold">{item.title}</h3>{item.destructive && <div className="mt-1 text-xs text-amber-400"><AlertTriangle size={12} className="mr-1 inline" />Explicit confirmation required</div>}</div><select value={status} onChange={(e) => setStatus(e.target.value as ClientOffboardingItemStatus)}>{CLIENT_OFFBOARDING_ITEM_STATUSES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Evidence / decision"><textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} /></Field><Field label="Blocker"><textarea value={blocker} onChange={(e) => setBlocker(e.target.value)} /></Field></div><button disabled={busy} onClick={() => void save(item, status, evidence, blocker)} className="mt-3 rounded-lg border border-b2 px-3 py-2 text-sm">Save check</button></div>
}
function Assessment({ value }: { value: Record<string, unknown> }) { const entries = Object.entries(value).filter(([key]) => key !== "assessedAt"); return <div className="flex flex-wrap gap-2">{entries.map(([key, item]) => <span key={key} className="rounded-full border border-b1 bg-s2 px-3 py-1 text-xs text-t2">{key.replace(/([A-Z])/g, " $1")}: {Array.isArray(item) ? item.length : String(item)}</span>)}</div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm text-t2"><span className="mb-1 block">{label}</span>{children}</label> }
