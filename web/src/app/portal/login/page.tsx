"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, LockKeyhole } from "lucide-react"
import { Logo } from "@/components/Logo"
import Link from "next/link"

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/portal/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Unable to sign in.")
      }

      router.push(`/portal/${json.clientId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-[calc(100vh-70px)] px-6 py-16 md:px-12">
      <div className="mx-auto grid max-w-[1040px] gap-8 md:grid-cols-[1fr_420px] md:items-center">
        <div>
          <div className="mb-12 flex justify-center md:justify-start">
            <Logo size={36} href="/" />
          </div>
          <span className="block text-center font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc md:text-left">
            Client Portal
          </span>
          <h1 className="mt-3 font-syne text-[clamp(40px,7vw,76px)] font-extrabold leading-none tracking-[-0.035em]">
            Your build, without the black box.
          </h1>
          <p className="mt-5 max-w-[520px] font-dm text-base leading-relaxed text-t2">
            Track delivery, review files, see roadmap movement, and keep project decisions in one place.
          </p>
        </div>

        <div className="rounded-2xl border border-b1 bg-s1 p-7 shadow-2xl">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-acc/20 bg-acc/10 text-acc">
            <LockKeyhole size={20} aria-hidden="true" />
          </div>
          <h2 className="font-syne text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 font-dm text-sm text-t2">Use the credentials supplied for your client workspace.</p>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
            <div>
              <label htmlFor="portal-email" className="mb-1.5 block font-dm text-sm text-t2">
                Email
              </label>
              <input
                id="portal-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm text-t1 outline-none transition-colors focus:border-acc/50"
                required
              />
            </div>
            <div>
              <label htmlFor="portal-password" className="mb-1.5 block font-dm text-sm text-t2">
                Password
              </label>
              <input
                id="portal-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm text-t1 outline-none transition-colors focus:border-acc/50"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 font-dm text-sm text-t1">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full justify-center font-dm text-sm disabled:opacity-60">
              {loading ? "Signing in..." : "Enter Portal"} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
          <p className="mt-5 text-center font-dm text-xs leading-relaxed text-t3">
            Portal use is covered by our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-t1">privacy notice</Link>
            {" "}and{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-t1">website terms</Link>.
          </p>
        </div>
      </div>
    </section>
  )
}
