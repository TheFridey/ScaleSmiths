import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"
import {
  FORGE_COPY_ARTIFACT_KIND,
  FORGE_COPY_ARTIFACT_TITLE,
  FORGE_COPY_DOCUMENT_SCHEMA,
  buildForgeCopyArtifactContent,
  buildForgeCopyPrompt,
  createMockCopyDocument,
  normalizeCopySelfCheck,
  parseForgeCopyDocumentPayload,
  readForgeCopyDocumentArtifact,
  type ForgeCopyDocument,
} from "@/lib/forge-copy"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact } from "@/lib/forge"
import { FORGE_RESEARCH_ARTIFACT_KIND, FORGE_RESEARCH_ARTIFACT_TITLE, type ForgeResearchReport } from "@/lib/forge-research"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { forgeActivityLogs, forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"

export class ForgeCopyAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeCopyAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeCopyAgent(projectId: number, actor: string, regeneratePagePath?: string | null) {
  const context = await loadCopyContext(projectId)
  const { project, intake, intakeSummary, researchReport, approvedSitemap, existingCopy } = context

  if (project.status === "archived") {
    throw new ForgeCopyAgentError("Archived Forge projects cannot generate copy.", 400)
  }

  if (!approvedSitemap) {
    throw new ForgeCopyAgentError("Approve the sitemap and strategy before generating copy.", 400)
  }

  if (regeneratePagePath && !approvedSitemap.sitemap.some((page) => page.path === regeneratePagePath)) {
    throw new ForgeCopyAgentError("That page is not part of the approved sitemap.", 400)
  }

  const taskInput = {
    projectId,
    projectName: project.name,
    businessName: project.businessName,
    regeneratePagePath: regeneratePagePath ?? null,
    intakeStatus: intake.status,
    hasResearchReport: Boolean(researchReport),
    approvedSitemapPages: approvedSitemap.sitemap.map((page) => page.path),
  }

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forgeTasks)
      .values({
        projectId,
        title: regeneratePagePath ? `Regenerate copy for ${regeneratePagePath}` : "Generate website copy",
        description: regeneratePagePath
          ? "Regenerate copy for a single approved sitemap page and return the full copy document."
          : "Generate a structured website copy document from approved sitemap, research, and intake.",
        agentType: "copy",
        status: "queued",
        inputJson: taskInput,
        updatedAt: now,
      })
      .returning()

    await tx.update(forgeProjects).set({ status: "copy", updatedAt: now }).where(eq(forgeProjects.id, projectId))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: regeneratePagePath ? "copy_regenerate_queued" : "copy_queued",
      message: regeneratePagePath
        ? `Queued copy regeneration for ${regeneratePagePath} on ${project.name}.`
        : `Queued copy agent for ${project.name}.`,
      metadataJson: { taskId: created.id, regeneratePagePath: regeneratePagePath ?? null },
    })

    return [created]
  })

  const startedAt = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(forgeTasks)
      .set({ status: "running", startedAt, updatedAt: startedAt })
      .where(eq(forgeTasks.id, task.id))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "copy_running",
      message: `Copy agent started for ${project.name}.`,
      metadataJson: { taskId: task.id, regeneratePagePath: regeneratePagePath ?? null },
    })
  })

  try {
    const result = await runForgeAiJson({
      taskType: "copywriting",
      schemaName: "forge_copy_document",
      schema: FORGE_COPY_DOCUMENT_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Copy Agent.",
        "Write concrete website copy for local/service businesses.",
        "Avoid generic AI phrases, vague hype, unsupported claims, and generic SaaS wording.",
        "Return structured JSON with a self-check for sloppy or generic copy.",
      ].join(" "),
      prompt: buildForgeCopyPrompt({
        project,
        approvedSitemap,
        researchReport,
        intakeSummary,
        regeneratePagePath,
        existingCopy,
      }),
      maxTokens: 3200,
      timeoutMs: 35_000,
      maxRetries: 2,
      mockData: createMockCopyDocument(project, approvedSitemap, intake.intake, researchReport),
    })
    const copy = normalizeCopySelfCheck(result.data as ForgeCopyDocument)
    const completedAt = new Date()
    const content = buildForgeCopyArtifactContent(copy)
    const aiMetadata = buildForgeTaskOutputMetadata({ ...result, data: copy })

    const [artifact] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(forgeArtifacts)
        .where(and(
          eq(forgeArtifacts.projectId, projectId),
          eq(forgeArtifacts.type, "copy_doc"),
          eq(forgeArtifacts.title, FORGE_COPY_ARTIFACT_TITLE),
        ))
        .limit(1)

      const metadataJson = {
        ...(existing?.metadataJson ?? {}),
        kind: FORGE_COPY_ARTIFACT_KIND,
        status: existing?.metadataJson?.status === "approved" ? "approved" : "draft",
        copy,
        taskId: task.id,
        regeneratePagePath: regeneratePagePath ?? null,
        ai: aiMetadata.ai,
      }

      const [saved] = existing
        ? await tx
          .update(forgeArtifacts)
          .set({
            content,
            metadataJson,
            updatedAt: completedAt,
          })
          .where(eq(forgeArtifacts.id, existing.id))
          .returning()
        : await tx
          .insert(forgeArtifacts)
          .values({
            projectId,
            type: "copy_doc",
            title: FORGE_COPY_ARTIFACT_TITLE,
            content,
            metadataJson,
            updatedAt: completedAt,
          })
          .returning()

      await tx
        .update(forgeTasks)
        .set({
          status: "completed",
          outputJson: aiMetadata,
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: regeneratePagePath ? "copy_regenerated" : "copy_completed",
        message: regeneratePagePath
          ? `Regenerated copy for ${regeneratePagePath} on ${project.name}.`
          : `Generated copy document for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: saved.id,
          provider: result.provider,
          model: result.model,
          regeneratePagePath: regeneratePagePath ?? null,
          selfCheckStatus: copy.selfCheck.status,
        },
      })

      return [saved]
    })

    return {
      ok: true as const,
      taskId: task.id,
      artifactId: artifact.id,
      copy,
      ai: aiMetadata.ai,
    }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAiError
      ? error.safeMessage
      : error instanceof Error
        ? error.message
        : "Copy agent failed."

    await db.transaction(async (tx) => {
      await tx
        .update(forgeTasks)
        .set({
          status: "failed",
          error: safeMessage,
          outputJson: { error: safeMessage, regeneratePagePath: regeneratePagePath ?? null },
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "copy_failed",
        message: `Copy agent failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage, regeneratePagePath: regeneratePagePath ?? null },
      })
    })

    if (error instanceof ForgeAiError) throw error
    throw new ForgeCopyAgentError("Copy agent failed.", 500)
  }
}

export async function approveForgeCopyDocument(projectId: number, actor: string, copyInput: unknown) {
  const parsed = parseForgeCopyDocumentPayload(copyInput)

  if (!parsed.ok) {
    throw new ForgeCopyAgentError(parsed.error, 400)
  }

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    throw new ForgeCopyAgentError("Forge project not found.", 404)
  }

  if (project.status === "archived") {
    throw new ForgeCopyAgentError("Archived Forge projects cannot approve copy.", 400)
  }

  const copy = normalizeCopySelfCheck(parsed.data)
  const now = new Date()
  const content = buildForgeCopyArtifactContent(copy)
  const [artifact] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "copy_doc"),
        eq(forgeArtifacts.title, FORGE_COPY_ARTIFACT_TITLE),
      ))
      .limit(1)

    const metadataJson = {
      ...(existing?.metadataJson ?? {}),
      kind: FORGE_COPY_ARTIFACT_KIND,
      status: "approved",
      copy,
      approvedCopy: copy,
      approvedAt: now.toISOString(),
      approvedBy: actor,
    }

    const [saved] = existing
      ? await tx
        .update(forgeArtifacts)
        .set({
          content,
          metadataJson,
          updatedAt: now,
        })
        .where(eq(forgeArtifacts.id, existing.id))
        .returning()
      : await tx
        .insert(forgeArtifacts)
        .values({
          projectId,
          type: "copy_doc",
          title: FORGE_COPY_ARTIFACT_TITLE,
          content,
          metadataJson,
          updatedAt: now,
        })
        .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "copy_approved",
      message: `Approved copy document for ${project.name}.`,
      metadataJson: {
        artifactId: saved.id,
        pageCount: copy.pages.length,
        selfCheckStatus: copy.selfCheck.status,
        flaggedPhrases: copy.selfCheck.flaggedPhrases,
      },
    })

    return [saved]
  })

  return {
    ok: true as const,
    artifactId: artifact.id,
    copy,
  }
}

async function loadCopyContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    throw new ForgeCopyAgentError("Forge project not found.", 404)
  }

  const [intakeArtifacts, researchArtifacts, sitemapArtifacts, copyArtifacts] = await Promise.all([
    db
      .select({ content: forgeArtifacts.content, metadataJson: forgeArtifacts.metadataJson })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "handover_doc"),
        eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({ metadataJson: forgeArtifacts.metadataJson })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "research_report"),
        eq(forgeArtifacts.title, FORGE_RESEARCH_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({ metadataJson: forgeArtifacts.metadataJson })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "sitemap"),
        eq(forgeArtifacts.title, FORGE_SITEMAP_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({ metadataJson: forgeArtifacts.metadataJson })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "copy_doc"),
        eq(forgeArtifacts.title, FORGE_COPY_ARTIFACT_TITLE),
      ))
      .limit(1),
  ])

  const intakeArtifact = intakeArtifacts[0]
  const intake = readForgeIntakeArtifact(intakeArtifact?.metadataJson)
  const researchReport = readResearchReport(researchArtifacts[0]?.metadataJson)
  const sitemap = readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson)
  const copyState = readForgeCopyDocumentArtifact(copyArtifacts[0]?.metadataJson)

  return {
    project,
    intake,
    intakeSummary: intakeArtifact?.content ?? "",
    researchReport,
    approvedSitemap: sitemap.approvedStrategy,
    existingCopy: copyState.copy,
  }
}

function readResearchReport(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || metadata.kind !== FORGE_RESEARCH_ARTIFACT_KIND) return null
  return typeof metadata.report === "object" && metadata.report !== null && !Array.isArray(metadata.report)
    ? metadata.report as ForgeResearchReport
    : null
}
