import "server-only"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { summarizeForgeHumanEdits } from "@/lib/forge-human-edits"
import { forgeArtifacts } from "@/lib/schema"

export async function loadForgeHumanEditReport(projectId?: number) {
  const rows = projectId
    ? await db.select().from(forgeArtifacts).where(eq(forgeArtifacts.projectId, projectId)).orderBy(desc(forgeArtifacts.createdAt))
    : await db.select().from(forgeArtifacts).orderBy(desc(forgeArtifacts.createdAt))
  const artifacts = rows.map((artifact) => ({
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    version: artifact.version,
    content: null,
    metadataJson: artifact.metadataJson,
    provider: artifact.provider,
    model: artifact.model,
    createdAt: artifact.createdAt,
  }))
  return {
    projectId: projectId ?? null,
    generatedAt: new Date().toISOString(),
    rows: summarizeForgeHumanEdits(artifacts),
  }
}
