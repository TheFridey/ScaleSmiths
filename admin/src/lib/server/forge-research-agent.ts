import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"
import {
  FORGE_RESEARCH_ARTIFACT_KIND,
  FORGE_RESEARCH_ARTIFACT_TITLE,
  FORGE_RESEARCH_REPORT_SCHEMA,
  buildForgeResearchArtifactContent,
  buildForgeResearchPrompt,
  createMockResearchReport,
  extractForgeResearchCompetitors,
  type ForgeResearchReport,
} from "@/lib/forge-research"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact } from "@/lib/forge"
import { forgeActivityLogs, forgeArtifacts, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"

export class ForgeResearchAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeResearchAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeResearchAgent(projectId: number, actor: string) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    throw new ForgeResearchAgentError("Forge project not found.", 404)
  }

  if (project.status === "archived") {
    throw new ForgeResearchAgentError("Archived Forge projects cannot run research.", 400)
  }

  const [intakeArtifact] = await db
    .select({ metadataJson: forgeArtifacts.metadataJson })
    .from(forgeArtifacts)
    .where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "handover_doc"),
      eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
    ))
    .limit(1)

  const intake = readForgeIntakeArtifact(intakeArtifact?.metadataJson)
  const memories = await db
    .select({
      key: forgeMemories.key,
      value: forgeMemories.value,
      source: forgeMemories.source,
    })
    .from(forgeMemories)
    .where(eq(forgeMemories.projectId, projectId))

  const competitors = extractForgeResearchCompetitors(intake.intake)
  const taskInput = {
    projectId,
    projectName: project.name,
    businessName: project.businessName,
    websiteUrl: project.websiteUrl,
    competitors,
    intakeStatus: intake.status,
    intakeCompletenessScore: intake.completenessScore,
    missingIntakeFields: intake.missingFields,
    memoryCount: memories.length,
    note: "Research uses supplied context only; no live website scraping or crawling is performed.",
  }

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forgeTasks)
      .values({
        projectId,
        title: "Run research agent",
        description: "Generate a structured website and business research report from intake data.",
        agentType: "research",
        status: "queued",
        inputJson: taskInput,
        updatedAt: now,
      })
      .returning()

    await tx.update(forgeProjects).set({ status: "research", updatedAt: now }).where(eq(forgeProjects.id, projectId))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "research_queued",
      message: `Queued research agent for ${project.name}.`,
      metadataJson: { taskId: created.id, intakeCompletenessScore: intake.completenessScore },
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
      action: "research_running",
      message: `Research agent started for ${project.name}.`,
      metadataJson: { taskId: task.id },
    })
  })

  try {
    const result = await runForgeAiJson({
      taskType: "planning",
      schemaName: "forge_research_report",
      schema: FORGE_RESEARCH_REPORT_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Research Agent.",
        "Return practical structured JSON for building a premium client website.",
        "Use only supplied context and do not claim live website inspection or scraping.",
        "Return exactly these top-level keys: businessSummary, customerPersonas, localSeoOpportunities, trustGaps, conversionGaps, competitorPositioning, recommendedPages, recommendedCallsToAction, recommendedProofSections, aeoGeoOpportunities, contentOpportunities.",
        "Every array field must be an array, even when there is only one item.",
        "recommendedPages priority must be exactly one of: primary, secondary, supporting.",
      ].join(" "),
      prompt: buildForgeResearchPrompt({ project, intake: intake.intake, memories }),
      maxTokens: 2200,
      timeoutMs: 90_000,
      maxRetries: 1,
      projectId,
      taskId: task.id,
      fallbackOnSchemaMismatch: true,
      mockData: createMockResearchReport(project, intake.intake),
    })
    const report = result.data as ForgeResearchReport
    const completedAt = new Date()
    const content = buildForgeResearchArtifactContent(report)
    const aiMetadata = buildForgeTaskOutputMetadata(result)

    const [artifact] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(forgeArtifacts)
        .where(and(
          eq(forgeArtifacts.projectId, projectId),
          eq(forgeArtifacts.type, "research_report"),
          eq(forgeArtifacts.title, FORGE_RESEARCH_ARTIFACT_TITLE),
        ))
        .limit(1)

      const metadataJson = {
        kind: FORGE_RESEARCH_ARTIFACT_KIND,
        report,
        taskId: task.id,
        intakeCompletenessScore: intake.completenessScore,
        competitors,
        noScrapingPerformed: true,
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
            type: "research_report",
            title: FORGE_RESEARCH_ARTIFACT_TITLE,
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
        action: "research_completed",
        message: `Completed research report for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: saved.id,
          provider: result.provider,
          model: result.model,
          noScrapingPerformed: true,
        },
      })

      return [saved]
    })

    return {
      ok: true as const,
      taskId: task.id,
      artifactId: artifact.id,
      report,
      ai: aiMetadata.ai,
    }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAiError
      ? error.safeMessage
      : error instanceof Error
        ? error.message
        : "Research agent failed."

    await db.transaction(async (tx) => {
      await tx
        .update(forgeTasks)
        .set({
          status: "failed",
          error: safeMessage,
          outputJson: {
            error: safeMessage,
            noScrapingPerformed: true,
          },
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "research_failed",
        message: `Research agent failed for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          error: safeMessage,
        },
      })
    })

    if (error instanceof ForgeAiError) throw error
    throw new ForgeResearchAgentError("Research agent failed.", 500)
  }
}
