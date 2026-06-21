"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronDown, ListChecks, Search, Wand2 } from "lucide-react"
import type { ForgeCopyArtifactState } from "@/lib/forge-copy"
import {
  FORGE_KEYWORD_STUFFING_WARNING,
  type ForgeSeoArtifactState,
  type ForgeSeoCategory,
  type ForgeSeoChecklistItem,
  type ForgeSeoPack,
} from "@/lib/forge-seo"
import type { ForgeSitemapArtifactState } from "@/lib/forge-sitemap"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

const CATEGORY_LABELS: Record<ForgeSeoCategory, string> = {
  seo: "SEO (Google)",
  aeo: "AEO (Answer Engines)",
  geo: "GEO (Local/Geo)",
}

export function ForgeSeoPanel({
  projectId,
  initialSeo,
  sitemapState,
  copyState,
  disabled = false,
}: {
  projectId: number
  initialSeo: ForgeSeoArtifactState
  sitemapState: ForgeSitemapArtifactState
  copyState: ForgeCopyArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const [pack, setPack] = useState<ForgeSeoPack | null>(initialSeo.pack)
  const [busy, setBusy] = useState<"generate" | "fix" | null>(null)
  const [error, setError] = useState("")
  const [showChecklist, setShowChecklist] = useState(true)

  useEffect(() => {
    setPack(initialSeo.pack)
  }, [initialSeo])

  const readiness = useMemo(() => {
    const missing: string[] = []
    if (sitemapState.status !== "approved") missing.push("approved sitemap")
    if (copyState.status !== "approved") missing.push("approved copy")
    return missing
  }, [sitemapState.status, copyState.status])

  const canGenerate = !disabled && busy === null && readiness.length === 0
  const canFix = canGenerate && pack !== null

  async function runAction(action: "generate" | "fix") {
    setBusy(action)
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/seo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to run the SEO engine.")
      }

      setPack(json.pack)
      setShowChecklist(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run the SEO engine.")
    } finally {
      setBusy(null)
    }
  }

  const failing = pack ? pack.checklist.filter((item) => item.status === "fail").length : 0
  const warnings = pack ? pack.checklist.filter((item) => item.status === "warn").length : 0

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Search size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">SEO / AEO / GEO Engine</h2>
            {pack && <Badge value={`${pack.score.overall}/100`} tone={pack.score.overall >= 80 ? "good" : pack.score.overall >= 70 ? "warn" : "bad"} />}
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Generates titles, meta descriptions, canonical URLs, Open Graph/Twitter metadata, JSON-LD (WebPage, FAQ, LocalBusiness, Service, Breadcrumb), sitemap.xml, and robots.txt — then scores the site for Google and AI answer engines.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runAction("generate")}
            disabled={!canGenerate}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <Search size={15} aria-hidden="true" /> {busy === "generate" ? "Generating..." : "Generate SEO Pack"}
          </button>
          <button
            type="button"
            onClick={() => void runAction("fix")}
            disabled={!canFix}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <Wand2 size={15} aria-hidden="true" /> {busy === "fix" ? "Fixing..." : "Fix Missing Metadata"}
          </button>
          <button
            type="button"
            onClick={() => setShowChecklist((value) => !value)}
            disabled={!pack}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <ListChecks size={15} aria-hidden="true" /> View Checklist <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && <Notice text="Archived projects are locked from SEO changes." tone="muted" />}
      {!disabled && readiness.length > 0 && <Notice text={`Ready after: ${readiness.join(", ")}.`} tone="warn" />}

      <div className="mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 font-dm text-xs leading-relaxed" style={{ background:T.s2, borderColor:T.amb, color:T.t2 }}>
        <AlertTriangle size={14} style={{ color:T.amb }} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{FORGE_KEYWORD_STUFFING_WARNING}</span>
      </div>

      {!pack ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Search size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No SEO pack has been generated for this project yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ScoreCard label="Overall" value={pack.score.overall} />
            <ScoreCard label="SEO" value={pack.score.seo} />
            <ScoreCard label="AEO" value={pack.score.aeo} />
            <ScoreCard label="GEO" value={pack.score.geo} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Detail label="Pages" value={String(pack.pages.length)} />
            <Detail label="Failing checks" value={String(failing)} />
            <Detail label="Warnings" value={String(warnings)} />
          </div>

          {pack.warnings.length > 0 && (
            <div className="rounded-lg border px-4 py-3" style={{ background:"rgba(245,158,11,.08)", borderColor:T.amb }}>
              <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Warnings</div>
              <ul className="space-y-1">
                {pack.warnings.map((warning) => (
                  <li key={warning} className="font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {showChecklist && <Checklist checklist={pack.checklist} />}

          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Per-page metadata</div>
            <div className="space-y-2">
              {pack.pages.map((page) => (
                <details key={page.path} className="rounded border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
                  <summary className="cursor-pointer font-dm text-sm font-semibold">{page.path} <span className="font-normal" style={{ color:T.t3 }}>({page.jsonLdTypes.join(", ") || "no schema"})</span></summary>
                  <div className="mt-2 space-y-1 font-dm text-xs" style={{ color:T.t2 }}>
                    <div><span style={{ color:T.t3 }}>Title:</span> {page.title} ({page.title.length})</div>
                    <div><span style={{ color:T.t3 }}>Meta:</span> {page.metaDescription} ({page.metaDescription.length})</div>
                    <div><span style={{ color:T.t3 }}>Canonical:</span> {page.canonical}</div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Checklist({ checklist }: { checklist: ForgeSeoChecklistItem[] }) {
  const categories: ForgeSeoCategory[] = ["seo", "aeo", "geo"]
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {categories.map((category) => (
        <div key={category} className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{CATEGORY_LABELS[category]}</div>
          <div className="space-y-2">
            {checklist.filter((item) => item.category === category).map((item) => (
              <div key={item.id} className="rounded border p-2.5" style={{ background:T.s1, borderColor:T.b1 }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-dm text-xs font-semibold">{item.label}</div>
                  <Badge value={item.status} tone={item.status === "pass" ? "good" : item.status === "warn" ? "warn" : "bad"} />
                </div>
                <p className="mt-1 font-dm text-[11px] leading-relaxed" style={{ color:T.t2 }}>{item.detail}</p>
                {item.recommendation && <p className="mt-1 font-dm text-[11px] leading-relaxed" style={{ color:T.amb }}>→ {item.recommendation}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? T.grn : value >= 70 ? T.amb : T.red
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-1 font-syne text-2xl font-extrabold" style={{ color:tone }}>{value}<span className="font-dm text-sm font-normal" style={{ color:T.t3 }}>/100</span></div>
    </div>
  )
}

function Notice({ text, tone }: { text: string; tone: "warn" | "muted" }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:tone === "warn" ? T.amb : T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-1 break-words font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{value}</div>
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? T.grn : tone === "warn" ? T.amb : T.red
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
