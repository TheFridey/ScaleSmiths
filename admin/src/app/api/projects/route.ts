import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { createDeliveryProject, listDeliveryProjectsForAdmin } from "@/lib/server/delivery-project-service"
import { projectFailure, projectPayload } from "@/lib/server/delivery-project-http"

export async function GET() {
  try {
    await guardApiCapability("projects.read")
    return NextResponse.json({ ok: true, projects: await listDeliveryProjectsForAdmin() })
  } catch (error) { return projectFailure(error) }
}

export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("projects.write")
    return NextResponse.json({ ok: true, project: await createDeliveryProject(await projectPayload(request), actor) }, { status: 201 })
  } catch (error) { return projectFailure(error) }
}

