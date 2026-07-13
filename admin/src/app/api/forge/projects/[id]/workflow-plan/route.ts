import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { db } from "@/lib/db"
import { canOverridePlannerLimit, FORGE_ADAPTIVE_TASKS } from "@/lib/forge-workflow-planner"
import { forgeActivityLogs } from "@/lib/schema"
import { buildPersistedForgeWorkflowPlan } from "@/lib/server/forge-workflow-planner"
import type { AdminRole } from "@/lib/admin-users"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  const result = await buildPersistedForgeWorkflowPlan(id)
  return result ? NextResponse.json(result) : NextResponse.json({ error: "Forge project not found." }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const task = typeof body?.task === "string" && FORGE_ADAPTIVE_TASKS.includes(body.task as never) ? body.task : null
  const action = body?.action === "accept" || body?.action === "dismiss" || body?.action === "override" ? body.action : null
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
  if (!task || !action || reason.length < 10) return NextResponse.json({ error: "A valid recommendation action and meaningful reason are required." }, { status: 400 })
  const role = session.user?.role as AdminRole
  if (action === "override" && !canOverridePlannerLimit(role, reason)) return NextResponse.json({ error: "Only owners and administrators may override planner limits with a meaningful reason." }, { status: 403 })
  const result = await buildPersistedForgeWorkflowPlan(id)
  if (!result) return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  const actor = session.user?.email ?? session.user?.name ?? "admin"
  await db.insert(forgeActivityLogs).values({ projectId: id, actor, action: `workflow_recommendation_${action}`, message: `${action === "accept" ? "Accepted" : action === "dismiss" ? "Dismissed" : "Overrode planner limit for"} ${task}.`, metadataJson: { plannerVersion: result.plan.version, task, reason, evidence: result.plan.recommendations.find((item) => item.task === task)?.evidence ?? [], role, autonomousExecution: false, autonomousDeployment: false } })
  return NextResponse.json({ ok: true, action, task, plan: result.plan })
}

function parseId(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null }
