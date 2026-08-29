import type { Metadata } from "next"
import { DeliveryProjectsWorkspace } from "@/components/delivery/DeliveryProjectsWorkspace"
import { listClientDirectory } from "@/lib/server/client-read-service"
import { listDeliveryProjectsForAdmin } from "@/lib/server/delivery-project-service"
import { guardPageCapability } from "@/lib/server/rbac"

export const metadata: Metadata = { title: "Client Projects" }
export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  await guardPageCapability("projects.read")
  const [projects, clients] = await Promise.all([listDeliveryProjectsForAdmin(), listClientDirectory()])
  return <DeliveryProjectsWorkspace projects={projects} clients={clients.map(({ id, name }) => ({ id, name }))} />
}

