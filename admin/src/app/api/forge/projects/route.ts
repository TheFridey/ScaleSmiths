import { NextRequest, NextResponse } from "next/server"
import { desc } from "drizzle-orm"
import { auth } from "../../../../../auth"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeProjects } from "@/lib/schema"
import { parseForgeProjectPayload } from "@/lib/forge"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

export async function GET() {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const projects = await db.select().from(forgeProjects).orderBy(desc(forgeProjects.updatedAt))

  return NextResponse.json({ projects })
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid Forge project payload." }, { status: 400 })
  }

  const parsed = parseForgeProjectPayload(body as Record<string, unknown>, "create")

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const actor = sessionActor(session)
  const now = new Date()
  const project = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forgeProjects)
      .values({
        ...parsed.data,
        name: parsed.data.name ?? "",
        businessName: parsed.data.businessName ?? "",
        ownerActor: parsed.data.ownerActor ?? actor,
        updatedAt: now,
      })
      .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId: created.id,
      actor,
      action: "create",
      message: `Created Forge project ${created.name}.`,
      metadataJson: { status: created.status, priority: created.priority },
    })

    return created
  })

  return NextResponse.json({ ok: true, project }, { status: 201 })
}
