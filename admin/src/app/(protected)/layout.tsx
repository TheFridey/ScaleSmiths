import { redirect } from "next/navigation"
import { AdminShell } from "@/components/admin-shell/AdminShell"
import { requireCurrentAdminUser } from "@/lib/server/admin-session"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCurrentAdminUser().catch(() => null)
  if (!actor) redirect("/login")
  return <AdminShell role={actor.role}>{children}</AdminShell>
}
