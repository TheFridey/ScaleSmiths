"use client"

import { useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/Logo"

export default function PartnerActivationPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [activated, setActivated] = useState(false)
  async function activate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      // Invitation lives in the URL fragment, never in server access logs or referrers.
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token")
      const response = await fetch("/api/partner/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Activation failed.")
      window.history.replaceState(null, "", "/partner/activate")
      setActivated(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Activation is unavailable.") }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen px-6 py-16 flex items-center justify-center bg-bg text-t1">
    <section className="w-full max-w-md rounded-2xl border border-b1 bg-s1 p-8">
      <Logo size={48} />
      <p className="mt-8 text-xs uppercase tracking-widest text-[#d4b77a]">Independent partner network</p>
      <h1 className="mt-3 text-3xl font-semibold">Your next chapter.</h1>
      {activated ? <div role="status" className="mt-6"><p>Your partner account is active. Sign in with your invited email address and new password.</p><Link href="/login" className="mt-6 inline-block underline text-[#d4b77a]">Continue to sign in</Link></div> : <form onSubmit={activate} className="mt-6 space-y-5">
        <p className="text-t2">Set a secure password to accept your founder-issued invitation. Invitations expire after 48 hours and can be used once.</p>
        <div><label htmlFor="partner-password" className="block mb-2">New password</label><input id="partner-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required aria-describedby="password-hint" className="w-full rounded-lg border border-b1 bg-bg px-4 py-3" /><p id="password-hint" className="mt-2 text-sm text-t2">At least 12 characters; maximum 72 UTF-8 bytes.</p></div>
        {error ? <p role="alert" className="text-red-300">{error}</p> : null}
        <button disabled={busy} className="w-full rounded-lg bg-[#d4b77a] px-4 py-3 font-semibold text-black disabled:opacity-60">{busy ? "Activating…" : "Activate partner account"}</button>
      </form>}
    </section>
  </main>
}
