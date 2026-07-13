import "server-only"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { evaluateForgeMigrationInventory, FORGE_MIGRATION_ANALYSIS_ARTIFACT_TITLE } from "@/lib/forge-migration-analysis"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { readForgeSiteInventory, FORGE_SITE_INVENTORY_ARTIFACT_TITLE } from "@/lib/forge-site-inventory"
import { forgeArtifacts, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"

export async function runForgeMigrationAnalysisAgent(projectId: number, actor: string) {
  const [source] = await db.select().from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, "site_inventory"), eq(forgeArtifacts.title, FORGE_SITE_INVENTORY_ARTIFACT_TITLE), eq(forgeArtifacts.approvalState, "approved"), isNull(forgeArtifacts.supersededAt))).orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt)).limit(1)
  if (!source) throw new Error("Approve the current existing-site inventory before running migration analysis.")
  const inventory = readForgeSiteInventory(source.metadataJson?.inventory) ?? readForgeSiteInventory(JSON.parse(source.content ?? "null"))
  if (!inventory) throw new Error("The approved site inventory is invalid or unreadable.")
  const registry = getForgeAgentRegistryReference("migration_analysis")
  const now = new Date()
  const report = evaluateForgeMigrationInventory(inventory, now)
  const [task] = await db.insert(forgeTasks).values({ projectId, title: "Analyse website migration", description: "Build a review-only migration, content, sitemap, and redirect analysis from the approved crawl inventory.", agentType: "strategy", status: "completed", resultQuality: "requires_review", promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion, validationResult: { valid: true, ...report.summary }, downstreamAllowed: false, humanApprovalRequired: true, publicationBlocked: true, outputJson: report.summary, startedAt: now, completedAt: now, updatedAt: now }).returning()
  const artifact = await saveVersionedForgeArtifact({ projectId, type: "migration_analysis", title: FORGE_MIGRATION_ANALYSIS_ARTIFACT_TITLE, content: JSON.stringify(report, null, 2), metadataJson: { kind: report.kind, report, status: "generated", reviewOnly: true }, actor, action: "migration_analysis_completed", message: `Migration analysis completed with ${report.summary.findings} finding(s), ${report.summary.proposedPages} proposed page(s), and ${report.summary.proposedRedirects} proposed redirect(s).`, provenance: { sourceTaskId: task.id, provider: "deterministic", model: "forge-migration-analysis-rules-v1", promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion, upstreamArtifacts: [{ id: source.id, outputHash: source.outputHash }], inputContext: { inventoryArtifactId: source.id, inventoryVersion: source.version, inventoryOutputHash: source.outputHash }, actor, validationResult: { valid: true, ...report.summary }, qualityState: "requires_review", approvalState: "unapproved" } })
  return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
}
