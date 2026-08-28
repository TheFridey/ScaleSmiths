import { AdminUsersManager } from "@/components/AdminUsersManager"
import { guardPageCapability } from "@/lib/server/rbac"
import { listAdminUsers } from "@/lib/server/admin-users"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const actor = await guardPageCapability("admin_users.read")
  const adminUsers = await listAdminUsers()
  return <div className="mx-auto max-w-[1380px] space-y-5 p-4 sm:p-5">
    <header><p className="text-sm font-medium text-cyan-300">Internal access</p><h1 className="mt-1 font-syne text-3xl font-bold">Admin users</h1><p className="mt-1 max-w-2xl text-sm text-t2">Manage ScaleSmiths administrator identities separately from client portal accounts.</p></header>
    <AdminUsersManager initialUsers={adminUsers} actorRole={actor.role} embedded />
  </div>
}
