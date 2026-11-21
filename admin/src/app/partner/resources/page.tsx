import { partnerWorkspaceEnabled } from "@/lib/server/empower-guidance"
import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerResourcesEnabled, partnerKnowledgeEnabled } from "@/lib/server/empower-partner"
import { ResourceCentre } from "@/components/empower/ResourceCentre"
export const dynamic = "force-dynamic"
/** Partner Resource Centre (Operation Empower B1.3). 404 unless PARTNER_RESOURCE_CENTRE_ENABLED=true. */
export default async function ResourcesPage() {
  await guardPageCapability("expansion.partner")
  if (!partnerResourcesEnabled()) notFound()
  return <ResourceCentre nav={{ academy: partnerAcademyEnabled(), resources: true, knowledge: partnerKnowledgeEnabled(), guidance: partnerWorkspaceEnabled() }} />
}
