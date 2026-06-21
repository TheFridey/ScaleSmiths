import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { auth } from "../../../../../../../auth"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeArtifacts, forgeProjects } from "@/lib/schema"
import {
  FORGE_INTAKE_ARTIFACT_KIND,
  FORGE_INTAKE_ARTIFACT_TITLE,
  parseForgeIntakePayload,
  readForgeIntakeArtifact,
} from "@/lib/forge"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const [project] = await db.select({ id: forgeProjects.id }).from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  const [artifact] = await db
    .select()
    .from(forgeArtifacts)
    .where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "handover_doc"),
      eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
    ))
    .limit(1)

  return NextResponse.json({ intake: readForgeIntakeArtifact(artifact?.metadataJson) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: "Invalid intake payload." }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const action = input.action === "complete" ? "complete" : "save"
  const parsed = parseForgeIntakePayload(input)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  if (action === "complete" && parsed.data.missingFields.length > 0) {
    return NextResponse.json({
      error: "Complete the missing intake fields before marking this intake complete.",
      missingFields: parsed.data.missingFields,
      completenessScore: parsed.data.completenessScore,
    }, { status: 400 })
  }

  const [project] = await db.select({ id: forgeProjects.id, name: forgeProjects.name }).from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  const actor = sessionActor(session)
  const now = new Date()
  const intakeStatus = action === "complete" ? "completed" : "draft"
  const metadataJson = {
    kind: FORGE_INTAKE_ARTIFACT_KIND,
    status: intakeStatus,
    intake: parsed.data.intake,
    completenessScore: parsed.data.completenessScore,
    missingFields: parsed.data.missingFields,
    supportedAgents: ["research", "sitemap", "copy", "design", "build", "integration"],
    completedAt: action === "complete" ? now.toISOString() : null,
  }

  const artifact = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "handover_doc"),
        eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
      ))
      .limit(1)

    const [saved] = existing
      ? await tx
        .update(forgeArtifacts)
        .set({
          content: parsed.data.summary,
          metadataJson,
          updatedAt: now,
        })
        .where(eq(forgeArtifacts.id, existing.id))
        .returning()
      : await tx
        .insert(forgeArtifacts)
        .values({
          projectId,
          type: "handover_doc",
          title: FORGE_INTAKE_ARTIFACT_TITLE,
          content: parsed.data.summary,
          metadataJson,
          updatedAt: now,
        })
        .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: action === "complete" ? "intake_complete" : "intake_save",
      message: action === "complete"
        ? `Completed structured intake for ${project.name}.`
        : `Saved structured intake draft for ${project.name}.`,
      metadataJson: {
        completenessScore: parsed.data.completenessScore,
        missingFields: parsed.data.missingFields,
        artifactId: saved.id,
      },
    })

    return saved
  })

  return NextResponse.json({
    ok: true,
    artifact,
    intake: {
      intake: parsed.data.intake,
      completenessScore: parsed.data.completenessScore,
      missingFields: parsed.data.missingFields,
      status: intakeStatus,
    },
  })
}
