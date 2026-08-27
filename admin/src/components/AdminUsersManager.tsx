"use client"

import { useState } from "react"
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-users"
import { canUseControl } from "@/lib/rbac"

interface UserRow { id: string; email: string; displayName: string; role: AdminRole; active: boolean; mfaEnabled: boolean; sessionVersion: number; lastLoginAt: Date | string | null; createdAt: Date | string }

export function AdminUsersManager({ initialUsers, actorRole, embedded = false }: { initialUsers: UserRow[]; actorRole: AdminRole; embedded?: boolean }) {
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState({ email: "", displayName: "", password: "", role: "viewer" as AdminRole })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [passwordReset, setPasswordReset] = useState<{ userId: string; password: string } | null>(null)
  const [mfaReset, setMfaReset] = useState<{ userId: string; ownerPassword: string } | null>(null)

  async function refresh() {
    const response = await fetch("/api/admin-users", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Unable to load users.")
    setUsers(data.users)
  }
  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try {
      const response = await fetch("/api/admin-users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to create user.")
      setForm({ email: "", displayName: "", password: "", role: "viewer" }); await refresh()
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create user.") } finally { setBusy(false) }
  }
  async function updateUser(id: string, patch: Record<string, unknown>) {
    setBusy(true); setError("")
    try {
      const response = await fetch(`/api/admin-users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update user."); await refresh()
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update user.") } finally { setBusy(false) }
  }
  async function resetPassword(event: React.FormEvent) {
    event.preventDefault()
    if (!passwordReset) return
    await updateUser(passwordReset.userId, { password: passwordReset.password })
    setPasswordReset(null)
  }
  async function invalidateMfa(event: React.FormEvent) {
    event.preventDefault()
    if (!mfaReset) return
    await updateUser(mfaReset.userId, { disableMfa: true, ownerPassword: mfaReset.ownerPassword })
    setMfaReset(null)
  }

  return <section className={`${embedded ? "space-y-5 rounded-xl border border-b1 bg-s1 p-4 sm:p-5" : "mx-auto max-w-6xl space-y-6 p-3"}`}>
    <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Internal access</p><h2 className="mt-1 font-syne text-xl font-bold">Admin team</h2><p className="mt-1 text-sm text-t2">Roles, account status, MFA and session security.</p></div>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    {passwordReset && <form onSubmit={resetPassword} className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><label className="min-w-64 flex-1 text-sm">New password<input autoFocus type="password" autoComplete="new-password" minLength={12} value={passwordReset.password} onChange={(event) => setPasswordReset({ ...passwordReset, password: event.target.value })} className="mt-1 w-full" required /></label><button disabled={busy} className="rounded-lg bg-acc px-4 py-2 text-white">Reset and revoke sessions</button><button type="button" onClick={() => setPasswordReset(null)} className="rounded-lg border border-b1 px-4 py-2">Cancel</button></form>}
    {mfaReset && <form onSubmit={invalidateMfa} className="flex flex-wrap items-end gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"><label className="min-w-64 flex-1 text-sm">Confirm your owner password<input autoFocus type="password" autoComplete="current-password" value={mfaReset.ownerPassword} onChange={(event) => setMfaReset({ ...mfaReset, ownerPassword: event.target.value })} className="mt-1 w-full" required /></label><button disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-white">Invalidate MFA and sessions</button><button type="button" onClick={() => setMfaReset(null)} className="rounded-lg border border-b1 px-4 py-2">Cancel</button></form>}
    <form onSubmit={createUser} className="grid gap-3 rounded-xl border border-b1 bg-s1 p-4 md:grid-cols-5">
      <input aria-label="Display name" placeholder="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
      <input aria-label="Email" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <input aria-label="Temporary password" type="password" placeholder="Temporary password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
      <select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>{ADMIN_ROLES.filter((role) => canUseControl(actorRole, "users.assign_owner") || role !== "owner").map((role) => <option key={role}>{role}</option>)}</select>
      <button disabled={busy} className="rounded-lg bg-acc px-4 py-2 font-medium text-white disabled:opacity-50">Create user</button>
    </form>
    <div className="overflow-x-auto rounded-xl border border-b1 bg-s1"><table className="w-full text-left text-sm"><thead><tr className="border-b border-b1 text-t2"><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Last login</th><th className="p-3">Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-b1/60"><td className="p-3"><div className="font-medium">{user.displayName}</div><div className="text-xs text-t2">{user.email}</div></td><td className="p-3"><select value={user.role} disabled={busy || (!canUseControl(actorRole, "users.assign_owner") && user.role === "owner")} onChange={(e) => updateUser(user.id, { role: e.target.value })}>{ADMIN_ROLES.filter((role) => canUseControl(actorRole, "users.assign_owner") || role !== "owner").map((role) => <option key={role}>{role}</option>)}</select></td><td className="p-3">{user.active ? "Active" : "Disabled"}{user.mfaEnabled ? " · MFA" : ""}</td><td className="p-3 text-t2">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td><td className="p-3"><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => updateUser(user.id, { active: !user.active })} className="rounded border border-b1 px-2 py-1">{user.active ? "Disable" : "Enable"}</button><button disabled={busy} onClick={() => updateUser(user.id, { revokeSessions: true })} className="rounded border border-b1 px-2 py-1">Revoke sessions</button>{canUseControl(actorRole, "users.reset_password") && <button disabled={busy} onClick={() => setPasswordReset({ userId: user.id, password: "" })} className="rounded border border-b1 px-2 py-1">Reset password</button>}{user.mfaEnabled && canUseControl(actorRole, "users.reset_password") && <button disabled={busy} onClick={() => setMfaReset({ userId: user.id, ownerPassword: "" })} className="rounded border border-red-500/40 px-2 py-1 text-red-300">Invalidate MFA</button>}</div></td></tr>)}</tbody></table></div>
  </section>
}
