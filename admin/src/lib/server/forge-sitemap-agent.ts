import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"
import {
  FORGE_SITEMAP_ARTIFACT_KIND,
  FORGE_SITEMAP_ARTIFACT_TITLE,
  FORGE_SITEMAP_STRATEGY_SCHEMA,
  buildForgeSitemapArtifactContent,
  buildForgeSitemapPrompt,
  createMockSitemapStrategy,
  parseForgeSitemapStrategyPayload,
  type ForgeSitemapStrategy,
} from "@/lib/forge-sitemap"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact } from "@/lib/forge"
import { FORGE_RESEARCH_ARTIFACT_KIND, FORGE_RESEARCH_ARTIFACT_TITLE, type ForgeResearchReport } from "@/lib/forge-research"
import { forgeActivityLogs, forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"

export class ForgeSitemapAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeSitemapAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeSitemapAgent(projectId: number, actor: string) {
  const context = await loadSitemapContext(projectId)
  const { project, intake, intakeSummary, researchReport } = context

  if (project.status === "archived") {
    throw new ForgeSitemapAgentError("Archived Forge projects cannot generate a sitemap.", 400)
  }

  const taskInput = {
    projectId,
    projectName: project.name,
    businessName: project.businessName,
    intakeStatus: intake.status,
    intakeCompletenessScore: intake.completenessScore,
    hasResearchReport: Boolean(researchReport),
    note: "Sitemap strategy is generated from supplied intake and research artifacts.",
  }

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forgeTasks)
      .values({
        projectId,
        title: "Generate sitemap and strategy",
        description: "Create a local/service-business sitemap, search intent plan, CTAs, trust plan, and build order.",
        agentType: "sitemap",
        status: "queued",
        inputJson: taskInput,
        updatedAt: now,
      })
      .returning()

    await tx.update(forgeProjects).set({ status: "sitemap", updatedAt: now }).where(eq(forgeProjects.id, projectId))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "sitemap_queued",
      message: `Queued sitemap and strategy agent for ${project.name}.`,
      metadataJson: { taskId: created.id, hasResearchReport: Boolean(researchReport) },
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
      action: "sitemap_running",
      message: `Sitemap and strategy agent started for ${project.name}.`,
      metadataJson: { taskId: task.id },
    })
  })

  try {
    const result = await runForgeAiJson({
      taskType: "planning",
      schemaName: "forge_sitemap_strategy",
      schema: FORGE_SITEMAP_STRATEGY_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Sitemap and Strategy Agent.",
        "Return practical structured JSON for a local/service-business website.",
        "Do not generate generic SaaS sitemap recommendations unless the intake explicitly asks for a SaaS product website.",
      ].join(" "),
      prompt: buildForgeSitemapPrompt({ project, intakeSummary, researchReport }),
      maxTokens: 2200,
      timeoutMs: 30_000,
      maxRetries: 2,
      projectId,
      taskId: task.id,
      mockData: createMockSitemapStrategy(project, intake.intake, researchReport),
    })
    const strategy = result.data as ForgeSitemapStrategy
    const completedAt = new Date()
    const content = buildForgeSitemapArtifactContent(strategy)
    const aiMetadata = buildForgeTaskOutputMetadata(result)

    const [artifact] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(forgeArtifacts)
        .where(and(
          eq(forgeArtifacts.projectId, projectId),
          eq(forgeArtifacts.type, "sitemap"),
          eq(forgeArtifacts.title, FORGE_SITEMAP_ARTIFACT_TITLE),
        ))
        .limit(1)

      const existingMetadata = existing?.metadataJson ?? {}
      const metadataJson = {
        ...existingMetadata,
        kind: FORGE_SITEMAP_ARTIFACT_KIND,
        status: existingMetadata.status === "approved" ? "approved" : "draft",
        strategy,
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
            type: "sitemap",
            title: FORGE_SITEMAP_ARTIFACT_TITLE,
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
        action: "sitemap_completed",
        message: `Generated sitemap and strategy for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: saved.id,
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
      strategy,
      ai: aiMetadata.ai,
    }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAiError
      ? error.safeMessage
      : error instanceof Error
        ? error.message
        : "Sitemap and strategy agent failed."

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
        action: "sitemap_failed",
        message: `Sitemap and strategy agent failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeAiError) throw error
    throw new ForgeSitemapAgentError("Sitemap and strategy agent failed.", 500)
  }
}

export async function approveForgeSitemapStrategy(projectId: number, actor: string, strategyInput: unknown) {
  const parsed = parseForgeSitemapStrategyPayload(strategyInput)

  if (!parsed.ok) {
    throw new ForgeSitemapAgentError(parsed.error, 400)
  }

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    throw new ForgeSitemapAgentError("Forge project not found.", 404)
  }

  if (project.status === "archived") {
    throw new ForgeSitemapAgentError("Archived Forge projects cannot approve a sitemap.", 400)
  }

  const now = new Date()
  const content = buildForgeSitemapArtifactContent(parsed.data)
  const [artifact] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "sitemap"),
        eq(forgeArtifacts.title, FORGE_SITEMAP_ARTIFACT_TITLE),
      ))
      .limit(1)

    const metadataJson = {
      ...(existing?.metadataJson ?? {}),
      kind: FORGE_SITEMAP_ARTIFACT_KIND,
      status: "approved",
      strategy: parsed.data,
      approvedStrategy: parsed.data,
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
          type: "sitemap",
          title: FORGE_SITEMAP_ARTIFACT_TITLE,
          content,
          metadataJson,
          updatedAt: now,
        })
        .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "sitemap_approved",
      message: `Approved sitemap and strategy for ${project.name}.`,
      metadataJson: {
        artifactId: saved.id,
        pageCount: parsed.data.sitemap.length,
        approvedAt: now.toISOString(),
      },
    })

    return [saved]
  })

  return {
    ok: true as const,
    artifactId: artifact.id,
    strategy: parsed.data,
  }
}

async function loadSitemapContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    throw new ForgeSitemapAgentError("Forge project not found.", 404)
  }

  const [intakeArtifacts, researchArtifacts] = await Promise.all([
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
  ])

  const intakeArtifact = intakeArtifacts[0]
  const researchArtifact = researchArtifacts[0]
  const intake = readForgeIntakeArtifact(intakeArtifact?.metadataJson)
  const researchReport = readResearchReport(researchArtifact?.metadataJson)

  return {
    project,
    intake,
    intakeSummary: intakeArtifact?.content ?? "",
    researchReport,
  }
}

function readResearchReport(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || metadata.kind !== FORGE_RESEARCH_ARTIFACT_KIND) return null
  return typeof metadata.report === "object" && metadata.report !== null && !Array.isArray(metadata.report)
    ? metadata.report as ForgeResearchReport
    : null
}
