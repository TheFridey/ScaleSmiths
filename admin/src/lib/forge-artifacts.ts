export interface ForgeArtifactRetentionConfig {
  maxVersionsPerArtifact: number
  maxArtifactContentBytes: number
  largeLogMaxChars: number
}

export interface ForgeVersionedArtifactMetadata {
  version: number
  contentBytes: number
  retentionPolicy: "standard" | "qa-log"
  retainedAt: string
}

export interface ForgeArtifactProvenanceInput {
  sourceTaskId?: number | null
  provider?: string | null
  model?: string | null
  promptIdentifier?: string
  promptVersion: string
  schemaIdentifier?: string
  schemaVersion: string
  sourceVersion?: string | null
  upstreamArtifacts?: Array<{ id: number; outputHash: string }>
  inputContext: unknown
  actor?: string | null
  validationResult?: Record<string, unknown> | null
  qualityState?: "validated" | "degraded" | "fallback" | "requires_review" | "failed"
  approvalState?: string
  approvalHistory?: Array<Record<string, unknown>>
}

export function resolveForgeArtifactRetentionConfig(env: Partial<Record<string, string | undefined>> = process.env): ForgeArtifactRetentionConfig {
  return {
    maxVersionsPerArtifact: clampInteger(env.FORGE_ARTIFACT_MAX_VERSIONS, 10, 1, 50),
    maxArtifactContentBytes: clampInteger(env.FORGE_ARTIFACT_MAX_CONTENT_BYTES, 250_000, 50_000, 2_000_000),
    largeLogMaxChars: clampInteger(env.FORGE_QA_LOG_MAX_CHARS, 12_000, 2_000, 80_000),
  }
}

export function buildForgeArtifactVersionMetadata({
  latestVersion,
  content,
  retentionPolicy = "standard",
  now = new Date(),
}: {
  latestVersion?: number | null
  content: string | null | undefined
  retentionPolicy?: ForgeVersionedArtifactMetadata["retentionPolicy"]
  now?: Date
}): ForgeVersionedArtifactMetadata {
  return {
    version: Math.max(0, latestVersion ?? 0) + 1,
    contentBytes: Buffer.byteLength(content ?? "", "utf8"),
    retentionPolicy,
    retainedAt: now.toISOString(),
  }
}

export function compactForgeLargeLog(value: string, maxChars: number) {
  if (value.length <= maxChars) return value
  const head = Math.max(500, Math.floor(maxChars * 0.2))
  const tail = Math.max(500, maxChars - head - 80)
  return `${value.slice(0, head)}\n\n[...retained tail after trimming ${value.length - maxChars} chars...]\n\n${value.slice(-tail)}`
}

export function diffArtifactText(previous: string | null, current: string | null) {
  const before = (previous ?? "").split("\n")
  const after = (current ?? "").split("\n")
  const length = Math.max(before.length, after.length)
  const changes: Array<{ line: number; before: string | null; after: string | null }> = []
  for (let index = 0; index < length; index += 1) if (before[index] !== after[index]) changes.push({ line: index + 1, before: before[index] ?? null, after: after[index] ?? null })
  return changes
}

function clampInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}
