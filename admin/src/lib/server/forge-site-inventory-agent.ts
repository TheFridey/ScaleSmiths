import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { FORGE_SITE_INVENTORY_ARTIFACT_TITLE } from "@/lib/forge-site-inventory"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"
import { crawlForgeExistingSite, type ForgeSiteCrawlerOptions } from "./forge-site-crawler"

export async function runForgeSiteInventoryAgent(projectId: number, actor: string, startUrl: string, options: ForgeSiteCrawlerOptions = {}) {
  if (!startUrl.trim()) throw new Error("A starting website URL is required.")
  const registry = getForgeAgentRegistryReference("site_inventory")
  const startedAt = new Date()
  const [task] = await db.insert(forgeTasks).values({
    projectId, title: "Inventory existing website", description: `Crawl the approved migration source ${new URL(/^https?:\/\//i.test(startUrl) ? startUrl : `https://${startUrl}`).hostname}.`,
    agentType: "research", status: "running", resultQuality: "requires_review", promptIdentifier: registry.promptIdentifier,
    promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion,
    downstreamAllowed: false, humanApprovalRequired: true, publicationBlocked: true, startedAt, updatedAt: startedAt,
  }).returning()
  try {
    const inventory = await crawlForgeExistingSite(startUrl, options)
    const completedAt = new Date()
    const quality = inventory.pages.length > 0 ? "requires_review" as const : "failed" as const
    await db.update(forgeTasks).set({ status: inventory.pages.length ? "completed" : "failed", resultQuality: quality, validationResult: { valid: inventory.pages.length > 0, ...inventory.summary }, outputJson: inventory.summary, error: inventory.pages.length ? null : "No permitted HTML pages were inventoried.", completedAt, updatedAt: completedAt }).where(eq(forgeTasks.id, task.id))
    const artifact = await saveVersionedForgeArtifact({
      projectId, type: "site_inventory", title: FORGE_SITE_INVENTORY_ARTIFACT_TITLE, content: JSON.stringify(inventory, null, 2),
      metadataJson: { kind: inventory.kind, inventory, status: "generated", untrustedContent: true }, actor,
      action: "site_inventory_completed", message: `Existing-site crawl inventoried ${inventory.summary.pagesFetched} page(s) with ${inventory.summary.failures} recorded failure(s).`,
      provenance: { sourceTaskId: task.id, provider: "deterministic", model: "forge-secure-crawler-v1", promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion, inputContext: { startUrl: inventory.startUrl, allowedDomains: inventory.allowedDomains, policy: inventory.policy }, actor, validationResult: { valid: inventory.pages.length > 0, ...inventory.summary }, qualityState: quality, approvalState: "unapproved" },
    })
    return { ok: inventory.pages.length > 0, taskId: task.id, artifactId: artifact.id, inventory }
  } catch (error) {
    const completedAt = new Date()
    await db.update(forgeTasks).set({ status: "failed", resultQuality: "failed", error: error instanceof Error ? error.message : "Site inventory failed.", completedAt, updatedAt: completedAt }).where(eq(forgeTasks.id, task.id))
    throw error
  }
}
