import { AdminUsersManager } from "@/components/AdminUsersManager"
import { PortalUsersManager } from "@/components/PortalUsersManager"
import { guardPageCapability } from "@/lib/server/rbac"
import { listAdminUsers } from "@/lib/server/admin-users"
import { listPortalEligibleClients, listPortalUsers } from "@/lib/server/portal-users"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const actor = await guardPageCapability("users.manage")
  const [adminUsers, portalUsers, clients] = await Promise.all([listAdminUsers(), listPortalUsers(), listPortalEligibleClients()])
  return <div className="mx-auto max-w-[1380px] space-y-5 p-4 sm:p-5">
    <header><p className="text-sm font-medium text-cyan-300">Access</p><h1 className="mt-1 font-syne text-3xl font-bold">Users &amp; portals</h1><p className="mt-1 max-w-2xl text-sm text-t2">Manage internal permissions and client-facing portal access from one controlled workspace.</p></header>
    <PortalUsersManager initialUsers={portalUsers} clients={clients} />
    <AdminUsersManager initialUsers={adminUsers} actorRole={actor.role} embedded />
  </div>
}
