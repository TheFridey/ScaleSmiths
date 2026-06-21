"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Monitor, Play, Smartphone, Square, StopCircle, Tablet } from "lucide-react"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import { FORGE_PREVIEW_VIEWPORTS, type ForgePreviewState, type ForgePreviewViewport } from "@/lib/forge-preview"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgePreviewPanel({
  projectId,
  initialWorkspace,
  initialGeneratedCode,
  initialPreview,
  disabled = false,
}: {
  projectId: number
  initialWorkspace: ForgeWorkspaceMetadata | null
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  initialPreview: ForgePreviewState | null
  disabled?: boolean
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<ForgePreviewState | null>(initialPreview)
  const [viewport, setViewport] = useState<ForgePreviewViewport>("desktop")
  const [busy, setBusy] = useState<"start" | "stop" | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setPreview(initialPreview)
  }, [initialPreview])

  const readiness = useMemo(() => {
    const missing: string[] = []
    if (!initialWorkspace) missing.push("generated workspace")
    if (initialGeneratedCode.status !== "generated") missing.push("generated site code")
    return missing
  }, [initialGeneratedCode.status, initialWorkspace])
  const active = preview?.status === "running" && Boolean(preview.url)
  const canStart = !disabled && busy === null && readiness.length === 0
  const canStop = !disabled && busy === null && Boolean(preview && (preview.status === "running" || preview.status === "starting"))
  const frame = FORGE_PREVIEW_VIEWPORTS[viewport]

  async function refreshPreview() {
    const response = await fetch(`/api/forge/projects/${projectId}/preview`, { method: "GET" })
    const json = await response.json().catch(() => ({}))
    if (response.ok && json.ok) setPreview(json.preview)
  }

  async function startPreview() {
    setBusy("start")
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; preview: ForgePreviewState }>(`/api/forge/projects/${projectId}/preview`)

      if (!json.ok) {
        throw new Error(json.error || "Unable to start preview.")
      }

      setPreview(json.preview)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start preview.")
      await refreshPreview().catch(() => undefined)
    } finally {
      setBusy(null)
    }
  }

  async function stopPreview() {
    setBusy("stop")
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/preview`, { method: "DELETE" })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to stop preview.")
      }

      setPreview(json.preview)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to stop preview.")
    } finally {
      setBusy(null)
    }
  }

  function openPreview() {
    if (preview?.url) window.open(preview.url, "_blank", "noopener,noreferrer")
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Monitor size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Preview System</h2>
            <Badge value={preview?.status ?? "stopped"} tone={active ? "good" : preview?.status === "failed" ? "bad" : "muted"} />
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Starts an internal local Next.js preview for the generated site and embeds it here for desktop, tablet, and mobile checks.
          </p>
          <p className="mt-2 max-w-[760px] font-dm text-xs leading-relaxed" style={{ color:T.amb }}>
            V1 binds to loopback by default. Preview actions are admin-authenticated; the preview server itself should not be publicly exposed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void startPreview()}
            disabled={!canStart}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <Play size={15} aria-hidden="true" /> {busy === "start" ? "Starting..." : "Start Preview"}
          </button>
          <button
            type="button"
            onClick={() => void stopPreview()}
            disabled={!canStop}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <StopCircle size={15} aria-hidden="true" /> {busy === "stop" ? "Stopping..." : "Stop Preview"}
          </button>
          <button
            type="button"
            onClick={openPreview}
            disabled={!active}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <ExternalLink size={15} aria-hidden="true" /> Open Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {preview?.error && preview.status === "failed" && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {preview.error}
        </div>
      )}

      {disabled && <Notice text="Archived projects are locked from preview changes." tone="muted" />}
      {!disabled && readiness.length > 0 && <Notice text={`Ready after: ${readiness.join(", ")}.`} tone="warn" />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border p-1" style={{ background:T.s2, borderColor:T.b1 }}>
          <ViewportButton value="desktop" active={viewport === "desktop"} setViewport={setViewport} icon={Monitor} />
          <ViewportButton value="tablet" active={viewport === "tablet"} setViewport={setViewport} icon={Tablet} />
          <ViewportButton value="mobile" active={viewport === "mobile"} setViewport={setViewport} icon={Smartphone} />
        </div>
        <div className="font-dm text-xs" style={{ color:T.t3 }}>
          {preview?.url ? `${preview.url} / ${preview.method}` : "No active preview URL"}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border p-4" style={{ background:T.s3, borderColor:T.b1 }}>
        <div
          className="mx-auto overflow-hidden rounded-lg border shadow-sm transition-[width] duration-200"
          style={{
            width: active ? Math.min(frame.width, 1180) : "100%",
            maxWidth: "100%",
            height: active ? Math.min(frame.height, 760) : 280,
            background:T.s1,
            borderColor:T.b2,
          }}
        >
          {active && preview?.url ? (
            <iframe
              key={`${preview.url}-${viewport}`}
              title="Forge generated site preview"
              src={preview.url}
              className="h-full w-full border-0"
              sandbox="allow-forms allow-same-origin allow-scripts"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div>
                <Square size={18} className="mx-auto mb-3 text-acc" aria-hidden="true" />
                <p className="font-dm text-sm" style={{ color:T.t2 }}>
                  Start a preview to load the generated site in this frame.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ViewportButton({
  value,
  active,
  setViewport,
  icon: Icon,
}: {
  value: ForgePreviewViewport
  active: boolean
  setViewport: (value: ForgePreviewViewport) => void
  icon: typeof Monitor
}) {
  const config = FORGE_PREVIEW_VIEWPORTS[value]
  return (
    <button
      type="button"
      onClick={() => setViewport(value)}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 font-dm text-xs font-semibold"
      style={{ background: active ? T.s1 : "transparent", color: active ? T.t1 : T.t2 }}
      title={`${config.label} ${config.width}x${config.height}`}
    >
      <Icon size={14} aria-hidden="true" /> {config.label}
    </button>
  )
}

function Notice({ text, tone }: { text: string; tone: "warn" | "muted" }) {
  return (
    <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:tone === "warn" ? T.amb : T.b2, color:T.t2 }}>
      {text}
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "bad" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "bad" ? T.red : T.t2

  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
