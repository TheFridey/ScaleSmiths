import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { summarizeForgeApprovalIntelligence } from "@/lib/forge-approval-intelligence"
import { forgeArtifacts, forgeProjects } from "@/lib/schema"

export async function loadForgeApprovalIntelligenceReport(projectId?: number) {
  const [artifacts, projects] = await Promise.all([
    projectId ? db.select().from(forgeArtifacts).where(eq(forgeArtifacts.projectId, projectId)) : db.select().from(forgeArtifacts),
    projectId ? db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)) : db.select().from(forgeProjects),
  ])
  return {
    projectId: projectId ?? null,
    generatedAt: new Date().toISOString(),
    report: summarizeForgeApprovalIntelligence(
      artifacts.map((artifact) => ({
        id: artifact.id,
        projectId: artifact.projectId,
        type: artifact.type,
        title: artifact.title,
        approvalState: artifact.approvalState,
        approvalHistory: artifact.approvalHistory,
        provider: artifact.provider,
        model: artifact.model,
        qualityState: artifact.qualityState,
        sourceTaskId: artifact.sourceTaskId,
        createdAt: artifact.createdAt,
        metadataJson: artifact.metadataJson,
      })),
      projects.map((project) => ({
        id: project.id,
        status: project.status,
        projectType: project.industry,
        industry: project.industry,
      })),
    ),
  }
}
