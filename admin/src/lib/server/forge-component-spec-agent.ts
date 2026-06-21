import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"
import {
  FORGE_COMPONENT_SPEC_ARTIFACT_KIND,
  FORGE_COMPONENT_SPEC_ARTIFACT_TITLE,
  FORGE_COMPONENT_SPEC_SCHEMA,
  buildForgeComponentSpecArtifactContent,
  buildForgeComponentSpecPrompt,
  createMockComponentSpec,
  parseForgeComponentSpecPayload,
  readForgeComponentSpecArtifact,
} from "@/lib/forge-component-spec"
import { FORGE_COPY_ARTIFACT_TITLE, readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { FORGE_DESIGN_ARTIFACT_TITLE, readForgeDesignDirectionArtifact } from "@/lib/forge-design"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { forgeActivityLogs, forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"

export class ForgeComponentSpecAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeComponentSpecAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeComponentSpecAgent(projectId: number, actor: string) {
  const { project, approvedSitemap, approvedCopy, approvedDesign } = await loadComponentSpecContext(projectId)

  if (project.status === "archived") {
    throw new ForgeComponentSpecAgentError("Archived Forge projects cannot generate component specs.", 400)
  }

  if (!approvedSitemap) throw new ForgeComponentSpecAgentError("Approve the sitemap before generating component specs.", 400)
  if (!approvedCopy) throw new ForgeComponentSpecAgentError("Approve copy before generating component specs.", 400)
  if (!approvedDesign) throw new ForgeComponentSpecAgentError("Approve design direction before generating component specs.", 400)

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forgeTasks)
      .values({
        projectId,
        title: "Generate component specification",
        description: "Create the exact page and component blueprint before code generation.",
        agentType: "frontend",
        status: "queued",
        inputJson: {
          projectId,
          projectName: project.name,
          sitemapPages: approvedSitemap.sitemap.map((page) => page.path),
          copyPages: approvedCopy.pages.map((page) => page.path),
          designStyle: approvedDesign.designStyleName,
          selectedStylePack: approvedDesign.selectedStylePack,
        },
        updatedAt: now,
      })
      .returning()

    await tx.update(forgeProjects).set({ status: "build", updatedAt: now }).where(eq(forgeProjects.id, projectId))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "component_spec_queued",
      message: `Queued component specification agent for ${project.name}.`,
      metadataJson: { taskId: created.id },
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
      action: "component_spec_running",
      message: `Component specification agent started for ${project.name}.`,
      metadataJson: { taskId: task.id },
    })
  })

  try {
    const result = await runForgeAiJson({
      taskType: "planning",
      schemaName: "forge_component_spec",
      schema: FORGE_COMPONENT_SPEC_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Component Specification Agent.",
        "Create exact implementation blueprints before code generation.",
        "Do not generate code. Return structured JSON only.",
        "Every required reusable component must be included.",
      ].join(" "),
      prompt: buildForgeComponentSpecPrompt({ approvedSitemap, approvedCopy, approvedDesign }),
      maxTokens: 3000,
      timeoutMs: 35_000,
      maxRetries: 2,
      mockData: createMockComponentSpec(approvedSitemap, approvedCopy, approvedDesign),
    })
    const parsed = parseForgeComponentSpecPayload(result.data)
    if (!parsed.ok) throw new ForgeComponentSpecAgentError(parsed.error, 500)

    const spec = parsed.data
    const completedAt = new Date()
    const content = buildForgeComponentSpecArtifactContent(spec)
    const aiMetadata = buildForgeTaskOutputMetadata({ ...result, data: spec })

    const [artifact] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(forgeArtifacts)
        .where(and(
          eq(forgeArtifacts.projectId, projectId),
          eq(forgeArtifacts.type, "component_spec"),
          eq(forgeArtifacts.title, FORGE_COMPONENT_SPEC_ARTIFACT_TITLE),
        ))
        .limit(1)

      const metadataJson = {
        ...(existing?.metadataJson ?? {}),
        kind: FORGE_COMPONENT_SPEC_ARTIFACT_KIND,
        status: existing?.metadataJson?.status === "approved" ? "approved" : "draft",
        spec,
        taskId: task.id,
        ai: aiMetadata.ai,
      }

      const [saved] = existing
        ? await tx
          .update(forgeArtifacts)
          .set({ content, metadataJson, updatedAt: completedAt })
          .where(eq(forgeArtifacts.id, existing.id))
          .returning()
        : await tx
          .insert(forgeArtifacts)
          .values({
            projectId,
            type: "component_spec",
            title: FORGE_COMPONENT_SPEC_ARTIFACT_TITLE,
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
        action: "component_spec_completed",
        message: `Generated component specification for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: saved.id,
          componentCount: spec.components.length,
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
      spec,
      ai: aiMetadata.ai,
    }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAiError
      ? error.safeMessage
      : error instanceof Error
        ? error.message
        : "Component specification agent failed."

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
        action: "component_spec_failed",
        message: `Component specification agent failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeAiError) throw error
    if (error instanceof ForgeComponentSpecAgentError) throw error
    throw new ForgeComponentSpecAgentError("Component specification agent failed.", 500)
  }
}

export async function approveForgeComponentSpec(projectId: number, actor: string, specInput: unknown) {
  const parsed = parseForgeComponentSpecPayload(specInput)
  if (!parsed.ok) throw new ForgeComponentSpecAgentError(parsed.error, 400)

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeComponentSpecAgentError("Forge project not found.", 404)
  if (project.status === "archived") throw new ForgeComponentSpecAgentError("Archived Forge projects cannot approve component specs.", 400)

  const now = new Date()
  const content = buildForgeComponentSpecArtifactContent(parsed.data)
  const [artifact] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "component_spec"),
        eq(forgeArtifacts.title, FORGE_COMPONENT_SPEC_ARTIFACT_TITLE),
      ))
      .limit(1)

    const metadataJson = {
      ...(existing?.metadataJson ?? {}),
      kind: FORGE_COMPONENT_SPEC_ARTIFACT_KIND,
      status: "approved",
      spec: parsed.data,
      approvedSpec: parsed.data,
      approvedAt: now.toISOString(),
      approvedBy: actor,
    }

    const [saved] = existing
      ? await tx
        .update(forgeArtifacts)
        .set({ content, metadataJson, updatedAt: now })
        .where(eq(forgeArtifacts.id, existing.id))
        .returning()
      : await tx
        .insert(forgeArtifacts)
        .values({
          projectId,
          type: "component_spec",
          title: FORGE_COMPONENT_SPEC_ARTIFACT_TITLE,
          content,
          metadataJson,
          updatedAt: now,
        })
        .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "component_spec_approved",
      message: `Approved component specification for ${project.name}.`,
      metadataJson: {
        artifactId: saved.id,
        componentCount: parsed.data.components.length,
        pageCount: parsed.data.pages.length,
        approvedAt: now.toISOString(),
      },
    })

    return [saved]
  })

  return {
    ok: true as const,
    artifactId: artifact.id,
    spec: parsed.data,
  }
}

async function loadComponentSpecContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeComponentSpecAgentError("Forge project not found.", 404)

  const [sitemapArtifacts, copyArtifacts, designArtifacts, specArtifacts] = await Promise.all([
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
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "design_direction"),
      eq(forgeArtifacts.title, FORGE_DESIGN_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "component_spec"),
      eq(forgeArtifacts.title, FORGE_COMPONENT_SPEC_ARTIFACT_TITLE),
    )).limit(1),
  ])

  const sitemap = readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson)
  const copy = readForgeCopyDocumentArtifact(copyArtifacts[0]?.metadataJson)
  const design = readForgeDesignDirectionArtifact(designArtifacts[0]?.metadataJson)
  const componentSpec = readForgeComponentSpecArtifact(specArtifacts[0]?.metadataJson)

  return {
    project,
    approvedSitemap: sitemap.approvedStrategy,
    approvedCopy: copy.approvedCopy,
    approvedDesign: design.approvedDirection,
    existingSpec: componentSpec.spec,
  }
}
