"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { Download, Pencil, Plus, Save, Send, Users, Wand2 } from "lucide-react"

const T = { s1:"var(--s1)",s2:"var(--s2)",s3:"var(--s3)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",grn:"var(--grn)",amb:"var(--amb)" }

interface ClientRow {
  id: number
  name: string
  contactName: string | null
  contactEmail: string | null
  tier: string | null
  mrr: number
  status: string
  progress: number
}

interface ClientSalesProposal {
  id: number
  prospectId: number | null
  clientId: number | null
  title: string
  summary: string
  htmlContent: string
  status: string
  generatedBy: "forge" | "manual"
  buildPrice: number
  retainerPrice: number
  updatedAt: string | Date | null
}

const STATUS_STYLE: Record<string,{bg:string;color:string;border:string}> = {
  active:  { bg:"rgba(16,185,129,.1)",  color:"var(--grn)", border:"rgba(16,185,129,.2)" },
  build:   { bg:"var(--acc-dim)",       color:"var(--acc)", border:"var(--acc-b)" },
  review:  { bg:"rgba(245,158,11,.1)",  color:"var(--amb)", border:"rgba(245,158,11,.2)" },
  prospect:{ bg:"rgba(255,255,255,.04)",color:"var(--t2)",  border:"var(--b1)" },
}

export function ClientsTable({ clients, salesProposals }: { clients: ClientRow[]; salesProposals: ClientSalesProposal[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [proposals, setProposals] = useState(salesProposals)
  const [busy, setBusy] = useState<number | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState("")

  async function generateClientProposal(event: FormEvent<HTMLFormElement>, client: ClientRow) {
    event.preventDefault()
    const form = event.currentTarget
    const body = {
      clientId: client.id,
      buildPrice: new FormData(form).get("buildPrice"),
      retainerPrice: new FormData(form).get("retainerPrice"),
      selectedServices: new FormData(form).get("selectedServices"),
    }
    setBusy(client.id)
    setError("")

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || json.ok === false) throw new Error(json.error || "Unable to generate proposal.")
      setProposals((current) => [json.proposal, ...current])
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate proposal.")
    } finally {
      setBusy(null)
    }
  }

  async function saveClientProposal(id: number, body: Record<string, unknown>) {
    setSaving(id)
    setError("")

    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || json.ok === false) throw new Error(json.error || "Unable to save proposal.")
      setProposals((current) => current.map((proposal) => proposal.id === id ? json.proposal : proposal))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save proposal.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] rounded-[8px] border p-3 sm:p-4 lg:p-5" style={{ background:"rgba(2,6,23,.58)", borderColor:"rgba(56,189,248,.18)", boxShadow:"0 24px 80px rgba(0,0,0,.28)" }}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">Clients</h1>
          <p className="mt-1 font-dm text-sm" style={{ color: T.t2 }}>Live client records from the database.</p>
        </div>
        <Link href="/clients/new" className="inline-flex items-center gap-1.5 rounded-[8px] bg-acc px-4 py-2 font-dm text-sm font-medium text-white">
          <Plus size={15} /> Add Client
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:"var(--t1)" }}>
          {error}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-[8px] border p-6 sm:p-8" style={{ background: T.s1, borderColor: T.b1 }}>
          <Users size={20} className="mb-4 text-acc" aria-hidden="true" />
          <h2 className="font-syne text-xl font-bold">No clients yet</h2>
          <p className="mt-2 max-w-[520px] font-dm text-sm leading-relaxed" style={{ color: T.t2 }}>
            Add the first client to start tracking retainers, status, and delivery progress in the dashboard.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border" style={{ background: T.s1, borderColor: T.b1 }}>
          <div className="min-w-[1060px]">
          <div className="grid gap-0 border-b px-4 py-3 sm:px-5" style={{ gridTemplateColumns:"2fr 1.1fr .8fr .8fr 1fr 2.2fr", borderColor:T.b1, background:T.s2 }}>
            {["Client","Tier","MRR","Progress","Status","Proposal"].map((h) => (
              <div key={h} className="font-dm text-[11px] font-semibold uppercase tracking-[.07em]" style={{ color:T.t2 }}>{h}</div>
            ))}
          </div>
          {clients.map((client, index) => {
            const style = STATUS_STYLE[client.status] ?? STATUS_STYLE.prospect

            return (
              <div
                key={client.id}
                className="grid items-center px-4 py-4 transition-colors sm:px-5"
                style={{
                  gridTemplateColumns:"2fr 1.1fr .8fr .8fr 1fr 2.2fr",
                  borderBottom:index < clients.length - 1 ? `1px solid ${T.b1}` : "none",
                  background:hovered === client.id ? T.s2 : "transparent",
                }}
                onMouseEnter={() => setHovered(client.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-syne text-[13px] font-bold" style={{ background:T.s3, color:T.t2 }}>
                    {initial(client.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-dm text-sm font-medium">{client.name}</div>
                      <Link href={`/clients/${client.id}/edit`} className="shrink-0 text-t3 transition-colors hover:text-acc" aria-label={`Edit ${client.name}`} title={`Edit ${client.name}`}>
                        <Pencil size={13} aria-hidden="true" />
                      </Link>
                    </div>
                    <div className="font-dm text-[11px]" style={{ color:T.t2 }}>{client.contactName ?? "No contact set"}</div>
                  </div>
                </div>
                <div className="font-dm text-sm" style={{ color:T.t2 }}>
                  <div>{client.tier ?? "No tier set"}</div>
                  <Link href={`/clients/${client.id}/analytics`} className="text-[11px] text-cyan-300">Analytics</Link>
                </div>
                <div className="font-syne text-sm font-bold" style={{ color:client.mrr > 0 ? T.grn : T.t3 }}>
                  {client.mrr > 0 ? `GBP ${client.mrr}` : "Build"}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background:T.s3 }}>
                    <div className="h-full rounded-full" style={{ width:`${client.progress}%`, background:client.status === "active" ? T.grn : client.status === "build" ? "var(--acc)" : T.amb }} />
                  </div>
                  <span className="shrink-0 font-dm text-[11px]" style={{ color:T.t2 }}>{client.progress}%</span>
                </div>
                <div>
                  <span className="rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:style.bg, color:style.color, border:`1px solid ${style.border}` }}>
                    {client.status}
                  </span>
                </div>
                <ClientProposalCell
                  client={client}
                  proposals={proposals.filter((proposal) => proposal.clientId === client.id)}
                  busy={busy === client.id}
                  savingId={saving}
                  onGenerate={generateClientProposal}
                  onSave={saveClientProposal}
                />
              </div>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}

function ClientProposalCell({ client, proposals, busy, savingId, onGenerate, onSave }: {
  client: ClientRow
  proposals: ClientSalesProposal[]
  busy: boolean
  savingId: number | null
  onGenerate: (event: FormEvent<HTMLFormElement>, client: ClientRow) => void
  onSave: (id: number, body: Record<string, unknown>) => void
}) {
  const latest = proposals[0]
  const [title, setTitle] = useState(latest?.title ?? "")
  const [summary, setSummary] = useState(latest?.summary ?? "")
  const [htmlContent, setHtmlContent] = useState(latest?.htmlContent ?? "")

  useEffect(() => {
    setTitle(latest?.title ?? "")
    setSummary(latest?.summary ?? "")
    setHtmlContent(latest?.htmlContent ?? "")
  }, [latest?.id, latest?.title, latest?.summary, latest?.htmlContent])

  return (
    <div className="font-dm text-xs">
      <form onSubmit={(event) => onGenerate(event, client)} className="grid gap-2">
        <input type="hidden" name="buildPrice" value="0" />
        <input type="hidden" name="retainerPrice" value={String(client.mrr)} />
        <input type="hidden" name="selectedServices" value={client.tier ?? "Client website support and growth planning"} />
        <button disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-dm text-xs font-medium text-white disabled:opacity-60" style={{ background:"var(--acc)" }}>
          <Wand2 size={13} /> {busy ? "Generating..." : "Generate draft"}
        </button>
      </form>
      {latest ? (
        <div className="mt-2 rounded border px-2 py-1.5" style={{ borderColor:T.b1, background:T.s2 }}>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate" style={{ color:T.t2 }}>{latest.status} / {latest.generatedBy}</span>
            <a href={`/api/proposals/${latest.id}`} className="shrink-0" style={{ color:"var(--acc)" }} aria-label={`Download ${latest.title}`}>
              <Download size={14} />
            </a>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer" style={{ color:"var(--acc)" }}>Edit draft</summary>
            <div className="mt-2 grid gap-2">
              <input value={title || latest.title} onChange={(event) => setTitle(event.target.value)} aria-label="Proposal title" />
              <textarea value={summary || latest.summary} onChange={(event) => setSummary(event.target.value)} rows={2} aria-label="Proposal summary" />
              <textarea value={htmlContent || latest.htmlContent} onChange={(event) => setHtmlContent(event.target.value)} rows={5} className="font-mono text-xs" aria-label="Proposal HTML" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={savingId === latest.id} onClick={() => onSave(latest.id, { title: title || latest.title, summary: summary || latest.summary, htmlContent: htmlContent || latest.htmlContent, status: "draft" })} className="inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-white disabled:opacity-60" style={{ background:"var(--acc)" }}>
                  <Save size={12} /> Save
                </button>
                <button type="button" disabled={savingId === latest.id} onClick={() => onSave(latest.id, { title: title || latest.title, summary: summary || latest.summary, htmlContent: htmlContent || latest.htmlContent, status: "sent" })} className="inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-white disabled:opacity-60" style={{ background:"var(--grn)" }}>
                  <Send size={12} /> Sent
                </button>
              </div>
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-2" style={{ color:T.t3 }}>No draft yet.</div>
      )}
    </div>
  )
}

function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?"
}
