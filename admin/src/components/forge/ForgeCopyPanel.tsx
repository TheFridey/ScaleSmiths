"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileText, RefreshCw, WandSparkles } from "lucide-react"
import type { ForgeCopyArtifactState, ForgeCopyDocument } from "@/lib/forge-copy"
import type { ForgeSitemapArtifactState } from "@/lib/forge-sitemap"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeCopyPanel({
  projectId,
  initialState,
  sitemapState,
  disabled = false,
}: {
  projectId: number
  initialState: ForgeCopyArtifactState
  sitemapState: ForgeSitemapArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const initialCopy = initialState.approvedCopy ?? initialState.copy
  const [copy, setCopy] = useState<ForgeCopyDocument | null>(initialCopy)
  const [status, setStatus] = useState(initialState.status)
  const [approvedAt, setApprovedAt] = useState(initialState.approvedAt)
  const [approvedBy, setApprovedBy] = useState(initialState.approvedBy)
  const [editorValue, setEditorValue] = useState(initialCopy ? JSON.stringify(initialCopy, null, 2) : "")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState<"view" | "edit">("view")

  useEffect(() => {
    const nextCopy = initialState.approvedCopy ?? initialState.copy
    setCopy(nextCopy)
    setStatus(initialState.status)
    setApprovedAt(initialState.approvedAt)
    setApprovedBy(initialState.approvedBy)
    setEditorValue(nextCopy ? JSON.stringify(nextCopy, null, 2) : "")
  }, [initialState])

  const canGenerate = sitemapState.status === "approved" && !disabled
  const selfCheckTone = useMemo(() => copy?.selfCheck.status === "pass" ? T.grn : T.amb, [copy])

  async function generate(regeneratePagePath?: string) {
    setBusy(regeneratePagePath ? `regenerate:${regeneratePagePath}` : "generate")
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; copy: ForgeCopyDocument }>(`/api/forge/projects/${projectId}/copy`, regeneratePagePath ? { regeneratePagePath } : {})

      if (!json.ok) {
        throw new Error(json.error || "Unable to generate copy.")
      }

      setCopy(json.copy)
      setStatus("draft")
      setApprovedAt(null)
      setApprovedBy(null)
      setEditorValue(JSON.stringify(json.copy, null, 2))
      setViewMode("view")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate copy.")
    } finally {
      setBusy("")
    }
  }

  async function approve() {
    setBusy("approve")
    setError("")

    try {
      const parsed = JSON.parse(editorValue) as unknown
      const response = await fetch(`/api/forge/projects/${projectId}/copy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copy: parsed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to approve copy.")
      }

      setCopy(json.copy)
      setStatus("approved")
      setEditorValue(JSON.stringify(json.copy, null, 2))
      setViewMode("view")
      router.refresh()
    } catch (err) {
      setError(err instanceof SyntaxError ? "Copy edits must be valid JSON." : err instanceof Error ? err.message : "Unable to approve copy.")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileText size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Copy</h2>
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Generates page copy from the approved sitemap, research report, intake summary, brand notes, and target audience.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {status === "approved" && (
              <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-dm text-[11px]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:T.grn }}>
                <CheckCircle2 size={13} aria-hidden="true" /> Approved{approvedAt ? ` / ${formatDate(approvedAt)}` : ""}{approvedBy ? ` / ${approvedBy}` : ""}
              </span>
            )}
            {copy && (
              <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-dm text-[11px]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:selfCheckTone }}>
                Self-check: {copy.selfCheck.status}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!canGenerate || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <WandSparkles size={15} aria-hidden="true" /> {busy === "generate" ? "Generating..." : "Generate Copy"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "view" ? "edit" : "view")}
            disabled={!copy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <FileText size={15} aria-hidden="true" /> {viewMode === "view" ? "Edit Copy" : "View Copy"}
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={disabled || !editorValue || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <CheckCircle2 size={15} aria-hidden="true" /> {busy === "approve" ? "Approving..." : "Approve Copy"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {!canGenerate && !disabled && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
          Approve the sitemap and strategy before generating copy.
        </div>
      )}

      {!copy ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <FileText size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No copy document has been generated yet.</p>
        </div>
      ) : viewMode === "edit" ? (
        <label className="block font-dm text-sm">
          <span className="mb-2 block text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Editable copy JSON</span>
          <textarea
            rows={18}
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </label>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Copy summary</div>
            <p className="mt-2 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{copy.copySummary}</p>
            {(copy.selfCheck.flaggedPhrases.length > 0 || copy.selfCheck.warnings.length > 0) && (
              <div className="mt-3 space-y-1 font-dm text-xs" style={{ color:T.amb }}>
                {copy.selfCheck.flaggedPhrases.length > 0 && <div>Flagged phrases: {copy.selfCheck.flaggedPhrases.join(", ")}</div>}
                {copy.selfCheck.warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {copy.pages.map((page) => (
              <article key={page.path} className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-syne text-base font-bold">{page.pageTitle}</div>
                    <div className="mt-1 font-mono text-[11px]" style={{ color:T.t2 }}>{page.path}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generate(page.path)}
                    disabled={!canGenerate || Boolean(busy)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-dm text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ background:T.s3, borderColor:T.b2, color:T.t1 }}
                  >
                    <RefreshCw size={13} aria-hidden="true" /> {busy === `regenerate:${page.path}` ? "Regenerating..." : "Regenerate page copy"}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <MiniField label="SEO title" value={page.seoTitle} />
                  <MiniField label="Meta description" value={page.metaDescription} />
                  <MiniField label="H1" value={page.h1} />
                  <MiniField label="Hero subheading" value={page.heroSubheading} />
                  <MiniField label="Primary CTA" value={page.primaryCta} />
                  <MiniField label="Secondary CTA" value={page.secondaryCta} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <ListBlock title="Sections" rows={page.sections.map((section) => `${section.heading}: ${section.body}`)} />
                  <ListBlock title="FAQs" rows={page.faqItems.map((faq) => `${faq.question} ${faq.answer}`)} />
                  <ListBlock title="Service descriptions" rows={page.serviceDescriptions} />
                  <ListBlock title="Section headings" rows={page.sectionHeadings} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <MiniField label="Trust/proof copy" value={page.trustProofCopy} />
                  <MiniField label="Local SEO copy" value={page.localSeoCopy} />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s3, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <p className="mt-1 whitespace-pre-wrap font-dm text-xs leading-relaxed" style={{ color:T.t1 }}>{value}</p>
    </div>
  )
}

function ListBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s3, borderColor:T.b1 }}>
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
