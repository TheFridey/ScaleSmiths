import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { createDeliveryDecision } from "@/lib/server/delivery-project-service"
import { projectFailure, projectId, projectPayload } from "@/lib/server/delivery-project-http"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("projects.write")
    return NextResponse.json({ ok: true, decision: await createDeliveryDecision(projectId((await params).id), await projectPayload(request), actor) }, { status: 201 })
  } catch (error) { return projectFailure(error) }
}

