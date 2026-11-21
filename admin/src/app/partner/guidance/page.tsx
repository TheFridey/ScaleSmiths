import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { partnerWorkspaceEnabled } from "@/lib/server/empower-guidance"
import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { GuidanceSearch } from "@/components/empower/GuidanceSearch"
export const dynamic = "force-dynamic"
/** One place to find approved answers, resources and learning (Operation Empower B1.6). 404 unless PARTNER_UNIFIED_WORKSPACE_ENABLED=true. */
export default async function GuidancePage() {
  await guardPageCapability("expansion.partner")
  if (!partnerWorkspaceEnabled()) notFound()
  return <GuidanceSearch nav={{ academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(), objections: partnerObjectionsEnabled(), guidance: true }} />
}
