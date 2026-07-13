import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { appendArtifactDecision, parseForgeArtifactDecision } from "@/lib/forge-approval-intelligence"
import { buildForgeHumanEditTracking, mergeHumanEditTracking } from "@/lib/forge-human-edits"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import {
  FORGE_DESIGN_SYSTEM_ARTIFACT_KIND,
  FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE,
  FORGE_DESIGN_SYSTEM_SCHEMA,
  buildForgeDesignSystemArtifactContent,
  buildForgeDesignSystemPrompt,
  createMockDesignSystemSpecification,
  parseForgeDesignSystemPayload,
  readForgeDesignSystemArtifact,
} from "@/lib/forge-design-system"
import { FORGE_COPY_ARTIFACT_TITLE, readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { FORGE_DESIGN_ARTIFACT_TITLE, readForgeDesignDirectionArtifact } from "@/lib/forge-design"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact, type ForgeArtifactType } from "@/lib/forge"
import { FORGE_RESEARCH_ARTIFACT_TITLE, type ForgeResearchReport } from "@/lib/forge-research"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { forgeActivityLogs, forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "./forge-ai"
import { hashCanonical, saveVersionedForgeArtifact } from "./forge-artifacts"

export class ForgeDesignSystemAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeDesignSystemAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeDesignSystemAgent(projectId: number, actor: string) {
  const context = await loadDesignSystemContext(projectId)
  const { project, intake, researchReport, approvedSitemap, approvedCopy, approvedDesign, upstreamArtifacts } = context

  if (project.status === "archived") throw new ForgeDesignSystemAgentError("Archived Forge projects cannot generate design-system specifications.", 400)
  if (!approvedSitemap) throw new ForgeDesignSystemAgentError("Approve the sitemap before generating the design system.", 400)
  if (!approvedCopy) throw new ForgeDesignSystemAgentError("Approve copy before generating the design system.", 400)
  if (!approvedDesign) throw new ForgeDesignSystemAgentError("Approve design direction before generating the design system.", 400)

  const inputContext = { projectId, projectName: project.name, upstreamArtifactIds: upstreamArtifacts.map((artifact) => artifact.id) }
  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: "Generate design-system specification",
      description: "Create a token-governed design-system artifact before generated-page implementation.",
      agentType: "design",
      status: "queued",
      inputJson: inputContext,
      updatedAt: now,
    }).returning()
    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "design_system_queued",
      message: `Queued design-system specification for ${project.name}.`,
      metadataJson: { taskId: created.id },
    })
    return [created]
  })

  const startedAt = new Date()
  await db.update(forgeTasks).set({ status: "running", startedAt, updatedAt: startedAt }).where(eq(forgeTasks.id, task.id))
  await db.insert(forgeActivityLogs).values({
    projectId,
    actor,
    action: "design_system_running",
    message: `Design-system agent started for ${project.name}.`,
    metadataJson: { taskId: task.id },
  })

  const mockData = createMockDesignSystemSpecification({ project, intake: intake.intake, researchReport, approvedSitemap, approvedCopy, approvedDesign })

  try {
    const result = await runForgeAiJson({
      ...getForgeAgentRegistryReference("design_system"),
      taskType: "planning",
      schemaName: "forge_design_system_specification",
      schema: FORGE_DESIGN_SYSTEM_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Design System Agent.",
        "Create strict, token-governed design-system specifications before implementation.",
        "Use approved facts only. Do not invent client facts or arbitrary style values.",
      ].join(" "),
      prompt: buildForgeDesignSystemPrompt({ project, intake: intake.intake, researchReport, approvedSitemap, approvedCopy, approvedDesign }),
      maxTokens: 3600,
      timeoutMs: 35_000,
      maxRetries: 2,
      projectId,
      taskId: task.id,
      mockData,
      fallbackOnSchemaMismatch: true,
    })

    const parsed = parseForgeDesignSystemPayload(result.data)
    if (!parsed.ok) throw new ForgeDesignSystemAgentError(parsed.error, 500)
    const specification = parsed.data
    const completedAt = new Date()
    const aiMetadata = buildForgeTaskOutputMetadata({ ...result, data: specification })
    const artifact = await saveVersionedForgeArtifact({
      projectId,
      type: "design_system",
      title: FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE,
      content: buildForgeDesignSystemArtifactContent(specification),
      metadataJson: {
        kind: FORGE_DESIGN_SYSTEM_ARTIFACT_KIND,
        status: "draft",
        specification,
        taskId: task.id,
        ai: aiMetadata.ai,
      },
      actor,
      action: "design_system_version_saved",
      message: `Generated design-system specification for ${project.name}.`,
      provenance: {
        sourceTaskId: task.id,
        provider: result.provider,
        model: result.model,
        ...getForgeAgentRegistryReference("design_system"),
        upstreamArtifacts,
        inputContext,
        actor,
        validationResult: { valid: true, requiredTokenCount: specification.requiredTokenIds.length },
        qualityState: "requires_review",
        approvalState: "unapproved",
      },
    })

    await db.update(forgeTasks).set({
      status: "completed",
      resultQuality: "requires_review",
      downstreamAllowed: false,
      humanApprovalRequired: true,
      publicationBlocked: true,
      outputJson: { ...aiMetadata, artifactId: artifact.id, inputContextHash: hashCanonical(inputContext) },
      completedAt,
      updatedAt: completedAt,
    }).where(eq(forgeTasks.id, task.id))

    return { ok: true as const, taskId: task.id, artifactId: artifact.id, specification, ai: aiMetadata.ai }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAiError ? error.safeMessage : error instanceof Error ? error.message : "Design-system agent failed."
    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "failed",
        resultQuality: "failed",
        error: safeMessage,
        outputJson: { error: safeMessage },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))
      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "design_system_failed",
        message: `Design-system agent failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })
    if (error instanceof ForgeAiError) throw error
    if (error instanceof ForgeDesignSystemAgentError) throw error
    throw new ForgeDesignSystemAgentError("Design-system agent failed.", 500)
  }
}

export async function approveForgeDesignSystem(projectId: number, actor: string, specificationInput: unknown) {
  const parsed = parseForgeDesignSystemPayload(specificationInput)
  if (!parsed.ok) throw new ForgeDesignSystemAgentError(parsed.error, 400)
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeDesignSystemAgentError("Forge project not found.", 404)
  if (project.status === "archived") throw new ForgeDesignSystemAgentError("Archived Forge projects cannot approve design systems.", 400)

  const now = new Date()
  const [existing] = await db.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, "design_system"),
    eq(forgeArtifacts.title, FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE),
  )).orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt)).limit(1)

  const editTracking = existing ? buildForgeHumanEditTracking({
    artifact: existing,
    approvedContent: buildForgeDesignSystemArtifactContent(parsed.data),
    editor: actor,
    reason: "Design-system specification reviewed and approved.",
    now,
  }) : null
  const baseMetadataJson = {
    ...(existing?.metadataJson ?? {}),
    kind: FORGE_DESIGN_SYSTEM_ARTIFACT_KIND,
    status: "approved",
    specification: parsed.data,
    approvedSpecification: parsed.data,
    approvedAt: now.toISOString(),
    approvedBy: actor,
  }
  const approvalDecision = parseForgeArtifactDecision({
    decision: "approved",
    primaryReason: "Design-system specification reviewed and approved before implementation.",
    category: "design_preference",
    severity: "low",
    affectsFutureRegeneration: true,
    acceptanceScope: "partial_acceptance",
  }, actor, now)
  const decisionState = appendArtifactDecision(baseMetadataJson, existing?.approvalHistory, approvalDecision)
  const metadataJson = editTracking ? mergeHumanEditTracking(decisionState.metadataJson, editTracking) : decisionState.metadataJson

  const artifact = await saveVersionedForgeArtifact({
    projectId,
    type: "design_system",
    title: FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE,
    content: buildForgeDesignSystemArtifactContent(parsed.data),
    metadataJson,
    actor,
    action: "design_system_approved",
    message: `Approved design-system specification for ${project.name}.`,
    provenance: {
      sourceTaskId: existing?.sourceTaskId ?? null,
      provider: existing?.provider ?? "human",
      model: existing?.model ?? "human-approved",
      ...getForgeAgentRegistryReference("design_system"),
      upstreamArtifacts: existing ? [{ id: existing.id, outputHash: existing.outputHash }] : [],
      inputContext: { approvedFromArtifactId: existing?.id ?? null, projectId },
      actor,
      validationResult: { valid: true, requiredTokenCount: parsed.data.requiredTokenIds.length },
      qualityState: "validated",
      approvalState: "approved",
      approvalHistory: decisionState.approvalHistory,
    },
  })

  return { ok: true as const, artifactId: artifact.id, specification: parsed.data }
}

async function loadDesignSystemContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeDesignSystemAgentError("Forge project not found.", 404)

  const [intakeArtifacts, researchArtifacts, sitemapArtifacts, copyArtifacts, designArtifacts] = await Promise.all([
    artifact(projectId, "handover_doc", FORGE_INTAKE_ARTIFACT_TITLE),
    artifact(projectId, "research_report", FORGE_RESEARCH_ARTIFACT_TITLE),
    artifact(projectId, "sitemap", FORGE_SITEMAP_ARTIFACT_TITLE),
    artifact(projectId, "copy_doc", FORGE_COPY_ARTIFACT_TITLE),
    artifact(projectId, "design_direction", FORGE_DESIGN_ARTIFACT_TITLE),
  ])
  const intakeArtifact = intakeArtifacts[0]
  const researchArtifact = researchArtifacts[0]
  const sitemapArtifact = sitemapArtifacts[0]
  const copyArtifact = copyArtifacts[0]
  const designArtifact = designArtifacts[0]

  return {
    project,
    intake: readForgeIntakeArtifact(intakeArtifact?.metadataJson),
    researchReport: readApprovedResearchReport(researchArtifact?.metadataJson),
    approvedSitemap: readForgeSitemapStrategyArtifact(sitemapArtifact?.metadataJson).approvedStrategy,
    approvedCopy: readForgeCopyDocumentArtifact(copyArtifact?.metadataJson).approvedCopy,
    approvedDesign: readForgeDesignDirectionArtifact(designArtifact?.metadataJson).approvedDirection,
    existingDesignSystem: readForgeDesignSystemArtifact(null),
    upstreamArtifacts: [researchArtifact, sitemapArtifact, copyArtifact, designArtifact]
      .flatMap((item) => item?.id && item.outputHash ? [{ id: item.id, outputHash: item.outputHash }] : []),
  }
}

function artifact(projectId: number, type: ForgeArtifactType, title: string) {
  return db.select({
    id: forgeArtifacts.id,
    metadataJson: forgeArtifacts.metadataJson,
    outputHash: forgeArtifacts.outputHash,
    sourceTaskId: forgeArtifacts.sourceTaskId,
    provider: forgeArtifacts.provider,
    model: forgeArtifacts.model,
    approvalHistory: forgeArtifacts.approvalHistory,
  }).from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, type),
    eq(forgeArtifacts.title, title),
  )).orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt)).limit(1)
}

function readApprovedResearchReport(metadata: Record<string, unknown> | null | undefined): ForgeResearchReport | null {
  if (!metadata || metadata.kind !== "forge_research_report" || metadata.status !== "approved") return null
  const report = metadata.report
  return report && typeof report === "object" && !Array.isArray(report) ? report as ForgeResearchReport : null
}
