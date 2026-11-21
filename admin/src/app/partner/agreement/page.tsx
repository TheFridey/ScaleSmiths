import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { PartnerAgreement } from "@/components/expansion/PartnerAgreement"
export const dynamic = "force-dynamic"
/** The signed-in partner's own agreement: what was issued, what they accepted, and any reissued version awaiting acceptance. */
export default async function PartnerAgreementPage() {
  await guardPageCapability("expansion.partner")
  return <PartnerAgreement nav={{ academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled() }} />
}
