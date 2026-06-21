import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact } from "@/lib/forge"
import { FORGE_RESEARCH_ARTIFACT_KIND, FORGE_RESEARCH_ARTIFACT_TITLE, type ForgeResearchReport } from "@/lib/forge-research"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { FORGE_SEO_ARTIFACT_TITLE, readForgeSeoArtifact } from "@/lib/forge-seo"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE, readForgeGeneratedCodeArtifact } from "@/lib/forge-frontend-code"
import { FORGE_QA_ARTIFACT_TITLE, readForgeQaArtifact } from "@/lib/forge-qa"
import {
  FORGE_PROPOSAL_ARTIFACT_KIND,
  FORGE_PROPOSAL_ARTIFACT_TITLE,
  buildForgeProposalArtifactContent,
  buildForgeProposalBundle,
  findForgeProposalOverpromises,
  type ForgeProposalInputs,
} from "@/lib/forge-proposal"
import { forgeActivityLogs, forgeArtifacts, forgeIntegrationConfigs, forgeProjects, forgeTasks } from "@/lib/schema"

type ForgeArtifactTypeName = "handover_doc" | "research_report" | "sitemap" | "seo_pack" | "generated_code" | "qa_report"

export class ForgeProposalAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeProposalAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export type ForgeProposalAgentAction = "proposal" | "audit"

export async function runForgeProposalAgent(projectId: number, actor: string, action: ForgeProposalAgentAction = "proposal") {
  const { project, inputs } = await loadProposalContext(projectId)

  if (project.status === "archived") throw new ForgeProposalAgentError("Archived Forge projects cannot generate sales assets.", 400)
  if (!inputs.intake && !inputs.research && !inputs.sitemap) {
    throw new ForgeProposalAgentError("Capture intake (and ideally research/sitemap) before generating a proposal or audit.", 400)
  }

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: action === "audit" ? "Generate website audit" : "Generate proposal pack",
      description: action === "audit"
        ? "Generate a client-facing website audit from the available Forge artifacts."
        : "Generate a client-facing proposal, audit, retainer recommendation, roadmap, and handover notes.",
      agentType: "integration",
      status: "running",
      inputJson: { projectId, projectName: project.name, action },
      startedAt: now,
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: action === "audit" ? "proposal_audit_running" : "proposal_running",
      message: action === "audit"
        ? `Generating website audit for ${project.name}.`
        : `Generating proposal pack for ${project.name}.`,
      metadataJson: { taskId: created.id },
    })

    return [created]
  })

  try {
    const bundle = buildForgeProposalBundle(inputs)
    const overpromises = findForgeProposalOverpromises(bundle)
    if (overpromises.length) {
      // The generator is deterministic and compliant; this guards against regressions.
      throw new ForgeProposalAgentError(`Generated proposal contained non-compliant claims: ${overpromises.join(", ")}.`, 500)
    }

    const completedAt = new Date()
    const artifact = await saveProposalBundle(projectId, bundle, task.id, completedAt)

    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "completed",
        outputJson: {
          action,
          artifactId: artifact.id,
          recommendedRetainer: bundle.retainer.recommendedTier,
          pageCount: bundle.proposal.pagesIncluded.length,
        },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: action === "audit" ? "proposal_audit_completed" : "proposal_completed",
        message: action === "audit"
          ? `Generated website audit for ${project.name}.`
          : `Generated proposal pack for ${project.name} (recommended retainer: ${bundle.retainer.recommendedTier}).`,
        metadataJson: { taskId: task.id, artifactId: artifact.id, action },
      })
    })

    return { ok: true as const, taskId: task.id, artifactId: artifact.id, bundle }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeProposalAgentError ? error.safeMessage : "Proposal generation failed."

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
        action: "proposal_failed",
        message: `Proposal generation failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeProposalAgentError) throw error
    throw new ForgeProposalAgentError("Proposal generation failed.", 500)
  }
}

async function saveProposalBundle(projectId: number, bundle: ReturnType<typeof buildForgeProposalBundle>, taskId: number, now: Date) {
  const content = buildForgeProposalArtifactContent(bundle)
  const [existing] = await db.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, "proposal"),
    eq(forgeArtifacts.title, FORGE_PROPOSAL_ARTIFACT_TITLE),
  )).limit(1)

  const metadataJson = {
    ...(existing?.metadataJson ?? {}),
    kind: FORGE_PROPOSAL_ARTIFACT_KIND,
    status: "generated",
    bundle,
    taskId,
  }

  const [artifact] = existing
    ? await db.update(forgeArtifacts).set({ content, metadataJson, updatedAt: now }).where(eq(forgeArtifacts.id, existing.id)).returning()
    : await db.insert(forgeArtifacts).values({
      projectId,
      type: "proposal",
      title: FORGE_PROPOSAL_ARTIFACT_TITLE,
      content,
      metadataJson,
      updatedAt: now,
    }).returning()

  return artifact
}

async function loadProposalContext(projectId: number): Promise<{ project: typeof forgeProjects.$inferSelect; inputs: ForgeProposalInputs }> {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeProposalAgentError("Forge project not found.", 404)

  const [intakeArtifacts, researchArtifacts, sitemapArtifacts, seoArtifacts, generatedCodeArtifacts, qaArtifacts, integrations] = await Promise.all([
    selectArtifact(projectId, "handover_doc", FORGE_INTAKE_ARTIFACT_TITLE),
    selectArtifact(projectId, "research_report", FORGE_RESEARCH_ARTIFACT_TITLE),
    selectArtifact(projectId, "sitemap", FORGE_SITEMAP_ARTIFACT_TITLE),
    selectArtifact(projectId, "seo_pack", FORGE_SEO_ARTIFACT_TITLE),
    selectArtifact(projectId, "generated_code", FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    selectArtifact(projectId, "qa_report", FORGE_QA_ARTIFACT_TITLE),
    db.select({
      provider: forgeIntegrationConfigs.provider,
      enabled: forgeIntegrationConfigs.enabled,
    }).from(forgeIntegrationConfigs).where(eq(forgeIntegrationConfigs.projectId, projectId)),
  ])

  const intakeState = readForgeIntakeArtifact(intakeArtifacts[0]?.metadataJson)
  const research = readResearchReport(researchArtifacts[0]?.metadataJson)
  const sitemap = readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson)
  const seo = readForgeSeoArtifact(seoArtifacts[0]?.metadataJson)
  const generated = readForgeGeneratedCodeArtifact(generatedCodeArtifacts[0]?.metadataJson)
  const qa = readForgeQaArtifact(qaArtifacts[0]?.metadataJson)

  const inputs: ForgeProposalInputs = {
    project: {
      name: project.name,
      businessName: project.businessName,
      industry: project.industry,
      websiteUrl: project.websiteUrl,
      targetAudience: project.targetAudience,
      primaryGoal: project.primaryGoal,
      budgetRange: project.budgetRange,
      brandNotes: project.brandNotes,
    },
    intake: intakeState.status === "completed" || hasIntakeData(intakeState.intake) ? intakeState.intake : null,
    intakeCompleteness: intakeState.completenessScore,
    research,
    sitemap: sitemap.approvedStrategy ?? sitemap.strategy,
    seo: seo.pack,
    generatedSite: generated.summary,
    qa: qa.report,
    integrations: integrations.map((integration) => ({ provider: String(integration.provider), enabled: Boolean(integration.enabled) })),
  }

  return { project, inputs }
}

function readResearchReport(metadata: Record<string, unknown> | null | undefined): ForgeResearchReport | null {
  if (!metadata || metadata.kind !== FORGE_RESEARCH_ARTIFACT_KIND) return null
  return typeof metadata.report === "object" && metadata.report !== null && !Array.isArray(metadata.report)
    ? metadata.report as ForgeResearchReport
    : null
}

function hasIntakeData(intake: Record<string, string>): boolean {
  return Object.values(intake).some((value) => typeof value === "string" && value.trim().length > 0)
}

async function selectArtifact(projectId: number, type: ForgeArtifactTypeName, title: string) {
  return db
    .select({ metadataJson: forgeArtifacts.metadataJson })
    .from(forgeArtifacts)
    .where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, type),
      eq(forgeArtifacts.title, title),
    ))
    .orderBy(desc(forgeArtifacts.updatedAt))
    .limit(1)
}
