import "server-only"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  buildForgeArtifactVersionMetadata,
  compactForgeLargeLog,
  resolveForgeArtifactRetentionConfig,
  type ForgeArtifactRetentionConfig,
} from "@/lib/forge-artifacts"
import { forgeActivityLogs, forgeArtifacts, type forgeArtifactType } from "@/lib/schema"

type ForgeArtifactType = (typeof forgeArtifactType.enumValues)[number]

export async function saveVersionedForgeArtifact({
  projectId,
  type,
  title,
  content,
  metadataJson,
  actor,
  action = "artifact_version_saved",
  message,
  retentionPolicy = "standard",
  now = new Date(),
  retention = resolveForgeArtifactRetentionConfig(),
}: {
  projectId: number
  type: ForgeArtifactType
  title: string
  content: string
  metadataJson: Record<string, unknown>
  actor?: string
  action?: string
  message?: string
  retentionPolicy?: "standard" | "qa-log"
  now?: Date
  retention?: ForgeArtifactRetentionConfig
}) {
  const existing = await db
    .select({ id: forgeArtifacts.id, version: forgeArtifacts.version })
    .from(forgeArtifacts)
    .where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, type), eq(forgeArtifacts.title, title)))
    .orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt))
    .limit(retention.maxVersionsPerArtifact + 5)

  const latestVersion = existing[0]?.version ?? 0
  const retainedContent = content.length > retention.maxArtifactContentBytes
    ? compactForgeLargeLog(content, retention.maxArtifactContentBytes)
    : content
  const versionMetadata = buildForgeArtifactVersionMetadata({ latestVersion, content: retainedContent, retentionPolicy, now })
  const version = versionMetadata.version

  const [artifact] = await db.transaction(async (tx) => {
    const existingIds = existing.map((item) => item.id)
    if (existingIds.length) {
      await tx
        .update(forgeArtifacts)
        .set({ supersededAt: now, updatedAt: now })
        .where(inArray(forgeArtifacts.id, existingIds))
    }

    const [created] = await tx.insert(forgeArtifacts).values({
      projectId,
      type,
      title,
      content: retainedContent,
      metadataJson: {
        ...metadataJson,
        artifactVersion: versionMetadata,
      },
      version,
      retentionPolicy,
      contentBytes: versionMetadata.contentBytes,
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action,
      message: message ?? `Saved ${title} artifact version ${version}.`,
      metadataJson: {
        artifactId: created.id,
        type,
        title,
        version,
        retentionPolicy,
        contentBytes: versionMetadata.contentBytes,
      },
    })

    return [created]
  })

  await pruneArtifactVersions(projectId, type, title, retention.maxVersionsPerArtifact)
  return artifact
}

async function pruneArtifactVersions(projectId: number, type: ForgeArtifactType, title: string, maxVersions: number) {
  const versions = await db
    .select({ id: forgeArtifacts.id })
    .from(forgeArtifacts)
    .where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, type), eq(forgeArtifacts.title, title)))
    .orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt))

  const staleIds = versions.slice(maxVersions).map((item) => item.id)
  if (staleIds.length) {
    await db.delete(forgeArtifacts).where(inArray(forgeArtifacts.id, staleIds))
  }
}
