import { MfaSecurityPanel } from "@/components/MfaSecurityPanel"
import { guardPageCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"

export default async function VentureLabSecurityPage() {
  await guardPageCapability("venture.read")
  return (
    <main className="space-y-6 p-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Nova Venture Lab</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Controller security</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">MFA enrolment is bound to the current authenticated identity. This page grants no broader ScaleSmiths settings authority.</p>
      </header>
      <MfaSecurityPanel />
    </main>
  )
}
