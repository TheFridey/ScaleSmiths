import { PortalUsersManager } from "@/components/PortalUsersManager"
import { hasCapability } from "@/lib/rbac"
import { guardPageCapability } from "@/lib/server/rbac"
import { listPortalEligibleClients, listPortalUsers } from "@/lib/server/portal-users"

export const dynamic = "force-dynamic"

export default async function PortalUsersPage() {
  const actor = await guardPageCapability("portal_users.read")
  const [users, clients] = await Promise.all([listPortalUsers(), listPortalEligibleClients()])
  return <div className="mx-auto max-w-[1380px] space-y-5 p-4 sm:p-5">
    <header><p className="text-sm font-medium text-cyan-300">External access</p><h1 className="mt-1 font-syne text-3xl font-bold">Portal users</h1><p className="mt-1 max-w-2xl text-sm text-t2">Manage client-facing identities without granting access to internal administrator accounts.</p></header>
    <PortalUsersManager initialUsers={users} clients={clients} canManage={hasCapability(actor.role, "portal_users.manage")} canResetCredentials={hasCapability(actor.role, "portal_users.credentials.reset")} />
  </div>
}
