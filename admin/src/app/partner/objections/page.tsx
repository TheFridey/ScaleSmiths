import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { ObjectionHandling } from "@/components/empower/ObjectionHandling"
export const dynamic = "force-dynamic"
/** Partner objection handling (Operation Empower B1.5). 404 unless PARTNER_OBJECTION_HANDLING_ENABLED=true. */
export default async function ObjectionsPage() {
  await guardPageCapability("expansion.partner")
  if (!partnerObjectionsEnabled()) notFound()
  return <ObjectionHandling nav={{ academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(), objections: true }} />
}
