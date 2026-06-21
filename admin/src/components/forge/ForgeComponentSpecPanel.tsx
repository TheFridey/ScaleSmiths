"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Component, WandSparkles } from "lucide-react"
import type { ForgeComponentSpecArtifactState, ForgeComponentSpecification } from "@/lib/forge-component-spec"
import type { ForgeDesignArtifactState } from "@/lib/forge-design"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeComponentSpecPanel({
  projectId,
  initialState,
  designState,
  disabled = false,
}: {
  projectId: number
  initialState: ForgeComponentSpecArtifactState
  designState: ForgeDesignArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const initialSpec = initialState.approvedSpec ?? initialState.spec
  const [spec, setSpec] = useState<ForgeComponentSpecification | null>(initialSpec)
  const [status, setStatus] = useState(initialState.status)
  const [approvedAt, setApprovedAt] = useState(initialState.approvedAt)
  const [approvedBy, setApprovedBy] = useState(initialState.approvedBy)
  const [editorValue, setEditorValue] = useState(initialSpec ? JSON.stringify(initialSpec, null, 2) : "")
  const [viewMode, setViewMode] = useState<"view" | "edit">("view")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const nextSpec = initialState.approvedSpec ?? initialState.spec
    setSpec(nextSpec)
    setStatus(initialState.status)
    setApprovedAt(initialState.approvedAt)
    setApprovedBy(initialState.approvedBy)
    setEditorValue(nextSpec ? JSON.stringify(nextSpec, null, 2) : "")
  }, [initialState])

  const canGenerate = designState.status === "approved" && !disabled

  async function generate() {
    setBusy("generate")
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; spec: ForgeComponentSpecification }>(`/api/forge/projects/${projectId}/component-spec`)

      if (!json.ok) {
        throw new Error(json.error || "Unable to generate component specification.")
      }

      setSpec(json.spec)
      setStatus("draft")
      setApprovedAt(null)
      setApprovedBy(null)
      setEditorValue(JSON.stringify(json.spec, null, 2))
      setViewMode("view")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate component specification.")
    } finally {
      setBusy("")
    }
  }

  async function approve() {
    setBusy("approve")
    setError("")

    try {
      const parsed = JSON.parse(editorValue) as unknown
      const response = await fetch(`/api/forge/projects/${projectId}/component-spec`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: parsed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to approve component specification.")
      }

      setSpec(json.spec)
      setStatus("approved")
      setEditorValue(JSON.stringify(json.spec, null, 2))
      setViewMode("view")
      router.refresh()
    } catch (err) {
      setError(err instanceof SyntaxError ? "Component spec edits must be valid JSON." : err instanceof Error ? err.message : "Unable to approve component specification.")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Component size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Component Specification</h2>
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Creates the exact page and component blueprint the code generator should follow.
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
            disabled={!canGenerate || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <WandSparkles size={15} aria-hidden="true" /> {busy === "generate" ? "Generating..." : "Generate Component Spec"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "view" ? "edit" : "view")}
            disabled={!spec}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <Component size={15} aria-hidden="true" /> {viewMode === "view" ? "Edit Spec" : "View Spec"}
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={disabled || !editorValue || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <CheckCircle2 size={15} aria-hidden="true" /> {busy === "approve" ? "Approving..." : "Approve Spec"}
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
          Approve design direction before generating the component specification.
        </div>
      )}

      {!spec ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Component size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No component specification has been generated yet.</p>
        </div>
      ) : viewMode === "edit" ? (
        <label className="block font-dm text-sm">
          <span className="mb-2 block text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Editable component spec JSON</span>
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
            <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Blueprint summary</div>
            <p className="mt-2 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{spec.specSummary}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <MiniField label="Global layout" value={spec.globalLayout} />
            <MiniField label="Navbar" value={spec.navbarStructure} />
            <MiniField label="Footer" value={spec.footerStructure} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {spec.pages.map((page) => (
              <div key={page.path} className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="font-syne text-base font-bold">{page.pageTitle}</div>
                <div className="mt-1 font-mono text-[11px]" style={{ color:T.t2 }}>{page.path} / {page.template}</div>
                <p className="mt-3 font-dm text-xs leading-relaxed" style={{ color:T.t1 }}>Sections: {page.sectionOrder.join(" -> ")}</p>
                <p className="mt-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>Schema: {page.schemaRequirements.join("; ")}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {spec.components.map((component) => (
              <div key={component.name} className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="font-syne text-base font-bold">{component.name}</div>
                <p className="mt-2 font-dm text-xs leading-relaxed" style={{ color:T.t1 }}>{component.purpose}</p>
                <p className="mt-2 font-dm text-[11px]" style={{ color:T.t2 }}>Props: {component.props.join("; ")}</p>
                <p className="mt-2 font-dm text-[11px]" style={{ color:T.t2 }}>Integrations: {component.integrationPlaceholders.join("; ")}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ListBlock title="Animation requirements" rows={spec.animationRequirements} />
            <ListBlock title="Integration placeholders" rows={spec.integrationPlaceholders} />
            <ListBlock title="Schema/metadata requirements" rows={spec.schemaMetadataRequirements} />
            <ListBlock title="Code generator notes" rows={spec.codeGeneratorNotes} />
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
