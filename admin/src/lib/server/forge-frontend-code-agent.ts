import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  FORGE_COMPONENT_SPEC_ARTIFACT_TITLE,
  readForgeComponentSpecArtifact,
} from "@/lib/forge-component-spec"
import { FORGE_COPY_ARTIFACT_TITLE, readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { FORGE_DESIGN_ARTIFACT_TITLE, readForgeDesignDirectionArtifact } from "@/lib/forge-design"
import { FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE, readForgeDesignSystemArtifact } from "@/lib/forge-design-system"
import {
  FORGE_GENERATED_CODE_ARTIFACT_KIND,
  FORGE_GENERATED_CODE_ARTIFACT_TITLE,
  buildForgeGeneratedCodeArtifactContent,
  buildForgeGeneratedCodeSummary,
  createForgeFrontendCodeFiles,
  validateForgeGeneratedFileSet,
  type ForgeGeneratedSiteFile,
} from "@/lib/forge-frontend-code"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact, redactIntegrationConfig } from "@/lib/forge"
import { buildForgeSeoContextFromIntake } from "@/lib/forge-seo-context"
import { FORGE_RESEND_PROVIDER, buildResendIntegrationPlaceholder, readForgeResendConfig } from "@/lib/forge-resend"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { FORGE_WHATSAPP_PROVIDER, buildWhatsAppIntegrationPlaceholder, readForgeWhatsAppConfig } from "@/lib/forge-whatsapp"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory, type ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeIntegrationConfigs, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { listForgeWorkspaceFiles, writeForgeWorkspaceFile } from "./forge-workspace"
import { evaluatePersistedProjectTransition } from "./forge-workflow"

export class ForgeFrontendCodeAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeFrontendCodeAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeFrontendCodeAgent(projectId: number, actor: string) {
  await evaluatePersistedProjectTransition({ projectId, to: "build" })
  const {
    project,
    workspace,
    approvedSitemap,
    approvedCopy,
    approvedDesign,
    approvedDesignSystem,
    approvedComponentSpec,
    integrationPlaceholders,
    resendConfig,
    whatsappConfig,
    seoContext,
    warnings,
  } = await loadFrontendCodeContext(projectId)

  if (project.status === "archived") {
    throw new ForgeFrontendCodeAgentError("Archived Forge projects cannot generate site code.", 400)
  }

  if (!workspace) throw new ForgeFrontendCodeAgentError("Create a generated-site workspace before generating code.", 400)
  if (!approvedSitemap) throw new ForgeFrontendCodeAgentError("Approve the sitemap before generating code.", 400)
  if (!approvedCopy) throw new ForgeFrontendCodeAgentError("Approve copy before generating code.", 400)
  if (!approvedDesign) throw new ForgeFrontendCodeAgentError("Approve design direction before generating code.", 400)
  if (!approvedDesignSystem) throw new ForgeFrontendCodeAgentError("Approve the design-system specification before generating code.", 400)
  if (!approvedComponentSpec) throw new ForgeFrontendCodeAgentError("Approve the component specification before generating code.", 400)

  const now = new Date()
  const files = createForgeFrontendCodeFiles({
    project,
    workspace,
    approvedSitemap,
    approvedCopy,
    approvedDesign,
    approvedDesignSystem,
    approvedComponentSpec,
    integrationPlaceholders,
    resendConfig,
    whatsappConfig,
    seoContext,
  })
  const validated = validateForgeGeneratedFileSet(files)
  if (!validated.ok) throw new ForgeFrontendCodeAgentError(validated.error, 400)

  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forgeTasks)
      .values({
        projectId,
        title: "Generate frontend site",
        description: "Generate the static client website into the isolated Forge workspace.",
        agentType: "frontend",
        status: "queued",
        inputJson: {
          projectId,
          projectName: project.name,
          workspace: workspace.relativePath,
          sitemapPages: approvedSitemap.sitemap.map((page) => page.path),
          copyPages: approvedCopy.pages.map((page) => page.path),
          designStyle: approvedDesign.designStyleName,
          designSystemVersion: approvedDesignSystem.version,
          designSystemRequiredTokens: approvedDesignSystem.requiredTokenIds,
          componentCount: approvedComponentSpec.components.length,
          integrationPlaceholders,
        },
        updatedAt: now,
      })
      .returning()

    await tx.update(forgeProjects).set({ status: "build", updatedAt: now }).where(eq(forgeProjects.id, projectId))

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "frontend_code_queued",
      message: `Queued frontend code generation for ${project.name}.`,
      metadataJson: { taskId: created.id, workspace: workspace.relativePath, fileCount: files.length },
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
      action: "frontend_code_running",
      message: `Frontend code generator started for ${project.name}.`,
      metadataJson: { taskId: task.id, workspace: workspace.relativePath },
    })
  })

  try {
    for (const file of files) {
      await writeForgeWorkspaceFile(workspace, file.path, file.content, {
        allowExecutableScripts: true,
        overwrite: true,
      })
    }

    const listedFiles = await listForgeWorkspaceFiles(workspace)
    const updatedWorkspace: ForgeWorkspaceMetadata = {
      ...workspace,
      fileCount: listedFiles.length,
      updatedAt: new Date().toISOString(),
    }
    const completedAt = new Date()
    const summary = buildForgeGeneratedCodeSummary({
      workspace: updatedWorkspace,
      files,
      approvedSitemap,
      approvedComponentSpec,
      approvedDesign,
      integrationPlaceholders,
      warnings,
    })
    const content = buildForgeGeneratedCodeArtifactContent(summary)

    const [artifact] = await db.transaction(async (tx) => {
      const [existingArtifact] = await tx
        .select()
        .from(forgeArtifacts)
        .where(and(
          eq(forgeArtifacts.projectId, projectId),
          eq(forgeArtifacts.type, "generated_code"),
          eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE),
        ))
        .limit(1)

      const metadataJson = {
        ...(existingArtifact?.metadataJson ?? {}),
        kind: FORGE_GENERATED_CODE_ARTIFACT_KIND,
        status: "generated",
        summary,
        files: files.map((file) => ({ path: file.path, purpose: file.purpose })),
        workspace: updatedWorkspace,
        taskId: task.id,
      }

      const [saved] = existingArtifact
        ? await tx
          .update(forgeArtifacts)
          .set({ content, metadataJson, updatedAt: completedAt })
          .where(eq(forgeArtifacts.id, existingArtifact.id))
          .returning()
        : await tx
          .insert(forgeArtifacts)
          .values({
            projectId,
            type: "generated_code",
            title: FORGE_GENERATED_CODE_ARTIFACT_TITLE,
            content,
            metadataJson,
            updatedAt: completedAt,
          })
          .returning()

      await tx
        .update(forgeMemories)
        .set({
          value: JSON.stringify(updatedWorkspace),
          source: "forge_workspace",
          updatedAt: completedAt,
        })
        .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY)))

      await tx
        .update(forgeProjects)
        .set({ status: "qa", updatedAt: completedAt })
        .where(eq(forgeProjects.id, projectId))

      await tx
        .update(forgeTasks)
        .set({
          status: "completed",
          outputJson: {
            summary,
            fileCount: listedFiles.length,
            generatedFileCount: files.length,
          },
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "frontend_code_completed",
        message: `Generated ${files.length} frontend files for ${project.name}; mandatory QA is required before readiness.`,
        metadataJson: {
          taskId: task.id,
          artifactId: saved.id,
          workspace: updatedWorkspace.relativePath,
          fileCount: listedFiles.length,
        },
      })

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "generated_files_written",
        message: `Wrote ${files.length} generated-site files inside ${updatedWorkspace.relativePath}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: saved.id,
          workspace: updatedWorkspace.relativePath,
          files: files.map((file) => file.path),
        },
      })

      return [saved]
    })

    return {
      ok: true as const,
      taskId: task.id,
      artifactId: artifact.id,
      workspace: updatedWorkspace,
      summary,
    }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof Error ? error.message : "Frontend code generation failed."

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
        action: "frontend_code_failed",
        message: `Frontend code generation failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeFrontendCodeAgentError) throw error
    throw new ForgeFrontendCodeAgentError("Frontend code generation failed.", 500)
  }
}

// Regenerates the canonical generated-site files deterministically from the project's approved
// artifacts, without touching the database or queueing a task. Used by the QA repair agent to
// restore a single drifted/corrupted generated file (e.g. a stale site-data.ts left by an older
// generator) when the AI repair provider is unavailable. Returns null when required artifacts are
// missing so the caller can fall back to other repair strategies.
export async function regenerateForgeGeneratedFiles(projectId: number): Promise<ForgeGeneratedSiteFile[] | null> {
  const context = await loadFrontendCodeContext(projectId)
  if (
    !context.workspace ||
    !context.approvedSitemap ||
    !context.approvedCopy ||
    !context.approvedDesign ||
    !context.approvedDesignSystem ||
    !context.approvedComponentSpec
  ) {
    return null
  }

  const files = createForgeFrontendCodeFiles({
    project: context.project,
    workspace: context.workspace,
    approvedSitemap: context.approvedSitemap,
    approvedCopy: context.approvedCopy,
    approvedDesign: context.approvedDesign,
    approvedDesignSystem: context.approvedDesignSystem,
    approvedComponentSpec: context.approvedComponentSpec,
    integrationPlaceholders: context.integrationPlaceholders,
    resendConfig: context.resendConfig,
    whatsappConfig: context.whatsappConfig,
    seoContext: context.seoContext,
  })

  const validated = validateForgeGeneratedFileSet(files)
  if (!validated.ok) return null
  return files
}

async function loadFrontendCodeContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeFrontendCodeAgentError("Forge project not found.", 404)

  const latestArtifact = (type: "handover_doc" | "sitemap" | "copy_doc" | "design_direction" | "design_system" | "component_spec", title: string) => db
    .select({ metadataJson: forgeArtifacts.metadataJson })
    .from(forgeArtifacts)
    .where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, type), eq(forgeArtifacts.title, title)))
    .orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt))
    .limit(1)
  const [intakeArtifacts, workspaceMemories, sitemapArtifacts, copyArtifacts, designArtifacts, designSystemArtifacts, componentSpecArtifacts, integrations] = await Promise.all([
    latestArtifact("handover_doc", FORGE_INTAKE_ARTIFACT_TITLE),
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY),
    )).limit(1),
    latestArtifact("sitemap", FORGE_SITEMAP_ARTIFACT_TITLE),
    latestArtifact("copy_doc", FORGE_COPY_ARTIFACT_TITLE),
    latestArtifact("design_direction", FORGE_DESIGN_ARTIFACT_TITLE),
    latestArtifact("design_system", FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE),
    latestArtifact("component_spec", FORGE_COMPONENT_SPEC_ARTIFACT_TITLE),
    db.select({
      provider: forgeIntegrationConfigs.provider,
      configJson: forgeIntegrationConfigs.configJson,
      enabled: forgeIntegrationConfigs.enabled,
    }).from(forgeIntegrationConfigs).where(eq(forgeIntegrationConfigs.projectId, projectId)),
  ])

  const intake = readForgeIntakeArtifact(intakeArtifacts[0]?.metadataJson)
  const seoContext = buildForgeSeoContextFromIntake(intake.intake)
  const sitemap = readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson)
  const copy = readForgeCopyDocumentArtifact(copyArtifacts[0]?.metadataJson)
  const design = readForgeDesignDirectionArtifact(designArtifacts[0]?.metadataJson)
  const designSystem = readForgeDesignSystemArtifact(designSystemArtifacts[0]?.metadataJson)
  const componentSpec = readForgeComponentSpecArtifact(componentSpecArtifacts[0]?.metadataJson)
  const workspace = readForgeWorkspaceMemory(workspaceMemories[0]?.value)
  const integrationPlaceholders = integrations
    .filter((integration) => integration.enabled)
    .map((integration) => `${integration.provider}: ${JSON.stringify(redactIntegrationConfig(integration.configJson))}`)
  const resendIntegration = integrations.find((integration) => integration.provider === FORGE_RESEND_PROVIDER)
  const resendConfig = readForgeResendConfig(resendIntegration?.configJson, resendIntegration?.enabled)
  const whatsappIntegration = integrations.find((integration) => integration.provider === FORGE_WHATSAPP_PROVIDER)
  const whatsappConfig = readForgeWhatsAppConfig(whatsappIntegration?.configJson, whatsappIntegration?.enabled)

  return {
    project,
    workspace,
    approvedSitemap: sitemap.approvedStrategy,
    approvedCopy: copy.approvedCopy,
    approvedDesign: design.approvedDirection,
    approvedDesignSystem: designSystem.approvedSpecification,
    approvedComponentSpec: componentSpec.approvedSpec,
    integrationPlaceholders: [
      ...(componentSpec.approvedSpec?.integrationPlaceholders ?? []),
      ...integrationPlaceholders,
      buildResendIntegrationPlaceholder(resendConfig),
      buildWhatsAppIntegrationPlaceholder(whatsappConfig),
    ],
    resendConfig,
    whatsappConfig,
    seoContext,
    warnings: buildContextWarnings({
      hasServicePage: sitemap.approvedStrategy?.sitemap.some((page) => !["/", "/about", "/contact", "/service-area"].includes(page.path)) ?? false,
      hasAboutPage: sitemap.approvedStrategy?.sitemap.some((page) => /about/i.test(`${page.path} ${page.title}`)) ?? false,
      hasContactPage: sitemap.approvedStrategy?.sitemap.some((page) => /contact|quote|enquiry/i.test(`${page.path} ${page.title}`)) ?? false,
    }),
  }
}

function buildContextWarnings({
  hasServicePage,
  hasAboutPage,
  hasContactPage,
}: {
  hasServicePage: boolean
  hasAboutPage: boolean
  hasContactPage: boolean
}) {
  const warnings: string[] = []
  if (!hasServicePage) warnings.push("Approved sitemap did not include an obvious service page; generator adds /services as a foundational service route.")
  if (!hasAboutPage) warnings.push("Approved sitemap did not include an About page; generator adds /about as a foundational trust route.")
  if (!hasContactPage) warnings.push("Approved sitemap did not include a Contact page; generator adds /contact as a foundational enquiry route.")
  return warnings
}
