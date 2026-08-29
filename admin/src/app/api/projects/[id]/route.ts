import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { getDeliveryProjectForAdmin, updateDeliveryProject } from "@/lib/server/delivery-project-service"
import { projectFailure, projectId, projectPayload } from "@/lib/server/delivery-project-http"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guardApiCapability("projects.read")
    return NextResponse.json({ ok: true, project: await getDeliveryProjectForAdmin(projectId((await params).id)) })
  } catch (error) { return projectFailure(error) }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("projects.write")
    return NextResponse.json({ ok: true, project: await updateDeliveryProject(projectId((await params).id), await projectPayload(request), actor) })
  } catch (error) { return projectFailure(error) }
}

