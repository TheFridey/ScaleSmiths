import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "../../../../../../auth"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeProjects } from "@/lib/schema"
import { parseForgeProjectPayload } from "@/lib/forge"

export const dynamic = "force-dynamic"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, id)).limit(1)

  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  return NextResponse.json({ project })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid Forge project payload." }, { status: 400 })
  }

  const [existing] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, id)).limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  const input = body as Record<string, unknown>
  const action = typeof input.action === "string" ? input.action : "update"
  const actor = sessionActor(session)
  const now = new Date()

  if (action === "archive") {
    const [project] = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(forgeProjects)
        .set({ status: "archived", updatedAt: now })
        .where(eq(forgeProjects.id, id))
        .returning()

      await tx.insert(forgeActivityLogs).values({
        projectId: id,
        actor,
        action: "archive",
        message: `Archived Forge project ${updated.name}.`,
        metadataJson: { previousStatus: existing.status },
      })

      return [updated]
    })

    return NextResponse.json({ ok: true, project })
  }

  if (action !== "update") {
    return NextResponse.json({ error: "Unsupported Forge project action." }, { status: 400 })
  }

  const parsed = parseForgeProjectPayload(input, "patch")

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No Forge project fields supplied." }, { status: 400 })
  }

  const project = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(forgeProjects)
      .set({ ...parsed.data, updatedAt: now })
      .where(eq(forgeProjects.id, id))
      .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId: id,
      actor,
      action: "update",
      message: `Updated Forge project ${updated.name}.`,
      metadataJson: { changedFields: Object.keys(parsed.data) },
    })

    return updated
  })

  return NextResponse.json({ ok: true, project })
}
