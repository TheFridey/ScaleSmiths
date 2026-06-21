import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  FORGE_EXPORT_ARTIFACT_KIND,
  FORGE_EXPORT_ARTIFACT_TITLE,
  appendForgeExportRecord,
  buildForgeExportArtifactContent,
  buildForgeSeoChecklistJson,
  buildForgeSeoChecklistMarkdown,
  filterForgeExportableFiles,
  forgeExportContentType,
  forgeExportFilename,
  readForgeExportArtifact,
  type ForgeExportKind,
  type ForgeExportRecord,
} from "@/lib/forge-export"
import {
  FORGE_PROPOSAL_ARTIFACT_TITLE,
  buildForgeAuditMarkdown,
  buildForgeHandoverMarkdown,
  buildForgeProposalMarkdown,
  buildForgeRetainerMarkdown,
  buildForgeRoadmapMarkdown,
  readForgeProposalArtifact,
  type ForgeProposalBundle,
} from "@/lib/forge-proposal"
import { FORGE_SEO_ARTIFACT_TITLE, readForgeSeoArtifact, type ForgeSeoPack } from "@/lib/forge-seo"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory, type ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeMemories, forgeProjects } from "@/lib/schema"
import { createForgeZipArchive, type ForgeZipEntry } from "./forge-zip"
import { listForgeWorkspaceFiles, readForgeWorkspaceFile } from "./forge-workspace"

export class ForgeExportError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeExportError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export interface ForgeExportResult {
  filename: string
  contentType: string
  body: Buffer
  fileCount: number
  excludedCount: number
}

export async function runForgeExport(projectId: number, actor: string, kind: ForgeExportKind): Promise<ForgeExportResult> {
  const context = await loadExportContext(projectId)
  const businessName = context.project.businessName || context.project.name

  const built = kind === "site"
    ? await buildSiteExport(context.workspace)
    : kind === "handover"
      ? buildHandoverExport(context.proposalBundle, context.seoPack)
      : buildDocumentExport(kind, context.proposalBundle)

  const filename = forgeExportFilename(kind, businessName)
  const result: ForgeExportResult = {
    filename,
    contentType: forgeExportContentType(kind),
    body: built.body,
    fileCount: built.fileCount,
    excludedCount: built.excludedCount,
  }

  await recordExport(projectId, actor, {
    kind,
    filename,
    contentType: result.contentType,
    fileCount: built.fileCount,
    byteSize: built.body.length,
    excludedCount: built.excludedCount,
    actor,
    createdAt: new Date().toISOString(),
  })

  return result
}

/* ── builders per export kind ───────────────────────────────────────── */

async function buildSiteExport(workspace: ForgeWorkspaceMetadata | null) {
  if (!workspace) throw new ForgeExportError("Generate the site before exporting it.", 400)

  const allFiles = await listForgeWorkspaceFiles(workspace)
  if (!allFiles.length) throw new ForgeExportError("The generated workspace has no files to export.", 400)

  const { included, excluded } = filterForgeExportableFiles(allFiles)
  if (!included.length) throw new ForgeExportError("No exportable files remain after applying the export safety filter.", 400)

  const entries: ForgeZipEntry[] = []
  for (const path of included) {
    const content = await readForgeWorkspaceFile(workspace, path).catch(() => null)
    if (content === null) continue
    entries.push({ path, content })
  }

  if (!entries.length) throw new ForgeExportError("Generated files could not be read for export.", 500)

  return { body: createForgeZipArchive(entries), fileCount: entries.length, excludedCount: excluded.length }
}

function buildDocumentExport(kind: "proposal" | "audit", bundle: ForgeProposalBundle | null) {
  if (!bundle) throw new ForgeExportError("Generate the proposal pack before exporting documents.", 400)
  const markdown = kind === "proposal" ? buildForgeProposalMarkdown(bundle) : buildForgeAuditMarkdown(bundle)
  return { body: Buffer.from(markdown, "utf8"), fileCount: 1, excludedCount: 0 }
}

function buildHandoverExport(bundle: ForgeProposalBundle | null, seoPack: ForgeSeoPack | null) {
  if (!bundle) throw new ForgeExportError("Generate the proposal pack before exporting the handover pack.", 400)

  const entries: ForgeZipEntry[] = [
    { path: "proposal.md", content: buildForgeProposalMarkdown(bundle) },
    { path: "audit.md", content: buildForgeAuditMarkdown(bundle) },
    { path: "retainer.md", content: buildForgeRetainerMarkdown(bundle) },
    { path: "roadmap.md", content: buildForgeRoadmapMarkdown(bundle) },
    { path: "handover.md", content: buildForgeHandoverMarkdown(bundle) },
  ]
  if (seoPack) {
    entries.push({ path: "seo-checklist.md", content: buildForgeSeoChecklistMarkdown(seoPack) })
    entries.push({ path: "seo-checklist.json", content: buildForgeSeoChecklistJson(seoPack) })
  }

  return { body: createForgeZipArchive(entries), fileCount: entries.length, excludedCount: 0 }
}

/* ── persistence ────────────────────────────────────────────────────── */

async function recordExport(projectId: number, actor: string, record: ForgeExportRecord) {
  const now = new Date()
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "export_record"),
      eq(forgeArtifacts.title, FORGE_EXPORT_ARTIFACT_TITLE),
    )).limit(1)

    const previous = readForgeExportArtifact(existing?.metadataJson as Record<string, unknown> | null | undefined)
    const records = appendForgeExportRecord(previous.records, record)
    const content = buildForgeExportArtifactContent(records)
    const metadataJson = {
      ...(existing?.metadataJson ?? {}),
      kind: FORGE_EXPORT_ARTIFACT_KIND,
      records,
    }

    if (existing) {
      await tx.update(forgeArtifacts).set({ content, metadataJson, updatedAt: now }).where(eq(forgeArtifacts.id, existing.id))
    } else {
      await tx.insert(forgeArtifacts).values({
        projectId,
        type: "export_record",
        title: FORGE_EXPORT_ARTIFACT_TITLE,
        content,
        metadataJson,
        updatedAt: now,
      })
    }

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "export_generated",
      message: `Exported ${record.kind} (${record.filename}, ${record.fileCount} file(s)).`,
      metadataJson: {
        kind: record.kind,
        filename: record.filename,
        fileCount: record.fileCount,
        byteSize: record.byteSize,
        excludedCount: record.excludedCount,
      },
    })
  })
}

/* ── context ────────────────────────────────────────────────────────── */

async function loadExportContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeExportError("Forge project not found.", 404)
  if (project.status === "archived") throw new ForgeExportError("Archived Forge projects cannot be exported.", 400)

  const [workspaceMemories, proposalArtifacts, seoArtifacts] = await Promise.all([
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "proposal"),
      eq(forgeArtifacts.title, FORGE_PROPOSAL_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "seo_pack"),
      eq(forgeArtifacts.title, FORGE_SEO_ARTIFACT_TITLE),
    )).limit(1),
  ])

  return {
    project,
    workspace: readForgeWorkspaceMemory(workspaceMemories[0]?.value),
    proposalBundle: readForgeProposalArtifact(proposalArtifacts[0]?.metadataJson).bundle,
    seoPack: readForgeSeoArtifact(seoArtifacts[0]?.metadataJson).pack,
  }
}
