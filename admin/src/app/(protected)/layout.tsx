import { AdminShell } from "@/components/admin-shell/AdminShell"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
