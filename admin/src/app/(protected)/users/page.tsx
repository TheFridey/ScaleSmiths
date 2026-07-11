import { AdminUsersManager } from "@/components/AdminUsersManager"
import { guardPageCapability } from "@/lib/server/rbac"
import { listAdminUsers } from "@/lib/server/admin-users"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const actor = await guardPageCapability("users.manage")
  return <AdminUsersManager initialUsers={await listAdminUsers()} actorRole={actor.role} />
}
