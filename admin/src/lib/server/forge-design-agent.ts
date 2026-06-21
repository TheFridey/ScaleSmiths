import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"
import {
  FORGE_DESIGN_ARTIFACT_KIND,
  FORGE_DESIGN_ARTIFACT_TITLE,
  FORGE_DESIGN_DIRECTION_SCHEMA,
  buildForgeDesignArtifactContent,
  buildForgeDesignPrompt,
  createMockDesignDirection,
  isForgeDesignStylePack,
  normalizeDesignDirection,
  parseForgeDesignDirectionPayload,
  readForgeDesignDirectionArtifact,
  type ForgeDesignDirection,
  type ForgeDesignStylePack,
} from "@/lib/forge-design"
import { isForgeAnimationPack, type ForgeAnimationPackName } from "@/lib/forge-animation"
import { FORGE_COPY_ARTIFACT_TITLE, readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact } from "@/lib/forge"
import { FORGE_RESEARCH_ARTIFACT_KIND, FORGE_RESEARCH_ARTIFACT_TITLE, type ForgeResearchReport } from "@/lib/forge-research"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { forgeActivityLogs, forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"

export class ForgeDesignAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeDesignAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeDesignAgent(
  projectId: number,
  actor: string,
  preferredStylePack?: ForgeDesignStylePack | null,
  preferredAnimationPack?: ForgeAnimationPackName | null,
) {
  const context = await loadDesignContext(projectId)
  const { project, intake, intakeSummary, researchReport, approvedSitemap, approvedCopy } = context

  if (project.status === "archived") {
    throw new ForgeDesignAgentError("Archived Forge projects cannot generate design direction.", 400)
  }

  if (!approvedSitemap) {
    throw new ForgeDesignAgentError("Approve the sitemap and strategy before generating design direction.", 400)
  }

  if (!approvedCopy) {
    throw new ForgeDesignAgentError("Approve copy before generating design direction.", 400)
  }

  const taskInput = {
    projectId,
    projectName: project.name,
    businessName: project.businessName,
    industry: project.industry,
    preferredStylePack: preferredStylePack ?? null,
    preferredAnimationPack: preferredAnimationPack ?? null,
    hasResearchReport: Boolean(researchReport),
    approvedCopyPages: approvedCopy.pages.map((page) => page.path),
  }

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forgeTasks)
      .values({
        projectId,
        title: "Generate design direction",
        description: "Create a premium pre-build design direction from approved sitemap and copy.",
        agentType: "design",
        status: "queued",
        inputJson: taskInput,
        updatedAt: now,
      })
      .returning()

    await tx.update(forgeProjects).set({ status: "design", updatedAt: now }).where(eq(forgeProjects.id, projectId))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "design_queued",
      message: `Queued design direction agent for ${project.name}.`,
      metadataJson: { taskId: created.id, preferredStylePack: preferredStylePack ?? null, preferredAnimationPack: preferredAnimationPack ?? null },
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
      action: "design_running",
      message: `Design direction agent started for ${project.name}.`,
      metadataJson: { taskId: task.id },
    })
  })

  try {
    const result = await runForgeAiJson({
      taskType: "planning",
      schemaName: "forge_design_direction",
      schema: FORGE_DESIGN_DIRECTION_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Design Agent.",
        "Make concrete, premium, practical design decisions before code is created.",
        "Do not return generic AI website direction.",
        "Warn against over-animated designs and keep motion purposeful.",
      ].join(" "),
      prompt: buildForgeDesignPrompt({
        project,
        intake: intake.intake,
        intakeSummary,
        researchReport,
        approvedSitemap,
        approvedCopy,
        preferredStylePack,
        preferredAnimationPack,
      }),
      maxTokens: 2200,
      timeoutMs: 30_000,
      maxRetries: 2,
      mockData: createMockDesignDirection({ project, intake: intake.intake, approvedSitemap, approvedCopy, preferredStylePack, preferredAnimationPack }),
    })
    const direction = normalizeDesignDirection(result.data as ForgeDesignDirection)
    const completedAt = new Date()
    const content = buildForgeDesignArtifactContent(direction)
    const aiMetadata = buildForgeTaskOutputMetadata({ ...result, data: direction })

    const [artifact] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(forgeArtifacts)
        .where(and(
          eq(forgeArtifacts.projectId, projectId),
          eq(forgeArtifacts.type, "design_direction"),
          eq(forgeArtifacts.title, FORGE_DESIGN_ARTIFACT_TITLE),
        ))
        .limit(1)

      const metadataJson = {
        ...(existing?.metadataJson ?? {}),
        kind: FORGE_DESIGN_ARTIFACT_KIND,
        status: existing?.metadataJson?.status === "approved" ? "approved" : "draft",
        direction,
        taskId: task.id,
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
            type: "design_direction",
            title: FORGE_DESIGN_ARTIFACT_TITLE,
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
        action: "design_completed",
        message: `Generated design direction for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: saved.id,
          selectedStylePack: direction.selectedStylePack,
          selectedAnimationPack: direction.selectedAnimationPack,
          provider: result.provider,
          model: result.model,
        },
      })

      return [saved]
    })

    return {
      ok: true as const,
      taskId: task.id,
      artifactId: artifact.id,
      direction,
      ai: aiMetadata.ai,
    }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAiError
      ? error.safeMessage
      : error instanceof Error
        ? error.message
        : "Design direction agent failed."

    await db.transaction(async (tx) => {
      await tx
        .update(forgeTasks)
        .set({
          status: "failed",
          error: safeMessage,
          outputJson: { error: safeMessage },
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "design_failed",
        message: `Design direction agent failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeAiError) throw error
    throw new ForgeDesignAgentError("Design direction agent failed.", 500)
  }
}

export async function approveForgeDesignDirection(
  projectId: number,
  actor: string,
  directionInput: unknown,
  selectedStylePackInput?: unknown,
  selectedAnimationPackInput?: unknown,
) {
  const parsed = parseForgeDesignDirectionPayload(directionInput)

  if (!parsed.ok) {
    throw new ForgeDesignAgentError(parsed.error, 400)
  }

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    throw new ForgeDesignAgentError("Forge project not found.", 404)
  }

  if (project.status === "archived") {
    throw new ForgeDesignAgentError("Archived Forge projects cannot approve design direction.", 400)
  }

  const direction = normalizeDesignDirection({
    ...parsed.data,
    selectedStylePack: isForgeDesignStylePack(selectedStylePackInput) ? selectedStylePackInput : parsed.data.selectedStylePack,
    selectedAnimationPack: isForgeAnimationPack(selectedAnimationPackInput) ? selectedAnimationPackInput : parsed.data.selectedAnimationPack,
  })
  const now = new Date()
  const content = buildForgeDesignArtifactContent(direction)
  const [artifact] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "design_direction"),
        eq(forgeArtifacts.title, FORGE_DESIGN_ARTIFACT_TITLE),
      ))
      .limit(1)

    const metadataJson = {
      ...(existing?.metadataJson ?? {}),
      kind: FORGE_DESIGN_ARTIFACT_KIND,
      status: "approved",
      direction,
      approvedDirection: direction,
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
          type: "design_direction",
          title: FORGE_DESIGN_ARTIFACT_TITLE,
          content,
          metadataJson,
          updatedAt: now,
        })
        .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "design_approved",
      message: `Approved design direction for ${project.name}.`,
      metadataJson: {
        artifactId: saved.id,
        selectedStylePack: direction.selectedStylePack,
        selectedAnimationPack: direction.selectedAnimationPack,
        approvedAt: now.toISOString(),
      },
    })

    return [saved]
  })

  return {
    ok: true as const,
    artifactId: artifact.id,
    direction,
  }
}

async function loadDesignContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    throw new ForgeDesignAgentError("Forge project not found.", 404)
  }

  const [intakeArtifacts, researchArtifacts, sitemapArtifacts, copyArtifacts, designArtifacts] = await Promise.all([
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
    db
      .select({ metadataJson: forgeArtifacts.metadataJson })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "design_direction"),
        eq(forgeArtifacts.title, FORGE_DESIGN_ARTIFACT_TITLE),
      ))
      .limit(1),
  ])

  const intakeArtifact = intakeArtifacts[0]
  const intake = readForgeIntakeArtifact(intakeArtifact?.metadataJson)
  const researchReport = readResearchReport(researchArtifacts[0]?.metadataJson)
  const sitemap = readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson)
  const copyState = readForgeCopyDocumentArtifact(copyArtifacts[0]?.metadataJson)
  const designState = readForgeDesignDirectionArtifact(designArtifacts[0]?.metadataJson)

  return {
    project,
    intake,
    intakeSummary: intakeArtifact?.content ?? "",
    researchReport,
    approvedSitemap: sitemap.approvedStrategy,
    approvedCopy: copyState.approvedCopy,
    existingDirection: designState.direction,
  }
}

function readResearchReport(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || metadata.kind !== FORGE_RESEARCH_ARTIFACT_KIND) return null
  return typeof metadata.report === "object" && metadata.report !== null && !Array.isArray(metadata.report)
    ? metadata.report as ForgeResearchReport
    : null
}
