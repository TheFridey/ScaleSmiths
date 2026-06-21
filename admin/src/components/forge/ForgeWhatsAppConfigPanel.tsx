"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, ShieldCheck } from "lucide-react"
import { FORGE_WHATSAPP_PLACEMENTS, type ForgeWhatsAppConfig, type ForgeWhatsAppPlacement } from "@/lib/forge-whatsapp"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

const PLACEMENT_LABELS: Record<ForgeWhatsAppPlacement, string> = {
  sticky: "Sticky button",
  inline: "Inline CTAs",
  service_pages: "Service pages",
  contact_page: "Contact page",
}

export function ForgeWhatsAppConfigPanel({
  projectId,
  initialConfig,
  disabled = false,
}: {
  projectId: number
  initialConfig: ForgeWhatsAppConfig
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

  function update<K extends keyof ForgeWhatsAppConfig>(key: K, value: ForgeWhatsAppConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function togglePlacement(placement: ForgeWhatsAppPlacement) {
    setConfig((current) => ({
      ...current,
      placements: current.placements.includes(placement)
        ? current.placements.filter((item) => item !== placement)
        : [...current.placements, placement],
    }))
    setSaved(false)
  }

  async function saveConfig() {
    setBusy(true)
    setError("")
    setSaved(false)

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/integrations/whatsapp`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to save WhatsApp integration.")
      }

      setConfig(json.config)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save WhatsApp integration.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <MessageCircle size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">WhatsApp CTAs</h2>
            <Badge value={config.enabled ? "Enabled" : "Disabled"} tone={config.enabled ? "good" : "muted"} />
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Adds WhatsApp click-to-chat CTAs to generated client sites. V1 uses wa.me links only; Cloud API keys are reserved for a later server workflow.
          </p>
          <p className="mt-2 flex max-w-[760px] items-start gap-1.5 font-dm text-xs leading-relaxed" style={{ color:T.amb }}>
            <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Use an international number such as +447700900123. Save and regenerate the site to write the latest CTA configuration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveConfig()}
          disabled={disabled || busy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background:T.acc }}
        >
          {busy ? "Saving..." : "Save WhatsApp Config"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(16,185,129,.08)", borderColor:"rgba(16,185,129,.25)", color:T.t1 }}>
          WhatsApp integration saved. Regenerate the site to write the latest CTA module.
        </div>
      )}
      {disabled && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
          Archived projects are locked from integration changes.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
        <div className="grid gap-3">
          <label className="grid gap-1.5 font-dm text-sm" style={{ color:T.t1 }}>
            Business WhatsApp number
            <input value={config.businessNumber} onChange={(event) => update("businessNumber", event.target.value)} disabled={disabled} className="rounded-lg border px-3 py-2 disabled:opacity-60" style={{ background:T.s2, borderColor:T.b1 }} placeholder="+447700900123" />
          </label>
          <label className="grid gap-1.5 font-dm text-sm" style={{ color:T.t1 }}>
            Default prefilled message
            <textarea value={config.defaultMessage} onChange={(event) => update("defaultMessage", event.target.value)} disabled={disabled} className="min-h-20 rounded-lg border px-3 py-2 disabled:opacity-60" style={{ background:T.s2, borderColor:T.b1 }} />
          </label>
          <label className="grid gap-1.5 font-dm text-sm" style={{ color:T.t1 }}>
            CTA label
            <input value={config.ctaLabel} onChange={(event) => update("ctaLabel", event.target.value)} disabled={disabled} className="rounded-lg border px-3 py-2 disabled:opacity-60" style={{ background:T.s2, borderColor:T.b1 }} placeholder="WhatsApp us" />
          </label>
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 font-dm text-sm" style={{ background:T.s2, borderColor:T.b1, color:T.t1 }}>
            <input type="checkbox" checked={config.enabled} onChange={(event) => update("enabled", event.target.checked)} disabled={disabled} />
            Enabled
          </label>
          <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Placements</div>
            <div className="grid gap-2 md:grid-cols-2">
              {FORGE_WHATSAPP_PLACEMENTS.map((placement) => (
                <label key={placement} className="flex items-center gap-2 font-dm text-sm" style={{ color:T.t1 }}>
                  <input type="checkbox" checked={config.placements.includes(placement)} onChange={() => togglePlacement(placement)} disabled={disabled} />
                  {PLACEMENT_LABELS[placement]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="mb-3 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Generated WhatsApp behaviour</div>
          <div className="space-y-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>
            <div className="rounded border px-3 py-2" style={{ background:T.s1, borderColor:T.b1 }}>Sticky WhatsApp button</div>
            <div className="rounded border px-3 py-2" style={{ background:T.s1, borderColor:T.b1 }}>Inline CTA section</div>
            <div className="rounded border px-3 py-2" style={{ background:T.s1, borderColor:T.b1 }}>Service-page-specific message from page title</div>
            <div className="rounded border px-3 py-2" style={{ background:T.s1, borderColor:T.b1 }}>Contact-page WhatsApp option</div>
          </div>
          <div className="mt-4 rounded border p-3 font-dm text-xs leading-relaxed" style={{ background:T.s3, borderColor:T.b1, color:T.t2 }}>
            Future Cloud API placeholders: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN.
          </div>
        </div>
      </div>
    </section>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "muted" }) {
  const color = tone === "good" ? T.grn : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
