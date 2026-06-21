"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, ShieldCheck } from "lucide-react"
import type { ForgeResendConfig, ForgeResendReplyToBehaviour } from "@/lib/forge-resend"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeResendConfigPanel({
  projectId,
  initialConfig,
  disabled = false,
}: {
  projectId: number
  initialConfig: ForgeResendConfig
  disabled?: boolean
}) {
  const router = useRouter()
  const [config, setConfig] = useState(initialConfig)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setConfig(initialConfig)
  }, [initialConfig])

  function update<K extends keyof ForgeResendConfig>(key: K, value: ForgeResendConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  async function saveConfig() {
    setBusy(true)
    setError("")
    setSaved(false)

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/integrations/resend`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to save Resend integration.")
      }

      setConfig(json.config)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save Resend integration.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Mail size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Resend Lead Forms</h2>
            <Badge value={config.enabled ? "Enabled" : "Disabled"} tone={config.enabled ? "good" : "muted"} />
            {config.testMode && <Badge value="Test mode" tone="warn" />}
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Configures generated client-site contact forms. The API key stays in the deployment environment as RESEND_API_KEY and is never stored in Forge.
          </p>
          <p className="mt-2 flex max-w-[760px] items-start gap-1.5 font-dm text-xs leading-relaxed" style={{ color:T.amb }}>
            <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Save this before regenerating the site so the generated contact route and handover docs include the latest settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveConfig()}
          disabled={disabled || busy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background:T.acc }}
        >
          {busy ? "Saving..." : "Save Resend Config"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(16,185,129,.08)", borderColor:"rgba(16,185,129,.25)", color:T.t1 }}>
          Resend integration saved. Regenerate the site to write the latest client form module.
        </div>
      )}
      {disabled && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
          Archived projects are locked from integration changes.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 font-dm text-sm" style={{ color:T.t1 }}>
            From email
            <input value={config.fromEmail} onChange={(event) => update("fromEmail", event.target.value)} disabled={disabled} className="rounded-lg border px-3 py-2 disabled:opacity-60" style={{ background:T.s2, borderColor:T.b1 }} placeholder="Website <hello@example.com>" />
          </label>
          <label className="grid gap-1.5 font-dm text-sm" style={{ color:T.t1 }}>
            To email
            <input value={config.toEmail} onChange={(event) => update("toEmail", event.target.value)} disabled={disabled} className="rounded-lg border px-3 py-2 disabled:opacity-60" style={{ background:T.s2, borderColor:T.b1 }} placeholder="leads@example.com" />
          </label>
          <label className="grid gap-1.5 font-dm text-sm" style={{ color:T.t1 }}>
            Reply-to behaviour
            <select value={config.replyToBehaviour} onChange={(event) => update("replyToBehaviour", event.target.value as ForgeResendReplyToBehaviour)} disabled={disabled} className="rounded-lg border px-3 py-2 disabled:opacity-60" style={{ background:T.s2, borderColor:T.b1 }}>
              <option value="submitter">Use submitter email</option>
              <option value="from_email">Use from email</option>
              <option value="none">No reply-to header</option>
            </select>
          </label>
          <label className="grid gap-1.5 font-dm text-sm" style={{ color:T.t1 }}>
            Subject prefix
            <input value={config.subjectPrefix} onChange={(event) => update("subjectPrefix", event.target.value)} disabled={disabled} className="rounded-lg border px-3 py-2 disabled:opacity-60" style={{ background:T.s2, borderColor:T.b1 }} placeholder="Website enquiry" />
          </label>
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 font-dm text-sm" style={{ background:T.s2, borderColor:T.b1, color:T.t1 }}>
            <input type="checkbox" checked={config.enabled} onChange={(event) => update("enabled", event.target.checked)} disabled={disabled} />
            Enabled
          </label>
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 font-dm text-sm" style={{ background:T.s2, borderColor:T.b1, color:T.t1 }}>
            <input type="checkbox" checked={config.testMode} onChange={(event) => update("testMode", event.target.checked)} disabled={disabled} />
            Test mode
          </label>
        </div>

        <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Generated form preview</div>
          <div className="grid gap-2 font-dm text-xs" style={{ color:T.t2 }}>
            {["name", "email", "company", "phone", "message", "intent/source page", "hidden website field"].map((field) => (
              <div key={field} className="rounded border px-3 py-2" style={{ background:T.s1, borderColor:T.b1 }}>{field}</div>
            ))}
          </div>
          <div className="mt-4 rounded border p-3 font-dm text-xs leading-relaxed" style={{ background:T.s3, borderColor:T.b1, color:T.t2 }}>
            Email template includes enquiry metadata, source page, reply-to behaviour, honeypot handling, and a local in-memory rate-limit placeholder.
          </div>
        </div>
      </div>
    </section>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "warn" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "warn" ? T.amb : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
