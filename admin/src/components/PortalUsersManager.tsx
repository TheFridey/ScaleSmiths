"use client"

import { useState } from "react"
import { Copy, KeyRound, Send, ShieldCheck, UserPlus, XCircle } from "lucide-react"

type PortalStatus = "invited" | "active" | "disabled" | "reset_required"
interface PortalUserRow {
  id: number; email: string; active: boolean; status: PortalStatus; portalClientId: string
  clientId: number | null; clientName: string | null; updatedAt: Date | string
  notificationStatus: "not_requested" | "pending" | "sent" | "failed" | null; notificationFailure: string | null
}
interface ClientOption { id: number; name: string; portalClientId: string | null }

export function PortalUsersManager({ initialUsers, clients, canManage, canResetCredentials }: {
  initialUsers: PortalUserRow[]; clients: ClientOption[]; canManage: boolean; canResetCredentials: boolean
}) {
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState({ clientId: clients[0]?.id ? String(clients[0].id) : "", email: "", sendWelcome: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [activationUrl, setActivationUrl] = useState<string | null>(null)

  async function refresh() {
    const response = await fetch("/api/portal-users", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Unable to load portal users.")
    setUsers(data.users)
  }

  async function provision(event: React.FormEvent) {
    event.preventDefault()
    await issue({ clientId: form.clientId, email: form.email, sendWelcome: form.sendWelcome, purpose: "activation" })
    setForm((current) => ({ ...current, email: "" }))
  }

  async function issue(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setActivationUrl(null)
    try {
      const response = await fetch("/api/portal-users", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, operationKey: crypto.randomUUID() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to issue portal invitation.")
      setActivationUrl(data.user.activationUrl ?? null)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to issue portal invitation.")
    } finally { setBusy(false) }
  }

  async function update(id: number, patch: Record<string, unknown>) {
    setBusy(true); setError("")
    try {
      const response = await fetch(`/api/portal-users/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to update portal user.")
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update portal user.")
    } finally { setBusy(false) }
  }

  const availableClients = clients.filter((client) => !users.some((user) => user.clientId === client.id))
  return <section className="rounded-xl border border-b1 bg-s1 p-4 sm:p-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">External access</p><h2 className="mt-1 font-syne text-xl font-bold">Client portal provisioning</h2><p className="mt-1 max-w-2xl text-sm text-t2">Issue expiring activation links. Passwords are chosen by clients and never sent or stored in plaintext.</p></div>
      <div className="rounded-lg border border-b1 bg-s2 px-3 py-2 text-xs text-t2"><ShieldCheck className="mr-1.5 inline text-emerald-300" size={14} />{users.filter((user) => user.status === "active").length} active of {users.length}</div>
    </div>

    {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
    {activationUrl && <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><p className="font-semibold">Activation link created</p><p className="mt-1 text-xs text-amber-100/70">Share through an approved secure channel. It expires in 48 hours and is shown only now.</p><button type="button" onClick={() => void navigator.clipboard.writeText(activationUrl)} className="mt-3 rounded-lg border border-amber-300/30 px-3 py-2"><Copy className="mr-1 inline" size={14} />Copy link</button></div>}

    {canManage && <form onSubmit={provision} className="mt-5 grid gap-3 rounded-xl border border-b1 bg-s2 p-4 lg:grid-cols-[1.2fr_1.3fr_auto] lg:items-end">
      <label className="text-sm text-t2">Not provisioned<select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} className="mt-1 w-full" required><option value="">Select client</option>{availableClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label className="text-sm text-t2">Portal email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full" required /></label>
      <button disabled={busy || !availableClients.length} className="rounded-lg bg-acc px-4 py-2.5 font-semibold text-white disabled:opacity-50"><UserPlus className="mr-1.5 inline" size={15} />Provision portal</button>
      <label className="flex items-center gap-2 text-sm lg:col-span-3"><input type="checkbox" checked={form.sendWelcome} onChange={(event) => setForm({ ...form, sendWelcome: event.target.checked })} />Send welcome email now</label>
    </form>}

    <div className="mt-5 overflow-x-auto rounded-xl border border-b1">
      <table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-s2 text-xs uppercase tracking-wide text-t3"><tr><th className="p-3">Portal user</th><th className="p-3">Client</th><th className="p-3">State</th><th className="p-3">Delivery</th><th className="p-3 text-right">Actions</th></tr></thead>
        <tbody>{users.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-t2">No client portal accounts yet. Eligible clients are not provisioned.</td></tr> : users.map((user) => <tr key={user.id} className="border-t border-b1 align-middle">
          <td className="p-3"><div className="font-medium">{user.email}</div><div className="font-mono text-[11px] text-t3">{user.portalClientId}</div></td>
          <td className="p-3">{user.clientName ?? "Unlinked"}</td>
          <td className="p-3"><span className="rounded-full border border-b1 bg-s2 px-2 py-1 text-xs capitalize">{user.status.replace("_", " ")}</span></td>
          <td className="p-3"><span className="capitalize text-t2">{(user.notificationStatus ?? "not_sent").replace("_", " ")}</span>{user.notificationFailure && <p className="mt-1 max-w-xs text-xs text-red-300">{user.notificationFailure}</p>}</td>
          <td className="p-3"><div className="flex justify-end gap-2">
            {canManage && user.status !== "active" && <button disabled={busy} onClick={() => void issue({ clientId: user.clientId, email: user.email, sendWelcome: true, purpose: "activation" })} className="rounded border border-b1 px-2.5 py-1.5"><Send className="mr-1 inline" size={13} />Invite</button>}
            {canResetCredentials && user.status === "active" && <button disabled={busy} onClick={() => void issue({ clientId: user.clientId, email: user.email, sendWelcome: true, purpose: "reset" })} className="rounded border border-b1 px-2.5 py-1.5"><KeyRound className="mr-1 inline" size={13} />Require reset</button>}
            {canResetCredentials && (user.status === "invited" || user.status === "reset_required") && <button disabled={busy} onClick={() => void update(user.id, { revokeTokens: true })} className="rounded border border-b1 px-2.5 py-1.5"><XCircle className="mr-1 inline" size={13} />Revoke</button>}
            {canManage && user.status !== "disabled" && <button disabled={busy} onClick={() => void update(user.id, { active: false })} className="rounded border border-b1 px-2.5 py-1.5">Disable</button>}
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>
}
