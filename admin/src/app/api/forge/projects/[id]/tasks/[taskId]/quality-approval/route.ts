import { and, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"
import { auth } from "../../../../../../../../../auth"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeTasks } from "@/lib/schema"

export async function POST(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const { id, taskId } = await params
  const projectId = Number(id), parsedTaskId = Number(taskId)
  const body = await request.json().catch(() => ({})) as { reason?: unknown }
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (!Number.isInteger(projectId) || !Number.isInteger(parsedTaskId) || reason.length < 10 || reason.length > 1000) {
    return NextResponse.json({ error: "A review reason of 10 to 1000 characters is required." }, { status: 400 })
  }
  const actor = session.user?.email ?? session.user?.name ?? "admin"
  const now = new Date()
  const updated = await db.transaction(async (tx) => {
    const [task] = await tx.update(forgeTasks).set({ qualityApprovedBy: actor, qualityApprovedAt: now, qualityApprovalReason: reason, publicationBlocked: false, downstreamAllowed: true, updatedAt: now })
      .where(and(eq(forgeTasks.id, parsedTaskId), eq(forgeTasks.projectId, projectId), eq(forgeTasks.status, "completed"), inArray(forgeTasks.resultQuality, ["degraded", "fallback"]))).returning()
    if (!task) return null
    await tx.insert(forgeActivityLogs).values({ projectId, actor, action: "task_quality_approved", message: `Approved ${task.resultQuality} output for task #${task.id}.`, metadataJson: { taskId: task.id, resultQuality: task.resultQuality, reason } })
    return task
  })
  return updated ? NextResponse.json({ task: updated }) : NextResponse.json({ error: "Completed degraded or fallback Forge task not found." }, { status: 404 })
}
