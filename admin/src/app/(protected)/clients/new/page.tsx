"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"

const TIERS = ["Foundation", "Growth Partner", "Ecosystem", "Maintenance", "Forge Build"]
const STATUSES = ["active", "build", "review", "prospect"]

const T = { s1:"var(--s1)",s2:"var(--s2)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",acc:"var(--acc)",grn:"var(--grn)" }

export default function NewClientPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const formData = new FormData(event.currentTarget)
    const response = await fetch("/api/clients", {
      method: "POST",
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

    setIsSaving(false)

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? "Unable to create client.")
      return
    }

    router.push("/clients")
    router.refresh()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/clients" className="mb-2 inline-flex items-center gap-1.5 font-dm text-xs" style={{ color: T.t2 }}>
            <ArrowLeft size={14} aria-hidden="true" /> Clients
          </Link>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">New Client</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl rounded-2xl border p-6" style={{ background: T.s1, borderColor: T.b1 }}>
        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2 font-dm text-sm">
            <span className="mb-1.5 block" style={{ color: T.t2 }}>Name</span>
            <input name="name" required className="w-full rounded-lg border px-3 py-2.5 font-dm text-sm outline-none" style={{ background: T.s2, borderColor: T.b2, color: T.t1 }} />
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block" style={{ color: T.t2 }}>Contact name</span>
            <input name="contactName" className="w-full rounded-lg border px-3 py-2.5 font-dm text-sm outline-none" style={{ background: T.s2, borderColor: T.b2, color: T.t1 }} />
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block" style={{ color: T.t2 }}>Contact email</span>
            <input name="contactEmail" type="email" className="w-full rounded-lg border px-3 py-2.5 font-dm text-sm outline-none" style={{ background: T.s2, borderColor: T.b2, color: T.t1 }} />
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block" style={{ color: T.t2 }}>Tier</span>
            <select name="tier" defaultValue="Foundation" className="w-full rounded-lg border px-3 py-2.5 font-dm text-sm outline-none" style={{ background: T.s2, borderColor: T.b2, color: T.t1 }}>
              {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
            </select>
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block" style={{ color: T.t2 }}>MRR</span>
            <input name="mrr" type="number" min="0" step="1" defaultValue="0" className="w-full rounded-lg border px-3 py-2.5 font-dm text-sm outline-none" style={{ background: T.s2, borderColor: T.b2, color: T.t1 }} />
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block" style={{ color: T.t2 }}>Status</span>
            <select name="status" defaultValue="active" className="w-full rounded-lg border px-3 py-2.5 font-dm text-sm outline-none" style={{ background: T.s2, borderColor: T.b2, color: T.t1 }}>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="mt-4 font-dm text-sm" style={{ color: "var(--err,#ef4444)" }}>{error}</p>}

        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background: T.acc }}>
            <Save size={15} aria-hidden="true" /> {isSaving ? "Saving..." : "Save Client"}
          </button>
        </div>
      </form>
    </div>
  )
}
