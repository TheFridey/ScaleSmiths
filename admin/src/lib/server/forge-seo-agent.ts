import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact } from "@/lib/forge"
import { buildForgeSeoContextFromIntake } from "@/lib/forge-seo-context"
import {
  FORGE_COPY_ARTIFACT_KIND,
  FORGE_COPY_ARTIFACT_TITLE,
  readForgeCopyDocumentArtifact,
  type ForgeCopyDocument,
} from "@/lib/forge-copy"
import { buildForgeSeoModel } from "@/lib/forge-frontend-code"
import {
  FORGE_SEO_ARTIFACT_KIND,
  FORGE_SEO_ARTIFACT_TITLE,
  applyForgeSeoMetadataFixes,
  buildForgeSeoArtifactContent,
  buildForgeSeoPack,
  type ForgeSeoFix,
  type ForgeSeoPack,
} from "@/lib/forge-seo"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { FORGE_WORKSPACE_MEMORY_KEY, FORGE_WORKSPACE_TEMPLATE, readForgeWorkspaceMemory, type ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"

export class ForgeSeoAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeSeoAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export type ForgeSeoAgentAction = "generate" | "fix"

export async function runForgeSeoAgent(projectId: number, actor: string, action: ForgeSeoAgentAction = "generate") {
  const { project, intake, workspace, approvedSitemap, approvedCopy, copyMetadata } = await loadSeoContext(projectId)

  if (project.status === "archived") throw new ForgeSeoAgentError("Archived Forge projects cannot run the SEO engine.", 400)
  if (!approvedSitemap) throw new ForgeSeoAgentError("Approve the sitemap before generating an SEO pack.", 400)
  if (!approvedCopy) throw new ForgeSeoAgentError("Approve copy before generating an SEO pack.", 400)

  const seoContext = buildForgeSeoContextFromIntake(intake)
  const safeWorkspace: ForgeWorkspaceMetadata = workspace ?? {
    projectId,
    slug: `${projectId}-${(project.businessName || project.name)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `${projectId}-site`,
    relativePath: "",
    template: FORGE_WORKSPACE_TEMPLATE,
    fileCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: action === "fix" ? "Fix missing SEO metadata" : "Generate SEO/AEO/GEO pack",
      description: action === "fix"
        ? "Backfill missing or out-of-budget page titles and meta descriptions, then regenerate the SEO pack."
        : "Generate canonical/OG/Twitter metadata, JSON-LD schema, sitemap, robots, and the SEO/AEO/GEO score.",
      agentType: "seo",
      status: "running",
      inputJson: { projectId, projectName: project.name, action },
      startedAt: now,
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: action === "fix" ? "seo_fix_running" : "seo_generate_running",
      message: action === "fix"
        ? `Fixing missing SEO metadata for ${project.name}.`
        : `Generating SEO pack for ${project.name}.`,
      metadataJson: { taskId: created.id },
    })

    return [created]
  })

  try {
    const model = buildForgeSeoModel({ project, workspace: safeWorkspace, approvedSitemap, approvedCopy, seoContext })

    let fixes: ForgeSeoFix[] = []
    let pages = model.pages
    if (action === "fix") {
      const result = applyForgeSeoMetadataFixes(model.business, model.pages)
      pages = result.pages
      fixes = result.fixes
      if (fixes.length) {
        await persistCopyMetadataFixes(projectId, approvedCopy, copyMetadata, fixes)
      }
    }

    const pack = buildForgeSeoPack(model.business, pages)
    const completedAt = new Date()
    const artifact = await saveSeoPack(projectId, pack, task.id, completedAt)

    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "completed",
        outputJson: {
          action,
          score: pack.score,
          warnings: pack.warnings,
          fixes,
          pageCount: pack.pages.length,
        },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: action === "fix" ? "seo_fix_completed" : "seo_generate_completed",
        message: action === "fix"
          ? `Applied ${fixes.length} SEO metadata fix(es) for ${project.name} (overall ${pack.score.overall}/100).`
          : `Generated SEO pack for ${project.name} (overall ${pack.score.overall}/100).`,
        metadataJson: { taskId: task.id, artifactId: artifact.id, score: pack.score, fixes: fixes.length },
      })
    })

    return { ok: true as const, taskId: task.id, artifactId: artifact.id, pack, fixes }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeSeoAgentError ? error.safeMessage : "SEO pack generation failed."

    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "failed",
        error: safeMessage,
        outputJson: { error: safeMessage },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "seo_failed",
        message: `SEO engine failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeSeoAgentError) throw error
    throw new ForgeSeoAgentError("SEO pack generation failed.", 500)
  }
}

async function saveSeoPack(projectId: number, pack: ForgeSeoPack, taskId: number, now: Date) {
  const content = buildForgeSeoArtifactContent(pack)
  const [existing] = await db.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, "seo_pack"),
    eq(forgeArtifacts.title, FORGE_SEO_ARTIFACT_TITLE),
  )).limit(1)

  const metadataJson = {
    ...(existing?.metadataJson ?? {}),
    kind: FORGE_SEO_ARTIFACT_KIND,
    status: "generated",
    pack,
    taskId,
  }

  const [artifact] = existing
    ? await db.update(forgeArtifacts).set({ content, metadataJson, updatedAt: now }).where(eq(forgeArtifacts.id, existing.id)).returning()
    : await db.insert(forgeArtifacts).values({
      projectId,
      type: "seo_pack",
      title: FORGE_SEO_ARTIFACT_TITLE,
      content,
      metadataJson,
      updatedAt: now,
    }).returning()

  return artifact
}

async function persistCopyMetadataFixes(
  projectId: number,
  approvedCopy: ForgeCopyDocument,
  metadata: Record<string, unknown> | null,
  fixes: ForgeSeoFix[],
) {
  const byPath = new Map<string, ForgeSeoFix[]>()
  for (const fix of fixes) {
    byPath.set(fix.path, [...(byPath.get(fix.path) ?? []), fix])
  }

  const patchedPages = approvedCopy.pages.map((page) => {
    const pagePath = normalizePath(page.path)
    const pageFixes = byPath.get(pagePath)
    if (!pageFixes) return page
    const next = { ...page }
    for (const fix of pageFixes) {
      if (fix.field === "title") next.seoTitle = fix.after
      if (fix.field === "metaDescription") next.metaDescription = fix.after
    }
    return next
  })

  const patchedCopy: ForgeCopyDocument = { ...approvedCopy, pages: patchedPages }
  const now = new Date()
  const [existing] = await db.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, "copy_doc"),
    eq(forgeArtifacts.title, FORGE_COPY_ARTIFACT_TITLE),
  )).limit(1)
  if (!existing) return

  const metadataJson = {
    ...(metadata ?? existing.metadataJson ?? {}),
    kind: FORGE_COPY_ARTIFACT_KIND,
    copy: patchedCopy,
    approvedCopy: patchedCopy,
  }

  await db.update(forgeArtifacts).set({ metadataJson, updatedAt: now }).where(eq(forgeArtifacts.id, existing.id))
}

async function loadSeoContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeSeoAgentError("Forge project not found.", 404)

  const [intakeArtifacts, sitemapArtifacts, copyArtifacts, workspaceMemories] = await Promise.all([
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "handover_doc"),
      eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "sitemap"),
      eq(forgeArtifacts.title, FORGE_SITEMAP_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "copy_doc"),
      eq(forgeArtifacts.title, FORGE_COPY_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY),
    )).limit(1),
  ])

  const sitemap = readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson)
  const copy = readForgeCopyDocumentArtifact(copyArtifacts[0]?.metadataJson)

  return {
    project,
    intake: readForgeIntakeArtifact(intakeArtifacts[0]?.metadataJson).intake,
    workspace: readForgeWorkspaceMemory(workspaceMemories[0]?.value),
    approvedSitemap: sitemap.approvedStrategy,
    approvedCopy: copy.approvedCopy,
    copyMetadata: (copyArtifacts[0]?.metadataJson ?? null) as Record<string, unknown> | null,
  }
}

function normalizePath(input: string): string {
  const trimmed = (input ?? "").trim() || "/"
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  const clean = withSlash.replace(/\/+/g, "/").replace(/\/$/g, "")
  return clean || "/"
}
