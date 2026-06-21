import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { auth } from "../../../../../../../../auth"
import { db } from "@/lib/db"
import { FORGE_RESEND_PROVIDER, parseForgeResendConfigPayload, redactForgeResendConfig } from "@/lib/forge-resend"
import { forgeActivityLogs, forgeIntegrationConfigs, forgeProjects } from "@/lib/schema"

export const dynamic = "force-dynamic"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid Resend integration payload." }, { status: 400 })
  }

  const parsed = parseForgeResendConfigPayload(body as Record<string, unknown>)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }
  if (project.status === "archived") {
    return NextResponse.json({ error: "Archived Forge projects cannot update integrations." }, { status: 400 })
  }

  const actor = sessionActor(session)
  const now = new Date()
  const [saved] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forgeIntegrationConfigs)
      .where(and(
        eq(forgeIntegrationConfigs.projectId, projectId),
        eq(forgeIntegrationConfigs.provider, FORGE_RESEND_PROVIDER),
      ))
      .limit(1)

    const values = {
      projectId,
      provider: FORGE_RESEND_PROVIDER as "resend",
      configJson: parsed.data,
      enabled: parsed.data.enabled,
      updatedAt: now,
    }

    const [integration] = existing
      ? await tx.update(forgeIntegrationConfigs).set(values).where(eq(forgeIntegrationConfigs.id, existing.id)).returning()
      : await tx.insert(forgeIntegrationConfigs).values(values).returning()

    await tx.update(forgeProjects).set({ status: parsed.data.enabled ? "integrations" : project.status, updatedAt: now }).where(eq(forgeProjects.id, projectId))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "resend_config_updated",
      message: `Updated Resend integration for ${project.name}.`,
      metadataJson: {
        config: redactForgeResendConfig(parsed.data),
        enabled: parsed.data.enabled,
      },
    })

    return [integration]
  })

  return NextResponse.json({
    ok: true,
    integration: {
      id: saved.id,
      provider: saved.provider,
      enabled: saved.enabled,
      configJson: redactForgeResendConfig(parsed.data),
      updatedAt: saved.updatedAt,
    },
    config: parsed.data,
  })
}
