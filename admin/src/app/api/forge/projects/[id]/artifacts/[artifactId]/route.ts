import { and, asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { auth } from "../../../../../../../../auth"
import { db } from "@/lib/db"
import { diffArtifactText } from "@/lib/forge-artifacts"
import { forgeActivityLogs, forgeArtifacts } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "@/lib/server/forge-artifacts"

function ids(values: { id: string; artifactId: string }) {
  const projectId = Number(values.id), artifactId = Number(values.artifactId)
  return Number.isInteger(projectId) && projectId > 0 && Number.isInteger(artifactId) && artifactId > 0 ? { projectId, artifactId } : null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; artifactId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const parsed = ids(await params)
  if (!parsed) return NextResponse.json({ error: "Invalid artifact identifier." }, { status: 400 })
  const [selected] = await db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.id, parsed.artifactId), eq(forgeArtifacts.projectId, parsed.projectId))).limit(1)
  if (!selected) return NextResponse.json({ error: "Forge artifact not found." }, { status: 404 })
  const versions = await db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, parsed.projectId), eq(forgeArtifacts.type, selected.type), eq(forgeArtifacts.title, selected.title))).orderBy(asc(forgeArtifacts.version))
  return NextResponse.json({
    artifact: selected,
    versions: versions.map((version, index) => ({ ...version, diffFromPrevious: diffArtifactText(index ? versions[index - 1].content : null, version.content) })),
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; artifactId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const parsed = ids(await params)
  const body = await request.json().catch(() => ({})) as { action?: unknown; reason?: unknown }
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (!parsed || body.action !== "rollback" || reason.length < 10) return NextResponse.json({ error: "Rollback requires a reason of at least 10 characters." }, { status: 400 })
  const [source] = await db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.id, parsed.artifactId), eq(forgeArtifacts.projectId, parsed.projectId))).limit(1)
  if (!source) return NextResponse.json({ error: "Historical artifact not found." }, { status: 404 })
  const actor = session.user?.email ?? session.user?.name ?? "admin"
  const created = await saveVersionedForgeArtifact({
    projectId: parsed.projectId, type: source.type, title: source.title, content: source.content ?? "", metadataJson: { ...(source.metadataJson ?? {}), rollback: { sourceArtifactId: source.id, sourceVersion: source.version, reason } }, actor,
    action: "artifact_rollback_created", message: `Created a new ${source.title} version from historical version ${source.version}.`,
    retentionPolicy: source.retentionPolicy === "qa-log" ? "qa-log" : "standard",
    provenance: { sourceTaskId: source.sourceTaskId, provider: source.provider, model: source.model, promptVersion: source.promptVersion, schemaVersion: source.schemaVersion, sourceVersion: source.sourceVersion, upstreamArtifacts: [{ id: source.id, outputHash: source.outputHash }], inputContext: { rollbackSourceId: source.id, rollbackSourceHash: source.outputHash, reason }, actor, validationResult: source.validationResult, qualityState: source.qualityState, approvalState: "unapproved", approvalHistory: [] },
  })
  await db.insert(forgeActivityLogs).values({ projectId: parsed.projectId, actor, action: "artifact_rollback_lineage", message: `Rolled back by creating artifact version ${created.version}.`, metadataJson: { sourceArtifactId: source.id, sourceVersion: source.version, newArtifactId: created.id, newVersion: created.version, reason } })
  return NextResponse.json({ artifact: created }, { status: 201 })
}
