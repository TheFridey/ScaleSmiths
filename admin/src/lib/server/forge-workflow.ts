import "server-only"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { readForgeGeneratedCodeArtifact, FORGE_GENERATED_CODE_ARTIFACT_TITLE } from "@/lib/forge-frontend-code"
import { readForgeQaArtifact, FORGE_QA_ARTIFACT_TITLE } from "@/lib/forge-qa"
import { readForgeSitemapStrategyArtifact, FORGE_SITEMAP_ARTIFACT_TITLE } from "@/lib/forge-sitemap"
import { decideProjectTransition, type ForgeProjectState } from "@/lib/forge-state-machine"
import { forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"
import type { AdminRole } from "@/lib/admin-users"

export class ForgeWorkflowError extends Error {
  constructor(public safeMessage: string, public code: string, public status = 409) { super(safeMessage); this.name = "ForgeWorkflowError" }
}

export async function evaluatePersistedProjectTransition(input: { projectId: number; to: ForgeProjectState; actorRole?: AdminRole; override?: boolean; reason?: string }) {
  const [project] = await db.select({ status: forgeProjects.status }).from(forgeProjects).where(eq(forgeProjects.id, input.projectId)).limit(1)
  if (!project) throw new ForgeWorkflowError("Forge project not found.", "project_not_found", 404)
  const [sitemapRows, buildRows, qaRows, failedTasks] = await Promise.all([
    currentArtifact(input.projectId, "sitemap", FORGE_SITEMAP_ARTIFACT_TITLE),
    currentArtifact(input.projectId, "generated_code", FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    currentArtifact(input.projectId, "qa_report", FORGE_QA_ARTIFACT_TITLE),
    db.select({ id: forgeTasks.id }).from(forgeTasks).where(and(eq(forgeTasks.projectId, input.projectId), eq(forgeTasks.status, "failed"))).limit(1),
  ])
  const facts = {
    sitemapApproved: readForgeSitemapStrategyArtifact(sitemapRows[0]?.metadataJson).status === "approved",
    buildExists: readForgeGeneratedCodeArtifact(buildRows[0]?.metadataJson).status === "generated",
    qaPassed: readForgeQaArtifact(qaRows[0]?.metadataJson).status === "passed",
    failedPrerequisite: failedTasks.length > 0,
  }
  const decision = decideProjectTransition({ from: project.status, to: input.to, facts, actorRole: input.actorRole, override: input.override, reason: input.reason })
  if (!decision.allowed) throw new ForgeWorkflowError(decision.message, decision.code)
  return { previousState: project.status, newState: input.to, overridden: decision.overridden, reason: input.reason?.trim() || null, facts }
}

export function workflowAuditMetadata(result: { previousState: string; newState: string; overridden: boolean; reason: string | null }, timestamp = new Date()) {
  return { previousState: result.previousState, newState: result.newState, timestamp: timestamp.toISOString(), reason: result.reason, override: result.overridden }
}

function currentArtifact(projectId: number, type: typeof forgeArtifacts.$inferSelect.type, title: string) {
  return db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, type), eq(forgeArtifacts.title, title), isNull(forgeArtifacts.supersededAt))).orderBy(desc(forgeArtifacts.version)).limit(1)
}
