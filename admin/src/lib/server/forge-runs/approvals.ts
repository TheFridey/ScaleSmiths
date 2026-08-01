import "server-only"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeArtifacts } from "@/lib/schema"
import type { ForgeRunStage } from "@/lib/forge-run-stages"

export const AUTOMATIC_POLICY_ACTOR = "forge-run-policy"
type ForgeArtifactTypeValue = typeof forgeArtifacts.$inferSelect.type

export async function approveAutomaticStageOutput(projectId: number, stage: ForgeRunStage, producedArtifacts: readonly ForgeArtifactTypeValue[]) {
  const [artifact] = await db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), inArray(forgeArtifacts.type, [...producedArtifacts]), isNull(forgeArtifacts.supersededAt))).orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt)).limit(1)
  const metadata = artifact?.metadataJson ?? {}
  switch (stage) {
    case "sitemap": {
      const { approveForgeSitemapStrategy } = await import("../forge-sitemap-agent")
      await approveForgeSitemapStrategy(projectId, AUTOMATIC_POLICY_ACTOR, metadata.strategy)
      return true
    }
    case "copy": {
      const { approveForgeCopyDocument } = await import("../forge-copy-agent")
      await approveForgeCopyDocument(projectId, AUTOMATIC_POLICY_ACTOR, metadata.copy)
      return true
    }
    case "design_direction": {
      const { approveForgeDesignDirection } = await import("../forge-design-agent")
      await approveForgeDesignDirection(projectId, AUTOMATIC_POLICY_ACTOR, metadata.direction, metadata.selectedStylePack, metadata.selectedAnimationPack)
      return true
    }
    case "design_system": {
      const { approveForgeDesignSystem } = await import("../forge-design-system-agent")
      await approveForgeDesignSystem(projectId, AUTOMATIC_POLICY_ACTOR, metadata.specification)
      return true
    }
    case "component_specification": {
      const { approveForgeComponentSpec } = await import("../forge-component-spec-agent")
      await approveForgeComponentSpec(projectId, AUTOMATIC_POLICY_ACTOR, metadata.spec)
      return true
    }
    default:
      return false
  }
}
