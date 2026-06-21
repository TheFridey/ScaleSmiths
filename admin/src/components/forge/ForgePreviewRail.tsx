"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Monitor, Play, RefreshCw, Smartphone, StopCircle, Tablet } from "lucide-react"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import { FORGE_PREVIEW_VIEWPORTS, type ForgePreviewState, type ForgePreviewViewport } from "@/lib/forge-preview"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgePreviewRail({
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
  const [busy, setBusy] = useState<"start" | "stop" | "refresh" | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setPreview(initialPreview)
  }, [initialPreview])

  const readiness = useMemo(() => {
    const missing: string[] = []
    if (!initialWorkspace) missing.push("workspace")
    if (initialGeneratedCode.status !== "generated") missing.push("site code")
    return missing
  }, [initialGeneratedCode.status, initialWorkspace])
  const active = preview?.status === "running" && Boolean(preview.url)
  const frame = FORGE_PREVIEW_VIEWPORTS[viewport]
  const canStart = !disabled && busy === null && readiness.length === 0
  const canStop = !disabled && busy === null && Boolean(preview && (preview.status === "running" || preview.status === "starting"))

  async function requestPreview(method: "GET" | "POST" | "DELETE", busyState: "start" | "stop" | "refresh") {
    setBusy(busyState)
    setError("")

    try {
      // Starting the preview is a queued job (it can take a while); GET/DELETE stay synchronous.
      let json: { ok?: boolean; error?: string; preview?: ForgePreviewState }
      if (method === "POST") {
        json = await submitForgeJob<{ ok?: boolean; error?: string; preview?: ForgePreviewState }>(`/api/forge/projects/${projectId}/preview`)
      } else {
        const response = await fetch(`/api/forge/projects/${projectId}/preview`, { method })
        json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error || "Unable to update preview.")
      }
      if (!json.ok) throw new Error(json.error || "Unable to update preview.")
      setPreview(json.preview ?? null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update preview.")
    } finally {
      setBusy(null)
    }
  }

  function openPreview() {
    if (preview?.url) window.open(preview.url, "_blank", "noopener,noreferrer")
  }

  return (
    <aside className="rounded-xl border p-4 lg:sticky lg:top-4" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Monitor size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Live Preview</h2>
          </div>
          <Badge value={preview?.status ?? "stopped"} tone={active ? "good" : preview?.status === "failed" ? "bad" : "muted"} />
        </div>
        <button
          type="button"
          onClick={() => void requestPreview("GET", "refresh")}
          disabled={busy !== null}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-60"
          style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          title="Refresh preview state"
        >
          <RefreshCw size={15} className={busy === "refresh" ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border px-3 py-2 font-dm text-xs" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}
      {!disabled && readiness.length > 0 && (
        <div className="mb-3 rounded-lg border px-3 py-2 font-dm text-xs" style={{ background:T.s2, borderColor:T.amb, color:T.t2 }}>
          Ready after: {readiness.join(", ")}.
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border p-1" style={{ background:T.s2, borderColor:T.b1 }}>
        <ViewportButton value="desktop" active={viewport === "desktop"} setViewport={setViewport} icon={Monitor} />
        <ViewportButton value="tablet" active={viewport === "tablet"} setViewport={setViewport} icon={Tablet} />
        <ViewportButton value="mobile" active={viewport === "mobile"} setViewport={setViewport} icon={Smartphone} />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => void requestPreview("POST", "start")} disabled={!canStart} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-2 font-dm text-xs font-semibold text-white disabled:opacity-60" style={{ background:T.acc }}>
          <Play size={13} aria-hidden="true" /> Start
        </button>
        <button type="button" onClick={() => void requestPreview("DELETE", "stop")} disabled={!canStop} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 font-dm text-xs font-semibold disabled:opacity-60" style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}>
          <StopCircle size={13} aria-hidden="true" /> Stop
        </button>
        <button type="button" onClick={openPreview} disabled={!active} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 font-dm text-xs font-semibold disabled:opacity-60" style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}>
          <ExternalLink size={13} aria-hidden="true" /> Open
        </button>
      </div>

      <div className="overflow-auto rounded-xl border p-3" style={{ background:T.s3, borderColor:T.b1 }}>
        <div
          className="mx-auto overflow-hidden rounded-lg border shadow-sm transition-[width,height] duration-200"
          style={{
            width: active ? Math.min(frame.width, viewport === "desktop" ? 560 : frame.width) : "100%",
            maxWidth: "100%",
            height: active ? (viewport === "mobile" ? 560 : viewport === "tablet" ? 620 : 420) : 260,
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
            <div className="flex h-full items-center justify-center p-5 text-center">
              <p className="font-dm text-sm" style={{ color:T.t2 }}>Start preview to load the generated site.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 truncate font-dm text-[11px]" style={{ color:T.t3 }} title={preview?.url ?? undefined}>
        {preview?.url ?? "No active preview URL"}
      </div>
    </aside>
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
  return (
    <button
      type="button"
      onClick={() => setViewport(value)}
      className="inline-flex min-h-8 items-center justify-center rounded-md"
      style={{ background: active ? T.s1 : "transparent", color: active ? T.t1 : T.t2 }}
      title={FORGE_PREVIEW_VIEWPORTS[value].label}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
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
