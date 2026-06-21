"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FolderPlus, ShieldCheck } from "lucide-react"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeWorkspacePanel({
  projectId,
  initialWorkspace,
  disabled = false,
}: {
  projectId: number
  initialWorkspace: ForgeWorkspaceMetadata | null
  disabled?: boolean
}) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState(initialWorkspace)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setWorkspace(initialWorkspace)
  }, [initialWorkspace])

  async function createWorkspace() {
    setBusy(true)
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/workspace`, { method: "POST" })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to create generated-site workspace.")
      }

      setWorkspace(json.workspace)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create generated-site workspace.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FolderPlus size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Generated Site Workspace</h2>
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Creates an isolated Next.js, TypeScript, and Tailwind workspace under the ignored generated-sites folder.
          </p>
          <p className="mt-2 flex max-w-[760px] items-start gap-1.5 font-dm text-xs leading-relaxed" style={{ color:T.amb }}>
            <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Generation utilities are fenced to this workspace and cannot target the ScaleSmiths admin or public web apps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createWorkspace()}
          disabled={disabled || busy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background:T.acc }}
        >
          <FolderPlus size={15} aria-hidden="true" /> {busy ? "Creating..." : workspace ? "Refresh Workspace" : "Create Workspace"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
          Archived projects are locked from new workspace creation.
        </div>
      )}

      {!workspace ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <FolderPlus size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No generated-site workspace exists for this project yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Detail label="Path" value={workspace.relativePath} />
          <Detail label="Template" value={workspace.template} />
          <Detail label="Files" value={String(workspace.fileCount)} />
          <Detail label="Updated" value={formatDate(workspace.updatedAt)} />
        </div>
      )}
    </section>
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

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}
