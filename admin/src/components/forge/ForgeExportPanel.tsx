"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Download, FileSignature, FileText, Package } from "lucide-react"
import type { ForgeExportArtifactState, ForgeExportKind } from "@/lib/forge-export"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

const OPTIONS: { kind: ForgeExportKind; label: string; icon: typeof Download; description: string; needs: "site" | "proposal" }[] = [
  { kind: "site", label: "Export Site", icon: Package, description: "ZIP of the generated workspace (safety-filtered).", needs: "site" },
  { kind: "proposal", label: "Export Proposal", icon: FileSignature, description: "Proposal as markdown.", needs: "proposal" },
  { kind: "audit", label: "Export Audit", icon: FileText, description: "Website audit as markdown.", needs: "proposal" },
  { kind: "handover", label: "Export Handover Pack", icon: Download, description: "ZIP of proposal, audit, roadmap, handover, and SEO checklist.", needs: "proposal" },
]

export function ForgeExportPanel({
  projectId,
  initialExport,
  siteReady,
  proposalReady,
  disabled = false,
}: {
  projectId: number
  initialExport: ForgeExportArtifactState
  siteReady: boolean
  proposalReady: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<ForgeExportKind | null>(null)
  const [error, setError] = useState("")
  const [lastExportAt, setLastExportAt] = useState<string | null>(initialExport.lastExportAt)

  async function exportKind(kind: ForgeExportKind) {
    setBusy(kind)
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      })

      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        throw new Error(json.error || "Unable to export.")
      }

      const blob = await response.blob()
      const filename = parseFilename(response.headers.get("Content-Disposition")) || `${kind}-export`
      triggerDownload(blob, filename)
      setLastExportAt(new Date().toISOString())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export.")
    } finally {
      setBusy(null)
    }
  }

  function isReady(needs: "site" | "proposal") {
    return needs === "site" ? siteReady : proposalReady
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <Download size={16} style={{ color:T.acc }} aria-hidden="true" />
          <h2 className="font-syne text-lg font-bold">Export</h2>
          {lastExportAt && <Badge value={`last ${formatDate(lastExportAt)}`} />}
        </div>
        <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
          Export the generated site and sales assets. The site ZIP includes only generated workspace files — environment files, secrets, node_modules, build output, and internal admin files are always excluded.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && <Notice text="Archived projects are locked from exporting." />}

      <div className="grid gap-3 md:grid-cols-2">
        {OPTIONS.map((option) => {
          const ready = isReady(option.needs)
          const canExport = !disabled && busy === null && ready
          return (
            <div key={option.kind} className="flex items-start justify-between gap-3 rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="flex items-start gap-3">
                <option.icon size={18} style={{ color:T.acc }} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-dm text-sm font-semibold">{option.label}</div>
                  <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{option.description}</p>
                  {!ready && <p className="mt-1 font-dm text-[11px]" style={{ color:T.amb }}>{option.needs === "site" ? "Generate the site first." : "Generate the proposal pack first."}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void exportKind(option.kind)}
                disabled={!canExport}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-dm text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background:T.acc }}
              >
                <Download size={14} aria-hidden="true" /> {busy === option.kind ? "Exporting..." : "Export"}
              </button>
            </div>
          )
        })}
      </div>

      {initialExport.records.length > 0 && (
        <div className="mt-4 rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Recent exports</div>
          <div className="space-y-1.5">
            {initialExport.records.slice(0, 6).map((record, index) => (
              <div key={`${record.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 font-dm text-xs" style={{ color:T.t2 }}>
                <span className="font-semibold">{record.filename}</span>
                <span style={{ color:T.t3 }}>{record.fileCount} file(s) · {formatDate(record.createdAt)} · {record.actor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:T.t2 }}>
      {value}
    </span>
  )
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null
  const match = /filename="?([^"]+)"?/.exec(disposition)
  return match ? match[1] : null
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}
