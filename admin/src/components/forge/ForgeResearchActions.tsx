"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SearchCheck } from "lucide-react"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", acc:"var(--acc)", red:"var(--red)" }

export function ForgeResearchActions({ projectId, disabled = false }: { projectId: number; disabled?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function runResearch() {
    setBusy(true)
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string }>(`/api/forge/projects/${projectId}/research`)

      if (!json.ok) {
        throw new Error(json.error || "Unable to run research agent.")
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run research agent.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <SearchCheck size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Research Agent</h2>
          </div>
          <p className="max-w-[720px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Generates a structured website and business research report from project details, intake, memory, and supplied competitor context.
          </p>
          <p className="mt-2 max-w-[720px] font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>
            Live website scraping is not used in this stage; URL fields are treated as planning context only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runResearch()}
          disabled={disabled || busy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background:T.acc }}
        >
          <SearchCheck size={15} aria-hidden="true" /> {busy ? "Running..." : "Run Research"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && (
        <div className="mt-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
          Archived projects are locked from new research runs.
        </div>
      )}
    </section>
  )
}
