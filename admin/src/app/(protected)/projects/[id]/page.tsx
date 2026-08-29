import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DeliveryProjectWorkspace } from "@/components/delivery/DeliveryProjectWorkspace"
import { DeliveryProjectError } from "@/lib/delivery-projects"
import { getDeliveryProjectForAdmin } from "@/lib/server/delivery-project-service"
import { listAdminUsers } from "@/lib/server/admin-users"
import { guardPageCapability } from "@/lib/server/rbac"

export const metadata: Metadata = { title: "Delivery Project" }
export const dynamic = "force-dynamic"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await guardPageCapability("projects.read")
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  try {
    const [project, users] = await Promise.all([getDeliveryProjectForAdmin(id), listAdminUsers()])
    return <DeliveryProjectWorkspace initial={project} owners={users.filter((user) => user.active).map(({ id: userId, displayName }) => ({ id: userId, name: displayName }))} />
  } catch (error) {
    if (error instanceof DeliveryProjectError && error.status === 404) notFound()
    throw error
  }
}

