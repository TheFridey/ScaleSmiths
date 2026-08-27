"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"

const TIERS = ["Foundation", "Growth Partner", "Ecosystem", "Maintenance", "Forge Build"]
const STATUSES = ["active", "build", "review", "prospect"]

interface EditableClient {
  id: number
  name: string
  contactName: string | null
  contactEmail: string | null
  tier: string | null
  mrr: number
  status: string
  invoiceClientCode: string | null
  portalClientId: string | null
}

export function EditClientForm({ client }: { client: EditableClient }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          contactName: formData.get("contactName"),
          contactEmail: formData.get("contactEmail"),
          tier: formData.get("tier"),
          mrr: formData.get("mrr"),
          status: formData.get("status"),
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || "Unable to update client.")
      router.push("/clients")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update client.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
        <ArrowLeft size={14} aria-hidden="true" /> Clients
      </Link>
      <div className="mb-6">
        <div className="font-dm text-xs font-semibold uppercase tracking-[0.12em] text-acc">Client record</div>
        <h1 className="mt-2 font-syne text-3xl font-extrabold tracking-tight">Edit {client.name}</h1>
        <p className="mt-2 font-dm text-sm text-t2">Update client-facing names and operational account details.</p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-b1 bg-s1 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Client name" className="sm:col-span-2">
            <input name="name" required maxLength={160} defaultValue={client.name} className="w-full" />
          </Field>
          <Field label="Contact name">
            <input name="contactName" defaultValue={client.contactName ?? ""} className="w-full" />
          </Field>
          <Field label="Contact email">
            <input name="contactEmail" type="email" defaultValue={client.contactEmail ?? ""} className="w-full" />
          </Field>
          <Field label="Tier">
            <select name="tier" defaultValue={client.tier ?? ""} className="w-full">
              {!client.tier ? <option value="">No tier set</option> : null}
              {client.tier && !TIERS.includes(client.tier) ? <option value={client.tier}>{client.tier}</option> : null}
              {TIERS.map((tier) => <option key={tier}>{tier}</option>)}
            </select>
          </Field>
          <Field label="MRR">
            <input name="mrr" type="number" min={0} step={1} defaultValue={client.mrr} className="w-full" />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={client.status} className="w-full">
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          <div className="rounded-xl border border-b1 bg-s2 p-4 font-dm text-sm">
            <div className="text-xs text-t3">Protected identifiers</div>
            <div className="mt-2 text-t2">Invoice code: <span className="text-t1">{client.invoiceClientCode ?? "Not set"}</span></div>
            <div className="mt-1 break-all text-t2">Portal ID: <span className="text-t1">{client.portalClientId ?? "Not linked"}</span></div>
          </div>
        </div>

        {error ? <div role="alert" className="mt-5 rounded-lg border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm text-t1">{error}</div> : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Link href="/clients" className="rounded-lg border border-b2 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">Cancel</Link>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-acc px-4 py-2.5 font-dm text-sm font-semibold text-white disabled:opacity-60">
            <Save size={15} aria-hidden="true" /> {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`font-dm text-sm ${className}`}><span className="mb-1.5 block text-t2">{label}</span>{children}</label>
}
