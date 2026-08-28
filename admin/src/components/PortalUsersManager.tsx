"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, ShieldCheck, UserPlus } from "lucide-react"

interface PortalUserRow {
  id: number
  email: string
  active: boolean
  portalClientId: string
  clientId: number | null
  clientName: string | null
  createdAt: Date | string
  updatedAt: Date | string
}
interface ClientOption { id: number; name: string; portalClientId: string | null }

export function PortalUsersManager({ initialUsers, clients, canManage, canResetCredentials }: { initialUsers: PortalUserRow[]; clients: ClientOption[]; canManage: boolean; canResetCredentials: boolean }) {
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState({ clientId: clients[0]?.id ? String(clients[0].id) : "", email: "", password: "", generatePassword: true, testAccount: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const [editing, setEditing] = useState<{ id: number; email: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function refresh() {
    const response = await fetch("/api/portal-users", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Unable to load portal users.")
    setUsers(data.users)
  }

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setCredentials(null)
    try {
      const response = await fetch("/api/portal-users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to create portal user.")
      if (data.user.password) setCredentials({ email: data.user.email, password: data.user.password })
      setForm((current) => ({ ...current, email: "", password: "", testAccount: false })); await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create portal user.") } finally { setBusy(false) }
  }

  async function update(id: number, patch: Record<string, unknown>) {
    setBusy(true); setError(""); setCredentials(null)
    try {
      const response = await fetch(`/api/portal-users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update portal user.")
      const row = users.find((user) => user.id === id)
      if (data.user.password && row) setCredentials({ email: row.email, password: data.user.password })
      setEditing(null); await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update portal user.") } finally { setBusy(false) }
  }

  async function copyCredentials() {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(`Portal: https://scalesmiths.co.uk/portal/login\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}`)
      setCopied(true); window.setTimeout(() => setCopied(false), 1800)
    } catch { setError("Clipboard access was blocked. Copy the credentials manually.") }
  }

  return <section className="rounded-xl border border-b1 bg-s1 p-4 sm:p-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">External access</p><h2 className="mt-1 font-syne text-xl font-bold">Client portal users</h2><p className="mt-1 max-w-2xl text-sm text-t2">Create and maintain client sign-ins. Every account is explicitly linked to one client portal identity.</p></div>
      <div className="rounded-lg border border-b1 bg-s2 px-3 py-2 text-xs text-t2"><ShieldCheck className="mr-1.5 inline text-emerald-300" size={14} />{users.filter((user) => user.active).length} active of {users.length}</div>
    </div>

    {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
    {credentials && <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-emerald-100">Temporary credentials created</h3><p className="mt-1 text-xs text-emerald-100/70">Copy these now. The password is not stored in readable form and cannot be shown again.</p></div><button type="button" onClick={() => void copyCredentials()} className="rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950">{copied ? <Check className="mr-1 inline" size={14} /> : <Copy className="mr-1 inline" size={14} />}{copied ? "Copied" : "Copy credentials"}</button></div><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]"><dt className="text-t2">Email</dt><dd className="font-mono">{credentials.email}</dd><dt className="text-t2">Password</dt><dd className="break-all font-mono">{credentials.password}</dd></dl></div>}

    {canManage && <form onSubmit={create} className="mt-5 grid gap-3 rounded-xl border border-b1 bg-s2 p-4 lg:grid-cols-[1.2fr_1.3fr_1fr_auto] lg:items-end">
      <label className="text-sm text-t2">Client<select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} className="mt-1 w-full" required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label className="text-sm text-t2">Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full" placeholder={form.testAccount ? "Optional — generated if blank" : "client@example.com"} required={!form.testAccount} /></label>
      <label className="text-sm text-t2">{form.generatePassword || form.testAccount ? "Password" : "Temporary password"}<input type="password" minLength={12} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1 w-full" disabled={form.generatePassword || form.testAccount} placeholder={form.generatePassword || form.testAccount ? "Generated securely" : "Minimum 12 characters"} required={!form.generatePassword && !form.testAccount} /></label>
      <button disabled={busy || !clients.length} className="rounded-lg bg-acc px-4 py-2.5 font-semibold text-white disabled:opacity-50"><UserPlus className="mr-1.5 inline" size={15} />{busy ? "Creating…" : form.testAccount ? "Create test account" : "Create account"}</button>
      <div className="flex flex-wrap gap-4 text-sm lg:col-span-4"><label className="flex items-center gap-2"><input type="checkbox" checked={form.generatePassword} onChange={(event) => setForm({ ...form, generatePassword: event.target.checked })} />Generate strong password</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.testAccount} onChange={(event) => setForm({ ...form, testAccount: event.target.checked, generatePassword: event.target.checked || form.generatePassword })} />Test portal account</label></div>
    </form>}

    <div className="mt-5 overflow-x-auto rounded-xl border border-b1">
      <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-s2 text-xs uppercase tracking-wide text-t3"><tr><th className="p-3">Portal user</th><th className="p-3">Client</th><th className="p-3">Status</th><th className="p-3">Updated</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{users.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-t2">No client portal accounts yet.</td></tr> : users.map((user) => <tr key={user.id} className="border-t border-b1 align-middle"><td className="p-3">{editing?.id === user.id ? <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void update(user.id, { email: editing.email }) }}><input autoFocus type="email" value={editing.email} onChange={(event) => setEditing({ id: user.id, email: event.target.value })} /><button className="text-acc">Save</button></form> : <><div className="font-medium">{user.email}</div><div className="mt-0.5 font-mono text-[11px] text-t3">{user.portalClientId}</div></>}</td><td className="p-3"><div className="font-medium">{user.clientName ?? "Unlinked"}</div>{user.clientId && <div className="text-xs text-t3">Client #{user.clientId}</div>}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs ${user.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-500/30 bg-slate-500/10 text-t2"}`}>{user.active ? "Active" : "Disabled"}</span></td><td className="p-3 text-t2">{new Date(user.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td><td className="p-3"><div className="flex justify-end gap-2"><button disabled={busy} onClick={() => setEditing({ id: user.id, email: user.email })} className="rounded border border-b1 px-2.5 py-1.5">Edit</button>{canResetCredentials && <button disabled={busy} onClick={() => void update(user.id, { resetPassword: true })} className="rounded border border-b1 px-2.5 py-1.5"><KeyRound className="mr-1 inline" size={13} />Reset</button>}<button disabled={busy} onClick={() => void update(user.id, { active: !user.active })} className="rounded border border-b1 px-2.5 py-1.5">{user.active ? "Disable" : "Enable"}</button></div></td></tr>)}</tbody></table>
    </div>
  </section>
}
