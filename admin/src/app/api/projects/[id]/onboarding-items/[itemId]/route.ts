import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { updateDeliveryOnboardingItem } from "@/lib/server/delivery-project-service"
import { projectFailure, projectId, projectPayload } from "@/lib/server/delivery-project-http"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const actor = await guardApiCapability("projects.write")
    const value = await params
    return NextResponse.json({ ok: true, item: await updateDeliveryOnboardingItem(projectId(value.id), projectId(value.itemId, "Onboarding item ID"), await projectPayload(request), actor) })
  } catch (error) { return projectFailure(error) }
}
