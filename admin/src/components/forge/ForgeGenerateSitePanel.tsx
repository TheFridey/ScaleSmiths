"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Code2, Play, ShieldCheck } from "lucide-react"
import type { ForgeComponentSpecArtifactState } from "@/lib/forge-component-spec"
import type { ForgeGeneratedCodeArtifactState, ForgeGeneratedCodeSummary } from "@/lib/forge-frontend-code"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeGenerateSitePanel({
  projectId,
  initialWorkspace,
  componentSpecState,
  initialGeneratedCode,
  disabled = false,
}: {
  projectId: number
  initialWorkspace: ForgeWorkspaceMetadata | null
  componentSpecState: ForgeComponentSpecArtifactState
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const [summary, setSummary] = useState<ForgeGeneratedCodeSummary | null>(initialGeneratedCode.summary)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setSummary(initialGeneratedCode.summary)
  }, [initialGeneratedCode])

  const readiness = useMemo(() => {
    const missing: string[] = []
    if (!initialWorkspace) missing.push("generated workspace")
    if (componentSpecState.status !== "approved") missing.push("approved component specification")
    return missing
  }, [componentSpecState.status, initialWorkspace])
  const canGenerate = !disabled && !busy && readiness.length === 0

  async function generateSite() {
    setBusy(true)
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; summary: ForgeGeneratedCodeSummary }>(`/api/forge/projects/${projectId}/generate-site`)

      if (!json.ok) {
        throw new Error(json.error || "Unable to generate site code.")
      }

      setSummary(json.summary)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate site code.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Code2 size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Frontend Code Generator</h2>
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Runs the multi-pass build tail: code generation, SEO/schema generation, internal/design critique, automatic improvements, repairs, and final validation.
          </p>
          <p className="mt-2 flex max-w-[760px] items-start gap-1.5 font-dm text-xs leading-relaxed" style={{ color:T.amb }}>
            <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Files are written through Forge workspace safety utilities only, inside the generated-sites project folder, and readiness is gated by mandatory QA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generateSite()}
          disabled={!canGenerate}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background:T.acc }}
        >
          <Play size={15} aria-hidden="true" /> {busy ? "Running pipeline..." : "Run Build Pipeline"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && (
        <Notice text="Archived projects are locked from new code generation." tone="muted" />
      )}

      {!disabled && readiness.length > 0 && (
        <Notice text={`Ready after: ${readiness.join(", ")}.`} tone="warn" />
      )}

      {!summary ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Code2 size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No generated frontend code summary exists for this project yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Detail label="Workspace" value={summary.workspacePath} />
            <Detail label="Files" value={String(summary.fileCount)} />
            <Detail label="Routes" value={String(summary.routeCount)} />
            <Detail label="Generated" value={formatDate(summary.generatedAt)} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <MiniList title="Routes" items={summary.routes} />
            <MiniList title="Components" items={summary.components} />
            <MiniList title="Safety" items={summary.safetyChecks} />
          </div>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-1 break-words font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{value}</div>
    </div>
  )
}

function MiniList({ title, items }: { title: string; items: unknown[] }) {
  const values = items.map((item) => String(item)).slice(0, 8)
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{title}</div>
      <div className="mt-2 space-y-1">
        {values.map((item) => (
          <div key={item} className="break-words font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{item}</div>
        ))}
      </div>
    </div>
  )
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}
