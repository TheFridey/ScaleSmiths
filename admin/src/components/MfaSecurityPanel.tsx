"use client"

import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"

interface Status { enabled: boolean; pending: boolean; required: boolean; graceUntil: string | null; remainingRecoveryCodes: number | null }
interface Setup { secret: string; otpauthUri: string; recoveryCodes: string[] }

export function MfaSecurityPanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => { void loadStatus() }, [])
  async function loadStatus() { const response = await fetch("/api/security/mfa", { cache: "no-store" }); if (response.ok) setStatus(await response.json()) }
  async function action(body: Record<string, unknown>) {
    setBusy(true); setError("")
    try { const response = await fetch("/api/security/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "MFA operation failed."); return data } catch (error) { setError(error instanceof Error ? error.message : "MFA operation failed."); return null } finally { setBusy(false) }
  }
  async function begin() { const data = await action({ action: "begin" }); if (data) setSetup(data as Setup) }
  async function verify(event: React.FormEvent) { event.preventDefault(); const data = await action({ action: "verify", code }); if (data) await signOut({ redirectTo: "/login" }) }

  return <div className="mx-auto max-w-3xl space-y-5 p-3"><div><h1 className="font-syne text-3xl font-bold">Account security</h1><p className="mt-1 text-sm text-t2">Configure authenticator MFA and retain recovery codes offline.</p></div>{error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">{error}</div>}{status && <div className="rounded-xl border border-b1 bg-s1 p-4 text-sm"><p>MFA: <strong>{status.enabled ? "Enabled" : status.pending ? "Setup pending" : "Not enabled"}</strong></p><p>Production policy: {status.required ? "Required now" : status.graceUntil ? `Grace until ${new Date(status.graceUntil).toLocaleString()}` : "Optional in this environment"}</p>{status.remainingRecoveryCodes !== null && <p>Unused recovery codes: {status.remainingRecoveryCodes}</p>}</div>} {!status?.enabled && !setup && <button onClick={begin} disabled={busy} className="rounded-lg bg-acc px-4 py-2 text-white">Begin MFA setup</button>}{setup && <div className="space-y-4 rounded-xl border border-b1 bg-s1 p-4"><div><h2 className="font-semibold">1. Add to your authenticator</h2><p className="mt-2 break-all font-mono text-sm">{setup.secret}</p><details className="mt-2 text-xs text-t2"><summary>Show authenticator URI</summary><p className="mt-1 break-all">{setup.otpauthUri}</p></details></div><div><h2 className="font-semibold">2. Save these recovery codes once</h2><div className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">{setup.recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div></div><form onSubmit={verify}><label className="text-sm">3. Verify a six-digit code<input className="mt-1" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value)} required /></label><button disabled={busy} className="mt-3 rounded-lg bg-acc px-4 py-2 text-white">Verify and activate</button></form></div>}</div>
}
