import { NextResponse } from "next/server"
import { isInternalDeliveryEvent } from "@/lib/delivery-projection"
import { linkForgeToDeliveryProject, projectInternalForgeEvent } from "@/lib/server/delivery-forge-integration"
import { projectFailure, projectId, projectPayload } from "@/lib/server/delivery-project-http"
import { guardApiCapability } from "@/lib/server/rbac"
import { DeliveryProjectError } from "@/lib/delivery-projects"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("projects.write"), deliveryProjectId = projectId((await params).id), body = await projectPayload(request)
    if (body.action === "project_event") {
      if (!isInternalDeliveryEvent(body.event)) return NextResponse.json({ ok: false, error: "Unsupported internal delivery event." }, { status: 400 })
      const forgeProjectId = projectId(String(body.forgeProjectId ?? ""), "Forge project ID")
      return NextResponse.json({ ok: true, result: await projectInternalForgeEvent(forgeProjectId, body.event, actor, { expectedProjectId: deliveryProjectId, stagingUrl: typeof body.stagingUrl === "string" ? body.stagingUrl : undefined, publishStaging: body.publishStaging === true, latestRunId: optionalId(body.latestRunId), deploymentCandidateId: optionalId(body.deploymentCandidateId), internalBuildStatus: text(body.internalBuildStatus), internalQaStatus: text(body.internalQaStatus), internalDeploymentStatus: text(body.internalDeploymentStatus) }) })
    }
    const forgeProjectId = projectId(String(body.forgeProjectId ?? ""), "Forge project ID")
    return NextResponse.json({ ok: true, integration: await linkForgeToDeliveryProject(deliveryProjectId, { forgeProjectId, latestRunId: optionalId(body.latestRunId), deploymentCandidateId: optionalId(body.deploymentCandidateId), internalReleaseId: text(body.internalReleaseId), stagingDeploymentId: text(body.stagingDeploymentId), productionDeploymentId: text(body.productionDeploymentId), internalBuildStatus: text(body.internalBuildStatus), internalQaStatus: text(body.internalQaStatus), internalDeploymentStatus: text(body.internalDeploymentStatus) }, actor) })
  } catch (error) { return projectFailure(error) }
}
function optionalId(value: unknown) { if (value === undefined || value === null || value === "") return null; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed <= 0) throw new DeliveryProjectError("Internal linkage ID is invalid."); return parsed }
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : null }
