import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerResourcesEnabled, partnerKnowledgeEnabled } from "@/lib/server/empower-partner"
import { AcademyHome } from "@/components/empower/AcademyHome"
export const dynamic = "force-dynamic"
/** Partner Academy home (Operation Empower B1.2). 404 unless PARTNER_ACADEMY_ENABLED=true. */
export default async function AcademyPage() {
  await guardPageCapability("expansion.partner")
  if (!partnerAcademyEnabled()) notFound()
  return <AcademyHome nav={{ academy: true, resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(), objections: partnerObjectionsEnabled() }} />
}
