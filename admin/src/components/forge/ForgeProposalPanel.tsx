"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Download, FileSignature, FileText, ScrollText } from "lucide-react"
import {
  buildForgeProposalPackMarkdown,
  forgeProposalDocuments,
  type ForgeProposalArtifactState,
  type ForgeProposalBundle,
  type ForgeProposalDocumentKey,
} from "@/lib/forge-proposal"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeProposalPanel({
  projectId,
  initialProposal,
  intakeReady,
  disabled = false,
}: {
  projectId: number
  initialProposal: ForgeProposalArtifactState
  intakeReady: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [bundle, setBundle] = useState<ForgeProposalBundle | null>(initialProposal.bundle)
  const [busy, setBusy] = useState<"proposal" | "audit" | null>(null)
  const [error, setError] = useState("")
  const [statusBusy, setStatusBusy] = useState("")
  const [activeDoc, setActiveDoc] = useState<ForgeProposalDocumentKey>("proposal")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setBundle(initialProposal.bundle)
  }, [initialProposal])

  const documents = useMemo(() => (bundle ? forgeProposalDocuments(bundle) : []), [bundle])
  const current = documents.find((doc) => doc.key === activeDoc) ?? documents[0] ?? null
  const canRun = !disabled && busy === null && intakeReady

  async function run(action: "proposal" | "audit") {
    setBusy(action)
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; bundle: ForgeProposalBundle }>(`/api/forge/projects/${projectId}/proposal`, { action })

      if (!json.ok) {
        throw new Error(json.error || "Unable to generate proposal.")
      }

      setBundle(json.bundle)
      setActiveDoc(action === "audit" ? "audit" : "proposal")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate proposal.")
    } finally {
      setBusy(null)
    }
  }

  async function copyCurrent() {
    if (!current) return
    try {
      await navigator.clipboard.writeText(current.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Unable to copy to clipboard.")
    }
  }

  async function updateProposalStatus(event: FormEvent<HTMLFormElement>, action: "approval" | "client_response") {
    event.preventDefault()
    setStatusBusy(action)
    setError("")
    try {
      const body = { action, ...Object.fromEntries(new FormData(event.currentTarget)) }
      const response = await fetch(`/api/forge/projects/${projectId}/proposal`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.ok === false) throw new Error(json.error || "Unable to update proposal.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update proposal.")
    } finally {
      setStatusBusy("")
    }
  }

  function exportMarkdown() {
    if (!bundle) return
    const blob = new Blob([buildForgeProposalPackMarkdown(bundle)], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `proposal-${bundle.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scalesmiths"}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileSignature size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Proposal & Audit</h2>
            {bundle && <Badge value={`retainer: ${bundle.retainer.recommendedTier}`} tone="accent" />}
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Turns the project artifacts into client-facing sales assets: a website audit, proposal, retainer recommendation, implementation roadmap, and handover notes. Positioned professionally — never promising guaranteed rankings or leads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void run("proposal")}
            disabled={!canRun}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <FileSignature size={15} aria-hidden="true" /> {busy === "proposal" ? "Generating..." : "Generate Proposal"}
          </button>
          <button
            type="button"
            onClick={() => void run("audit")}
            disabled={!canRun}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <FileText size={15} aria-hidden="true" /> {busy === "audit" ? "Generating..." : "Generate Audit"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && <Notice text="Archived projects are locked from generating sales assets." tone="muted" />}
      {!disabled && !intakeReady && <Notice text="Capture intake (and ideally research/sitemap) before generating a proposal or audit." tone="warn" />}

      {!bundle || !current ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <FileSignature size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No proposal or audit has been generated for this project yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <form onSubmit={(event) => void updateProposalStatus(event, "approval")} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-2 font-syne text-sm font-bold">Internal approval</div>
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <select name="state" defaultValue={bundle.approval?.state === "approved" ? "approved" : bundle.approval?.state === "rejected" ? "rejected" : "approved"} className="font-dm text-sm">
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <input name="reason" placeholder="Approval/rejection reason" defaultValue={bundle.approval?.reason ?? ""} />
              </div>
              {bundle.approval?.state !== "draft" && <p className="mt-2 font-dm text-xs" style={{ color:T.t2 }}>{bundle.approval.state} by {bundle.approval.actor ?? "admin"}</p>}
              <button disabled={disabled || statusBusy === "approval"} className="mt-2 rounded-lg px-3 py-2 font-dm text-xs font-semibold text-white disabled:opacity-60" style={{ background:T.acc }}>{statusBusy === "approval" ? "Saving..." : "Save approval"}</button>
            </form>
            <form onSubmit={(event) => void updateProposalStatus(event, "client_response")} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-2 font-syne text-sm font-bold">Client response</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <select name="response" defaultValue={bundle.clientResponse?.response ?? "no_response"} className="font-dm text-sm">
                  <option value="no_response">No response</option>
                  <option value="accepted">Accepted</option>
                  <option value="changes_requested">Changes requested</option>
                  <option value="declined">Declined</option>
                </select>
                <input name="contact" placeholder="Client/contact" defaultValue={bundle.clientResponse?.contact ?? ""} />
                <input name="notes" placeholder="Notes" defaultValue={bundle.clientResponse?.notes ?? ""} />
              </div>
              <button disabled={disabled || statusBusy === "client_response"} className="mt-2 rounded-lg px-3 py-2 font-dm text-xs font-semibold text-white disabled:opacity-60" style={{ background:T.grn }}>{statusBusy === "client_response" ? "Saving..." : "Record response"}</button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {documents.map((doc) => (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => setActiveDoc(doc.key)}
                  className="rounded-lg border px-3 py-1.5 font-dm text-xs font-semibold"
                  style={{
                    background: doc.key === activeDoc ? T.acc : T.s2,
                    borderColor: doc.key === activeDoc ? T.acc : T.b2,
                    color: doc.key === activeDoc ? "#fff" : T.t2,
                  }}
                >
                  {doc.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyCurrent()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-dm text-xs font-medium"
                style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
              >
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={exportMarkdown}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-dm text-xs font-medium"
                style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
              >
                <Download size={14} aria-hidden="true" /> Export .md
              </button>
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-3 flex items-center gap-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>
              <ScrollText size={13} aria-hidden="true" /> {current.label} preview
            </div>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded p-3 font-mono text-[12px] leading-relaxed" style={{ background:T.s3, color:T.t1 }}>
              {current.markdown}
            </pre>
          </div>

          <p className="font-dm text-[11px] leading-relaxed" style={{ color:T.t3 }}>{bundle.complianceNote}</p>
        </div>
      )}
    </section>
  )
}

function Notice({ text, tone }: { text: string; tone: "warn" | "muted" }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:tone === "warn" ? T.amb : T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "accent" }) {
  const color = tone === "accent" ? T.acc : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
