import type { JsonValue } from "./forge-ai"
import type { ForgeSeoPack } from "./forge-seo"

export const FORGE_EXPORT_ARTIFACT_TITLE = "Export Record"
export const FORGE_EXPORT_ARTIFACT_KIND = "forge_export_record"

export const FORGE_EXPORT_HISTORY_LIMIT = 40

export type ForgeExportKind = "site" | "proposal" | "audit" | "handover"

// Directory segments that must never appear anywhere in an exported path.
export const FORGE_EXPORT_DENY_SEGMENTS = [
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  ".vercel",
  ".cache",
  "coverage",
  ".idea",
  ".vscode",
] as const

// Internal app roots that must never be bundled even if they somehow appear under a workspace.
export const FORGE_EXPORT_DENY_ROOTS = ["admin", "web"] as const

// Secret/key file extensions.
const SECRET_EXTENSIONS = ["pem", "key", "crt", "cer", "p12", "pfx", "keystore", "jks", "asc", "gpg", "ppk"]

export interface ForgeExportFilterResult {
  ok: boolean
  reason: string | null
}

/**
 * Decides whether a single workspace-relative path is safe to include in an export ZIP.
 * Denies env files, secrets/keys, node_modules/build/VCS directories, internal admin/web files,
 * and any path that tries to escape the workspace. Everything else (the generated site) is allowed.
 */
export function isForgeExportableFile(relativePath: string): ForgeExportFilterResult {
  const raw = typeof relativePath === "string" ? relativePath.trim() : ""
  if (!raw) return deny("Empty path.")
  if (raw.includes("\\")) return deny("Backslashes are not allowed in export paths.")
  if (raw.startsWith("/")) return deny("Absolute paths are not exportable.")
  if (/^[a-zA-Z]:/.test(raw)) return deny("Drive-letter paths are not exportable.")

  const segments = raw.split("/").filter(Boolean)
  if (!segments.length) return deny("Empty path.")
  if (segments.includes("..") || segments.includes(".")) return deny("Path traversal is not allowed.")

  if (FORGE_EXPORT_DENY_ROOTS.includes(segments[0] as (typeof FORGE_EXPORT_DENY_ROOTS)[number])) {
    return deny(`Internal app directory "${segments[0]}" is never exported.`)
  }

  for (const segment of segments) {
    if (FORGE_EXPORT_DENY_SEGMENTS.includes(segment.toLowerCase() as (typeof FORGE_EXPORT_DENY_SEGMENTS)[number])) {
      return deny(`Excluded directory: ${segment}.`)
    }
  }

  const basename = segments[segments.length - 1]
  const lower = basename.toLowerCase()

  if (lower === ".env" || lower.startsWith(".env.") || lower.endsWith(".env")) return deny("Environment files are never exported.")
  if (lower === ".npmrc" || lower === ".netrc" || lower === ".pypirc") return deny("Credential config files are never exported.")
  if (/^id_(rsa|dsa|ecdsa|ed25519)$/.test(lower)) return deny("Private key files are never exported.")

  const extension = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : ""
  if (SECRET_EXTENSIONS.includes(extension)) return deny(`Secret/key file type ".${extension}" is never exported.`)

  if (/(^|[._-])(secret|secrets|credential|credentials|password|passwords|token|tokens|apikey)([._-]|$)/.test(lower)) {
    return deny("Files that look like secrets are never exported.")
  }

  return { ok: true, reason: null }
}

export function filterForgeExportableFiles(paths: string[]): { included: string[]; excluded: { path: string; reason: string }[] } {
  const included: string[] = []
  const excluded: { path: string; reason: string }[] = []
  for (const path of paths) {
    const result = isForgeExportableFile(path)
    if (result.ok) included.push(path)
    else excluded.push({ path, reason: result.reason ?? "Excluded." })
  }
  return { included, excluded }
}

/* ── SEO checklist exports ──────────────────────────────────────────── */

export function buildForgeSeoChecklistJson(pack: ForgeSeoPack): string {
  return JSON.stringify({
    business: pack.business.businessName,
    siteUrl: pack.business.siteUrl,
    generatedAt: pack.generatedAt,
    score: pack.score,
    checklist: pack.checklist,
    warnings: pack.warnings,
  }, null, 2)
}

export function buildForgeSeoChecklistMarkdown(pack: ForgeSeoPack): string {
  const categories: { key: "seo" | "aeo" | "geo"; label: string }[] = [
    { key: "seo", label: "SEO (Google)" },
    { key: "aeo", label: "AEO (Answer Engines)" },
    { key: "geo", label: "GEO (Local/Geo)" },
  ]
  return [
    `# SEO / AEO / GEO Checklist — ${pack.business.businessName}`,
    `Overall ${pack.score.overall}/100 · SEO ${pack.score.seo} · AEO ${pack.score.aeo} · GEO ${pack.score.geo}`,
    `Generated: ${pack.generatedAt}`,
    "",
    ...categories.flatMap((category) => [
      `## ${category.label}`,
      ...pack.checklist.filter((item) => item.category === category.key).map((item) => {
        const mark = item.status === "pass" ? "x" : " "
        const rec = item.recommendation ? ` — _${item.recommendation}_` : ""
        return `- [${mark}] **${item.label}** (${item.status}): ${item.detail}${rec}`
      }),
      "",
    ]),
    ...(pack.warnings.length ? ["## Warnings", ...pack.warnings.map((warning) => `- ${warning}`)] : []),
  ].join("\n").trim()
}

/* ── export record metadata ─────────────────────────────────────────── */

export interface ForgeExportRecord extends Record<string, JsonValue> {
  kind: ForgeExportKind
  filename: string
  contentType: string
  fileCount: number
  byteSize: number
  excludedCount: number
  actor: string
  createdAt: string
}

export interface ForgeExportArtifactState {
  records: ForgeExportRecord[]
  lastExportAt: string | null
}

export function readForgeExportArtifact(metadata: Record<string, unknown> | null | undefined): ForgeExportArtifactState {
  if (!metadata || metadata.kind !== FORGE_EXPORT_ARTIFACT_KIND || !Array.isArray(metadata.records)) {
    return { records: [], lastExportAt: null }
  }
  const records = (metadata.records as unknown[]).filter(isExportRecord)
  return {
    records,
    lastExportAt: records.length ? records[0].createdAt : null,
  }
}

export function appendForgeExportRecord(existing: ForgeExportRecord[], record: ForgeExportRecord): ForgeExportRecord[] {
  return [record, ...existing].slice(0, FORGE_EXPORT_HISTORY_LIMIT)
}

export function buildForgeExportArtifactContent(records: ForgeExportRecord[]): string {
  return [
    "# Export Record",
    "",
    records.length ? "" : "No exports yet.",
    ...records.map((record) => `- ${record.createdAt}: ${record.kind} → ${record.filename} (${record.fileCount} file(s), ${formatBytes(record.byteSize)}) by ${record.actor}`),
  ].join("\n").trim()
}

/* ── filename + content-type helpers ────────────────────────────────── */

export function forgeExportSlug(businessName: string): string {
  return businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scalesmiths"
}

export function forgeExportFilename(kind: ForgeExportKind, businessName: string, datePart = isoDate()): string {
  const slug = forgeExportSlug(businessName)
  switch (kind) {
    case "site": return `${slug}-site-${datePart}.zip`
    case "proposal": return `${slug}-proposal-${datePart}.md`
    case "audit": return `${slug}-audit-${datePart}.md`
    case "handover": return `${slug}-handover-pack-${datePart}.zip`
  }
}

export function forgeExportContentType(kind: ForgeExportKind): string {
  return kind === "proposal" || kind === "audit" ? "text/markdown; charset=utf-8" : "application/zip"
}

/* ── internal helpers ───────────────────────────────────────────────── */

function deny(reason: string): ForgeExportFilterResult {
  return { ok: false, reason }
}

function isExportRecord(value: unknown): value is ForgeExportRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<ForgeExportRecord>
  return (
    (record.kind === "site" || record.kind === "proposal" || record.kind === "audit" || record.kind === "handover") &&
    typeof record.filename === "string" &&
    typeof record.fileCount === "number" &&
    typeof record.createdAt === "string"
  )
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
