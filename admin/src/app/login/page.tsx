"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Logo } from "@/components/Logo"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: "/dashboard",
      })

      if (res?.error) {
        setError("Invalid credentials")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Something went wrong - try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px]">
        <div className="flex justify-center mb-10">
          <Logo size={40} />
        </div>
        <div className="bg-s1 border border-b1 rounded-2xl p-8">
          <h1 className="font-syne text-xl font-bold mb-1">Sign in</h1>
          <p className="font-dm text-sm text-t2 mb-7">Access your ScaleSmiths admin panel.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="font-dm text-sm text-t2 block mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@scalesmiths.io"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="font-dm text-sm text-t2 block mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>
            {error && (
              <p className="font-dm text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-acc text-white font-dm font-medium text-sm py-3 rounded-lg disabled:opacity-50 transition-opacity mt-1"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
