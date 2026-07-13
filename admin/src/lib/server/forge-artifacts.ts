import "server-only"
import { createHash } from "node:crypto"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  buildForgeArtifactVersionMetadata,
  compactForgeLargeLog,
  resolveForgeArtifactRetentionConfig,
  type ForgeArtifactRetentionConfig,
  type ForgeArtifactProvenanceInput,
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
  provenance,
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
  provenance: ForgeArtifactProvenanceInput
}) {
  const existing = await db
    .select({ id: forgeArtifacts.id, version: forgeArtifacts.version, outputHash: forgeArtifacts.outputHash })
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
        artifactLifecycle: {
          ...(typeof metadataJson.artifactLifecycle === "object" && metadataJson.artifactLifecycle !== null ? metadataJson.artifactLifecycle : {}),
          generatedVersion: version,
          generatedAt: now.toISOString(),
          generatedBy: provenance.provider ?? "system",
        },
      },
      version,
      retentionPolicy,
      contentBytes: versionMetadata.contentBytes,
      parentArtifactId: existing[0]?.id ?? null,
      sourceTaskId: provenance.sourceTaskId ?? null,
      provider: provenance.provider ?? null,
      model: provenance.model ?? null,
      promptIdentifier: provenance.promptIdentifier ?? "forge.legacy",
      promptVersion: provenance.promptVersion,
      schemaIdentifier: provenance.schemaIdentifier ?? "forge.legacy",
      schemaVersion: provenance.schemaVersion,
      sourceVersion: provenance.sourceVersion ?? process.env.ERROR_MONITORING_RELEASE ?? process.env.GIT_COMMIT_SHA ?? null,
      upstreamArtifactIds: (provenance.upstreamArtifacts ?? []).map((item) => item.id),
      upstreamArtifactHashes: Object.fromEntries((provenance.upstreamArtifacts ?? []).map((item) => [String(item.id), item.outputHash])),
      inputContextHash: hashCanonical(provenance.inputContext),
      outputHash: hashCanonical(retainedContent),
      actor: provenance.actor ?? actor ?? null,
      validationResult: provenance.validationResult ?? null,
      qualityState: provenance.qualityState ?? "requires_review",
      approvalState: provenance.approvalState ?? "unapproved",
      approvalHistory: provenance.approvalHistory ?? [],
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

  return artifact
}

export function hashCanonical(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined"
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`
}
