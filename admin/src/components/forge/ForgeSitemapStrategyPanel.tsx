"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, GitBranch, WandSparkles } from "lucide-react"
import type { ForgeSitemapArtifactState, ForgeSitemapStrategy } from "@/lib/forge-sitemap"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeSitemapStrategyPanel({
  projectId,
  initialState,
  disabled = false,
}: {
  projectId: number
  initialState: ForgeSitemapArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const initialStrategy = initialState.approvedStrategy ?? initialState.strategy
  const [strategy, setStrategy] = useState<ForgeSitemapStrategy | null>(initialStrategy)
  const [status, setStatus] = useState(initialState.status)
  const [approvedAt, setApprovedAt] = useState(initialState.approvedAt)
  const [approvedBy, setApprovedBy] = useState(initialState.approvedBy)
  const [editorValue, setEditorValue] = useState(initialStrategy ? JSON.stringify(initialStrategy, null, 2) : "")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const nextStrategy = initialState.approvedStrategy ?? initialState.strategy
    setStrategy(nextStrategy)
    setStatus(initialState.status)
    setApprovedAt(initialState.approvedAt)
    setApprovedBy(initialState.approvedBy)
    setEditorValue(nextStrategy ? JSON.stringify(nextStrategy, null, 2) : "")
  }, [initialState])

  const buildOrder = useMemo(() => strategy?.priorityBuildOrder.join(" -> ") ?? "", [strategy])

  async function generate() {
    setBusy("generate")
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; strategy: ForgeSitemapStrategy }>(`/api/forge/projects/${projectId}/sitemap`)

      if (!json.ok) {
        throw new Error(json.error || "Unable to generate sitemap and strategy.")
      }

      setStrategy(json.strategy)
      setStatus("draft")
      setApprovedAt(null)
      setApprovedBy(null)
      setEditorValue(JSON.stringify(json.strategy, null, 2))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate sitemap and strategy.")
    } finally {
      setBusy("")
    }
  }

  async function approve() {
    setBusy("approve")
    setError("")

    try {
      const parsed = JSON.parse(editorValue) as unknown
      const response = await fetch(`/api/forge/projects/${projectId}/sitemap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: parsed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to approve sitemap and strategy.")
      }

      setStrategy(json.strategy)
      setStatus("approved")
      setEditorValue(JSON.stringify(json.strategy, null, 2))
      router.refresh()
    } catch (err) {
      setError(err instanceof SyntaxError ? "Sitemap edits must be valid JSON." : err instanceof Error ? err.message : "Unable to approve sitemap and strategy.")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <GitBranch size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Sitemap & Strategy</h2>
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Generates and approves a local/service-business sitemap from the structured intake and research report.
          </p>
          {status === "approved" && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 font-dm text-[11px]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:T.grn }}>
              <CheckCircle2 size={13} aria-hidden="true" /> Approved{approvedAt ? ` / ${formatDate(approvedAt)}` : ""}{approvedBy ? ` / ${approvedBy}` : ""}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={disabled || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <WandSparkles size={15} aria-hidden="true" /> {busy === "generate" ? "Generating..." : "Generate Sitemap & Strategy"}
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={disabled || !editorValue || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <CheckCircle2 size={15} aria-hidden="true" /> {busy === "approve" ? "Approving..." : "Approve Edited Sitemap"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {!strategy ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <GitBranch size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No sitemap strategy has been generated yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Strategy summary</div>
            <p className="mt-2 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{strategy.strategySummary}</p>
            {buildOrder && <p className="mt-3 font-dm text-xs" style={{ color:T.t2 }}>Build order: {buildOrder}</p>}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {strategy.sitemap.map((page, index) => (
              <div key={`${page.path}-${index}`} className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-syne text-base font-bold">{page.title}</div>
                    <div className="mt-1 font-mono text-[11px]" style={{ color:T.t2 }}>{page.path}</div>
                  </div>
                  <span className="rounded px-2 py-1 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s3, border:`1px solid ${T.b2}`, color:page.priority === "primary" ? T.acc : page.priority === "secondary" ? T.amb : T.t2 }}>
                    {page.priority}
                  </span>
                </div>
                <p className="mt-3 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{page.pagePurpose}</p>
                <div className="mt-3 grid gap-2 font-dm text-xs" style={{ color:T.t2 }}>
                  <div><strong style={{ color:T.t1 }}>Intent:</strong> {page.targetKeyword} / {page.searchIntent}</div>
                  <div><strong style={{ color:T.t1 }}>CTA:</strong> {page.primaryCta}</div>
                  <div><strong style={{ color:T.t1 }}>Trust:</strong> {page.trustElements.join("; ")}</div>
                  <div><strong style={{ color:T.t1 }}>Schema:</strong> {page.schemaRecommendation}</div>
                  <div><strong style={{ color:T.t1 }}>Conversion:</strong> {page.conversionNotes}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MiniList title="Conversion Notes" rows={strategy.conversionNotes} />
            <MiniList title="Internal Linking Plan" rows={strategy.internalLinkingPlan} />
          </div>

          <label className="block font-dm text-sm">
            <span className="mb-2 block text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Editable strategy JSON</span>
            <textarea
              rows={14}
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
              className="font-mono text-xs"
              spellCheck={false}
            />
          </label>
        </div>
      )}
    </section>
  )
}

function MiniList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{title}</div>
      <ul className="mt-2 space-y-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>
        {rows.map((row) => <li key={row}>{row}</li>)}
      </ul>
    </div>
  )
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}
