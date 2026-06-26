import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { isBuildPhaseWithoutDatabase } from "@/lib/build-env"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact, type ForgeArtifactType } from "@/lib/forge"
import { FORGE_COMMAND_CHAT_MEMORY_KEY, readForgeCommandChatMemory } from "@/lib/forge-command-chat"
import { FORGE_COMPONENT_SPEC_ARTIFACT_TITLE, readForgeComponentSpecArtifact } from "@/lib/forge-component-spec"
import { FORGE_COPY_ARTIFACT_TITLE, readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { FORGE_DEPLOY_ARTIFACT_TITLE, readForgeDeploymentArtifact } from "@/lib/forge-deploy"
import { FORGE_DESIGN_ARTIFACT_TITLE, readForgeDesignDirectionArtifact } from "@/lib/forge-design"
import { FORGE_EXPORT_ARTIFACT_TITLE, readForgeExportArtifact } from "@/lib/forge-export"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE, readForgeGeneratedCodeArtifact } from "@/lib/forge-frontend-code"
import { FORGE_PREVIEW_MEMORY_KEY, readForgePreviewMemory } from "@/lib/forge-preview"
import { FORGE_PROPOSAL_ARTIFACT_TITLE, readForgeProposalArtifact } from "@/lib/forge-proposal"
import { FORGE_QA_ARTIFACT_TITLE, readForgeQaArtifact } from "@/lib/forge-qa"
import { FORGE_RESEND_PROVIDER, readForgeResendConfig } from "@/lib/forge-resend"
import { FORGE_SEO_ARTIFACT_TITLE, readForgeSeoArtifact } from "@/lib/forge-seo"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { FORGE_VISUAL_QA_ARTIFACT_TITLE, readForgeVisualQaArtifact } from "@/lib/forge-visual-qa"
import { FORGE_VISUAL_CRITIQUE_ARTIFACT_TITLE, readForgeVisualCritiqueArtifact } from "@/lib/forge-visual-critique"
import { FORGE_WHATSAPP_PROVIDER, readForgeWhatsAppConfig } from "@/lib/forge-whatsapp"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { readForgeBuildBriefState } from "@/lib/forge-intake-brief"
import { buildForgeAiBudgetStatus } from "@/lib/forge-ai-usage"
import {
  forgeActivityLogs,
  forgeArtifacts,
  forgeIntegrationConfigs,
  forgeMemories,
  forgeProjects,
  forgeTasks,
} from "@/lib/schema"

export async function loadForgeDashboardPageData() {
  if (isBuildPhaseWithoutDatabase()) {
    return {
      projects: [],
      recentActivity: [],
      aiMetrics: {
        todaySpend: 0,
        monthSpend: 0,
        mostExpensiveProject: null,
        averageCostPerSite: 0,
        budget: {
          project: buildForgeAiBudgetStatus(0, null),
          monthly: buildForgeAiBudgetStatus(0, null),
        },
      },
      averageDesignScore: null,
    }
  }

  const { db } = await import("@/lib/db")
  const { loadForgeAiDashboardMetrics } = await import("./forge-ai-usage")
  const [projects, recentActivity, aiMetrics, averageDesignScore] = await Promise.all([
    db
      .select({
        id: forgeProjects.id,
        name: forgeProjects.name,
        businessName: forgeProjects.businessName,
        industry: forgeProjects.industry,
        websiteUrl: forgeProjects.websiteUrl,
        status: forgeProjects.status,
        priority: forgeProjects.priority,
        deadline: forgeProjects.deadline,
        updatedAt: forgeProjects.updatedAt,
      })
      .from(forgeProjects)
      .orderBy(desc(forgeProjects.updatedAt)),
    db
      .select({
        id: forgeActivityLogs.id,
        action: forgeActivityLogs.action,
        message: forgeActivityLogs.message,
        actor: forgeActivityLogs.actor,
        createdAt: forgeActivityLogs.createdAt,
      })
      .from(forgeActivityLogs)
      .orderBy(desc(forgeActivityLogs.createdAt))
      .limit(6),
    loadForgeAiDashboardMetrics(),
    loadAverageDesignScore(),
  ])

  return { projects, recentActivity, aiMetrics, averageDesignScore }
}

export async function loadForgeProjectPageData(id: number) {
  if (isBuildPhaseWithoutDatabase()) return null

  const { db } = await import("@/lib/db")
  const { loadForgeAiProjectMetrics, loadForgeCostQualityModel } = await import("./forge-ai-usage")
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, id)).limit(1)

  if (!project) return null

  const [projectSummaries, tasks, artifacts, integrations, activityLogs, memories, aiUsage, intakeArtifacts, sitemapArtifacts, copyArtifacts, designArtifacts, componentSpecArtifacts, generatedCodeArtifacts, visualCritiqueArtifacts, qaArtifacts, seoArtifacts, visualQaArtifacts, proposalArtifacts, exportArtifacts, deployArtifacts] = await Promise.all([
    db
      .select({
        id: forgeProjects.id,
        name: forgeProjects.name,
        businessName: forgeProjects.businessName,
        status: forgeProjects.status,
        priority: forgeProjects.priority,
        updatedAt: forgeProjects.updatedAt,
      })
      .from(forgeProjects)
      .orderBy(desc(forgeProjects.updatedAt))
      .limit(12),
    db
      .select({
        id: forgeTasks.id,
        title: forgeTasks.title,
        description: forgeTasks.description,
        agentType: forgeTasks.agentType,
        status: forgeTasks.status,
        createdAt: forgeTasks.createdAt,
      })
      .from(forgeTasks)
      .where(eq(forgeTasks.projectId, id))
      .orderBy(desc(forgeTasks.createdAt)),
    db
      .select({
        id: forgeArtifacts.id,
        type: forgeArtifacts.type,
        title: forgeArtifacts.title,
        content: forgeArtifacts.content,
        createdAt: forgeArtifacts.createdAt,
      })
      .from(forgeArtifacts)
      .where(eq(forgeArtifacts.projectId, id))
      .orderBy(desc(forgeArtifacts.createdAt)),
    db
      .select({
        id: forgeIntegrationConfigs.id,
        provider: forgeIntegrationConfigs.provider,
        configJson: forgeIntegrationConfigs.configJson,
        enabled: forgeIntegrationConfigs.enabled,
        updatedAt: forgeIntegrationConfigs.updatedAt,
      })
      .from(forgeIntegrationConfigs)
      .where(eq(forgeIntegrationConfigs.projectId, id))
      .orderBy(desc(forgeIntegrationConfigs.updatedAt)),
    db
      .select({
        id: forgeActivityLogs.id,
        actor: forgeActivityLogs.actor,
        action: forgeActivityLogs.action,
        message: forgeActivityLogs.message,
        createdAt: forgeActivityLogs.createdAt,
      })
      .from(forgeActivityLogs)
      .where(eq(forgeActivityLogs.projectId, id))
      .orderBy(desc(forgeActivityLogs.createdAt)),
    db
      .select({
        id: forgeMemories.id,
        key: forgeMemories.key,
        value: forgeMemories.value,
        source: forgeMemories.source,
        updatedAt: forgeMemories.updatedAt,
      })
      .from(forgeMemories)
      .where(eq(forgeMemories.projectId, id))
      .orderBy(desc(forgeMemories.updatedAt)),
    loadForgeAiProjectMetrics(id),
    selectArtifactMetadata(id, "handover_doc", FORGE_INTAKE_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "sitemap", FORGE_SITEMAP_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "copy_doc", FORGE_COPY_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "design_direction", FORGE_DESIGN_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "component_spec", FORGE_COMPONENT_SPEC_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "generated_code", FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "visual_critique", FORGE_VISUAL_CRITIQUE_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "qa_report", FORGE_QA_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "seo_pack", FORGE_SEO_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "visual_qa", FORGE_VISUAL_QA_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "proposal", FORGE_PROPOSAL_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "export_record", FORGE_EXPORT_ARTIFACT_TITLE),
    selectArtifactMetadata(id, "deployment_notes", FORGE_DEPLOY_ARTIFACT_TITLE),
  ])
  const workspaceMemory = memories.find((memory) => memory.key === FORGE_WORKSPACE_MEMORY_KEY)
  const previewMemory = memories.find((memory) => memory.key === FORGE_PREVIEW_MEMORY_KEY)
  const commandChatMemory = memories.find((memory) => memory.key === FORGE_COMMAND_CHAT_MEMORY_KEY)
  const resendIntegration = integrations.find((integration) => integration.provider === FORGE_RESEND_PROVIDER)
  const whatsappIntegration = integrations.find((integration) => integration.provider === FORGE_WHATSAPP_PROVIDER)

  const intakeMetadata = intakeArtifacts[0]?.metadataJson
  const intakeState = readForgeIntakeArtifact(intakeMetadata)
  const initialQa = readForgeQaArtifact(qaArtifacts[0]?.metadataJson)
  const costQuality = await loadForgeCostQualityModel(id, initialQa)

  return {
    project,
    costQuality,
    projectSummaries,
    tasks,
    artifacts,
    integrations,
    activityLogs,
    memories,
    aiUsage,
    initialIntake: { ...intakeState, buildBrief: readForgeBuildBriefState(intakeMetadata) },
    initialSitemap: readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson),
    initialCopy: readForgeCopyDocumentArtifact(copyArtifacts[0]?.metadataJson),
    initialDesign: readForgeDesignDirectionArtifact(designArtifacts[0]?.metadataJson),
    initialComponentSpec: readForgeComponentSpecArtifact(componentSpecArtifacts[0]?.metadataJson),
    initialWorkspace: readForgeWorkspaceMemory(workspaceMemory?.value),
    initialGeneratedCode: readForgeGeneratedCodeArtifact(generatedCodeArtifacts[0]?.metadataJson),
    initialVisualCritique: readForgeVisualCritiqueArtifact(visualCritiqueArtifacts[0]?.metadataJson),
    initialPreview: readForgePreviewMemory(previewMemory?.value),
    initialQa,
    initialSeo: readForgeSeoArtifact(seoArtifacts[0]?.metadataJson),
    initialVisualQa: readForgeVisualQaArtifact(visualQaArtifacts[0]?.metadataJson),
    initialProposal: readForgeProposalArtifact(proposalArtifacts[0]?.metadataJson),
    initialExport: readForgeExportArtifact(exportArtifacts[0]?.metadataJson),
    initialDeploy: readForgeDeploymentArtifact(deployArtifacts[0]?.metadataJson),
    initialCommandChat: readForgeCommandChatMemory(commandChatMemory?.value),
    initialResendConfig: readForgeResendConfig(resendIntegration?.configJson, resendIntegration?.enabled),
    initialWhatsAppConfig: readForgeWhatsAppConfig(whatsappIntegration?.configJson, whatsappIntegration?.enabled),
  }
}

async function selectArtifactMetadata(projectId: number, type: ForgeArtifactType, title: string) {
  const { db } = await import("@/lib/db")
  return db
    .select({ metadataJson: forgeArtifacts.metadataJson })
    .from(forgeArtifacts)
    .where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, type),
      eq(forgeArtifacts.title, title),
    ))
    .orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt))
    .limit(1)
}

async function loadAverageDesignScore() {
  const { db } = await import("@/lib/db")
  const rows = await db
    .select({ metadataJson: forgeArtifacts.metadataJson })
    .from(forgeArtifacts)
    .where(eq(forgeArtifacts.type, "visual_critique"))

  const scores = rows
    .map((row) => readForgeVisualCritiqueArtifact(row.metadataJson).score)
    .filter((score): score is number => typeof score === "number")

  if (!scores.length) return null
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
}
