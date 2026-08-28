import { NextResponse } from "next/server"
import { AdminIdentityError } from "@/lib/admin-users"
import { guardApiCapability } from "@/lib/server/rbac"
import { createDeploymentCandidate, decideDeploymentCandidate, ForgeDeploymentCandidateError, getCandidateReleaseGates, listDeploymentActivity, listDeploymentCandidates, recordReleaseGateDecision, submitDeploymentCandidate } from "@/lib/server/forge-deployment-candidates"
import { isReleaseGateKey } from "@/lib/forge-release-gates"
import { auth } from "../../../../../../../auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function projectIdFrom(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null }
function candidateIdFrom(value: unknown) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null }

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await auth()) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    await guardApiCapability("forge.read")
    const projectId = projectIdFrom((await params).id)
    if (!projectId) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
    const [candidates, deploymentActivity] = await Promise.all([listDeploymentCandidates(projectId), listDeploymentActivity(projectId)])
    const gates = candidates[0] ? await getCandidateReleaseGates(projectId, candidates[0].id) : null
    return NextResponse.json({ ok: true, candidates, gates, deploymentActivity })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await auth()) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    const user = await guardApiCapability("deployments.execute")
    const projectId = projectIdFrom((await params).id)
    if (!projectId) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const actor = user.email
    if (body.action === "create") return NextResponse.json({ ok: true, candidate: await createDeploymentCandidate({ projectId, actor, releaseNotes: String(body.releaseNotes ?? ""), rollbackPlan: String(body.rollbackPlan ?? ""), environmentRequirements: stringList(body.environmentRequirements), migrationRequirements: stringList(body.migrationRequirements), parentCandidateId: candidateIdFrom(body.parentCandidateId) ?? undefined }) })
    const candidateId = candidateIdFrom(body.candidateId)
    if (!candidateId) return NextResponse.json({ error: "Invalid deployment candidate id." }, { status: 400 })
    if (body.action === "submit") return NextResponse.json({ ok: true, candidate: await submitDeploymentCandidate(projectId, candidateId, actor) })
    if (body.action === "approve" || body.action === "reject") return NextResponse.json({ ok: true, candidate: await decideDeploymentCandidate(projectId, candidateId, actor, body.action, String(body.reason ?? "")) })
    if (body.action === "gate_approve" || body.action === "gate_override" || body.action === "gate_revoke") {
      if (!isReleaseGateKey(body.gateKey)) return NextResponse.json({ error: "Invalid release gate." }, { status: 400 })
      return NextResponse.json({ ok: true, decision: await recordReleaseGateDecision({ projectId, candidateId, gateKey: body.gateKey, decision: body.action === "gate_approve" ? "approved" : body.action === "gate_override" ? "override" : "revoked", actor, actorRole: user.role, reason: String(body.reason ?? "") }) })
    }
    return NextResponse.json({ error: "Invalid deployment candidate action." }, { status: 400 })
  } catch (error) { return failure(error) }
}

function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? value.split("\n") : [] }
function failure(error: unknown) { if (error instanceof ForgeDeploymentCandidateError || error instanceof AdminIdentityError) return NextResponse.json({ error: error instanceof ForgeDeploymentCandidateError ? error.safeMessage : error.message }, { status: error.status }); return NextResponse.json({ error: "Unable to manage deployment candidates." }, { status: 500 }) }
