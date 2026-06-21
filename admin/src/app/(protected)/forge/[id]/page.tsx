import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { and, desc, eq } from "drizzle-orm"
import { ForgeProjectDetail } from "@/components/forge/ForgeProjectDetail"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeArtifacts, forgeIntegrationConfigs, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { FORGE_INTAKE_ARTIFACT_TITLE, readForgeIntakeArtifact } from "@/lib/forge"
import { FORGE_COMMAND_CHAT_MEMORY_KEY, readForgeCommandChatMemory } from "@/lib/forge-command-chat"
import { FORGE_COMPONENT_SPEC_ARTIFACT_TITLE, readForgeComponentSpecArtifact } from "@/lib/forge-component-spec"
import { FORGE_COPY_ARTIFACT_TITLE, readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { FORGE_DESIGN_ARTIFACT_TITLE, readForgeDesignDirectionArtifact } from "@/lib/forge-design"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE, readForgeGeneratedCodeArtifact } from "@/lib/forge-frontend-code"
import { FORGE_PREVIEW_MEMORY_KEY, readForgePreviewMemory } from "@/lib/forge-preview"
import { FORGE_QA_ARTIFACT_TITLE, readForgeQaArtifact } from "@/lib/forge-qa"
import { FORGE_SEO_ARTIFACT_TITLE, readForgeSeoArtifact } from "@/lib/forge-seo"
import { FORGE_VISUAL_QA_ARTIFACT_TITLE, readForgeVisualQaArtifact } from "@/lib/forge-visual-qa"
import { FORGE_PROPOSAL_ARTIFACT_TITLE, readForgeProposalArtifact } from "@/lib/forge-proposal"
import { FORGE_EXPORT_ARTIFACT_TITLE, readForgeExportArtifact } from "@/lib/forge-export"
import { FORGE_DEPLOY_ARTIFACT_TITLE, readForgeDeploymentArtifact } from "@/lib/forge-deploy"
import { FORGE_RESEND_PROVIDER, readForgeResendConfig } from "@/lib/forge-resend"
import { FORGE_SITEMAP_ARTIFACT_TITLE, readForgeSitemapStrategyArtifact } from "@/lib/forge-sitemap"
import { FORGE_WHATSAPP_PROVIDER, readForgeWhatsAppConfig } from "@/lib/forge-whatsapp"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"

export const metadata: Metadata = { title: "Forge Project" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export default async function ForgeProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) notFound()

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, id)).limit(1)

  if (!project) notFound()

  const [tasks, artifacts, integrations, activityLogs, memories, intakeArtifacts, sitemapArtifacts, copyArtifacts, designArtifacts, componentSpecArtifacts, generatedCodeArtifacts, qaArtifacts, seoArtifacts, visualQaArtifacts, proposalArtifacts, exportArtifacts, deployArtifacts] = await Promise.all([
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
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "handover_doc"),
        eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "sitemap"),
        eq(forgeArtifacts.title, FORGE_SITEMAP_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "copy_doc"),
        eq(forgeArtifacts.title, FORGE_COPY_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "design_direction"),
        eq(forgeArtifacts.title, FORGE_DESIGN_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "component_spec"),
        eq(forgeArtifacts.title, FORGE_COMPONENT_SPEC_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "generated_code"),
        eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "qa_report"),
        eq(forgeArtifacts.title, FORGE_QA_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "seo_pack"),
        eq(forgeArtifacts.title, FORGE_SEO_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "visual_qa"),
        eq(forgeArtifacts.title, FORGE_VISUAL_QA_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "proposal"),
        eq(forgeArtifacts.title, FORGE_PROPOSAL_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "export_record"),
        eq(forgeArtifacts.title, FORGE_EXPORT_ARTIFACT_TITLE),
      ))
      .limit(1),
    db
      .select({
        metadataJson: forgeArtifacts.metadataJson,
      })
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, id),
        eq(forgeArtifacts.type, "deployment_notes"),
        eq(forgeArtifacts.title, FORGE_DEPLOY_ARTIFACT_TITLE),
      ))
      .limit(1),
  ])
  const workspaceMemory = memories.find((memory) => memory.key === FORGE_WORKSPACE_MEMORY_KEY)
  const previewMemory = memories.find((memory) => memory.key === FORGE_PREVIEW_MEMORY_KEY)
  const commandChatMemory = memories.find((memory) => memory.key === FORGE_COMMAND_CHAT_MEMORY_KEY)
  const resendIntegration = integrations.find((integration) => integration.provider === FORGE_RESEND_PROVIDER)
  const whatsappIntegration = integrations.find((integration) => integration.provider === FORGE_WHATSAPP_PROVIDER)

  return (
    <ForgeProjectDetail
      project={project}
      tasks={tasks}
      artifacts={artifacts}
      integrations={integrations}
      activityLogs={activityLogs}
      memories={memories}
      initialIntake={readForgeIntakeArtifact(intakeArtifacts[0]?.metadataJson)}
      initialSitemap={readForgeSitemapStrategyArtifact(sitemapArtifacts[0]?.metadataJson)}
      initialCopy={readForgeCopyDocumentArtifact(copyArtifacts[0]?.metadataJson)}
      initialDesign={readForgeDesignDirectionArtifact(designArtifacts[0]?.metadataJson)}
      initialComponentSpec={readForgeComponentSpecArtifact(componentSpecArtifacts[0]?.metadataJson)}
      initialWorkspace={readForgeWorkspaceMemory(workspaceMemory?.value)}
      initialGeneratedCode={readForgeGeneratedCodeArtifact(generatedCodeArtifacts[0]?.metadataJson)}
      initialPreview={readForgePreviewMemory(previewMemory?.value)}
      initialQa={readForgeQaArtifact(qaArtifacts[0]?.metadataJson)}
      initialSeo={readForgeSeoArtifact(seoArtifacts[0]?.metadataJson)}
      initialVisualQa={readForgeVisualQaArtifact(visualQaArtifacts[0]?.metadataJson)}
      initialProposal={readForgeProposalArtifact(proposalArtifacts[0]?.metadataJson)}
      initialExport={readForgeExportArtifact(exportArtifacts[0]?.metadataJson)}
      initialDeploy={readForgeDeploymentArtifact(deployArtifacts[0]?.metadataJson)}
      initialCommandChat={readForgeCommandChatMemory(commandChatMemory?.value)}
      initialResendConfig={readForgeResendConfig(resendIntegration?.configJson, resendIntegration?.enabled)}
      initialWhatsAppConfig={readForgeWhatsAppConfig(whatsappIntegration?.configJson, whatsappIntegration?.enabled)}
    />
  )
}
