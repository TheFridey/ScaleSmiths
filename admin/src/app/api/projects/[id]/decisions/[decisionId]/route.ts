import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { updateDeliveryDecision } from "@/lib/server/delivery-project-service"
import { projectFailure, projectId, projectPayload } from "@/lib/server/delivery-project-http"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; decisionId: string }> }) {
  try {
    const actor = await guardApiCapability("projects.write"); const value = await params
    return NextResponse.json({ ok: true, decision: await updateDeliveryDecision(projectId(value.id), projectId(value.decisionId, "Decision ID"), await projectPayload(request), actor) })
  } catch (error) { return projectFailure(error) }
}
