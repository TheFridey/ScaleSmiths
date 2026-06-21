"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Circle, MinusCircle, Rocket, ShieldCheck, XCircle } from "lucide-react"
import {
  FORGE_DEPLOY_METHODS,
  buildForgeDeploymentNotesContent,
  type ForgeDeployArtifactState,
  type ForgeDeployChecklistItem,
  type ForgeDeployConfirmations,
  type ForgeDeployManualKey,
  type ForgeDeployMethod,
  type ForgeDeploymentNotes,
} from "@/lib/forge-deploy"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeDeployPanel({
  projectId,
  initialDeploy,
  siteReady,
  disabled = false,
}: {
  projectId: number
  initialDeploy: ForgeDeployArtifactState
  siteReady: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [notes, setNotes] = useState<ForgeDeploymentNotes | null>(initialDeploy.notes)
  const [method, setMethod] = useState<ForgeDeployMethod>(initialDeploy.method)
  const [confirmations, setConfirmations] = useState<ForgeDeployConfirmations>(initialDeploy.confirmations)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setNotes(initialDeploy.notes)
    setMethod(initialDeploy.method)
    setConfirmations(initialDeploy.confirmations)
  }, [initialDeploy])

  const lifecycle = notes?.lifecycle ?? "draft"
  const ready = notes?.readiness.ready ?? false
  const canAct = !disabled && busy === null && siteReady

  async function call(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action)
    setError("")
    try {
      const response = await fetch(`/api/forge/projects/${projectId}/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || "Unable to run deployment workflow.")
      setNotes(json.notes)
      if (json.notes?.confirmations) setConfirmations(json.notes.confirmations)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run deployment workflow.")
    } finally {
      setBusy(null)
    }
  }

  function toggleConfirmation(key: ForgeDeployManualKey) {
    const next = { ...confirmations, [key]: !confirmations[key] }
    setConfirmations(next)
    void call("update_checklist", { confirmations: next })
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Rocket size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Deployment</h2>
            <Badge value={lifecycle} tone={lifecycle === "deployed" ? "good" : lifecycle === "ready" ? "accent" : "muted"} />
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Controlled deployment workflow. ScaleSmiths generates instructions and config — it never mutates a client server automatically. Work the checklist, mark ready, then mark deployed once live.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {disabled && <Notice text="Archived projects are locked from deployment." />}
      {!disabled && !siteReady && <Notice text="Generate the site before preparing a deployment." />}

      <div className="mb-4">
        <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Deployment method</div>
        <div className="grid gap-2 md:grid-cols-3">
          {FORGE_DEPLOY_METHODS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMethod(option.id)}
              className="rounded-lg border p-3 text-left"
              style={{ background: method === option.id ? "rgba(99,102,241,.08)" : T.s2, borderColor: method === option.id ? T.acc : T.b1 }}
            >
              <div className="font-dm text-sm font-semibold">{option.label}</div>
              <p className="mt-1 font-dm text-[11px] leading-relaxed" style={{ color:T.t2 }}>{option.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void call("prepare", { method, confirmations })}
            disabled={!canAct}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <Rocket size={15} aria-hidden="true" /> {busy === "prepare" ? "Generating..." : "Generate Deployment Notes"}
          </button>
          <button
            type="button"
            onClick={() => void call("mark_ready")}
            disabled={!canAct || lifecycle === "deployed"}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <ShieldCheck size={15} aria-hidden="true" /> {busy === "mark_ready" ? "Marking..." : "Mark Ready to Deploy"}
          </button>
          <button
            type="button"
            onClick={() => void call("mark_deployed")}
            disabled={!canAct || lifecycle !== "ready"}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <CheckCircle2 size={15} aria-hidden="true" /> {busy === "mark_deployed" ? "Marking..." : "Mark Deployed"}
          </button>
        </div>
      </div>

      {!notes ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Rocket size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No deployment has been prepared for this project yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor: ready ? T.grn : T.b1 }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Deployment checklist</div>
              <span className="font-dm text-xs font-semibold" style={{ color: ready ? T.grn : T.amb }}>{ready ? "Ready" : "Incomplete"}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {notes.checklist.map((item) => (
                <ChecklistRow
                  key={item.key}
                  item={item}
                  disabled={disabled || busy !== null}
                  onToggle={item.source === "manual" && item.status !== "skipped" ? () => toggleConfirmation(item.key as ForgeDeployManualKey) : undefined}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Deployment notes ({notes.method})</div>
            <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap rounded p-3 font-mono text-[12px] leading-relaxed" style={{ background:T.s3, color:T.t1 }}>
              {buildForgeDeploymentNotesContent(notes)}
            </pre>
          </div>
        </div>
      )}
    </section>
  )
}

function ChecklistRow({ item, disabled, onToggle }: { item: ForgeDeployChecklistItem; disabled: boolean; onToggle?: () => void }) {
  const Icon = item.status === "passed" ? CheckCircle2 : item.status === "failed" ? XCircle : item.status === "skipped" ? MinusCircle : Circle
  const color = item.status === "passed" ? T.grn : item.status === "failed" ? T.red : item.status === "skipped" ? T.t3 : T.amb
  const interactive = Boolean(onToggle)

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || !interactive}
      className="flex items-start gap-2 rounded-lg border p-3 text-left disabled:cursor-default"
      style={{ background:T.s1, borderColor:T.b1, cursor: interactive && !disabled ? "pointer" : "default" }}
    >
      <Icon size={16} style={{ color }} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-dm text-sm font-semibold">{item.label}</span>
        <span className="ml-2 font-dm text-[10px] uppercase tracking-[.05em]" style={{ color }}>{item.status}</span>
        <p className="mt-0.5 font-dm text-[11px] leading-relaxed" style={{ color:T.t2 }}>{item.detail}</p>
      </span>
    </button>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "accent" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "accent" ? T.acc : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
